// src/components/orders/AtpAcknowledgementModal.tsx

import React, { useState } from 'react';
import { AtpCheckResult } from '../../types/materialAvailability';
import { 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  ArrowRight,
  Package
} from 'lucide-react';

interface AtpAcknowledgementModalProps {
  isOpen: boolean;
  atpResult?: AtpCheckResult | null;
  checkResult?: AtpCheckResult | null;
  userName: string;
  userRole: string;
  onClose: () => void;
  onConfirm?: (reason: string) => void;
  onAcknowledge?: (payload: { productName: string; reason: string; acknowledgedBy: string; acknowledgedAt: string }) => void;
}

export const AtpAcknowledgementModal: React.FC<AtpAcknowledgementModalProps> = ({
  isOpen,
  atpResult: propAtpResult,
  checkResult,
  userName,
  userRole,
  onClose,
  onConfirm,
  onAcknowledge
}) => {
  const result = propAtpResult || checkResult;
  if (!isOpen || !result) return null;
  const atpResult = result;

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setError('Please provide a valid operational justification (minimum 5 characters).');
      return;
    }
    const cleanReason = reason.trim();
    if (onConfirm) {
      onConfirm(cleanReason);
    }
    if (onAcknowledge) {
      onAcknowledge({
        productName: result.productName,
        reason: cleanReason,
        acknowledgedBy: userName,
        acknowledgedAt: new Date().toISOString()
      });
    }
    onClose();
  };

  const isUnavailable = atpResult.overallStatus === 'unavailable';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isUnavailable ? 'bg-rose-50/70 border-rose-200 text-rose-950' : 'bg-amber-50/70 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className={`h-5 w-5 ${isUnavailable ? 'text-rose-600' : 'text-amber-600'}`} />
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block">
                ATP Advisory Acknowledgement
              </span>
              <h3 className="text-sm font-bold mt-0.5">
                Material Shortfall Detected for {atpResult.productName}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
          
          {/* Explanation Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-mono">
            <div className="flex justify-between items-center text-slate-700">
              <span>Required Quantity:</span>
              <span className="font-bold">{atpResult.orderedQty} units</span>
            </div>
            {atpResult.limitingComponent && (
              <div className="flex justify-between items-center text-rose-700 font-bold">
                <span>Limiting Component:</span>
                <span>{atpResult.limitingComponent.partName} (Shortfall: {atpResult.limitingComponent.shortfall} {atpResult.limitingComponent.unit})</span>
              </div>
            )}
            {atpResult.earliestAvailableDate && (
              <div className="flex justify-between items-center text-indigo-700">
                <span>Expected Replenishment:</span>
                <span className="font-bold">{atpResult.earliestAvailableDate}</span>
              </div>
            )}
          </div>

          <p className="text-slate-600 leading-relaxed">
            The system does not block this order confirmation because ATP is an <strong>advisory check</strong>. However, proceeding with an unavailable line requires an acknowledged business reason so procurement and planning leads are notified.
          </p>

          {/* Justification Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              Operational Reason / Acknowledgement Note *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Supplier PO #PO-941 confirmed delivery on Friday; expedited raw material shipment authorized..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
            />
            {error && (
              <p className="text-[11px] text-rose-600 font-bold">{error}</p>
            )}
          </div>

          {/* User Sign-off */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Acknowledged By: <strong className="text-slate-800">{userName}</strong> ({userRole})</span>
            <span>FlowOps ATP Engine</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-3xs flex items-center space-x-1.5"
            >
              <span>Confirm & Acknowledge Shortfall</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
