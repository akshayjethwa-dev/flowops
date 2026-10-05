// src/components/quotations/QuotationVersionHistory.tsx

import React from 'react';
import { Quote } from '../../types';
import { Calendar, FileDown, Layers, ExternalLink } from 'lucide-react';

interface QuotationVersionHistoryProps {
  quote: Quote;
  onPreviewUrl: (url: string) => void;
}

export const QuotationVersionHistory: React.FC<QuotationVersionHistoryProps> = ({ quote, onPreviewUrl }) => {
  const versions = quote.pdfVersions || [];

  if (versions.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-4 text-center">
        <p className="text-xs text-slate-500 font-mono">No PDF versions generated yet for this record.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center space-x-1.5 border-b border-slate-150 pb-2">
        <Layers className="h-4 w-4 text-slate-550" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">PDF Version Registry ({versions.length})</h4>
      </div>

      <div className="divide-y divide-slate-150 border border-slate-200 rounded-lg bg-white overflow-hidden shadow-3xs max-h-48 overflow-y-auto">
        {versions.map((ver, idx) => {
          const isLatest = ver.version === quote.pdfVersion;
          return (
            <div 
              key={ver.version} 
              className={`p-3 flex items-center justify-between text-xs transition-colors hover:bg-slate-50 ${
                isLatest ? 'bg-amber-50/15' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                    isLatest 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-slate-100 text-slate-650'
                  }`}>
                    v{ver.version} {isLatest ? '• Latest' : ''}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {new Date(ver.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-slate-450 text-[10px]">
                  <Calendar className="h-3 w-3" />
                  <span>Created: {new Date(ver.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => onPreviewUrl(ver.downloadUrl)}
                  className="bg-white border border-slate-205 text-slate-700 font-bold px-2 py-1 rounded text-[10px] hover:bg-slate-50 transition-colors flex items-center space-x-1 cursor-pointer font-mono"
                >
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                  <span>Preview</span>
                </button>

                <a
                  href={ver.downloadUrl}
                  target="_blank"
                  rel="noreferrer referrer"
                  download={`Quote-${quote.quoteNumber}-v${ver.version}.pdf`}
                  className="bg-slate-900 border border-transparent text-white font-bold px-2 py-1 rounded text-[10px] hover:bg-slate-800 transition-colors flex items-center space-x-1 cursor-pointer font-mono"
                >
                  <FileDown className="h-3 w-3 text-sky-200" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
