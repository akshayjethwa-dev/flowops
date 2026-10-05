// src/pages/settings/TenantSettingsPage.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTenantConfig } from '../../hooks/useTenantConfig';
import { Factory, Shield, HelpCircle, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TextField } from '../../components/ui/TextField';
import { loadDemoData } from '../../utils/seedLoader';

export const TenantSettingsPage: React.FC = () => {
  const { profile } = useAuth();
  const { tenantConfig, loading, error, saveTenantConfig, isAdmin } = useTenantConfig(profile?.tenantId);

  const [tenantName, setTenantName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');
  const [defaultCurrency, setDefaultCurrency] = useState('INR (₹)');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState<string | null>(null);

  const handleLoadDemoData = async () => {
    const warning = "This will replace all current data for this tenant. Continue?";
    if (!window.confirm(warning)) return;

    setSeeding(true);
    setSeedProgress("Initializing...");
    try {
      await loadDemoData(profile?.tenantId || 'demo-tenant-001', (msg) => {
        setSeedProgress(msg.replace(/^\[SeedLoader\] /, ''));
      });
      setSuccessMsg("🧪 Industrial Demo Environment loaded successfully! Feel free to explore newly populated charts, active jobs board, invoices, RFQs, and messages.");
      setTimeout(() => setSuccessMsg(null), 8500);
      
      // Force instant refresh so useDashboardData snapshots pick up the database additions
      if (typeof window !== 'undefined') {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred during demo seeding.');
    } finally {
      setSeeding(false);
      setSeedProgress(null);
    }
  };

  // Sync state when config finishes loading
  useEffect(() => {
    if (tenantConfig) {
      setTenantName(tenantConfig.tenantName);
      setGstNumber(tenantConfig.gstNumber);
      setAddress(tenantConfig.address);
      setContactEmail(tenantConfig.contactEmail);
      setContactPhone(tenantConfig.contactPhone);
      setTimeZone(tenantConfig.timeZone || 'Asia/Kolkata');
      setDefaultCurrency(tenantConfig.defaultCurrency || 'INR (₹)');
    }
  }, [tenantConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFormError('Edit clearance denied. You must be an Administrator to alter plant profiles.');
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setFormError(null);

    try {
      await saveTenantConfig({
        tenantName,
        address,
        gstNumber,
        contactEmail,
        contactPhone,
        timeZone,
        defaultCurrency
      });
      setSuccessMsg('Plant profile and accounting regulations successfully saved.');
      // Auto dismiss success label
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving configurations.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Loading plant specifications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-slate-200">
        <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
          Governance & Tenancy
        </span>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
          Plant Profile Config
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Set regulatory GSTIN parameters, legal enterprise names, and contact nodes for multi-tenant isolation boundaries.
        </p>
      </div>

      {(error || formError) && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider font-mono">Operations Error</h5>
            <p className="text-xs text-rose-600 mt-1 leading-relaxed">{error || formError}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">Configuration Locked</h5>
            <p className="text-xs text-emerald-600 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Card Configuration Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Factory className="h-5 w-5 text-sky-600 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Commercial Factory Parameters</h4>
            </div>
            {!isAdmin && (
              <span className="bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-1 border border-amber-200/50 rounded flex items-center space-x-1 uppercase font-mono">
                <Lock className="h-3 w-3 shrink-0" />
                <span>Locked (Read Only)</span>
              </span>
            )}
            {isAdmin && (
              <span className="bg-sky-50 text-sky-700 text-[9px] font-bold px-2 py-1 border border-sky-200/50 rounded uppercase font-mono">
                Admin Privilege Active
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <TextField
              id="tenant-company-name"
              label="Legal Company Registered Name *"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              disabled={!isAdmin}
              helperText="This legal title appears on bills of materials, PDF quotes, and purchase orders."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                id="tenant-gstin"
                label="Indian Business GSTIN *"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                required
                disabled={!isAdmin}
                placeholder="27AADCA1112B1Z1"
                helperText="15-digit Tax Identification Code"
              />
              <TextField
                id="tenant-phone"
                label="Registered Corporate Phone Node *"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                disabled={!isAdmin}
                placeholder="+91xxxxxxxxxx"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                id="tenant-email"
                label="Invoicing & Support Email Contact *"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                disabled={!isAdmin}
                placeholder="billing@company.com"
                helperText="Primary email used to route automated receipt audits"
              />

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 font-mono">
                  Default Currency Zone *
                </label>
                <select
                  id="tenant-currency-zone"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full text-xs font-mono h-11 px-3 border border-slate-200 bg-white rounded-md text-slate-800 disabled:bg-slate-50 focus:border-slate-400 focus:outline-hidden"
                >
                  <option value="INR (₹)">INR (₹) - Indian Rupee Zone</option>
                  <option value="USD ($)">USD ($) - US Dollar Trading</option>
                  <option value="EUR (€)">EUR (€) - Eurozone Settlement</option>
                  <option value="GBP (£)">GBP (£) - British Pound Sterling</option>
                </select>
                <span className="text-[10px] text-slate-400 font-mono block">Standard invoicing scale format</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 font-mono">
                  Standard Site Timestate Region *
                </label>
                <select
                  id="tenant-timezone-zone"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full text-xs font-mono h-11 px-3 border border-slate-200 bg-white rounded-md text-slate-800 disabled:bg-slate-50 focus:border-slate-400 focus:outline-hidden"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - GMT+5:30)</option>
                  <option value="UTC">UTC / GMT Universal Baseline</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Singapore">Asia/Singapore (SGT - GMT+8)</option>
                </select>
                <span className="text-[10px] text-slate-400 font-mono block">Anchors dispatch schedules</span>
              </div>

              <TextField
                id="tenant-address"
                label="Physical Factory Dispatch Address *"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                disabled={!isAdmin}
                helperText="Specific site yard for fleet loaders and transport logistics maps."
              />
            </div>

            {isAdmin && (
              <div className="border-t border-slate-100 pt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider px-5 py-2 rounded h-11 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {saving ? 'Saving changes...' : 'Publish Tenancy Updates'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Security / System Guidelines Info Card */}
        <div className="bg-slate-900 text-slate-300 rounded-lg p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-white border-b border-slate-800 pb-2.5">
              <Shield className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Isolation Security Guard</h4>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400 font-sans">
              Ashrey FlowOps enforces strict Row-Level-Security (RLS) policies at the Firestore database schema layer under tenant credentials boundary:
            </p>

            <ul className="space-y-2 text-[10.5px] font-mono text-slate-300 list-disc list-inside">
              <li>Cross-tenant reads isolated dynamically</li>
              <li>Encrypted auth token boundaries</li>
              <li>Audit event triggers active on edits</li>
              <li>Strict Admin-only editing validation</li>
            </ul>
          </div>

          <div className="bg-slate-800 rounded p-4 mt-6 flex items-start space-x-2 text-[11px]">
            <HelpCircle className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-slate-400 leading-relaxed font-sans">
              To request full cloud migration, custom enterprise database setups, or private node orchestration, reach out to corporate tenant administrators.
            </p>
          </div>
        </div>

        {/* Demo Seeding Utility Card */}
        {((import.meta as any).env?.VITE_DEMO_MODE === "true" || profile?.tenantId === "demo-tenant-001") && (
          <div className="lg:col-span-3 bg-indigo-50/50 border border-indigo-100 rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="bg-indigo-100/80 text-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider font-sans">
                  Test Sandbox Tools
                </span>
              </div>
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider font-sans mt-1">Industrial Mock Engine</h4>
              <p className="text-[11px] text-indigo-750 max-w-2xl mt-0.5 leading-relaxed font-sans">
                Populate this tenant partition with pre-defined operational data for <strong>Vulcan Gears Pvt. Ltd.</strong> This imports customers, inventory below safety thresholds, overdue/pending billing sheets, real-time message feeds, workshop jobs, and activity audits.
              </p>
            </div>
            <div className="shrink-0 flex items-center">
              <button
                type="button"
                id="btn-load-demo-data"
                onClick={handleLoadDemoData}
                disabled={seeding}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-3 rounded flex items-center space-x-2 transition-all cursor-pointer shadow-xs min-w-[190px] justify-center h-11"
              >
                {seeding ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-750 mr-2"></div>
                    <span className="text-[9px] animate-pulse truncate max-w-[140px]">{seedProgress || 'Loading...'}</span>
                  </>
                ) : (
                  <span>🧪 Load Demo Data</span>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
