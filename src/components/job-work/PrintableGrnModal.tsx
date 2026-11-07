// src/components/job-work/PrintableGrnModal.tsx

import React from 'react';
import { 
  X, 
  Printer, 
  FileCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Calendar,
  Truck,
  IndianRupee,
  Layers
} from 'lucide-react';
import { JobWorkGRN } from '../../types/jobWork';
import { useAuth } from '../../hooks/useAuth';

interface PrintableGrnModalProps {
  isOpen: boolean;
  onClose: () => void;
  grn: JobWorkGRN | null;
}

export const PrintableGrnModal: React.FC<PrintableGrnModalProps> = ({
  isOpen,
  onClose,
  grn
}) => {
  const { tenant } = useAuth();

  if (!isOpen || !grn) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Modal Toolbar (hidden during print) */}
        <div className="print:hidden px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Goods Receipt Note (Job Work GRN)</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {grn.grnNumber}
                </span>
                {grn.isProcessingChargeDisputed && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-900 text-amber-200 border border-amber-700">
                    Disputed Charges
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Official store receipt note reconciling outward dispatch with returned processed inventory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print GRN</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-8 space-y-6 text-slate-900 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  FACTORY STORES & INVENTORY RECONCILIATION
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {tenant?.companyName || 'FLOWOPS MANUFACTURING'}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Job-Work Goods Receipt Note (GRN) • Rule 45 CGST Verification
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono text-slate-500 uppercase">GRN Number</div>
                <div className="text-xl font-mono font-black text-emerald-900">{grn.grnNumber}</div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Receipt Date: <strong className="text-slate-900">{grn.receiptDate}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Reference Links & Job Worker Info Grid */}
          <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50 text-xs">
            
            {/* Left: Job Worker */}
            <div className="space-y-1.5 border-r border-slate-200 pr-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Job Worker / Processor
              </span>
              <div className="font-bold text-slate-900 text-sm">{grn.jobWorkerName}</div>
              {grn.jobWorkerGst && (
                <div className="font-mono text-slate-600">GSTIN: {grn.jobWorkerGst}</div>
              )}
              {grn.vendorChallanNo && (
                <div className="font-mono text-slate-700">
                  Vendor Challan No: <strong>{grn.vendorChallanNo}</strong>
                </div>
              )}
              {grn.vendorInvoiceNo && (
                <div className="font-mono text-slate-700">
                  Vendor Invoice No: <strong>{grn.vendorInvoiceNo}</strong>
                </div>
              )}
            </div>

            {/* Right: Pass References & Logistics */}
            <div className="space-y-1.5 pl-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Document & Gate Pass References
              </span>
              <div className="flex justify-between">
                <span className="text-slate-500">Inward Gate Pass:</span>
                <span className="font-mono font-bold text-emerald-800">{grn.inwardGatePassNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outward Gate Pass:</span>
                <span className="font-mono font-bold text-indigo-900">{grn.outwardGatePassNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Return Vehicle:</span>
                <span className="font-mono font-semibold text-slate-900">{grn.vehicleNumber || 'Direct Transfer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Received By:</span>
                <span className="font-semibold text-slate-900">{grn.receivedByName}</span>
              </div>
            </div>

          </div>

          {/* Items Reconciliation Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 uppercase">
              <span>Materials Received & Reconciliation Breakdown</span>
              <span className="text-[11px] text-slate-500 normal-case font-normal">
                Good stock updated into active inventory; rejections isolated in quarantine.
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Material Description</th>
                    <th className="px-3 py-2.5">Item Code</th>
                    <th className="px-3 py-2.5 text-right">Sent Qty</th>
                    <th className="px-3 py-2.5 text-right">Received Qty</th>
                    <th className="px-3 py-2.5 text-right text-emerald-900 bg-emerald-50">Processed (Good)</th>
                    <th className="px-3 py-2.5 text-right text-rose-900 bg-rose-50">Rejected</th>
                    <th className="px-3 py-2.5">Remarks / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {grn.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-400 font-sans">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 font-sans">
                        {it.materialName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{it.materialCode}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700">
                        {it.sentQty} {it.uom}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                        {it.receivedQty} {it.uom}
                      </td>
                      <td className="px-3 py-2.5 text-right font-black text-emerald-700 bg-emerald-50/50">
                        +{it.processedQty} {it.uom}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-rose-700 bg-rose-50/50">
                        {it.rejectedQty > 0 ? `${it.rejectedQty} ${it.uom}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-sans text-[11px] text-slate-600">
                        {it.rejectedQty > 0 ? (
                          <div className="text-rose-700 font-medium">
                            <span>Reason: {it.rejectionReason || 'Damaged / Defect'}</span>
                            {it.scrapReworkDisposition && (
                              <span className="block text-[10px] text-slate-500 uppercase">
                                Action: {it.scrapReworkDisposition}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-700">Accepted into Own Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-right font-bold text-slate-900 font-sans">
                      Totals:
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-emerald-800 bg-emerald-50">
                      +{grn.totalProcessedQty}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-rose-800 bg-rose-50">
                      {grn.totalRejectedQty > 0 ? grn.totalRejectedQty : '0'}
                    </td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Financials & Processing Charges Audit */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-indigo-600" />
                <span>Job Work Financial Verification</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                grn.isProcessingChargeDisputed 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {grn.isProcessingChargeDisputed ? '⚠️ Disputed / Under Review' : '✓ Charges Cleared'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500">Approved / Billed Processing Charges:</span>
                <div className="text-xl font-bold font-mono text-slate-900">
                  ₹{grn.processingCharges.toLocaleString('en-IN')}
                </div>
              </div>

              {grn.isProcessingChargeDisputed && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    <span>Dispute Reason (Flagged for Finance Review):</span>
                  </div>
                  <p className="text-xs italic">{grn.disputeReason || 'Charge discrepancy flagged by stores user.'}</p>
                  <p className="text-[10px] text-amber-800">
                    Payment hold initiated. Finance authorization required before payout.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Inspection Remarks */}
          {grn.inspectionRemarks && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <strong className="text-slate-800 block text-[11px] uppercase mb-0.5">Quality Inspection Remarks:</strong>
              {grn.inspectionRemarks}
            </div>
          )}

          {/* Signatures & Stamp block */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-4 gap-4 text-center text-xs text-slate-500">
            <div className="space-y-12">
              <div className="h-8 border-b border-dashed border-slate-300" />
              <div>Stores Inward Inspector</div>
            </div>
            <div className="space-y-12">
              <div className="h-8 border-b border-dashed border-slate-300" />
              <div>Quality Assurance (QA)</div>
            </div>
            <div className="space-y-12">
              <div className="h-8 border-b border-dashed border-slate-300" />
              <div>Security / Gate Officer</div>
            </div>
            <div className="space-y-12">
              <div className="h-8 border-b border-dashed border-slate-300" />
              <div>Job Worker Representative</div>
            </div>
          </div>

          {/* Document Footer Notice */}
          <div className="text-[10px] text-slate-400 text-center pt-2">
            This Goods Receipt Note is auto-generated by FlowOps ERP upon verification of physical goods received against Outward Gate Pass {grn.outwardGatePassNumber}.
          </div>

        </div>

      </div>
    </div>
  );
};
