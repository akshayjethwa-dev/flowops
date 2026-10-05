// src/components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ClipboardList, Package, Factory,
  ShieldCheck, Truck, BarChart3, Zap, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, roles: ['*'] },
  { to: '/rfqs',        label: 'RFQs',        icon: FileText,        roles: ['admin', 'management', 'sales'] },
  { to: '/orders',      label: 'Sales Orders',icon: ClipboardList,   roles: ['admin', 'management', 'sales', 'production'] },
  { to: '/work-orders', label: 'Work Orders', icon: Zap,             roles: ['admin', 'management', 'production'] },
  { to: '/inventory',   label: 'Inventory',   icon: Package,         roles: ['admin', 'management', 'production', 'store_keeper'] },
  { to: '/procurement', label: 'Procurement', icon: Factory,         roles: ['admin', 'management', 'store_keeper'] },
  { to: '/quality',     label: 'Quality',     icon: ShieldCheck,     roles: ['admin', 'management', 'quality'] },
  { to: '/dispatch',    label: 'Dispatch',    icon: Truck,           roles: ['admin', 'management', 'dispatch'] },
  { to: '/analytics',   label: 'Analytics',   icon: BarChart3,       roles: ['admin', 'management'] },
];

export const Sidebar: React.FC = () => {
  const { profile } = useAuth();
  const role = profile?.role ?? 'viewer';

  const visible = NAV_ITEMS.filter(
    item => item.roles.includes('*') || item.roles.includes(role)
  );

  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900/70 border-r border-slate-800 flex flex-col">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-slate-800">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Factory size={16} className="text-white" />
        </div>
        <span className="font-semibold text-slate-100 tracking-tight">FlowOps</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
              }`
            }
          >
            <Icon size={16} />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 text-center">v0.1.0 · Epic 1</p>
      </div>
    </aside>
  );
};