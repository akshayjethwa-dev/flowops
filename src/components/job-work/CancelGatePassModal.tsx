// src/components/job-work/CancelGatePassModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight,
  Info
} from 'lucide-react';
import { JobWorkGatePass } from '../../types/jobWork';
import { cancelGatePass } from '../../services/jobWorkService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface CancelGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  gatePass: JobWorkGatePass | null;
  onCancelled: (updatedPass: JobWorkGatePass) => void;
}

export const CancelGatePassModal: React.FC<CancelGatePassModalProps> = ({
  isOpen,
  onClose,
  gatePass,
  onCancelled
}) => {
  const { tenant, user, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [reason, setReason] = useState('');
  const [materialPhysicallyLeft, setMaterialPhysicallyLeft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !gatePass) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toastError('Please enter a cancellation reason.');
      return;
    }

    if (!tenant?.id || !user) {
      toastError('Session expired. Please log in.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await cancelGatePass(
        tenant.id,
        gatePass.id,
        reason.trim(),
        materialPhysicallyLeft,
        user,
        isSandboxMode
      );

      toastSuccess(
        materialPhysicallyLeft 
          ? `Gate Pass ${gatePass.gatePassNumber} cancelled. Stock retained with vendor as material has physically departed.` 
          : `Gate Pass ${gatePass.gatePassNumber} cancelled. Own stock successfully restored.`
      );
      onCancelled(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel gate pass:', err);
      toastError(err.message || 'Failed to cancel gate pass.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-rose-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 border border-rose-400/30 rounded-lg text-rose-300">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cancel Gate Pass</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-900/80 text-rose-200">
                  {gatePass.gatePassNumber}
                </span>
              </h3>
              <p className="text-xs text-rose-300">Vendor: {gatePass.jobWorkerName}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Edge Case Question: Has material physically left factory? */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              Has the material physically departed from the factory gate? *
            </label>

            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="departureStatus"
                  checked={!materialPhysicallyLeft}
                  onChange={() => setMaterialPhysicallyLeft(false)}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    No, material is still in factory (Vehicle has NOT left)
                  </span>
                  <span className="text-slate-600">
                    System will automatically restore "Own Stock" and reverse the outward ledger entry.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-amber-300 bg-amber-50/50 hover:bg-amber-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="departureStatus"
                  checked={materialPhysicallyLeft}
                  onChange={() => setMaterialPhysicallyLeft(true)}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-amber-950 block">
                    Yes, material has physically left with the transporter / vendor
                  </span>
                  <span className="text-amber-800">
                    Audit constraint: System will <strong>NOT auto-reverse stock</strong>. The material will remain accounted in "Stock with Job Worker" until returned via Inward Gate Pass.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Warning Banner if material physically left (Acceptance criteria edge case) */}
          {materialPhysicallyLeft && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Edge Case Policy Enforcement:</span> Because the material has already left the premises, inventory will not be returned to your store. The goods remain with <strong>{gatePass.jobWorkerName}</strong> on the company books until a formal Inward Return is received.
              </div>
            </div>
          )}

          {/* Cancellation Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cancellation Reason * (Required for ERP & GST Audit)
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Job worker called stating furnace heating coil failure; cancelled before departure / or vehicle recalled due to wrong batch tagging."
              className="w-full text-sm rounded-lg border-slate-300 focus:border-rose-500 focus:ring-rose-500 py-2 px-3"
            />
          </div>

          {/* Material Summary in this Gate Pass */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <span className="text-slate-500 font-semibold block uppercase text-[10px]">Material on this Pass:</span>
            {gatePass.items.map(it => (
              <div key={it.id} className="flex justify-between font-mono text-slate-800">
                <span>{it.materialName} ({it.materialCode})</span>
                <span className="font-bold">{it.quantity} {it.uom}</span>
              </div>
            ))}
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
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2 transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  Confirm Cancellation
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
