// src/components/orders/AtpShortfallSaveConfirmationModal.tsx

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  Check, 
  Calendar, 
  Layers, 
  ShieldAlert, 
  Package, 
  HelpCircle,
  FileCheck2,
  Clock
} from 'lucide-react';

export interface ShortfallLineItem {
  lineIndex: number;
  productName: string;
  quantity: number;
  unit?: string;
  status: 'partial' | 'unavailable' | 'timeout';
  shortfallComponents?: Array<{
    componentName: string;
    required: number;
    available: number;
    shortfall: number;
    expectedReplenishmentDate?: string | null;
    notes?: string;
  }>;
  isTimeout?: boolean;
  isNoStockRecord?: boolean;
}

export interface AtpShortfallSaveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (acknowledgementReason: string) => void;
  shortfallLines: ShortfallLineItem[];
  orderNumber?: string;
  isSaving?: boolean;
}

export const AtpShortfallSaveConfirmationModal: React.FC<AtpShortfallSaveConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  shortfallLines,
  orderNumber,
  isSaving = false
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const count = shortfallLines.length;
  const hasTimeouts = shortfallLines.some(l => l.status === 'timeout' || l.isTimeout);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError('Mandatory: An acknowledgement reason is required to proceed with shortfalls.');
      return;
    }
    if (trimmed.length < 5) {
      setValidationError('Reason must be at least 5 characters explaining the procurement or managerial override.');
      return;
    }
    setValidationError('');
    onConfirm(trimmed);
  };

  const handleQuickInsert = (text: string) => {
    setReason(text);
    setValidationError('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 block">
                Material Availability Advisory Check
              </span>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {count} line{count > 1 ? 's have' : ' has'} material shortfalls. Proceed anyway?
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-xs text-slate-600 font-sans leading-relaxed">
            The Available-To-Promise (ATP) engine evaluated inventory balances, planned production receipts, and committed allocations. Saving with shortfalls will proceed without blocking, but requires a logged managerial reason for the audit trail.
          </p>

          {/* Shortfall Lines Breakdown */}
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Flagged Order Line Breakdown ({count})
            </span>

            {shortfallLines.map((line, idx) => {
              const isTimeout = line.status === 'timeout' || line.isTimeout;
              const isUnavailable = line.status === 'unavailable';
              const isPartial = line.status === 'partial';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs font-mono ${
                    isTimeout
                      ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                      : isUnavailable
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                      : 'bg-amber-50/50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="truncate max-w-[320px] text-slate-900">
                      Line #{line.lineIndex + 1}: {line.productName}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded uppercase font-extrabold border ${
                        isTimeout
                          ? 'bg-amber-200 text-amber-900 border-amber-400'
                          : isUnavailable
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isTimeout ? '⚠️ Timeout' : isUnavailable ? '🔴 Unavailable' : '🟡 Partial'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 mt-1">
                    Ordered Qty: <strong className="text-slate-900">{line.quantity} {line.unit || 'units'}</strong>
                  </div>

                  {/* Component Details */}
                  {isTimeout ? (
                    <div className="mt-1 text-[11px] text-amber-800 font-sans">
                      Availability check timed out (&gt;5s). User may proceed; reason will record as ATP timeout.
                    </div>
                  ) : line.isNoStockRecord ? (
                    <div className="mt-1 text-[11px] text-rose-700 font-sans">
                      No stock record found for this product. 100% of quantity required from procurement.
                    </div>
                  ) : line.shortfallComponents && line.shortfallComponents.length > 0 ? (
                    <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-1">
                      {line.shortfallComponents.map((comp, cIdx) => (
                        <div key={cIdx} className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-700 font-semibold">{comp.componentName}:</span>
                          <span className="text-rose-600 font-bold">
                            Shortfall: {comp.shortfall} (Avail: {comp.available} / Req: {comp.required})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Quick Insert Reason Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Quick Acknowledgement Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickInsert('Approved by Operations Head; expedited raw material PO issued.')}
                className="text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition cursor-pointer"
              >
                + Expedited PO Issued
              </button>
              <button
                type="button"
                onClick={() => handleQuickInsert('Customer negotiated staggered batch delivery; first batch fulfilled from stock.')}
                className="text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition cursor-pointer"
              >
                + Staggered Delivery
              </button>
              {hasTimeouts && (
                <button
                  type="button"
                  onClick={() => handleQuickInsert('ATP timeout acknowledged by sales team; manual stock check verified.')}
                  className="text-[10px] font-mono bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-1 rounded transition cursor-pointer"
                >
                  + ATP Timeout Acknowledged
                </button>
              )}
            </div>
          </div>

          {/* Mandatory Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold text-slate-700">
              Mandatory Acknowledgement Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim().length >= 5) setValidationError('');
              }}
              placeholder="e.g. Raw material batch arriving 18 Nov from Neel Metal Products; approved by Operations Head..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-hidden leading-relaxed"
            />
            {validationError && (
              <p className="text-[11px] font-mono text-rose-600 font-bold">{validationError}</p>
            )}
            <p className="text-[10px] text-slate-400 font-mono">
              This reason and an ATP snapshot will be permanently attached to the order audit trail.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold rounded-xl transition cursor-pointer"
            >
              Cancel & Adjust Quantities
            </button>
            <button
              type="submit"
              disabled={isSaving || reason.trim().length < 5}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-mono font-bold rounded-xl transition shadow-3xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{isSaving ? 'Saving Order...' : 'Acknowledge Shortfall & Save Order'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
