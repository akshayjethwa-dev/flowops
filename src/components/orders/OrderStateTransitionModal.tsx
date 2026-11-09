// src/components/orders/OrderStateTransitionModal.tsx

import React, { useState } from 'react';
import { Order, UserRole } from '../../types';
import { 
  OrderLifecycleState, 
  ORDER_LIFECYCLE_STATES, 
  normalizeOrderState 
} from '../../types/orderStateMachine';
import { OrderStateMachineService } from '../../services/orderStateMachineService';
import { 
  X, 
  ArrowRight, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Info,
  Clock,
  RotateCcw
} from 'lucide-react';

interface OrderStateTransitionModalProps {
  order: Order;
  targetState: OrderLifecycleState;
  isOverrideModal?: boolean;
  isOpen: boolean;
  userRole: UserRole;
  userName: string;
  userId: string;
  userEmail?: string;
  tenantId: string;
  isSandboxMode?: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
}

export const OrderStateTransitionModal: React.FC<OrderStateTransitionModalProps> = ({
  order,
  targetState: initialTargetState,
  isOverrideModal = false,
  isOpen,
  userRole,
  userName,
  userId,
  userEmail,
  tenantId,
  isSandboxMode = false,
  onClose,
  onSuccess
}) => {
  if (!isOpen) return null;

  const currentState = normalizeOrderState(order.status);
  
  // Local state for target state selection (especially useful during admin override)
  const [selectedTargetState, setSelectedTargetState] = useState<OrderLifecycleState>(
    isOverrideModal ? (initialTargetState === currentState ? 'in_production' : initialTargetState) : initialTargetState
  );
  
  const [remarks, setRemarks] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [partialDispatchResolution, setPartialDispatchResolution] = useState<
    'invoice_dispatched_and_cancel_balance' | 'return_dispatched_and_cancel' | ''
  >('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validate on the fly
  const validation = OrderStateMachineService.validateTransition(
    order,
    selectedTargetState,
    userRole,
    isOverrideModal,
    overrideReason,
    partialDispatchResolution as any
  );

  const matchedRule = isOverrideModal 
    ? undefined 
    : OrderStateMachineService.getTransitionRule(order.status, selectedTargetState);

  const isReversible = matchedRule?.isReversible;
  const isCancellingPartial = currentState === 'partially_dispatched' && selectedTargetState === 'cancelled';

  const handleExecute = async () => {
    setErrorMessage(null);

    // Frontend pre-check validation
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Transition failed validation.');
      return;
    }

    if (isOverrideModal && (!overrideReason || overrideReason.trim().length < 10)) {
      setErrorMessage('Override reason must be at least 10 characters.');
      return;
    }

    if (isCancellingPartial && !partialDispatchResolution) {
      setErrorMessage('Please select how the already-dispatched items must be reconciled.');
      return;
    }

    setLoading(true);

    try {
      const result = await OrderStateMachineService.executeTransition(
        tenantId,
        order.id,
        selectedTargetState,
        {
          userId,
          userName,
          userRole,
          email: userEmail
        },
        {
          remarks: remarks.trim(),
          isOverride: isOverrideModal,
          overrideReason: overrideReason.trim(),
          expectedVersion: order.version || 1, // EC 3 Optimistic concurrency
          partialDispatchResolution: partialDispatchResolution as any,
          isSandboxMode
        }
      );

      onSuccess(result.order);
      onClose();
    } catch (err: any) {
      // Handles optimistic concurrency error: "Order status has changed. Please refresh and try again."
      setErrorMessage(err.message || 'Failed to complete state transition.');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeClass = (state: string) => {
    const meta = ORDER_LIFECYCLE_STATES.find(s => s.id === state);
    return meta ? meta.badgeClass : 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isOverrideModal 
            ? 'bg-amber-50/70 border-amber-200' 
            : isCancellingPartial 
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-slate-50 border-slate-200'
        }`}>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                isOverrideModal 
                  ? 'bg-amber-600 text-white border-amber-600' 
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {isOverrideModal ? 'Admin State Machine Override' : 'Enforced State Transition'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                Order #{order.orderNumber}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {isOverrideModal 
                ? 'Force Order Lifecycle Correction' 
                : matchedRule?.actionLabel || `Transition to ${selectedTargetState.replace('_', ' ').toUpperCase()}`}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start space-x-2 animate-shake">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Transition Blocked</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Current -> Target Preview */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                Current Status
              </span>
              <span className={`inline-block text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${getBadgeClass(currentState)}`}>
                {currentState.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <ArrowRight className="h-5 w-5 text-indigo-600" />
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">v{order.version || 1} → v{(order.version || 1) + 1}</span>
            </div>

            <div className="text-right">
              <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                Target Status
              </span>
              {isOverrideModal ? (
                <select
                  value={selectedTargetState}
                  onChange={(e) => setSelectedTargetState(e.target.value as OrderLifecycleState)}
                  className="text-xs font-mono font-bold px-2 py-1 rounded border border-amber-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {ORDER_LIFECYCLE_STATES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label} ({st.id})
                    </option>
                  ))}
                </select>
              ) : (
                <span className={`inline-block text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${getBadgeClass(selectedTargetState)}`}>
                  {selectedTargetState.replace('_', ' ').toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Reversible Notice (e.g. Quoted -> Enquiry for quote revision) */}
          {isReversible && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start space-x-2">
              <RotateCcw className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Permitted Reversible Transition:</span>
                <p className="mt-0.5">
                  Reverting this quote back to Enquiry state unlocks RFQ cost sheets for pricing revision and specification renegotiation.
                </p>
              </div>
            </div>
          )}

          {/* Edge Case 2: Partial Dispatch Cancellation Handling */}
          {isCancellingPartial && (
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
              <div className="flex items-center space-x-2 text-purple-900">
                <AlertTriangle className="h-4 w-4 text-purple-700" />
                <span className="text-xs font-bold uppercase font-mono tracking-wider">
                  Partial Dispatch Discrepancy Prevention (EC 2)
                </span>
              </div>
              <p className="text-xs text-purple-800 leading-relaxed">
                This order has already been partially dispatched from the factory. To avoid orphaned partial dispatches, choose how the shipped goods will be settled:
              </p>

              <div className="space-y-2 pt-1 font-mono text-xs">
                <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-50/40">
                  <input
                    type="radio"
                    name="partial_dispatch_resolution"
                    value="invoice_dispatched_and_cancel_balance"
                    checked={partialDispatchResolution === 'invoice_dispatched_and_cancel_balance'}
                    onChange={() => setPartialDispatchResolution('invoice_dispatched_and_cancel_balance')}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Invoice Dispatched Goods & Cancel Remaining Balance</span>
                    <span className="text-[11px] text-slate-500">A tax invoice will be generated for already-dispatched items; the unfulfilled balance will be cancelled.</span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 p-2 bg-white rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-50/40">
                  <input
                    type="radio"
                    name="partial_dispatch_resolution"
                    value="return_dispatched_and_cancel"
                    checked={partialDispatchResolution === 'return_dispatched_and_cancel'}
                    onChange={() => setPartialDispatchResolution('return_dispatched_and_cancel')}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Require Sales Return (Goods Return) for Dispatched Items</span>
                    <span className="text-[11px] text-slate-500">Flags logistics desk to register an Inward Gate Pass / Sales Return note before closing accounts.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Edge Case 1: Admin Override Reason Field */}
          {isOverrideModal && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-bold text-amber-900 uppercase tracking-wider flex items-center space-x-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  <span>Mandatory Override Justification *</span>
                </label>
                <span className={`text-[10px] font-mono font-bold ${
                  overrideReason.trim().length >= 10 ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {overrideReason.trim().length}/10 chars minimum
                </span>
              </div>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why an out-of-sequence override is necessary (e.g. Incorrectly advanced by supervisor on 05 Nov, data-entry correction, etc.)..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-amber-50/20 text-slate-900 font-sans"
              />
              {overrideReason.length > 0 && overrideReason.trim().length < 10 && (
                <p className="text-[11px] text-amber-700 font-mono">
                  Needs at least {10 - overrideReason.trim().length} more characters.
                </p>
              )}
            </div>
          )}

          {/* Standard Remarks / Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              Transition Remarks / Operational Notes
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Customer PO #PO-9821 verified, dispatch lot 1 ready on bay 3..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Actor & Role Guard Info */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <div>
              Actor: <span className="font-bold text-slate-700">{userName}</span> (<span className="uppercase text-indigo-600">{userRole}</span>)
            </div>
            <div>
              State Engine v1.0
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-mono font-bold text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleExecute}
            disabled={loading}
            className={`px-5 py-2 rounded-lg text-xs font-mono font-bold text-white transition shadow-sm cursor-pointer flex items-center space-x-1.5 ${
              isOverrideModal
                ? 'bg-amber-600 hover:bg-amber-700'
                : selectedTargetState === 'cancelled'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <span>Validating & Transitioning...</span>
            ) : (
              <>
                <span>{isOverrideModal ? 'Confirm Admin Override' : 'Confirm Transition'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
