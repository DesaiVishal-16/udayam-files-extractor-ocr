import React from 'react';

export const Logo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <img src="/logo.png" alt="Udayam AI Labs" className="h-8 w-auto" />
    <div>
      <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">
        Udayam <span className="text-slate-900">AI Labs</span>
      </h1>
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">
        Intelligence Redefined
      </p>
    </div>
  </div>
);

export const CreditLine = () => (
  <div className="text-sm">
    <a 
      href="https://udayam.co.in" 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-slate-700 hover:text-blue-600 hover:underline font-semibold transition-colors"
    >
      Powered by Udayam AI Labs
    </a>
  </div>
);
