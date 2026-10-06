// src/components/subcontractors/AwardDecisionModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  Building2, 
  FileCheck2, 
  ArrowRight,
  Hash,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { 
  SubcontractRfq, 
  SubcontractorQuoteBid 
} from '../../types/subcontractor';
import { 
  awardSubcontractRfq, 
  generateNextSubcontractPoNumber, 
  calculateBidLandedTotal,
  findL1Bidder 
} from '../../services/subcontractorService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface AwardDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfq: SubcontractRfq;
  selectedBid: SubcontractorQuoteBid;
  onAwardCompleted: (updatedRfq: SubcontractRfq) => void;
}

export const AwardDecisionModal: React.FC<AwardDecisionModalProps> = ({
  isOpen,
  onClose,
  rfq,
  selectedBid,
  onAwardCompleted
}) => {
  const { tenant, profile, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [poNumber, setPoNumber] = useState('');
  const [loadingPoNumber, setLoadingPoNumber] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [awarding, setAwarding] = useState(false);

  const totalQty = rfq.items.reduce((sum, it) => sum + (it.quantity || 0), 0) || 1;
  const landedTotal = calculateBidLandedTotal(selectedBid, totalQty);
  const l1Bid = findL1Bidder(rfq.bids, totalQty);
  const isL1 = l1Bid?.id === selectedBid.id;

  useEffect(() => {
    if (isOpen && tenant?.id) {
      setLoadingPoNumber(true);
      generateNextSubcontractPoNumber(tenant.id, isSandboxMode)
        .then(num => {
          setPoNumber(num);
          setLoadingPoNumber(false);
        })
        .catch(() => {
          setPoNumber(`SPO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
          setLoadingPoNumber(false);
        });

      // Default delivery date based on vendor lead time
      const targetDays = selectedBid.leadTimeDays || 4;
      const defDelivery = new Date(Date.now() + targetDays * 24 * 3600 * 1000).toISOString().split('T')[0];
      setDeliveryDate(defDelivery);

      // Pre-fill standard professional justification
      if (isL1) {
        setDecisionReason(
          `Awarded to L1 lowest landed cost bidder (${selectedBid.subcontractorName}) at ₹${selectedBid.unitPrice}/pc. Fully compliant with technical specifications and turnaround requirements.`
        );
      } else {
        setDecisionReason(
          `Awarded to ${selectedBid.subcontractorName} based on superior quality rating (${selectedBid.vendorRating || 4.8}★) and faster turnaround of ${selectedBid.leadTimeDays} days vs L1 bidder.`
        );
      }
    }
  }, [isOpen, tenant?.id, selectedBid, isL1, isSandboxMode]);

  if (!isOpen) return null;

  const handleConfirmAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionReason.trim()) {
      toastError('Decision justification is required');
      return;
    }
    if (!poNumber.trim()) {
      toastError('Purchase Order Number is required');
      return;
    }
    if (!tenant?.id || !profile) return;

    setAwarding(true);
    try {
      const updated = await awardSubcontractRfq({
        tenantId: tenant.id,
        rfqId: rfq.id,
        bidId: selectedBid.id,
        decisionReason: decisionReason.trim(),
        deliveryDate,
        poNumberOverride: poNumber.trim(),
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Procurement Lead',
          email: profile.email
        },
        isSandboxMode
      });

      toastSuccess(
        `PO #${poNumber} Issued!`,
        `Awarded process to ${selectedBid.subcontractorName}. Contract recorded and supplier notified.`
      );
      onAwardCompleted(updated);
      onClose();
    } catch (err: any) {
      toastError('Failed to complete award: ' + (err.message || err));
    } finally {
      setAwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                  Procurement Award Decision
                </span>
                <span className="text-[11px] font-mono text-slate-400">{rfq.rfqNumber}</span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                Award Subcontractor & Issue PO
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
        <form id="award-form" onSubmit={handleConfirmAward} className="p-6 space-y-4.5 text-xs font-sans overflow-y-auto max-h-[80vh]">
          
          {/* Winner Overview Card */}
          <div className="bg-gradient-to-r from-emerald-50/80 via-white to-sky-50/60 p-4 rounded-xl border border-emerald-200/90 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9.5px] font-mono uppercase font-bold text-slate-500 tracking-wider block">
                  Winning Subcontractor
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedBid.subcontractorName}
                </h4>
              </div>

              {isL1 ? (
                <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Verified L1 Bidder</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  <span>Technical / Lead-Time Exception</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/50 text-[11px] font-mono">
              <div>
                <span className="text-slate-400 text-[9px] block uppercase">Unit Quoted</span>
                <span className="font-bold text-slate-800">₹{selectedBid.unitPrice}/pc</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] block uppercase">Turnaround</span>
                <span className="font-bold text-slate-800">{selectedBid.leadTimeDays} Days</span>
              </div>
              <div>
                <span className="text-slate-400 text-[9px] block uppercase">Total Landed</span>
                <span className="font-extrabold text-emerald-900">₹{landedTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Subcontract Purchase Order Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Hash className="h-3.5 w-3.5 text-indigo-600" />
                <span>Subcontract PO Number (SPO#) *</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                {loadingPoNumber && (
                  <div className="absolute right-3 top-2.5">
                    <RotateCw className="h-4 w-4 animate-spin text-sky-600" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Official external purchase order identifier
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                <span>Promised Return Delivery Date *</span>
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono text-slate-900"
              />
            </div>
          </div>

          {/* Award Decision Reason (Auditable) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>Procurement Award Justification & Business Rationale *</span>
              <span className="text-[10px] font-mono text-slate-400">Audited in system logs</span>
            </label>
            <textarea
              rows={3}
              required
              value={decisionReason}
              onChange={e => setDecisionReason(e.target.value)}
              placeholder="e.g. Awarded to L1 bidder based on lowest total landed cost, quality tier A+, and confirmed delivery within 4 days..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed"
            />
          </div>

          {/* Linked Shopfloor WIP Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-600">
            <span className="text-[9.5px] uppercase font-mono font-bold text-slate-500 block">
              Automated Shopfloor Integration
            </span>
            <p className="text-[11px] leading-tight">
              Executing this award locks ₹{landedTotal.toLocaleString('en-IN')} against order <span className="font-mono font-bold text-slate-800">{rfq.linkedOrderNumber || 'WIP Batch'}</span>, transitions the RFQ to <strong className="text-emerald-700">Awarded</strong>, and sends a WhatsApp PO packet to {selectedBid.subcontractorName}.
            </p>
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
            form="award-form"
            disabled={awarding || loadingPoNumber}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-xl flex items-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {awarding ? (
              <span>Finalizing Award...</span>
            ) : (
              <>
                <FileCheck2 className="h-4 w-4 text-emerald-200" />
                <span>Confirm Award & Issue SPO</span>
                <ArrowRight className="h-4 w-4 text-emerald-200" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
