// src/components/DashboardKpiCard.tsx

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface DashboardKpiCardProps {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  colorScheme: 'sky' | 'indigo' | 'amber' | 'rose' | 'emerald';
  onClick: () => void;
}

export const DashboardKpiCard: React.FC<DashboardKpiCardProps> = ({
  id,
  title,
  value,
  description,
  icon: Icon,
  colorScheme,
  onClick
}) => {
  // Setup theme-specific styling
  const schemes = {
    sky: {
      border: 'hover:border-sky-300',
      bgLight: 'bg-sky-50 text-sky-650',
      pill: 'bg-sky-500/10 text-sky-700',
      shadow: 'hover:shadow-sky-500/5'
    },
    indigo: {
      border: 'hover:border-indigo-300',
      bgLight: 'bg-indigo-50 text-indigo-650',
      pill: 'bg-indigo-500/10 text-indigo-700',
      shadow: 'hover:shadow-indigo-500/5'
    },
    amber: {
      border: 'hover:border-amber-300',
      bgLight: 'bg-amber-50 text-amber-650',
      pill: 'bg-amber-500/10 text-amber-700',
      shadow: 'hover:shadow-amber-500/5'
    },
    rose: {
      border: 'hover:border-rose-300',
      bgLight: 'bg-rose-50 text-rose-650',
      pill: 'bg-rose-500/10 text-rose-700',
      shadow: 'hover:shadow-rose-500/5'
    },
    emerald: {
      border: 'hover:border-emerald-300',
      bgLight: 'bg-emerald-50 text-emerald-650',
      pill: 'bg-emerald-500/10 text-emerald-700',
      shadow: 'hover:shadow-emerald-500/5'
    }
  };

  const activeScheme = schemes[colorScheme];

  return (
    <button
      id={`kpi-card-${id}`}
      onClick={onClick}
      className={`w-full bg-white border border-slate-200 rounded-xl p-5 text-left flex items-start justify-between transition-all duration-300 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${activeScheme.border} ${activeScheme.shadow} group`}
    >
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-405 uppercase tracking-widest block font-sans">
          {title}
        </span>
        <span className="text-3xl font-black text-slate-900 block leading-none font-mono">
          {value}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 mt-1 rounded-md inline-block font-sans ${activeScheme.pill}`}>
          {description}
        </span>
      </div>
      <div className={`p-3 rounded-lg transition-colors duration-300 shrink-0 ${activeScheme.bgLight} group-hover:scale-110 transform`}>
        <Icon className="h-5 w-5" />
      </div>
    </button>
  );
};
