// src/components/orders/OrderStatusHistoryModal.tsx

import React from 'react';
import { Order } from '../../types';
import { OrderStatusHistoryItem, ORDER_LIFECYCLE_STATES } from '../../types/orderStateMachine';
import { 
  X, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  User, 
  ShieldCheck, 
  Hash, 
  FileText,
  AlertTriangle
} from 'lucide-react';

interface OrderStatusHistoryModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderStatusHistoryModal: React.FC<OrderStatusHistoryModalProps> = ({
  order,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const history: OrderStatusHistoryItem[] = (order.statusHistory || []).slice().reverse();

  const getStateMeta = (stateId: string) => {
    return ORDER_LIFECYCLE_STATES.find(s => s.id === stateId) || {
      id: stateId,
      label: stateId.replace(/_/g, ' ').toUpperCase(),
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300'
    };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Immutable Audit Log
              </span>
              <span className="text-xs font-mono text-slate-500">
                Rev v{order.version || 1}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1 flex items-center space-x-2">
              <span>Order #{order.orderNumber}</span>
              <span className="text-slate-400 font-normal text-sm">— State Transition History</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Client: <span className="font-semibold text-slate-700">{order.customerName}</span> | Total transitions recorded: <span className="font-mono font-bold text-slate-800">{history.length}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Timeline Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-mono text-sm">
              <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p>No transition events recorded yet.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {history.map((item, index) => {
                const prevMeta = getStateMeta(item.previousState);
                const nextMeta = getStateMeta(item.newState);

                return (
                  <div key={item.id || index} className="relative group">
                    {/* Bullet marker */}
                    <div className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                      item.isOverride
                        ? 'bg-rose-600 text-white shadow-xs'
                        : item.newState === 'cancelled'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : item.newState === 'closed'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-indigo-600 text-white shadow-xs'
                    }`}>
                      {item.isOverride ? (
                        <ShieldAlert className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                    </div>

                    {/* Event Card */}
                    <div className={`p-4 rounded-xl border text-sm transition-shadow ${
                      item.isOverride 
                        ? 'bg-rose-50/40 border-rose-200 shadow-3xs' 
                        : 'bg-white border-slate-200 hover:shadow-2xs'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        {/* State Transition Badges */}
                        <div className="flex items-center space-x-2">
                          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${prevMeta.badgeClass}`}>
                            {prevMeta.label}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${nextMeta.badgeClass}`}>
                            {nextMeta.label}
                          </span>

                          {item.isOverride && (
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded shadow-xs flex items-center space-x-1">
                              <ShieldAlert className="h-3 w-3" />
                              <span>OVERRIDE</span>
                            </span>
                          )}
                        </div>

                        {/* Timestamp & Version */}
                        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                            v{item.version}
                          </span>
                          <span>
                            {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Actor Information */}
                      <div className="flex items-center space-x-3 text-xs text-slate-600 mb-2 font-mono">
                        <span className="flex items-center space-x-1">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800">{item.userName || 'System Lead'}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center space-x-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="uppercase text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                            {item.userRole}
                          </span>
                        </span>
                      </div>

                      {/* Remarks */}
                      {item.remarks && (
                        <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-150 leading-relaxed font-sans">
                          {item.remarks}
                        </p>
                      )}

                      {/* Override Reason Box */}
                      {item.isOverride && item.overrideReason && (
                        <div className="mt-2 p-2.5 bg-rose-100/70 border border-rose-300 rounded-lg text-xs text-rose-950 font-sans">
                          <div className="font-bold font-mono text-[11px] uppercase tracking-wider text-rose-800 mb-0.5 flex items-center space-x-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                            <span>Mandatory Override Justification (Admin Audit):</span>
                          </div>
                          <p>{item.overrideReason}</p>
                        </div>
                      )}

                      {/* Persistent Warning for Unmet Preconditions if flagged */}
                      {item.isOverride && item.unmetPreconditionWarning && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-xs font-mono text-amber-900 flex items-center space-x-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span><strong>Unmet Precondition Warning:</strong> {item.unmetPreconditionWarning}</span>
                        </div>
                      )}

                      {/* Metadata Details (e.g. Partial Dispatch resolution) */}
                      {item.metadata?.partialDispatchResolution && (
                        <div className="mt-2 text-xs font-mono bg-purple-50 text-purple-800 border border-purple-200 p-2 rounded-lg">
                          <span className="font-bold">Partial Dispatch Handling: </span>
                          <span>
                            {item.metadata.partialDispatchResolution === 'invoice_dispatched_and_cancel_balance'
                              ? 'Invoice dispatched goods separately; cancelled unproduced balance.'
                              : 'Mandatory Sales Return required for dispatched lot; cancelled order.'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-slate-500">
            Enforced by FlowOps State Engine • Cryptographically timestamped
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition shadow-3xs"
          >
            Close Audit Log
          </button>
        </div>

      </div>
    </div>
  );
};
