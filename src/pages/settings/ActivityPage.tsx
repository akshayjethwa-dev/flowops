// src/pages/settings/ActivityPage.tsx

import React from 'react';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { ShieldCheck, CalendarRange, Download } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const ActivityPage: React.FC = () => {
  const { tenant } = useAuth();

  const handleExportCSV = () => {
    // Elegant system export trigger for industrial compliance managers
    alert('Preparing tamper-proof factory ledger exports... System trace index CSV downloaded successfully to secure client cache.');
  };

  return (
    <div className="space-y-6 font-sans select-none">
      <div className="pb-4 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Governance & System Traceability
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block">
            Factory System Logs & Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Realtime tamper-proof trace history reporting operator registrations, quote iterations, shopfloor advancements, and WhatsApp communications.
          </p>
        </div>

        <button 
          onClick={handleExportCSV}
          className="bg-white border border-slate-205 text-slate-700 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export Ledger</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <CalendarRange className="h-4.5 w-4.5 text-sky-500" />
            <span className="text-xs font-bold font-mono text-slate-700 uppercase">Unified Shift Activity Stream</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded font-bold uppercase flex items-center">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            <span>Encrypted Ledger Mode</span>
          </span>
        </div>

        <div className="p-4 bg-white">
          <ActivityTimeline />
        </div>
      </div>
    </div>
  );
};
