// src/components/layout/Topbar.tsx

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ChevronDown, LogOut, CheckCircle, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '../NotificationBell';

export interface TopbarProps {
  onMenuToggle?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuToggle }) => {
  const { profile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Failed to log out: ', err);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-205 flex items-center justify-between px-4 md:px-8 shrink-0 relative select-none">
      {/* Dynamic Status Connection Badges & Hamburger */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shrink-0 mr-1"
          id="mobile-navigation-toggle-btn"
          title="Toggle Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-2 text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase font-bold">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
          <span className="hidden xs:inline">AiSensy Live Connected</span>
          <span className="xs:hidden">Live</span>
        </div>
        <div className="hidden sm:flex items-center space-x-1 text-slate-500 text-[10px] uppercase font-mono">
          <CheckCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>DB Isolation Guard Active</span>
        </div>
      </div>

      {/* Operator profile card triggers dropdown */}
      <div className="flex items-center space-x-4">
        <NotificationBell />
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2.5 cursor-pointer focus:outline-hidden text-left"
          id="operator-profile-btn"
        >
          <div className="h-8 w-8 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 font-display shrink-0">
            {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'OP'}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-none">
              {profile?.name || 'Operator Profile'}
            </p>
            <p className="text-[9px] text-slate-450 uppercase font-mono mt-1 tracking-wider leading-none">
              {profile?.role || 'operator'}
            </p>
          </div>
          <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Options */}
        {dropdownOpen && (
          <div className="absolute right-8 top-13.5 w-48 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 animate-fade-in">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-800 truncate">{profile?.name || 'Authorized Staff'}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{profile?.email || 'email@tenant.com'}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50/50 flex items-center space-x-2 font-semibold cursor-pointer transition-colors"
            >
              <LogOut className="h-4 w-4 text-red-500 shrink-0" />
              <span>Sign Out Session</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
