// src/components/orders/OrderLifecycleStepper.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Order, UserRole, QuoteItem } from '../../types';
import { 
  ORDER_LIFECYCLE_STATES, 
  ORDER_STATE_TRANSITIONS,
  normalizeOrderState, 
  OrderLifecycleState,
  OrderStatusHistoryItem,
  STATE_DISPLAY_NAMES
} from '../../types/orderStateMachine';
import { OrderStateMachineService } from '../../services/orderStateMachineService';
import { 
  Check, 
  Clock, 
  AlertTriangle, 
  PauseCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  User, 
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
  PlayCircle,
  ShieldAlert,
  ArrowRight,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';

export interface OrderLifecycleStepperProps {
  order: Order;
  userRole?: UserRole;
  onInitiateTransition?: (targetState: OrderLifecycleState, isOverride?: boolean) => void;
  onViewHistory?: () => void;
  onHoldToggle?: (putOnHold: boolean, reason?: string) => void;
  canManageHold?: boolean;
  compact?: boolean;
  showExpandableLineStates?: boolean;
}

export const OrderLifecycleStepper: React.FC<OrderLifecycleStepperProps> = ({
  order,
  userRole = 'sales',
  onInitiateTransition,
  onViewHistory,
  onHoldToggle,
  canManageHold = false,
  compact = false,
  showExpandableLineStates = true
}) => {
  const currentState = normalizeOrderState(order.status);
  const isCancelled = currentState === 'cancelled';
  const isClosed = currentState === 'closed';
  const isOnHold = !!order.isOnHold;

  // Active hover/tap tooltip state
  const [activeTooltipStep, setActiveTooltipStep] = useState<string | null>(null);
  const [showNextActionTooltip, setShowNextActionTooltip] = useState(false);
  const [showLineItemsDetail, setShowLineItemsDetail] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdReasonInput, setHoldReasonInput] = useState('');

  // Mobile container scroll ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 1. Check history availability (EC: Order has no history entries / legacy data)
  const history: OrderStatusHistoryItem[] = order.statusHistory || [];
  const hasHistory = history.length > 0;

  // Find history record that transitioned INTO a given state
  const getHistoryForState = (stateId: OrderLifecycleState): OrderStatusHistoryItem | undefined => {
    return history.find(h => h.newState === stateId);
  };

  // 2. Multi-line items and progress metrics calculation
  const items: QuoteItem[] = order.items || [];
  const totalOrderedQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Produced Qty
  const totalProducedQty = items.reduce((sum, item) => {
    if (item.producedQty !== undefined) return sum + item.producedQty;
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
    if (lineSt === 'partially_dispatched') return sum + Math.round((item.quantity || 0) * 0.6);
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

  // 3. Multi-line mixed line states detection (EC: Lowest Common Denominator)
  const lineItemStates = items.map(item => normalizeOrderState(item.lineItemStatus || order.status));
  const hasMultipleLineStates = items.length > 1 && new Set(lineItemStates).size > 1;

  // Ordered canonical progression states (excluding cancelled, which replaces stepper per EC)
  const progressionStates = ORDER_LIFECYCLE_STATES.filter(s => s.id !== 'cancelled');
  const currentStepIndex = progressionStates.findIndex(s => s.id === currentState);

  // 4. Identify Next Valid Forward Action
  const nextTransitionRule = useMemo(() => {
    if (isCancelled || isClosed) return null;
    
    // Look for forward rules originating from current state
    const rules = ORDER_STATE_TRANSITIONS.filter(r => r.from === currentState && r.to !== 'cancelled' && !r.isReversible);
    if (rules.length === 0) return null;

    // Prioritize primary forward step
    if (currentState === 'in_production') {
      // Default primary action to full dispatch if complete, or partial dispatch
      return rules.find(r => r.to === 'fully_dispatched') || rules[0];
    }
    return rules[0];
  }, [currentState, isCancelled, isClosed]);

  const isRoleAllowedForNextAction = useMemo(() => {
    if (!nextTransitionRule) return false;
    return nextTransitionRule.allowedRoles.includes(userRole);
  }, [nextTransitionRule, userRole]);

  // Next action display label
  const nextActionLabel = useMemo(() => {
    if (!nextTransitionRule) return null;
    if (currentState === 'enquiry') return 'Submit Quote';
    if (currentState === 'quoted') return 'Confirm Order (PO)';
    if (currentState === 'order_confirmed') return 'Release to Production';
    if (currentState === 'in_production') return 'Create Dispatch';
    if (currentState === 'partially_dispatched') return 'Dispatch Balance';
    if (currentState === 'fully_dispatched') return 'Generate Invoice';
    if (currentState === 'invoiced') return 'Record Payment';
    if (currentState === 'payment_received') return 'Close & Archive';
    return nextTransitionRule.actionLabel;
  }, [nextTransitionRule, currentState]);

  // 5. Scroll container listener & auto-scroll into view (EC: 9+ states on mobile)
  const checkScrollFades = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollFades();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollFades, { passive: true });
      window.addEventListener('resize', checkScrollFades);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScrollFades);
      window.removeEventListener('resize', checkScrollFades);
    };
  }, []);

  // Auto-scroll current state into view on load
  useEffect(() => {
    if (currentStepRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        currentStepRef.current?.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest'
        });
      }, 150);
    }
  }, [currentState]);

  // Helper: Format date/time string (e.g., "02 Nov, 11:32 AM")
  const formatTimestamp = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${day}, ${time}`;
    } catch {
      return iso;
    }
  };

  // Helper: Step metric sub-labels
  const getStepMetricSubLabel = (stateId: OrderLifecycleState, isCurrent: boolean, isPast: boolean) => {
    if (stateId === 'in_production') {
      if (isCurrent) return `In Production — ${totalProducedQty}/${totalOrderedQty} units (${productionPercentage}%)`;
      if (isPast) return `100% Produced (${totalOrderedQty} units)`;
    }
    if (stateId === 'partially_dispatched') {
      if (isCurrent) return `Partially Dispatched — ${totalDispatchedQty}/${totalOrderedQty} shipped (${dispatchPercentage}%)`;
      if (isPast) return `${totalDispatchedQty}/${totalOrderedQty} units dispatched`;
    }
    if (stateId === 'fully_dispatched') {
      if (isCurrent || isPast) return `100% Dispatched (${totalOrderedQty} units)`;
    }
    if (stateId === 'invoiced') {
      if (isCurrent || isPast) return `Tax Invoice ₹${(order.totalAmount || 0).toLocaleString('en-IN')}`;
    }
    if (stateId === 'payment_received') {
      if (isCurrent || isPast) return `Settled ₹${(order.totalAmount || 0).toLocaleString('en-IN')}`;
    }
    if (stateId === 'order_confirmed') {
      if (isCurrent) return 'PO Confirmed & Scheduled';
      if (isPast) return 'PO Acknowledged';
    }
    if (stateId === 'quoted') {
      if (isCurrent) return 'Quotation Shared';
      if (isPast) return 'Quote Accepted';
    }
    if (stateId === 'enquiry') {
      if (isCurrent) return 'Requirement Intake';
      if (isPast) return 'Requirement Logged';
    }
    if (stateId === 'closed') {
      if (isCurrent || isPast) return 'Archived & Complete';
    }
    return null;
  };

  // State icon renderer
  const renderStateIcon = (stateId: OrderLifecycleState, isPast: boolean, isCurrent: boolean) => {
    if (isPast && hasHistory) {
      return <Check className="h-4 w-4 stroke-3" />;
    }
    switch (stateId) {
      case 'enquiry': return <HelpCircle className="h-3.5 w-3.5" />;
      case 'quoted': return <FileText className="h-3.5 w-3.5" />;
      case 'order_confirmed': return <CheckCircle className="h-3.5 w-3.5" />;
      case 'in_production': return <Cpu className="h-3.5 w-3.5" />;
      case 'partially_dispatched': return <Truck className="h-3.5 w-3.5" />;
      case 'fully_dispatched': return <CheckCheck className="h-3.5 w-3.5" />;
      case 'invoiced': return <Receipt className="h-3.5 w-3.5" />;
      case 'payment_received': return <CreditCard className="h-3.5 w-3.5" />;
      case 'closed': return <Archive className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4 font-sans select-none">
      
      {/* ── TOP HEADER BAR ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        
        {/* Title, Current State Badge, Hold / Override Badges */}
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-600">
                Order Lifecycle Stepper
              </span>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                Rev v{order.version || 1}
              </span>
              {(order.hasOverride || order.isForceOverridden || (order.statusHistory || []).some(h => h.isOverride)) && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold bg-rose-600 text-white px-2 py-0.5 rounded shadow-xs uppercase tracking-wider animate-pulse">
                  <ShieldAlert className="h-3 w-3" />
                  <span>OVERRIDE</span>
                </span>
              )}
              {isOnHold && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  <PauseCircle className="h-3 w-3" />
                  <span>ON HOLD</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 mt-0.5">
              <h3 className="text-sm font-bold text-slate-900">
                Current Stage:
              </h3>
              <span className={`inline-flex items-center space-x-1 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                isCancelled 
                  ? 'bg-rose-50 text-rose-700 border-rose-300' 
                  : isClosed 
                    ? 'bg-slate-900 text-white border-slate-900' 
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                <span>{STATE_DISPLAY_NAMES[currentState] || currentState.replace(/_/g, ' ')}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions & Next Action Button */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* NEXT ACTION BUTTON (Appears next to current state) */}
          {nextTransitionRule && !isCancelled && !isClosed && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (isRoleAllowedForNextAction && onInitiateTransition) {
                    onInitiateTransition(nextTransitionRule.to, false);
                  }
                }}
                onMouseEnter={() => !isRoleAllowedForNextAction && setShowNextActionTooltip(true)}
                onMouseLeave={() => setShowNextActionTooltip(false)}
                disabled={!isRoleAllowedForNextAction}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer ${
                  isRoleAllowedForNextAction
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-300/60 active:scale-98'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                }`}
                title={isRoleAllowedForNextAction ? nextTransitionRule.description : undefined}
              >
                {!isRoleAllowedForNextAction ? (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                )}
                <span>Next Action: {nextActionLabel}</span>
                {isRoleAllowedForNextAction && <ArrowRight className="h-3.5 w-3.5 ml-0.5" />}
              </button>

              {/* Tooltip for disabled Next Action */}
              {showNextActionTooltip && !isRoleAllowedForNextAction && (
                <div className="absolute right-0 top-full mt-1.5 z-40 w-64 p-2 bg-slate-900 text-white text-[11px] font-mono rounded-lg shadow-xl animate-in fade-in">
                  <div className="flex items-center space-x-1 text-rose-400 font-bold mb-0.5">
                    <Lock className="h-3 w-3" />
                    <span>Permission Required</span>
                  </div>
                  <p className="text-slate-300 font-sans text-[11px] leading-tight">
                    Action requires role: <strong className="text-white">{nextTransitionRule.allowedRoles.map(r => r.toUpperCase()).join(' or ')}</strong>.
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    Your current active role is '{userRole}'. Contact supervisor.
                  </p>
                  <div className="absolute bottom-full right-4 w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-slate-900" />
                </div>
              )}
            </div>
          )}

          {/* Line item breakdown accordion trigger (EC: Multi-line order with mixed states) */}
          {hasMultipleLineStates && showExpandableLineStates && (
            <button
              onClick={() => setShowLineItemsDetail(!showLineItemsDetail)}
              className="text-xs font-mono font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg border border-purple-200 transition flex items-center space-x-1 cursor-pointer"
              title="Individual order items are in differing lifecycle stages. Click to inspect breakdown."
            >
              <span>Line Item Breakdown ({items.length})</span>
              {showLineItemsDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Hold / Resume Action */}
          {canManageHold && !isCancelled && (
            <button
              onClick={() => {
                if (isOnHold) {
                  onHoldToggle?.(false);
                } else {
                  setHoldModalOpen(true);
                }
              }}
              className={`text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center space-x-1 cursor-pointer ${
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
                  <span>Hold Order</span>
                </>
              )}
            </button>
          )}

          {/* Audit History trigger */}
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="text-xs font-mono text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-300 transition cursor-pointer flex items-center space-x-1 font-bold"
              title="Inspect full immutable transition audit trail"
            >
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Audit Trail ({history.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── EDGE CASE 1: ORDER IS CANCELLED ────────────────────────── */}
      {isCancelled ? (
        <div className="bg-rose-50/90 border border-rose-300 rounded-xl p-4 text-rose-900 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-rose-950 font-mono">
                  Order Cancelled & Lifecycle Terminated
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  This order was cancelled prior to full closure. All future forward transitions are locked.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold bg-rose-200/80 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-lg uppercase">
              Cancelled Status
            </span>
          </div>

          <div className="mt-2 pt-2.5 border-t border-rose-200/80 text-xs font-mono grid grid-cols-1 sm:grid-cols-3 gap-2 text-rose-800">
            <div>
              <span className="font-bold">Reason: </span>
              <span>{order.cancellationReason || order.statusHistory?.slice(-1)[0]?.remarks || 'Customer request / commercial cancellation.'}</span>
            </div>
            <div>
              <span className="font-bold">Actor: </span>
              <span>{order.cancellationActor || order.statusHistory?.slice(-1)[0]?.userName || 'Authorized Supervisor'} ({order.statusHistory?.slice(-1)[0]?.userRole || 'admin'})</span>
            </div>
            <div>
              <span className="font-bold">Timestamp: </span>
              <span>{formatTimestamp(order.cancellationTimestamp || order.statusHistory?.slice(-1)[0]?.timestamp)}</span>
            </div>
          </div>
        </div>
      ) : (
        /* ── HORIZONTAL STEPPER PROGRESS TRACK (Responsive & Mobile Fades) ── */
        <div className="relative">
          
          {/* Left Gradient Edge Fade (when scrolled right on mobile) */}
          {canScrollLeft && (
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-20 transition-opacity" />
          )}

          {/* Right Gradient Edge Fade (when scrollable right on mobile) */}
          {canScrollRight && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-20 transition-opacity" />
          )}

          {/* Scrollable Track Container */}
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto pb-4 pt-2 scroll-smooth"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="min-w-[860px] flex items-start justify-between relative px-4">
              
              {progressionStates.map((step, idx) => {
                const isPast = currentStepIndex > idx;
                const isCurrent = currentStepIndex === idx;
                const isUpcoming = currentStepIndex < idx;

                const historyItem = getHistoryForState(step.id);
                const hasStepHistory = !!historyItem;
                const metricSubLabel = getStepMetricSubLabel(step.id, isCurrent, isPast);
                const isHovered = activeTooltipStep === step.id;
                const isOverridden = !!historyItem?.isOverride;

                // Completed state style determination
                // EC: Order has no history entries (legacy data) -> completed states are greyed with note
                const isLegacyWithoutHistory = isPast && !hasHistory;

                return (
                  <React.Fragment key={step.id}>
                    
                    {/* Stepper Node Column */}
                    <div 
                      ref={isCurrent ? currentStepRef : undefined}
                      className="flex-1 relative flex flex-col items-center group"
                    >
                      
                      {/* Connecting Progress Line Segment */}
                      {idx > 0 && (
                        <div 
                          className={`absolute top-4 right-1/2 left-[-50%] h-1 transition-all duration-300 -z-0 ${
                            isPast && (!isLegacyWithoutHistory)
                              ? 'bg-indigo-600' 
                              : isCurrent 
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-300' 
                                : 'bg-slate-200'
                          }`}
                        />
                      )}

                      {/* Step Circle Node Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onMouseEnter={() => setActiveTooltipStep(step.id)}
                          onMouseLeave={() => setActiveTooltipStep(null)}
                          onClick={() => setActiveTooltipStep(activeTooltipStep === step.id ? null : step.id)}
                          className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all duration-200 cursor-pointer ${
                            isPast
                              ? isLegacyWithoutHistory
                                ? 'bg-slate-200 border border-slate-300 text-slate-500' // Legacy no history
                                : 'bg-indigo-600 text-white shadow-2xs hover:scale-105 hover:ring-2 hover:ring-indigo-300'
                              : isCurrent
                                ? isOnHold
                                  ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-md animate-pulse'
                                  : 'bg-white border-2 border-indigo-600 text-indigo-700 ring-4 ring-indigo-100 shadow-sm scale-110 font-black'
                                : 'bg-slate-100 border border-slate-300 text-slate-400 hover:border-slate-400'
                          }`}
                          title={`${step.label}: Click to inspect transition log`}
                        >
                          {renderStateIcon(step.id, isPast, isCurrent)}
                        </button>

                        {/* SMALL ⚠️ ICON ON OVERRIDDEN TRANSITION (with Tooltip) */}
                        {isOverridden && (
                          <div 
                            className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer animate-bounce"
                            title={`Admin Override: ${historyItem?.overrideReason || 'Out of sequence manual override'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTooltipStep(step.id);
                            }}
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                          </div>
                        )}

                        {/* HOVER / TAP TOOLTIP (Timestamp, UserId, Remarks, Override Justification) */}
                        {(isHovered || (isCurrent && activeTooltipStep === null && false)) && (
                          <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-40 w-64 p-3 bg-slate-900 text-white rounded-xl shadow-2xl text-left animate-in fade-in zoom-in-95 duration-100 pointer-events-auto">
                            
                            {/* Tooltip Header */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1">
                                <span>{step.label}</span>
                                {isOverridden && <span className="text-rose-400">⚠️ OVERRIDE</span>}
                              </span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                                isPast 
                                  ? isLegacyWithoutHistory
                                    ? 'bg-slate-800 text-slate-400'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                                  : isCurrent 
                                    ? 'bg-indigo-900 text-indigo-200 border border-indigo-700' 
                                    : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isPast ? (isLegacyWithoutHistory ? 'Legacy' : 'Completed ✓') : isCurrent ? 'Active State' : 'Upcoming'}
                              </span>
                            </div>

                            {/* Tooltip Content Body */}
                            {hasStepHistory ? (
                              <div className="space-y-1.5 text-[11px] font-mono text-slate-300">
                                {/* Actor & Timestamp */}
                                <div className="text-slate-200 font-sans leading-tight">
                                  <strong>{step.label}</strong> by <strong className="text-white">{historyItem.userName || historyItem.userId}</strong>
                                  {historyItem.timestamp && (
                                    <span className="text-slate-400 block text-[10px] font-mono mt-0.5">
                                      on {formatTimestamp(historyItem.timestamp)}
                                    </span>
                                  )}
                                </div>

                                {/* Remarks */}
                                {historyItem.remarks && (
                                  <div className="text-[11px] text-slate-300 font-sans p-1.5 bg-slate-800/70 rounded border border-slate-700/60 italic leading-snug">
                                    "{historyItem.remarks}"
                                  </div>
                                )}

                                {/* Admin Override Alert inside Tooltip */}
                                {isOverridden && (
                                  <div className="p-1.5 bg-rose-950/80 border border-rose-800 rounded text-[10px] text-rose-200 font-sans">
                                    <span className="font-bold font-mono text-rose-400 block uppercase tracking-wider">
                                      ⚠️ Admin Force Override:
                                    </span>
                                    <span>"{historyItem.overrideReason || 'Data-entry adjustment'}"</span>
                                    <span className="block text-[9px] text-rose-300/80 font-mono mt-0.5">
                                      Actor: {historyItem.userName} ({historyItem.userRole})
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : isLegacyWithoutHistory ? (
                              <div className="text-[11px] font-mono text-slate-300">
                                <p className="text-amber-400 font-semibold flex items-center space-x-1">
                                  <Info className="h-3 w-3" />
                                  <span>No history available.</span>
                                </p>
                                <p className="text-slate-400 text-[10px] mt-0.5 font-sans leading-tight">
                                  Order created prior to state machine audit logging.
                                </p>
                              </div>
                            ) : isCurrent ? (
                              <div className="text-[11px] font-mono text-slate-300">
                                <p className="text-white font-semibold flex items-center space-x-1">
                                  <Sparkles className="h-3 w-3 text-indigo-400" />
                                  <span>Active Operational Stage</span>
                                </p>
                                <p className="text-slate-400 text-[10px] mt-0.5 font-sans leading-tight">
                                  {metricSubLabel || step.description}
                                </p>
                              </div>
                            ) : (
                              <div className="text-[10px] font-mono text-slate-400">
                                Pending completion of preceding stages.
                              </div>
                            )}

                            {/* Tooltip downward pointer arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                          </div>
                        )}
                      </div>

                      {/* Step Label & Sub-Label Metrics */}
                      <div className="mt-2 text-center max-w-[105px]">
                        <span 
                          className={`block text-[11px] font-mono leading-tight tracking-tight ${
                            isCurrent 
                              ? 'font-bold text-indigo-700' 
                              : isPast 
                                ? isLegacyWithoutHistory
                                  ? 'font-medium text-slate-500'
                                  : 'font-semibold text-slate-800' 
                                : 'font-medium text-slate-400'
                          }`}
                        >
                          {step.label}
                        </span>

                        {/* Sub-label with relevant metrics (e.g. In Production — 60/100 units complete) */}
                        {isCurrent && metricSubLabel && (
                          <div className="mt-1">
                            <span className="inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded leading-tight bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-3xs">
                              {metricSubLabel}
                            </span>

                            {/* Interactive Progress Meter Bar */}
                            {(step.id === 'in_production' || step.id === 'partially_dispatched') && (
                              <div className="w-16 h-1 bg-slate-200 rounded-full mt-1 mx-auto overflow-hidden">
                                <div 
                                  className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                                  style={{ width: `${step.id === 'in_production' ? productionPercentage : dispatchPercentage}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Completed state indicator check tag */}
                        {isPast && (
                          <div className="mt-1">
                            <span className={`inline-block text-[9px] font-mono px-1 py-0.2 rounded ${
                              isLegacyWithoutHistory
                                ? 'bg-slate-100 text-slate-500 italic'
                                : 'bg-emerald-50 text-emerald-700 font-bold'
                            }`}>
                              {isLegacyWithoutHistory ? 'No history' : '✓ Done'}
                            </span>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* EDGE CASE 2: "ON HOLD" CHIP INSERTED BETWEEN CURRENT AND NEXT STATE */}
                    {isOnHold && isCurrent && idx < progressionStates.length - 1 && (
                      <div className="self-center px-1.5 z-20 animate-in fade-in">
                        <div 
                          className="bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-lg px-2 py-1 shadow-sm flex items-center space-x-1.5 cursor-pointer hover:bg-amber-200 transition"
                          title={`Order is On Hold: ${order.holdReason || 'Operational Review'}`}
                        >
                          <PauseCircle className="h-3.5 w-3.5 text-amber-700 shrink-0 animate-pulse" />
                          <div className="text-[10px] font-mono leading-tight whitespace-nowrap">
                            <span className="font-bold uppercase tracking-wider block">ON HOLD</span>
                            <span className="text-[9px] text-amber-800 max-w-[90px] truncate block">
                              {order.holdReason || 'Review active'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                  </React.Fragment>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* ── EDGE CASE 3: MULTI-LINE ORDER WITH MIXED STATES (EXPANDABLE PANEL) ── */}
      {hasMultipleLineStates && showExpandableLineStates && showLineItemsDetail && items.length > 0 && (
        <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-900">
                Individual Component Lifecycle Stages
              </span>
              <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                Overall: Lowest Common Denominator ({STATE_DISPLAY_NAMES[currentState] || currentState.replace(/_/g, ' ')})
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
              Placing this order on hold inserts an 'On Hold' chip between the current and next stages of the progress stepper. Please provide a reason:
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
