// src/components/Layout.tsx

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Factory, 
  User, 
  UserCheck, 
  LogOut, 
  ChevronDown, 
  TrendingUp, 
  FileEdit, 
  Layers, 
  Truck, 
  MessageSquare, 
  SlidersHorizontal,
  FolderSync
} from 'lucide-react';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeSection: string;
  setActiveSection: (sec: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeSection, setActiveSection }) => {
  const { profile, tenant, signOut, switchToSandboxRole, isSandboxMode } = useAuth();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const menuItems = [
    { id: 'management', label: 'Management Dashboard', icon: TrendingUp, roles: ['admin', 'management'] },
    { id: 'rfqs', label: 'RFQs & Inquiries', icon: FolderSync, roles: ['admin', 'sales', 'management'] },
    { id: 'quotes', label: 'Quotations', icon: FileEdit, roles: ['admin', 'sales', 'management'] },
    { id: 'production', label: 'Production Line', icon: Layers, roles: ['admin', 'production', 'management'] },
    { id: 'dispatch', label: 'Logistics & Dispatch', icon: Truck, roles: ['admin', 'dispatch', 'management'] },
    { id: 'whatsapp', label: 'WhatsApp Outbox', icon: MessageSquare, roles: ['admin', 'sales', 'management', 'production', 'dispatch'] }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!profile) return false;
    return item.roles.includes(profile.role);
  });

  const getRoleLabel = (role: UserRole) => {
    switch(role) {
      case 'admin': return 'Owner / Administrator';
      case 'sales': return 'Sales Engineer';
      case 'production': return 'Shopfloor Supervisor';
      case 'dispatch': return 'Dispatch & Logistics';
      case 'management': return 'Plant General Manager';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center font-bold text-white font-display">AF</div>
            <div>
              <h2 className="text-white font-bold text-base tracking-tight uppercase font-display leading-tight">Ashrey FlowOps</h2>
              <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase block mt-0.5">SME Operations CRM</span>
            </div>
          </div>
          {isSandboxMode && (
            <span className="bg-sky-500/15 text-sky-450 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-sky-500/30">
              DEMO
            </span>
          )}
        </div>

        {/* Tenant/Factory Entity Name details */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/30">
          <p className="text-[9px] uppercase font-mono tracking-widest text-slate-500">Active Foundry</p>
          <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">{tenant?.companyName || 'Loading Tenant...'}</p>
          {tenant?.gstin && (
            <p className="text-[9px] font-mono text-slate-400 mt-0.5">GST: {tenant.gstin}</p>
          )}
        </div>

        {/* NAVIGATION MENUS */}
        <nav className="flex-grow p-4 space-y-1">
          {filteredMenuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                  isActive 
                    ? 'bg-sky-500/10 text-sky-400 font-semibold' 
                    : 'text-slate-400 hover:text-white font-medium'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* FOOTER USER MANAGEMENT WITH INTUATIVE ROLE-SWITCHER */}
        <div className="p-4 border-t border-slate-800 mt-auto bg-slate-950/20">
          
          {/* Active User Section */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-8 w-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 text-xs font-bold text-white font-display">
              {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'OP'}
            </div>
            <div className="min-w-0 flex-grow">
              <p className="text-xs font-semibold text-white truncate">{profile?.name || 'Operator'}</p>
              <p className="text-[10px] text-slate-500 truncate">{getRoleLabel(profile?.role || 'sales')}</p>
            </div>
          </div>

          {/* Role Switching Utility Playground (Demo Review Tool) */}
          <div className="relative mb-3">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="w-full bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-slate-350 text-[10px] px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors focus:outline-none cursor-pointer"
            >
              <span className="flex items-center space-x-1.5">
                <SlidersHorizontal className="h-3 w-3 text-sky-400 shrink-0" />
                <span className="font-mono">Switch Role Panel</span>
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                <p className="px-2.5 py-1.5 text-[9px] font-mono tracking-wider text-slate-500 border-b border-slate-700 uppercase bg-slate-850">
                  Select Actor Persona
                </p>
                {(['admin', 'sales', 'production', 'dispatch', 'management'] as UserRole[]).map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      switchToSandboxRole(r);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 text-left text-[11px] hover:bg-slate-700/80 cursor-pointer ${
                      profile?.role === r ? 'text-sky-400 font-semibold bg-slate-750/50' : 'text-slate-300'
                    }`}
                  >
                    <span>{getRoleLabel(r)}</span>
                    {profile?.role === r && <UserCheck className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Secure Sign out */}
          <button
            onClick={signOut}
            className="w-full bg-transparent hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/20 text-[10px] py-1.5 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors"
          >
            <LogOut className="h-3 w-3" />
            <span>Sign Out Session</span>
          </button>
        </div>

      </aside>

      {/* VIEWPORT CONTROLLER */}
      <main className="flex-grow flex flex-col overflow-y-auto max-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight font-display">
              {filteredMenuItems.find(item => item.id === activeSection) ? (
                menuItems.find(item => item.id === activeSection)?.label
              ) : (
                'Workspace Access Restricted'
              )}
            </h1>
          </div>
          {/* Active status indicator */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider">AiSensy WhatsApp Live</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 md:p-8 flex-grow">
          {filteredMenuItems.find(item => item.id === activeSection) ? (
            children
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 max-w-xl mx-auto mt-12 text-center text-slate-700">
              <SlidersHorizontal className="h-8 w-8 text-sky-500 mx-auto mb-4" />
              <h3 className="text-base font-bold text-slate-900 mb-1">Access Restricted for User Actor</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Your currently active role ({profile?.role}) does not have permission to view this operational area. Use the <strong>Switch Role Panel</strong> in the bottom left sidebar to swap to a valid role permissions set!
              </p>
            </div>
          )}
        </div>

        {/* Integration Status Bar (Footer) */}
        <footer className="mt-4 mx-8 mb-6 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0 border-t border-slate-200 pt-4 font-sans">
          <div className="flex space-x-6">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-[10px] uppercase font-bold text-slate-650 tracking-tight">Firebase Store: Online</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-[10px] uppercase font-bold text-slate-650 tracking-tight">AiSensy Webhook: Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Tally Connector: Idle</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 italic">
            * Ashrey FlowOps: Specialized Industrial Workflow Layer
          </div>
        </footer>
      </main>

    </div>
  );
};
