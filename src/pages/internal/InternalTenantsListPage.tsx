// src/pages/internal/InternalTenantsListPage.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllTenants } from '../../hooks/useInternalTenants';
import { 
  Building2, 
  Layers, 
  Users, 
  FolderSync, 
  Calendar, 
  Plus, 
  ShieldAlert, 
  Search, 
  Eye, 
  AlertTriangle,
  ExternalLink,
  Activity
} from 'lucide-react';
import { TextField } from '../../components/ui/TextField';

export const InternalTenantsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenants, loading, error, toggleTenantActive, createTenant } = useAllTenants();
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [onboardingFilter, setOnboardingFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // New Shard Modal Creation Flow
  const [showForm, setShowForm] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantId, setNewTenantId] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName || !newTenantId) return;

    setIsProvisioning(true);
    // Simulate brief container deployment latency
    await new Promise(resolve => setTimeout(resolve, 800));

    const success = await createTenant({
      id: newTenantId.trim().toLowerCase(),
      companyName: newTenantName.trim(),
      createdAt: new Date().toISOString(),
      isActive: true,
      onboardingStatus: 'pending'
    });

    setIsProvisioning(false);

    if (success) {
      setNewTenantName('');
      setNewTenantId('');
      setShowForm(false);
      alert(`Tenant Database Shard [${newTenantId}] successfully provisioned.`);
    } else {
      alert(`Failed to complete provisioning process. Verify partition identifier is unique.`);
    }
  };

  // Filter Tenants list
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOnboarding = onboardingFilter === 'all' || 
                              t.onboardingStatus === onboardingFilter;
    
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && t.isActive) ||
                          (statusFilter === 'suspended' && !t.isActive);

    return matchesSearch && matchesOnboarding && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-3 border-rose-500 border-t-transparent rounded-full mb-3" />
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse">
          Querying SaaS tenant topology...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center space-x-1.5 text-rose-500 font-mono text-[10px] uppercase font-bold tracking-widest mb-1.5">
            <ShieldAlert className="h-4 w-4" />
            <span>Super-Admin Core Supervision</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
            Ashrey Systems Tenant Controller
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Global network operations console to manage isolated database shards, review onboarding, toggle soft locks, and configure pilot accounts.
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-mono text-[10px] uppercase font-bold tracking-widest px-4 py-2.5 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all shrink-0"
          >
            <Plus className="h-4 w-4 text-rose-200 shrink-0" />
            <span>Provision New Shard</span>
          </button>
        )}
      </div>

      {/* Provision Form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-md max-w-2xl">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
            <h3 className="text-xs font-bold font-mono tracking-wider text-rose-400 uppercase flex items-center space-x-1.5">
              <span>🚀 Deploy Tenant Micro-Partition Shard</span>
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-white font-mono text-[10px] cursor-pointer border border-slate-800 rounded px-2 py-1 uppercase font-bold"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateTenant} className="space-y-4 text-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Tenant Unique ID / Shard Key *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. coimbatore_gears"
                  value={newTenantId}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
                    setNewTenantId(cleaned);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-xs font-mono tracking-wide focus:border-rose-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  Only lowercase letters, numbers, underscores or dashes allowed.
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Legal Enterprise Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coimbatore Gears Ltd."
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-xs font-sans tracking-wide focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-lg text-[11px] text-rose-300 leading-relaxed flex items-start space-x-2">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-400 mt-0.5" />
              <span>
                <strong>Provisioning Warning:</strong> Deploying a database shard reserves isolated structures in Firestore. Ensure the legal entity matches regional GST registrations.
              </span>
            </div>

            <div className="text-right pt-2">
              <button
                type="submit"
                disabled={isProvisioning || !newTenantId || !newTenantName}
                className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProvisioning ? 'Deploying Container Shard...' : 'Deploy Database Partition'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Alerts Summary */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-800 font-mono leading-relaxed flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-3xs flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        {/* Search */}
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search enterprise name or shard key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-205 rounded-lg pl-9 pr-4 py-2 text-xs font-sans tracking-wide focus:border-rose-500 focus:outline-hidden bg-slate-50/50 hover:bg-slate-50"
          />
        </div>

        {/* Onboarding Filter */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-[10px] font-mono text-slate-450 uppercase shrink-0">Onboarding:</span>
          <select
            value={onboardingFilter}
            onChange={(e) => setOnboardingFilter(e.target.value as any)}
            className="border border-slate-205 bg-white text-slate-700 text-xs rounded-lg px-2 text-center py-1.5 font-mono font-bold uppercase cursor-pointer hover:bg-slate-5 font-bold tracking-wider"
          >
            <option value="all">All States</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending Onboarding</option>
          </select>
        </div>

        {/* State Lock Status */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-[10px] font-mono text-slate-450 uppercase shrink-0">Status Lock:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-slate-205 bg-white text-slate-700 text-xs rounded-lg px-2 text-center py-1.5 font-mono font-bold uppercase cursor-pointer hover:bg-slate-5 font-bold tracking-wider"
          >
            <option value="all">Full Registry</option>
            <option value="active">Active Shards Only</option>
            <option value="suspended">Suspended Locked</option>
          </select>
        </div>
      </div>

      {/* Tenants Table Grid */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <Building2 className="h-4.5 w-4.5 text-rose-500" />
            <span className="text-xs font-bold font-mono text-slate-700 uppercase">Allocated Multi-Tenant Shards ({filteredTenants.length})</span>
          </div>
          <span className="text-[10px] font-mono text-rose-800 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded font-bold uppercase">
            Isolated RLS Enforced
          </span>
        </div>

        <div className="overflow-x-auto">
          {filteredTenants.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-450 font-mono uppercase">
              No matching tenant partitions found in system registers.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 font-mono text-[9px] uppercase tracking-wider text-slate-450">
                  <th className="p-3.5 pl-4.5 font-extrabold">Enterprise Partition</th>
                  <th className="p-3.5 font-extrabold text-center">Onboarding</th>
                  <th className="p-3.5 font-extrabold text-center">Users</th>
                  <th className="p-3.5 font-extrabold text-center">RFQs</th>
                  <th className="p-3.5 font-extrabold text-center">Jobs (WIP)</th>
                  <th className="p-3.5 font-extrabold">Last Active</th>
                  <th className="p-3.5 font-extrabold text-center">Lock Status</th>
                  <th className="p-3.5 pr-4.5 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filteredTenants.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/30 transition-colors">
                    {/* Primary Name */}
                    <td className="p-3.5 pl-4.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-[13px]">{t.companyName}</span>
                          <span className="bg-slate-100 text-slate-450 font-mono text-[9px] rounded px-1.5 py-0.5 border border-slate-200">
                            id: {t.id}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono">
                          <Calendar className="h-3 w-3 shrink-0 text-slate-300" />
                          <span>Provisioned: {new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>

                    {/* Onboarding */}
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border leading-none ${
                        t.onboardingStatus === 'completed' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                          : 'bg-amber-50 text-amber-700 border-amber-150'
                      }`}>
                        {t.onboardingStatus === 'completed' ? 'COMPLETED' : 'PENDING'}
                      </span>
                    </td>

                    {/* Active Users */}
                    <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                      <div className="flex items-center justify-center space-x-1">
                        <Users className="h-3.5 w-3.5 text-slate-300" />
                        <span>{t.activeUsersCount}</span>
                      </div>
                    </td>

                    {/* RFQs Count */}
                    <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                      <div className="flex items-center justify-center space-x-1">
                        <FolderSync className="h-3.5 w-3.5 text-slate-300" />
                        <span>{t.rfqsCount}</span>
                      </div>
                    </td>

                    {/* Jobs Count */}
                    <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                      <div className="flex items-center justify-center space-x-1">
                        <Layers className="h-3.5 w-3.5 text-slate-300" />
                        <span>{t.jobsCount}</span>
                      </div>
                    </td>

                    {/* Last Active */}
                    <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                      {t.lastActivityAt ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1">
                            <Activity className="h-3 w-3 text-rose-400" />
                            <span>{new Date(t.lastActivityAt).toLocaleDateString()}</span>
                          </div>
                          <span className="text-[9px] text-slate-400 block">{new Date(t.lastActivityAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* Lock status */}
                    <td className="p-3.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const confirmDesc = t.isActive 
                            ? `Lock and suspend tenant "${t.companyName}"? Users will be blocked from accessing their dashboard workspace immediately.` 
                            : `Unlock and reactivate tenant ${t.companyName}?`;
                          if (window.confirm(confirmDesc)) {
                            toggleTenantActive(t.id, t.isActive);
                          }
                        }}
                        className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold uppercase cursor-pointer transition-all ${
                          t.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-250 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-250'
                            : 'bg-rose-50 text-rose-600 border-rose-250 hover:bg-emerald-50 hover:text-emerald-750 hover:border-emerald-250'
                        }`}
                        title={t.isActive ? "Soft-Lock active block" : "Re-activate lockout"}
                      >
                        {t.isActive ? '🔓 Active / Open' : '🔒 LOCK / BLOCKED'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 pr-4.5 text-right">
                      <button
                        onClick={() => navigate(`/internal/tenants/${t.id}`)}
                        className="border border-slate-205 hover:border-rose-350 bg-white hover:bg-rose-50/20 text-slate-700 hover:text-rose-650 px-2.5 py-1.5 rounded-md font-mono text-[10px] uppercase font-bold tracking-wider space-x-1 inline-flex items-center cursor-pointer transition-colors shadow-3xs"
                        title="Query detailed diagnostics"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
