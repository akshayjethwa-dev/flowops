// src/components/ExportButton.tsx

import React, { useState } from 'react';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';
import { convertToCsv, downloadCsvFile } from '../utils/csvExport';

interface ExportButtonProps<T> {
  data: T[] | (() => T[] | Promise<T[]>);
  filenamePrefix?: string;
  headersMap?: Record<string, string>;
  label?: string;
}

export const ExportButton = <T extends Record<string, any>>({
  data,
  filenamePrefix = 'export',
  headersMap,
  label = 'Export CSV'
}: ExportButtonProps<T>) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExporting(true);
    
    // Simulate a brief generation delay for good UI feel
    await new Promise(resolve => setTimeout(resolve, 600));

    try {
      let exportData: T[];
      if (typeof data === 'function') {
        const resolved = data();
        exportData = resolved instanceof Promise ? await resolved : resolved;
      } else {
        exportData = data;
      }

      if (exportData.length === 0) {
        alert('There is no data matching the current filter state to export.');
        setIsExporting(false);
        return;
      }

      // Generate localized date-stamped filename
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `${filenamePrefix}_${dateStr}_${timeStr}.csv`;

      // Build CSV output
      const csvStr = convertToCsv(exportData, headersMap);
      const success = downloadCsvFile(csvStr, filename);

      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to compile export sequence:', err);
      alert('An error occurred during CSV generation.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`px-3 py-2.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-3xs cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed`}
      title="Export currently filtered or listed data into custom CSV"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 shrink-0" />
          <span className="text-[10px]">Generating...</span>
        </>
      ) : showSuccess ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 animate-bounce" />
          <span className="text-[10px] text-emerald-600">Exported!</span>
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
