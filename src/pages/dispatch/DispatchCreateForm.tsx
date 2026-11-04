import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, QuoteItem, Dispatch } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { 
  X, 
  Truck, 
  User, 
  FileText, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  ShieldAlert, 
  AlertOctagon, 
  ArrowUpRight, 
  Package, 
  CheckCircle2, 
  Boxes, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { FieldError } from '../../components/ui/FieldError';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { fqcService } from '../../services/fqcService';
import { qualityHoldService } from '../../services/qualityHoldService';
import { 
  getOrderLinesQuantities, 
  validateDispatchQuantities, 
  processPartialDispatch,
  CalculatedLineItem 
} from '../../services/partialDispatchService';

interface DispatchCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  availableOrders: Order[];
  preselectedOrder?: Order | null;
  sourceBackorderId?: string;
  sourceBackorderNumber?: string;
  onSuccess: () => void;
}

export const DispatchCreateForm: React.FC<DispatchCreateFormProps> = ({
  isOpen,
  onClose,
  availableOrders,
  preselectedOrder,
  sourceBackorderId,
  sourceBackorderNumber,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const navigate = useNavigate();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // States
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [qualityOverrideChecked, setQualityOverrideChecked] = useState(false);
  const [dispatchNumber, setDispatchNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [transporter, setTransporter] = useState('VRL Logistics India');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Partial fulfillment state per order line: lineItemId -> dispatch quantity input
  const [lineDispatchQtys, setLineDispatchQtys] = useState<Record<string, number | string>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active selected order object
  const activeOrder = useMemo(() => {
    return availableOrders.find(o => o.id === selectedOrderId) || preselectedOrder || null;
  }, [availableOrders, selectedOrderId, preselectedOrder]);

  // Load dispatches for tenant to accurately compute previous dispatches
  const [existingDispatches, setExistingDispatches] = useState<Dispatch[]>([]);
  useEffect(() => {
    if (!tenant?.id) return;
    try {
      const cached = localStorage.getItem(`dispatches_${tenant.id}`) || '[]';
      setExistingDispatches(JSON.parse(cached));
    } catch {
      setExistingDispatches([]);
    }
  }, [tenant?.id, isOpen]);

  // Calculated line items (Ordered Qty, Already Dispatched Qty, Remaining Qty)
  const calculatedLines: CalculatedLineItem[] = useMemo(() => {
    if (!activeOrder) return [];
    return getOrderLinesQuantities(activeOrder, existingDispatches);
  }, [activeOrder, existingDispatches]);

  // Initialize line dispatch inputs when active order or lines change
  useEffect(() => {
    if (!activeOrder || calculatedLines.length === 0) {
      setLineDispatchQtys({});
      return;
    }

    const initialQtys: Record<string, number | string> = {};
    calculatedLines.forEach(line => {
      // Default to remaining quantity if greater than 0, otherwise 0
      initialQtys[line.id] = line.remainingQty > 0 ? line.remainingQty : 0;
    });
    setLineDispatchQtys(initialQtys);
  }, [activeOrder?.id, calculatedLines.length]);

  // Auto pre-fill when preselectedOrder changes
  useEffect(() => {
    if (preselectedOrder) {
      setSelectedOrderId(preselectedOrder.id);
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      setDispatchNumber(`DISP-${Date.now().toString().slice(-4)}`);
      setVehicleNumber('GJ-06-ZZ-');
      setDestination(preselectedOrder.shippingAddress || 'Client Registered Address');
      setDriverPhone(preselectedOrder.phone || '');
    } else {
      setSelectedOrderId('');
      setInvoiceNumber('');
      setDispatchNumber(`DISP-${Date.now().toString().slice(-4)}`);
      setVehicleNumber('');
      setDestination('');
      setDriverPhone('');
    }
  }, [preselectedOrder, isOpen]);

  // Read selected order details and adjust fields if changed manually
  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOrderId(val);
    const ord = availableOrders.find(o => o.id === val);
    if (ord) {
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      setDispatchNumber(`DISP-${Date.now().toString().slice(-4)}`);
      setDriverPhone(ord.phone || '');
      setDestination(ord.shippingAddress || 'Customer site location');
    }
  };

  // Handle single line quantity change with immediate input reflection
  const handleLineQtyChange = (lineId: string, valStr: string) => {
    setLineDispatchQtys(prev => ({
      ...prev,
      [lineId]: valStr === '' ? '' : Math.max(0, Number(valStr))
    }));
  };

  // Quick Action: Fill Maximum Remaining Qty for a line
  const handleSetMaxQty = (lineId: string, maxQty: number) => {
    setLineDispatchQtys(prev => ({
      ...prev,
      [lineId]: maxQty
    }));
  };

  // Quick Action: Clear/Zero out a line
  const handleSetZeroQty = (lineId: string) => {
    setLineDispatchQtys(prev => ({
      ...prev,
      [lineId]: 0
    }));
  };

  // Compute live validation errors per line
  const lineErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    calculatedLines.forEach(line => {
      const rawVal = lineDispatchQtys[line.id];
      if (rawVal === undefined || rawVal === '') return;
      const numVal = Number(rawVal);
      if (isNaN(numVal) || numVal < 0) {
        errors[line.id] = 'Dispatch quantity cannot be negative.';
      } else if (numVal > line.remainingQty) {
        // Acceptance Criteria EC 1: "Cannot dispatch more than remaining quantity (40)."
        errors[line.id] = `Cannot dispatch more than remaining quantity (${line.remainingQty}).`;
      }
    });
    return errors;
  }, [calculatedLines, lineDispatchQtys]);

  // Totals summary across lines
  const fulfillmentSummary = useMemo(() => {
    let totalOrdered = 0;
    let totalAlreadyDispatched = 0;
    let totalShippingNow = 0;
    let totalRemainingAfter = 0;

    calculatedLines.forEach(line => {
      totalOrdered += line.orderedQty;
      totalAlreadyDispatched += line.alreadyDispatchedQty;
      const rawShip = lineDispatchQtys[line.id];
      const shipQty = rawShip === '' || isNaN(Number(rawShip)) ? 0 : Number(rawShip);
      totalShippingNow += shipQty;
      totalRemainingAfter += Math.max(0, line.remainingQty - shipQty);
    });

    const isPartial = totalRemainingAfter > 0;
    const isZero = totalShippingNow <= 0;
    const hasAnyOverShipment = Object.keys(lineErrors).length > 0;

    return {
      totalOrdered,
      totalAlreadyDispatched,
      totalShippingNow,
      totalRemainingAfter,
      isPartial,
      isZero,
      hasAnyOverShipment
    };
  }, [calculatedLines, lineDispatchQtys, lineErrors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !profile) return;
    setFieldErrors({});
    setErrorMsg(null);

    // Form Field inline validation checks
    if (!selectedOrderId || !activeOrder) {
      setFieldErrors({ selectedOrderId: 'Target B2B order selection is required.' });
      setErrorMsg('Target B2B order selection is required.');
      toastError('Validation Failed', 'Target B2B order selection is required.');
      return;
    }

    const errors: Record<string, string> = {};
    if (!vehicleNumber.trim()) {
      errors.vehicleNumber = 'Logistics vehicle fleet registration plate number is required.';
    }
    if (!destination.trim()) {
      errors.destination = 'Shipping destination address is required.';
    }

    // Quality Holds check
    if (selectedOrderId) {
      const holdCheck = qualityHoldService.checkDispatchBlock(selectedOrderId);
      if (holdCheck.isBlocked && !qualityOverrideChecked) {
        errors.selectedOrderId = holdCheck.blockReason;
        toastError('Dispatch Blocked by Quality Hold', 'Batch or Work Order is flagged on Quality Hold. Authorized Quality release required before shipping.');
        setFieldErrors(errors);
        return;
      }

      const releaseCheck = fqcService.checkDispatchReleaseEligibility(selectedOrderId);
      if (!releaseCheck.isEligible && !qualityOverrideChecked) {
        errors.selectedOrderId = releaseCheck.holdReason || 'AUTO-HOLD: Final Quality Control (FQC) inspection is pending or unapproved.';
        toastError('Dispatch Gate Blocked', 'Order is on Quality Auto-Hold. Final inspection sign-off required before releasing to logistics.');
        setFieldErrors(errors);
        return;
      }
    }

    // Edge Case 1 & 2: Validate line dispatch quantities
    const lineValidationItems = calculatedLines.map(line => ({
      lineItemId: line.id,
      itemName: line.name,
      dispatchQty: Number(lineDispatchQtys[line.id]) || 0,
      remainingQty: line.remainingQty
    }));

    const valResult = validateDispatchQuantities(lineValidationItems);
    if (!valResult.isValid) {
      setErrorMsg(valResult.error || 'Please correct the invalid dispatch quantities.');
      toastError('Quantity Validation Blocked', valResult.error || 'Invalid dispatch quantity.');
      return;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toastError('Validation Failed', 'Please inspect the highlighted fields before verifying departure.');
      return;
    }

    setSubmitting(true);

    try {
      const lineInputs = calculatedLines.map(line => ({
        lineItemId: line.id,
        dispatchQty: Number(lineDispatchQtys[line.id]) || 0
      }));

      const dispatchDetails = {
        dispatchNumber: dispatchNumber || `DISP-${Date.now().toString().slice(-4)}`,
        invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
        transporter,
        vehicleNumber: vehicleNumber.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
        driverName,
        driverPhone,
        lrNumber: lrNumber || `LR-${Math.floor(100000 + Math.random() * 900000)}`,
        destination,
        dispatchDate,
        parentBackorderId: sourceBackorderId,
        parentBackorderNumber: sourceBackorderNumber,
        notes: notes || (sourceBackorderNumber ? `Dispatch against Backorder #${sourceBackorderNumber}.` : 'Standard packaging and line fulfillment logged.')
      };

      const result = await processPartialDispatch(
        tenant.id,
        activeOrder,
        lineInputs,
        dispatchDetails,
        profile.name || 'Dispatch Clerk'
      );

      // Notification to user
      const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
      if (isSandbox) {
        const notifKey = `flowops_notifications_${tenant.id}`;
        const cachedN = localStorage.getItem(notifKey);
        const notifs = cachedN ? JSON.parse(cachedN) : [];
        notifs.push({
          id: `notif_dispatch_${result.dispatch.id}_${Date.now()}`,
          tenantId: tenant.id,
          userId: activeOrder.createdBy || 'all',
          type: 'dispatch_sent',
          title: result.dispatch.isPartialDispatch ? 'Partial Consignment Dispatched' : 'Order Fully Dispatched',
          message: `Order #${activeOrder.orderNumber} dispatched (${fulfillmentSummary.totalShippingNow} units shipped). ${result.backorder ? `Backorder #${result.backorder.backorderNumber} auto-created for ${fulfillmentSummary.totalRemainingAfter} units.` : 'Order 100% fulfilled.'}`,
          entityId: activeOrder.id,
          entityType: 'order',
          link: '/orders',
          read: false,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(notifKey, JSON.stringify(notifs));
        window.dispatchEvent(new Event('storage'));
      }

      // Success Feedback
      if (result.backorder) {
        toastSuccess(
          'Partial Dispatch Saved',
          `Shipped ${fulfillmentSummary.totalShippingNow} units. Backorder #${result.backorder.backorderNumber} auto-created for remaining ${fulfillmentSummary.totalRemainingAfter} units with locked terms.`,
          5500
        );
      } else {
        toastSuccess(
          'Consignment Dispatched (100% Fulfilled)',
          `Order #${activeOrder.orderNumber} successfully fulfilled and moved to Dispatched.`,
          4500
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const mappedMsg = getFriendlyErrorMessage(err);
      setErrorMsg(mappedMsg);
      toastError('Dispatch Logging Aborted', mappedMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b flex items-center justify-between bg-slate-900 text-white rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold block">
                OUTWARD CONSIGNMENT & FULFILLMENT
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                Record Dispatch Slip & Line Fulfillment
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form contents */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-mono flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Validation Error</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Section 1: Target Order Selection */}
          <div className="space-y-1.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            {sourceBackorderNumber && (
              <div className="mb-2 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-mono text-amber-900 font-bold">
                <Boxes className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Fulfilling Backorder #{sourceBackorderNumber} (Parent Order: {activeOrder?.orderNumber})</span>
              </div>
            )}
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600">
              1. Target Sales Order *
            </label>
            <select
              value={selectedOrderId}
              onChange={handleOrderChange}
              required
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-medium focus:border-indigo-500 focus:outline-hidden transition"
            >
              <option value="">-- Choose active pending order --</option>
              {availableOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} ({o.customerName}) — Status: {o.status.toUpperCase()}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.selectedOrderId} />

            {/* Quality Hold Guard Banner */}
            {selectedOrderId && (() => {
              const holdCheck = qualityHoldService.checkDispatchBlock(selectedOrderId);
              if (holdCheck.isBlocked) {
                const topHold = holdCheck.blockingHolds[0];
                return (
                  <div className="mt-2.5 p-3 bg-rose-50 border-2 border-rose-400 rounded-lg text-rose-950 text-xs space-y-2 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <strong className="block text-[11px] font-extrabold text-rose-900 uppercase tracking-wide">
                            DISPATCH HARD-LOCKED: QUALITY HOLD ACTIVE [{topHold.id}]
                          </strong>
                          <p className="text-[11px] text-rose-800 font-medium leading-tight mt-1">
                            Target {topHold.targetNumber} ({topHold.partName}): {topHold.holdReason}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/quality-holds')}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold font-mono shrink-0 flex items-center gap-1 transition"
                      >
                        Review Hold <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* FQC Dispatch Release Gate Status Banner */}
            {selectedOrderId && (() => {
              const check = fqcService.checkDispatchReleaseEligibility(selectedOrderId);
              if (check.isEligible && check.status === 'released') {
                return (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <strong className="block text-[11px] font-bold">FQC Release Gate: CLEARED FOR DISPATCH</strong>
                        <span className="text-[10px] text-emerald-700 block">
                          CoC #{check.cocNumber} endorsed by {check.signedBy}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-[11px] font-bold text-amber-950">
                          QUALITY DISPATCH GATE ENFORCED: AUTO-HOLD ACTIVE
                        </strong>
                        <p className="text-[10px] text-amber-800 leading-tight mt-0.5">
                          {check.holdReason || check.message}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-amber-200/80 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold text-amber-900">
                      <input
                        type="checkbox"
                        checked={qualityOverrideChecked}
                        onChange={e => setQualityOverrideChecked(e.target.checked)}
                        className="w-3.5 h-3.5 text-amber-600 rounded"
                      />
                      <span>QA Manager Emergency Concession Override</span>
                    </label>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SECTION 2: ORDER LINE ITEMS FULFILLMENT BREAKDOWN TABLE */}
          {activeOrder && calculatedLines.length > 0 && (
            <div className="border border-indigo-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="px-4 py-3 bg-gradient-to-r from-indigo-50/70 to-slate-50 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
                    2. Order Line Item Quantities & Dispatch Allocation
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full">
                  {calculatedLines.length} Line Item{calculatedLines.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-slate-50 text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold">Line Component</th>
                      <th className="p-3 text-center font-bold">Ordered Qty</th>
                      <th className="p-3 text-center font-bold">Already Dispatched</th>
                      <th className="p-3 text-center font-bold">Remaining Qty</th>
                      <th className="p-3 text-center font-bold w-44">Dispatch Qty *</th>
                      <th className="p-3 text-right font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculatedLines.map(line => {
                      const currentVal = lineDispatchQtys[line.id] !== undefined ? lineDispatchQtys[line.id] : 0;
                      const hasLineError = !!lineErrors[line.id];
                      const isFullyDispatched = line.remainingQty <= 0;

                      return (
                        <tr key={line.id} className="hover:bg-slate-50/50 transition">
                          {/* Item Name */}
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block text-xs">{line.name}</span>
                            {line.specs && (
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate max-w-xs">
                                {line.specs}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono">
                              Rate: ₹{line.unitPrice.toLocaleString('en-IN')} / {line.unit}
                            </span>
                          </td>

                          {/* Ordered Qty */}
                          <td className="p-3 text-center font-mono font-bold text-slate-700">
                            {line.orderedQty}
                          </td>

                          {/* Already Dispatched Qty */}
                          <td className="p-3 text-center font-mono font-medium text-slate-500">
                            {line.alreadyDispatchedQty}
                          </td>

                          {/* Remaining Qty */}
                          <td className="p-3 text-center font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              line.remainingQty > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {line.remainingQty}
                            </span>
                          </td>

                          {/* Dispatch Qty Input with Quick Controls */}
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={line.remainingQty}
                                  value={currentVal}
                                  disabled={isFullyDispatched}
                                  onChange={e => handleLineQtyChange(line.id, e.target.value)}
                                  className={`w-20 p-1.5 text-center font-mono text-xs font-bold rounded-lg border focus:outline-hidden transition ${
                                    hasLineError 
                                      ? 'border-rose-400 bg-rose-50 text-rose-800 focus:border-rose-500' 
                                      : isFullyDispatched 
                                        ? 'bg-slate-100 text-slate-400 border-slate-200' 
                                        : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500'
                                  }`}
                                />
                                
                                {!isFullyDispatched && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSetMaxQty(line.id, line.remainingQty)}
                                      className="px-2 py-1 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded transition cursor-pointer"
                                      title="Set to full remaining quantity"
                                    >
                                      Max
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetZeroQty(line.id)}
                                      className="px-1.5 py-1 text-[10px] font-mono text-slate-500 hover:bg-slate-100 rounded transition cursor-pointer"
                                      title="Do not ship this line"
                                    >
                                      0
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Acceptance Criteria Error Message when Dispatch Qty > Remaining Qty */}
                              {hasLineError && (
                                <p className="text-[10px] font-mono font-bold text-rose-600 leading-tight">
                                  {lineErrors[line.id]}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-right">
                            {isFullyDispatched ? (
                              <span className="inline-flex items-center text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Fulfilled
                              </span>
                            ) : line.alreadyDispatchedQty > 0 ? (
                              <span className="inline-flex items-center text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                Partial ({line.alreadyDispatchedQty}/{line.orderedQty})
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Dynamic Fulfillment Mode Card */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-white border rounded-lg">
                    <span className="text-[10px] text-slate-400 uppercase block font-bold">Total Ordered</span>
                    <span className="text-sm font-bold text-slate-900">{fulfillmentSummary.totalOrdered} units</span>
                  </div>
                  <div className="p-2.5 bg-white border rounded-lg">
                    <span className="text-[10px] text-slate-400 uppercase block font-bold">Already Shipped</span>
                    <span className="text-sm font-bold text-slate-600">{fulfillmentSummary.totalAlreadyDispatched} units</span>
                  </div>
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <span className="text-[10px] text-indigo-700 uppercase block font-bold">Shipping in this Slip</span>
                    <span className="text-sm font-black text-indigo-950">{fulfillmentSummary.totalShippingNow} units</span>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${
                    fulfillmentSummary.totalRemainingAfter > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                  }`}>
                    <span className="text-[10px] uppercase block font-bold text-slate-500">Balance Remaining</span>
                    <span className={`text-sm font-black ${
                      fulfillmentSummary.totalRemainingAfter > 0 ? 'text-amber-800' : 'text-emerald-800'
                    }`}>
                      {fulfillmentSummary.totalRemainingAfter} units
                    </span>
                  </div>
                </div>

                {/* Acceptance Criteria Status Indicator */}
                {fulfillmentSummary.isPartial && fulfillmentSummary.totalShippingNow > 0 && !fulfillmentSummary.hasAnyOverShipment && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs font-sans text-amber-900 flex items-start space-x-2">
                    <Boxes className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block">Partial Fulfillment Mode Active</strong>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        This dispatch will fulfill <strong>{fulfillmentSummary.totalShippingNow} units</strong>. 
                        The parent Order will remain marked as <strong>Partially Dispatched</strong>. 
                        An automated <strong>Backorder</strong> will be generated for the remaining <strong>{fulfillmentSummary.totalRemainingAfter} units</strong> carrying forward original pricing, specifications, and delivery terms.
                      </p>
                    </div>
                  </div>
                )}

                {!fulfillmentSummary.isPartial && fulfillmentSummary.totalShippingNow > 0 && !fulfillmentSummary.hasAnyOverShipment && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs font-sans text-emerald-900 flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block">100% Complete Fulfillment</strong>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        All remaining line items will be 100% fulfilled. The parent Order status will transition to <strong>Dispatched</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Transport and Vehicle Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Dispatch slip number & Invoice Number */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                3. Dispatch & Slip Number *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="DS-No"
                  value={dispatchNumber}
                  onChange={(e) => setDispatchNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
                />
                <input
                  type="text"
                  required
                  placeholder="Invoice No"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Logistics Transporter and LR receipt number */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                4. Carrier & Lorry Receipt (LR) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
                >
                  <option value="VRL Logistics India">VRL Logistics India</option>
                  <option value="SafeExpress Pvt Ltd">SafeExpress</option>
                  <option value="Gati KWE Ltd">Gati Logistics</option>
                  <option value="TCI Freight">TCI Freight (Corp of India)</option>
                  <option value="Direct Truck Arrangement">Direct Factory Truck</option>
                </select>
                <input
                  type="text"
                  placeholder="LR-Number"
                  value={lrNumber}
                  onChange={(e) => setLrNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Vehicle Number & Driver details */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                5. Vehicle Plate Registration Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GJ-06-ZZ-4012"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono uppercase focus:bg-white focus:outline-hidden"
              />
              <FieldError message={fieldErrors.vehicleNumber} />
            </div>

            {/* Driver designation & Phone */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                6. Driver Contact Info
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Driver Name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
                />
                <input
                  type="text"
                  placeholder="Phone: 9880..."
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Destination depot */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                7. Shipping Destination Address *
              </label>
              <input
                type="text"
                required
                placeholder="Industrial zone, sector b, phase 4 city"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
              />
              <FieldError message={fieldErrors.destination} />
            </div>

            {/* Dispatch date setting */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                8. Consignment Departure Date
              </label>
              <input
                type="date"
                required
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Telemetry notes details */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                9. Handling Notes / Freight Instructions
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden leading-relaxed"
                placeholder="Include custom instructions for transit checks, tarp requirements, and forklift details at delivery point..."
              />
            </div>

          </div>

          {/* Action bottom bars */}
          <div className="flex items-center justify-between pt-4 border-t select-none">
            <span className="text-[11px] font-mono text-slate-500">
              {fulfillmentSummary.totalShippingNow > 0 ? (
                <>Ready to ship: <strong className="text-slate-800">{fulfillmentSummary.totalShippingNow} units</strong></>
              ) : (
                <span className="text-amber-700">Enter dispatch quantity above</span>
              )}
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono uppercase font-bold rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || fulfillmentSummary.isZero || fulfillmentSummary.hasAnyOverShipment}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono uppercase font-bold rounded-xl cursor-pointer transition flex items-center space-x-1.5 shadow-sm"
              >
                <Truck className="h-4 w-4" />
                <span>
                  {submitting 
                    ? 'Recording Dispatch...' 
                    : fulfillmentSummary.isPartial 
                      ? 'Confirm Partial Dispatch' 
                      : 'Confirm Full Dispatch'}
                </span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
