// src/components/quotations/RfqToOrderConversionModal.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  CheckCircle2, 
  FileCheck2, 
  ArrowRight, 
  Layers, 
  RotateCw, 
  Calendar, 
  Hash, 
  FileText, 
  ShieldCheck, 
  Info, 
  Sparkles,
  DollarSign,
  AlertCircle,
  Truck,
  Building,
  Check
} from 'lucide-react';
import { Quote, Order } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { 
  convertApprovedQuoteToSalesOrder, 
  generateNextSalesOrderNumber 
} from '../../services/rfqOrderConversionService';

interface RfqToOrderConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  onOrderCreated?: (order: Order) => void;
}

export const RfqToOrderConversionModal: React.FC<RfqToOrderConversionModalProps> = ({
  isOpen,
  onClose,
  quote,
  onOrderCreated
}) => {
  const navigate = useNavigate();
  const { profile, tenant, isSandboxMode } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [loadingNumber, setLoadingNumber] = useState(false);
  const [soNumber, setSoNumber] = useState('');
  const [customerPoNumber, setCustomerPoNumber] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [conversionNotes, setConversionNotes] = useState('');
  const [converting, setConverting] = useState(false);
  const [editSoNumber, setEditSoNumber] = useState(false);

  // Initialize generated SO Number & default delivery date
  useEffect(() => {
    if (isOpen && tenant?.id) {
      let isMounted = true;
      setLoadingNumber(true);

      // Pre-fill existing customer PO if already noted on quote
      if (quote.customerPoNumber) {
        setCustomerPoNumber(quote.customerPoNumber);
      }

      // Default delivery date: quote validUntil or +21 days
      const defDelivery = quote.validUntil 
        ? quote.validUntil.split('T')[0] 
        : new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().split('T')[0];
      setDeliveryDate(defDelivery);

      generateNextSalesOrderNumber(tenant.id, isSandboxMode)
        .then(nextSo => {
          if (isMounted) {
            setSoNumber(nextSo);
            setLoadingNumber(false);
          }
        })
        .catch(err => {
          console.error('Failed generating SO sequence:', err);
          if (isMounted) {
            setSoNumber(`SO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
            setLoadingNumber(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, tenant?.id, quote, isSandboxMode]);

  if (!isOpen) return null;

  const handleConvert = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile || !tenant) return;

    if (!soNumber.trim()) {
      toastError('Sales Order Number is required.');
      return;
    }

    setConverting(true);

    try {
      const result = await convertApprovedQuoteToSalesOrder({
        quote,
        customerPoNumber: customerPoNumber.trim(),
        poDate,
        deliveryDate,
        soNumberOverride: soNumber.trim(),
        notes: conversionNotes.trim(),
        tenantId: tenant.id,
        tenantName: tenant.companyName,
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Sales Engineer',
          email: profile.email
        },
        isSandboxMode
      });

      toastSuccess(
        `Sales Order #${result.order.orderNumber} Created!`, 
        `Converted with 0 re-entry. Carried forward ${result.jobs.length} BOM jobs into shopfloor WIP.`
      );

      if (onOrderCreated) {
        onOrderCreated(result.order);
      }

      onClose();

      // Seamlessly navigate to Orders analytical / Kanban board with the new order active
      navigate('/orders', { state: { preselectedOrderId: result.order.id } });

    } catch (err: any) {
      console.error('Order conversion failed:', err);
      toastError(err.message || 'Failed to convert quotation into sales order');
    } finally {
      setConverting(false);
    }
  };

  const totalQty = quote.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                  1-Click Conversion
                </span>
                <span className="text-[11px] font-mono text-slate-400">Quote #{quote.quoteNumber}</span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                Convert Approved Quote to Sales Order
              </h3>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm font-sans flex-1">

          {/* Quick Summary Banner */}
          <div className="bg-gradient-to-r from-emerald-50/80 via-sky-50/60 to-white border border-emerald-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Building className="h-4 w-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-900">{quote.customerName}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-mono">
                {quote.items?.length || 0} line items • {totalQty} total units • Grand Total: <span className="font-bold text-slate-900 font-mono">₹{quote.total.toLocaleString('en-IN')}</span>
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Approval Status</span>
              <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                <Check className="h-3 w-3 stroke-[3]" />
                <span>Certified Approved</span>
              </span>
            </div>
          </div>

          {/* Core Configuration Form */}
          <form id="so-conversion-form" onSubmit={handleConvert} className="space-y-4">
            
            {/* SO Number and Customer PO Reference Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Sales Order Number Generation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    <span>Sales Order (SO) Number</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditSoNumber(!editSoNumber)}
                    className="text-[10px] font-mono text-sky-600 hover:text-sky-800 underline cursor-pointer"
                  >
                    {editSoNumber ? 'Lock Auto' : 'Custom'}
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    value={soNumber}
                    onChange={(e) => setSoNumber(e.target.value)}
                    disabled={!editSoNumber}
                    placeholder="SO-2026-0001"
                    className={`w-full font-mono text-xs p-2.5 rounded-xl border ${
                      editSoNumber 
                        ? 'border-sky-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900' 
                        : 'border-slate-200 bg-slate-50 text-slate-800 font-bold cursor-not-allowed'
                    }`}
                    required
                  />
                  {loadingNumber && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin h-4 w-4 border-2 border-sky-600 border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {editSoNumber ? 'Manual sequential override' : 'Auto-generated enterprise sequence'}
                </p>
              </div>

              {/* Customer PO Reference (CRITICAL ACCEPTANCE CRITERIA) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <FileText className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Customer PO Reference</span>
                  <span className="text-[10px] font-mono text-indigo-600 font-normal">(Client PO#)</span>
                </label>
                <input
                  type="text"
                  value={customerPoNumber}
                  onChange={(e) => setCustomerPoNumber(e.target.value)}
                  placeholder="e.g. PO/TATA/2026/0891"
                  className="w-full font-mono text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500">
                  Client purchase order code carried into dispatch & invoice records.
                </p>
              </div>

            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Customer PO Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Customer PO Date</span>
                </label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full font-mono text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700"
                />
              </div>

              {/* Promised Delivery / Dispatch Target Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Truck className="h-3.5 w-3.5 text-slate-400" />
                  <span>Target Delivery Date</span>
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full font-mono text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700"
                  required
                />
              </div>

            </div>

            {/* Shopfloor Production Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Special Manufacturing Instructions / Shopfloor Notes (Optional)
              </label>
              <textarea
                value={conversionNotes}
                onChange={(e) => setConversionNotes(e.target.value)}
                placeholder="Special notes on tolerance, surface coating, heat treatment, or packaging instructions..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700 resize-none"
              />
            </div>

          </form>

          {/* Zero Re-Entry Guarantee Cards */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider block">
              Automated Data Carry-Forward Guarantee
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Bill of Materials (BOM)</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {quote.items.length} parts and raw material specs linked directly to shopfloor jobs.
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center space-x-1.5 text-sky-700 font-bold text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                  <span>Manufacturing Routing</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Cutting → Welding → Machining → Assembly → QC initialized in WIP.
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center space-x-1.5 text-indigo-700 font-bold text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>Pricing & Taxes</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Unit rates, GST ({quote.items[0]?.gstPercent || 18}%), discounts, & ₹{quote.total.toLocaleString('en-IN')} locked.
                </p>
              </div>

            </div>
          </div>

          {/* Line Items Mini Review */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100/80 px-3.5 py-2 border-b border-slate-200 flex justify-between items-center text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider">
              <span>Carried Forward Line Items ({quote.items.length})</span>
              <span>Total Price</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto bg-white">
              {quote.items.map((item, idx) => (
                <div key={item.id || idx} className="px-3.5 py-2 flex items-center justify-between text-xs">
                  <div className="truncate max-w-[320px]">
                    <span className="font-semibold text-slate-800 block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.quantity} {item.unit || 'pcs'} × ₹{item.unitPrice.toLocaleString('en-IN')} {item.specs ? `• ${item.specs}` : ''}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 text-xs shrink-0">
                    ₹{item.total.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={converting}
            className="text-xs font-mono uppercase tracking-wider font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="so-conversion-form"
            disabled={converting || loadingNumber}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono uppercase tracking-wider font-bold text-xs px-5 py-2.5 rounded-xl flex items-center space-x-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {converting ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin text-white" />
                <span>Generating Order...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-emerald-200" />
                <span>Convert to Sales Order (1-Click)</span>
                <ArrowRight className="h-4 w-4 text-emerald-200" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
