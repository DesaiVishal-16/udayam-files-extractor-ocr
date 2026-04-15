import { GoogleGenAI, Type } from "@google/genai";

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
