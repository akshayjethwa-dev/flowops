// src/components/dispatch/SalesReturnCreditNoteModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  Receipt, 
  FileText,
  DollarSign,
  Package
} from 'lucide-react';
import { Invoice, Order, CreditNote } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { issueSalesReturnCreditNote } from '../../services/partialInvoiceService';

interface SalesReturnCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  order?: Order | null;
  onSuccess?: (creditNote: CreditNote) => void;
}

export const SalesReturnCreditNoteModal: React.FC<SalesReturnCreditNoteModalProps> = ({
  isOpen,
  onClose,
  invoice,
  order: propOrder,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [activeOrder, setActiveOrder] = useState<Order | null>(propOrder || null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number | string>>({});
  const [reason, setReason] = useState('Customer Quality Reject / Dimensional Non-Conformance (Sales Return)');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch parent order if not supplied
  useEffect(() => {
    if (propOrder) {
      setActiveOrder(propOrder);
      return;
    }
    if (!invoice?.orderId || !tenant?.id) return;

    try {
      const cached = localStorage.getItem(`orders_${tenant.id}`);
      if (cached) {
        const orders: Order[] = JSON.parse(cached);
        const match = orders.find(o => o.id === invoice.orderId || o.orderNumber === invoice.orderId);
        if (match) setActiveOrder(match);
      }
    } catch {
      // ignore
    }
  }, [invoice?.orderId, propOrder, tenant?.id]);

  // Reset inputs when modal opens
  useEffect(() => {
    if (!isOpen || !invoice) return;
    setErrorMsg(null);
    setReturnQtys({});
  }, [isOpen, invoice]);

  const invoiceItems = useMemo(() => {
    return (invoice?.items || []).map((itm, idx) => {
      const lineId = itm.lineItemId || itm.id || `line-${idx}`;
      const qty = Number(itm.quantity) || 0;
      const unitPrice = Number(itm.unitPrice) || 0;
      const gstPercent = Number(itm.gstPercent) || 18;

      return {
        lineId,
        name: itm.name,
        hsn: itm.hsn || '8483',
        invoicedQty: qty,
        unitPrice,
        gstPercent
      };
    });
  }, [invoice]);

  const handleReturnQtyChange = (lineId: string, val: string) => {
    setReturnQtys(prev => ({
      ...prev,
      [lineId]: val === '' ? '' : Math.max(0, Number(val))
    }));
  };

  // Calculations for Credit Note
  const creditSummary = useMemo(() => {
    let totalTaxable = 0;
    let totalGst = 0;
    let totalReturnUnits = 0;
    const errors: Record<string, string> = {};

    invoiceItems.forEach(item => {
      const rawVal = returnQtys[item.lineId];
      if (rawVal === undefined || rawVal === '') return;
      const retQty = Number(rawVal);
      if (isNaN(retQty) || retQty < 0) {
        errors[item.lineId] = 'Return quantity cannot be negative.';
      } else if (retQty > item.invoicedQty) {
        errors[item.lineId] = `Cannot return more than invoiced quantity (${item.invoicedQty}).`;
      } else if (retQty > 0) {
        totalReturnUnits += retQty;
        const lineTaxable = Math.round(retQty * item.unitPrice);
        const lineGst = Math.round((lineTaxable * item.gstPercent) / 100);
        totalTaxable += lineTaxable;
        totalGst += lineGst;
      }
    });

    const grandTotal = totalTaxable + totalGst;
    return {
      totalTaxable,
      totalGst,
      grandTotal,
      totalReturnUnits,
      hasErrors: Object.keys(errors).length > 0,
      errors
    };
  }, [invoiceItems, returnQtys]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !invoice) return;
    setErrorMsg(null);

    if (creditSummary.totalReturnUnits <= 0) {
      setErrorMsg('Please specify at least one product with a return quantity greater than zero.');
      return;
    }

    if (creditSummary.hasErrors) {
      setErrorMsg('Please resolve the return quantity errors highlighted below.');
      return;
    }

    const orderToUse = activeOrder || {
      id: invoice.orderId,
      orderNumber: invoice.orderNumber,
      tenantId: tenant.id,
      quoteId: 'q-default',
      customerName: invoice.customerName,
      totalAmount: invoice.total,
      status: 'Partially Dispatched' as const,
      items: invoiceItems.map(i => ({
        id: i.lineId,
        name: i.name,
        quantity: i.invoicedQty,
        orderedQty: i.invoicedQty,
        unitPrice: i.unitPrice,
        gstPercent: i.gstPercent,
        total: i.invoicedQty * i.unitPrice,
        invoicedQty: i.invoicedQty,
        pendingInvoiceQty: 0
      })),
      createdBy: profile?.uid || 'user',
      createdAt: new Date().toISOString()
    };

    const returnItemsPayload = invoiceItems
      .filter(item => Number(returnQtys[item.lineId]) > 0)
      .map(item => ({
        lineItemId: item.lineId,
        returnQty: Number(returnQtys[item.lineId]),
        reason
      }));

    setSubmitting(true);
    try {
      const result = await issueSalesReturnCreditNote({
        tenantId: tenant.id,
        invoice,
        order: orderToUse,
        returnItems: returnItemsPayload,
        reason,
        createdBy: profile?.uid || 'user',
        createdByName: profile?.name || 'Finance User'
      });

      toastSuccess(
        'Sales Return Credit Note Issued',
        `Credit Note #${result.creditNote.creditNoteNumber} issued for ₹${result.creditNote.totalAmount.toLocaleString('en-IN')}. Invoiced Qty reduced by ${creditSummary.totalReturnUnits} units on Order #${orderToUse.orderNumber}.`
      );

      if (onSuccess) {
        onSuccess(result.creditNote);
      }
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to issue sales return credit note.';
      setErrorMsg(msg);
      toastError('Credit Note Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between bg-slate-900 text-white rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-rose-400 font-bold block">
                STATUTORY GST CREDIT NOTE • SALES RETURN
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                Issue Credit Note against Invoice #{invoice.invoiceNumber}
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
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-mono flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Validation Blocked</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Context Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Target Invoice</span>
              <span className="font-bold text-slate-900 block">#{invoice.invoiceNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Parent Order</span>
              <span className="font-bold text-indigo-700 block">#{invoice.orderNumber || invoice.orderId}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Consignee Customer</span>
              <span className="font-bold text-slate-800 block truncate max-w-[150px]">{invoice.customerName}</span>
            </div>
          </div>

          {/* Explanation notice */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1 font-sans">
            <strong className="block font-bold">Acceptance Rule: Invoiced Qty Adjustment</strong>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              When a sales return or partial return occurs, issuing this statutory Credit Note reverses the taxable value and GST liability, and automatically decrements the <strong>Invoiced Qty</strong> on the parent Order lines so remaining balance can be re-invoiced or tracked accurately.
            </p>
          </div>

          {/* Return items selection table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                Select Returned Product Quantities
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                {invoiceItems.length} invoiced item{invoiceItems.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50/70 text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Item Description</th>
                    <th className="p-3 text-center font-bold">Invoiced Qty</th>
                    <th className="p-3 text-right font-bold">Rate</th>
                    <th className="p-3 text-center font-bold w-32">Return Qty *</th>
                    <th className="p-3 text-right font-bold pr-4">Credited Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {invoiceItems.map(item => {
                    const currentVal = returnQtys[item.lineId] !== undefined ? returnQtys[item.lineId] : '';
                    const lineErr = creditSummary.errors[item.lineId];
                    const numRet = Number(currentVal) || 0;
                    const lineCredit = Math.round(numRet * item.unitPrice * (1 + item.gstPercent / 100));

                    return (
                      <tr key={item.lineId} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 font-sans">
                          <strong className="block text-slate-900 text-xs">{item.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">HSN: {item.hsn} • GST: {item.gstPercent}%</span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {item.invoicedQty}
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          ₹{item.unitPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-center">
                          <div className="space-y-1">
                            <input
                              type="number"
                              min={0}
                              max={item.invoicedQty}
                              value={currentVal}
                              onChange={(e) => handleReturnQtyChange(item.lineId, e.target.value)}
                              placeholder="0"
                              className={`w-20 p-1.5 text-center font-mono text-xs font-bold rounded-lg border focus:outline-hidden ${
                                lineErr ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-slate-300 bg-white'
                              }`}
                            />
                            {lineErr && (
                              <p className="text-[10px] text-rose-600 font-bold leading-tight font-sans">
                                {lineErr}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 pr-4">
                          ₹{lineCredit.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Credit Note summary footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center font-mono text-xs">
              <span className="text-slate-500">
                Returning: <strong className="text-slate-800">{creditSummary.totalReturnUnits} units</strong>
              </span>
              <div className="text-right space-y-0.5">
                <div className="text-[11px] text-slate-500">
                  Taxable: ₹{creditSummary.totalTaxable.toLocaleString('en-IN')} + GST: ₹{creditSummary.totalGst.toLocaleString('en-IN')}
                </div>
                <div className="text-sm font-black text-rose-800 font-sans">
                  Total Credited: ₹{creditSummary.grandTotal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Reason input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Statutory Reason for Credit Note *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sales Return - Defective Goods / Customer Rejection"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono uppercase font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || creditSummary.totalReturnUnits <= 0 || creditSummary.hasErrors}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono uppercase font-bold rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
            >
              <RotateCcw className="h-4 w-4" />
              <span>
                {submitting ? 'Issuing Credit Note...' : `Issue Credit Note (₹${creditSummary.grandTotal.toLocaleString('en-IN')})`}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
