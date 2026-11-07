// src/components/job-work/ShortCloseGatePassModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck2, 
  PackageMinus 
} from 'lucide-react';
import { JobWorkGatePass } from '../../types/jobWork';
import { shortCloseGatePass } from '../../services/jobWorkService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface ShortCloseGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  gatePass: JobWorkGatePass | null;
  onShortClosed: (updatedPass: JobWorkGatePass) => void;
}

export const ShortCloseGatePassModal: React.FC<ShortCloseGatePassModalProps> = ({
  isOpen,
  onClose,
  gatePass,
  onShortClosed
}) => {
  const { tenant, user, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !gatePass) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toastError('Please provide a short-close reason.');
      return;
    }

    if (!tenant?.id || !user) {
      toastError('Session expired. Please log in.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await shortCloseGatePass(
        tenant.id,
        gatePass.id,
        reason.trim(),
        user,
        isSandboxMode
      );

      toastSuccess(`Gate Pass ${gatePass.gatePassNumber} short-closed successfully. Remaining vendor balance cleared.`);
      onShortClosed(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to short-close gate pass:', err);
      toastError(err.message || 'Failed to short-close gate pass.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate unreturned balance
  const remainingBalances = gatePass.items.map(it => ({
    name: it.materialName,
    code: it.materialCode,
    balance: it.balanceWithVendor || 0,
    uom: it.uom
  })).filter(x => x.balance > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-amber-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 border border-amber-400/30 rounded-lg text-amber-300">
              <PackageMinus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Short-Close Gate Pass</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-900/80 text-amber-200">
                  {gatePass.gatePassNumber}
                </span>
              </h3>
              <p className="text-xs text-amber-300">Write off remaining balance (Scrap / Process Loss)</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-amber-300 hover:text-white rounded-lg hover:bg-amber-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Remaining Balance to be Cleared from Vendor Stock:
            </div>
            <div className="space-y-1 pl-1">
              {remainingBalances.length > 0 ? (
                remainingBalances.map((b, i) => (
                  <div key={i} className="flex justify-between font-mono">
                    <span>{b.name} ({b.code}):</span>
                    <span className="font-bold text-amber-950">{b.balance} {b.uom}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">No remaining balance detected.</div>
              )}
            </div>
            <p className="text-[11px] text-amber-700 pt-1 border-t border-amber-200">
              Short-closing sets the gate pass status to <strong>short_closed</strong> and writes off the pending quantity from <strong>{gatePass.jobWorkerName}</strong>'s stock ledger.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Short-Close Reason / Approved Variance Justification *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Yield burning loss 12 Kg during heat treatment verified by metallurgy QA report; balance retained by vendor as agreed scrap allowance."
              className="w-full text-sm rounded-lg border-slate-300 focus:border-amber-500 focus:ring-amber-500 py-2 px-3"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2 transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Short-Closing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Short-Close
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
