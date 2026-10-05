// src/utils/permissions.ts

import { UserRole, UserProfile, TenantUser } from '../types';

export type PermissionAction =
  | 'view:dashboard'
  | 'view:rfq'
  | 'manage:rfq'
  | 'view:quotation'
  | 'manage:quotation'
  | 'edit:pricing'
  | 'view:order'
  | 'manage:order'
  | 'manage:production'
  | 'view:dispatch'
  | 'manage:dispatch'
  | 'view:customers'
  | 'manage:customers'
  | 'view:inventory'
  | 'manage:inventory'
  | 'view:reports'
  | 'manage:settings'
  | 'manage:users'
  | 'view:audit_logs';

// 🔒 Central RBAC Policy Map
export const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  admin: [
    'view:dashboard', 'view:rfq', 'manage:rfq', 'view:quotation', 'manage:quotation', 'edit:pricing',
    'view:order', 'manage:order', 'manage:production', 'view:dispatch', 'manage:dispatch',
    'view:customers', 'manage:customers', 'view:inventory', 'manage:inventory', 'view:reports', 
    'manage:settings', 'manage:users', 'view:audit_logs'
  ],
  manager: [
    'view:dashboard', 'view:rfq', 'manage:rfq', 'view:quotation', 'manage:quotation', 'edit:pricing',
    'view:order', 'manage:order', 'manage:production', 'view:dispatch', 'manage:dispatch',
    'view:customers', 'manage:customers', 'view:inventory', 'manage:inventory', 'view:reports',
    'manage:users', 'view:audit_logs'
  ],
  operator: [
    'view:order', 'manage:production', 'view:inventory'
  ],
  quality_inspector: [
    'view:order', 'manage:production', 'view:inventory', 'view:reports'
  ],
  store_keeper: [
    'view:order', 'view:dispatch', 'view:inventory', 'manage:inventory'
  ],
  viewer: [
    'view:dashboard', 'view:rfq', 'view:quotation', 'view:order', 'view:dispatch', 
    'view:customers', 'view:inventory', 'view:reports'
  ],
  sales: [
    'view:dashboard', 'view:rfq', 'manage:rfq', 'view:quotation', 'manage:quotation', 'edit:pricing',
    'view:customers', 'manage:customers', 'view:inventory', 'view:reports'
  ],
  production: [
    'view:dashboard', 'view:order', 'manage:order', 'manage:production', 'view:inventory', 'manage:inventory', 'view:reports'
  ],
  dispatch: [
    'view:dashboard', 'view:order', 'view:dispatch', 'manage:dispatch', 'view:inventory', 'manage:inventory', 'view:reports'
  ],
  management: [
    'view:dashboard', 'view:rfq', 'view:quotation', 'view:order', 'view:dispatch', 
    'view:customers', 'view:inventory', 'view:reports', 'view:audit_logs'
  ]
};

export const getRoleTitle = (r: UserRole): string => {
  switch (r) {
    case 'admin': return 'Admin (Business Owner)';
    case 'manager': return 'Operations Manager';
    case 'operator': return 'Shopfloor Machine Operator';
    case 'quality_inspector': return 'Quality Inspector';
    case 'store_keeper': return 'Store Keeper & Inventory';
    case 'viewer': return 'Auditor & Viewer';
    case 'sales': return 'Sales Engineer';
    case 'production': return 'Production Supervisor';
    case 'dispatch': return 'Dispatch & Logistics Clerk';
    case 'management': return 'General Management';
    default: return r;
  }
};

export const getRoleBadgeColor = (r: UserRole): string => {
  switch (r) {
    case 'admin': return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'manager': return 'bg-purple-100 text-purple-900 border-purple-300';
    case 'operator': return 'bg-blue-100 text-blue-900 border-blue-300';
    case 'quality_inspector': return 'bg-rose-100 text-rose-900 border-rose-300';
    case 'store_keeper': return 'bg-teal-100 text-teal-900 border-teal-300';
    case 'viewer': return 'bg-slate-100 text-slate-800 border-slate-300';
    case 'sales': return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'production': return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    case 'dispatch': return 'bg-sky-100 text-sky-900 border-sky-300';
    case 'management': return 'bg-violet-100 text-violet-900 border-violet-300';
    default: return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

export const getRoleCapabilities = (r: UserRole): { title: string; capabilities: string[] } => {
  switch (r) {
    case 'admin':
      return {
        title: 'Admin (Business Owner)',
        capabilities: [
          'Full workspace configuration and tenant parameters',
          'Create user accounts, set custom claims & edit roles',
          'Manage all stages, plants, WhatsApp configs & pricing',
          'Access complete login audit logs and operational history'
        ]
      };
    case 'manager':
      return {
        title: 'Operations Manager',
        capabilities: [
          'Full pipeline management: RFQs, Production, Logistics',
          'Review team performance, approve quotations & assign jobs',
          'User roster view and staff assignments',
          'View security & login audit logs for shifts'
        ]
      };
    case 'operator':
      return {
        title: 'Shopfloor Machine Operator',
        capabilities: [
          'View assigned production jobs and work orders',
          'Advance manufacturing stages & check off progress',
          'Add real-time shopfloor notes and machine logs',
          'View inventory stock availability for active jobs'
        ]
      };
    case 'quality_inspector':
      return {
        title: 'Quality Inspector',
        capabilities: [
          'Inspect manufactured parts & approve QC stage gates',
          'Record NDT / Dimensional inspection reports and tolerances',
          'Log rejection remarks, rework notices, and certificates',
          'View production reports and quality analytics'
        ]
      };
    case 'store_keeper':
      return {
        title: 'Store Keeper & Inventory',
        capabilities: [
          'Manage raw materials, tooling, and finished goods stock',
          'Adjust stock levels, record inward receipts & outward issues',
          'Monitor low stock alerts and minimum reorder levels',
          'Coordinate lorry loading with Dispatch & Challan desk'
        ]
      };
    case 'viewer':
      return {
        title: 'Auditor & Viewer',
        capabilities: [
          'Read-only access across production, dispatch & inventory',
          'Inspect reports, customer directories & job timelines',
          'No creation, modification, or deletion permissions',
          'Clean, non-intrusive monitoring interface'
        ]
      };
    case 'sales':
      return {
        title: 'Sales Engineer',
        capabilities: [
          'Capture RFQs & formulate quotation pricing',
          'Customer CRM management & commercial approvals',
          'Track production & dispatch statuses for clients',
          'Trigger WhatsApp quotation updates'
        ]
      };
    case 'production':
      return {
        title: 'Production Supervisor',
        capabilities: [
          'Manage full shopfloor Kanban production line',
          'Advance jobs across machining, welding, assembly',
          'Supervise machine operators & allocate jobs',
          'Monitor inventory consumption on the floor'
        ]
      };
    case 'dispatch':
      return {
        title: 'Dispatch & Logistics Clerk',
        capabilities: [
          'Generate delivery challans & lorry dispatch manifests',
          'Track transporters, vehicle numbers & LR numbers',
          'Confirm customer delivery handovers',
          'Send automated WhatsApp dispatch notifications'
        ]
      };
    case 'management':
      return {
        title: 'General Management',
        capabilities: [
          'Executive dashboard with revenue & plant KPIs',
          'Read-only oversight across all pipeline modules',
          'Access shift reports and compliance audits'
        ]
      };
    default:
      return {
        title: r,
        capabilities: ['Standard workspace member permissions']
      };
  }
};

export const isSuperAdmin = (
  user: UserProfile | TenantUser | null | undefined
): boolean => {
  if (!user) return false;
  return !!(user as any).isSuperAdmin;
};

export const hasRole = (
  user: UserProfile | TenantUser | null | undefined,
  role: string | UserRole
): boolean => {
  if (!user) return false;
  return user.role.toLowerCase() === role.toLowerCase();
};

/**
 * Checks if a user has permission to perform a specific action based on the RBAC map.
 */
export const canPerformAction = (
  user: UserProfile | TenantUser | null | undefined,
  action: PermissionAction
): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true; // Super-admins bypass tenancy RBAC

  const role = user.role.toLowerCase() as UserRole;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(action);
};

/**
 * Legacy wrapper mapping modules to the new RBAC system for backwards compatibility in nav.
 */
export const canViewModule = (
  user: UserProfile | TenantUser | null | undefined,
  module: string
): boolean => {
  if (!user) return false;
  const normalizedModule = module.toUpperCase();

  switch (normalizedModule) {
    case 'DASHBOARD': return canPerformAction(user, 'view:dashboard');
    case 'RFQ':
    case 'QUOTATION':
    case 'QUOTATIONS': return canPerformAction(user, 'view:rfq');
    case 'PRODUCTION':
    case 'ORDER':
    case 'ORDERS':
    case 'JOB': return canPerformAction(user, 'view:order');
    case 'DISPATCH':
    case 'LOGISTICS': return canPerformAction(user, 'view:dispatch');
    case 'CUSTOMERS':
    case 'CUSTOMER': return canPerformAction(user, 'view:customers');
    case 'INVENTORY':
    case 'STOCK': return canPerformAction(user, 'view:inventory');
    case 'REPORTS': return canPerformAction(user, 'view:reports');
    case 'SETTINGS':
    case 'TENANT':
    case 'PRODUCTION_STAGES':
    case 'WHATSAPP': return canPerformAction(user, 'manage:settings');
    case 'USERS':
    case 'USER':
    case 'ROSTER': return canPerformAction(user, 'manage:users');
    case 'AUDIT':
    case 'AUDIT_LOGS': return canPerformAction(user, 'view:audit_logs');
    default: return false;
  }
};