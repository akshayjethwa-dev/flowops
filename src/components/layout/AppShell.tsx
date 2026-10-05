// src/components/layout/AppShell.tsx

import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../../hooks/useAuth';
import { useTenantConfig } from '../../hooks/useTenantConfig';

export const AppShell: React.FC = () => {
  const { profile, tenant } = useAuth();
  const { tenantConfig, loading } = useTenantConfig(tenant?.id);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full" />
        <p className="mt-4 text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse">
          Applying configurations...
        </p>
      </div>
    );
  }

  // Redirect Admins with incomplete onboarding to wizard unless they skipped for current session
  if (profile?.role === 'admin' && tenantConfig && !tenantConfig.onboardingCompleted) {
    if (sessionStorage.getItem('onboarding_skipped') !== 'true') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Workspace Frame */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Top Header details */}
        <Topbar onMenuToggle={() => setSidebarOpen(true)} />

        {/* Scrolling Inner content viewport */}
        <div className="flex-grow overflow-y-auto flex flex-col">
          <main className="p-4 sm:p-6 md:p-8 flex-grow">
            <Outlet />
          </main>

          {/* Connected factory status line */}
          <footer className="mt-auto mx-8 mb-6 border-t border-slate-200/80 pt-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-2 shrink-0">
            <div className="flex space-x-5">
              <span className="flex items-center space-x-1.5 font-semibold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0 animate-pulse"></span>
                <span>Google Cloud Firestore Live</span>
              </span>
              <span className="flex items-center space-x-1.5 font-semibold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span>
                <span>AiSensy BSP Online</span>
              </span>
              <span className="hidden md:flex items-center space-x-1.5 text-slate-350">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full shrink-0"></span>
                <span>Tally Link: Standby</span>
              </span>
            </div>
            <div className="font-mono text-right text-[9px] uppercase tracking-wider">
              * Ashrey FlowOps SME Forge Core Console
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
