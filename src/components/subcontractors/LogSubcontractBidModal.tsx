// src/components/subcontractors/LogSubcontractBidModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  DollarSign, 
  Clock, 
  Save, 
  Truck, 
  Percent, 
  Building2,
  Calendar
} from 'lucide-react';
import { 
  SubcontractRfq, 
  Subcontractor, 
  SubcontractorQuoteBid 
} from '../../types/subcontractor';
import { submitSubcontractorBid } from '../../services/subcontractorService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface LogSubcontractBidModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfq: SubcontractRfq;
  subcontractors: Subcontractor[];
  preselectedSubcontractorId?: string;
  onBidLogged: (updatedRfq: SubcontractRfq) => void;
}

export const LogSubcontractBidModal: React.FC<LogSubcontractBidModalProps> = ({
  isOpen,
  onClose,
  rfq,
  subcontractors,
  preselectedSubcontractorId,
  onBidLogged
}) => {
  const { tenant, profile, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [subcontractorId, setSubcontractorId] = useState(
    preselectedSubcontractorId || rfq.invitedSubcontractorIds[0] || subcontractors[0]?.id || ''
  );
  const [unitPrice, setUnitPrice] = useState<number>(rfq.items[0]?.targetUnitPrice || 220);
  const [setupToolingCost, setSetupToolingCost] = useState<number>(0);
  const [scrapRejectionAllowancePercent, setScrapRejectionAllowancePercent] = useState<number>(1.0);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(4);
  const [logisticsIncluded, setLogisticsIncluded] = useState<boolean>(true);
  const [logisticsCost, setLogisticsCost] = useState<number>(0);
  const [paymentTerms, setPaymentTerms] = useState<string>('30 Days Net');
  const [validityDate, setValidityDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [technicalNotes, setTechnicalNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalQty = rfq.items.reduce((sum, it) => sum + (it.quantity || 0), 0) || 1;
  const calculatedBatchParts = unitPrice * totalQty;
  const calculatedTotalLanded = calculatedBatchParts + setupToolingCost + (!logisticsIncluded ? logisticsCost : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcontractorId) {
      toastError('Please select a subcontractor');
      return;
    }
    if (unitPrice <= 0) {
      toastError('Unit Price must be greater than 0');
      return;
    }
    if (!tenant?.id || !profile) return;

    const sub = subcontractors.find(s => s.id === subcontractorId);
    if (!sub) return;

    setSubmitting(true);
    try {
      const updated = await submitSubcontractorBid({
        tenantId: tenant.id,
        rfqId: rfq.id,
        bid: {
          subcontractorId: sub.id,
          subcontractorName: sub.name,
          vendorRating: sub.rating,
          vendorQualityTier: sub.qualityTier,
          unitPrice: Number(unitPrice),
          setupToolingCost: Number(setupToolingCost) || 0,
          scrapRejectionAllowancePercent: Number(scrapRejectionAllowancePercent) || 0,
          leadTimeDays: Number(leadTimeDays) || 3,
          logisticsIncluded,
          logisticsCost: logisticsIncluded ? 0 : Number(logisticsCost) || 0,
          paymentTerms: paymentTerms.trim(),
          validityDate,
          technicalNotes: technicalNotes.trim() || undefined,
          status: 'received'
        },
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Procurement Mgr'
        },
        isSandboxMode
      });

      toastSuccess(
        'Quote Bid Logged!',
        `Recorded ₹${unitPrice}/pc quote from ${sub.name} into Comparison Matrix.`
      );
      onBidLogged(updated);
      onClose();
    } catch (err: any) {
      toastError('Failed to record bid: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                Quote Matrix Entry
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                Log Subcontractor Quotation Bid
              </h3>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form id="log-bid-form" onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans overflow-y-auto max-h-[80vh]">
          
          {/* Subcontractor selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              <span>Responding Subcontractor</span>
            </label>
            <select
              value={subcontractorId}
              onChange={e => setSubcontractorId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {subcontractors.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.qualityTier} Tier • ★{s.rating} • {s.city})
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                Unit Quoted Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={unitPrice}
                onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 font-mono">
                For {totalQty} units: ₹{calculatedBatchParts.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                Setup / Tooling / Fixture Charge (₹)
              </label>
              <input
                type="number"
                value={setupToolingCost}
                onChange={e => setSetupToolingCost(parseFloat(e.target.value) || 0)}
                placeholder="0 if waived"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 font-mono">One-time batch setup</span>
            </div>
          </div>

          {/* Lead Time & Scrap Rejection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-sky-600" />
                <span>Quoted Turnaround (Days) *</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={leadTimeDays}
                onChange={e => setLeadTimeDays(parseInt(e.target.value, 10) || 1)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Percent className="h-3.5 w-3.5 text-amber-600" />
                <span>Process Scrap / Rejection Allowance (%)</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={scrapRejectionAllowancePercent}
                onChange={e => setScrapRejectionAllowancePercent(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
              />
            </div>
          </div>

          {/* Logistics & Payment Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="bid-logistics-inc"
                  checked={logisticsIncluded}
                  onChange={e => setLogisticsIncluded(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                <label htmlFor="bid-logistics-inc" className="font-bold text-slate-800 text-[11px] cursor-pointer">
                  Logistics & Pickup Included
                </label>
              </div>
              {!logisticsIncluded && (
                <input
                  type="number"
                  placeholder="Extra Freight (₹)"
                  value={logisticsCost}
                  onChange={e => setLogisticsCost(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 uppercase">Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                placeholder="e.g. 30 Days Net"
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold"
              />
            </div>
          </div>

          {/* Technical Notes / Assumptions */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">
              Vendor Technical Remarks / Exceptions
            </label>
            <textarea
              rows={2}
              value={technicalNotes}
              onChange={e => setTechnicalNotes(e.target.value)}
              placeholder="e.g. Induction coil already available. Hardness test coupon included. Free drop after inspection."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 resize-none"
            />
          </div>

          {/* Landed Batch Cost Preview */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                Total Landed Batch Cost:
              </span>
              <span className="text-[11px] text-slate-600">
                ({totalQty} {rfq.items[0]?.unit || 'pcs'} × ₹{unitPrice}) + ₹{setupToolingCost} setup {(!logisticsIncluded && logisticsCost > 0) ? `+ ₹${logisticsCost} freight` : ''}
              </span>
            </div>
            <span className="text-base font-black text-emerald-950 font-mono">
              ₹{calculatedTotalLanded.toLocaleString('en-IN')}
            </span>
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="log-bid-form"
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-xl flex items-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{submitting ? 'Recording Bid...' : 'Save Quote to Matrix'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
