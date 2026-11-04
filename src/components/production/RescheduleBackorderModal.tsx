// src/components/production/RescheduleBackorderModal.tsx

import React, { useState } from 'react';
import { Backorder } from '../../types';
import { rescheduleBackorder } from '../../services/partialDispatchService';
import { useAuth } from '../../context/AuthContext';
import { 
  CalendarClock, 
  X, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Info,
  CheckCircle2
} from 'lucide-react';

interface RescheduleBackorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  backorder: Backorder | null;
  onSuccess: (updatedBackorder: Backorder) => void;
}

const COMMON_REASONS = [
  'Raw material delivery lead time delay',
  'Shopfloor machine maintenance / workcenter bottleneck',
  'Customer requested revised delivery date',
  'Prioritized urgent emergency order on assembly line',
  'Tooling / fixture setup adjustments required',
  'Post-heat treatment / NDT inspection queue delay',
  'Other production scheduling adjustment'
];

export const RescheduleBackorderModal: React.FC<RescheduleBackorderModalProps> = ({
  isOpen,
  onClose,
  backorder,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  
  const currentTargetDate = backorder?.targetDate || backorder?.deliveryDate || '';
  const [newDate, setNewDate] = useState(currentTargetDate);
  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !backorder) return null;

  const totalQty = backorder.items.reduce(
    (acc, itm) => acc + (itm.backorderQty ?? itm.remainingQty ?? 0), 
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (!newDate) {
      setError('Please select a valid new target delivery date.');
      return;
    }

    const finalReason = selectedReason === 'Other production scheduling adjustment' && customReason.trim()
      ? customReason.trim()
      : selectedReason;

    if (!finalReason) {
      setError('Please provide a reason for rescheduling this backorder.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const operatorName = profile?.name || profile?.email || 'Production Supervisor';
      const updated = await rescheduleBackorder(
        tenant.id,
        backorder.id,
        newDate,
        finalReason,
        operatorName
      );
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule backorder.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Reschedule Backorder Target Date</h3>
              <p className="text-xs text-slate-400">Independent shopfloor priority adjustment</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Backorder Identity Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[11px]">
                {backorder.backorderNumber}
              </span>
              <span className="font-mono text-slate-500 text-[11px]">
                Parent: <strong className="text-slate-800">{backorder.originalOrderNumber}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
              <div>
                <span className="text-slate-500 block">Customer</span>
                <span className="font-semibold text-slate-800 truncate block">{backorder.customerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Backordered Qty</span>
                <span className="font-mono font-bold text-slate-900">{totalQty} units</span>
              </div>
            </div>

            {/* Preserved Contract Promised Date */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
              <Info className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span>
                Original Promised Date: <strong className="font-mono text-slate-900">{backorder.originalPromisedDate || backorder.deliveryDate || 'Not Specified'}</strong> (Preserved)
              </span>
            </div>
          </div>

          {/* New Target Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              New Target Completion Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              This updates the production target date for this backorder without changing the original order's contract delivery date.
            </p>
          </div>

          {/* Reschedule Reason */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              Reason for Reschedule *
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {selectedReason === 'Other production scheduling adjustment' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                Custom Notes / Reason Details *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Specify reason for shifting backorder schedule..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Update Target Date</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
