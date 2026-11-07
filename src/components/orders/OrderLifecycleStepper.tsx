// src/components/orders/OrderLifecycleStepper.tsx

import React from 'react';
import { Order, UserRole } from '../../types';
import { 
  ORDER_LIFECYCLE_STATES, 
  normalizeOrderState, 
  OrderLifecycleState,
  ORDER_STATE_TRANSITIONS
} from '../../types/orderStateMachine';
import { OrderStateMachineService } from '../../services/orderStateMachineService';
import { 
  Check, 
  Clock, 
  AlertCircle, 
  HelpCircle, 
  FileText, 
  CheckCircle, 
  Cpu, 
  Truck, 
  CheckCheck, 
  Receipt, 
  CreditCard, 
  Archive, 
  XCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface OrderLifecycleStepperProps {
  order: Order;
  userRole: UserRole;
  onInitiateTransition: (targetState: OrderLifecycleState, isOverride?: boolean) => void;
  onViewHistory: () => void;
  compact?: boolean;
}

export const OrderLifecycleStepper: React.FC<OrderLifecycleStepperProps> = ({
  order,
  userRole,
  onInitiateTransition,
  onViewHistory,
  compact = false
}) => {
  const currentState = normalizeOrderState(order.status);
  const isCancelled = currentState === 'cancelled';
  const isClosed = currentState === 'closed';

  // Allowed transitions based on current state and role
  const allowedTransitions = OrderStateMachineService.getAllowedTransitions(order.status, userRole);
  
  // Icon mapper
  const renderStateIcon = (stateId: OrderLifecycleState, isCurrent: boolean, isPast: boolean) => {
    const size = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
    switch (stateId) {
      case 'enquiry': return <HelpCircle className={size} />;
      case 'quoted': return <FileText className={size} />;
      case 'order_confirmed': return <CheckCircle className={size} />;
      case 'in_production': return <Cpu className={size} />;
      case 'partially_dispatched': return <Truck className={size} />;
      case 'fully_dispatched': return <CheckCheck className={size} />;
      case 'invoiced': return <Receipt className={size} />;
      case 'payment_received': return <CreditCard className={size} />;
      case 'closed': return <Archive className={size} />;
      case 'cancelled': return <XCircle className={size} />;
      default: return <Clock className={size} />;
    }
  };

  // Standard progressive flow (excluding cancelled for stepper line)
  const progressionStates = ORDER_LIFECYCLE_STATES.filter(s => s.id !== 'cancelled');
  const currentStepIndex = progressionStates.findIndex(s => s.id === currentState);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-4">
      {/* Top Header: Order ID, Status Badge, History Button, and Concurrency Version */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
            Order State Machine:
          </span>
          <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wide border ${
            isCancelled 
              ? 'bg-rose-50 text-rose-700 border-rose-300' 
              : isClosed 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
          }`}>
            {renderStateIcon(currentState, true, false)}
            <span>{currentState.replace('_', ' ')}</span>
          </span>

          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200" title="Concurrency lock version">
            Rev v{order.version || 1}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onViewHistory}
            className="text-xs font-mono text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 transition cursor-pointer flex items-center space-x-1 font-bold"
            title="Inspect full immutable transition audit trail"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Audit History ({order.statusHistory?.length || 1})</span>
          </button>

          {/* Admin Override Trigger (Edge Case 1) */}
          {(userRole === 'admin' || userRole === 'manager' || userRole === 'management') && (
            <button
              onClick={() => onInitiateTransition(currentState, true)}
              className="text-xs font-mono text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-2.5 py-1 rounded border border-amber-300 transition cursor-pointer flex items-center space-x-1 font-bold"
              title="Force an out-of-sequence transition with mandatory audit justification"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              <span>Admin Override</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Stepper Progression Bar */}
      {isCancelled ? (
        <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-rose-800">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold leading-tight">Order Cancelled & Halted</p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                This order was terminated. All normal transitions are locked.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono bg-rose-100 text-rose-800 font-bold px-2 py-1 rounded border border-rose-300 uppercase">
            Cancelled Status
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center min-w-[760px] justify-between relative px-2">
            {progressionStates.map((state, idx) => {
              const isPast = currentStepIndex > idx;
              const isCurrent = currentStepIndex === idx;
              const isUpcoming = currentStepIndex < idx;

              return (
                <div key={state.id} className="flex-1 relative flex flex-col items-center group">
                  {/* Connector Line */}
                  {idx > 0 && (
                    <div 
                      className={`absolute top-3.5 right-1/2 left-[-50%] h-0.5 transition-colors duration-300 -z-0 ${
                        isPast || isCurrent ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    />
                  )}

                  {/* Step Circle Node */}
                  <div
                    className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-bold transition-all duration-200 ${
                      isPast
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : isCurrent
                          ? 'bg-white border-2 border-indigo-600 text-indigo-700 ring-4 ring-indigo-100 shadow-sm'
                          : 'bg-slate-100 border border-slate-300 text-slate-400'
                    }`}
                    title={`${state.label}: ${state.description}`}
                  >
                    {isPast ? (
                      <Check className="h-3.5 w-3.5 stroke-3" />
                    ) : (
                      <span>{state.stepOrder}</span>
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="mt-1.5 text-center">
                    <span 
                      className={`block text-[11px] font-mono leading-tight tracking-tight ${
                        isCurrent 
                          ? 'font-bold text-indigo-700' 
                          : isPast 
                            ? 'font-semibold text-slate-800' 
                            : 'font-medium text-slate-400'
                      }`}
                    >
                      {state.label}
                    </span>
                    {isCurrent && (
                      <span className="inline-block mt-0.5 text-[9px] font-mono font-bold uppercase bg-indigo-100 text-indigo-800 px-1 rounded">
                        Active State
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Allowed Actions Toolbar (Enforced Transitions) */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
            <span className="font-bold text-slate-700">Permitted Next Actions:</span>
            <span>(Active Role: <span className="font-bold uppercase text-indigo-600">{userRole}</span>)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allowedTransitions.length > 0 ? (
              allowedTransitions.map((rule) => {
                const isCancellation = rule.to === 'cancelled';
                const isReversible = rule.isReversible;

                return (
                  <button
                    key={`${rule.from}_${rule.to}`}
                    onClick={() => onInitiateTransition(rule.to, false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer ${
                      isCancellation
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300'
                        : isReversible
                          ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                    title={rule.description}
                  >
                    <span>{rule.actionLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                );
              })
            ) : (
              <span className="text-xs text-slate-400 italic font-mono">
                {isClosed || isCancelled 
                  ? 'Terminal state reached. No further forward transitions.' 
                  : `No permitted transitions for role '${userRole.toUpperCase()}'. Contact department supervisor.`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
