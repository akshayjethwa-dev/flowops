// src/components/SyncStatusIndicator.tsx
import React, { useEffect, useState } from 'react';
import { syncEngine, SyncState } from '../services/syncEngine';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Props {
  /** Visual variant. 'dark' matches the sidebar, 'light' matches the header. */
  variant?: 'light' | 'dark';
}

export const SyncStatusIndicator: React.FC<Props> = ({ variant = 'dark' }) => {
  const [state, setState] = useState<SyncState>(syncEngine.getState());

  useEffect(() => syncEngine.subscribe(setState), []);

  const config = () => {
    if (state.isSyncing) {
      return { icon: <RefreshCw size={12} className="animate-spin" />, label: 'Syncing…', tone: 'amber' as const };
    }
    if (!state.isOnline) {
      return {
        icon: <CloudOff size={12} />,
        label: state.pendingCount > 0 ? `Offline · ${state.pendingCount} pending` : 'Offline',
        tone: 'red' as const,
      };
    }
    if (state.pendingCount > 0) {
      return { icon: <Cloud size={12} />, label: `${state.pendingCount} pending`, tone: 'amber' as const };
    }
    return { icon: <CheckCircle2 size={12} />, label: 'Synced', tone: 'emerald' as const };
  };

  const { icon, label, tone } = config();

  // Palette per tone
  const tones = {
    amber:   { dark: 'text-amber-400  bg-slate-800/60 border-slate-700/50',  light: 'text-amber-600  bg-amber-50  border-amber-200',  dot: 'bg-amber-500' },
    red:     { dark: 'text-red-400    bg-slate-800/60 border-slate-700/50',  light: 'text-red-600    bg-red-50    border-red-200',    dot: 'bg-red-500' },
    emerald: { dark: 'text-emerald-400 bg-slate-800/60 border-slate-700/50', light: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  }[tone];

  const className =
    variant === 'light'
      ? `${tones.light} border`
      : `${tones.dark} border`;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}
      title={
        state.lastSyncedAt
          ? `Last synced: ${new Date(state.lastSyncedAt).toLocaleTimeString()}`
          : 'Not yet synced'
      }
    >
      {icon}
      <span>{label}</span>
    </div>
  );
};