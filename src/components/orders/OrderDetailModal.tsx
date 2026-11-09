// src/components/orders/OrderDetailModal.tsx

import React, { useState } from 'react';
import { Order, UserRole, QuoteItem } from '../../types';
import { OrderLifecycleStepper } from './OrderLifecycleStepper';
import { MaterialAvailabilityBadge } from './MaterialAvailabilityBadge';
import { TrafficLightAvailabilityBadge } from './TrafficLightAvailabilityBadge';
import { 
  AtpShortfallSaveConfirmationModal, 
  ShortfallLineItem 
} from './AtpShortfallSaveConfirmationModal';
import { AtpAcknowledgementModal } from './AtpAcknowledgementModal';
import { OrderStatusHistoryModal } from './OrderStatusHistoryModal';
import { OrderStateTransitionModal } from './OrderStateTransitionModal';
import { OrderLifecycleState, normalizeOrderState } from '../../types/orderStateMachine';
import { AtpCheckResult, OrderAtpSummary, EvaluateConsolidatedAtpOptions } from '../../types/materialAvailability';
import { MaterialAvailabilityService } from '../../services/materialAvailabilityService';
import { OrderAtpSummaryPanel } from './OrderAtpSummaryPanel';
import { ReservedMaterialsPanel } from './ReservedMaterialsPanel';
import { StockReservationService } from '../../services/stockReservationService';
import { BomExplosionAtpModal } from './BomExplosionAtpModal';
import { useStockItems } from '../../hooks/useStockInventory';
import { useMultiLevelBom } from '../../hooks/useMultiLevelBom';
import { 
  X, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Boxes, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  ShieldAlert, 
  Printer, 
  Layers,
  PauseCircle,
  PlayCircle,
  Package,
  Sparkles,
  Cpu
} from 'lucide-react';

interface OrderDetailModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  userName: string;
  userId: string;
  userEmail?: string;
  tenantId: string;
  isSandboxMode?: boolean;
  onOrderUpdated: (updatedOrder: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  userRole,
  userName,
  userId,
  userEmail,
  tenantId,
  isSandboxMode = false,
  onOrderUpdated
}) => {
  if (!isOpen) return null;

  const [historyOpen, setHistoryOpen] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<OrderLifecycleState | null>(null);
  const [isOverride, setIsOverride] = useState(false);

  // Material Availability & ATP Hooks
  const { items: stockItems, lastSyncedTimestamp } = useStockItems(tenantId);
  const { boms: multiLevelBoms } = useMultiLevelBom(tenantId);
  const [activeAtpAckResult, setActiveAtpAckResult] = useState<AtpCheckResult | null>(null);

  // Consolidated Order ATP Check State
  const [atpSummary, setAtpSummary] = useState<OrderAtpSummary | null>(null);
  const [isRunningAtpCheck, setIsRunningAtpCheck] = useState<boolean>(false);
  const [atpProgress, setAtpProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });

  // Recursive BOM Explosion & ATP Calculator Modal State
  const [isExplosionModalOpen, setIsExplosionModalOpen] = useState<boolean>(false);
  const [explosionProductId, setExplosionProductId] = useState<string>('gear_box');
  const [explosionQty, setExplosionQty] = useState<number>(50);
  const [explosionDate, setExplosionDate] = useState<string>(order.deliveryDate || '2026-11-20');

  // Interactive Line Item Quantity Editing & Traffic Light State
  const [items, setItems] = useState<QuoteItem[]>(order.items || []);
  const [hasEditedItems, setHasEditedItems] = useState(false);
  const [lineStatuses, setLineStatuses] = useState<Record<number, string>>({});
  const [shortfallConfirmOpen, setShortfallConfirmOpen] = useState(false);
  const [pendingShortfallLines, setPendingShortfallLines] = useState<ShortfallLineItem[]>([]);
  const [isSavingLines, setIsSavingLines] = useState(false);

  // Invalidation check (EC 3: User edits line qty after check)
  const isAtpStaleFromEdit = atpSummary 
    ? MaterialAvailabilityService.getOrderItemsFingerprint({ ...order, items }) !== atpSummary.cacheKey 
    : false;

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      quantity: qty,
      total: qty * (updated[index].unitPrice || 0)
    };
    setItems(updated);
    setHasEditedItems(true);
  };

  const handleLineStatusChange = (index: number, status: string) => {
    setLineStatuses(prev => ({ ...prev, [index]: status }));
  };

  const handleSaveLineItems = (bypassCheck = false) => {
    if (!bypassCheck) {
      const flagged: ShortfallLineItem[] = [];
      items.forEach((item, idx) => {
        const currentStat = lineStatuses[idx] || (item.materialAvailability === 'partially_available' ? 'partial' : item.materialAvailability || 'available');
        if (currentStat === 'partial' || currentStat === 'unavailable' || currentStat === 'timeout') {
          flagged.push({
            lineIndex: idx,
            productName: item.name,
            quantity: item.quantity,
            unit: item.unit,
            status: currentStat as any,
            isTimeout: currentStat === 'timeout'
          });
        }
      });

      if (flagged.length > 0) {
        setPendingShortfallLines(flagged);
        setShortfallConfirmOpen(true);
        return;
      }
    }

    commitSaveLineItems();
  };

  const commitSaveLineItems = (ackReason?: string) => {
    setIsSavingLines(true);
    const newSubtotal = items.reduce((acc, it) => acc + (it.total || it.quantity * (it.unitPrice || 0)), 0);
    const newTax = Math.round(newSubtotal * 0.18);
    const newTotal = newSubtotal + newTax;

    const updatedOrder: Order = {
      ...order,
      items: items.map(it => ackReason ? {
        ...it,
        atpAcknowledgement: {
          acknowledgedBy: `${userName} (${userRole})`,
          acknowledgedAt: new Date().toISOString(),
          reason: ackReason
        }
      } : it),
      subtotal: newSubtotal,
      taxAmount: newTax,
      totalAmount: newTotal,
      version: (order.version || 1) + 1,
      shortfallAcknowledgementReason: ackReason || (order as any).shortfallAcknowledgementReason,
      updatedAt: new Date().toISOString()
    };

    // Update in local cache mirror
    try {
      const localKey = `orders_${tenantId}`;
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const list: Order[] = JSON.parse(cached);
        const idx = list.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          list[idx] = updatedOrder;
          localStorage.setItem(localKey, JSON.stringify(list));
        }
      }
    } catch (e) {
      console.warn('Local mirror update failed', e);
    }

    // EC 1: If order is confirmed and edited (qty increased/changed), sync reservations
    if (isOrderPostConfirmed) {
      try {
        StockReservationService.syncOrderReservationsOnEdit(updatedOrder, {
          tenantId,
          stockItems,
          multiLevelBoms,
          actor: { uid: 'usr_edit', name: userName, role: userRole },
          isSandboxMode
        });
      } catch (err) {
        console.warn('Failed to sync stock reservations on order edit', err);
      }
    }

    onOrderUpdated(updatedOrder);
    setHasEditedItems(false);
    setIsSavingLines(false);
    setShortfallConfirmOpen(false);
  };

  const [simulateNetworkError, setSimulateNetworkError] = useState(false);

  const handleRunAvailabilityCheck = async (forceRefresh = false, retryIndices?: number[]) => {
    if (items.length === 0) return;
    setIsRunningAtpCheck(true);
    setAtpProgress({ completed: 0, total: items.length });
    try {
      const atpOptions: EvaluateConsolidatedAtpOptions = {
        forceRefresh: forceRefresh || !!retryIndices,
        syncTimestamp: lastSyncedTimestamp,
        simulateNetworkFailure: simulateNetworkError,
        retryLineIndices: retryIndices,
        isConfirmedOrder: isOrderPostConfirmed,
        onProgress: (completed, total) => {
          setAtpProgress({ completed, total });
        }
      };

      const res = await MaterialAvailabilityService.evaluateOrderConsolidatedAtp(
        { ...order, items },
        stockItems,
        [], // existing orders
        multiLevelBoms,
        atpOptions
      );
      setAtpSummary(res);
      if (simulateNetworkError) setSimulateNetworkError(false);
    } catch (err) {
      console.error('Consolidated ATP check failed', err);
    } finally {
      setIsRunningAtpCheck(false);
    }
  };

  const canManageHold = ['admin', 'manager', 'management', 'production'].includes(userRole);

  const handleHoldToggle = (putOnHold: boolean, reason?: string) => {
    const updated: Order = {
      ...order,
      isOnHold: putOnHold,
      holdReason: putOnHold ? (reason || 'Operational review') : undefined,
      holdActor: putOnHold ? `${userName} (${userRole})` : undefined,
      holdTimestamp: putOnHold ? new Date().toISOString() : undefined,
      version: (order.version || 1) + 1,
      updatedAt: new Date().toISOString()
    };

    // Update in local cache mirror
    try {
      const localKey = `orders_${tenantId}`;
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const list: Order[] = JSON.parse(cached);
        const idx = list.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          list[idx] = updated;
          localStorage.setItem(localKey, JSON.stringify(list));
        }
      }
    } catch (e) {
      console.warn('Local mirror update failed', e);
    }

    onOrderUpdated(updated);
  };

  const printOrderDetail = () => {
    window.print();
  };

  const currentState = normalizeOrderState(order.status);
  const hasOverride = !!order.hasOverride || !!order.isForceOverridden || (order.statusHistory || []).some(h => h.isOverride);
  const latestOverrideItem = (order.statusHistory || []).slice().reverse().find(h => h.isOverride);
  const persistentWarning = order.unmetPreconditionWarning || latestOverrideItem?.unmetPreconditionWarning;

  const isOrderPostConfirmed = [
    'order_confirmed',
    'in_production',
    'partially_dispatched',
    'fully_dispatched'
  ].includes(order.status.toLowerCase());

  const hasDegradedLines = isOrderPostConfirmed && items.some((_, idx) => {
    const s = lineStatuses[idx];
    return s === 'unavailable' || s === 'partial';
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Order Workspace
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">
                SO #{order.orderNumber}
              </span>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                Rev v{order.version || 1}
              </span>
              {hasOverride && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded shadow-xs flex items-center space-x-1 animate-pulse">
                  <ShieldAlert className="h-3 w-3" />
                  <span>OVERRIDE</span>
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {order.customerName}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Admin Override Action Button for Admins */}
            {userRole === 'admin' && (
              <button
                onClick={() => {
                  setIsOverride(true);
                  setTransitionTarget(currentState);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
                title="Admin State Machine Force Override (Bypass rules with mandatory audit justification)"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-rose-200" />
                <span>Admin Override</span>
              </button>
            )}

            {/* Consolidated Check Availability Action Button (Primary Action, Prominent Placement) */}
            <button
              onClick={() => handleRunAvailabilityCheck()}
              disabled={isRunningAtpCheck || items.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 shadow-sm ${
                items.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white cursor-pointer ring-2 ring-indigo-300/50'
              }`}
              title={
                items.length === 0
                  ? 'Add at least one line to check availability.'
                  : isOrderPostConfirmed
                  ? 'Re-check availability for this confirmed order'
                  : 'Run 1-Click Consolidated ATP Availability Check across all order lines'
              }
            >
              <Sparkles className="h-4 w-4 text-indigo-200" />
              <span>
                {isRunningAtpCheck
                  ? `Checking ${atpProgress.completed}/${atpProgress.total} lines…`
                  : isOrderPostConfirmed
                  ? 'Re-check Availability'
                  : 'Check Availability'}
              </span>
            </button>

            {/* Recursive BOM Explosion & ATP Calculator Button */}
            <button
              onClick={() => {
                setExplosionProductId(order.items?.[0]?.name || 'gear_box');
                setExplosionQty(order.items?.[0]?.quantity || 50);
                setExplosionDate(order.deliveryDate || '2026-11-20');
                setIsExplosionModalOpen(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Open Recursive BOM Explosion & ATP Calculator"
            >
              <Boxes className="h-3.5 w-3.5 text-indigo-600" />
              <span>BOM ATP Engine</span>
            </button>

            <button
              onClick={printOrderDetail}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
              title="Print Order Summary"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition flex items-center space-x-1 cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Audit Trail</span>
              {hasOverride && (
                <span className="w-2 h-2 rounded-full bg-rose-600 inline-block ml-0.5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* PERSISTENT WARNING BANNER (EC: Override with unmet preconditions) */}
          {persistentWarning && (
            <div className="p-4 bg-amber-500/10 border-2 border-amber-500 rounded-xl flex items-start space-x-3 text-amber-950 animate-in fade-in shadow-xs">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded shadow-xs">
                    OVERRIDE
                  </span>
                  <span className="text-xs font-bold font-mono text-amber-900">
                    Administrative State Override with Unmet Preconditions
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-amber-950 leading-relaxed font-sans">
                  {persistentWarning}
                </p>
                {latestOverrideItem && (
                  <div className="mt-2 pt-2 border-t border-amber-200/80 text-[11px] font-mono text-amber-800 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Admin: <strong className="text-amber-950">{latestOverrideItem.userName}</strong></span>
                    <span>Justification: "<em>{latestOverrideItem.overrideReason}</em>"</span>
                    <span>Logged: {new Date(latestOverrideItem.timestamp).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONSOLIDATED ORDER-LEVEL ATP AVAILABILITY SUMMARY PANEL */}
          {(atpSummary || isRunningAtpCheck) && (
            <OrderAtpSummaryPanel
              summary={atpSummary}
              isRunningCheck={isRunningAtpCheck}
              progress={atpProgress}
              isStaleFromEdit={isAtpStaleFromEdit}
              onRerunCheck={() => handleRunAvailabilityCheck(true)}
              onClose={() => setAtpSummary(null)}
              customerPoNumber={order.customerPoNumber}
              deliveryDate={order.deliveryDate}
              preparedBy={`${userName} (${userRole})`}
              isOrderConfirmed={isOrderPostConfirmed}
              onRetryFailedLines={(failedIndices) => handleRunAvailabilityCheck(true, failedIndices)}
              onApplyEarliestDate={(earliestDateStr) => {
                const updated: Order = {
                  ...order,
                  deliveryDate: earliestDateStr,
                  version: (order.version || 1) + 1,
                  updatedAt: new Date().toISOString()
                };
                onOrderUpdated(updated);
              }}
              onAdviseSplitOrder={() => {
                alert('Order Lot-Split Recommended: Proceed with Available components now; balance lot to be dispatched once shortfall materials arrive.');
              }}
            />
          )}

          {/* VISUAL ORDER LIFECYCLE STEPPER */}
          <OrderLifecycleStepper
            order={order}
            userRole={userRole}
            canManageHold={canManageHold}
            onHoldToggle={handleHoldToggle}
            onInitiateTransition={(targetState, isOverrideFlag) => {
              setTransitionTarget(targetState);
              setIsOverride(!!isOverrideFlag);
            }}
            onViewHistory={() => setHistoryOpen(true)}
          />

          {/* Quick Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Customer & Contacts */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-xs font-mono space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Customer Information
              </span>
              <p className="font-bold text-slate-800 text-sm font-sans">{order.customerName}</p>
              {order.phone && (
                <div className="flex items-center space-x-2 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{order.phone}</span>
                </div>
              )}
              {order.customerEmail && (
                <div className="flex items-center space-x-2 text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{order.customerEmail}</span>
                </div>
              )}
              {order.shippingAddress && (
                <div className="flex items-start space-x-2 text-slate-600 pt-1 border-t border-slate-200/60 font-sans">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-tight">{order.shippingAddress}</span>
                </div>
              )}
            </div>

            {/* Commercial & PO Specs */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-xs font-mono space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Commercial Reference
              </span>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Customer PO:</span>
                <span className="font-bold text-slate-800">{order.customerPoNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">PO Date:</span>
                <span className="font-bold text-slate-800">{order.poDate || 'Direct Intake'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Quotation Ref:</span>
                <span className="font-bold text-slate-800">{order.quoteNumber || order.quoteId || 'Direct'}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Target Delivery:</span>
                <span className="font-bold text-indigo-700">{order.deliveryDate || 'Flexible'}</span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-xs font-mono space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Billing & Valuation
              </span>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Subtotal:</span>
                <span>₹{(order.subtotal || Math.round(order.totalAmount / 1.18)).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">GST (18% Avg):</span>
                <span>₹{(order.taxAmount || Math.round(order.totalAmount - (order.totalAmount / 1.18))).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-indigo-600">₹{(order.totalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

          </div>

          {/* EC 4 Post-Confirmation Degraded Warning Banner */}
          {hasDegradedLines && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between text-rose-900 text-xs font-mono font-bold animate-pulse">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Order confirmed with now-unavailable material. Review.</span>
              </div>
              <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-mono">
                Shortfall Alert
              </span>
            </div>
          )}

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Package className="h-4 w-4 text-indigo-600" />
                <span>Components & Bill of Quantities ({items.length})</span>
                {hasEditedItems && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold">
                    Unsaved Edits
                  </span>
                )}
              </span>
              <div className="flex items-center space-x-2">
                {hasEditedItems && (
                  <button
                    type="button"
                    onClick={() => handleSaveLineItems(false)}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-mono font-bold transition shadow-3xs cursor-pointer flex items-center space-x-1"
                  >
                    <span>Save Line Changes</span>
                  </button>
                )}
                <span className="text-[11px] font-mono text-slate-500">
                  All prices in INR (₹)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100/70 text-[10px] font-mono uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Part Description</th>
                    <th className="p-3">Material Availability (ATP)</th>
                    <th className="p-3">HSN Code</th>
                    <th className="p-3 text-right">Ordered Qty (Editable)</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Line Status</th>
                    <th className="p-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {items.map((item, idx) => {
                    const lineState = normalizeOrderState(item.lineItemStatus || order.status);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-sans">
                          <span className="font-bold text-slate-900 block">{item.name}</span>
                          {item.specs && <span className="text-[10px] text-slate-500">{item.specs}</span>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-1.5">
                            <TrafficLightAvailabilityBadge
                              productName={item.name}
                              quantity={item.quantity}
                              asOfDate={order.deliveryDate}
                              orderStatus={order.status}
                              wasConfirmedAvailable={true}
                              onStatusChange={(stat) => handleLineStatusChange(idx, stat)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setExplosionProductId(item.name);
                                setExplosionQty(item.quantity || 1);
                                setExplosionDate(order.deliveryDate || '2026-11-20');
                                setIsExplosionModalOpen(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              title="Explode BOM & Calculate Component ATP"
                            >
                              <Cpu className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-slate-500">{item.hsn || '8483'}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(idx, item.quantity - 5)}
                              disabled={item.quantity <= 1}
                              className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer disabled:opacity-40"
                              title="-5 units"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                              className="w-16 px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-center text-xs font-bold font-mono focus:bg-white focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(idx, item.quantity + 5)}
                              className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer"
                              title="+5 units"
                            >
                              +
                            </button>
                            <span className="text-slate-400 text-[10px] ml-1">{item.unit || 'pcs'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          ₹{(item.unitPrice || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right">
                          <span className="inline-block text-[9px] uppercase px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {lineState.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          ₹{(item.total || item.quantity * (item.unitPrice || 0)).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RESERVED MATERIALS PANEL (Acceptance Criteria 6) */}
          <ReservedMaterialsPanel
            order={{ ...order, items }}
            tenantId={tenantId}
            userRole={userRole}
            userName={userName}
            isSandboxMode={isSandboxMode}
            onReservationUpdated={() => {
              // Refresh order data if necessary
            }}
          />

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-slate-500">
            FlowOps Manufacturing ERP • Visual Lifecycle Stepper v2.0
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition shadow-3xs"
          >
            Close Order
          </button>
        </div>

      </div>

      {/* Audit History Modal */}
      {historyOpen && (
        <OrderStatusHistoryModal
          isOpen={historyOpen}
          order={order}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* State Transition Modal */}
      {transitionTarget && (
        <OrderStateTransitionModal
          isOpen={!!transitionTarget}
          order={order}
          targetState={transitionTarget}
          isOverrideModal={isOverride}
          userRole={userRole}
          userName={userName}
          userId={userId}
          userEmail={userEmail}
          tenantId={tenantId}
          isSandboxMode={isSandboxMode}
          onClose={() => {
            setTransitionTarget(null);
            setIsOverride(false);
          }}
          onSuccess={(updated) => {
            onOrderUpdated(updated);
            setTransitionTarget(null);
            setIsOverride(false);
          }}
        />
      )}

      {/* ATP Shortfall Acknowledgement Modal */}
      {activeAtpAckResult && (
        <AtpAcknowledgementModal
          isOpen={!!activeAtpAckResult}
          atpResult={activeAtpAckResult}
          userName={userName}
          userRole={userRole}
          onClose={() => setActiveAtpAckResult(null)}
          onConfirm={(reason) => {
            const updatedItems = (order.items || []).map(it => {
              if (it.id === activeAtpAckResult.orderItemId || it.name === activeAtpAckResult.productName) {
                return {
                  ...it,
                  materialAvailability: activeAtpAckResult.overallStatus,
                  atpAcknowledgement: {
                    acknowledgedBy: userName,
                    acknowledgedAt: new Date().toISOString(),
                    reason
                  }
                };
              }
              return it;
            });

            const updatedOrder: Order = {
              ...order,
              items: updatedItems,
              version: (order.version || 1) + 1,
              updatedAt: new Date().toISOString()
            };

            onOrderUpdated(updatedOrder);
            setActiveAtpAckResult(null);
          }}
        />
      )}

      {/* Recursive BOM Explosion & ATP Calculator Modal */}
      {isExplosionModalOpen && (
        <BomExplosionAtpModal
          isOpen={isExplosionModalOpen}
          onClose={() => setIsExplosionModalOpen(false)}
          initialProductId={explosionProductId}
          initialQuantity={explosionQty}
          initialAsOfDate={explosionDate}
        />
      )}

      {/* Non-blocking ATP Shortfall Save Confirmation Modal */}
      <AtpShortfallSaveConfirmationModal
        isOpen={shortfallConfirmOpen}
        onClose={() => setShortfallConfirmOpen(false)}
        onConfirm={(reason) => commitSaveLineItems(reason)}
        shortfallLines={pendingShortfallLines}
        orderNumber={order.orderNumber}
        isSaving={isSavingLines}
      />
    </div>
  );
};
