// src/pages/internal/InternalTenantDetailPage.tsx

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenantAdminDetail, useAllTenants } from '../../hooks/useInternalTenants';
import { useAuth } from '../../hooks/useAuth';
import { 
  Building2, 
  Layers, 
  Users, 
  FolderSync, 
  Calendar, 
  ShieldAlert, 
  ChevronLeft, 
  AlertTriangle,
  ExternalLink,
  Activity,
  Truck,
  CheckCircle,
  Database,
  Lock,
  Unlock,
  Terminal,
  RefreshCw
} from 'lucide-react';

export const InternalTenantDetailPage: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { profile, initializeSandbox } = useAuth();
  const { tenant, stats, loading, error } = useTenantAdminDetail(tenantId);
  const { toggleTenantActive } = useAllTenants();

  // Simulated "Proxy workspace view" active state triggers
  const [proxyLoading, setProxyLoading] = useState(false);

  const handleProxyWorkspace = async () => {
    if (!tenant) return;
    setProxyLoading(true);
    
    // Simulate container pipeline redirect delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    setProxyLoading(false);

    // Boot sandbox workspace with custom tenant company name and redirect to dashboard
    initializeSandbox(tenant.companyName);
    
    alert(`Active administrative proxy initiated. You are now viewing the workspace as "${tenant.companyName}" in sandbox simulation mode.`);
    navigate('/dashboard');
  };

  const handleSoftLockToggle = async () => {
    if (!tenant) return;
    const desc = tenant.isActive 
      ? `🚨 CRITICAL LOCKOUT: Are you sure you want to suspend and lockout the entire "${tenant.companyName}" workspace partition? Staff members under this tenant will be blocked from accessing services immediately.`
      : `Unlock and restore full database read-write permissions for "${tenant.companyName}"?`;
    
    if (window.confirm(desc)) {
      const success = await toggleTenantActive(tenant.id, !!tenant.isActive);
      if (success) {
        // Force quick hot reload state to view local storage updates if sandboxed
        alert(`Tenant ${tenant.isActive ? 'locked' : 'unlocked'} successfully.`);
        window.location.reload();
      }
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-3 border-rose-500 border-t-transparent rounded-full mb-3" />
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse">
          Querying cluster node registry detail: [{tenantId}]...
        </span>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => navigate('/internal/tenants')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900 font-mono uppercase tracking-wider mb-2 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Controller</span>
        </button>

        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-sm text-red-800 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <h3 className="font-bold uppercase tracking-wide">Registry Lookup Failed</h3>
          </div>
          <p className="text-xs leading-relaxed text-red-700 font-mono">
            {error || `Shard ID "${tenantId}" was not found or is restricted in the production project scope.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Breadcrumb Navigation */}
      <button
        onClick={() => navigate('/internal/tenants')}
        className="flex items-center space-x-1 text-slate-500 hover:text-slate-800 font-mono text-[10px] uppercase font-extrabold tracking-wider bg-slate-100 hover:bg-slate-205 py-1.5 px-3 rounded-md border border-slate-200 transition-colors shadow-3xs cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Return to Controller Console</span>
      </button>

      {/* Header Profile Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className={`h-2.5 w-2.5 rounded-full ${tenant.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-450 font-bold">
              {tenant.isActive ? 'Partition Operational' : 'PARTITION LOCKED / SUSPENDED'}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1 flex items-center space-x-2">
            <span>{tenant.companyName}</span>
            <span className="bg-slate-100 border border-slate-200 text-slate-550 font-mono text-[10px] rounded px-2.5 py-0.5 ml-2 uppercase">
              ID: {tenant.id}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Assigned database shard partition, RLS cluster tags, and high-fidelity telemetry metrics.
          </p>
        </div>

        {/* Lockout Trigger Action CTA */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleSoftLockToggle}
            className={`font-mono text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-lg border font-bold flex items-center space-x-1.5 cursor-pointer transition shadow-3xs ${
              tenant.isActive
                ? 'bg-rose-50 text-rose-750 border-rose-200 hover:bg-rose-100 hover:text-rose-900'
                : 'bg-emerald-50 text-emerald-800 border-emerald-250 hover:bg-emerald-100 hover:text-emerald-950'
            }`}
          >
            {tenant.isActive ? (
              <>
                <Lock className="h-4 w-4 text-rose-400" />
                <span>Soft Lockdown Tenant</span>
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 text-emerald-500" />
                <span>Re-Activate Tenant</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary Analytics Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Users Stats */}
        <div className="bg-stone-50 border border-slate-200 rounded-lg p-4 font-mono text-slate-700 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Users</span>
            <Users className="h-4 w-4 text-slate-450" />
          </div>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2">{stats.usersCount}</h4>
          <span className="text-[9px] text-slate-400 block mt-1 uppercase">Active Accounts</span>
        </div>

        {/* RFQs Count */}
        <div className="bg-stone-50 border border-slate-200 rounded-lg p-4 font-mono text-slate-700 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">RFQs Inquiries</span>
            <FolderSync className="h-4 w-4 text-slate-450" />
          </div>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2">{stats.rfqsCount}</h4>
          <span className="text-[9px] text-slate-400 block mt-1 uppercase">Lifetime Logs</span>
        </div>

        {/* Jobs (WIP) */}
        <div className="bg-stone-50 border border-slate-200 rounded-lg p-4 font-mono text-slate-700 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">WIP Component Lines</span>
            <Layers className="h-4 w-4 text-slate-450" />
          </div>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2">{stats.jobsCount}</h4>
          <span className="text-[9px] text-slate-400 block mt-1 uppercase">Shopfloor Units</span>
        </div>

        {/* Dispatches */}
        <div className="bg-stone-50 border border-slate-200 rounded-lg p-4 font-mono text-slate-700 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Dispatch Cargo</span>
            <Truck className="h-4 w-4 text-slate-450" />
          </div>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2">{stats.dispatchesCount}</h4>
          <span className="text-[9px] text-slate-400 block mt-1 uppercase">Consignment Slips</span>
        </div>

        {/* Audit Count */}
        <div className="bg-stone-50 border border-slate-200 rounded-lg p-4 font-mono text-slate-700 shadow-3xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Raw Audit Events</span>
            <Activity className="h-4 w-4 text-slate-450" />
          </div>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2">{stats.activityCount}</h4>
          <span className="text-[9px] text-slate-400 block mt-1 uppercase">Security Events</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Shard Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
              <span className="text-[10px] font-mono tracking-wider uppercase font-bold text-slate-700 flex items-center">
                <Database className="h-4 w-4 text-slate-400 mr-1.5" />
                <span>Production Shard Config</span>
              </span>
              <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded font-black uppercase">
                Active Tenant Registry
              </span>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Enterprise Name</span>
                  <p className="font-bold text-slate-900 text-sm">{tenant.companyName}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Partition Key (ID)</span>
                  <p className="font-mono text-slate-800 font-bold bg-slate-100 border border-slate-200 px-2 py-1 rounded inline-block text-[11px]">{tenant.id}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">GSTIN Register Number</span>
                  <p className="font-mono text-slate-700">{tenant.gstin || 'Not registered / pending integration'}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">System Currency Symbol</span>
                  <p className="font-sans font-bold text-slate-850">{tenant.currency || '₹ (INR)'}</p>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">HQ Storage / Dispatched Yard Location</span>
                  <p className="font-sans text-slate-650 leading-relaxed text-[11px]">{tenant.address || 'Ashrey Foundry GIDC yard headquarters, Pune'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sandbox workspace viewer stubs */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-sm text-slate-300">
            <h3 className="text-xs font-mono tracking-wider font-extrabold uppercase text-rose-400 mb-2 flex items-center space-x-1.5">
              <span>🛡️ SUPER-ADMIN PROXY OVERRIDE CONTROLS</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans mb-4">
              Authorized super-admins can instantiate high-trust user sessions acting directly on behalf of {tenant.companyName}. This proxy acts on sandbox state simulation parameters.
            </p>

            <button
              onClick={handleProxyWorkspace}
              disabled={proxyLoading}
              className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-[10px] uppercase font-bold tracking-widest px-4.5 py-3 rounded-lg flex items-center space-x-1.5 transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {proxyLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Configuring isolated workspace proxy...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 text-white shrink-0" />
                  <span>Impersonate & View CRM Workspace as Tenant</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Payload Inspection Terminal */}
        <div className="lg:col-span-1 space-y-4 flex flex-col justify-stretch">
          <div className="bg-slate-950 border border-slate-850 rounded-lg p-4.5 flex-grow flex flex-col min-h-[350px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-850 text-slate-400">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold flex items-center">
                <Terminal className="h-4 w-4 mr-1 text-rose-500 shrink-0" />
                <span>JSON Schema Inspection Payload</span>
              </span>
              <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-slate-800 bg-slate-900 uppercase">
                Active Document
              </span>
            </div>

            {/* Simulated Live Shell viewer */}
            <div className="flex-grow font-mono text-[10px] text-emerald-400 overflow-y-auto leading-relaxed bg-slate-950/80 p-3 rounded-md border border-slate-850 select-text max-h-[400px]">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify({
                  database_v: "1.0",
                  rls_policy: "enforced",
                  tenant_profile: tenant,
                  diagnostic_counters: stats,
                  onboarding: {
                    status: stats.jobsCount > 0 ? "completed" : "pending_stages",
                    whatsapp_queue: "active"
                  },
                  supervisor_rights: ["admin", "superadmin"]
                }, null, 2)}
              </pre>
            </div>
            
            <div className="mt-3 leading-none text-right">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block font-extrabold mt-1">
                Ashrey Sys Database Root Query Terminal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
