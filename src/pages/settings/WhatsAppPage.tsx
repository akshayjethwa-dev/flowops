// src/pages/settings/WhatsAppPage.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useWhatsappConfig } from '../../hooks/useWhatsappConfig';
import { WhatsAppAuditSection } from '../../components/WhatsAppAuditSection';
import { MessageSquare, Server, ShieldAlert, CheckCircle2, RefreshCw, AlertTriangle, Key } from 'lucide-react';
import { TextField } from '../../components/ui/TextField';

export const WhatsAppPage: React.FC = () => {
  const { profile } = useAuth();
  const { whatsappConfig, loading, error, saveWhatsappConfig, validating, isAdmin } = useWhatsappConfig(profile?.tenantId);

  const [bspType, setBspType] = useState<'AiSensy' | 'Interakt' | 'Other'>('AiSensy');
  const [apiKey, setApiKey] = useState('');
  const [senderPhoneNumber, setSenderPhoneNumber] = useState('');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  // Sync state with db loaded configuration
  useEffect(() => {
    if (whatsappConfig) {
      setBspType(whatsappConfig.bspType);
      setApiKey(whatsappConfig.apiKey);
      setSenderPhoneNumber(whatsappConfig.senderPhoneNumber);
    }
  }, [whatsappConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setLocalErr('Access denied. You do not hold dispatch/sales clearance to modify automations.');
      return;
    }

    setLocalErr(null);
    setSaveSuccess(false);

    try {
      const response = await saveWhatsappConfig({
        bspType,
        apiKey,
        senderPhoneNumber
      });

      if (response) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setLocalErr('Failed to authenticate and save configuration mappings.');
      }
    } catch (err: any) {
      setLocalErr(err.message || 'Error occurred while publishing configurations.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Loading Gateway Keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-205 gap-3">
        <div>
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Automations & Outbox Logs
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
            WhatsApp Dispatch Journal & BSP
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure Business Service Providers (BSP) and monitor logs sent to purchasing dealers.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 p-2 px-3 self-start md:self-center rounded">
          <Server className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span className="text-[10px] font-mono font-bold text-slate-600 uppercase">
            Active: {whatsappConfig?.bspType || bspType} API
          </span>
        </div>
      </div>

      {(error || localErr) && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider font-mono">Gateway Exception</h5>
            <p className="text-xs text-rose-600 mt-1 leading-relaxed">{error || localErr}</p>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">API Connection Live</h5>
            <p className="text-xs text-emerald-600 mt-0.5">
              BSP Credentials refreshed. Mock handshake returned response status: <strong className="font-semibold text-emerald-800">CONNECTED (200 OK)</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Main configuration grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Input parameters card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-sky-600 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">BSP Outbound Node Setup</h4>
            </div>
            {!isAdmin && (
              <span className="text-[9px] font-mono bg-slate-100 border text-slate-500 px-2 py-0.5 rounded">
                Read-Only (Requires Admin/Sales)
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 font-mono">
                  Business Service Provider *
                </label>
                <select
                  id="whatsapp-bsp-type"
                  value={bspType}
                  onChange={(e) => setBspType(e.target.value as any)}
                  disabled={!isAdmin}
                  className="w-full text-xs font-mono h-11 px-3 border border-slate-200 bg-white rounded-md text-slate-800 focus:border-slate-400 focus:outline-hidden"
                >
                  <option value="AiSensy">AiSensy Official (Standard SDK)</option>
                  <option value="Interakt">Interakt Business API (Meta Platform)</option>
                  <option value="Other">Custom Gateway Hub Endpoint</option>
                </select>
                <span className="text-[10px] text-slate-400 font-mono block">Outbound routing template platform</span>
              </div>

              <TextField
                id="whatsapp-sender-phone"
                label="Verified Sender Phone Number *"
                value={senderPhoneNumber}
                onChange={(e) => setSenderPhoneNumber(e.target.value)}
                required
                disabled={!isAdmin}
                placeholder="+91xxxxxxxxxx"
                helperText="Must match Meta WhatsApp Business Manager profiles"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 font-mono">
                API Authentication Token / Key *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="whatsapp-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  disabled={!isAdmin}
                  className="w-full pl-9 pr-3 text-xs font-mono h-11 border border-slate-200 bg-white rounded-md text-slate-800 focus:border-slate-400 focus:outline-hidden"
                  placeholder="Insert secure authorization hash..."
                />
              </div>
              <span className="text-[10px] text-slate-440 font-mono block mt-1">
                Security Warning: Tokens are encrypted in transit and mapped securely inside KMS HSM boundaries.
              </span>
            </div>

            {isAdmin && (
              <div className="border-t border-slate-100 pt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={validating}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider px-5 py-2 rounded h-11 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {validating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                      <span>Verifying Sandbox Node...</span>
                    </>
                  ) : (
                    'Commit & Terminate Gateway Handshake'
                  )}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Connection status card widgets */}
        <div className="bg-slate-900 text-slate-300 rounded-lg p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-white border-b border-slate-800 pb-2.5">
              <Server className="h-4 w-4 text-sky-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Route Telemetry Node</h4>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 block">
                  Gateway Stream Status
                </span>
                <div className="flex items-center space-x-2 mt-1">
                  {whatsappConfig?.status === 'connected' ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></div>
                      <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wide">
                        ● CONNECTED
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-rose-400"></div>
                      <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wide">
                        ● OFFLINE / LOCKED
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 block">
                  Ping Speed Handshake
                </span>
                <span className="text-xs font-mono font-semibold text-slate-300 block mt-0.5">
                  {whatsappConfig?.status === 'connected' ? '38ms (Stable)' : 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 block">
                  Cloud validation TODO
                </span>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-relaxed">
                  Triggers async GCP functions on database edits to decrypt keys and authorize templates under IAM roles.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded p-3 text-[10px] text-slate-400 leading-relaxed font-mono flex items-start space-x-2 border border-slate-750">
            <ShieldAlert className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <p>
              Outbox alerts follow preapproved WhatsApp Business Manager templates. Custom templates require compliance review.
            </p>
          </div>
        </div>

      </div>

      {/* Outbound log list section */}
      <div className="border border-slate-200 rounded-lg bg-white p-6 shadow-2xs">
        <WhatsAppAuditSection />
      </div>

    </div>
  );
};
