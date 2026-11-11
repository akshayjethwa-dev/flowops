// src/components/dispatch/EInvoicePanel.tsx

import React, { useState } from 'react';
import { 
  FileText, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Copy, 
  Printer, 
  RotateCcw, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  Lock,
  Clock,
  XCircle,
  AlertOctagon,
  Eye
} from 'lucide-react';
import { Dispatch, Customer } from '../../types';
import { EInvoiceData, CancelEInvoiceParams } from '../../types/eInvoice';
import { cancelEInvoice } from '../../services/eInvoiceService';
import { downloadEInvoicePdf } from '../../utils/eInvoicePdfGenerator';
import { validateEInvoiceEligibility } from '../../utils/eInvoiceValidator';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface EInvoicePanelProps {
  dispatch: Dispatch;
  customer?: Partial<Customer> | null;
  onOpenGenerateModal: () => void;
  onOpenCreditNoteModal?: () => void;
  onRefreshDispatch?: () => void;
}

export const EInvoicePanel: React.FC<EInvoicePanelProps> = ({
  dispatch,
  customer,
  onOpenGenerateModal,
  onOpenCreditNoteModal,
  onRefreshDispatch
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState<1 | 2 | 3 | 4>(1);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const eInvoice = dispatch.eInvoice;
  const status = eInvoice?.status || dispatch.eInvoiceStatus || 'pending';

  // Check user role permissions (finance, admin, management)
  const userRole = (profile?.role || '').toLowerCase();
  const canManageEInvoice = ['admin', 'finance', 'management', 'super_admin'].includes(userRole);

  // Check pre-flight eligibility for display & tooltips
  const effectiveCustomer: any = customer || {
    name: dispatch.customerName || 'Customer',
    gstin: (dispatch as any).customerGstin || (customer as any)?.gstin || '',
    registrationType: (customer as any)?.registrationType || ((dispatch as any).customerGstin ? 'regular' : 'unregistered')
  };

  const eligibility = validateEInvoiceEligibility(
    effectiveCustomer,
    dispatch.items || [],
    5.5, // Default turnover
    false
  );

  // Calculate hours since generation for 24-hr cancellation limit (EC 6)
  const hoursSinceGeneration = eInvoice?.generatedAt 
    ? (Date.now() - new Date(eInvoice.generatedAt).getTime()) / (1000 * 60 * 60)
    : 0;
  const isWithin24Hours = hoursSinceGeneration <= 24;

  const handleCopyIrn = () => {
    if (!eInvoice?.irn) return;
    navigator.clipboard.writeText(eInvoice.irn);
    toastSuccess('Copied', '64-character IRN copied to clipboard');
  };

  const handlePrintPdf = () => {
    if (!tenant) return;
    downloadEInvoicePdf(
      eInvoice || null,
      dispatch,
      {
        name: tenant.name || 'NexFlow Manufacturing Industries Ltd',
        gstin: tenant.gstin || '27AABCS1429B1ZB',
        address: { street: 'Industrial Estate', city: 'Pune', state: 'Maharashtra', pincode: '411018' }
      },
      effectiveCustomer
    );
  };

  const handleConfirmCancel = async () => {
    if (!tenant?.id || !eInvoice) return;
    if (cancelRemarks.trim().length < 10) {
      toastError('Mandatory Remark', 'Cancellation remarks must be at least 10 characters.');
      return;
    }

    setCancelling(true);
    try {
      const cancelReasonMap: Record<number, string> = {
        1: 'Duplicate',
        2: 'Data Entry Mistake',
        3: 'Order Cancelled',
        4: 'Other'
      };

      await cancelEInvoice(
        tenant.id,
        dispatch.id,
        {
          reasonCode: cancelReasonCode,
          cancelReason: cancelReasonMap[cancelReasonCode],
          remarks: cancelRemarks.trim()
        },
        profile ? {
          userId: profile.uid,
          name: profile.name || profile.email || 'Finance Manager',
          role: profile.role || 'finance'
        } : undefined
      );

      toastSuccess(
        'IRN Cancelled on IRP',
        `Invoice #${dispatch.invoiceNumber} e-Invoice marked cancelled within 24hr window.`
      );
      setShowCancelModal(false);
      if (onRefreshDispatch) onRefreshDispatch();
    } catch (err: any) {
      toastError('Cancellation Failed', err.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl p-5 shadow-2xs space-y-4 font-sans select-none">
      
      {/* Title & Status Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <QrCode className="h-4 w-4 text-indigo-600" />
          <h4 className="text-xs uppercase font-mono font-bold text-slate-600 tracking-wider">
            GST e-Invoice Registry (IRN & QR)
          </h4>
        </div>

        {/* Status Badge */}
        {status === 'generated' && (
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>IRN Active</span>
          </span>
        )}
        {status === 'cancelled' && (
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1">
            <XCircle className="h-3 w-3" />
            <span>IRN Cancelled</span>
          </span>
        )}
        {status === 'e_invoice_failed' && (
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1">
            <AlertCircle className="h-3 w-3" />
            <span>IRP Failed (Retry)</span>
          </span>
        )}
        {status === 'pending' && (
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            e-Invoice Pending
          </span>
        )}
      </div>

      {/* Credit Note Issued Banner (Flow: Stores Credit Note Number + IRN -> Dispatch shows "Credit Note Issued") */}
      {(dispatch.creditNoteIssued || (dispatch as any).lastCreditNoteNumber) && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-rose-900 flex items-center space-x-1.5">
              <RotateCcw className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Credit Note Issued</span>
            </span>
            <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-extrabold uppercase">
              CN Active
            </span>
          </div>
          <div className="text-[11px] text-rose-800 space-y-0.5 font-sans">
            <p><strong>Note Ref:</strong> #{dispatch.lastCreditNoteNumber || 'Issued'}</p>
            {dispatch.lastCreditNoteIrn && (
              <p className="font-mono text-[10px] break-all text-rose-700">
                <strong>CN IRN:</strong> {dispatch.lastCreditNoteIrn}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sales Return Recorded Alert Banner (Acceptance Criteria 1) */}
      {dispatch.salesReturnRecorded && !dispatch.creditNoteIssued && (
        <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Sales Return Recorded on Dispatch</span>
          </div>
          <p className="text-[11px] text-amber-800 font-sans">
            {dispatch.salesReturnReason || 'A sales return was logged for this shipment. Please issue a statutory Credit Note to adjust GST liability and order invoiced quantities.'}
          </p>
          {onOpenCreditNoteModal && (
            <button
              type="button"
              onClick={onOpenCreditNoteModal}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Generate Credit Note</span>
            </button>
          )}
        </div>
      )}

      {/* Case 1: Active e-Invoice Generated */}
      {status === 'generated' && eInvoice && (
        <div className="space-y-3 font-mono text-xs">
          
          {/* IRN display box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
              <span>Invoice Reference Number (IRN)</span>
              <button
                type="button"
                onClick={handleCopyIrn}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 cursor-pointer"
                title="Copy 64-character hash"
              >
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </button>
            </div>
            <p className="font-mono text-[11px] font-bold text-slate-800 break-all select-all bg-white p-2 rounded border border-slate-200">
              {eInvoice.irn}
            </p>
          </div>

          {/* Acknowledgement and Gateway details */}
          <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-150 space-y-0.5">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">IRP Ack Number</span>
              <span className="font-bold text-slate-800 block">{eInvoice.ackNo}</span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-150 space-y-0.5">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Ack Timestamp</span>
              <span className="font-semibold text-slate-700 block">
                {new Date(eInvoice.ackDate).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Signed QR Code Thumbnail + Action bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-3">
              {eInvoice.signedQrCode ? (
                <div 
                  onClick={() => setShowQrModal(true)}
                  className="cursor-pointer group relative border border-slate-300 rounded p-1 bg-white hover:border-indigo-500 transition shadow-3xs"
                  title="Click to enlarge signed QR code"
                >
                  <img 
                    src={eInvoice.signedQrCode} 
                    alt="e-Invoice Signed QR" 
                    className="h-12 w-12 object-contain"
                  />
                  <div className="absolute inset-0 bg-indigo-900/10 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded">
                    <Eye className="h-3.5 w-3.5 text-indigo-700" />
                  </div>
                </div>
              ) : (
                <div className="h-12 w-12 bg-slate-100 rounded border flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-slate-400" />
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold text-slate-800 block font-sans">
                  Digitally Signed by IRP
                </span>
                <span className="text-[9px] text-slate-500 block uppercase">
                  Gateway: {eInvoice.adapter?.toUpperCase() || 'NIC DIRECT'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer shadow-3xs transition"
                title="Print standard GST Tax Invoice with embedded IRP QR Code"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print e-Invoice</span>
              </button>

              {canManageEInvoice && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-2.5 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition"
                  title="Cancel IRN on IRP within 24 hours"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Cancel IRN</span>
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Case 2: e-Invoice Cancelled */}
      {status === 'cancelled' && eInvoice && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="font-bold text-rose-900">Cancelled IRN Hash:</span>
            <span className="text-[10px] text-rose-700">
              {eInvoice.cancelledAt ? new Date(eInvoice.cancelledAt).toLocaleString() : ''}
            </span>
          </div>
          <p className="line-through text-slate-400 text-[11px] break-all select-all">
            {eInvoice.irn}
          </p>
          <div className="text-[11px] text-rose-800 pt-1 font-sans">
            <strong>Reason:</strong> {eInvoice.cancelReason || 'Order Cancelled'} 
            {eInvoice.cancelRemarks && ` (${eInvoice.cancelRemarks})`}
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-2.5 py-1 border border-rose-300 text-rose-800 bg-white hover:bg-rose-100 rounded text-[10px] font-mono font-bold uppercase flex items-center space-x-1 cursor-pointer"
            >
              <Printer className="h-3 w-3" />
              <span>Print Voided Invoice</span>
            </button>
          </div>
        </div>
      )}

      {/* Case 3: Generation Failed (EC 3) */}
      {status === 'e_invoice_failed' && (
        <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2 text-xs">
          <div className="flex items-center space-x-2 text-rose-900 font-bold">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>IRP Transmission Failed</span>
          </div>
          <p className="text-[11px] text-rose-800 leading-tight">
            {eInvoice?.errorMessage || 'NIC IRP Gateway encountered a timeout or format error.'}
          </p>
          {canManageEInvoice && (
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={onOpenGenerateModal}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry Generation</span>
              </button>
              <button
                type="button"
                onClick={onOpenGenerateModal}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 rounded text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
              >
                <span>Manual Portal Fallback (EC 3)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Case 4: Pending / Not Generated */}
      {status === 'pending' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            Generate an official 64-character IRN and digitally signed QR Code directly via GST IRP (NIC / ClearTax / Masters India) to attach to consignment documents.
          </p>

          {/* Validation Warnings for Buttons */}
          {!eligibility.checks.isB2B && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-[11px]">
                <strong>B2C Customer:</strong> e-Invoicing applies to B2B only (EC 5). Standard Tax Invoice available.
              </span>
            </div>
          )}

          {!eligibility.checks.hasValidGstin && eligibility.checks.isB2B && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="text-[11px]">
                <strong>Invalid GSTIN:</strong> Customer GSTIN requires correction before IRP dispatch (EC 1).
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-slate-400">
              Threshold: ₹5 Cr turnover
            </span>

            <div className="flex items-center space-x-2">
              {/* If B2C, offer B2C print */}
              {!eligibility.checks.isB2B && (
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
                  title="Print standard B2C Tax Invoice without IRN"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500" />
                  <span>Print B2C Invoice</span>
                </button>
              )}

              {/* Generate Button (visible to finance / admin / management) */}
              {canManageEInvoice ? (
                <button
                  type="button"
                  onClick={onOpenGenerateModal}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
                  title="Open e-Invoice generator modal"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Generate e-Invoice</span>
                </button>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 italic">
                  (Restricted to Finance & Admin roles)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Enlarged Modal */}
      {showQrModal && eInvoice?.signedQrCode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 font-sans animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
              Digitally Signed GST QR Code
            </h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block">
              <img 
                src={eInvoice.signedQrCode} 
                alt="Enlarged QR Code" 
                className="h-56 w-56 object-contain mx-auto"
              />
            </div>
            <p className="text-[11px] text-slate-500 font-mono break-all">
              Ack No: {eInvoice.ackNo}
            </p>
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold rounded-lg uppercase cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Cancellation Modal with 24-hr Check (EC 6) */}
      {showCancelModal && eInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 font-sans animate-in fade-in zoom-in-95">
            
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Cancel e-Invoice on IRP Portal
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  IRN: {eInvoice.irn.substring(0, 20)}...
                </p>
              </div>
            </div>

            {/* Check 24-hour rule (EC 6) */}
            {isWithin24Hours ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>24-Hour Portal Cancellation Window Active</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-sans">
                    Generated {hoursSinceGeneration.toFixed(1)} hours ago. Government rules permit cancellation on the IRP portal within 24 hours of generation.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                    Cancellation Reason Code *
                  </label>
                  <select
                    value={cancelReasonCode}
                    onChange={(e) => setCancelReasonCode(Number(e.target.value) as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                  >
                    <option value={1}>1 - Duplicate</option>
                    <option value={2}>2 - Data Entry Mistake</option>
                    <option value={3}>3 - Order Cancelled</option>
                    <option value={4}>4 - Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                    Mandatory Cancellation Remarks (min 10 chars) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={cancelRemarks}
                    onChange={(e) => setCancelRemarks(e.target.value)}
                    placeholder="Provide detailed justification for GST audit trail..."
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {cancelRemarks.length} / 10 characters minimum
                  </span>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => setShowCancelModal(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
                  >
                    Keep Active
                  </button>
                  <button
                    type="button"
                    disabled={cancelling || cancelRemarks.trim().length < 10}
                    onClick={handleConfirmCancel}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{cancelling ? 'Calling IRP...' : 'Confirm Cancel IRN'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Case: Beyond 24 hours (EC: Blocked with statutory message) */
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-xl text-rose-900 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    <Lock className="h-5 w-5 text-rose-600 shrink-0" />
                    <span>IRN cancellation window (24h) expired. Generate a credit note instead.</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed font-sans">
                    This e-Invoice was generated <strong>{hoursSinceGeneration.toFixed(1)} hours ago</strong>. Under GST rules, IRN cancellation is strictly restricted to within 24 hours of generation on the IRP.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-rose-200 text-xs font-sans text-slate-800">
                    <strong>Statutory Resolution:</strong> To nullify this invoice or record a return, you must generate a <strong>Credit Note</strong> referencing this IRN.
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
                  >
                    Close
                  </button>
                  {onOpenCreditNoteModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCancelModal(false);
                        onOpenCreditNoteModal();
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Generate Credit Note</span>
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
