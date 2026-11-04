// src/components/production/BackordersProductionQueue.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Backorder, Order } from '../../types';
import { 
  getBackorders, 
  updateBackorderProductionStatus 
} from '../../services/partialDispatchService';
import { RescheduleBackorderModal } from './RescheduleBackorderModal';
import { CancelBackorderModal } from './CancelBackorderModal';
import { 
  Boxes, 
  Search, 
  CalendarClock, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  Truck, 
  AlertTriangle, 
  ExternalLink, 
  X, 
  AlertOctagon, 
  RefreshCw,
  GitBranch,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

interface BackordersProductionQueueProps {
  plantId?: string;
  onRefreshOrders?: () => void;
}

export const BackordersProductionQueue: React.FC<BackordersProductionQueueProps> = ({
  plantId = 'all',
  onRefreshOrders
}) => {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();

  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'in_production' | 'ready_for_dispatch' | 'closed'>('active');
  
  // Modals state
  const [rescheduleModalBo, setRescheduleModalBo] = useState<Backorder | null>(null);
  const [cancelModalBo, setCancelModalBo] = useState<Backorder | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load backorders & orders
  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const boList = await getBackorders(tenant.id);
      setBackorders(boList);

      const cachedOrders = localStorage.getItem(`orders_${tenant.id}`) || '[]';
      setOrders(JSON.parse(cachedOrders));
    } catch (err) {
      console.warn('Error loading backorders for production queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  // Map order map for fast status and cancellation check
  const orderMap = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach(o => map.set(o.id, o));
    return map;
  }, [orders]);

  // Filtered backorders
  const filteredBackorders = useMemo(() => {
    return backorders.filter((bo) => {
      // Plant filter
      if (plantId !== 'all' && bo.plantId && bo.plantId !== plantId) {
        return false;
      }

      // Status filter
      if (statusFilter === 'active') {
        if (bo.status === 'fulfilled' || bo.status === 'cancelled') return false;
      } else if (statusFilter === 'in_production') {
        if (bo.status !== 'in_production') return false;
      } else if (statusFilter === 'ready_for_dispatch') {
        if (bo.status !== 'ready_for_dispatch') return false;
      } else if (statusFilter === 'closed') {
        if (bo.status !== 'fulfilled' && bo.status !== 'cancelled') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesBoNum = bo.backorderNumber.toLowerCase().includes(query);
        const matchesOrderNum = bo.originalOrderNumber.toLowerCase().includes(query);
        const matchesCustomer = bo.customerName.toLowerCase().includes(query);
        const matchesItem = bo.items.some(i => i.name.toLowerCase().includes(query));
        return matchesBoNum || matchesOrderNum || matchesCustomer || matchesItem;
      }

      return true;
    });
  }, [backorders, plantId, statusFilter, searchQuery]);

  // Production Stage / Status quick advance
  const handleUpdateStatus = async (
    bo: Backorder, 
    newStatus: Backorder['status'], 
    actionName: string
  ) => {
    if (!tenant?.id) return;
    try {
      const operatorName = profile?.name || profile?.email || 'Production Supervisor';
      const result = await updateBackorderProductionStatus(
        tenant.id,
        bo.id,
        newStatus,
        operatorName
      );

      // Update state
      setBackorders(prev => prev.map(b => b.id === bo.id ? result.updatedBackorder : b));
      if (result.updatedOrder) {
        setOrders(prev => prev.map(o => o.id === result.updatedOrder!.id ? result.updatedOrder! : o));
        if (onRefreshOrders) onRefreshOrders();
      }

      setActionSuccessMsg(
        `Backorder #${bo.backorderNumber} ${actionName}.${result.updatedOrder ? ` Parent Order #${result.updatedOrder.orderNumber} transitioned to "${result.updatedOrder.status}".` : ''}`
      );
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Error updating backorder status: ${err.message || 'Operation failed'}`);
    }
  };

  const activeCount = backorders.filter(b => b.status !== 'fulfilled' && b.status !== 'cancelled').length;
  const inProdCount = backorders.filter(b => b.status === 'in_production').length;
  const readyCount = backorders.filter(b => b.status === 'ready_for_dispatch').length;

  return (
    <div className="space-y-4">
      {/* Success Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Control bar: search, tabs, refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'active'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Active Queue</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${statusFilter === 'active' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('in_production')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'in_production'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>In Production</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${statusFilter === 'in_production' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {inProdCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('ready_for_dispatch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'ready_for_dispatch'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Ready for Dispatch</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${statusFilter === 'ready_for_dispatch' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {readyCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>All Backorders</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {backorders.length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'closed'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Fulfilled / Closed</span>
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative grow md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search BO#, order, part, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[10px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={loadData}
            title="Refresh Backorders Queue"
            className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Backorder Cards Queue */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-mono text-xs bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading backorders production queue...
        </div>
      ) : filteredBackorders.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <Boxes className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">No Backorders in this view</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {searchQuery 
              ? 'Try modifying your search term or filter.'
              : 'Backorders are automatically generated when partial dispatches are saved from an active order line.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredBackorders.map((bo) => {
            const parentOrder = orderMap.get(bo.originalOrderId);
            const isParentCancelled = (parentOrder?.status as string)?.toLowerCase() === 'cancelled';
            const totalRemainingQty = bo.items.reduce(
              (acc, itm) => acc + (itm.backorderQty ?? itm.remainingQty ?? 0), 
              0
            );

            const isRescheduled = Boolean(bo.rescheduledReason || (bo.targetDate && bo.originalPromisedDate && bo.targetDate !== bo.originalPromisedDate));
            const isOverdue = bo.targetDate ? new Date(bo.targetDate).getTime() < Date.now() && bo.status !== 'fulfilled' && bo.status !== 'cancelled' : false;

            return (
              <div 
                key={bo.id}
                className={`bg-white rounded-xl border transition-all p-4 space-y-3 shadow-2xs hover:shadow-xs ${
                  bo.status === 'ready_for_dispatch'
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : bo.status === 'in_production'
                    ? 'border-indigo-300 bg-indigo-50/15'
                    : bo.status === 'cancelled'
                    ? 'border-slate-200 opacity-70 bg-slate-50'
                    : isParentCancelled
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* 1. Top Badges & Identification */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Clear prominent "Backorder" Badge */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-extrabold uppercase tracking-wide bg-amber-500 text-white shadow-2xs">
                      <Boxes className="h-3.5 w-3.5" />
                      <span>Backorder</span>
                    </span>

                    {/* Backorder Number */}
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {bo.backorderNumber}
                    </span>

                    {/* Link to Parent Order */}
                    <button
                      type="button"
                      onClick={() => navigate(`/orders?search=${bo.originalOrderNumber}`)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 transition cursor-pointer"
                      title={`Click to view parent order #${bo.originalOrderNumber}`}
                    >
                      <span>Backorder of {bo.originalOrderNumber}</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>

                    {/* Recursive lineage if backorder of a backorder (EC 3) */}
                    {bo.parentBackorderNumber && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        <GitBranch className="h-3 w-3" />
                        <span>Lineage: Child of {bo.parentBackorderNumber}</span>
                      </span>
                    )}
                  </div>

                  {/* Production Status Badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider border ${
                      bo.status === 'ready_for_dispatch'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : bo.status === 'in_production'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                        : bo.status === 'fulfilled'
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : bo.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : bo.status === 'review_required'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {bo.status === 'ready_for_dispatch' ? 'Ready for Dispatch' :
                       bo.status === 'in_production' ? 'In Production' :
                       bo.status === 'review_required' ? 'Review Required' :
                       bo.status === 'fulfilled' ? 'Fulfilled / Dispatched' :
                       bo.status === 'cancelled' ? 'Cancelled' : 'Open Queue'}
                    </span>
                  </div>
                </div>

                {/* 2. Edge Case 1 Banner: Parent Order Cancelled Alert */}
                {isParentCancelled && bo.status !== 'cancelled' && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-900">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold">Parent Order Cancelled: </span>
                        <span>This backorder remains active on the shopfloor until an authorized supervisor explicitly cancels it.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCancelModalBo(bo)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold uppercase tracking-wider shrink-0 transition cursor-pointer"
                    >
                      Explicitly Cancel Backorder
                    </button>
                  </div>
                )}

                {/* 3. Items & Schedule Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                  {/* Left: Customer & Items */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-semibold text-slate-900">{bo.customerName}</span>
                      {bo.customerPoNumber && (
                        <span className="text-slate-400 font-mono text-[11px]">(PO: {bo.customerPoNumber})</span>
                      )}
                    </div>

                    {/* Item lines */}
                    <div className="space-y-1">
                      {bo.items.map((itm, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60 font-mono text-[11px]"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block">{itm.name}</span>
                            {itm.specs && <span className="text-[10px] text-slate-500 block">{itm.specs}</span>}
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                              Backorder Qty: {itm.backorderQty ?? itm.remainingQty} {itm.unit || 'units'}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              (Original: {itm.originalOrderedQty}, Shipped: {itm.dispatchedQty})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Dates & Rescheduling Summary */}
                  <div className="space-y-2.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 text-xs">
                    {/* Original Promised Date (Contract Locked) */}
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                        Original Promised Date (Contract)
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-xs flex items-center gap-1.5 mt-0.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {bo.originalPromisedDate || bo.deliveryDate || 'Not Specified'}
                      </span>
                    </div>

                    {/* Independent Target Due Date */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                          Shopfloor Target Due Date
                        </span>
                        {isRescheduled && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                            Rescheduled
                          </span>
                        )}
                      </div>
                      <span className={`font-mono font-extrabold text-xs flex items-center gap-1.5 mt-0.5 ${
                        isOverdue ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        <CalendarClock className={`h-3.5 w-3.5 ${isOverdue ? 'text-rose-600' : 'text-amber-600'}`} />
                        {bo.targetDate || bo.deliveryDate || 'Pending Schedule'}
                        {isOverdue && <span className="text-[10px] text-rose-600 font-bold">(Overdue)</span>}
                      </span>
                      {bo.rescheduledReason && (
                        <p className="text-[10px] text-slate-500 mt-0.5 italic">
                          "{bo.rescheduledReason}"
                        </p>
                      )}
                    </div>

                    {/* Reschedule Button */}
                    {bo.status !== 'fulfilled' && bo.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => setRescheduleModalBo(bo)}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Reschedule shopfloor target completion date independently of parent order"
                      >
                        <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
                        <span>Reschedule Target Date</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Supervisor Quick Workflow Action Bar */}
                {bo.status !== 'fulfilled' && bo.status !== 'cancelled' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                      <span>Total balance: <strong>{totalRemainingQty} units</strong></span>
                      <span>•</span>
                      <span>Created: {new Date(bo.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Step 1: Start Production */}
                      {bo.status === 'open' || bo.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(bo, 'in_production', 'started in production')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span>Start Production</span>
                        </button>
                      ) : null}

                      {/* Step 2: Complete Production -> Ready for Dispatch */}
                      {bo.status === 'in_production' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(bo, 'ready_for_dispatch', 'marked ready for dispatch')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                          title="Transition backorder to Ready for Dispatch. If all backorders for this order are ready, parent order will update."
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Complete Production → Ready for Dispatch</span>
                        </button>
                      ) : null}

                      {/* Step 3: Dispatch Consignment */}
                      <button
                        type="button"
                        onClick={() => {
                          // Navigate to dispatch page prefilled with this order and backorder details
                          if (parentOrder) {
                            navigate('/dispatch', { 
                              state: { 
                                preselectedOrderForDispatch: parentOrder,
                                sourceBackorderId: bo.id,
                                sourceBackorderNumber: bo.backorderNumber
                              } 
                            });
                          } else {
                            navigate('/dispatch');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                        title="Create dispatch shipment for this backorder balance"
                      >
                        <Truck className="h-3.5 w-3.5 text-sky-400" />
                        <span>Dispatch Backorder ({totalRemainingQty} Qty)</span>
                      </button>

                      {/* Explicit Cancellation */}
                      <button
                        type="button"
                        onClick={() => setCancelModalBo(bo)}
                        className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-mono transition cursor-pointer"
                        title="Explicitly cancel this backorder with audit reason code"
                      >
                        Cancel BO
                      </button>
                    </div>
                  </div>
                )}

                {/* Cancellation Details if Cancelled */}
                {bo.status === 'cancelled' && (
                  <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold">Cancelled: </span>
                      <span>Code: [{bo.cancellationCode || 'REASON'}] - {bo.cancellationReason || 'No notes provided'}</span>
                    </div>
                    {bo.cancelledAt && (
                      <span className="font-mono text-[11px] text-rose-600">
                        {new Date(bo.cancelledAt).toLocaleDateString()} by {bo.cancelledBy || 'Supervisor'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      <RescheduleBackorderModal
        isOpen={Boolean(rescheduleModalBo)}
        onClose={() => setRescheduleModalBo(null)}
        backorder={rescheduleModalBo}
        onSuccess={(updated) => {
          setBackorders(prev => prev.map(b => b.id === updated.id ? updated : b));
          setActionSuccessMsg(`Backorder #${updated.backorderNumber} target date successfully updated to ${updated.targetDate}.`);
          setTimeout(() => setActionSuccessMsg(null), 4000);
        }}
      />

      {/* Cancel Modal */}
      <CancelBackorderModal
        isOpen={Boolean(cancelModalBo)}
        onClose={() => setCancelModalBo(null)}
        backorder={cancelModalBo}
        onSuccess={(cancelled) => {
          setBackorders(prev => prev.map(b => b.id === cancelled.id ? cancelled : b));
          setActionSuccessMsg(`Backorder #${cancelled.backorderNumber} cancelled with audit code [${cancelled.cancellationCode}].`);
          setTimeout(() => setActionSuccessMsg(null), 4000);
        }}
      />
    </div>
  );
};
