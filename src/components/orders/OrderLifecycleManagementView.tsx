// src/components/orders/OrderLifecycleManagementView.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Order, UserRole } from '../../types';
import { 
  OrderLifecycleState, 
  ORDER_LIFECYCLE_STATES, 
  normalizeOrderState 
} from '../../types/orderStateMachine';
import { OrderStateMachineService } from '../../services/orderStateMachineService';
import { OrderLifecycleStepper } from './OrderLifecycleStepper';
import { VisualOrderLifecycleBar } from './VisualOrderLifecycleBar';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderStateTransitionModal } from './OrderStateTransitionModal';
import { OrderStatusHistoryModal } from './OrderStatusHistoryModal';
import { 
  Layers, 
  Search, 
  Filter, 
  Clock, 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Zap,
  RefreshCw,
  Eye,
  Info,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { MaterialAvailabilityBadge } from './MaterialAvailabilityBadge';
import { AtpAcknowledgementModal } from './AtpAcknowledgementModal';
import { AtpCheckResult, OrderAtpSummary } from '../../types/materialAvailability';
import { MaterialAvailabilityService } from '../../services/materialAvailabilityService';
import { OrderAtpSummaryPanel } from './OrderAtpSummaryPanel';
import { useStockItems } from '../../hooks/useStockInventory';
import { useMultiLevelBom } from '../../hooks/useMultiLevelBom';

export const OrderLifecycleManagementView: React.FC = () => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Modal Triggers
  const [transitionOrder, setTransitionOrder] = useState<Order | null>(null);
  const [transitionTargetState, setTransitionTargetState] = useState<OrderLifecycleState>('in_production');
  const [isOverrideModal, setIsOverrideModal] = useState<boolean>(false);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [orderDetailForModal, setOrderDetailForModal] = useState<Order | null>(null);

  // Material Availability ATP Hooks
  const { items: stockItems, lastSyncedTimestamp } = useStockItems(tenant?.id || '');
  const { boms: multiLevelBoms } = useMultiLevelBom(tenant?.id || '');
  const [activeAtpAckResult, setActiveAtpAckResult] = useState<AtpCheckResult | null>(null);

  // Consolidated Order ATP Check State
  const [activeAtpSummary, setActiveAtpSummary] = useState<OrderAtpSummary | null>(null);
  const [isRunningAtpCheck, setIsRunningAtpCheck] = useState<boolean>(false);
  const [atpProgress, setAtpProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });

  // Test Simulation Mode for Concurrency & Blocked states
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  // Load orders
  const loadOrders = () => {
    if (!profile || !tenant) return;
    setLoading(true);

    if (isSandboxMode) {
      const cached = localStorage.getItem(`orders_${tenant.id}`) || '[]';
      let parsed: Order[] = JSON.parse(cached);

      // If empty or initial, seed with demo data covering various stages
      if (parsed.length === 0) {
        const demoOrders: Order[] = [
          {
            id: 'ord_state_001',
            tenantId: tenant.id,
            quoteId: 'quote_101',
            orderNumber: 'ORD-2026-001',
            customerName: 'Kirloskar Industrial Distributors',
            phone: '9880123456',
            customerPoNumber: 'PO-KIR-8821',
            items: [
              { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 100, unitPrice: 4200, gstPercent: 18, total: 420000 }
            ],
            totalAmount: 495600,
            deliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
            status: 'in_production',
            statusHistory: [
              {
                id: 'h_1',
                orderId: 'ord_state_001',
                orderNumber: 'ORD-2026-001',
                previousState: 'enquiry',
                newState: 'quoted',
                userId: 'usr_sales',
                userName: 'Ananya Sharma',
                userRole: 'sales',
                timestamp: new Date(Date.now() - 4 * 86400000).toISOString(),
                remarks: 'Technical and commercial proposal submitted to client.',
                version: 1
              },
              {
                id: 'h_2',
                orderId: 'ord_state_001',
                orderNumber: 'ORD-2026-001',
                previousState: 'quoted',
                newState: 'order_confirmed',
                userId: 'usr_sales',
                userName: 'Ananya Sharma',
                userRole: 'sales',
                timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
                remarks: 'Client PO-KIR-8821 attached and production slot reserved.',
                version: 2
              },
              {
                id: 'h_3',
                orderId: 'ord_state_001',
                orderNumber: 'ORD-2026-001',
                previousState: 'order_confirmed',
                newState: 'in_production',
                userId: 'usr_prod',
                userName: 'Rajesh Patel',
                userRole: 'production',
                timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
                remarks: 'CNC cutting and rough turning underway.',
                version: 3
              }
            ],
            version: 3,
            createdBy: profile.uid,
            createdAt: new Date(Date.now() - 4 * 86400000).toISOString()
          },
          {
            id: 'ord_state_002',
            tenantId: tenant.id,
            quoteId: 'quote_102',
            orderNumber: 'ORD-2026-002',
            customerName: 'Techno Welds India Pvt Ltd',
            phone: '9123456780',
            customerPoNumber: 'TW-IND-4091',
            items: [
              { id: 'p2', name: 'Stainless Steel Arc Welding Consumables', quantity: 500, unitPrice: 340, gstPercent: 18, total: 170000 }
            ],
            totalAmount: 200600,
            deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            status: 'partially_dispatched',
            version: 4,
            statusHistory: [
              {
                id: 'h_21',
                orderId: 'ord_state_002',
                orderNumber: 'ORD-2026-002',
                previousState: 'in_production',
                newState: 'partially_dispatched',
                userId: 'usr_dispatch',
                userName: 'Manoj Kumar',
                userRole: 'dispatch',
                timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
                remarks: 'Dispatched Lot 1 (250 Kg) via LR-88201. Balance 250 Kg remaining in packaging.',
                version: 4,
                metadata: { dispatchedQty: 250, remainingQty: 250 }
              }
            ],
            createdBy: profile.uid,
            createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
          },
          {
            id: 'ord_state_003',
            tenantId: tenant.id,
            quoteId: 'quote_103',
            orderNumber: 'ORD-2026-003',
            customerName: 'L&T Heavy Engineering Co.',
            phone: '9820098765',
            items: [
              { id: 'p3', name: 'High-Density Cast Iron Grate Valve (DN150)', quantity: 15, unitPrice: 12500, gstPercent: 18, total: 187500 }
            ],
            totalAmount: 221250,
            deliveryDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
            status: 'quoted',
            version: 1,
            statusHistory: [
              {
                id: 'h_31',
                orderId: 'ord_state_003',
                orderNumber: 'ORD-2026-003',
                previousState: 'enquiry',
                newState: 'quoted',
                userId: 'usr_sales',
                userName: 'Ananya Sharma',
                userRole: 'sales',
                timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
                remarks: 'Quote sent with 30 days commercial validity.',
                version: 1
              }
            ],
            createdBy: profile.uid,
            createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
          }
        ];
        localStorage.setItem(`orders_${tenant.id}`, JSON.stringify(demoOrders));
        parsed = demoOrders;
      }

      parsed = parsed.map(o => OrderStateMachineService.seedInitialStateHistoryIfEmpty(o, profile?.name));
      setOrders(parsed);
      if (parsed.length > 0 && !selectedOrderId) {
        setSelectedOrderId(parsed[0].id);
      }
      setLoading(false);
    } else {
      const q = query(collection(db, 'orders'), where('tenantId', '==', tenant.id));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach(d => {
          list.push(OrderStateMachineService.seedInitialStateHistoryIfEmpty(d.data() as Order, profile?.name));
        });
        setOrders(list);
        if (list.length > 0 && !selectedOrderId) {
          setSelectedOrderId(list[0].id);
        }
        setLoading(false);
      });
      return unsub;
    }
  };

  useEffect(() => {
    loadOrders();
  }, [profile, tenant, isSandboxMode]);

  // Selected Order
  const activeOrder = orders.find(o => o.id === selectedOrderId) || orders[0] || null;

  // Stale check for active order
  const isAtpStaleFromEdit = activeAtpSummary && activeOrder 
    ? MaterialAvailabilityService.getOrderItemsFingerprint(activeOrder) !== activeAtpSummary.cacheKey 
    : false;

  const handleRunAvailabilityCheck = async (forceRefresh = false) => {
    if (!activeOrder) return;
    setIsRunningAtpCheck(true);
    setAtpProgress({ completed: 0, total: activeOrder.items?.length || 1 });
    try {
      const summary = await MaterialAvailabilityService.evaluateOrderConsolidatedAtp(
        activeOrder,
        stockItems,
        [],
        multiLevelBoms,
        {
          forceRefresh,
          syncTimestamp: lastSyncedTimestamp,
          onProgress: (completed, total) => {
            setAtpProgress({ completed, total });
          }
        }
      );
      setActiveAtpSummary(summary);
    } catch (err) {
      console.error('Consolidated ATP check failed', err);
    } finally {
      setIsRunningAtpCheck(false);
    }
  };

  // Filtered list
  const filteredOrders = orders.filter(o => {
    const currentState = normalizeOrderState(o.status);
    const matchesFilter = stateFilter === 'all' || currentState === stateFilter;
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerPoNumber && o.customerPoNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // State Counts for summary chips
  const getStateCount = (stateId: string) => {
    if (stateId === 'all') return orders.length;
    return orders.filter(o => normalizeOrderState(o.status) === stateId).length;
  };

  // Quick Simulation Test: Simultaneous Concurrency Trigger (EC 3)
  const handleSimulateConcurrencyCollision = async () => {
    if (!activeOrder || !tenant || !profile) return;
    setSimulationNotice('Simulating simultaneous transition collision: altering order version in backend cache...');
    
    // Artificially change the version in storage to simulate a simultaneous transition by another user
    const localOrdersKey = `orders_${tenant.id}`;
    const cachedRaw = localStorage.getItem(localOrdersKey) || '[]';
    const parsed: Order[] = JSON.parse(cachedRaw);
    const idx = parsed.findIndex(o => o.id === activeOrder.id);
    if (idx !== -1) {
      parsed[idx] = {
        ...parsed[idx],
        version: (parsed[idx].version || 1) + 1, // Desync version
        status: 'order_confirmed'
      };
      localStorage.setItem(localOrdersKey, JSON.stringify(parsed));
    }

    // Now attempt a transition using the stale activeOrder (whose expectedVersion is old)
    try {
      await OrderStateMachineService.executeTransition(
        tenant.id,
        activeOrder.id,
        'in_production',
        {
          userId: profile.uid,
          userName: profile.name || 'Sales User',
          userRole: profile.role
        },
        {
          expectedVersion: activeOrder.version, // stale version
          isSandboxMode: true
        }
      );
    } catch (err: any) {
      setSimulationNotice(`✅ Concurrency collision blocked as specified! Message: "${err.message}"`);
      loadOrders();
    }
  };

  // Quick Simulation Test: Invalid Transition Attempt (e.g., Sales moving In Production to Fully Dispatched directly)
  const handleSimulateInvalidTransition = () => {
    if (!activeOrder) return;
    const val = OrderStateMachineService.validateTransition(
      activeOrder,
      'fully_dispatched',
      'sales', // Sales role attempting dispatch
      false
    );
    if (!val.valid) {
      setSimulationNotice(`🚫 Invalid Transition Blocked: ${val.error}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Philosophy */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded">
                Deterministic State Machine Engine
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded font-bold">
                Role-Enforced RBAC
              </span>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-bold">
                Optimistic Concurrency
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Order Lifecycle State Machine
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Enforces the strict order progression: <span className="text-white font-mono font-semibold">Enquiry → Quoted → Order Confirmed → In Production → Partially Dispatched → Fully Dispatched → Invoiced → Payment Received → Closed</span>. Bypasses are rejected; every step writes an immutable audit record.
            </p>
          </div>

          {/* Quick Simulation testing tools */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              onClick={handleSimulateInvalidTransition}
              className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Simulate Sales user attempting invalid skip to Fully Dispatched"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>Test Invalid Transition</span>
            </button>

            <button
              onClick={handleSimulateConcurrencyCollision}
              className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-400/40 text-indigo-200 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Simulate simultaneous collision (EC 3)"
            >
              <RotateCcw className="h-3.5 w-3.5 text-indigo-300" />
              <span>Test Concurrency Lock</span>
            </button>
          </div>
        </div>

        {/* Simulation Feedback Banner */}
        {simulationNotice && (
          <div className="mt-4 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-xs font-mono text-white flex items-center justify-between animate-in fade-in">
            <span>{simulationNotice}</span>
            <button
              onClick={() => setSimulationNotice(null)}
              className="text-slate-300 hover:text-white ml-2 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Layout: Orders List (Left) + Focused Order State Machine Workspace (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Filterable Orders Master */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order #, PO, or customer..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
              />
            </div>

            {/* State Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setStateFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer shrink-0 ${
                  stateFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({getStateCount('all')})
              </button>
              {ORDER_LIFECYCLE_STATES.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStateFilter(st.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer shrink-0 ${
                    stateFilter === st.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label} ({getStateCount(st.id)})
                </button>
              ))}
            </div>

            {/* Orders List */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-mono">
                  No orders match current filter.
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const state = normalizeOrderState(ord.status);
                  const isSelected = activeOrder?.id === ord.id;
                  const stateMeta = ORDER_LIFECYCLE_STATES.find(s => s.id === state);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-200/50 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">
                          {ord.orderNumber}
                        </span>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${stateMeta?.badgeClass}`}>
                          {stateMeta?.label || state}
                        </span>
                      </div>

                      <div className="text-slate-700 font-semibold mt-1 truncate">
                        {ord.customerName}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2 pt-2 border-t border-slate-100">
                        <span>Total: ₹{ord.totalAmount?.toLocaleString('en-IN') || 0}</span>
                        <span className="bg-slate-100 px-1.5 py-0.2 rounded text-[10px] text-slate-600 font-bold">
                          Rev v{ord.version || 1}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Active Order State Machine Control & Stepper */}
        <div className="lg:col-span-7 space-y-4">
          {activeOrder ? (
            <div className="space-y-4">
              
              {/* Order Overview Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block">
                      Active Manufacturing Order
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      Order #{activeOrder.orderNumber}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-800 block">
                      ₹{activeOrder.totalAmount?.toLocaleString('en-IN') || 0}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Target Delivery: {activeOrder.deliveryDate || 'Not specified'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Customer</span>
                    <span className="font-bold text-slate-800 truncate block">{activeOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Customer PO</span>
                    <span className="font-bold text-slate-800">{activeOrder.customerPoNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Quote Reference</span>
                    <span className="font-bold text-slate-800">{activeOrder.quoteNumber || activeOrder.quoteId || 'Direct PO'}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-150 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleRunAvailabilityCheck()}
                      disabled={isRunningAtpCheck}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
                      title="Run 1-Click Consolidated ATP Availability Check across all lines"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                      <span>{isRunningAtpCheck ? 'Checking...' : 'Check Availability'}</span>
                    </button>
                    {activeAtpSummary && (
                      <span className="text-[11px] font-mono text-slate-500">
                        {activeAtpSummary.availableLinesCount}/{activeAtpSummary.totalLines} Lines Available
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setOrderDetailForModal(activeOrder)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer transition shadow-3xs"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Open Order Detail Page</span>
                  </button>
                </div>
              </div>

              {/* Consolidated ATP Availability Summary Panel */}
              {(activeAtpSummary || isRunningAtpCheck) && (
                <OrderAtpSummaryPanel
                  summary={activeAtpSummary}
                  isRunningCheck={isRunningAtpCheck}
                  progress={atpProgress}
                  isStaleFromEdit={isAtpStaleFromEdit}
                  onRerunCheck={() => handleRunAvailabilityCheck(true)}
                  onClose={() => setActiveAtpSummary(null)}
                  onApplyEarliestDate={(earliestDateStr) => {
                    if (!activeOrder) return;
                    const updated: Order = {
                      ...activeOrder,
                      deliveryDate: earliestDateStr,
                      version: (activeOrder.version || 1) + 1,
                      updatedAt: new Date().toISOString()
                    };
                    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                    try {
                      const localKey = `orders_${tenant?.id}`;
                      const cached = localStorage.getItem(localKey);
                      if (cached) {
                        const list: Order[] = JSON.parse(cached);
                        const idx = list.findIndex(o => o.id === updated.id);
                        if (idx !== -1) {
                          list[idx] = updated;
                          localStorage.setItem(localKey, JSON.stringify(list));
                        }
                      }
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                  onAdviseSplitOrder={() => {
                    // Advisory note
                  }}
                />
              )}

              {/* Visual Order Lifecycle Bar (Stepper with Tooltips, Checkmarks, Metrics, On Hold, Line States) */}
              <VisualOrderLifecycleBar
                order={activeOrder}
                canManageHold={['admin', 'manager', 'management', 'production'].includes(profile?.role || 'viewer')}
                onHoldToggle={(putOnHold, reason) => {
                  const updated: Order = {
                    ...activeOrder,
                    isOnHold: putOnHold,
                    holdReason: putOnHold ? reason : undefined,
                    holdActor: putOnHold ? `${profile?.name || 'Supervisor'} (${profile?.role})` : undefined,
                    holdTimestamp: putOnHold ? new Date().toISOString() : undefined,
                    version: (activeOrder.version || 1) + 1,
                    updatedAt: new Date().toISOString()
                  };
                  setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                  try {
                    const localKey = `orders_${tenant?.id}`;
                    const cached = localStorage.getItem(localKey);
                    if (cached) {
                      const list: Order[] = JSON.parse(cached);
                      const idx = list.findIndex(o => o.id === updated.id);
                      if (idx !== -1) {
                        list[idx] = updated;
                        localStorage.setItem(localKey, JSON.stringify(list));
                      }
                    }
                  } catch (e) {
                    console.warn(e);
                  }
                }}
              />

              {/* Interactive State Machine Stepper Component */}
              <OrderLifecycleStepper
                order={activeOrder}
                userRole={profile?.role || 'viewer'}
                onInitiateTransition={(targetState, isOverride) => {
                  setTransitionOrder(activeOrder);
                  setTransitionTargetState(targetState);
                  setIsOverrideModal(!!isOverride);
                }}
                onViewHistory={() => {
                  setHistoryOrder(activeOrder);
                }}
              />

              {/* Items Summary Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                    Order Line Items ({activeOrder.items?.length || 0})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Live ATP Check & Component BOM Explosion
                  </span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {(activeOrder.items || []).map((item, idx) => (
                    <div key={item.id || idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800 block">{item.name}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          Qty: {item.quantity} units @ ₹{item.unitPrice?.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 self-end sm:self-auto">
                        <MaterialAvailabilityBadge
                          item={item}
                          stockItems={stockItems}
                          multiLevelBoms={multiLevelBoms}
                          lastSyncedTimestamp={lastSyncedTimestamp}
                          onOpenAcknowledgement={(atpRes) => setActiveAtpAckResult(atpRes)}
                        />
                        <div className="font-mono font-bold text-slate-800 text-right min-w-[70px]">
                          ₹{(item.total || item.quantity * (item.unitPrice || 0)).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-mono text-sm">
              <Layers className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>Select an order to inspect its state machine and transition controls.</p>
            </div>
          )}
        </div>

      </div>

      {/* Transition Modal */}
      {transitionOrder && (
        <OrderStateTransitionModal
          isOpen={!!transitionOrder}
          order={transitionOrder}
          targetState={transitionTargetState}
          isOverrideModal={isOverrideModal}
          userRole={profile?.role || 'viewer'}
          userName={profile?.name || 'Operations Lead'}
          userId={profile?.uid || 'user_lead'}
          userEmail={profile?.email}
          tenantId={tenant?.id || 'demo_tenant'}
          isSandboxMode={isSandboxMode}
          onClose={() => {
            setTransitionOrder(null);
            setIsOverrideModal(false);
          }}
          onSuccess={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            setSelectedOrderId(updated.id);
          }}
        />
      )}

      {/* Immutable History Timeline Modal */}
      {historyOrder && (
        <OrderStatusHistoryModal
          isOpen={!!historyOrder}
          order={historyOrder}
          onClose={() => setHistoryOrder(null)}
        />
      )}

      {/* Full Order Detail Workspace Modal */}
      {orderDetailForModal && (
        <OrderDetailModal
          isOpen={!!orderDetailForModal}
          order={orderDetailForModal}
          userRole={profile?.role || 'viewer'}
          userName={profile?.name || 'Operations Lead'}
          userId={profile?.uid || 'user_lead'}
          userEmail={profile?.email}
          tenantId={tenant?.id || 'demo_tenant'}
          isSandboxMode={isSandboxMode}
          onClose={() => setOrderDetailForModal(null)}
          onOrderUpdated={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            setOrderDetailForModal(updated);
          }}
        />
      )}

      {/* Advisory Material Availability Shortfall Acknowledgement Modal */}
      {activeAtpAckResult && (
        <AtpAcknowledgementModal
          isOpen={!!activeAtpAckResult}
          checkResult={activeAtpAckResult}
          userName={profile?.name || 'Sales User'}
          userRole={profile?.role || 'sales'}
          onClose={() => setActiveAtpAckResult(null)}
          onAcknowledge={(payload) => {
            if (!activeOrder) return;
            const updatedItems = (activeOrder.items || []).map(it => {
              if (it.name === payload.productName) {
                return {
                  ...it,
                  atpAcknowledgement: payload
                };
              }
              return it;
            });
            const updatedOrder: Order = {
              ...activeOrder,
              items: updatedItems,
              version: (activeOrder.version || 1) + 1,
              updatedAt: new Date().toISOString()
            };
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            try {
              const localKey = `orders_${tenant?.id}`;
              const cached = localStorage.getItem(localKey);
              if (cached) {
                const list: Order[] = JSON.parse(cached);
                const idx = list.findIndex(o => o.id === updatedOrder.id);
                if (idx !== -1) {
                  list[idx] = updatedOrder;
                  localStorage.setItem(localKey, JSON.stringify(list));
                }
              }
            } catch (e) {
              console.warn(e);
            }
            setActiveAtpAckResult(null);
          }}
        />
      )}

    </div>
  );
};
