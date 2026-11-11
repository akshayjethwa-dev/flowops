// src/components/dispatch/EWayBillPanel.tsx

import React, { useState } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Printer, 
  Copy, 
  Edit3, 
  XCircle, 
  History, 
  Navigation, 
  ShieldCheck, 
  Ban, 
  ArrowRight,
  Eye,
  Calendar,
  Lock
} from 'lucide-react';
import { Dispatch } from '../../types';
import { EWayBillData } from '../../types/ewayBill';
import { EWayBillService, DEFAULT_EWAY_BILL_CONFIG } from '../../services/ewayBillService';
import { downloadEWayBillPdf } from '../../utils/ewayBillPdfGenerator';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { UpdatePartBModal } from './UpdatePartBModal';
import { ExtendEWayBillModal } from './ExtendEWayBillModal';

interface EWayBillPanelProps {
  dispatch: Dispatch;
  onOpenGenerateModal: () => void;
  onRefreshDispatch?: () => void;
}

export const EWayBillPanel: React.FC<EWayBillPanelProps> = ({
  dispatch,
  onOpenGenerateModal,
  onRefreshDispatch
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [showPartBModal, setShowPartBModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Order Cancelled');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showHistoryTab, setShowHistoryTab] = useState<'none' | 'partB' | 'extensions'>('none');

  const ewb: EWayBillData | undefined = dispatch.ewayBill;
  const userRole = (profile?.role || '').toLowerCase();
  const canManageEwb = ['admin', 'dispatch', 'management', 'super_admin', 'store_keeper'].includes(userRole);

  // Pre-flight check
  const validation = EWayBillService.validateEWayBillEligibility(dispatch);

  // Time & Expiration calculation
  let hoursRemaining = 0;
  let isExpired = false;
  let isExpiringSoon = false;
  let hoursSinceGeneration = 0;

  if (ewb) {
    const validUntilTime = new Date(ewb.validUntil).getTime();
    const now = Date.now();
    const diffMs = validUntilTime - now;
    hoursRemaining = diffMs / (1000 * 3600);
    isExpired = hoursRemaining <= 0;
    isExpiringSoon = !isExpired && hoursRemaining <= DEFAULT_EWAY_BILL_CONFIG.autoNotifyExpiryHours;
    hoursSinceGeneration = (now - new Date(ewb.generatedAt).getTime()) / (1000 * 3600);
  }

  const handleCopyEwb = () => {
    if (!ewb?.ewayBillNumber) return;
    navigator.clipboard.writeText(ewb.ewayBillNumber);
    toastSuccess('Copied', '12-digit e-Way Bill number copied to clipboard');
  };

  const handlePrintPdf = () => {
    downloadEWayBillPdf(dispatch, ewb);
  };

  const handleConfirmCancel = async () => {
    if (!tenant?.id || !ewb) return;
    if (!cancelRemarks.trim()) {
      toastError('Mandatory Remark', 'Cancellation remarks are required.');
      return;
    }

    setCancelling(true);
    try {
      await EWayBillService.cancelEWayBill(
        tenant.id,
        dispatch.id,
        cancelReason,
        cancelRemarks.trim(),
        profile ? {
          userId: profile.uid,
          name: profile.name || profile.email || 'Dispatch Supervisor',
          role: profile.role || 'dispatch'
        } : undefined
      );

      toastSuccess(
        'e-Way Bill Cancelled',
        `EWB #${ewb.ewayBillNumber} marked cancelled on portal within 24hr statutory window.`
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
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Truck className="h-4 w-4 text-indigo-600" />
          <h4 className="text-xs uppercase font-mono font-bold text-slate-600 tracking-wider">
            GST e-Way Bill Registry (Transit Permit)
          </h4>
        </div>

        {/* Status Badge */}
        {ewb ? (
          ewb.status === 'cancelled' ? (
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-300 flex items-center space-x-1">
              <Ban className="h-3 w-3" />
              <span>Cancelled in 24H</span>
            </span>
          ) : isExpired || ewb.status === 'expired' ? (
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1 animate-pulse">
              <AlertCircle className="h-3 w-3" />
              <span>Expired (Extend Required)</span>
            </span>
          ) : isExpiringSoon || ewb.status === 'expiring_soon' ? (
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>Expiring Soon (&lt;4h)</span>
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Active on Portal</span>
            </span>
          )
        ) : (
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            e-Way Bill Pending
          </span>
        )}
      </div>

      {/* Case 1: Active or Generated e-Way Bill */}
      {ewb && (
        <div className="space-y-3 font-mono text-xs">
          
          {/* EWB Number & Copy */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
              <span>12-Digit E-Way Bill Number</span>
              <button
                type="button"
                onClick={handleCopyEwb}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 cursor-pointer"
                title="Copy EWB Number"
              >
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </button>
            </div>
            <p className="font-mono text-base font-black text-indigo-950 tracking-wider">
              {ewb.ewayBillNumber}
            </p>
          </div>

          {/* Validity & Time Remaining */}
          <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
            <div className={`p-2.5 rounded border space-y-0.5 ${
              isExpired ? 'bg-rose-50 border-rose-200' : isExpiringSoon ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-150'
            }`}>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Valid Until</span>
              <span className={`font-bold block ${isExpired ? 'text-rose-800' : isExpiringSoon ? 'text-amber-800' : 'text-slate-800'}`}>
                {new Date(ewb.validUntil).toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-500 block font-sans">
                {isExpired 
                  ? 'Expired mid-transit. Extend validity below.' 
                  : `${Math.floor(hoursRemaining / 24)}d ${Math.floor(hoursRemaining % 24)}h remaining`}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-150 space-y-0.5">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Vehicle & Carrier</span>
              <span className="font-bold text-slate-800 uppercase block">{ewb.vehicleNumber}</span>
              <span className="text-[9px] text-slate-500 block truncate" title={ewb.transporterName}>
                {ewb.transporterName} ({ewb.distanceKm} KM)
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer shadow-3xs transition"
                title="Print Form GST EWB-01 slip"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Slip</span>
              </button>

              {/* Part B Update (EC 5) */}
              {canManageEwb && ewb.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setShowPartBModal(true)}
                  className="px-2.5 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition"
                  title="Vehicle change mid-transit (Part B update)"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Update Vehicle</span>
                </button>
              )}

              {/* Validity Extension (EC 4) */}
              {canManageEwb && ewb.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setShowExtendModal(true)}
                  className={`px-2.5 py-1.5 border rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition ${
                    isExpired || isExpiringSoon 
                      ? 'bg-amber-600 text-white hover:bg-amber-700 border-amber-600 shadow-3xs' 
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                  title="Extend validity if delayed mid-transit"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Extend Validity</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-1.5">
              {/* History Toggles */}
              {ewb.partBHistory && ewb.partBHistory.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowHistoryTab(showHistoryTab === 'partB' ? 'none' : 'partB')}
                  className="px-2 py-1 text-[9px] font-mono text-slate-500 hover:text-slate-800 border rounded cursor-pointer"
                  title="View vehicle change history"
                >
                  <History className="h-3 w-3 inline mr-1" />
                  <span>{ewb.partBHistory.length} Legs</span>
                </button>
              )}

              {/* Cancel Button (within 24 hours) */}
              {canManageEwb && ewb.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded cursor-pointer"
                  title="Cancel E-Way Bill (within 24 hours of generation)"
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Part B Multi-leg Vehicle History View (EC 5) */}
          {showHistoryTab === 'partB' && ewb.partBHistory && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 mt-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Part-B Multi-leg Vehicle Change Trail:
              </span>
              <div className="space-y-1.5 font-mono text-[10px]">
                {ewb.partBHistory.map((h, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                    <div>
                      <strong className="text-slate-800 uppercase">{h.vehicleNumber}</strong>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-600">{h.fromPlace}, {h.fromState}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5">{h.reasonDescription}</span>
                    </div>
                    <span className="text-[9px] text-slate-400">
                      {new Date(h.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Case 2: Not Yet Generated */}
      {!ewb && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            Generate an official 12-digit Indian GST e-Way Bill permit directly from this dispatch slip. Transit permits are legally mandatory for inter-state and intra-state commercial goods conveyance above ₹50,000.
          </p>

          {/* EC 1: Value below ₹50,000 notice */}
          {!validation.checks.thresholdExceeded && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-[11px]">
                <strong>Threshold Exemption:</strong> e-Way Bill not required below ₹50,000 (Consignment value: ₹{validation.dispatchValue.toLocaleString('en-IN')}).
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-slate-400">
              Threshold: ₹50,000
            </span>

            {canManageEwb ? (
              <button
                type="button"
                onClick={onOpenGenerateModal}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
                title="Open e-Way Bill generator modal"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Generate e-Way Bill</span>
              </button>
            ) : (
              <span className="text-[10px] font-mono text-slate-400 italic">
                (Restricted to Dispatch & Admin roles)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Part B Update Modal (EC 5) */}
      {showPartBModal && ewb && (
        <UpdatePartBModal
          isOpen={showPartBModal}
          onClose={() => setShowPartBModal(false)}
          dispatch={dispatch}
          onSuccess={(updated) => {
            if (onRefreshDispatch) onRefreshDispatch();
          }}
        />
      )}

      {/* Validity Extension Modal (EC 4) */}
      {showExtendModal && ewb && (
        <ExtendEWayBillModal
          isOpen={showExtendModal}
          onClose={() => setShowExtendModal(false)}
          dispatch={dispatch}
          onSuccess={(updated) => {
            if (onRefreshDispatch) onRefreshDispatch();
          }}
        />
      )}

      {/* Cancellation Modal (within 24 hours) */}
      {showCancelModal && ewb && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 font-sans animate-in fade-in zoom-in-95">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <Ban className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Cancel e-Way Bill on Portal
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  EWB No: {ewb.ewayBillNumber}
                </p>
              </div>
            </div>

            {hoursSinceGeneration <= 24 ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                  <span className="font-bold block">24-Hour Portal Cancellation Window Active:</span>
                  <p className="text-[11px] text-amber-800 font-sans">
                    Generated {hoursSinceGeneration.toFixed(1)} hours ago. Government rules permit e-Way Bill cancellation within 24 hours of generation if vehicle has not embarked.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                    Cancellation Reason *
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                  >
                    <option value="Duplicate">1 - Duplicate E-Way Bill</option>
                    <option value="Order Cancelled">2 - Order Cancelled by Client</option>
                    <option value="Data Entry Error">3 - Data Entry Error in Dispatch</option>
                    <option value="Other">4 - Other Operational Reasons</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                    Audit Justification Remarks *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={cancelRemarks}
                    onChange={(e) => setCancelRemarks(e.target.value)}
                    placeholder="Provide justification for cancelling transit permit..."
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                  />
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
                    disabled={cancelling || !cancelRemarks.trim()}
                    onClick={handleConfirmCancel}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span>{cancelling ? 'Calling Portal...' : 'Confirm Cancel EWB'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 space-y-2">
                  <div className="flex items-center space-x-2 font-bold">
                    <Lock className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>24-Hour Portal Cancellation Period Expired</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-sans">
                    This e-Way Bill was generated {hoursSinceGeneration.toFixed(1)} hours ago. Under GST Rule 138(9), e-Way Bills cannot be cancelled on the portal after 24 hours of generation.
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold uppercase cursor-pointer"
                  >
                    Understood
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
