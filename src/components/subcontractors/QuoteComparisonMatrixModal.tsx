// src/components/subcontractors/QuoteComparisonMatrixModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  BarChart3, 
  Trophy, 
  Clock, 
  Star, 
  DollarSign, 
  Plus, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Building2, 
  FileText, 
  Check, 
  Truck,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  SubcontractRfq, 
  Subcontractor, 
  SubcontractorQuoteBid 
} from '../../types/subcontractor';
import { 
  calculateBidLandedTotal, 
  findL1Bidder, 
  findFastestBidder 
} from '../../services/subcontractorService';
import { LogSubcontractBidModal } from './LogSubcontractBidModal';
import { AwardDecisionModal } from './AwardDecisionModal';
import { useToast } from '../../context/ToastContext';

interface QuoteComparisonMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfq: SubcontractRfq;
  subcontractors: Subcontractor[];
  onRfqUpdated: (updatedRfq: SubcontractRfq) => void;
}

export const QuoteComparisonMatrixModal: React.FC<QuoteComparisonMatrixModalProps> = ({
  isOpen,
  onClose,
  rfq,
  subcontractors,
  onRfqUpdated
}) => {
  const { toastSuccess, toastInfo } = useToast();

  const [activeBidToAward, setActiveBidToAward] = useState<SubcontractorQuoteBid | null>(null);
  const [showLogBidModal, setShowLogBidModal] = useState(false);

  if (!isOpen) return null;

  const totalQty = rfq.items.reduce((sum, it) => sum + (it.quantity || 0), 0) || 1;
  const bids = rfq.bids || [];
  const l1Bid = findL1Bidder(bids, totalQty);
  const fastestBid = findFastestBidder(bids);

  const handleExportMatrixCSV = () => {
    if (bids.length === 0) {
      toastInfo('No bids to export', 'Log at least one quotation before exporting comparison matrix.');
      return;
    }

    const headers = [
      'Subcontractor Name',
      'Quality Tier',
      'Vendor Rating',
      'Unit Price (INR)',
      'Setup Tooling Cost (INR)',
      'Lead Time (Days)',
      'Scrap Allowance (%)',
      'Logistics Included',
      'Total Landed Cost (INR)',
      'Payment Terms',
      'Status',
      'Technical Notes'
    ];

    const rows = bids.map(b => {
      const landed = calculateBidLandedTotal(b, totalQty);
      return [
        `"${b.subcontractorName}"`,
        b.vendorQualityTier || 'A',
        b.vendorRating || 4.5,
        b.unitPrice,
        b.setupToolingCost || 0,
        b.leadTimeDays,
        `${b.scrapRejectionAllowancePercent}%`,
        b.logisticsIncluded ? 'Yes' : 'No',
        landed,
        `"${b.paymentTerms}"`,
        b.status.toUpperCase(),
        `"${(b.technicalNotes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subcontract_matrix_${rfq.rfqNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toastSuccess('Matrix Exported', `Downloaded comparison sheet for ${rfq.rfqNumber}.`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400 font-bold bg-sky-950/60 border border-sky-800/80 px-2 py-0.5 rounded">
                  Quote Comparison Matrix
                </span>
                <span className="text-[11px] font-mono text-slate-400">{rfq.rfqNumber}</span>
                {rfq.status === 'awarded' && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700 px-2 py-0.2 rounded-full">
                    Awarded • {rfq.awardDecision?.poNumber}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                {rfq.title}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportMatrixCSV}
              className="text-xs font-mono font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition-colors"
              title="Export quote matrix to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLogBidModal(true)}
              className="text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Log Vendor Quote</span>
            </button>

            <button 
              type="button" 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs font-sans flex-1">
          
          {/* Quick Technical Specs Strip */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-4 flex-wrap">
              <div>
                <span className="text-[9.5px] font-mono uppercase text-slate-400 block font-bold">Component Part</span>
                <span className="font-bold text-slate-900">{rfq.items[0]?.partName || 'Component'}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono uppercase text-slate-400 block font-bold">Material</span>
                <span className="font-mono text-slate-700">{rfq.items[0]?.materialGrade || 'Standard'}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono uppercase text-slate-400 block font-bold">Batch Size</span>
                <span className="font-mono font-bold text-indigo-700">{totalQty} {rfq.items[0]?.unit || 'pcs'}</span>
              </div>
              {rfq.items[0]?.drawingRef && (
                <div>
                  <span className="text-[9.5px] font-mono uppercase text-slate-400 block font-bold">Drawing Ref</span>
                  <span className="font-mono text-slate-600">{rfq.items[0].drawingRef}</span>
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="text-[9.5px] font-mono uppercase text-slate-400 block font-bold">Invited Vendors</span>
              <span className="font-mono font-bold text-slate-700">
                {bids.length} of {rfq.invitedSubcontractorIds.length} Quoted
              </span>
            </div>
          </div>

          {/* Award Decision Banner (If Awarded) */}
          {rfq.status === 'awarded' && rfq.awardDecision && (
            <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold text-emerald-950">
                    Awarded to {rfq.awardDecision.subcontractorName}
                  </span>
                  <span className="text-xs font-mono bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded font-bold">
                    PO: {rfq.awardDecision.poNumber}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-tight">
                  <strong className="font-semibold">Award Rationale:</strong> {rfq.awardDecision.decisionReason}
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0 font-mono text-xs">
                <span className="text-[9.5px] uppercase text-emerald-700 block">Total PO Value</span>
                <span className="text-base font-black text-emerald-950">
                  ₹{rfq.awardDecision.awardedTotalAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  Promised: {new Date(rfq.awardDecision.deliveryDate).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* BIDS SIDE-BY-SIDE MATRIX */}
          {bids.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200">
                    <th className="p-3.5 font-mono uppercase font-bold text-slate-500 text-[10px] w-48 bg-slate-100/90 sticky left-0 z-10 border-r border-slate-200">
                      Comparison Parameter
                    </th>
                    {bids.map(bid => {
                      const isL1This = l1Bid?.id === bid.id;
                      const isFastestThis = fastestBid?.id === bid.id;
                      const isAwardedThis = rfq.awardDecision?.awardedBidId === bid.id;

                      return (
                        <th 
                          key={bid.id} 
                          className={`p-3.5 min-w-[210px] align-top transition-colors border-r border-slate-200 last:border-r-0 ${
                            isAwardedThis 
                              ? 'bg-emerald-50/70 border-t-4 border-t-emerald-600' 
                              : isL1This 
                              ? 'bg-sky-50/50 border-t-4 border-t-sky-600' 
                              : 'bg-white'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{bid.subcontractorName}</h4>
                              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-700 shrink-0">
                                {bid.vendorQualityTier || 'A'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] font-mono text-amber-600 font-bold">★ {bid.vendorRating || 4.5}</span>
                              <span className="text-[9px] text-slate-400 font-mono">• {subcontractors.find(s => s.id === bid.subcontractorId)?.city || 'Industrial Cluster'}</span>
                            </div>

                            {/* Badge highlights */}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {isAwardedThis && (
                                <span className="bg-emerald-600 text-white font-mono text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center space-x-0.5">
                                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                                  <span>AWARDED PO</span>
                                </span>
                              )}
                              {isL1This && (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center space-x-0.5">
                                  <Trophy className="h-2.5 w-2.5 text-emerald-700" />
                                  <span>L1 LOWEST COST</span>
                                </span>
                              )}
                              {isFastestThis && (
                                <span className="bg-sky-100 text-sky-800 border border-sky-300 font-mono text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center space-x-0.5">
                                  <Clock className="h-2.5 w-2.5 text-sky-700" />
                                  <span>FASTEST ({bid.leadTimeDays}d)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-150 text-[11px] font-mono">
                  
                  {/* Parameter: Unit Quoted Rate */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-bold text-slate-700 bg-slate-50 sticky left-0 border-r border-slate-200">
                      Unit Quoted Rate
                    </td>
                    {bids.map(bid => (
                      <td key={bid.id} className="p-3 font-bold text-slate-900 border-r border-slate-200 last:border-r-0">
                        ₹{bid.unitPrice.toLocaleString('en-IN')}/pc
                      </td>
                    ))}
                  </tr>

                  {/* Parameter: Batch Setup / Tooling Charges */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-bold text-slate-700 bg-slate-50 sticky left-0 border-r border-slate-200">
                      Setup / Fixture Cost
                    </td>
                    {bids.map(bid => (
                      <td key={bid.id} className="p-3 text-slate-700 border-r border-slate-200 last:border-r-0">
                        {bid.setupToolingCost > 0 ? `₹${bid.setupToolingCost.toLocaleString('en-IN')}` : <span className="text-emerald-600 font-bold">Waived (₹0)</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Parameter: Total Landed Batch Cost (HIGHLIGHTED ROW) */}
                  <tr className="bg-slate-100/60 font-bold border-y-2 border-slate-300">
                    <td className="p-3 font-sans font-extrabold text-slate-900 bg-slate-150 sticky left-0 border-r border-slate-300">
                      Total Landed Batch Cost ({totalQty} pcs)
                    </td>
                    {bids.map(bid => {
                      const landed = calculateBidLandedTotal(bid, totalQty);
                      const isL1This = l1Bid?.id === bid.id;
                      return (
                        <td 
                          key={bid.id} 
                          className={`p-3 text-sm font-black border-r border-slate-300 last:border-r-0 ${
                            isL1This ? 'text-emerald-700 bg-emerald-50/80' : 'text-slate-900'
                          }`}
                        >
                          ₹{landed.toLocaleString('en-IN')}
                          {isL1This && <span className="text-[9px] text-emerald-800 ml-1.5 font-normal">(Lowest)</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Parameter: Quoted Lead Time Days */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-bold text-slate-700 bg-slate-50 sticky left-0 border-r border-slate-200">
                      Turnaround Lead Time
                    </td>
                    {bids.map(bid => {
                      const isFastestThis = fastestBid?.id === bid.id;
                      return (
                        <td key={bid.id} className="p-3 border-r border-slate-200 last:border-r-0">
                          <span className={isFastestThis ? 'font-bold text-sky-700' : 'text-slate-800'}>
                            {bid.leadTimeDays} Calendar Days
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Parameter: Scrap Allowance */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-bold text-slate-700 bg-slate-50 sticky left-0 border-r border-slate-200">
                      Process Scrap Allowance
                    </td>
                    {bids.map(bid => (
                      <td key={bid.id} className="p-3 text-slate-700 border-r border-slate-200 last:border-r-0">
                        {bid.scrapRejectionAllowancePercent}%
                      </td>
                    ))}
                  </tr>

                  {/* Parameter: Logistics & Freight */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-bold text-slate-700 bg-slate-50 sticky left-0 border-r border-slate-200">
                      Logistics / Pickup
                    </td>
                    {bids.map(bid => (
                      <td key={bid.id} className="p-3 border-r border-slate-200 last:border-r-0">
                        {bid.logisticsIncluded ? (
                          <span className="text-emerald-700 font-bold flex items-center space-x-1">
                            <Check className="h-3 w-3" />
                            <span>Included</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            Extra (+₹{bid.logisticsCost || 0})
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Parameter: Payment Terms */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-bold text-slate-700 bg-slate-50 sticky left-0 border-r border-slate-200">
                      Commercial Terms
                    </td>
                    {bids.map(bid => (
                      <td key={bid.id} className="p-3 text-slate-700 border-r border-slate-200 last:border-r-0">
                        {bid.paymentTerms}
                      </td>
                    ))}
                  </tr>

                  {/* Parameter: Technical Notes */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans font-bold text-slate-700 bg-slate-50 sticky left-0 border-r border-slate-200">
                      Vendor Technical Remarks
                    </td>
                    {bids.map(bid => (
                      <td key={bid.id} className="p-3 font-sans text-slate-600 text-[10.5px] leading-relaxed border-r border-slate-200 last:border-r-0">
                        {bid.technicalNotes || 'Fully complies with requested tolerances.'}
                      </td>
                    ))}
                  </tr>

                  {/* Parameter: Award Decision CTA Action */}
                  <tr className="bg-slate-50/90">
                    <td className="p-3.5 font-sans font-bold text-slate-900 bg-slate-100 sticky left-0 border-r border-slate-200">
                      Award Procurement Action
                    </td>
                    {bids.map(bid => {
                      const isAwardedThis = rfq.awardDecision?.awardedBidId === bid.id;
                      return (
                        <td key={bid.id} className="p-3.5 border-r border-slate-200 last:border-r-0">
                          {isAwardedThis ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center space-x-1 text-emerald-800 font-bold text-xs bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Awarded Winner</span>
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                PO #{rfq.awardDecision?.poNumber}
                              </span>
                            </div>
                          ) : rfq.status === 'awarded' ? (
                            <span className="text-slate-400 text-xs font-mono">Not Selected</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveBidToAward(bid)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10.5px] uppercase tracking-wider px-3.5 py-2 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all hover:scale-102"
                            >
                              <Award className="h-3.5 w-3.5 text-emerald-200" />
                              <span>Award to Vendor</span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-3xs">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">No quotations logged for this RFQ yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                RFQ has been broadcasted to {rfq.invitedSubcontractorIds.length} subcontractors. As bids arrive via WhatsApp or email, log them here to compare side-by-side.
              </p>
              <button
                type="button"
                onClick={() => setShowLogBidModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-4 py-2 rounded-xl inline-flex items-center space-x-1.5 cursor-pointer shadow-sm mt-2"
              >
                <Plus className="h-4 w-4" />
                <span>Log First Subcontractor Quote</span>
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            {bids.length} competing bids • Procurement decision auditable
          </span>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-4 py-2 rounded-lg cursor-pointer"
          >
            Close Matrix
          </button>
        </div>

      </div>

      {/* Log Incoming Bid Modal */}
      {showLogBidModal && (
        <LogSubcontractBidModal
          isOpen={showLogBidModal}
          onClose={() => setShowLogBidModal(false)}
          rfq={rfq}
          subcontractors={subcontractors}
          onBidLogged={updated => {
            onRfqUpdated(updated);
          }}
        />
      )}

      {/* Award Decision Modal */}
      {activeBidToAward && (
        <AwardDecisionModal
          isOpen={!!activeBidToAward}
          onClose={() => setActiveBidToAward(null)}
          rfq={rfq}
          selectedBid={activeBidToAward}
          onAwardCompleted={updated => {
            onRfqUpdated(updated);
            setActiveBidToAward(null);
          }}
        />
      )}

    </div>
  );
};
