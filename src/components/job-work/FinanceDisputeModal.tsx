// src/components/job-work/FinanceDisputeModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  IndianRupee, 
  FileText,
  Building2,
  Lock
} from 'lucide-react';
import { JobWorkGRN } from '../../types/jobWork';
import { resolveProcessingChargeDispute } from '../../services/jobWorkService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface FinanceDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  grn: JobWorkGRN | null;
  onResolved: (updatedGrn: JobWorkGRN) => void;
}

export const FinanceDisputeModal: React.FC<FinanceDisputeModalProps> = ({
  isOpen,
  onClose,
  grn,
  onResolved
}) => {
  const { tenant, user, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [resolutionStatus, setResolutionStatus] = useState<'approved' | 'settled'>('settled');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [adjustedAmount, setAdjustedAmount] = useState<number>(grn?.processingCharges || 0);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen || !grn) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant?.id || !user) {
      toastError('Session expired. Please log in.');
      return;
    }

    if (!resolutionNotes.trim()) {
      toastError('Please provide finance resolution notes explaining the decision.');
      return;
    }

    setSubmitting(true);
    try {
      const notesWithAdjustment = resolutionStatus === 'settled' && adjustedAmount !== grn.processingCharges
        ? `${resolutionNotes.trim()} [Adjusted Payout: ₹${adjustedAmount.toLocaleString('en-IN')}]`
        : resolutionNotes.trim();

      const updated = await resolveProcessingChargeDispute(
        tenant.id,
        grn.id,
        resolutionStatus,
        notesWithAdjustment,
        user,
        isSandboxMode
      );

      toastSuccess(`Dispute on ${grn.grnNumber} cleared and status marked as ${resolutionStatus}!`);
      onResolved(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to resolve dispute:', err);
      toastError(err.message || 'Failed to update dispute status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-amber-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Finance Dispute Review</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-900 text-amber-200 border border-amber-700">
                  {grn.grnNumber}
                </span>
              </div>
              <p className="text-xs text-amber-300">
                Review and approve or settle disputed processing charges before payment release.
              </p>
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

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Dispute Context */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center text-slate-700">
              <span className="font-semibold">Vendor:</span>
              <span className="font-bold text-slate-900">{grn.jobWorkerName}</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span className="font-semibold">Billed Charges:</span>
              <span className="font-mono font-bold text-slate-900">₹{grn.processingCharges.toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-2 border-t border-amber-200/60">
              <span className="text-amber-900 font-bold block mb-0.5">Stores Flag Reason:</span>
              <p className="text-amber-950 italic bg-white/70 p-2 rounded border border-amber-200">
                "{grn.disputeReason || 'Processing rate or rejected quantity deduction dispute'}"
              </p>
            </div>
          </div>

          {/* Action Decision */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              Finance Resolution *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                resolutionStatus === 'settled'
                  ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="resStatus"
                  value="settled"
                  checked={resolutionStatus === 'settled'}
                  onChange={() => setResolutionStatus('settled')}
                  className="mr-2 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-bold text-slate-900">Settle with Adjustment</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Issue debit note or negotiate adjusted invoice amount.</p>
              </label>

              <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                resolutionStatus === 'approved'
                  ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="resStatus"
                  value="approved"
                  checked={resolutionStatus === 'approved'}
                  onChange={() => setResolutionStatus('approved')}
                  className="mr-2 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-bold text-slate-900">Approve as Billed</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Authorize payment for full billed amount of ₹{grn.processingCharges.toLocaleString('en-IN')}.</p>
              </label>
            </div>
          </div>

          {/* Adjusted Amount if settled */}
          {resolutionStatus === 'settled' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Final Agreed Payable Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={adjustedAmount}
                  onChange={(e) => setAdjustedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-bold rounded-lg border-slate-300 pl-7 pr-3 py-1.5 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Resolution Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Finance Resolution Notes / Debit Note No *
            </label>
            <textarea
              required
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g. Discussed with Vendor XYZ; agreed to deduct ₹1,000 for 20 Kg rejected material. Net approved ₹4,000 against Debit Note DN-2026-08."
              className="w-full text-xs rounded-lg border-slate-300 p-2.5 focus:ring-indigo-500"
            />
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
            >
              {submitting ? 'Resolving...' : 'Authorize & Clear Dispute'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
