// src/pages/orders/JobDetailPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useJobDetail } from '../../hooks/useProduction';
import { sendWhatsAppNotification } from '../../utils/whatsapp';
import { GuardedAction } from '../../components/layout/GuardedAction';
import { 
  ArrowLeft, 
  Layers, 
  Calendar, 
  User, 
  Briefcase, 
  MessageSquare, 
  Plus, 
  Clock, 
  CheckCircle,
  Building,
  FileText,
  DollarSign,
  AlertCircle,
  Zap,
  Printer,
  Boxes,
  CheckCircle2,
  ArrowRight,
  Truck,
  Package,
  History,
  RotateCcw,
  Receipt
} from 'lucide-react';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentsList } from '../../components/AttachmentsList';
import { FileSymlink } from 'lucide-react';
import { GenerateWorkOrdersModal } from '../../components/orders/GenerateWorkOrdersModal';
import { ShopTravelerModal } from '../../components/orders/ShopTravelerModal';
import { useWorkOrders, WorkOrder } from '../../hooks/useWorkOrders';
import { DispatchCreateForm } from '../dispatch/DispatchCreateForm';
import { getOrderLinesQuantities, getBackordersForOrder } from '../../services/partialDispatchService';
import { GeneratePartialInvoiceModal } from '../../components/dispatch/GeneratePartialInvoiceModal';
import { Order, Backorder, Dispatch } from '../../types';

const defaultStages = [
  { value: 'cutting', label: 'Material Cutting' },
  { value: 'welding', label: 'Pre-Heating & Welding' },
  { value: 'machining', label: 'Precision Machining' },
  { value: 'assembly', label: 'Shopfloor Assembly' },
  { value: 'quality_check', label: 'NDT & Quality Check' },
  { value: 'ready', label: 'Ready for Dispatch' }
];

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { job, order, loading, error, addJobComment, updateJobStage } = useJobDetail(tenant?.id, jobId);
  const { workOrders } = useWorkOrders(tenant?.id);

  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [selectedStage, setSelectedStage] = useState('cutting');
  const [stageChangeNotes, setStageChangeNotes] = useState('');
  const [updatingStage, setUpdatingStage] = useState(false);
  const [stageFeedback, setStageFeedback] = useState<string | null>(null);

  // Sales Order → Work Order Generation & Traveler Modal State
  const [showGenerateWoModal, setShowGenerateWoModal] = useState(false);
  const [showTravelerModal, setShowTravelerModal] = useState(false);
  const [travelerWorkOrder, setTravelerWorkOrder] = useState<WorkOrder | null>(null);

  // Partial dispatch & fulfillment modal state
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [invoiceModalDispatch, setInvoiceModalDispatch] = useState<Dispatch | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [orderDispatches, setOrderDispatches] = useState<Dispatch[]>([]);
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fallback order when not directly loaded as separate order doc
  const effectiveOrder: Order = useMemo(() => {
    if (order) return order;
    return {
      id: job?.orderId || jobId || 'ord-test-01',
      tenantId: tenant?.id || '',
      quoteId: (job as any)?.quoteId || 'Q-9021',
      orderNumber: job?.orderNumber || 'SO-2026-0012',
      customerName: (job as any)?.customerName || 'B2B Client',
      phone: '',
      totalAmount: (job?.unitPrice || 2500) * (job?.quantity || 100),
      deliveryDate: (job as any)?.deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: 'confirmed',
      createdBy: profile?.uid || 'planner',
      items: [{
        id: job?.id || 'item-1',
        name: job?.itemName || 'Manufactured Item',
        quantity: job?.quantity || 100,
        unitPrice: job?.unitPrice || 2500,
        total: (job?.unitPrice || 2500) * (job?.quantity || 100),
        gstPercent: 18,
        specs: job?.specs,
        bomLines: job?.bomComponents,
        orderedQty: job?.quantity || 100,
        dispatchedQty: 0,
        remainingQty: job?.quantity || 100,
        dispatchStatus: 'pending'
      }],
      createdAt: new Date().toISOString()
    } as unknown as Order;
  }, [order, job, jobId, tenant?.id, profile?.uid]);

  // Load dispatches & backorders for this order
  useEffect(() => {
    if (!tenant?.id) return;
    try {
      const cachedD = localStorage.getItem(`dispatches_${tenant.id}`) || '[]';
      const allD: Dispatch[] = JSON.parse(cachedD);
      const targetOrderId = effectiveOrder.id;
      const targetOrderNumber = effectiveOrder.orderNumber;
      
      const filteredD = allD.filter(
        d => (targetOrderId && d.orderId === targetOrderId) || 
             (targetOrderNumber && (d.dispatchNumber?.includes(targetOrderNumber) || (d as any).orderNumber === targetOrderNumber))
      );
      setOrderDispatches(filteredD);

      if (targetOrderId) {
        const bos = getBackordersForOrder(tenant.id, targetOrderId);
        setBackorders(bos);
      }
    } catch (e) {
      console.warn('Error loading order dispatches or backorders:', e);
    }
  }, [tenant?.id, effectiveOrder.id, effectiveOrder.orderNumber, refreshKey]);

  const orderLines = useMemo(() => {
    return getOrderLinesQuantities(effectiveOrder, orderDispatches);
  }, [effectiveOrder, orderDispatches]);

  // Find linked work orders for this order/job
  const linkedWorkOrders = useMemo(() => {
    if (!order && !job) return [];
    const targetOrderId = order?.id || job?.orderId;
    const targetOrderNumber = order?.orderNumber || job?.orderNumber;
    return workOrders.filter(
      (w) =>
        (targetOrderId && w.salesOrderId === targetOrderId) ||
        (targetOrderNumber && w.salesOrderNumber === targetOrderNumber) ||
        (w.partName && job?.itemName && w.partName.toLowerCase() === job.itemName.toLowerCase())
    );
  }, [workOrders, order, job]);

  useEffect(() => {
    if (job?.currentStage) {
      setSelectedStage(job.currentStage);
    }
  }, [job?.currentStage]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !profile) return;

    setAddingComment(true);
    setFeedback(null);
    try {
      await addJobComment(commentText.trim(), profile.name || 'Operations Lead', profile.uid);
      setCommentText('');
      setFeedback('Comment uploaded to the job timeline.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback(`Error: ${err.message || 'Submission failed'}`);
    } finally {
      setAddingComment(false);
    }
  };

  const handleStageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !tenant || !job || !updateJobStage) return;

    setUpdatingStage(true);
    setStageFeedback(null);
    try {
      const displayNotes = stageChangeNotes.trim() || `Advanced stage of production to ${selectedStage.toUpperCase()}.`;
      await updateJobStage(
        selectedStage,
        displayNotes,
        profile.uid,
        profile.name || 'Operations Lead'
      );

      if (order?.phone) {
        const displayLabel = defaultStages.find(s => s.value === selectedStage)?.label || selectedStage;
        await sendWhatsAppNotification({
          recipientName: order.customerName,
          recipientPhone: order.phone,
          templateName: 'production_update',
          tenantId: tenant.id,
          orderId: order.id,
          customerId: (order as any).customerId || '',
          parameters: {
            itemName: job.itemName,
            quantity: job.quantity.toString(),
            orderNumber: order.orderNumber,
            stage: displayLabel
          }
        });
      }

      setStageChangeNotes('');
      setStageFeedback(`Production stage successfully moved to: ${selectedStage.toUpperCase()}`);
      setTimeout(() => setStageFeedback(null), 4000);
    } catch (err: any) {
      setStageFeedback(`Error: ${err.message || 'Stage movement execution failed'}`);
    } finally {
      setUpdatingStage(false);
    }
  };

  const getStageStyle = (st: string) => {
    switch (st) {
      case 'cutting': return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'welding': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'machining': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'assembly': return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'quality_check': return 'bg-pink-50 border-pink-200 text-pink-700';
      case 'ready': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="animate-spin h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-450 font-mono uppercase tracking-wider">Syncing workshop node...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="bg-red-50/40 border border-red-200 rounded-xl p-8 max-w-lg mx-auto text-center mt-12 space-y-4">
        <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-slate-900">Job Record Unreachable</h3>
        <p className="text-xs text-slate-500">{error || 'Requested job code could not be mapped to this active workspace context'}</p>
        <button
          onClick={() => navigate('/orders')}
          className="px-4 py-2 bg-slate-905 hover:bg-slate-800 text-white font-mono text-[10px] uppercase font-bold tracking-wider rounded-lg transition"
        >
          Return to Board
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-450 hover:text-slate-800 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Exit to production list</span>
        </button>

        <span className="font-mono text-[10px] text-slate-400">
          Job context key: {job.id}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
              Production WIP • Job Item
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-2">
              {job.itemName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
              <span className="text-slate-500">
                Sales Order: <span className="font-mono font-bold text-slate-900">{order?.orderNumber || job.orderNumber || 'Auto-generated'}</span>
              </span>
              {(order?.customerPoNumber || job.customerPoNumber) && (
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                  Client PO: {order?.customerPoNumber || job.customerPoNumber}
                </span>
              )}
              {(order?.quoteNumber || job.quoteNumber) && (
                <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  Quote #{order?.quoteNumber || job.quoteNumber}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Current Station:</span>
            <span className={`px-3 py-1 font-mono font-extrabold uppercase rounded-full text-[10px] border tracking-wider shadow-2xs ${getStageStyle(job.currentStage)}`}>
              {job.currentStage}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Yield Amount</span>
            <span className="font-bold text-slate-800 text-base">{job.quantity} units</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Allocated Target</span>
            <span className="font-bold text-slate-800">{order?.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Immediate dispatch'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Created On</span>
            <span className="font-medium text-slate-700"> {new Date(job.updatedAt).toLocaleDateString()} </span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Assigned Handler</span>
            <span className="font-bold text-indigo-600 flex items-center space-x-1">
              <User className="h-3.5 w-3.5" />
              <span>{job.updatedBy === 'system' ? 'A.I. Estimator' : 'Shopfloor Crew'}</span>
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">

          {/* ORDER LINE ITEMS & DISPATCH FULFILLMENT BREAKDOWN */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
                      Order Lines & Dispatch Fulfillment
                    </h3>
                    <span className={`px-2 py-0.5 font-mono text-[9px] uppercase font-bold rounded-full border ${
                      effectiveOrder.status === 'Partially Dispatched' || (effectiveOrder.status as any) === 'partially-dispatched'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : effectiveOrder.status === 'dispatched' || effectiveOrder.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {effectiveOrder.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-sans block">
                    SO #{effectiveOrder.orderNumber} • Partial Fulfillment & Auto-Backorder Engine
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(true)}
                  disabled={orderLines.every(l => l.remainingQty <= 0)}
                  className={`font-mono text-xs uppercase font-bold tracking-wider px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
                    orderLines.every(l => l.remainingQty <= 0)
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-101'
                  }`}
                  title={orderLines.every(l => l.remainingQty <= 0) ? 'All lines already 100% fulfilled' : 'Record a partial or full dispatch for this order'}
                >
                  <Truck className="h-3.5 w-3.5 text-indigo-200" />
                  <span>Create Dispatch</span>
                </button>
              </div>
            </div>

            {/* Line Items Quantities Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-mono uppercase text-[9px] tracking-wider select-none">
                  <tr>
                    <th className="p-3 pl-4 font-bold">Line Item & Specs</th>
                    <th className="p-3 text-center font-bold">Ordered Qty</th>
                    <th className="p-3 text-center font-bold">Already Dispatched</th>
                    <th className="p-3 text-center font-bold">Remaining Qty</th>
                    <th className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50">Invoiced Qty</th>
                    <th className="p-3 text-center font-bold text-amber-700 bg-amber-50/40">Pending Invoice Qty</th>
                    <th className="p-3 text-center font-bold">Fulfillment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                  {orderLines.map((line) => {
                    const percentFulfilled = line.orderedQty > 0 
                      ? Math.min(100, Math.round((line.alreadyDispatchedQty / line.orderedQty) * 100)) 
                      : 0;

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3 pl-4">
                          <div className="font-bold text-slate-900">{line.name}</div>
                          {line.specs && (
                            <div className="text-[10px] text-slate-400 font-mono line-clamp-1">{line.specs}</div>
                          )}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5 max-w-xs">
                            <div 
                              className={`h-full ${percentFulfilled >= 100 ? 'bg-emerald-500' : percentFulfilled > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                              style={{ width: `${percentFulfilled}%` }}
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-800">
                          {line.orderedQty}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-700">
                          {line.alreadyDispatchedQty}
                        </td>
                        {/* Remaining Qty */}
                        <td className="p-3 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                            line.remainingQty === 0 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200 font-bold'
                          }`}>
                            {line.remainingQty}
                          </span>
                        </td>

                        {/* Invoiced Qty (Running Total) */}
                        <td className="p-3 text-center font-mono bg-emerald-50/20">
                          <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                            line.invoicedQty > 0 
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-black' 
                              : 'text-slate-400 bg-slate-100'
                          }`}>
                            {line.invoicedQty}
                          </span>
                        </td>

                        {/* Pending Invoice Qty */}
                        <td className="p-3 text-center font-mono bg-amber-50/20">
                          <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            line.pendingInvoiceQty > 0
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {line.pendingInvoiceQty}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {line.remainingQty === 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="h-3 w-3" />
                              <span>Fulfilled</span>
                            </span>
                          ) : line.alreadyDispatchedQty > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              <span>Partially Dispatched</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Hint for Clerk */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start space-x-2 text-xs text-slate-600 font-sans">
              <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Partial Fulfillment Notice:</strong> Dispatch clerks can record partial consignments as soon as batches clear inspection. 
                Any remaining quantity is automatically placed on an audit-locked Backorder carrying forward original commercial terms.
              </span>
            </div>

            {/* LINKED DISPATCH HISTORY FOR THIS ORDER */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <History className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Order Dispatch History ({orderDispatches.length})</span>
                </h4>
              </div>

              {orderDispatches.length > 0 ? (
                <div className="space-y-2">
                  {orderDispatches.map((disp) => (
                    <div 
                      key={disp.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900">
                            {disp.dispatchNumber || disp.invoiceNumber}
                          </span>
                          {disp.isPartialDispatch && (
                            <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded uppercase">
                              Partial Consignment
                            </span>
                          )}
                          <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold border ${
                            disp.status === 'Cancelled' ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            {disp.status}
                          </span>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px] flex items-center space-x-3">
                          <span>Date: {disp.dispatchDate ? new Date(disp.dispatchDate).toLocaleDateString() : new Date(disp.dispatchedAt).toLocaleDateString()}</span>
                          <span>Carrier: {disp.transporter}</span>
                          <span>LR: {disp.lrNumber || 'N/A'}</span>
                        </div>
                        {disp.items && disp.items.length > 0 && (
                          <div className="text-[11px] font-mono text-indigo-700 pt-0.5">
                            Shipped: {disp.items.map((it: any) => `${it.name}: ${it.dispatchQty ?? it.dispatchedQty ?? it.quantity ?? 0} units`).join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {disp.status !== 'Cancelled' && (
                          disp.isInvoiced ? (
                            <button
                              type="button"
                              onClick={() => navigate('/payments')}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition flex items-center space-x-1 cursor-pointer"
                              title={`Invoiced (${disp.invoiceNumber || disp.invoiceId}). Click to view.`}
                            >
                              <Receipt className="h-3 w-3 text-emerald-600" />
                              <span>Invoiced</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setInvoiceModalDispatch(disp);
                                setShowInvoiceModal(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition shadow-2xs flex items-center space-x-1 cursor-pointer"
                              title="Generate GST Tax Invoice for only the quantity dispatched"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Generate Invoice</span>
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/dispatch/${disp.id}`)}
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
                        >
                          View Dispatch →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 font-mono border border-dashed rounded-xl">
                  No dispatch consignments logged for this order yet.
                </div>
              )}
            </div>

            {/* LINKED BACKORDERS (FOLLOW-ON BALANCES) */}
            {backorders.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Boxes className="h-3.5 w-3.5 text-amber-500" />
                    <span>Auto-Generated Follow-on Backorders ({backorders.length})</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Audit locked snapshot terms
                  </span>
                </div>

                <div className="space-y-2">
                  {backorders.map((bo) => (
                    <div 
                      key={bo.id}
                      className={`p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        bo.reviewFlagged || bo.status === 'review_required'
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-amber-50/40 border-amber-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900">
                            {bo.backorderNumber}
                          </span>
                          <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold border ${
                            bo.reviewFlagged || bo.status === 'review_required'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {bo.status === 'review_required' ? 'Review Required (Dispatch Voided)' : bo.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600">
                          Remaining Backorder Balance: <strong className="text-slate-900">{bo.totalRemainingQty ?? bo.items.reduce((s, it) => s + (it.remainingQty ?? it.backorderQty), 0)} units</strong>
                        </div>
                        {bo.items && bo.items.length > 0 && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {bo.items.map(it => `${it.name}: ${it.remainingQty ?? it.backorderQty} units @ ₹${it.unitPrice.toLocaleString('en-IN')}`).join(' | ')}
                          </div>
                        )}
                        {(bo.reviewReason || bo.statusReason) && (
                          <div className="text-[10px] font-mono text-rose-700 bg-rose-100/60 p-1.5 rounded">
                            Notice: {bo.reviewReason || bo.statusReason}
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-slate-500 text-right shrink-0">
                        <span>Created: {new Date(bo.createdAt).toLocaleDateString()}</span>
                        <div className="text-emerald-700 font-bold">Terms Locked</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <h3 className="text-xs font-mono font-bold text-slate-450 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="h-4.5 w-4.5 text-indigo-500" />
              <span>Chronological shopfloor work history logs</span>
            </h3>

            {job.stagesHistory && job.stagesHistory.length > 0 ? (
              <div className="relative border-l-2 border-slate-105 pl-5 ml-2.5 space-y-6 pt-1">
                {job.stagesHistory.map((elem, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute -left-6.75 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-900 group-hover:bg-indigo-600 transition" />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-slate-450 uppercase">
                          STAGE: {elem.stage}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({elem.updatedAt ? new Date(elem.updatedAt).toLocaleString() : 'System Base'})
                        </span>
                      </div>
                      {elem.notes && (
                        <p className="text-xs text-slate-800 font-mono bg-slate-50 border border-slate-101 p-2.5 rounded-lg">
                          {elem.notes}
                        </p>
                      )}
                      <div className="text-[10px] font-mono text-slate-500 font-bold">
                        Logged by: <span className="text-slate-700">{elem.updatedByName || elem.updatedBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 font-mono border border-dashed rounded-xl">
                No stages movement historical notes logged.
              </div>
            )}
          </div>

          {/* SALES ORDER → WORK ORDER GENERATION & TRACEABILITY */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
                    Sales Order → Work Order Generation
                  </h3>
                  <span className="text-[11px] text-slate-500 font-sans block">
                    Linking: SO #{order?.orderNumber || job.orderNumber || job.orderId} → Work Orders → Routing Operations
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {linkedWorkOrders.length > 0 ? (
                  <span className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded font-bold uppercase">
                    ✓ {linkedWorkOrders.length} WO(s) Released
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold uppercase">
                    Pending WO Generation
                  </span>
                )}
              </div>
            </div>

            {/* If Work Orders are already generated */}
            {linkedWorkOrders.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {linkedWorkOrders.map((wo) => (
                    <div
                      key={wo.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {wo.orderNumber}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded uppercase">
                          {wo.status}
                        </span>
                      </div>
                      <div className="text-slate-800 font-sans font-bold">
                        {wo.partName}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <span>Batch: {wo.quantity} pcs</span>
                        <span>{wo.operations.length} Operations</span>
                      </div>
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTravelerWorkOrder(wo);
                            setShowTravelerModal(true);
                          }}
                          className="flex-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg py-1 px-2 text-[10px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Printer className="h-3 w-3" />
                          <span>Traveler Slip</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/work-orders')}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-1 px-2 text-[10px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors shadow-3xs"
                        >
                          <span>Shopfloor Track</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGenerateWoModal(true)}
                    className="text-[11px] font-mono text-slate-500 hover:text-indigo-600 font-bold underline cursor-pointer"
                  >
                    Re-explode BOM or configure additional work orders →
                  </button>
                </div>
              </div>
            ) : (
              /* If Work Orders NOT yet generated */
              <div className="bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border border-indigo-150 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs font-mono uppercase tracking-wide">
                    Automated BOM Explosion & Routing Release
                  </h4>
                  <p className="text-xs text-slate-600 font-sans max-w-xl">
                    Auto-explode this confirmed order's bill of materials, allocate stock inventory, assign machine center sequence operations, and generate sequential Work Orders without manual handoff.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGenerateWoModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-4 py-2.5 rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition-all hover:scale-101 shrink-0"
                >
                  <Zap className="h-4 w-4 text-indigo-200" />
                  <span>⚡ Auto-Explode BOM & Release WOs</span>
                </button>
              </div>
            )}
          </div>

          {/* CARRIED FORWARD BOM & MANUFACTURING ROUTING SPECIFICATIONS */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="h-4.5 w-4.5 text-emerald-600" />
                <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
                  Carried Forward BOM & Manufacturing Routing
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase">
                Quote Locked
              </span>
            </div>

            {/* Routing Workflow Stages Sequence */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Standard Shopfloor Routing Sequence
              </span>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                {(job.routingStages || ['cutting', 'welding', 'machining', 'assembly', 'quality_check', 'ready']).map((st, i, arr) => {
                  const isCurrent = job.currentStage === st;
                  return (
                    <React.Fragment key={st}>
                      <span className={`px-2.5 py-1 rounded-md font-bold uppercase border ${
                        isCurrent 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs' 
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {st.replace('_', ' ')}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="text-slate-300">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Bill of Materials (BOM) Specs */}
            {(job.bomComponents && job.bomComponents.length > 0) ? (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Bill of Materials (BOM) Lines ({job.bomComponents.length} parts)
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Part / Component</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">Unit Rate</th>
                        <th className="p-2">Material / Spec</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {job.bomComponents.map((b: any, bi: number) => (
                        <tr key={bi} className="hover:bg-slate-50/50">
                          <td className="p-2 font-semibold text-slate-800">{b.partNumber || b.name || `Component ${bi + 1}`}</td>
                          <td className="p-2 text-slate-600">{b.quantity || 1} {b.unit || 'pcs'}</td>
                          <td className="p-2 text-slate-600">₹{b.unitPrice ? b.unitPrice.toLocaleString('en-IN') : '-'}</td>
                          <td className="p-2 text-slate-500 text-[10px]">{b.specs || b.description || 'Standard spec'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 text-[11px] font-mono text-slate-600 flex items-center justify-between">
                <span>Direct Quote Item: <strong className="text-slate-900">{job.itemName}</strong></span>
                <span className="bg-white border px-1.5 py-0.5 rounded text-[10px] font-bold">Qty: {job.quantity}</span>
              </div>
            )}

            {/* Outsourced Subcontracting Operations */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider block">
                  Outsourced Operations & Subcontracting
                </span>
                <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                  Need outside heat treatment, electroplating, gear hobbing, or laser profiling for this batch?
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/subcontractors', {
                  state: {
                    openCreateModal: true,
                    initialJobName: job.itemName,
                    initialPartName: job.itemName,
                    initialQuantity: job.quantity,
                    initialOrderNumber: order?.orderNumber || job.orderId
                  }
                })}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg inline-flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-3xs transition-all hover:scale-101"
              >
                <Building className="h-3.5 w-3.5 text-indigo-200" />
                <span>Broadcast Subcontract RFQ</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-450 uppercase tracking-wider flex items-center space-x-1.5">
              <MessageSquare className="h-4.5 w-4.5 text-sky-500" />
              <span>Record bespoke telemetry / foreman update</span>
            </h3>

            {/* 🔒 RBAC Guard: Production logging */}
            <GuardedAction 
              action="manage:production"
              fallback={
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono text-slate-500 text-center">
                  Only authorized shopfloor staff can append telemetry logs.
                </div>
              }
            >
              <form onSubmit={handlePostComment} className="space-y-3">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Include custom measurement telemetry specifications, caliper readings, temperature logs, or structural exceptions..."
                  rows={3}
                  required
                  className="w-full text-xs font-mono bg-slate-50 hover:bg-white rounded-lg p-3 border border-slate-200 focus:bg-white focus:outline-hidden leading-relaxed"
                />

                {feedback && (
                  <div className="p-2.5 bg-sky-50 border border-sky-150 text-[11px] text-sky-850 rounded font-mono">
                    {feedback}
                  </div>
                )}

                <div className="flex justify-end select-none">
                  <button
                    type="submit"
                    disabled={addingComment}
                    className="bg-slate-900 border border-slate-950 hover:bg-slate-850 text-white font-mono text-[10px] font-extrabold uppercase tracking-widest px-4 py-2.5 rounded-lg cursor-pointer transition flex items-center space-x-1.5"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-300" />
                    <span>{addingComment ? 'Submitting notes...' : 'Append Operator Log'}</span>
                  </button>
                </div>
              </form>
            </GuardedAction>
          </div>

        </div>

        <div className="space-y-6">

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span>Supervisor Stage Control</span>
            </h4>

            {/* 🔒 RBAC Guard: Stage Control */}
            <GuardedAction 
              action="manage:production"
              fallback={
                <div className="p-4 border border-dashed rounded-lg text-xs font-mono text-slate-500 text-center">
                  Production stage updates are restricted to authorized shopfloor crew.
                </div>
              }
            >
              <form onSubmit={handleStageChange} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-500 block mb-1.5">Action Stage</label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 hover:bg-white p-2.5 border rounded-lg focus:bg-white focus:outline-hidden"
                  >
                    {defaultStages.map(st => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-500 block mb-1.5">Process Note / Reason</label>
                  <textarea
                    value={stageChangeNotes}
                    onChange={(e) => setStageChangeNotes(e.target.value)}
                    placeholder="Notes explaining calipers/QA/inspection outcomes..."
                    rows={2}
                    className="w-full text-xs font-mono bg-slate-50 hover:bg-white p-2.5 border rounded-lg focus:bg-white focus:outline-hidden"
                  />
                </div>

                {stageFeedback && (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-150 text-[10px] text-indigo-850 rounded font-mono">
                    {stageFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={updatingStage || selectedStage === job.currentStage}
                  className="w-full text-white font-mono text-[10px] font-extrabold uppercase tracking-widest py-2.5 rounded-lg cursor-pointer transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  style={{ 
                    backgroundColor: selectedStage === job.currentStage ? '#e2e8f0' : '#4f46e5', 
                    color: selectedStage === job.currentStage ? '#94a3b8' : '#ffffff' 
                  }}
                >
                  <span>{updatingStage ? 'Updating Segment...' : 'Update Production Stage'}</span>
                </button>
              </form>
            </GuardedAction>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <Briefcase className="h-4 w-4 text-indigo-500" />
              <span>Integrations Directory</span>
            </h4>

            <div className="space-y-3.5 text-xs font-mono">
              <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg space-y-1">
                <span className="text-[9px] text-slate-400 uppercase block">Associated Customer Liaison</span>
                <span className="font-bold text-slate-900 block font-sans">{order?.customerName || 'B2B Client'}</span>
                {order?.phone && (
                  <span className="text-[10px] text-slate-500 block">📞 {order.phone}</span>
                )}
              </div>

              {/* Customer PO Reference */}
              {(order?.customerPoNumber || job.customerPoNumber) && (
                <div className="p-3 bg-indigo-50/60 border border-indigo-150 rounded-lg space-y-1">
                  <span className="text-[9px] text-indigo-700 font-bold uppercase block tracking-wider">
                    Customer PO Reference
                  </span>
                  <div className="font-mono font-bold text-indigo-950 text-xs">
                    {order?.customerPoNumber || job.customerPoNumber}
                  </div>
                  {order?.poDate && (
                    <span className="text-[10px] text-indigo-600 block">
                      PO Date: {new Date(order.poDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}

              {/* Originating Quotation Reference */}
              {(order?.quoteNumber || order?.quoteId || job.quoteNumber) && (
                <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block">Originating Quotation</span>
                    <span className="font-bold text-slate-900 text-[11px]">
                      Quote #{order?.quoteNumber || job.quoteNumber || order?.quoteId}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(order?.rfqId ? `/rfqs/${order.rfqId}` : '/rfqs')}
                    className="p-1.5 bg-white border rounded hover:text-indigo-650 cursor-pointer shadow-3xs"
                    title="View Originating Quote / RFQ"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-lg space-y-1">
                <span className="text-[9px] text-slate-450 uppercase block">Earmarked Contract Valuation</span>
                <div className="text-indigo-950 font-black text-base tracking-tight">
                  ₹{order?.totalAmount?.toLocaleString('en-IN') || ' Bespoke Estimate '}
                </div>
                <span className="text-[9px] text-slate-500 block leading-tight">GST components and pricing locked from approved quote.</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <FileSymlink className="h-4 w-4 text-sky-500" />
              <span>Job drawings & specifications</span>
            </h4>
            
            {tenant?.id && (
              <>
                <AttachmentsList 
                  entityType="job" 
                  entityId={jobId!} 
                  tenantId={tenant.id} 
                  userProfile={profile} 
                  userRole={profile?.role} 
                />
                
                {/* 🔒 RBAC Guard: Job file uploads */}
                <GuardedAction action="manage:production">
                  <div className="pt-2">
                    <FileUploader 
                      entityType="job" 
                      entityId={jobId!} 
                      tenantId={tenant.id} 
                      userProfile={profile} 
                    />
                  </div>
                </GuardedAction>
              </>
            )}
          </div>

          <div className="bg-slate-900 text-slate-300 rounded-xl p-5 border border-slate-800 text-xs leading-relaxed space-y-3 font-mono">
            <span className="text-[9px] font-bold text-sky-450 uppercase block tracking-widest">
              Standard operations procedure
            </span>
            <p>
              Please log digital caliper deviations inside structural notes.
              Transitioning complete counts to <span className="text-emerald-450 font-bold font-mono">Ready</span> triggers shipping alerts instantly.
            </p>
          </div>

        </div>

      </div>

      {/* Generate Work Orders Modal */}
      {showGenerateWoModal && (
        <GenerateWorkOrdersModal
          isOpen={showGenerateWoModal}
          onClose={() => setShowGenerateWoModal(false)}
          order={order || ({
            id: job.orderId || jobId!,
            tenantId: tenant?.id || '',
            quoteId: (job as any).quoteId || 'Q-9021',
            orderNumber: job.orderNumber || 'SO-2026-0012',
            customerName: (job as any).customerName || 'B2B Client',
            phone: '',
            totalAmount: (job.unitPrice || 0) * (job.quantity || 1),
            deliveryDate: (job as any).deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            status: 'confirmed',
            createdBy: profile?.uid || 'planner',
            items: [{
              id: job.id,
              name: job.itemName,
              quantity: job.quantity,
              unitPrice: job.unitPrice || 0,
              total: (job.unitPrice || 0) * (job.quantity || 1),
              gstPercent: 18,
              specs: job.specs,
              bomLines: job.bomComponents
            }],
            createdAt: new Date().toISOString()
          } as unknown as Order)}
          onSuccess={() => {
            setShowGenerateWoModal(false);
          }}
        />
      )}

      {/* Shop Traveler Slip Modal */}
      {showTravelerModal && travelerWorkOrder && (
        <ShopTravelerModal
          isOpen={showTravelerModal}
          onClose={() => {
            setShowTravelerModal(false);
            setTravelerWorkOrder(null);
          }}
          workOrder={travelerWorkOrder}
          companyName={tenant?.companyName}
        />
      )}

      {/* Create Partial / Full Consignment Dispatch Modal */}
      {showDispatchModal && (
        <DispatchCreateForm
          isOpen={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          availableOrders={[effectiveOrder]}
          preselectedOrder={effectiveOrder}
          onSuccess={() => {
            setShowDispatchModal(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Generate Partial Invoice Modal */}
      {showInvoiceModal && invoiceModalDispatch && (
        <GeneratePartialInvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setInvoiceModalDispatch(null);
          }}
          dispatch={invoiceModalDispatch}
          order={effectiveOrder}
          onSuccess={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

    </div>
  );
};

