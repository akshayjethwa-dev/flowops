// src/components/production/CancelBackorderModal.tsx

import React, { useState } from 'react';
import { Backorder } from '../../types';
import { cancelBackorderWithReason } from '../../services/partialDispatchService';
import { useAuth } from '../../context/AuthContext';
import { 
  AlertTriangle, 
  X, 
  AlertOctagon, 
  CheckCircle2, 
  HelpCircle,
  FileText
} from 'lucide-react';

interface CancelBackorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  backorder: Backorder | null;
  onSuccess: (cancelledBackorder: Backorder) => void;
}

const CANCELLATION_REASONS = [
  { code: 'parent_order_cancelled', label: 'Parent Order Cancelled / Closed by Customer' },
  { code: 'customer_request', label: 'Customer Requested Cancellation of Balance Quantity' },
  { code: 'spec_revision', label: 'Component Technical Specification Revision / Obsolete' },
  { code: 'raw_material_shortage', label: 'Raw Material Unavailable / Unfulfillable' },
  { code: 'capacity_shortage', label: 'Shopfloor Capacity Shortage / Diverted to Emergency' },
  { code: 'other', label: 'Other Operational Cancellation Reason' }
];

export const CancelBackorderModal: React.FC<CancelBackorderModalProps> = ({
  isOpen,
  onClose,
  backorder,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const [selectedCode, setSelectedCode] = useState(CANCELLATION_REASONS[0].code);
  const [notes, setNotes] = useState('');
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

    if (!notes.trim() && selectedCode === 'other') {
      setError('Please provide detailed cancellation notes when selecting "Other".');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const operatorName = profile?.name || profile?.email || 'Production Supervisor';
      const result = await cancelBackorderWithReason(
        tenant.id,
        backorder.id,
        selectedCode,
        notes.trim() || CANCELLATION_REASONS.find(r => r.code === selectedCode)?.label || 'Cancelled by supervisor',
        operatorName
      );
      onSuccess(result.cancelledBackorder);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel backorder.');
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
        <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/20 text-rose-300 rounded-lg">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Explicitly Cancel Backorder</h3>
              <p className="text-xs text-rose-200">Audit-tracked cancellation with reason code</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Audit integrity callout */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Backorder Protection Rule</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Backorders represent active production commitments. Even if a parent sales order was cancelled or modified, the backorder remains open and active in the shopfloor queue until an authorized supervisor explicitly cancels it with a validated reason code.
            </p>
          </div>

          {/* Backorder Details */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-slate-900">{backorder.backorderNumber}</span>
              <span className="text-slate-500">Order: {backorder.originalOrderNumber}</span>
            </div>
            <div className="text-[11px] text-slate-600 flex items-center justify-between">
              <span>Customer: <strong className="text-slate-800">{backorder.customerName}</strong></span>
              <span>Balance Qty: <strong className="font-mono text-slate-900">{totalQty} units</strong></span>
            </div>
          </div>

          {/* Reason Code Select */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              Cancellation Reason Code *
            </label>
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
            >
              {CANCELLATION_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  [{r.code.toUpperCase()}] {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              Audit Notes / Supporting Context {selectedCode === 'other' && '*'}
            </label>
            <textarea
              rows={3}
              placeholder="Provide reason notes for audit trail..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Keep Backorder Open
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm Cancellation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
