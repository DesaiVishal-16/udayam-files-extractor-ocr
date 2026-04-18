import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export interface LandRecord {
  id: string;
  fileName: string;
  villageName: string;
  talukaName: string;
  districtName: string;
  gutNumber: string;
  status: 'मंजूर' | 'नामंजूर' | 'अस्पष्ट';
  confidence: number;
  reasoning: string;
  timestamp: number;
  fileUrl?: string;
}

export async function processLandRecord(file: File): Promise<LandRecord> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return processExcelFile(file);
  }

  const base64Data = await fileToBase64(file);
  const mimeType = file.type;

  const prompt = `
    You are an expert in Maharashtra Land Records (Ferfar system / Mutation Records). 
    Analyze the provided handwritten Marathi document (image or PDF).
    
    Context:
    - "Ferfar" (फेरफार) refers to mutation entries in land records.
    - "Gut Number" (गट क्रमांक) is the land parcel identifier.
    - "Status" is usually found at the end of the entry, often with a signature or stamp.
    - Look for "मंजूर" (Approved) or "नामंजूर" (Rejected/Not Approved).
    
    Tasks:
    1. Perform high-accuracy OCR on the handwritten Marathi text. Pay extreme attention to Marathi digits (०, १, २, ३, ४, ५, ६, ७, ८, ९). 
       - CRITICAL: Distinguish '६' (6) vs '८' (8). '६' usually has a downward curve or loop at the bottom, while '८' is more closed or has a different stroke direction.
       - CRITICAL: Distinguish '१' (1) vs '९' (9). '१' is often a simple curve or hook, while '९' has a distinct loop at the top.
       - CRITICAL: Distinguish '४' (4) vs '५' (5) if they appear similar in cursive.
       - STEP-BY-STEP VERIFICATION: 
         a) Identify the digit in Marathi script.
         b) Compare it with other digits in the same document to understand the scribe's handwriting style.
         c) Cross-reference with the "Ferfar" entry context (e.g., if a Gut Number is mentioned multiple times, ensure consistency).
         d) Convert to standard English digits (0-9).
    2. Use contextual clues to fill in missing or unclear letters (e.g., if you see "ता. हवेली", the Taluka is "हवेली").
    3. Extract:
       - Village Name (गाव)
       - Taluka Name (तालुका)
       - District Name (जिल्हा)
       - Gut Number (गट क्रमांक) - IMPORTANT: If there are multiple Gut Numbers mentioned on the page, extract ALL of them and separate them with a comma (e.g., "386, 396"). Ensure they are in English digits.
       - Status (मंजूर / नामंजूर)
    4. If the status is not explicitly "मंजूर" or "नामंजूर", look for phrases like "प्रमाणित करण्यात येत आहे" (is being certified) which implies approval, or "रद्द" (cancelled) which implies rejection.
    5. Provide a confidence score (0-100).
    6. Provide a brief reasoning in English explaining why you chose the status.

    Return JSON only.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            villageName: { type: Type.STRING },
            talukaName: { type: Type.STRING },
            districtName: { type: Type.STRING },
            gutNumber: { type: Type.STRING },
            status: { 
              type: Type.STRING,
              enum: ["मंजूर", "नामंजूर", "अस्पष्ट"]
            },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
          },
          required: ["villageName", "talukaName", "districtName", "gutNumber", "status", "confidence", "reasoning"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    // Fallback: Convert any Marathi digits to English digits if AI missed it
    const marathiToEnglish = (str: string) => {
      const map: { [key: string]: string } = {
        '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', 
        '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
      };
      return str.replace(/[०-९]/g, m => map[m]);
    };

    const gutNumber = marathiToEnglish(result.gutNumber || "अस्पष्ट");
    
    return {
      id: Math.random().toString(36).substring(7),
      fileName: file.name,
      villageName: result.villageName || "अस्पष्ट",
      talukaName: result.talukaName || "अस्पष्ट",
      districtName: result.districtName || "अस्पष्ट",
      gutNumber: gutNumber,
      status: result.status || "अस्पष्ट",
      confidence: result.confidence || 0,
      reasoning: result.reasoning || "No reasoning provided.",
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error processing land record:", error);
    throw new Error("Failed to process the document. Please ensure the image is clear.");
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}

async function processExcelFile(file: File): Promise<LandRecord> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
  
  if (!data || data.length < 2) {
    throw new Error("Excel file is empty or has no data rows.");
  }

  const findHeaderRow = () => {
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      if (!row) continue;
      const rowStr = row.map((c: unknown) => c != null ? String(c).toLowerCase() : '').join(' ');
      if (rowStr.includes('gut') || rowStr.includes('गट') || rowStr.includes('village') || rowStr.includes('गाव')) {
        return i;
      }
    }
    return 0;
  };

  const headerRowIndex = findHeaderRow();
  const headerRow = (data[headerRowIndex] || []).map(h => h != null ? String(h).toLowerCase().trim() : '');
  const dataRow = (data[headerRowIndex + 1] || []).map(h => h != null ? String(h) : '');

  if (dataRow.length === 0 || dataRow.every(c => !c.trim())) {
    return processExcelWithAI(file, data);
  }

  const gutIdx = headerRow.findIndex(h => h && (h.includes('gut') || h.includes('गट') || h.includes('no') || h.includes('number')));
  const villageIdx = headerRow.findIndex(h => h && (h.includes('village') || h.includes('गाव') || h.includes('town')));
  const talukaIdx = headerRow.findIndex(h => h && (h.includes('taluka') || h.includes('तालुका') || h.includes('tehsil')));
  const districtIdx = headerRow.findIndex(h => h && (h.includes('district') || h.includes('जिल्हा')));
  const statusIdx = headerRow.findIndex(h => h && (h.includes('status') || h.includes('approve') || h.includes('result')));

  const hasStructuredHeaders = gutIdx !== -1 || villageIdx !== -1;
  const useAIFallback = !hasStructuredHeaders || data.length > 10;

  if (useAIFallback) {
    return processExcelWithAI(file, data);
  }

  const marathiToEnglish = (str: string) => {
    const map: { [key: string]: string } = {
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', 
      '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };
    return String(str).replace(/[०-९]/g, m => map[m]);
  };

  const gutNumber = marathiToEnglish(dataRow[gutIdx] || "अस्पष्ट");
  const villageName = dataRow[villageIdx] || dataRow[gutIdx + 1] || "अस्पष्ट";
  const talukaName = dataRow[talukaIdx] || dataRow[gutIdx + 2] || "अस्पष्ट";
  const districtName = dataRow[districtIdx] || dataRow[gutIdx + 3] || "अस्पष्ट";
  const statusVal = dataRow[statusIdx] || "अस्पष्ट";
  
  let status: 'मंजूर' | 'नामंजूर' | 'अस्पष्ट' = 'अस्पष्ट';
  const statusStr = String(statusVal).toLowerCase();
  if (statusStr.includes('मंजूर') || statusStr.includes('approve') || statusStr.includes('yes')) {
    status = 'मंजूर';
  } else if (statusStr.includes('नामंजूर') || statusStr.includes('reject') || statusStr.includes('no')) {
    status = 'नामंजूर';
  }

  return {
    id: Math.random().toString(36).substring(7),
    fileName: file.name,
    villageName: String(villageName),
    talukaName: String(talukaName),
    districtName: String(districtName),
    gutNumber: String(gutNumber),
    status,
    confidence: 100,
    reasoning: "Data extracted from Excel file with high confidence.",
    timestamp: Date.now(),
  };
}

async function processExcelWithAI(file: File, data: string[][]): Promise<LandRecord> {
  let tableText = "";
  for (const row of data) {
    tableText += row.map(cell => String(cell ?? "")).join("\n") + "\n";
  }

  const prompt = `
    You are an expert in Maharashtra Land Records (Ferfar system / Mutation Records).
    Analyze the provided Excel data below.
    
    The data is in tabular format with rows and columns. Your task is to extract:
    - Village Name (गाव)
    - Taluka Name (तालुका)
    - District Name (जिल्हा)
    - Gut Number (गट क्रमांक)
    - Status (मंजूर / नामंजूर / अस्पष्ट) - look for approval or rejection status
    
    Important: Convert Marathi digits to English digits:
    ०=0, १=1, २=2, ३=3, ४=4, ५=5, ६=6, ७=7, ८=8, ٩=9
    
    If there are multiple rows, analyze each row and provide the most relevant/complete information.
    Look for keywords like "मंजूर" (approved), "नामंजूर" (rejected), "Ferfar" (फेरफार), "Gut" (गट).
    
    Return JSON only with fields: villageName, talukaName, districtName, gutNumber, status, confidence (0-100), reasoning.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt + "\n\nExcel Data:\n" + tableText }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            villageName: { type: Type.STRING },
            talukaName: { type: Type.STRING },
            districtName: { type: Type.STRING },
            gutNumber: { type: Type.STRING },
            status: { type: Type.STRING, enum: ["मंजूर", "नामंजूर", "अस्पष्ट"] },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
          },
          required: ["villageName", "talukaName", "districtName", "gutNumber", "status", "confidence", "reasoning"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    const marathiToEnglish = (str: string) => {
      const map: { [key: string]: string } = {
        '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', 
        '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
      };
      return String(str).replace(/[०-९]/g, m => map[m]);
    };

    return {
      id: Math.random().toString(36).substring(7),
      fileName: file.name,
      villageName: result.villageName || "अस्पष्ट",
      talukaName: result.talukaName || "अस्पष्ट",
      districtName: result.districtName || "अस्पष्ट",
      gutNumber: marathiToEnglish(result.gutNumber || "अस्पष्ट"),
      status: result.status || "अस्पष्ट",
      confidence: result.confidence || 0,
      reasoning: result.reasoning || "Data analyzed using AI.",
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error processing Excel with AI:", error);
    throw new Error("Failed to analyze Excel file. Please try with a different file.");
  }
}
