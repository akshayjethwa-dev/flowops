// src/components/dispatch/GeneratePartialInvoiceModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Building, 
  Calendar, 
  DollarSign, 
  Layers, 
  Percent,
  Clock,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { Dispatch, Order, Invoice } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { 
  calculatePartialInvoiceBreakdown, 
  generatePartialInvoiceFromDispatch, 
  checkInvoiceExistsForDispatch 
} from '../../services/partialInvoiceService';
import { useNavigate } from 'react-router-dom';

interface GeneratePartialInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: Dispatch | null;
  order?: Order | null;
  onSuccess?: (invoice: Invoice) => void;
}

export const GeneratePartialInvoiceModal: React.FC<GeneratePartialInvoiceModalProps> = ({
  isOpen,
  onClose,
  dispatch,
  order: propOrder,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const navigate = useNavigate();

  const [activeOrder, setActiveOrder] = useState<Order | null>(propOrder || null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Editable GST Rates and HSN codes at time of dispatch (Acceptance criteria EC 3)
  const [lineGstRates, setLineGstRates] = useState<Record<string, number>>({});
  const [lineHsns, setLineHsns] = useState<Record<string, string>>({});

  const [isAlreadyInvoiced, setIsAlreadyInvoiced] = useState(false);
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 1. Fetch parent order if not supplied
  useEffect(() => {
    if (propOrder) {
      setActiveOrder(propOrder);
      return;
    }
    if (!dispatch?.orderId || !tenant?.id) return;

    try {
      const cached = localStorage.getItem(`orders_${tenant.id}`);
      if (cached) {
        const orders: Order[] = JSON.parse(cached);
        const match = orders.find(o => o.id === dispatch.orderId || o.orderNumber === dispatch.orderId);
        if (match) setActiveOrder(match);
      }
    } catch {
      // fallback
    }
  }, [dispatch?.orderId, propOrder, tenant?.id]);

  // 2. Initialize invoice fields and verify if already invoiced (Acceptance Criteria EC 1)
  useEffect(() => {
    if (!isOpen || !dispatch || !tenant?.id) return;

    setValidationError(null);
    setLoadingCheck(true);

    const generatedInvNum = `INV-${Date.now().toString().slice(-4)}`;
    setInvoiceNumber(dispatch.invoiceNumber || generatedInvNum);

    const todayStr = new Date().toISOString().split('T')[0];
    const dispDateStr = dispatch.dispatchDate ? dispatch.dispatchDate.split('T')[0] : todayStr;
    setInvoiceDate(dispDateStr);

    const dueD = new Date(dispDateStr);
    dueD.setDate(dueD.getDate() + 30);
    setDueDate(dueD.toISOString().split('T')[0]);

    // Initialize line GST rates and HSNs
    const initRates: Record<string, number> = {};
    const initHsns: Record<string, string> = {};
    (dispatch.items || []).forEach((itm, idx) => {
      const id = itm.id || `line-${idx}`;
      initRates[id] = typeof itm.gstPercent === 'number' ? itm.gstPercent : 18;
      initHsns[id] = itm.hsn || '8483';
    });
    setLineGstRates(initRates);
    setLineHsns(initHsns);

    // Check duplicate invoice
    checkInvoiceExistsForDispatch(tenant.id, dispatch).then(res => {
      setIsAlreadyInvoiced(res.exists);
      setExistingInvoiceNumber(res.invoiceNumber || dispatch.invoiceNumber || null);
      setLoadingCheck(false);
    }).catch(() => {
      setLoadingCheck(false);
    });
  }, [isOpen, dispatch, tenant?.id]);

  // 3. Calculate line taxable values and tax
  const breakdown = useMemo(() => {
    if (!dispatch) return null;
    return calculatePartialInvoiceBreakdown(dispatch, activeOrder, {
      customGstRates: lineGstRates,
      customHsns: lineHsns
    });
  }, [dispatch, activeOrder, lineGstRates, lineHsns]);

  // Total dispatched quantity
  const totalDispatchedQty = useMemo(() => {
    if (!dispatch?.items) return 0;
    return dispatch.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [dispatch]);

  const handleGstRateChange = (lineId: string, val: string) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    setLineGstRates(prev => ({
      ...prev,
      [lineId]: num
    }));
  };

  const handleHsnChange = (lineId: string, val: string) => {
    setLineHsns(prev => ({
      ...prev,
      [lineId]: val.trim()
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !dispatch) return;
    setValidationError(null);

    // Guard: Zero quantity check (Acceptance Criteria: "If the dispatched quantity is zero (e.g., a return), no invoice is generated.")
    if (totalDispatchedQty <= 0) {
      const err = 'Cannot generate an invoice for a dispatch with zero dispatched quantity.';
      setValidationError(err);
      toastError('Invoicing Blocked', err);
      return;
    }

    // Guard: Duplicate check (Acceptance Criteria EC 1: "User attempts to generate a second invoice for the same dispatch. System blocks; shows: 'An invoice already exists for this dispatch.'")
    if (isAlreadyInvoiced) {
      const err = `An invoice already exists for this dispatch (${existingInvoiceNumber || dispatch.invoiceNumber}).`;
      setValidationError(err);
      toastError('Duplicate Blocked', err);
      return;
    }

    // Guard: Order object check
    const orderToUse = activeOrder || {
      id: dispatch.orderId,
      orderNumber: dispatch.orderId,
      tenantId: tenant.id,
      quoteId: 'q-default',
      customerName: dispatch.customerName || 'B2B Client',
      totalAmount: breakdown?.total || 0,
      status: 'Partially Dispatched' as const,
      items: (dispatch.items || []).map(itm => ({
        ...itm,
        orderedQty: itm.orderedQty || itm.quantity,
        invoicedQty: 0,
        pendingInvoiceQty: itm.quantity
      })),
      createdBy: profile?.uid || 'user',
      createdAt: new Date().toISOString()
    };

    setSubmitting(true);
    try {
      const result = await generatePartialInvoiceFromDispatch({
        tenantId: tenant.id,
        dispatch,
        order: orderToUse,
        invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
        invoiceDate,
        dueDate,
        customGstRates: lineGstRates,
        customHsns: lineHsns,
        notes,
        createdBy: profile?.uid || 'user',
        createdByName: profile?.name || 'Finance User'
      });

      toastSuccess(
        'Partial Tax Invoice Generated',
        `Invoice #${result.invoice.invoiceNumber} created for ${totalDispatchedQty} dispatched units (₹${result.invoice.total.toLocaleString('en-IN')}). Order lines updated with Invoiced Qty.`
      );

      if (onSuccess) {
        onSuccess(result.invoice);
      }
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to generate tax invoice.';
      setValidationError(msg);
      toastError('Invoice Generation Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !dispatch) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b flex items-center justify-between bg-slate-900 text-white rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-400 font-bold block">
                STATUTORY GST BILLING • OUTWARD TAX INVOICE
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                Generate Partial Invoice from Dispatch
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          
          {/* Validation error message */}
          {validationError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-mono flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Validation Blocked</strong>
                <span>{validationError}</span>
              </div>
            </div>
          )}

          {/* DUPLICATE INVOICE WARNING (EC 1) */}
          {isAlreadyInvoiced && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-900 text-xs space-y-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <strong className="font-bold text-amber-950 text-sm">
                  An invoice already exists for this dispatch.
                </strong>
              </div>
              <p className="text-amber-800 font-sans leading-relaxed">
                Dispatch record <strong>#{dispatch.dispatchNumber || dispatch.invoiceNumber}</strong> is already linked to 
                Tax Invoice <strong>#{existingInvoiceNumber || dispatch.invoiceNumber}</strong>. 
                Generating a second invoice for the same dispatch is blocked to prevent double-billing and preserve GST audit integrity.
              </p>
              <div className="pt-1 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/payments');
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-mono font-bold text-[10px] uppercase flex items-center space-x-1 transition cursor-pointer"
                >
                  <span>View Existing Invoice #{existingInvoiceNumber || dispatch.invoiceNumber} in Finance</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* ZERO QUANTITY WARNING */}
          {totalDispatchedQty <= 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                <strong>Zero Dispatched Quantity:</strong> This dispatch has 0 units logged. Invoices cannot be generated for zero-quantity dispatches.
              </span>
            </div>
          )}

          {/* Top metadata summary badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Source Dispatch</span>
              <span className="font-bold text-slate-900 block truncate">{dispatch.dispatchNumber || dispatch.invoiceNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Parent Order</span>
              <span className="font-bold text-indigo-700 block truncate">#{dispatch.orderId}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Client Consignee</span>
              <span className="font-bold text-slate-800 block truncate">{dispatch.customerName || 'Client'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Units Shipped</span>
              <span className="font-black text-emerald-700 block">{totalDispatchedQty} units</span>
            </div>
          </div>

          {/* SECTION 1: DISPATCHED LINE ITEMS TABLE */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-slate-600" />
                <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                  Dispatched Line Items & Statutory Tax Computation
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                Billing ONLY Dispatched Qty
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50/70 text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Product / Component</th>
                    <th className="p-3 font-bold w-24">HSN Code</th>
                    <th className="p-3 text-center font-bold">Dispatched Qty</th>
                    <th className="p-3 text-right font-bold">Rate (₹)</th>
                    <th className="p-3 text-center font-bold w-20">GST Rate %</th>
                    <th className="p-3 text-right font-bold">Taxable Value</th>
                    <th className="p-3 text-right font-bold">Tax Amount</th>
                    <th className="p-3 text-right font-bold pr-4">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {breakdown?.items.map((line) => (
                    <tr key={line.lineItemId} className="hover:bg-slate-50/50 transition">
                      
                      {/* Name */}
                      <td className="p-3 font-sans">
                        <strong className="block text-slate-900 text-xs">{line.name}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">Ref ID: {line.lineItemId}</span>
                      </td>

                      {/* HSN Code Input */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={lineHsns[line.lineItemId] || line.hsn}
                          onChange={(e) => handleHsnChange(line.lineItemId, e.target.value)}
                          className="w-20 p-1 border border-slate-200 rounded font-mono text-xs bg-slate-50 focus:bg-white text-center focus:outline-hidden"
                          placeholder="8483"
                        />
                      </td>

                      {/* Dispatched Qty (Locked to quantity actually dispatched) */}
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded font-black text-xs bg-indigo-50 border border-indigo-200 text-indigo-900">
                          {line.dispatchedQty}
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="p-3 text-right font-medium text-slate-700">
                        ₹{line.unitPrice.toLocaleString('en-IN')}
                      </td>

                      {/* GST Rate % (Editable at dispatch time - EC 3) */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-0.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={lineGstRates[line.lineItemId] !== undefined ? lineGstRates[line.lineItemId] : line.gstPercent}
                            onChange={(e) => handleGstRateChange(line.lineItemId, e.target.value)}
                            className="w-14 p-1 border border-slate-200 rounded font-mono text-xs bg-slate-50 focus:bg-white text-center font-bold focus:outline-hidden"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">%</span>
                        </div>
                      </td>

                      {/* Taxable Value */}
                      <td className="p-3 text-right font-bold text-slate-800">
                        ₹{line.taxableValue.toLocaleString('en-IN')}
                      </td>

                      {/* Tax Amount */}
                      <td className="p-3 text-right text-emerald-700 font-medium">
                        ₹{line.gstAmount.toLocaleString('en-IN')}
                      </td>

                      {/* Line Total */}
                      <td className="p-3 text-right font-bold text-slate-900 pr-4">
                        ₹{line.total.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tax & Grand Total Summary footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-1 text-slate-500">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-bold">GST Engine:</span>
                  <span className="bg-slate-200/80 text-slate-700 px-2 py-0.2 rounded text-[10px]">
                    {breakdown?.taxType === 'intra_state' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-sans">
                  Rates applied at dispatch date. Parent order lines will automatically update Invoiced Qty vs. Pending Qty.
                </p>
              </div>

              <div className="space-y-1 text-right sm:w-64">
                <div className="flex justify-between text-slate-600">
                  <span>Total Taxable Value:</span>
                  <span className="font-bold text-slate-800">₹{(breakdown?.subtotal || 0).toLocaleString('en-IN')}</span>
                </div>
                {breakdown?.taxType === 'intra_state' ? (
                  <>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Output CGST:</span>
                      <span>₹{(breakdown.cgstTotal || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Output SGST:</span>
                      <span>₹{(breakdown.sgstTotal || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Output IGST:</span>
                    <span>₹{(breakdown?.igstTotal || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-indigo-950 pt-2 border-t border-slate-200 font-sans">
                  <span>Invoice Grand Total:</span>
                  <span>₹{(breakdown?.total || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: INVOICE IDENTIFIERS & SCHEDULE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Invoice Number *
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-1002"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono uppercase focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Invoice Date *
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Payment Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="space-y-1 sm:col-span-3">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Billing Notes / Commercial Remarks
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tax invoice for outward partial consignment. E-way bill & LR details cross-referenced on dispatch slip."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
              />
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-[11px] font-mono text-slate-500">
              Taxable Amount: <strong>₹{(breakdown?.subtotal || 0).toLocaleString('en-IN')}</strong> ({totalDispatchedQty} units)
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono uppercase font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={submitting || isAlreadyInvoiced || totalDispatchedQty <= 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono uppercase font-bold rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                <Receipt className="h-4 w-4" />
                <span>
                  {submitting 
                    ? 'Generating Invoice...' 
                    : isAlreadyInvoiced
                      ? 'Invoice Already Exists'
                      : `Generate Tax Invoice (₹${(breakdown?.total || 0).toLocaleString('en-IN')})`}
                </span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
