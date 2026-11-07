// src/components/orders/VisualOrderLifecycleBar.tsx

import React, { useState } from 'react';
import { Order, QuoteItem } from '../../types';
import { 
  OrderLifecycleState, 
  ORDER_LIFECYCLE_STATES, 
  normalizeOrderState,
  OrderStatusHistoryItem
} from '../../types/orderStateMachine';
import { 
  Check, 
  Clock, 
  AlertTriangle, 
  PauseCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Calendar, 
  Layers, 
  Truck, 
  Cpu, 
  CheckCheck, 
  Receipt, 
  CreditCard, 
  Archive, 
  FileText, 
  HelpCircle,
  CheckCircle,
  PlayCircle
} from 'lucide-react';

interface VisualOrderLifecycleBarProps {
  order: Order;
  onHoldToggle?: (putOnHold: boolean, reason?: string) => void;
  canManageHold?: boolean;
}

export const VisualOrderLifecycleBar: React.FC<VisualOrderLifecycleBarProps> = ({
  order,
  onHoldToggle,
  canManageHold = false
}) => {
  const currentState = normalizeOrderState(order.status);
  const isCancelled = currentState === 'cancelled';
  const isOnHold = !!order.isOnHold;

  const [activeTooltipStep, setActiveTooltipStep] = useState<string | null>(null);
  const [showLineItemsDetail, setShowLineItemsDetail] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdReasonInput, setHoldReasonInput] = useState('');

  // 1. Calculate Progression Metrics
  const items: QuoteItem[] = order.items || [];
  const totalOrderedQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  // Produced / WIP Qty
  const totalProducedQty = items.reduce((sum, item) => {
    if (item.producedQty !== undefined) return sum + item.producedQty;
    // Fallback based on lineItemStatus or order state
    const lineSt = normalizeOrderState(item.lineItemStatus || order.status);
    if (['in_production', 'partially_dispatched', 'fully_dispatched', 'invoiced', 'payment_received', 'closed'].includes(lineSt)) {
      if (lineSt === 'in_production') return sum + Math.round((item.quantity || 0) * 0.6); // 60% default WIP
      return sum + (item.quantity || 0);
    }
    return sum;
  }, 0);

  // Dispatched Qty
  const totalDispatchedQty = items.reduce((sum, item) => {
    if (item.dispatchedQty !== undefined) return sum + item.dispatchedQty;
    const lineSt = normalizeOrderState(item.lineItemStatus || order.status);
    if (lineSt === 'partially_dispatched') return sum + Math.round((item.quantity || 0) * 0.6); // 60% dispatched default
    if (['fully_dispatched', 'invoiced', 'payment_received', 'closed'].includes(lineSt)) {
      return sum + (item.quantity || 0);
    }
    return sum;
  }, 0);

  const productionPercentage = totalOrderedQty > 0 
    ? Math.min(100, Math.round((totalProducedQty / totalOrderedQty) * 100)) 
    : 0;

  const dispatchPercentage = totalOrderedQty > 0 
    ? Math.min(100, Math.round((totalDispatchedQty / totalOrderedQty) * 100)) 
    : 0;

  // 2. Line Items Lowest-Common-Denominator Calculation (Edge Case 3)
  const lineItemStates = items.map(item => normalizeOrderState(item.lineItemStatus || order.status));
  const hasMultipleLineStates = items.length > 1 && new Set(lineItemStates).size > 1;

  // 3. Map status history events to steps for tooltips
  const history: OrderStatusHistoryItem[] = order.statusHistory || [];
  const getHistoryForState = (stateId: OrderLifecycleState): OrderStatusHistoryItem | undefined => {
    // Look for the event that moved TO this state
    return history.find(h => h.newState === stateId);
  };

  // Progression steps list (excluding cancelled, which replaces the bar per EC 1)
  const baseSteps = ORDER_LIFECYCLE_STATES.filter(s => s.id !== 'cancelled');
  const currentStepIndex = baseSteps.findIndex(s => s.id === currentState);

  // Format date helper
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'Date recorded';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + 
        ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // Metric caption generator for step node
  const getStepMetricCaption = (stateId: OrderLifecycleState, isCurrent: boolean, isPast: boolean) => {
    if (stateId === 'in_production') {
      if (isCurrent) {
        return `${productionPercentage}% complete (${totalProducedQty}/${totalOrderedQty} units)`;
      }
      if (isPast) {
        return `100% produced (${totalOrderedQty} units)`;
      }
    }
    if (stateId === 'partially_dispatched') {
      if (isCurrent) {
        return `${dispatchPercentage}% shipped (${totalDispatchedQty}/${totalOrderedQty} units)`;
      }
      if (isPast) {
        return `${totalDispatchedQty}/${totalOrderedQty} shipped`;
      }
    }
    if (stateId === 'fully_dispatched') {
      if (isCurrent || isPast) {
        return `100% dispatched (${totalOrderedQty} units)`;
      }
    }
    if (stateId === 'invoiced') {
      if (isCurrent || isPast) {
        return `Tax Invoice ₹${(order.totalAmount || 0).toLocaleString('en-IN')}`;
      }
    }
    if (stateId === 'payment_received') {
      if (isCurrent || isPast) {
        return `Settled ₹${(order.totalAmount || 0).toLocaleString('en-IN')}`;
      }
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4 font-sans select-none">
      
      {/* Header Info: Title, Hold Banner, Concurrency Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-600">
                Order Lifecycle Tracker
              </span>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                Rev v{order.version || 1}
              </span>
              {isOnHold && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  <PauseCircle className="h-3 w-3" />
                  <span>ON HOLD</span>
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">
              Lifecycle Progress: <span className="text-indigo-600 font-mono">{currentState.replace(/_/g, ' ').toUpperCase()}</span>
            </h3>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center space-x-2">
          {hasMultipleLineStates && (
            <button
              onClick={() => setShowLineItemsDetail(!showLineItemsDetail)}
              className="text-xs font-mono font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition flex items-center space-x-1 cursor-pointer"
              title="Individual order items are in differing lifecycle stages. Click to inspect line item breakdown."
            >
              <span>Line Item Breakdown ({items.length})</span>
              {showLineItemsDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          {canManageHold && !isCancelled && (
            <button
              onClick={() => {
                if (isOnHold) {
                  onHoldToggle?.(false);
                } else {
                  setHoldModalOpen(true);
                }
              }}
              className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition flex items-center space-x-1 cursor-pointer ${
                isOnHold
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {isOnHold ? (
                <>
                  <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Resume Order</span>
                </>
              ) : (
                <>
                  <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Put on Hold</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* EDGE CASE 1: ORDER IS CANCELLED */}
      {isCancelled ? (
        <div className="bg-rose-50/90 border border-rose-300 rounded-xl p-4 text-rose-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-rose-950 font-mono">
                  Order Cancelled & Lifecycle Terminated
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  This order was aborted before full closure. Normal state transitions are locked.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold bg-rose-200/80 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-lg uppercase">
              Cancelled Status
            </span>
          </div>

          <div className="mt-2 pt-2.5 border-t border-rose-200/80 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 gap-2 text-rose-800">
            <div>
              <span className="font-bold">Cancellation Reason: </span>
              <span>{order.cancellationReason || order.statusHistory?.slice(-1)[0]?.remarks || 'Customer request / commercial cancellation.'}</span>
            </div>
            <div>
              <span className="font-bold">Actor: </span>
              <span>{order.cancellationActor || order.statusHistory?.slice(-1)[0]?.userName || 'Authorized Supervisor'} ({order.statusHistory?.slice(-1)[0]?.userRole || 'admin'})</span>
            </div>
            {order.cancellationTimestamp && (
              <div className="sm:col-span-2 text-[11px] text-rose-600">
                Timestamp: {formatDateTime(order.cancellationTimestamp)}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STANDARD HORIZONTAL STEPPER PROGRESS BAR */
        <div className="space-y-4">
          
          {/* EDGE CASE 2: VISUAL ON HOLD PAUSE NOTIFICATION */}
          {isOnHold && (
            <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-3 flex items-center justify-between text-amber-900 text-xs">
              <div className="flex items-center space-x-2">
                <PauseCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold font-mono uppercase tracking-wider">
                    Manufacturing Operations Paused (On Hold)
                  </span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Reason: <span className="font-semibold">{order.holdReason || 'Awaiting customer specification clarification.'}</span>
                    {order.holdActor && <span> • Flagged by {order.holdActor}</span>}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 border border-amber-400 px-2 py-0.5 rounded uppercase">
                Holding State
              </span>
            </div>
          )}

          {/* Horizontal Scrollable Stepper Track */}
          <div className="overflow-x-auto pb-4 pt-1">
            <div className="min-w-[840px] flex items-start justify-between relative px-4">
              
              {baseSteps.map((step, idx) => {
                const isPast = currentStepIndex > idx;
                const isCurrent = currentStepIndex === idx;
                const isUpcoming = currentStepIndex < idx;

                const historyItem = getHistoryForState(step.id);
                const metricCaption = getStepMetricCaption(step.id, isCurrent, isPast);
                const isHovered = activeTooltipStep === step.id;

                return (
                  <div key={step.id} className="flex-1 relative flex flex-col items-center group">
                    
                    {/* Connecting Progress Line Segment */}
                    {idx > 0 && (
                      <div 
                        className={`absolute top-4 right-1/2 left-[-50%] h-1 transition-all duration-300 -z-0 ${
                          isPast 
                            ? 'bg-indigo-600' 
                            : isCurrent 
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-300' 
                              : 'bg-slate-200'
                        }`}
                      />
                    )}

                    {/* Step Node Circle (Interactive with Tooltip Trigger) */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseEnter={() => setActiveTooltipStep(step.id)}
                        onMouseLeave={() => setActiveTooltipStep(null)}
                        onClick={() => setActiveTooltipStep(activeTooltipStep === step.id ? null : step.id)}
                        className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all duration-200 cursor-pointer ${
                          isPast
                            ? 'bg-indigo-600 text-white shadow-2xs hover:scale-105 hover:ring-2 hover:ring-indigo-300'
                            : isCurrent
                              ? isOnHold
                                ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-md animate-pulse'
                                : 'bg-white border-2 border-indigo-600 text-indigo-700 ring-4 ring-indigo-100 shadow-sm scale-110'
                              : 'bg-slate-100 border border-slate-300 text-slate-400 hover:border-slate-400'
                        }`}
                        title={`${step.label}: Click to inspect transition log`}
                      >
                        {isPast ? (
                          <Check className="h-4 w-4 stroke-3" />
                        ) : (
                          <span>{step.stepOrder}</span>
                        )}
                      </button>

                      {/* Tooltip / Popover with Transition Timestamp & User */}
                      {(isHovered || (isCurrent && !isPast && !isUpcoming && activeTooltipStep === null)) && (
                        <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-30 w-64 p-2.5 bg-slate-900 text-white rounded-xl shadow-xl text-left pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                              {step.label}
                            </span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                              isPast 
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                                : isCurrent 
                                  ? 'bg-indigo-900 text-indigo-200 border border-indigo-700' 
                                  : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isPast ? 'Completed' : isCurrent ? 'Active State' : 'Upcoming'}
                            </span>
                          </div>

                          {historyItem ? (
                            <div className="space-y-1 text-[11px] font-mono text-slate-300">
                              <div className="flex items-center space-x-1">
                                <User className="h-3 w-3 text-slate-400" />
                                <span className="text-white font-semibold">{historyItem.userName}</span>
                                <span className="text-[10px] text-slate-400">({historyItem.userRole})</span>
                              </div>
                              <div className="flex items-center space-x-1 text-slate-400">
                                <Clock className="h-3 w-3" />
                                <span>{formatDateTime(historyItem.timestamp)}</span>
                              </div>
                              {historyItem.remarks && (
                                <p className="text-[10px] text-slate-300 font-sans pt-1 border-t border-slate-800/80 italic">
                                  "{historyItem.remarks}"
                                </p>
                              )}
                            </div>
                          ) : isCurrent ? (
                            <div className="text-[11px] font-mono text-slate-300">
                              <p className="text-white font-semibold">Active In Progress</p>
                              <p className="text-slate-400 text-[10px] mt-0.5">
                                Current operational station. Work orders and routing active.
                              </p>
                            </div>
                          ) : (
                            <div className="text-[10px] font-mono text-slate-400">
                              Scheduled future stage. Pending completion of preceding milestones.
                            </div>
                          )}

                          {/* Arrow pointing down */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                        </div>
                      )}
                    </div>

                    {/* Step Label & Caption */}
                    <div className="mt-2 text-center max-w-[100px]">
                      <span 
                        className={`block text-[11px] font-mono leading-tight tracking-tight ${
                          isCurrent 
                            ? 'font-bold text-indigo-700' 
                            : isPast 
                              ? 'font-semibold text-slate-800' 
                              : 'font-medium text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>

                      {/* Dynamic Metric Caption (e.g. In Production – 60% complete (60/100 units)) */}
                      {metricCaption && (
                        <div className="mt-1">
                          <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded leading-tight ${
                            isCurrent
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-3xs'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {metricCaption}
                          </span>

                          {/* Progress Meter bar inside current node */}
                          {isCurrent && (step.id === 'in_production' || step.id === 'partially_dispatched') && (
                            <div className="w-16 h-1 bg-slate-200 rounded-full mt-1 mx-auto overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                                style={{ width: `${step.id === 'in_production' ? productionPercentage : dispatchPercentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* EDGE CASE 3: LINE ITEMS STATE BREAKDOWN (Expandable) */}
      {showLineItemsDetail && items.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-900">
                Individual Line Item Lifecycle Status
              </span>
              <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                Overall: Lowest Common Denominator ({currentState.replace(/_/g, ' ')})
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Total Components: {items.length}
            </span>
          </div>

          <div className="divide-y divide-slate-200/80 text-xs font-mono bg-white rounded-lg border border-slate-200 overflow-hidden">
            {items.map((item, idx) => {
              const itemState = normalizeOrderState(item.lineItemStatus || order.status);
              const meta = ORDER_LIFECYCLE_STATES.find(s => s.id === itemState);
              const produced = item.producedQty !== undefined 
                ? item.producedQty 
                : (itemState === 'in_production' ? Math.round(item.quantity * 0.6) : item.quantity);
              const pct = item.quantity > 0 ? Math.round((produced / item.quantity) * 100) : 0;

              return (
                <div key={item.id || idx} className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/50">
                  <div className="max-w-md">
                    <span className="font-bold text-slate-800 block truncate font-sans text-xs">{item.name}</span>
                    <span className="text-[11px] text-slate-500">
                      Ordered: {item.quantity} units • Produced: {produced} units ({pct}%)
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="h-full bg-indigo-600 rounded-full" 
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${meta?.badgeClass || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                      {meta?.label || itemState}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hold Reason Modal */}
      {holdModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-2 text-amber-900">
              <PauseCircle className="h-5 w-5 text-amber-600" />
              <h4 className="text-sm font-bold font-mono uppercase tracking-wider">
                Put Order #{order.orderNumber} On Hold
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Placing an order on hold halts shopfloor work orders and marks the lifecycle bar with a holding banner. Please provide an operational reason:
            </p>

            <textarea
              value={holdReasonInput}
              onChange={(e) => setHoldReasonInput(e.target.value)}
              placeholder="e.g. Awaiting client drawing revision, material inspection discrepancy..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
            />

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHoldModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onHoldToggle?.(true, holdReasonInput.trim() || 'Operations paused by supervisor');
                  setHoldModalOpen(false);
                  setHoldReasonInput('');
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-3xs"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
