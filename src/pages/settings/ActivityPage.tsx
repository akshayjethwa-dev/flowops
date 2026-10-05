// src/pages/settings/ActivityPage.tsx

import React, { useState } from 'react';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { LoginAuditSection } from '../../components/LoginAuditSection';
import { ShieldCheck, CalendarRange, Lock, KeyRound, Activity } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const ActivityPage: React.FC = () => {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'login_audit' | 'shift_ledger'>('login_audit');

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Governance & Security Audit
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block">
            Factory System Logs & Login Audit
          </h2>
          <p className="text-xs text-slate-500">
            Realtime tamper-proof trace history reporting operator authentication, custom claims, quote iterations, shopfloor advancements, and WhatsApp communications.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-lg text-xs font-semibold self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('login_audit')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'login_audit' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5 text-sky-600" />
            <span>Login Audit Log</span>
          </button>
          <button
            onClick={() => setActiveTab('shift_ledger')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'shift_ledger' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span>Shift Operations Ledger</span>
          </button>
        </div>
      </div>

      {activeTab === 'login_audit' ? (
        <LoginAuditSection />
      ) : (
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
      )}
    </div>
  );
};
