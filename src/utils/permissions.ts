// src/utils/permissions.ts

import { UserRole, UserProfile, TenantUser } from '../types';

/**
 * Checks if the user is a super-admin of Ashrey Systems.
 */
export const isSuperAdmin = (
  user: UserProfile | TenantUser | null | undefined
): boolean => {
  if (!user) return false;
  return !!(user as any).isSuperAdmin;
};

/**
 * Checks if the user or slot user profile has the given role.
 * Case-insensitive helper.
 */
export const hasRole = (
  user: UserProfile | TenantUser | null | undefined,
  role: string | UserRole
): boolean => {
  if (!user) return false;
  return user.role.toLowerCase() === role.toLowerCase();
};

/**
 * Determines if a user role can read or view a specific module based on policies:
 * - Admin: full tenant settings + user management (everything).
 * - Sales: RFQs, customers, quotations.
 * - Production: orders / production board, job detail.
 * - Dispatch: dispatch module.
 * - Management: dashboard, plus read-only views for other modules.
 */
export const canViewModule = (
  user: UserProfile | TenantUser | null | undefined,
  module: string
): boolean => {
  if (!user) return false;
  const role = user.role.toLowerCase() as UserRole;

  // Management gets read-only access to mostly everything
  if (role === 'management') {
    return true; // Dashboard, RFQs, production, dispatch, customers
  }

  const normalizedModule = module.toUpperCase();

  switch (normalizedModule) {
    case 'DASHBOARD':
      return role === 'admin';
    case 'RFQ':
    case 'QUOTATION':
    case 'QUOTATIONS':
      return role === 'admin' || role === 'sales';
    case 'PRODUCTION':
    case 'ORDER':
    case 'ORDERS':
    case 'JOB':
      return role === 'admin' || role === 'production';
    case 'DISPATCH':
    case 'LOGISTICS':
      return role === 'admin' || role === 'dispatch';
    case 'CUSTOMERS':
    case 'CUSTOMER':
      return role === 'admin' || role === 'sales';
    case 'SETTINGS':
    case 'TENANT':
    case 'PRODUCTION_STAGES':
    case 'WHATSAPP':
      return role === 'admin';
    case 'USERS':
    case 'USER':
    case 'ROSTER':
      return role === 'admin';
    default:
      return false;
  }
};
