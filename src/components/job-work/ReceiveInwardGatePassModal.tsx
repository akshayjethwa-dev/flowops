// src/components/job-work/ReceiveInwardGatePassModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowDownLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  ShieldCheck, 
  RotateCcw,
  PackageCheck,
  AlertCircle,
  FileSpreadsheet,
  IndianRupee,
  Layers
} from 'lucide-react';
import { JobWorkGatePass, InwardReturnInput, JobWorkGRN } from '../../types/jobWork';
import { createInwardGatePass } from '../../services/jobWorkService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface ReceiveInwardGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  gatePass: JobWorkGatePass | null;
  availableOutwardPasses?: JobWorkGatePass[];
  onInwardCreated: (inwardPass: JobWorkGatePass, updatedOutwardPass: JobWorkGatePass, grn: JobWorkGRN) => void;
}

export const ReceiveInwardGatePassModal: React.FC<ReceiveInwardGatePassModalProps> = ({
  isOpen,
  onClose,
  gatePass: initialGatePass,
  availableOutwardPasses = [],
  onInwardCreated
}) => {
  const { tenant, user, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [selectedPassId, setSelectedPassId] = useState<string>(initialGatePass?.id || '');
  const activeGatePass = initialGatePass || availableOutwardPasses.find(p => p.id === selectedPassId) || null;

  // Form states
  const [inwardDate, setInwardDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [vendorChallanNo, setVendorChallanNo] = useState<string>('');
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState<string>('');
  const [inspectionStatus, setInspectionStatus] = useState<'accepted' | 'accepted_with_deviation' | 'rejected_by_vendor' | 'rework_needed'>('accepted');
  const [transporterName, setTransporterName] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [lrNumber, setLrNumber] = useState<string>('');
  
  // Financial processing charges & dispute
  const [processingCharges, setProcessingCharges] = useState<number | ''>(5000);
  const [isProcessingChargeDisputed, setIsProcessingChargeDisputed] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>('');
  
  const [generalRemarks, setGeneralRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Line items state
  const [lines, setLines] = useState<Array<{
    gatePassItemId: string;
    materialId?: string;
    materialCode: string;
    materialName: string;
    uom: string;
    sentQty: number;
    balancePending: number;
    receivedQty: number | ''; // Physical dock count
    processedQty: number | ''; // Usable stock
    rejectedQty: number | ''; // Damaged
    rejectionReason: string;
    rejectionDisposition: 'scrap' | 'rework' | 'vendor_debit' | 'quarantine';
    scrapQty: number | '';
    remarks: string;
  }>>([]);

  // Sync state when active gate pass changes
  useEffect(() => {
    if (initialGatePass) {
      setSelectedPassId(initialGatePass.id);
    } else if (availableOutwardPasses.length > 0 && !selectedPassId) {
      const pending = availableOutwardPasses.find(p => p.status === 'issued' || p.status === 'partially_returned');
      if (pending) {
        setSelectedPassId(pending.id);
      }
    }
  }, [initialGatePass, availableOutwardPasses]);

  useEffect(() => {
    if (!activeGatePass) {
      setLines([]);
      return;
    }

    setTransporterName(activeGatePass.vehicleDetails?.transporterName || '');
    setVehicleNumber(activeGatePass.vehicleDetails?.vehicleNumber || '');

    const lineItems = activeGatePass.items.map(it => {
      const balance = it.balanceWithVendor ?? it.quantity;
      return {
        gatePassItemId: it.id,
        materialId: it.materialId,
        materialCode: it.materialCode,
        materialName: it.materialName,
        uom: it.uom,
        sentQty: it.quantity,
        balancePending: balance,
        receivedQty: balance,
        processedQty: balance, // default good processed
        rejectedQty: 0,
        rejectionReason: '',
        rejectionDisposition: 'quarantine' as const,
        scrapQty: 0,
        remarks: ''
      };
    });
    setLines(lineItems);
  }, [activeGatePass?.id]);

  if (!isOpen) return null;

  const handleLineChange = (index: number, field: string, value: any) => {
    setLines(prev => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };

      // Auto-update dock count if processed or rejected changes
      if (field === 'processedQty' || field === 'rejectedQty') {
        const p = typeof updated.processedQty === 'number' ? updated.processedQty : parseFloat(updated.processedQty as string) || 0;
        const r = typeof updated.rejectedQty === 'number' ? updated.rejectedQty : parseFloat(updated.rejectedQty as string) || 0;
        updated.receivedQty = p + r;
      }

      next[index] = updated;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant?.id || !user) {
      toastError('Session expired. Please log in.');
      return;
    }

    if (!activeGatePass) {
      toastError('Please select an Outward Gate Pass to reconcile.');
      return;
    }

    if (lines.length === 0) {
      toastError('No material items found for this gate pass.');
      return;
    }

    // Validation
    let totalReceived = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const processed = typeof l.processedQty === 'number' ? l.processedQty : parseFloat(l.processedQty as string) || 0;
      const rejected = typeof l.rejectedQty === 'number' ? l.rejectedQty : parseFloat(l.rejectedQty as string) || 0;
      const scrap = typeof l.scrapQty === 'number' ? l.scrapQty : parseFloat(l.scrapQty as string) || 0;
      const received = (typeof l.receivedQty === 'number' ? l.receivedQty : parseFloat(l.receivedQty as string) || 0);

      const totalLinePhysical = processed + rejected;

      // EC: Received Qty > Sent Qty
      // EXACT acceptance test requirement: System blocks with: "Received quantity cannot exceed sent quantity."
      if (received > l.sentQty + 0.0001 || totalLinePhysical > l.sentQty + 0.0001) {
        toastError('Received quantity cannot exceed sent quantity.');
        return;
      }

      // Check against current pending balance with vendor
      if (totalLinePhysical + scrap > l.balancePending + 0.0001) {
        toastError(`Line #${i + 1} (${l.materialName}): Total returned (${totalLinePhysical + scrap}) exceeds balance remaining with vendor (${l.balancePending} ${l.uom}).`);
        return;
      }

      // EC: Material is returned damaged: rejected qty must have a reason
      if (rejected > 0 && !l.rejectionReason.trim()) {
        toastError(`Line #${i + 1} (${l.materialName}): Please specify a reason for the ${rejected} ${l.uom} rejected material.`);
        return;
      }

      totalReceived += (totalLinePhysical + scrap);
    }

    if (totalReceived <= 0) {
      toastError('Please enter at least one received or processed quantity.');
      return;
    }

    // EC: Processing charges are disputed
    if (isProcessingChargeDisputed && !disputeReason.trim()) {
      toastError('Please specify the reason for disputing processing charges.');
      return;
    }

    setSubmitting(true);
    try {
      const input: InwardReturnInput = {
        outwardGatePassId: activeGatePass.id,
        jobWorkerId: activeGatePass.jobWorkerId,
        jobWorkerName: activeGatePass.jobWorkerName,
        inwardDate,
        vendorDeliveryChallanNo: vendorChallanNo || undefined,
        vendorInvoiceNo: vendorInvoiceNo || undefined,
        inspectionStatus,
        vehicleDetails: {
          transporterName: transporterName || undefined,
          vehicleNumber: vehicleNumber || undefined,
          lrNumber: lrNumber || undefined
        },
        items: lines.map(l => {
          const proc = typeof l.processedQty === 'number' ? l.processedQty : parseFloat(l.processedQty as string) || 0;
          const rej = typeof l.rejectedQty === 'number' ? l.rejectedQty : parseFloat(l.rejectedQty as string) || 0;
          const scr = typeof l.scrapQty === 'number' ? l.scrapQty : parseFloat(l.scrapQty as string) || 0;
          return {
            gatePassItemId: l.gatePassItemId,
            materialId: l.materialId,
            materialCode: l.materialCode,
            materialName: l.materialName,
            uom: l.uom,
            sentQty: l.sentQty,
            receivedQty: proc + rej,
            processedQty: proc,
            rejectedQty: rej,
            rejectionReason: rej > 0 ? l.rejectionReason.trim() : undefined,
            rejectionDisposition: rej > 0 ? l.rejectionDisposition : undefined,
            scrapQty: scr,
            remarks: l.remarks || undefined
          };
        }),
        processingCharges: typeof processingCharges === 'number' ? processingCharges : parseFloat(processingCharges as string) || 0,
        isProcessingChargeDisputed,
        disputeReason: isProcessingChargeDisputed ? disputeReason.trim() : undefined,
        generalRemarks: generalRemarks || undefined
      };

      const result = await createInwardGatePass(
        tenant.id,
        input,
        user,
        isSandboxMode
      );

      toastSuccess(
        `Inward Gate Pass ${result.inwardPass.gatePassNumber} & GRN ${result.grn.grnNumber} generated! Own stock updated (+${result.grn.totalProcessedQty}), vendor stock reconciled.`
      );
      
      onInwardCreated(result.inwardPass, result.outwardPass, result.grn);
      onClose();
    } catch (err: any) {
      console.error('Failed to receive inward gate pass:', err);
      toastError(err.message || 'Failed to create Inward Gate Pass.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-300">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Create Gate Pass (Inward) & Reconcile Returns</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-700">
                  Auto-Generates GRN
                </span>
              </div>
              <p className="text-xs text-emerald-300">
                Receive processed goods back from job worker, restore usable Own Stock, and update Vendor Stock Ledger.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          
          {/* Step 1: Select Outward Gate Pass if not preselected */}
          {!initialGatePass && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Select Active Outward Gate Pass *
              </label>
              <select
                required
                value={selectedPassId}
                onChange={(e) => setSelectedPassId(e.target.value)}
                className="w-full text-xs font-medium rounded-lg border-slate-300 bg-white py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">-- Choose Outward Gate Pass to Reconcile --</option>
                {availableOutwardPasses
                  .filter(p => p.type === 'outward' && (p.status === 'issued' || p.status === 'partially_returned'))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.gatePassNumber} — {p.jobWorkerName} ({p.natureOfWork}) [Dispatched: {p.dispatchedDate}, Status: {p.status.replace('_', ' ')}]
                    </option>
                  ))}
              </select>
            </div>
          )}

          {activeGatePass && (
            <>
              {/* Outward Gate Pass Summary Banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Gate Pass Ref</span>
                  <span className="font-mono font-bold text-indigo-950">{activeGatePass.gatePassNumber}</span>
                  {activeGatePass.linkedJobWorkOrderNumber && (
                    <span className="text-[10px] text-slate-500 block">JWO: {activeGatePass.linkedJobWorkOrderNumber}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Job Worker (Vendor)</span>
                  <span className="font-bold text-slate-900">{activeGatePass.jobWorkerName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Nature of Work</span>
                  <span className="font-semibold text-slate-900">{activeGatePass.natureOfWork}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Dispatch Date</span>
                  <span className="font-semibold text-slate-900">{activeGatePass.dispatchedDate} (Due: {activeGatePass.expectedReturnDate})</span>
                </div>
              </div>

              {/* Inward receipt logistics & dates */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={inwardDate}
                    onChange={(e) => setInwardDate(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 py-1.5 px-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor Challan No
                  </label>
                  <input
                    type="text"
                    value={vendorChallanNo}
                    onChange={(e) => setVendorChallanNo(e.target.value)}
                    placeholder="e.g. DC-XYZ-2026/08"
                    className="w-full text-xs font-mono rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 py-1.5 px-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor Invoice No
                  </label>
                  <input
                    type="text"
                    value={vendorInvoiceNo}
                    onChange={(e) => setVendorInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-9901"
                    className="w-full text-xs font-mono rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 py-1.5 px-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Return Vehicle / Transporter
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. MH-12-FG-4491"
                    className="w-full text-xs font-mono rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 py-1.5 px-2.5"
                  />
                </div>
              </div>

              {/* Material Reconciliation Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Material Return Breakdown & Reconciliation</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    * Usable Own Stock increases strictly by <strong className="text-emerald-700">Processed Qty</strong>. Damaged items are tracked separately.
                  </span>
                </div>

                <div className="space-y-3">
                  {lines.map((l, idx) => (
                    <div key={l.gatePassItemId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      
                      {/* Line Title & Balances */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs border-b border-slate-200 pb-2">
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{l.materialName}</span>
                          <span className="text-slate-500 font-mono ml-2">[{l.materialCode}]</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span className="text-slate-600">Sent Qty: <strong>{l.sentQty} {l.uom}</strong></span>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                            Balance with Vendor: {l.balancePending} {l.uom}
                          </span>
                        </div>
                      </div>

                      {/* Line Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        
                        {/* 1. Received Qty (Total physical at dock) */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Received Qty (Total Dock) *
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={l.receivedQty}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                              handleLineChange(idx, 'receivedQty', val);
                              // Auto adjust processed qty to equal received qty minus current rejected
                              if (typeof val === 'number') {
                                const rej = typeof l.rejectedQty === 'number' ? l.rejectedQty : 0;
                                handleLineChange(idx, 'processedQty', Math.max(0, val - rej));
                              }
                            }}
                            className="w-full text-xs font-bold rounded-lg border-slate-300 bg-white py-1.5 px-2 text-slate-900 focus:ring-emerald-500"
                            placeholder="0"
                          />
                        </div>

                        {/* 2. Processed Qty (Usable Good Stock) */}
                        <div>
                          <label className="block text-[11px] font-semibold text-emerald-800 mb-1 flex items-center justify-between">
                            <span>Processed Qty (Usable) *</span>
                            <span className="text-[10px] text-emerald-600 font-normal">Adds to Own Stock</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={l.processedQty}
                            onChange={(e) => handleLineChange(idx, 'processedQty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full text-xs font-bold rounded-lg border-emerald-400 bg-white py-1.5 px-2 text-emerald-950 focus:ring-emerald-500 focus:border-emerald-500 ring-1 ring-emerald-200"
                            placeholder="0"
                          />
                        </div>

                        {/* 3. Rejected Qty (Damaged) */}
                        <div>
                          <label className="block text-[11px] font-semibold text-rose-800 mb-1 flex items-center justify-between">
                            <span>Rejected Qty (Damaged)</span>
                            <span className="text-[10px] text-rose-600 font-normal">Quarantine</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={l.rejectedQty}
                            onChange={(e) => handleLineChange(idx, 'rejectedQty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full text-xs font-bold rounded-lg border-rose-300 bg-white py-1.5 px-2 text-rose-950 focus:ring-rose-500 focus:border-rose-500"
                            placeholder="0"
                          />
                        </div>

                        {/* 4. Scrap / Loss */}
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-800 mb-1 flex items-center justify-between">
                            <span>Process Scrap / Loss</span>
                            <span className="text-[10px] text-amber-600 font-normal">Write-off</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={l.scrapQty}
                            onChange={(e) => handleLineChange(idx, 'scrapQty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full text-xs font-bold rounded-lg border-amber-300 bg-white py-1.5 px-2 text-amber-950 focus:ring-amber-500"
                            placeholder="0"
                          />
                        </div>

                      </div>

                      {/* Rejection Details Row (Shown if Rejected Qty > 0) */}
                      {(typeof l.rejectedQty === 'number' ? l.rejectedQty : parseFloat(l.rejectedQty as string) || 0) > 0 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span>Damaged / Rejection Tracking (Edge Case)</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                                Reason for Rejection *
                              </label>
                              <input
                                type="text"
                                required
                                value={l.rejectionReason}
                                onChange={(e) => handleLineChange(idx, 'rejectionReason', e.target.value)}
                                placeholder="e.g. Surface cracks, hardness out of spec, machining chatter"
                                className="w-full text-xs rounded-lg border-rose-300 bg-white py-1.5 px-2 text-rose-950 focus:ring-rose-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                                Defective Goods Disposition
                              </label>
                              <select
                                value={l.rejectionDisposition}
                                onChange={(e) => handleLineChange(idx, 'rejectionDisposition', e.target.value)}
                                className="w-full text-xs rounded-lg border-rose-300 bg-white py-1.5 px-2 text-rose-950 focus:ring-rose-500"
                              >
                                <option value="quarantine">Hold in Quarantine Bay for Inspection</option>
                                <option value="scrap">Scrap / Write-off</option>
                                <option value="rework">Send for Internal Rework</option>
                                <option value="vendor_debit">Debit Note to Job Worker</option>
                              </select>
                            </div>
                          </div>
                          <p className="text-[10px] text-rose-700">
                            Note: The {l.rejectedQty} {l.uom} rejected material will NOT increase usable Own Stock and is tracked separately.
                          </p>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              </div>

              {/* Financials & Processing Charges Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <IndianRupee className="w-4 h-4 text-indigo-600" />
                    <span>Processing Charges & Finance Audit</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Recorded in auto-generated GRN
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Processing Charges (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={processingCharges}
                        onChange={(e) => setProcessingCharges(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full text-xs font-mono font-bold rounded-lg border-slate-300 pl-7 pr-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g. 5000"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2.5 p-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={isProcessingChargeDisputed}
                        onChange={(e) => setIsProcessingChargeDisputed(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-rose-950 block">
                          Dispute Processing Charges
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Flag for finance review before payment approval
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Dispute Reason Box */}
                {isProcessingChargeDisputed && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                    <label className="block text-[11px] font-bold text-amber-900">
                      Dispute Reason for Finance Review *
                    </label>
                    <input
                      type="text"
                      required
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="e.g. Billed at ₹50/Kg instead of agreed PO rate ₹40/Kg; or rejection penalty deduction required."
                      className="w-full text-xs rounded-lg border-amber-300 bg-white py-1.5 px-2.5 text-amber-950 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-amber-800">
                      The GRN will be created successfully, but payment will be withheld until finance clears the dispute.
                    </p>
                  </div>
                )}
              </div>

              {/* General Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  General Remarks / Stores Notes
                </label>
                <input
                  type="text"
                  value={generalRemarks}
                  onChange={(e) => setGeneralRemarks(e.target.value)}
                  placeholder="e.g. Goods received at Bay 2, visual inspection passed, hardness certificate attached."
                  className="w-full text-xs rounded-lg border-slate-300 py-1.5 px-3 focus:ring-emerald-500"
                />
              </div>

              {/* Footer Controls */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    Saving generates Inward Pass (GP/IN) & GRN (GRN/JW), updates Own Stock (+Good Qty) & clears Vendor Stock.
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-bold shadow-md hover:shadow flex items-center gap-2 transition-colors"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating GRN...
                      </>
                    ) : (
                      <>
                        <PackageCheck className="w-4 h-4" />
                        Save Inward & Generate GRN
                      </>
                    )}
                  </button>
                </div>
              </div>

            </>
          )}

        </form>

      </div>
    </div>
  );
};
