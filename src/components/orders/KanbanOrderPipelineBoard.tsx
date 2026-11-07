// src/components/orders/KanbanOrderPipelineBoard.tsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Order, UserRole } from '../../types';
import { 
  OrderLifecycleState, 
  ORDER_LIFECYCLE_STATES, 
  normalizeOrderState, 
  OrderStatusHistoryItem,
  ORDER_STATE_TRANSITIONS
} from '../../types/orderStateMachine';
import { OrderStateMachineService } from '../../services/orderStateMachineService';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderStateTransitionModal } from './OrderStateTransitionModal';
import { 
  Kanban, 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ShieldAlert, 
  User, 
  Calendar, 
  Sliders, 
  Archive, 
  XCircle, 
  Layers, 
  ChevronRight,
  Info,
  Maximize2,
  Lock,
  Boxes,
  Plus
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

// Default Configurable WIP Limits per Column
const DEFAULT_WIP_LIMITS: Record<OrderLifecycleState, number> = {
  enquiry: 15,
  quoted: 20,
  order_confirmed: 15,
  in_production: 20, // Example from prompt: 20 limit
  partially_dispatched: 10,
  fully_dispatched: 15,
  invoiced: 20,
  payment_received: 30,
  closed: 100,
  cancelled: 100
};

export const KanbanOrderPipelineBoard: React.FC = () => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const { toastError, toastSuccess, toastInfo } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [showCancelledArchive, setShowCancelledArchive] = useState(false);

  // Configurable WIP Limits
  const [wipLimits, setWipLimits] = useState<Record<OrderLifecycleState, number>>(() => {
    try {
      const stored = localStorage.getItem(`kanban_wip_limits_${tenant?.id}`);
      return stored ? JSON.parse(stored) : DEFAULT_WIP_LIMITS;
    } catch {
      return DEFAULT_WIP_LIMITS;
    }
  });
  const [editingWipModal, setEditingWipModal] = useState(false);

  // Drag and Drop States
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<OrderLifecycleState | null>(null);

  // Modals
  const [activeDetailOrder, setActiveDetailOrder] = useState<Order | null>(null);
  const [transitionOrder, setTransitionOrder] = useState<Order | null>(null);
  const [transitionTargetState, setTransitionTargetState] = useState<OrderLifecycleState>('in_production');
  const [isOverrideModal, setIsOverrideModal] = useState(false);

  // Performance / Virtualization Pagination per column (EC: >500 orders)
  const [columnPageSizes, setColumnPageSizes] = useState<Record<string, number>>({});

  // 1. Load & Delta-Poll Orders
  const loadOrders = useCallback(() => {
    if (!tenant) return;
    setIsRefreshing(true);

    if (isSandboxMode) {
      const localKey = `orders_${tenant.id}`;
      const cached = localStorage.getItem(localKey) || '[]';
      let parsed: Order[] = JSON.parse(cached);

      // Seed if empty with realistic multi-state dataset
      if (parsed.length === 0) {
        parsed = [
          {
            id: 'ord_kb_001',
            tenantId: tenant.id,
            quoteId: 'quote_101',
            orderNumber: 'ORD-2026-001',
            customerName: 'Kirloskar Industrial Distributors',
            phone: '9880123456',
            customerPoNumber: 'PO-KIR-8821',
            items: [{ id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 100, unitPrice: 4200, gstPercent: 18, total: 420000 }],
            totalAmount: 495600,
            deliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
            status: 'in_production',
            assignedOwner: 'usr_prod_1',
            assignedOwnerName: 'Rajesh Patel',
            version: 3,
            createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
            statusHistory: [
              {
                id: 'h_1',
                orderId: 'ord_kb_001',
                orderNumber: 'ORD-2026-001',
                previousState: 'order_confirmed',
                newState: 'in_production',
                userId: 'usr_prod_1',
                userName: 'Rajesh Patel',
                userRole: 'production',
                timestamp: new Date(Date.now() - 2.5 * 86400000).toISOString(),
                remarks: 'CNC blank shearing started.',
                version: 3
              }
            ],
            createdBy: 'usr_prod_1'
          },
          {
            id: 'ord_kb_002',
            tenantId: tenant.id,
            quoteId: 'quote_102',
            orderNumber: 'ORD-2026-002',
            customerName: 'Techno Welds India Pvt Ltd',
            phone: '9123456780',
            customerPoNumber: 'TW-IND-4091',
            items: [{ id: 'p2', name: 'Stainless Steel Arc Welding Consumables', quantity: 500, unitPrice: 340, gstPercent: 18, total: 170000 }],
            totalAmount: 200600,
            deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            status: 'partially_dispatched',
            assignedOwner: 'usr_disp_1',
            assignedOwnerName: 'Manoj Kumar',
            version: 4,
            createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
            statusHistory: [
              {
                id: 'h_2',
                orderId: 'ord_kb_002',
                orderNumber: 'ORD-2026-002',
                previousState: 'in_production',
                newState: 'partially_dispatched',
                userId: 'usr_disp_1',
                userName: 'Manoj Kumar',
                userRole: 'dispatch',
                timestamp: new Date(Date.now() - 1.2 * 86400000).toISOString(),
                remarks: 'Shipped 250 units via SafeExpress LR-88201.',
                version: 4
              }
            ],
            createdBy: 'usr_disp_1'
          },
          {
            id: 'ord_kb_003',
            tenantId: tenant.id,
            quoteId: 'quote_103',
            orderNumber: 'ORD-2026-003',
            customerName: 'L&T Heavy Engineering Co.',
            phone: '9820098765',
            items: [{ id: 'p3', name: 'High-Density Cast Iron Grate Valve (DN150)', quantity: 15, unitPrice: 12500, gstPercent: 18, total: 187500 }],
            totalAmount: 221250,
            deliveryDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
            status: 'quoted',
            assignedOwner: 'usr_sales_1',
            assignedOwnerName: 'Ananya Sharma',
            version: 1,
            createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
            statusHistory: [
              {
                id: 'h_3',
                orderId: 'ord_kb_003',
                orderNumber: 'ORD-2026-003',
                previousState: 'enquiry',
                newState: 'quoted',
                userId: 'usr_sales_1',
                userName: 'Ananya Sharma',
                userRole: 'sales',
                timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
                remarks: 'Quotation sent to Vikram Mehta.',
                version: 1
              }
            ],
            createdBy: 'usr_sales_1'
          },
          {
            id: 'ord_kb_004',
            tenantId: tenant.id,
            quoteId: 'quote_104',
            orderNumber: 'ORD-2026-004',
            customerName: 'Supreme Animal Feeds',
            phone: '9440612345',
            items: [{ id: 'p5', name: 'Industrial Pellet Press Die (4.0mm Hole)', quantity: 8, unitPrice: 24500, gstPercent: 18, total: 196000 }],
            totalAmount: 231280,
            deliveryDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
            status: 'enquiry',
            assignedOwner: 'usr_sales_1',
            assignedOwnerName: 'Ananya Sharma',
            version: 1,
            createdAt: new Date(Date.now() - 0.5 * 86400000).toISOString(),
            createdBy: 'usr_sales_1'
          },
          {
            id: 'ord_kb_005',
            tenantId: tenant.id,
            quoteId: 'quote_105',
            orderNumber: 'ORD-2026-005',
            customerName: 'Southern Flow Control Valves',
            phone: '9003198765',
            items: [{ id: 'p4', name: '10HP Submersible Pump Impeller (Bronze)', quantity: 40, unitPrice: 8900, gstPercent: 18, total: 356000 }],
            totalAmount: 420080,
            deliveryDate: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
            status: 'order_confirmed',
            assignedOwner: 'usr_sales_1',
            assignedOwnerName: 'Ananya Sharma',
            version: 2,
            createdAt: new Date(Date.now() - 1.5 * 86400000).toISOString(),
            statusHistory: [
              {
                id: 'h_5',
                orderId: 'ord_kb_005',
                orderNumber: 'ORD-2026-005',
                previousState: 'quoted',
                newState: 'order_confirmed',
                userId: 'usr_sales_1',
                userName: 'Ananya Sharma',
                userRole: 'sales',
                timestamp: new Date(Date.now() - 1.5 * 86400000).toISOString(),
                remarks: 'PO SFC-901 confirmed.',
                version: 2
              }
            ],
            createdBy: 'usr_sales_1'
          }
        ];
        localStorage.setItem(localKey, JSON.stringify(parsed));
      }

      parsed = parsed.map(o => OrderStateMachineService.seedInitialStateHistoryIfEmpty(o, profile?.name));
      setOrders(parsed);
      setLoading(false);
      setLastRefreshed(new Date());
      setIsRefreshing(false);
    } else {
      const q = query(collection(db, 'orders'), where('tenantId', '==', tenant.id));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach(d => {
          list.push(OrderStateMachineService.seedInitialStateHistoryIfEmpty(d.data() as Order, profile?.name));
        });
        setOrders(list);
        setLoading(false);
        setLastRefreshed(new Date());
        setIsRefreshing(false);
      }, (err) => {
        console.error(err);
        setLoading(false);
        setIsRefreshing(false);
      });
      return unsub;
    }
  }, [tenant, isSandboxMode, profile?.name]);

  // Initial load
  useEffect(() => {
    const unsub = loadOrders();
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [loadOrders]);

  // Delta polling every 15 seconds to ensure multiple users see live updates without manual reloads
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadOrders();
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [loadOrders]);

  // Save WIP Limits
  const handleSaveWipLimits = (newLimits: Record<OrderLifecycleState, number>) => {
    setWipLimits(newLimits);
    if (tenant?.id) {
      localStorage.setItem(`kanban_wip_limits_${tenant.id}`, JSON.stringify(newLimits));
    }
    toastSuccess('WIP Limits Updated', 'Column thresholds configured successfully.');
    setEditingWipModal(false);
  };

  // 2. Helper: Calculate Days in Current State
  const getDaysInCurrentState = (order: Order): number => {
    const currentState = normalizeOrderState(order.status);
    const history = order.statusHistory || [];
    // Find the transition into this current state
    const entry = [...history].reverse().find(h => h.newState === currentState);
    const dateStr = entry?.timestamp || order.updatedAt || order.createdAt;
    if (!dateStr) return 0;
    try {
      const entryTime = new Date(dateStr).getTime();
      const now = Date.now();
      const diffDays = Math.max(0, Math.floor((now - entryTime) / (1000 * 60 * 60 * 24)));
      return diffDays;
    } catch {
      return 0;
    }
  };

  // 3. Columns List (All states: Enquiry -> Closed; Cancelled handled in separate toggle/archive)
  const columns: { id: OrderLifecycleState; label: string; stepOrder: number }[] = useMemo(() => {
    return ORDER_LIFECYCLE_STATES.filter(s => s.id !== 'cancelled');
  }, []);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const currentState = normalizeOrderState(o.status);
      if (currentState === 'cancelled' && !showCancelledArchive) return false;

      const matchesSearch = 
        o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.customerPoNumber && o.customerPoNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesOwner = selectedOwner === 'all' || 
        o.assignedOwner === selectedOwner || 
        o.assignedOwnerName === selectedOwner ||
        (!o.assignedOwner && selectedOwner === 'unassigned');

      return matchesSearch && matchesOwner;
    });
  }, [orders, searchTerm, selectedOwner, showCancelledArchive]);

  // Unique Owners list for filter
  const uniqueOwners = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(o => {
      if (o.assignedOwner && o.assignedOwnerName) {
        map.set(o.assignedOwner, o.assignedOwnerName);
      } else if (o.assignedOwnerName) {
        map.set(o.assignedOwnerName, o.assignedOwnerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  // Check if active user has permission to transition this order out of its current state
  const userRole: UserRole = profile?.role || 'viewer';
  const canUserTransitionOrder = (order: Order): boolean => {
    if (['admin', 'manager', 'management'].includes(userRole)) return true;
    const allowed = OrderStateMachineService.getAllowedTransitions(order.status, userRole);
    return allowed.length > 0;
  };

  // 4. Drag & Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, order: Order) => {
    // Check permission
    if (!canUserTransitionOrder(order)) {
      e.preventDefault();
      toastError(
        'Action Blocked', 
        "You do not have permission to change this order's status."
      );
      return;
    }

    setDraggedOrderId(order.id);
    e.dataTransfer.setData('text/plain', order.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: OrderLifecycleState) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Avoid clearing on child bubbles
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCol: OrderLifecycleState) => {
    e.preventDefault();
    setDragOverCol(null);
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    setDraggedOrderId(null);

    if (!orderId) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const currentState = normalizeOrderState(order.status);
    if (currentState === targetCol) {
      return; // Dropped in same column, no-op
    }

    // Validate Transition via State Machine
    const validation = OrderStateMachineService.validateTransition(
      order,
      targetCol,
      userRole,
      false // regular drag drop is not an admin override
    );

    if (!validation.valid) {
      // Snap back with toast message per Acceptance Criteria
      toastError(
        'Invalid State Transition',
        validation.error || `Transition from '${currentState.toUpperCase()}' to '${targetCol.toUpperCase()}' is blocked by the order state machine.`
      );
      return;
    }

    // Special cases that require user input (e.g., partial dispatch cancellation or special resolution)
    if (currentState === 'partially_dispatched' && targetCol === 'cancelled') {
      setTransitionOrder(order);
      setTransitionTargetState('cancelled');
      setIsOverrideModal(false);
      return;
    }

    // If valid, execute transition
    try {
      const result = await OrderStateMachineService.executeTransition(
        tenant?.id || 'demo_tenant',
        order.id,
        targetCol,
        {
          userId: profile?.uid || 'user_demo',
          userName: profile?.name || 'Operations Lead',
          userRole: userRole,
          email: profile?.email
        },
        {
          expectedVersion: order.version || 1,
          remarks: `Kanban pipeline drag-and-drop: moved to ${targetCol.replace('_', ' ').toUpperCase()}`,
          isSandboxMode
        }
      );

      setOrders(prev => prev.map(o => o.id === result.order.id ? result.order : o));
      toastSuccess(
        'Order Moved',
        `Order #${order.orderNumber} successfully moved to ${targetCol.replace('_', ' ').toUpperCase()}.`
      );
    } catch (err: any) {
      toastError(
        'Transition Error',
        err.message || 'Failed to update order state.'
      );
      loadOrders(); // Re-sync in case of concurrency mismatch
    }
  };

  // Group orders by state
  const ordersByState = useMemo(() => {
    const map: Record<OrderLifecycleState, Order[]> = {
      enquiry: [],
      quoted: [],
      order_confirmed: [],
      in_production: [],
      partially_dispatched: [],
      fully_dispatched: [],
      invoiced: [],
      payment_received: [],
      closed: [],
      cancelled: []
    };

    filteredOrders.forEach(o => {
      const state = normalizeOrderState(o.status);
      if (map[state]) {
        map[state].push(o);
      }
    });

    return map;
  }, [filteredOrders]);

  // Bottleneck Columns (WIP Limit Exceeded)
  const breachedColumns = useMemo(() => {
    const set = new Set<OrderLifecycleState>();
    columns.forEach(col => {
      const count = (ordersByState[col.id] || []).length;
      const limit = wipLimits[col.id] || 999;
      if (count > limit) {
        set.add(col.id);
      }
    });
    return set;
  }, [columns, ordersByState, wipLimits]);

  return (
    <div className="space-y-4 font-sans select-none">
      
      {/* Top Controls Toolbar: Search, Owner Filter, Auto-Refresh Indicator, WIP Config, Archive */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Left: Search & Filter by Owner */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search order #, customer, PO..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Owner:</span>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 pr-4 cursor-pointer"
            >
              <option value="all">All Owners</option>
              {uniqueOwners.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {/* Toggle Cancelled Archive (EC 1) */}
          <button
            onClick={() => setShowCancelledArchive(!showCancelledArchive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer border ${
              showCancelledArchive
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Toggle display of cancelled orders"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Cancelled ({ordersByState.cancelled?.length || 0})</span>
          </button>
        </div>

        {/* Right: Auto-Refresh Status, WIP Limits Config, Manual Sync */}
        <div className="flex items-center space-x-2 shrink-0 justify-end">
          <div className="hidden lg:flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 mr-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Delta-sync: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          <button
            onClick={() => setEditingWipModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
            title="Configure Work-In-Progress (WIP) column limits"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-500" />
            <span>WIP Limits</span>
          </button>

          <button
            onClick={() => loadOrders()}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Refresh order pipeline"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bottleneck Warning Alert if any WIP limit is breached */}
      {breachedColumns.size > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold font-mono uppercase tracking-wider">
                Work-In-Progress (WIP) Bottleneck Alert:
              </span>
              <span className="ml-1.5">
                Columns exceeding configured limits: <span className="font-bold underline">{Array.from(breachedColumns).map(c => c.replace('_', ' ').toUpperCase()).join(', ')}</span>. Action needed to relieve shopfloor backlog.
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded border border-amber-400 uppercase">
            Capacity Constrained
          </span>
        </div>
      )}

      {/* HORIZONTAL KANBAN PIPELINE BOARD */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[1380px] flex items-start gap-3.5">
          {columns.map((col) => {
            const colOrders = ordersByState[col.id] || [];
            const limit = wipLimits[col.id] || 999;
            const isBreached = colOrders.length > limit;
            const isNearLimit = !isBreached && colOrders.length >= Math.floor(limit * 0.8) && limit < 100;
            const isDragOver = dragOverCol === col.id;

            // Pagination / Virtualized chunking (EC: >500 orders)
            const displayLimit = columnPageSizes[col.id] || 25;
            const visibleOrders = colOrders.slice(0, displayLimit);
            const hasMore = colOrders.length > displayLimit;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`w-72 shrink-0 rounded-2xl flex flex-col transition-all duration-200 border-2 ${
                  isBreached
                    ? 'bg-amber-50/40 border-amber-300 shadow-sm'
                    : isNearLimit
                      ? 'bg-orange-50/20 border-orange-200'
                      : isDragOver
                        ? 'bg-indigo-50/60 border-indigo-400 ring-2 ring-indigo-200 shadow-md'
                        : 'bg-slate-50/80 border-slate-200/90'
                }`}
                style={{ minHeight: '620px' }}
              >
                
                {/* Column Header */}
                <div className={`p-3.5 rounded-t-2xl border-b flex items-center justify-between ${
                  isBreached 
                    ? 'bg-amber-100/70 border-amber-300 text-amber-950' 
                    : isNearLimit
                      ? 'bg-orange-100/50 border-orange-200 text-orange-950'
                      : 'bg-slate-100/70 border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider truncate">
                      {col.label}
                    </span>
                    {isBreached && (
                      <span title="WIP Limit Breached">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      </span>
                    )}
                  </div>

                  {/* Count & WIP Limit Badge */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                      isBreached
                        ? 'bg-amber-500 text-white border-amber-600 font-extrabold shadow-3xs animate-pulse'
                        : isNearLimit
                          ? 'bg-orange-200 text-orange-900 border-orange-300'
                          : 'bg-white text-slate-700 border-slate-200'
                    }`}>
                      {colOrders.length}
                      <span className="text-[9px] font-normal opacity-80">/{limit}</span>
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[640px] pr-1.5 scrollbar-thin">
                  {colOrders.length === 0 ? (
                    <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl text-slate-400 font-mono text-xs">
                      <span>No orders in {col.label.toLowerCase()}</span>
                    </div>
                  ) : (
                    visibleOrders.map((order) => {
                      const daysInState = getDaysInCurrentState(order);
                      const isStale = daysInState >= 5 && col.id !== 'closed';
                      const canDrag = canUserTransitionOrder(order);

                      return (
                        <div
                          key={order.id}
                          draggable={canDrag}
                          onDragStart={(e) => handleDragStart(e, order)}
                          onClick={() => setActiveDetailOrder(order)}
                          className={`bg-white rounded-xl p-3.5 border transition-all cursor-pointer relative group ${
                            canDrag ? 'hover:shadow-md hover:border-indigo-300' : 'cursor-pointer hover:border-slate-300'
                          } ${
                            isStale ? 'border-l-4 border-l-rose-500' : 'border-slate-200'
                          }`}
                        >
                          {/* Drag Handle & Order # */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono font-bold text-xs text-indigo-700 group-hover:underline">
                              #{order.orderNumber}
                            </span>
                            
                            <div className="flex items-center space-x-1">
                              {order.isOnHold && (
                                <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300 uppercase">
                                  HOLD
                                </span>
                              )}
                              {!canDrag && (
                                <span title="You do not have permission to change this order's status.">
                                  <Lock className="h-3 w-3 text-slate-300" />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Customer Name */}
                          <h4 className="text-xs font-bold text-slate-900 truncate mb-2" title={order.customerName}>
                            {order.customerName}
                          </h4>

                          {/* Value & Days in State Metric */}
                          <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-100 text-slate-600">
                            <span className="font-bold text-slate-900">
                              ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                            </span>
                            
                            <span className={`text-[10px] font-bold flex items-center space-x-1 px-1.5 py-0.2 rounded ${
                              isStale ? 'bg-rose-50 text-rose-700' : 'text-slate-400 bg-slate-50'
                            }`} title={`In this state for ${daysInState} days`}>
                              <Clock className="h-3 w-3" />
                              <span>{daysInState}d</span>
                            </span>
                          </div>

                          {/* Assigned Owner */}
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                            <span className="flex items-center space-x-1 truncate max-w-[170px]" title={`Owner: ${order.assignedOwnerName || order.assignedOwner || 'Unassigned'}`}>
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{order.assignedOwnerName || order.assignedOwner || 'Unassigned'}</span>
                            </span>

                            <span className="text-[9px] font-bold text-slate-400">
                              v{order.version || 1}
                            </span>
                          </div>

                          {/* Tooltip for non-draggable user (EC 2) */}
                          {!canDrag && (
                            <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded whitespace-nowrap shadow-lg pointer-events-none">
                              You do not have permission to change this order's status.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Load More Button for column virtualization (EC: >500 orders) */}
                  {hasMore && (
                    <button
                      onClick={() => {
                        setColumnPageSizes(prev => ({
                          ...prev,
                          [col.id]: displayLimit + 25
                        }));
                      }}
                      className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-mono font-bold rounded-lg transition"
                    >
                      Load More (+{colOrders.length - displayLimit} remaining)
                    </button>
                  )}
                </div>

                {/* Column Footer: Total Value */}
                <div className="p-2.5 rounded-b-2xl bg-white/60 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Col Value:</span>
                  <span className="font-bold text-slate-800">
                    ₹{colOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>

              </div>
            );
          })}

          {/* CANCELLED ARCHIVE COLUMN (Optional column toggle per EC 1) */}
          {showCancelledArchive && (
            <div
              className="w-72 shrink-0 rounded-2xl flex flex-col transition-all duration-200 border-2 bg-rose-50/40 border-rose-200"
              style={{ minHeight: '620px' }}
            >
              <div className="p-3.5 rounded-t-2xl border-b bg-rose-100/70 border-rose-200 text-rose-950 flex items-center justify-between font-mono">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span>Cancelled Archive</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-rose-800 border border-rose-200">
                  {(ordersByState.cancelled || []).length}
                </span>
              </div>

              <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[640px] pr-1.5">
                {(ordersByState.cancelled || []).length === 0 ? (
                  <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-rose-200 rounded-xl text-rose-400 font-mono text-xs">
                    <span>No cancelled orders</span>
                  </div>
                ) : (
                  (ordersByState.cancelled || []).map(order => (
                    <div
                      key={order.id}
                      onClick={() => setActiveDetailOrder(order)}
                      className="bg-white rounded-xl p-3.5 border border-rose-200 hover:shadow-md transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-xs text-rose-700">#{order.orderNumber}</span>
                        <span className="text-[9px] font-mono font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded uppercase">
                          Cancelled
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate mb-2">{order.customerName}</h4>
                      <p className="text-[10px] text-rose-700 italic truncate font-mono">
                        {order.cancellationReason || 'Cancelled order'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configurable WIP Limits Modal */}
      {editingWipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">
                  Configure Column WIP Limits
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set maximum order thresholds to trigger visual bottleneck alerts across manufacturing stations.
                </p>
              </div>
              <button
                onClick={() => setEditingWipModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {columns.map(col => (
                <div key={col.id} className="p-2.5 bg-slate-50 border rounded-xl space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-700 uppercase block truncate">
                    {col.label}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={wipLimits[col.id] || 15}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setWipLimits(prev => ({ ...prev, [col.id]: val }));
                    }}
                    className="w-full text-xs font-mono font-bold p-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <button
                onClick={() => handleSaveWipLimits(DEFAULT_WIP_LIMITS)}
                className="text-xs font-mono text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Reset to Defaults
              </button>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingWipModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveWipLimits(wipLimits)}
                  className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-3xs"
                >
                  Save Limits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal (Clicking card navigates to order detail page / workspace) */}
      {activeDetailOrder && (
        <OrderDetailModal
          isOpen={!!activeDetailOrder}
          order={activeDetailOrder}
          userRole={userRole}
          userName={profile?.name || 'Operations Lead'}
          userId={profile?.uid || 'user_demo'}
          userEmail={profile?.email}
          tenantId={tenant?.id || 'demo_tenant'}
          isSandboxMode={isSandboxMode}
          onClose={() => setActiveDetailOrder(null)}
          onOrderUpdated={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            setActiveDetailOrder(updated);
          }}
        />
      )}

      {/* State Transition Modal (for special resolutions like partial dispatch cancellation) */}
      {transitionOrder && (
        <OrderStateTransitionModal
          isOpen={!!transitionOrder}
          order={transitionOrder}
          targetState={transitionTargetState}
          isOverrideModal={isOverrideModal}
          userRole={userRole}
          userName={profile?.name || 'Operations Lead'}
          userId={profile?.uid || 'user_demo'}
          userEmail={profile?.email}
          tenantId={tenant?.id || 'demo_tenant'}
          isSandboxMode={isSandboxMode}
          onClose={() => {
            setTransitionOrder(null);
            setIsOverrideModal(false);
          }}
          onSuccess={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            setTransitionOrder(null);
            toastSuccess('Transition Executed', `Order #${updated.orderNumber} updated.`);
          }}
        />
      )}

    </div>
  );
};
