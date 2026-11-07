// src/components/orders/OrderDetailModal.tsx

import React, { useState } from 'react';
import { Order, UserRole, QuoteItem } from '../../types';
import { VisualOrderLifecycleBar } from './VisualOrderLifecycleBar';
import { MaterialAvailabilityBadge } from './MaterialAvailabilityBadge';
import { AtpAcknowledgementModal } from './AtpAcknowledgementModal';
import { OrderStatusHistoryModal } from './OrderStatusHistoryModal';
import { OrderStateTransitionModal } from './OrderStateTransitionModal';
import { OrderLifecycleState, normalizeOrderState } from '../../types/orderStateMachine';
import { AtpCheckResult, OrderAtpSummary } from '../../types/materialAvailability';
import { MaterialAvailabilityService } from '../../services/materialAvailabilityService';
import { OrderAtpSummaryPanel } from './OrderAtpSummaryPanel';
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
  Sparkles
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

  // Invalidation check (EC 3: User edits line qty after check)
  const isAtpStaleFromEdit = atpSummary 
    ? MaterialAvailabilityService.getOrderItemsFingerprint(order) !== atpSummary.cacheKey 
    : false;

  const handleRunAvailabilityCheck = async (forceRefresh = false) => {
    setIsRunningAtpCheck(true);
    setAtpProgress({ completed: 0, total: order.items?.length || 1 });
    try {
      const res = await MaterialAvailabilityService.evaluateOrderConsolidatedAtp(
        order,
        stockItems,
        [], // existing orders
        multiLevelBoms,
        {
          forceRefresh,
          syncTimestamp: lastSyncedTimestamp,
          onProgress: (completed, total) => {
            setAtpProgress({ completed, total });
          }
        }
      );
      setAtpSummary(res);
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
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {order.customerName}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Consolidated Check Availability Action Button */}
            <button
              onClick={() => handleRunAvailabilityCheck()}
              disabled={isRunningAtpCheck}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Run 1-Click Consolidated ATP Availability Check across all order lines"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
              <span>{isRunningAtpCheck ? 'Checking...' : 'Check Availability'}</span>
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
          
          {/* CONSOLIDATED ORDER-LEVEL ATP AVAILABILITY SUMMARY PANEL */}
          {(atpSummary || isRunningAtpCheck) && (
            <OrderAtpSummaryPanel
              summary={atpSummary}
              isRunningCheck={isRunningAtpCheck}
              progress={atpProgress}
              isStaleFromEdit={isAtpStaleFromEdit}
              onRerunCheck={() => handleRunAvailabilityCheck(true)}
              onClose={() => setAtpSummary(null)}
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
                // Advisory note
              }}
            />
          )}

          {/* VISUAL ORDER LIFECYCLE BAR */}
          <VisualOrderLifecycleBar
            order={order}
            canManageHold={canManageHold}
            onHoldToggle={handleHoldToggle}
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

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Package className="h-4 w-4 text-indigo-600" />
                <span>Components & Bill of Quantities ({order.items?.length || 0})</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                All prices in INR (₹)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100/70 text-[10px] font-mono uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Part Description</th>
                    <th className="p-3">Material Availability (ATP)</th>
                    <th className="p-3">HSN Code</th>
                    <th className="p-3 text-right">Ordered Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Line Status</th>
                    <th className="p-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(order.items || []).map((item, idx) => {
                    const lineState = normalizeOrderState(item.lineItemStatus || order.status);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-sans">
                          <span className="font-bold text-slate-900 block">{item.name}</span>
                          {item.specs && <span className="text-[10px] text-slate-500">{item.specs}</span>}
                        </td>
                        <td className="p-3">
                          <MaterialAvailabilityBadge
                            item={item}
                            stockItems={stockItems}
                            multiLevelBoms={multiLevelBoms}
                            lastSyncedTimestamp={lastSyncedTimestamp}
                            onOpenAcknowledgement={(atpRes) => setActiveAtpAckResult(atpRes)}
                          />
                        </td>
                        <td className="p-3 text-slate-500">{item.hsn || '8483'}</td>
                        <td className="p-3 text-right font-bold text-slate-800">
                          {item.quantity} {item.unit || 'pcs'}
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
    </div>
  );
};
