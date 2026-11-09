// src/components/dispatch/GenerateEInvoiceModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Server, 
  ShieldCheck, 
  FileText, 
  RefreshCw, 
  Copy, 
  ExternalLink,
  Download,
  Info,
  Check,
  Send,
  HelpCircle,
  QrCode
} from 'lucide-react';
import { Dispatch, Customer } from '../../types';
import { 
  IRPAdapterType, 
  EInvoiceData, 
  EInvoiceEligibilityResult 
} from '../../types/eInvoice';
import { 
  validateEInvoiceEligibility, 
  validateGstinWithChecksum,
  DEFAULT_EINVOICE_CONFIG 
} from '../../utils/eInvoiceValidator';
import { 
  generateEInvoiceForDispatch, 
  recordManualEInvoice 
} from '../../services/eInvoiceService';
import { downloadEInvoicePdf } from '../../utils/eInvoicePdfGenerator';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface GenerateEInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: Dispatch;
  onSuccess: (eInvoiceData: EInvoiceData) => void;
}

export const GenerateEInvoiceModal: React.FC<GenerateEInvoiceModalProps> = ({
  isOpen,
  onClose,
  dispatch,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'generate' | 'manual'>('generate');
  const [selectedAdapter, setSelectedAdapter] = useState<IRPAdapterType>('nic');
  const [turnoverCr, setTurnoverCr] = useState<number>(5.5); // Default >= 5 Cr
  
  // Simulation toggles for acceptance testing
  const [simulateDowntime, setSimulateDowntime] = useState(false);
  const [simulateDuplicate, setSimulateDuplicate] = useState(false);

  // Customer state & validation
  const [customer, setCustomer] = useState<any>({});
  const [gstinInput, setGstinInput] = useState<string>('');
  const [registrationType, setRegistrationType] = useState<'regular' | 'composition' | 'unregistered' | 'consumer'>('regular');
  const [isExport, setIsExport] = useState(false);

  // Execution state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<EInvoiceData | null>(null);

  // Manual fallback fields (EC 3)
  const [manualIrn, setManualIrn] = useState('');
  const [manualAckNo, setManualAckNo] = useState('');
  const [manualAckDate, setManualAckDate] = useState(new Date().toISOString());

  // Initialize customer data from dispatch or local storage
  useEffect(() => {
    if (!dispatch || !isOpen) return;

    // Try finding customer from tenant store
    let matchedCust: any = null;
    if (tenant?.id) {
      try {
        const cached = localStorage.getItem(`customers_${tenant.id}`);
        if (cached) {
          const list: any[] = JSON.parse(cached);
          matchedCust = list.find((c: any) => c.name === dispatch.customerName || c.id === dispatch.customerId) || null;
        }
      } catch (e) {
        console.warn('Error reading customer cache', e);
      }
    }

    const defaultGstin = matchedCust?.gstin || matchedCust?.gstNumber || (dispatch as any).customerGstin || '27AAACG9999A1Z5';
    const defaultRegType = matchedCust?.registrationType || (defaultGstin ? 'regular' : 'unregistered');

    setCustomer(matchedCust || {
      name: dispatch.customerName || 'B2B Client Ltd',
      gstin: defaultGstin,
      registrationType: defaultRegType,
      billingAddress: {
        street: 'Plot 42, MIDC Industrial Area',
        city: 'Pune',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '411018'
      }
    });

    setGstinInput(defaultGstin);
    setRegistrationType(defaultRegType);
    setErrorMsg(null);
    setErrorCode(null);
    setSuccessData(dispatch.eInvoice || null);
  }, [dispatch, isOpen, tenant?.id]);

  if (!isOpen) return null;

  // Real-time eligibility evaluation
  const effectiveCustomer: any = {
    ...customer,
    name: dispatch.customerName || customer?.name || 'Client',
    gstin: gstinInput.trim().toUpperCase(),
    registrationType: registrationType
  };

  const eligibility: EInvoiceEligibilityResult = validateEInvoiceEligibility(
    effectiveCustomer,
    dispatch.items || [],
    turnoverCr,
    isExport
  );

  const handleGenerate = async () => {
    if (!tenant?.id) {
      toastError('Error', 'Tenant workspace not identified.');
      return;
    }

    // Block if hard validation failure (e.g. invalid GSTIN checksum)
    if (!eligibility.isEligible) {
      const primaryError = eligibility.errors[0] || 'Validation failed for e-Invoicing.';
      setErrorMsg(primaryError);
      toastError('Validation Failed', primaryError);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await generateEInvoiceForDispatch(
        dispatch,
        effectiveCustomer as Customer,
        {
          tenantId: tenant.id,
          adapter: selectedAdapter,
          actorName: profile?.name || profile?.email || 'Finance Manager',
          actorRole: profile?.role || 'finance',
          overrideConfig: {
            turnoverThresholdCr: turnoverCr,
            supplierGstin: tenant.gstin || '27AABCS1429B1ZB',
            supplierLegalName: tenant.name || 'NexFlow Manufacturing Industries Ltd',
            simulateDowntime,
            simulateDuplicateIrn: simulateDuplicate
          },
          isSandboxMode: localStorage.getItem('isSandboxMode') === 'true'
        }
      );

      if (!res.success || !res.eInvoiceData) {
        throw new Error(res.error || 'Failed to generate e-Invoice via IRP.');
      }

      setSuccessData(res.eInvoiceData);
      onSuccess(res.eInvoiceData);
      toastSuccess(
        'e-Invoice Generated Successfully',
        `IRN: ${res.eInvoiceData.irn.substring(0, 16)}... | Ack: ${res.eInvoiceData.ackNo}`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate e-Invoice via IRP.');
      setErrorCode(err.code || 'IRP_ERROR');
      toastError('e-Invoice Generation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSave = async () => {
    if (!tenant?.id) return;
    if (manualIrn.length !== 64) {
      toastError('Invalid IRN', 'IRN must be exactly 64 hexadecimal characters.');
      return;
    }
    if (!manualAckNo || manualAckNo.trim().length < 10) {
      toastError('Invalid Ack Number', 'Please enter a valid 15-digit Acknowledgement Number.');
      return;
    }

    setSubmitting(true);
    try {
      const updatedDispatch = await recordManualEInvoice(
        dispatch,
        {
          irn: manualIrn.trim().toLowerCase(),
          ackNo: manualAckNo.trim(),
          ackDate: manualAckDate,
          adapter: selectedAdapter,
          enteredBy: profile?.name || profile?.email || 'Finance User',
          userRole: profile?.role || 'finance'
        },
        {
          tenantId: tenant.id,
          isSandboxMode: localStorage.getItem('isSandboxMode') === 'true'
        }
      );

      if (!updatedDispatch.eInvoice) {
        throw new Error('Failed to record manual e-Invoice.');
      }

      setSuccessData(updatedDispatch.eInvoice);
      onSuccess(updatedDispatch.eInvoice);
      toastSuccess('Manual e-Invoice Recorded', `IRN: ${updatedDispatch.eInvoice.irn.substring(0, 16)}...`);
    } catch (err: any) {
      toastError('Save Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 font-sans animate-in fade-in zoom-in-95 duration-150 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-150">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded uppercase">
                  GST e-Invoice (IRP)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  CGST Rule 48(4)
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Generate e-Invoice for #{dispatch.dispatchNumber || dispatch.invoiceNumber}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch (Direct IRP vs Manual Offline Fallback) */}
        <div className="flex space-x-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'generate'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Direct IRP Gateway</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'manual'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Manual Portal Entry (Fallback)</span>
          </button>
        </div>

        {/* Success View */}
        {successData && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>IRN Active & Stored on Consignment</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200 font-mono text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Invoice Reference Number (IRN):</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(successData.irn);
                    toastSuccess('Copied', 'IRN copied to clipboard');
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-[10px] flex items-center space-x-1"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="text-[11px] font-bold text-slate-800 break-all select-all bg-slate-50 p-2 rounded border border-slate-200">
                {successData.irn}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Ack No:</span>
                  <span className="font-bold text-slate-800">{successData.ackNo}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Ack Date:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(successData.ackDate).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => {
                  downloadEInvoicePdf(
                    successData,
                    dispatch,
                    {
                      name: tenant?.name || 'NexFlow Industries',
                      gstin: tenant?.gstin || '27AABCS1429B1ZB',
                      address: { street: 'Industrial Estate', city: 'Pune', state: 'Maharashtra', pincode: '411018' }
                    },
                    customer
                  );
                }}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Print e-Invoice PDF (Signed QR)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Direct IRP Flow */}
        {!successData && activeTab === 'generate' && (
          <div className="space-y-4">
            
            {/* Pre-flight checklist card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <span>GST Pre-flight Verification Checklist</span>
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  eligibility.isEligible 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {eligibility.isEligible ? 'Eligible for e-Invoicing' : 'Validation Issues Detected'}
                </span>
              </div>

              {/* Checklist items */}
              <div className="space-y-2 text-xs">
                {/* 1. Customer GSTIN */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {eligibility.checks.hasValidGstin ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Customer GSTIN Checksum:</span>
                      <span className="font-mono text-[11px] text-slate-600 ml-1.5">{gstinInput || 'Not Provided'}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    eligibility.checks.hasValidGstin ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {eligibility.checks.hasValidGstin ? 'Valid (Luhn Mod-36 ✓)' : 'Checksum Fail'}
                  </span>
                </div>

                {/* 2. B2B Registration Type (EC 5) */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {eligibility.checks.isB2B ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Registration Category:</span>
                      <span className="font-mono text-[11px] text-slate-600 ml-1.5 capitalize">{registrationType}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    eligibility.checks.isB2B ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {eligibility.checks.isB2B ? 'B2B Mandatory' : 'B2C Exempt (EC 5)'}
                  </span>
                </div>

                {/* 3. Line Items HSN Codes */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {eligibility.checks.hasHsnCodes ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Product HSN Codes:</span>
                      <span className="text-[11px] text-slate-600 ml-1.5">
                        {dispatch.items?.length || 0} line item(s) mapped
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    eligibility.checks.hasHsnCodes ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {eligibility.checks.hasHsnCodes ? 'All HSNs Valid (4-8 Digits)' : 'Missing HSNs'}
                  </span>
                </div>

                {/* 4. Annual Turnover Threshold (EC 2) */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {eligibility.checks.exceedsThreshold ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Turnover Threshold:</span>
                      <span className="text-[11px] text-slate-600 ml-1.5">₹{turnoverCr} Cr (Threshold: ₹5.00 Cr)</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    eligibility.checks.exceedsThreshold ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {eligibility.checks.exceedsThreshold ? 'Threshold Exceeded' : 'Below ₹5 Cr (EC 2)'}
                  </span>
                </div>
              </div>

              {/* Validation Errors banner (EC 1) */}
              {eligibility.errors.length > 0 && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                  <span className="text-[11px] font-bold text-rose-900 block">Pre-flight Blockers:</span>
                  <ul className="list-disc pl-4 text-[11px] text-rose-800 space-y-0.5">
                    {eligibility.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* B2C Exemption Notice (EC 5) */}
              {!eligibility.checks.isB2B && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 space-y-1.5">
                    <p className="font-bold">e-Invoicing applies to B2B only (Acceptance Criteria EC 5)</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                      Per GST Rule 48(4), supplies to unregistered or retail consumers do not require an IRN from the government portal. You can generate and print a standard B2C Tax Invoice directly.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        downloadEInvoicePdf(
                          null,
                          dispatch,
                          {
                            name: tenant?.name || 'NexFlow Industries',
                            gstin: tenant?.gstin || '27AABCS1429B1ZB',
                            address: { street: 'Industrial Estate', city: 'Pune', state: 'Maharashtra', pincode: '411018' }
                          },
                          effectiveCustomer
                        );
                        toastSuccess('B2C Tax Invoice Downloaded', 'Standard GST invoice printed without IRN.');
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Print B2C Tax Invoice (No IRN)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick customer master editable inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Customer GSTIN (15-Char Mod-36)
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={gstinInput}
                    onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 27AAACG9999A1Z5"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setGstinInput('27AAACG9999A1Z5')}
                    title="Fill standard sample valid B2B GSTIN"
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono text-slate-600 cursor-pointer"
                  >
                    Sample
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Registration Category
                </label>
                <select
                  value={registrationType}
                  onChange={(e) => setRegistrationType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                >
                  <option value="regular">Regular (B2B Taxable)</option>
                  <option value="composition">Composition (B2B)</option>
                  <option value="unregistered">Unregistered Consumer (B2C Exempt)</option>
                  <option value="consumer">Overseas / SEZ / Export</option>
                </select>
              </div>
            </div>

            {/* Gateway Configuration & Adapter Selection */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                GST IRP Gateway Adapter
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['nic', 'cleartax', 'masters_india'] as IRPAdapterType[]).map((adapter) => (
                  <button
                    key={adapter}
                    type="button"
                    onClick={() => setSelectedAdapter(adapter)}
                    className={`p-2.5 border rounded-xl text-left transition cursor-pointer ${
                      selectedAdapter === adapter
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 shadow-2xs ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase font-mono">
                        {adapter === 'nic' ? 'NIC Direct' : adapter === 'cleartax' ? 'ClearTax' : 'Masters India'}
                      </span>
                      {selectedAdapter === adapter && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {adapter === 'nic' ? 'Govt Direct Portal' : adapter === 'cleartax' ? 'Enterprise GSP' : 'Automated Cloud'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Acceptance Criteria edge-case simulation toggles */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Verification Simulation Scenarios
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={simulateDowntime}
                    onChange={(e) => {
                      setSimulateDowntime(e.target.checked);
                      if (e.target.checked) setSimulateDuplicate(false);
                    }}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">Simulate IRP Down (EC 3)</span>
                    <span className="text-[10px] text-slate-500 block">Tests error fallback to manual entry</span>
                  </div>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={simulateDuplicate}
                    onChange={(e) => {
                      setSimulateDuplicate(e.target.checked);
                      if (e.target.checked) setSimulateDowntime(false);
                    }}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">Simulate Duplicate 2150 (EC 4)</span>
                    <span className="text-[10px] text-slate-500 block">Fetches existing IRN seamlessly</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Error banner when generation fails */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-rose-900 font-bold text-xs">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Gateway Request Failed ({errorCode || 'IRP_ERROR'})</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed font-sans">
                  {errorMsg}
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('manual');
                      setErrorMsg(null);
                    }}
                    className="px-2.5 py-1 bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 rounded text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Switch to Manual Entry Fallback (EC 3)
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-150">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="button"
                disabled={submitting || !eligibility.isEligible}
                onClick={handleGenerate}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm cursor-pointer transition"
                title={!eligibility.isEligible ? eligibility.errors[0] : 'Transmit to GST IRP Gateway'}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Calling {selectedAdapter.toUpperCase()} Gateway...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Generate e-Invoice</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

        {/* Manual Portal Fallback Tab (EC 3) */}
        {!successData && activeTab === 'manual' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-900">
              <div className="flex items-center space-x-1.5 font-bold">
                <HelpCircle className="h-4 w-4 text-amber-600" />
                <span>Manual Offline IRP Fallback Instructions</span>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-[11px] text-amber-800 font-sans leading-relaxed">
                <li>Log in to the government offline tool or <a href="https://einvoice1.gst.gov.in" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900">einvoice1.gst.gov.in</a>.</li>
                <li>Upload the invoice JSON or enter invoice number <strong>{dispatch.invoiceNumber || dispatch.dispatchNumber}</strong> manually.</li>
                <li>Copy the 64-character IRN and 15-digit Acknowledgement Number returned by the portal below to store into this consignment record.</li>
              </ol>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  64-Character IRN (Hexadecimal) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={64}
                  value={manualIrn}
                  onChange={(e) => setManualIrn(e.target.value.toLowerCase())}
                  placeholder="e.g. 3b7c89a01f56bcde45678901234567890abcdef1234567890abcdef123456789"
                  className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Length: {manualIrn.length} / 64 characters
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                    IRP Acknowledgement Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualAckNo}
                    onChange={(e) => setManualAckNo(e.target.value)}
                    placeholder="e.g. 112610098765432"
                    className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                    Acknowledgement Date *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualAckDate}
                    onChange={(e) => setManualAckDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-150">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting || manualIrn.length !== 64 || !manualAckNo}
                onClick={handleManualSave}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm cursor-pointer transition"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving IRN...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Manual e-Invoice</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
