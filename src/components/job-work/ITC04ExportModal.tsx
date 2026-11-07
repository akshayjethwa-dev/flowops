// src/components/job-work/ITC04ExportModal.tsx

import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Calendar, 
  Layers, 
  Clock, 
  Printer, 
  Edit3, 
  RefreshCw,
  Info,
  HelpCircle,
  FileCheck,
  Briefcase
} from 'lucide-react';
import { 
  JobWorkGatePass, 
  JobWorkGRN, 
  ITC04Quarter, 
  ITC04FilingMode, 
  ITC04ReportSummary, 
  ITC04Table4Entry 
} from '../../types/jobWork';
import { 
  generateITC04Summary, 
  downloadITC04Json, 
  downloadITC04Excel, 
  updateJobWorkerGstin,
  validateIndianGstin
} from '../../services/itc04Service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface ITC04ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  gatePasses: JobWorkGatePass[];
  grns: JobWorkGRN[];
  onGatePassUpdated?: () => void;
}

export const ITC04ExportModal: React.FC<ITC04ExportModalProps> = ({
  isOpen,
  onClose,
  gatePasses,
  grns,
  onGatePassUpdated
}) => {
  const { tenant, user, isSandboxMode } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  // Selected quarter and financial year (Default: Q3 FY2026-27 per user flow)
  const [selectedQuarter, setSelectedQuarter] = useState<ITC04Quarter>('Q3');
  const [financialYear, setFinancialYear] = useState<string>('2026-2027');
  const [filingMode, setFilingMode] = useState<ITC04FilingMode>('principal');
  const [principalGstin, setPrincipalGstin] = useState<string>(tenant?.gstin || '27AAACF1234F1Z5');
  const [activeTab, setActiveTab] = useState<'summary' | 'table4' | 'table5a' | 'audit'>('summary');
  const [tableSearch, setTableSearch] = useState<string>('');

  // Inline GSTIN correction modal state (EC 2)
  const [editingGstinRecord, setEditingGstinRecord] = useState<ITC04Table4Entry | null>(null);
  const [newGstinInput, setNewGstinInput] = useState<string>('');
  const [savingGstin, setSavingGstin] = useState<boolean>(false);

  // Compute live ITC-04 Summary
  const summary: ITC04ReportSummary = useMemo(() => {
    return generateITC04Summary(
      gatePasses,
      grns,
      selectedQuarter,
      financialYear,
      filingMode,
      principalGstin
    );
  }, [gatePasses, grns, selectedQuarter, financialYear, filingMode, principalGstin]);

  if (!isOpen) return null;

  // Filter Table 4 records
  const filteredTable4 = summary.table4.filter(t => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      t.gatePassNumber.toLowerCase().includes(q) ||
      t.jobWorkerName.toLowerCase().includes(q) ||
      t.jobWorkerGstin.toLowerCase().includes(q) ||
      t.materialDescription.toLowerCase().includes(q) ||
      t.materialCode.toLowerCase().includes(q)
    );
  });

  // Filter Table 5A records
  const filteredTable5A = summary.table5A.filter(t => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      t.inwardGatePassNumber.toLowerCase().includes(q) ||
      t.originalChallanNumber.toLowerCase().includes(q) ||
      t.jobWorkerName.toLowerCase().includes(q) ||
      t.jobWorkerGstin.toLowerCase().includes(q) ||
      t.materialDescription.toLowerCase().includes(q) ||
      (t.grnNumber && t.grnNumber.toLowerCase().includes(q))
    );
  });

  // Handler for JSON export
  const handleDownloadJson = () => {
    if (!summary.canExport) {
      toastError(`Export blocked: ${summary.invalidGstinCount} Job Worker(s) have invalid or missing GSTINs.`);
      return;
    }
    try {
      downloadITC04Json(summary);
      toastSuccess(`ITC-04 JSON generated for ${summary.periodLabel}! File ready for GST Portal upload.`);
    } catch (e: any) {
      toastError('Failed to generate ITC-04 JSON: ' + e.message);
    }
  };

  // Handler for Excel export
  const handleDownloadExcel = () => {
    if (!summary.canExport) {
      toastError(`Export blocked: ${summary.invalidGstinCount} Job Worker(s) have invalid or missing GSTINs.`);
      return;
    }
    try {
      downloadITC04Excel(summary);
      toastSuccess(`ITC-04 Excel workbook generated for ${summary.periodLabel}!`);
    } catch (e: any) {
      toastError('Failed to generate Excel file: ' + e.message);
    }
  };

  // Open inline GSTIN edit modal (EC 2)
  const handleOpenEditGstin = (record: ITC04Table4Entry) => {
    setEditingGstinRecord(record);
    setNewGstinInput(record.jobWorkerGstin && record.jobWorkerGstin !== 'PENDING' ? record.jobWorkerGstin : '27AABCT9981K1Z3');
  };

  // Save corrected GSTIN (EC 2)
  const handleSaveGstin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGstinRecord || !tenant?.id) return;

    const val = validateIndianGstin(newGstinInput);
    if (!val.isValid) {
      toastError(val.error || 'Invalid GSTIN');
      return;
    }

    setSavingGstin(true);
    try {
      await updateJobWorkerGstin(
        tenant.id,
        editingGstinRecord.jobWorkerId,
        newGstinInput.trim().toUpperCase(),
        editingGstinRecord.gatePassId,
        isSandboxMode
      );
      toastSuccess(`GSTIN for ${editingGstinRecord.jobWorkerName} updated to ${newGstinInput.trim().toUpperCase()}!`);
      setEditingGstinRecord(null);
      if (onGatePassUpdated) {
        onGatePassUpdated();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update GSTIN');
    } finally {
      setSavingGstin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Form GST ITC-04 Data Export</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                  Section 143 & Rule 45
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                  GST Portal Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate statutory quarterly job-work statement with Table 4 (Inputs Sent) and Table 5A (Goods Received Back).
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Scrollable Area */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Top Control Panel: Dual-Role Switcher (EC 3) & Period Selectors */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            
            {/* EC 3: Dual-Role Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>GST Filing Role (Dual-Role Scenario Support)</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Select your tax profile for this return filing.
                </span>
              </div>

              <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilingMode('principal')}
                  className={`px-3.5 py-1.5 rounded-lg transition-all ${
                    filingMode === 'principal'
                      ? 'bg-white text-indigo-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  As Principal (Dispatch Own Stock)
                </button>
                <button
                  type="button"
                  onClick={() => setFilingMode('job_worker')}
                  className={`px-3.5 py-1.5 rounded-lg transition-all ${
                    filingMode === 'job_worker'
                      ? 'bg-white text-indigo-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  As Job Worker (Customer Free-Issue)
                </button>
              </div>
            </div>

            {/* Quarter, Financial Year & Principal GSTIN Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              
              {/* Quarter */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                  Quarter *
                </label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value as ITC04Quarter)}
                  className="w-full font-bold rounded-lg border-slate-300 py-1.5 px-2.5 text-slate-900 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="Q3">Q3 (Oct - Dec 2026)</option>
                  <option value="Q2">Q2 (Jul - Sep 2026)</option>
                  <option value="Q1">Q1 (Apr - Jun 2026)</option>
                  <option value="Q4">Q4 (Jan - Mar 2027)</option>
                </select>
              </div>

              {/* Financial Year */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                  Financial Year *
                </label>
                <select
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                  className="w-full font-bold rounded-lg border-slate-300 py-1.5 px-2.5 text-slate-900 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="2026-2027">FY 2026-27</option>
                  <option value="2025-2026">FY 2025-26</option>
                </select>
              </div>

              {/* Principal GSTIN */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                  Your Company GSTIN *
                </label>
                <input
                  type="text"
                  value={principalGstin}
                  onChange={(e) => setPrincipalGstin(e.target.value.toUpperCase())}
                  className="w-full font-mono font-bold rounded-lg border-slate-300 py-1.5 px-2.5 text-slate-900 focus:ring-indigo-500 uppercase bg-white"
                  placeholder="27AAACF1234F1Z5"
                />
              </div>

              {/* Period Quick Info */}
              <div className="flex flex-col justify-end">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">GST Return Utility Code</span>
                <span className="font-mono font-bold text-indigo-900 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-200">
                  {summary.periodLabel}
                </span>
              </div>

            </div>

          </div>

          {/* Real-time Reconciliation Summary Strip (Acceptance Criteria & User Flow) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            
            {/* Outward Passes */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Outward Challans
              </span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                {summary.totalOutwardPasses} Outward
              </div>
              <span className="text-[11px] text-slate-500">Inputs sent for job work</span>
            </div>

            {/* Returned Back */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Returned Back
              </span>
              <div className="text-xl font-black text-emerald-800 font-mono mt-0.5">
                {summary.totalReturnedPasses} Returned
              </div>
              <span className="text-[11px] text-emerald-700">Reconciled in Table 5A</span>
            </div>

            {/* Pending Return (EC 1) */}
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                Pending Return
              </span>
              <div className="text-xl font-black text-amber-800 font-mono mt-0.5">
                {summary.totalPendingPasses} Pending
              </div>
              <span className="text-[11px] text-amber-700">Sent, Not Yet Returned</span>
            </div>

            {/* Total Taxable Value */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Taxable Value
              </span>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                ₹{summary.totalTaxableValue.toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-500">Dispatched materials</span>
            </div>

            {/* Compliance Status (EC 2) */}
            <div className={`p-3.5 rounded-xl border shadow-sm ${
              summary.canExport 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block">
                GSTIN Validation
              </span>
              <div className="text-sm font-black font-sans mt-1 flex items-center gap-1.5">
                {summary.canExport ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>All Valid & Clear</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>{summary.invalidGstinCount} Invalid GSTIN</span>
                  </>
                )}
              </div>
              <span className="text-[10px] block mt-0.5 opacity-80">
                {summary.canExport ? 'Ready for GST upload' : 'Export blocked until fixed'}
              </span>
            </div>

          </div>

          {/* EC 2: Blocking Error Banner if Invalid GSTIN Detected */}
          {!summary.canExport && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-3 text-xs text-rose-950">
              <div className="p-1.5 bg-rose-200/60 rounded-lg text-rose-700 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <span>Export Blocked: Invalid or Missing Job Worker GSTIN Detected (Edge Case 2)</span>
                </div>
                <p className="text-rose-800">
                  The GST Portal rejects ITC-04 JSON files containing invalid GSTIN formats. The system has blocked export for {summary.invalidGstinCount} record(s).
                </p>
                <div className="text-[11px] font-mono text-rose-700 bg-white/70 p-2 rounded border border-rose-200">
                  {summary.blockingErrors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
                <p className="text-[11px] text-rose-900 font-semibold">
                  👉 Go to Table 4 below and click the orange "Correct GSTIN" button to enter the 15-character GSTIN and immediately unblock export.
                </p>
              </div>
            </div>
          )}

          {/* EC 1: Warning Banner for Open Gate Passes */}
          {summary.totalPendingPasses > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-950">
              <div className="p-1.5 bg-amber-200/60 rounded-lg text-amber-700 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-amber-900">
                  Open Challans Detected ({summary.totalPendingPasses} Pending Return - Edge Case 1)
                </div>
                <p className="text-amber-800 mt-0.5">
                  As required by GST law, open outward gate passes where materials have physically left the factory but not yet been returned are included in Table 4 flagged as <strong>"Sent, Not Yet Returned"</strong>.
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5 italic">
                  Note: Inputs must be returned within 1 year and capital goods within 3 years of dispatch date.
                </p>
              </div>
            </div>
          )}

          {/* Tables Tab Navigation */}
          <div className="border-b border-slate-200 flex items-center justify-between">
            <div className="flex space-x-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'summary'
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>Reconciliation Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('table4')}
                className={`py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'table4'
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Table 4 (Inputs Sent to Job Workers)</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                  {summary.table4.length}
                </span>
                {!summary.canExport && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('table5a')}
                className={`py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'table5a'
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Table 5A (Goods Received Back)</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                  {summary.table5A.length}
                </span>
              </button>
            </div>

            {/* Search Input for tables */}
            {activeTab !== 'summary' && (
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search challan, vendor, material..."
                className="text-xs rounded-lg border-slate-300 py-1 px-2.5 w-60"
              />
            )}
          </div>

          {/* TAB 1: Reconciliation Overview */}
          {activeTab === 'summary' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Statement Specifications */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                    Statutory Filing Parameters
                  </span>
                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Return Form:</span>
                      <strong className="text-slate-900 font-mono">FORM GST ITC-04</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Applicable Section:</span>
                      <span>Section 143(1) of CGST Act, 2017</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">GST Rule:</span>
                      <span>Rule 45 of CGST Rules, 2017</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Filing Period:</span>
                      <strong className="text-slate-900 font-mono">{summary.periodLabel}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Principal Taxpayer GSTIN:</span>
                      <strong className="text-slate-900 font-mono">{summary.principalGstin}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Role Mode:</span>
                      <span className="capitalize font-semibold text-indigo-700">
                        {summary.filingMode === 'principal' ? 'Principal Manufacturer' : 'Job Worker Subcontractor'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit Reconciliation Checklist */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                    Pre-Export Audit Checklist
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Rule 45 Delivery Challan numbers verified and deduplicated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>UQC Standardized to GST dictionary (KGS, TON, NOS, MTR)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Inward returns reconciled against original outward gate passes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {summary.canExport ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      )}
                      <span>
                        {summary.canExport 
                          ? 'Job Worker 15-character GSTINs validated' 
                          : `${summary.invalidGstinCount} Job Worker GSTIN(s) require correction`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {summary.totalPendingPasses > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                      <span>
                        {summary.totalPendingPasses > 0 
                          ? `${summary.totalPendingPasses} open pass(es) flagged as "Sent, Not Yet Returned"`
                          : 'All gate passes for quarter 100% returned and closed'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Warnings List */}
              {summary.warnings.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-800 text-[11px] block uppercase">
                    Audit Notices ({summary.warnings.length}):
                  </span>
                  {summary.warnings.map((w, idx) => (
                    <div key={idx} className="text-slate-600 flex items-start gap-1.5 text-[11px]">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Table 4 (Inputs Sent for Job Work) */}
          {activeTab === 'table4' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Challan No & Date</th>
                      <th className="px-3 py-2.5">Job Worker (Vendor)</th>
                      <th className="px-3 py-2.5">GSTIN</th>
                      <th className="px-3 py-2.5">Material Description</th>
                      <th className="px-3 py-2.5 text-center">UQC</th>
                      <th className="px-3 py-2.5 text-right">Sent Qty</th>
                      <th className="px-3 py-2.5 text-right">Taxable Value</th>
                      <th className="px-3 py-2.5">Nature of Work</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {filteredTable4.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-500 font-sans">
                          No outward gate passes found for this quarter.
                        </td>
                      </tr>
                    ) : (
                      filteredTable4.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          
                          {/* Challan No & Date */}
                          <td className="px-3 py-2.5 font-bold text-indigo-950 whitespace-nowrap">
                            <div>{row.gatePassNumber}</div>
                            <span className="text-[10px] text-slate-500 font-sans font-normal">{row.challanDate}</span>
                          </td>

                          {/* Job Worker */}
                          <td className="px-3 py-2.5 font-sans font-bold text-slate-900">
                            <div>{row.jobWorkerName}</div>
                            <span className="text-[10px] text-slate-500 font-mono">State: {row.stateCode}</span>
                          </td>

                          {/* GSTIN (EC 2 Highlight) */}
                          <td className="px-3 py-2.5">
                            {row.isValidGstin ? (
                              <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                {row.jobWorkerGstin}
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <span className="font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 block w-max">
                                  {row.jobWorkerGstin || 'MISSING'}
                                </span>
                                <span className="text-[10px] text-rose-600 font-sans font-semibold block">
                                  ⚠️ Invalid GSTIN
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Material Description */}
                          <td className="px-3 py-2.5 font-sans">
                            <span className="font-semibold text-slate-900 block">{row.materialDescription}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Code: {row.materialCode}</span>
                          </td>

                          {/* UQC */}
                          <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                            {row.uqc}
                          </td>

                          {/* Sent Qty */}
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                            {row.quantitySent.toLocaleString()}
                          </td>

                          {/* Taxable Value */}
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                            ₹{row.taxableValue.toLocaleString('en-IN')}
                          </td>

                          {/* Nature of Work */}
                          <td className="px-3 py-2.5 font-sans text-slate-700 max-w-[130px] truncate" title={row.natureOfJobWork}>
                            {row.natureOfJobWork}
                          </td>

                          {/* Status Badge */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap font-sans">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.returnStatus === 'fully_returned'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : row.returnStatus === 'partially_returned'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {row.returnStatus === 'fully_returned' ? 'Returned' : row.returnStatus === 'partially_returned' ? 'Partial' : 'Open (Pending)'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap font-sans">
                            {!row.isValidGstin ? (
                              <button
                                type="button"
                                onClick={() => handleOpenEditGstin(row)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-sm inline-flex items-center gap-1 transition-colors"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Correct GSTIN</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenEditGstin(row)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                title="Edit GSTIN"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Table 5A (Goods Received Back) */}
          {activeTab === 'table5a' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Inward GP No & Date</th>
                      <th className="px-3 py-2.5">Original Outward Challan</th>
                      <th className="px-3 py-2.5">Job Worker & GSTIN</th>
                      <th className="px-3 py-2.5">Material Description</th>
                      <th className="px-3 py-2.5 text-center">UQC</th>
                      <th className="px-3 py-2.5 text-right text-emerald-800">Qty Received</th>
                      <th className="px-3 py-2.5 text-right text-rose-800">Qty Rejected</th>
                      <th className="px-3 py-2.5">GRN Ref</th>
                      <th className="px-3 py-2.5">Nature of Work</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {filteredTable5A.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500 font-sans">
                          No inward return entries recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      filteredTable5A.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-emerald-950 whitespace-nowrap">
                            <div>{row.inwardGatePassNumber}</div>
                            <span className="text-[10px] text-slate-500 font-sans font-normal">{row.inwardReceiptDate}</span>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-indigo-950 whitespace-nowrap">
                            <div>{row.originalChallanNumber}</div>
                            <span className="text-[10px] text-slate-500 font-sans font-normal">{row.originalChallanDate}</span>
                          </td>
                          <td className="px-3 py-2.5 font-sans font-bold text-slate-900">
                            <div>{row.jobWorkerName}</div>
                            <span className="text-[10px] text-slate-500 font-mono">{row.jobWorkerGstin}</span>
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            <span className="font-semibold text-slate-900 block">{row.materialDescription}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Code: {row.materialCode}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                            {row.uqc}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-emerald-700">
                            +{row.quantityReceived.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-700">
                            {row.quantityRejected > 0 ? row.quantityRejected.toLocaleString() : '0'}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-800">
                            {row.grnNumber || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-sans text-slate-600 max-w-[140px] truncate" title={row.natureOfJobWork}>
                            {row.natureOfJobWork}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {summary.canExport 
                ? 'Pre-validation successful. Data is verified and ready for GST Portal offline utility.' 
                : 'Correction required: resolve invalid/missing GSTINs to enable upload files.'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>

            {/* Excel Export Button */}
            <button
              type="button"
              disabled={!summary.canExport}
              onClick={handleDownloadExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
              title={!summary.canExport ? 'Export blocked due to invalid GSTINs' : 'Download Excel ITC-04 Workbook'}
            >
              <Download className="w-4 h-4" />
              <span>Download Excel (.xlsx)</span>
            </button>

            {/* Primary JSON Download Button (Acceptance Criteria) */}
            <button
              type="button"
              disabled={!summary.canExport}
              onClick={handleDownloadJson}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md hover:shadow flex items-center gap-2 transition-all"
              title={!summary.canExport ? 'Export blocked due to invalid GSTINs' : 'Download GST Offline Tool JSON'}
            >
              <Download className="w-4 h-4" />
              <span>Download JSON (GST Portal)</span>
            </button>
          </div>

        </div>

        {/* INLINE GSTIN CORRECTION MODAL (Edge Case 2) */}
        {editingGstinRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  <span>Correct Job Worker GSTIN (EC 2)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingGstinRecord(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveGstin} className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Job Worker:</span>
                  <div className="font-bold text-slate-900 text-sm">{editingGstinRecord.jobWorkerName}</div>
                  <span className="text-[11px] text-slate-500">Challan: {editingGstinRecord.gatePassNumber}</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1">
                    Enter Valid 15-Digit GSTIN *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={newGstinInput}
                    onChange={(e) => setNewGstinInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 27AABCT9981K1Z3"
                    className="w-full font-mono font-bold text-sm rounded-lg border-slate-300 py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 uppercase tracking-widest bg-slate-50"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="text-slate-500">{newGstinInput.length}/15 characters</span>
                    <button
                      type="button"
                      onClick={() => setNewGstinInput('27AABCT9981K1Z3')}
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      Fill Valid Demo GSTIN
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-indigo-900 text-[11px] space-y-1">
                  <strong>Indian GSTIN Structure:</strong>
                  <div>• Digits 1-2: State Code (e.g. 27 for Maharashtra, 29 for Karnataka)</div>
                  <div>• Characters 3-12: Permanent Account Number (PAN)</div>
                  <div>• Character 13: Entity Code (1-9 or A-Z)</div>
                  <div>• Character 14: Default 'Z'</div>
                  <div>• Character 15: Alphanumeric Checksum</div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingGstinRecord(null)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingGstin || newGstinInput.length !== 15}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-bold shadow"
                  >
                    {savingGstin ? 'Saving...' : 'Update & Verify GSTIN'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
