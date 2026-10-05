// src/components/UserMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Settings, Shield } from 'lucide-react';

export const UserMenu: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!profile) return null;

  const initials = profile.name
    ?.split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const roleLabel: Record<string, string> = {
    admin: 'Administrator',
    management: 'Management',
    sales: 'Sales',
    production: 'Production',
    dispatch: 'Dispatch',
    quality: 'Quality',
    store_keeper: 'Store Keeper',
    operator: 'Operator',
    viewer: 'Viewer',
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-slate-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <p className="text-sm font-medium text-slate-200 truncate">{profile.name}</p>
            <p className="text-xs text-slate-500 truncate">{profile.email}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-indigo-400">
              <Shield size={10} />
              {roleLabel[profile.role] ?? profile.role}
            </div>
          </div>

          <div className="p-1">
            <button
              onClick={() => { setOpen(false); /* navigate to profile */ }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              <UserIcon size={14} /> Profile
            </button>
            <button
              onClick={() => { setOpen(false); /* navigate to settings */ }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              <Settings size={14} /> Settings
            </button>
          </div>

          <div className="p-1 border-t border-slate-800">
            <button
              onClick={async () => { setOpen(false); await signOut(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};