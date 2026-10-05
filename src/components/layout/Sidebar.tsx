// src/components/layout/Sidebar.tsx

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWhatsAppConversations } from '../../hooks/useWhatsAppConversations';
import { useStockItems } from '../../hooks/useStockInventory';
import { 
  TrendingUp, 
  Layers, 
  Truck, 
  MessageSquare,
  SlidersHorizontal,
  FolderSync,
  Users,
  Settings,
  ChevronDown,
  UserCheck,
  Building,
  Activity,
  UserPlus,
  ShieldAlert,
  X,
  Package,
  Receipt,
  BarChart2
} from 'lucide-react';
import { UserRole } from '../../types';

interface SidebarItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { profile, tenant, isSandboxMode, switchToSandboxRole, updateProfileLocally } = useAuth();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const { conversations } = useWhatsAppConversations(tenant?.id);
  const whatsappUnreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const { items: allStockItems } = useStockItems(tenant?.id);
  const lowStockCount = allStockItems.filter(item => item.currentQty <= item.reorderLevel).length;

  const navigationItems: SidebarItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: TrendingUp, roles: ['admin', 'management'] },
    { to: '/whatsapp-inbox', label: 'WhatsApp Inbox', icon: MessageSquare, roles: ['admin', 'sales', 'management'] },
    { to: '/rfqs', label: 'RFQs & Costing', icon: FolderSync, roles: ['admin', 'sales', 'management'] },
    { to: '/orders', label: 'Production Line', icon: Layers, roles: ['admin', 'production', 'management'] },
    { to: '/inventory', label: 'Inventory', icon: Package, roles: ['admin', 'production', 'management', 'sales', 'dispatch'] },
    { to: '/dispatch', label: 'Logistics Desk', icon: Truck, roles: ['admin', 'dispatch', 'management'] },
    { to: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'sales', 'management'] },
    { to: '/payments', label: 'Outstanding & Payments', icon: Receipt, roles: ['admin', 'sales', 'management'] },
    { to: '/reports', label: 'Reports', icon: BarChart2, roles: ['admin', 'management', 'sales', 'production', 'dispatch'] },
  ];

  const settingItems: SidebarItem[] = [
    { to: '/settings/tenant', label: 'Plant Profile', icon: Building, roles: ['admin'] },
    { to: '/settings/production-stages', label: 'Process Stages', icon: Settings, roles: ['admin'] },
    { to: '/settings/whatsapp', label: 'WhatsApp Outbox', icon: MessageSquare, roles: ['admin', 'sales'] },
    { to: '/settings/users', label: 'Staff Roster', icon: UserPlus, roles: ['admin'] },
    { to: '/activity', label: 'Factory Logs', icon: Activity, roles: ['admin', 'management'] }
  ];

  // Only show links that align with the user's active permissions role
  const checkRoleAccess = (roles: string[]) => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const visibleNavs = navigationItems.filter(item => checkRoleAccess(item.roles));
  const visibleSettings = settingItems.filter(item => checkRoleAccess(item.roles));

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
    <>
      {/* Backdrop overlay on mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 select-none z-50
        transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:transform-none
        ${isOpen ? 'translate-x-0 animate-fade-in' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header with Close option for mobile viewers */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-sky-600 rounded flex items-center justify-center font-bold text-white font-display text-sm tracking-widest shadow-xs">
              AF
            </div>
            <div>
              <h2 className="text-white font-bold text-sm tracking-tight uppercase leading-tight font-display">Ashrey FlowOps</h2>
              <span className="text-[9px] text-slate-500 font-mono tracking-wider block mt-0.5 uppercase">Shopfloor CRM</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isSandboxMode && (
              <span className="bg-sky-500/10 text-sky-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-sky-500/20 animate-pulse">
                DEMO
              </span>
            )}
            <button 
              onClick={onClose}
              type="button"
              className="md:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors shrink-0"
              title="Close Drawer Option"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Active Foundry info panel */}
        <div className="px-6 py-3 border-b border-slate-850 bg-slate-950/40">
          <p className="text-[9px] uppercase font-mono tracking-wider text-slate-500">Active Plant</p>
          <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">
            {tenant?.companyName || 'SME Forge'}
          </p>
          {tenant?.gstin && (
            <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate">GSTIN: {tenant.gstin}</p>
          )}
        </div>

        {/* Navigation Groups inside scroll viewport */}
        <div className="flex-grow p-4 overflow-y-auto space-y-6">
          <div>
            <h3 className="px-3 mb-2 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
              Production & Pipeline
            </h3>
            <nav className="space-y-1">
              {visibleNavs.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) => `
                      w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-mono uppercase tracking-wide transition-all
                      ${isActive 
                        ? 'bg-sky-500/10 text-sky-400 font-bold border-l-2 border-sky-500 pl-2.5' 
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-grow">{item.label}</span>
                    {item.to === '/whatsapp-inbox' && whatsappUnreadCount > 0 && (
                      <span className="bg-emerald-500 text-slate-950 font-bold text-[10px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center font-mono">
                        {whatsappUnreadCount}
                      </span>
                    )}
                    {item.to === '/inventory' && lowStockCount > 0 && (
                      <span className="bg-rose-500 text-white font-bold text-[10px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center font-mono animate-pulse">
                        {lowStockCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {visibleSettings.length > 0 && (
            <div>
              <h3 className="px-3 mb-2 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                Settings & Admin
              </h3>
              <nav className="space-y-1">
                {visibleSettings.map(item => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) => `
                        w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-mono uppercase tracking-wide transition-all
                        ${isActive 
                          ? 'bg-sky-500/10 text-sky-400 font-bold border-l-2 border-sky-500 pl-2.5' 
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}

          {profile?.isSuperAdmin && (
            <div>
              <h3 className="px-3 mb-2 text-[9px] font-mono font-bold text-rose-500 uppercase tracking-widest">
                Ashrey Systems Dev
              </h3>
              <nav className="space-y-1">
                <NavLink
                  to="/internal/tenants"
                  onClick={onClose}
                  className={({ isActive }) => `
                    w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-mono uppercase tracking-wide transition-all
                    ${isActive 
                      ? 'bg-rose-500/10 text-rose-400 font-bold border-l-2 border-rose-500 pl-2.5' 
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                    }
                  `}
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>Super Admin Desk</span>
                </NavLink>
              </nav>
            </div>
          )}
        </div>

      {/* Footer Actor Panel with Role-Switcher */}
      <div className="p-4 border-t border-slate-800 mt-auto bg-slate-950/20">
        <div className="flex items-center space-x-3 mb-3">
          <div className="h-8 w-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 text-xs font-bold text-white font-display">
            {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'OP'}
          </div>
          <div className="min-w-0 flex-grow">
            <p className="text-xs font-semibold text-white truncate">{profile?.name || 'Operator'}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{getRoleLabel(profile?.role || 'admin')}</p>
          </div>
        </div>

        {/* Dynamic Role Swapping tool panel for system auditors */}
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className="w-full bg-slate-800/80 hover:bg-slate-750 border border-slate-705 text-slate-400 text-[10px] px-2.5 py-1.5 rounded flex items-center justify-between transition-colors focus:outline-hidden cursor-pointer"
          >
            <span className="flex items-center space-x-1.5 font-mono uppercase tracking-wider">
              <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>Switch Role Profile</span>
            </span>
            <ChevronDown className={`h-3 w-3 text-slate-500 shrink-0 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {roleDropdownOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-slate-800 border border-slate-700 rounded shadow-xl overflow-hidden z-50">
              <p className="px-2.5 py-1.5 text-[9px] font-mono tracking-wider text-slate-500 border-b border-slate-705 uppercase bg-slate-850">
                Assume Role Persona
              </p>
              {(['admin', 'sales', 'production', 'dispatch', 'management'] as UserRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => {
                    switchToSandboxRole(r);
                    setRoleDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-left text-[11px] hover:bg-slate-700/80 cursor-pointer ${
                    profile?.role === r ? 'text-sky-400 font-semibold bg-slate-750/35' : 'text-slate-300'
                  }`}
                >
                  <span>{getRoleLabel(r)}</span>
                  {profile?.role === r && <UserCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Super Admin for testing */}
        <button
          onClick={() => {
            updateProfileLocally({ isSuperAdmin: !profile?.isSuperAdmin });
          }}
          className={`w-full mt-2 border px-2.5 py-1.5 rounded flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
            profile?.isSuperAdmin 
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/35 hover:bg-rose-500/25' 
              : 'bg-slate-800/80 hover:bg-slate-750 border-slate-705 text-slate-400'
          }`}
        >
          <span>Super-Admin Mode</span>
          <span className={profile?.isSuperAdmin ? 'text-rose-400 font-bold' : 'text-slate-450'}>
            {profile?.isSuperAdmin ? 'ON 🛡️' : 'OFF'}
          </span>
        </button>
      </div>
    </aside>
    </>
  );
};
