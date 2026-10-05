// src/components/layout/ProtectedRoute.tsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { isSuperAdmin, canPerformAction, PermissionAction } from '../../utils/permissions';
import { Lock, LogOut, ShieldCheck, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredAction?: PermissionAction;
  requireSuperAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  requiredAction,
  requireSuperAdmin
}) => {
  const { authStatus, profile, tenant, signOut } = useAuth();
  const location = useLocation();

  // 🔒 STRICT GATE: Block rendering if loading OR if auth is 'active' but the tenant hasn't populated yet
  if (authStatus === 'loading' || (authStatus === 'active' && !tenant)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 space-y-4">
        <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
        <div className="flex flex-col items-center space-y-1 text-center">
          <span className="text-xs font-mono font-bold text-slate-700 uppercase tracking-widest flex items-center justify-center space-x-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Verifying Secure Workspace</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Establishing tenant connection and security rules...
          </span>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (authStatus === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-8 shadow-xs">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 font-bold">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wide">
            Account Suspended
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Your access to this workspace has been deactivated by the system administrator.
          </p>
          <button 
            onClick={signOut} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Safely</span>
          </button>
        </div>
      </div>
    );
  }

  if (requireSuperAdmin && !isSuperAdmin(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  // 🔒 RBAC Check by specific allowed roles (Legacy fallback)
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    const defaultRoute = (profile.role === 'operator' || profile.role === 'production') ? '/orders' :
                         (profile.role === 'store_keeper') ? '/inventory' :
                         (profile.role === 'dispatch') ? '/dispatch' : '/dashboard';
    if (location.pathname !== defaultRoute) {
      return <Navigate to={defaultRoute} replace />;
    }
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-slate-200 rounded-lg p-8 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            ⚠️
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-2 uppercase tracking-wide">
            Module Clearance Required
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Your current assigned role ({profile.role}) does not have clearance for this manufacturing module.
          </p>
        </div>
      </div>
    );
  }

  // 🔒 Strict RBAC Check by actionable permissions
  if (requiredAction && profile && !canPerformAction(profile, requiredAction)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-slate-200 rounded-lg p-8 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            ⚠️
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-2 uppercase tracking-wide">
            Clearance Denied
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Your profile lacks the explicit "{requiredAction}" permission required for this module.
          </p>
          <Navigate to="/dashboard" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};