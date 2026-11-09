// src/components/orders/KanbanOrderPipelineBoard.tsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Order, UserRole, StockItem, QuoteItem } from '../../types';
import { 
  OrderLifecycleState, 
  ORDER_LIFECYCLE_STATES, 
  STATE_DISPLAY_NAMES,
  ALLOWED_TRANSITIONS,
  ORDER_STATE_TRANSITIONS,
  normalizeOrderState, 
  OrderStatusHistoryItem,
  StaleStateError
} from '../../types/orderStateMachine';
import { OrderStateMachineService } from '../../services/orderStateMachineService';
import { MaterialAvailabilityService } from '../../services/materialAvailabilityService';
import { useStockItems } from '../../hooks/useStockInventory';
import { useMultiLevelBom } from '../../hooks/useMultiLevelBom';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderStateTransitionModal } from './OrderStateTransitionModal';
import { BomExplosionAtpModal } from './BomExplosionAtpModal';
import { 
  Kanban, 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  User, 
  Calendar, 
  Sliders, 
  Archive, 
  XCircle, 
  ChevronRight,
  ChevronDown,
  Info,
  Lock,
  Boxes,
  Move,
  Check,
  X,
  ExternalLink,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

// Default Configurable WIP Limits per Column
const DEFAULT_WIP_LIMITS: Record<OrderLifecycleState, number> = {
  enquiry: 15,
  quoted: 20,
  order_confirmed: 15,
  in_production: 20, // Prompt bottleneck example: 20 limit
  partially_dispatched: 10,
  fully_dispatched: 15,
  invoiced: 20,
  payment_received: 30,
  closed: 100,
  cancelled: 100
};

// Commercial Pipeline States (Enquiry -> Payment Received + Closed)
const COMMERCIAL_COLUMNS: OrderLifecycleState[] = [
  'enquiry',
  'quoted',
  'order_confirmed',
  'in_production',
  'partially_dispatched',
  'fully_dispatched',
  'invoiced',
  'payment_received',
  'closed'
];

interface OrderAtpInfo {
  hasShortfall: boolean;
  shortfallCount: number;
  summaryText: string;
  limitingItems: string[];
}

export const KanbanOrderPipelineBoard: React.FC = () => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const { toastError, toastSuccess, toastInfo } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(30);

  // Material Availability & BOM data for ATP calculation
  const tenantId = tenant?.id || 'demo_tenant';
  const { items: warehouseStock } = useStockItems(tenantId);
  const { boms: multiLevelBoms } = useMultiLevelBom(tenantId);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all'); // all, today, 7d, 30d, 90d
  const [showOnlyShortfalls, setShowOnlyShortfalls] = useState<boolean>(false);
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

  // Touch / Mobile Fallback: Tap-to-Place Mode & Quick Move Dropdowns
  const [tapToMoveOrder, setTapToMoveOrder] = useState<Order | null>(null);
  const [quickMoveMenuOrderId, setQuickMoveMenuOrderId] = useState<string | null>(null);

  // Modals
  const [activeDetailOrder, setActiveDetailOrder] = useState<Order | null>(null);
  const [transitionOrder, setTransitionOrder] = useState<Order | null>(null);
  const [transitionTargetState, setTransitionTargetState] = useState<OrderLifecycleState>('in_production');
  const [isOverrideModal, setIsOverrideModal] = useState(false);

  // BOM Explosion & ATP Calculator Modal State
  const [isAtpExplosionModalOpen, setIsAtpExplosionModalOpen] = useState(false);
  const [explosionModalProductId, setExplosionModalProductId] = useState<string>('gear_box');
  const [explosionModalQty, setExplosionModalQty] = useState<number>(50);
  const [explosionModalDate, setExplosionModalDate] = useState<string>('2026-11-20');

  // Virtualization / Pagination per column (EC: >500 orders)
  const [columnPageSizes, setColumnPageSizes] = useState<Record<string, number>>({});

  // Ref tracking previous order statuses to detect cancellations in real time (EC: An order is cancelled while the board is open)
  const prevStatusesRef = useRef<Map<string, string>>(new Map());

  // 1. Helper: Calculate Days in Current State
  const getDaysInCurrentState = (order: Order): number => {
    const currentState = normalizeOrderState(order.status);
    const history = order.statusHistory || [];
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

  // 2. Helper: Calculate ATP Shortfall for an Order
  const getOrderAtpInfo = useCallback((order: Order): OrderAtpInfo => {
    const items = order.items || [];
    let shortfallLinesCount = 0;
    const limitingDescriptions: string[] = [];

    for (const item of items) {
      // Direct explicit tag check
      if (item.materialAvailability === 'unavailable' || item.materialAvailability === 'partially_available') {
        shortfallLinesCount++;
        limitingDescriptions.push(`${item.name} (flagged shortfall)`);
        continue;
      }

      // Check using MaterialAvailabilityService against warehouse stock
      if (warehouseStock.length > 0 || multiLevelBoms.length > 0) {
        try {
          const atpRes = MaterialAvailabilityService.evaluateOrderLineAtp(
            item,
            warehouseStock,
            [],
            multiLevelBoms
          );
          if (atpRes.overallStatus !== 'available' || (atpRes.limitingComponent && atpRes.limitingComponent.shortfall > 0)) {
            shortfallLinesCount++;
            if (atpRes.limitingComponent) {
              limitingDescriptions.push(
                `${atpRes.limitingComponent.partName || atpRes.limitingComponent.partNumber}: shortfall ${atpRes.limitingComponent.shortfall} ${atpRes.limitingComponent.unit || 'pcs'}`
              );
            } else {
              limitingDescriptions.push(`${item.name}: material deficit`);
            }
          }
        } catch (e) {
          // Fallback if evaluation throws
        }
      }
    }

    const hasShortfall = shortfallLinesCount > 0;
    const summaryText = hasShortfall 
      ? `Material Shortfall detected on ${shortfallLinesCount} line item(s): ${limitingDescriptions.slice(0, 2).join('; ')}`
      : 'All raw materials & components available to promise.';

    return {
      hasShortfall,
      shortfallCount: shortfallLinesCount,
      summaryText,
      limitingItems: limitingDescriptions
    };
  }, [warehouseStock, multiLevelBoms]);

  // Memoized map of orderId -> OrderAtpInfo for quick lookup
  const atpInfoMap = useMemo(() => {
    const map = new Map<string, OrderAtpInfo>();
    orders.forEach(o => {
      map.set(o.id, getOrderAtpInfo(o));
    });
    return map;
  }, [orders, getOrderAtpInfo]);

  // 3. User Role and Permission Validation
  const userRole: UserRole = profile?.role || 'viewer';

  const canUserTransitionOrder = (order: Order): boolean => {
    if (['admin', 'manager', 'management'].includes(userRole)) return true;
    const allowed = OrderStateMachineService.getAllowedTransitions(order.status, userRole);
    return allowed.length > 0;
  };

  // Get allowed transitions for this order for current user
  const getOrderAllowedTargetStates = (order: Order): OrderLifecycleState[] => {
    const current = normalizeOrderState(order.status);
    const standardAllowed = ALLOWED_TRANSITIONS[current] || [];
    
    // Filter by user role unless admin
    if (userRole === 'admin') return standardAllowed;

    return standardAllowed.filter(targetState => {
      const rule = ORDER_STATE_TRANSITIONS.find(r => r.from === current && r.to === targetState);
      return rule ? rule.allowedRoles.includes(userRole) : false;
    });
  };

  // Contextual invalid drop error message per Acceptance Criteria
  const getInvalidDropMessage = (fromState: OrderLifecycleState, toState: OrderLifecycleState): string => {
    if (fromState === 'quoted' && toState === 'in_production') {
      return "Cannot move from 'Quoted' to 'In Production'. Confirm the order first.";
    }
    if (fromState === 'enquiry' && (toState === 'in_production' || toState === 'order_confirmed')) {
      return `Cannot move directly from 'Enquiry' to '${STATE_DISPLAY_NAMES[toState]}'. Submit and confirm a quotation first.`;
    }
    if (fromState === 'enquiry' && toState === 'fully_dispatched') {
      return "Cannot move from 'Enquiry' to 'Fully Dispatched'. Follow the defined lifecycle progression.";
    }
    if (fromState === 'in_production' && toState === 'invoiced') {
      return "Cannot move from 'In Production' to 'Invoiced'. Dispatch the order before generating an invoice.";
    }
    if (fromState === 'order_confirmed' && (toState === 'partially_dispatched' || toState === 'fully_dispatched')) {
      return `Cannot move from 'Order Confirmed' to '${STATE_DISPLAY_NAMES[toState]}'. Complete shopfloor production first.`;
    }
    if (fromState === 'partially_dispatched' && toState === 'in_production') {
      return "Reverse transition blocked: Cannot move from 'Partially Dispatched' back to 'In Production'.";
    }
    return `Cannot move from '${STATE_DISPLAY_NAMES[fromState]}' to '${STATE_DISPLAY_NAMES[toState]}'. This transition is blocked by the order state machine.`;
  };

  // 4. Load & Auto-Refresh Orders (every 30 seconds or via delta polling)
  const loadOrders = useCallback(() => {
    if (!tenant) return;
    setIsRefreshing(true);

    if (isSandboxMode) {
      const localKey = `orders_${tenant.id}`;
      const cached = localStorage.getItem(localKey) || '[]';
      let parsed: Order[] = JSON.parse(cached);

      // Seed if empty with rich multi-stage commercial pipeline dataset
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
            items: [{ id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 100, unitPrice: 4200, gstPercent: 18, total: 420000, materialAvailability: 'available' }],
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
                remarks: 'CNC blank shearing and hobbing active on Machine #4.',
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
            items: [{ id: 'p2', name: 'Stainless Steel Arc Welding Consumables', quantity: 500, unitPrice: 340, gstPercent: 18, total: 170000, materialAvailability: 'available' }],
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
            customerPoNumber: 'LT-HE-9921',
            items: [
              { 
                id: 'p3', 
                name: 'High-Density Cast Iron Grate Valve (DN150)', 
                quantity: 15, 
                unitPrice: 12500, 
                gstPercent: 18, 
                total: 187500,
                materialAvailability: 'unavailable' // Prompt Example: Casting shortfall: 15
              }
            ],
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
                remarks: 'Technical quotation shared with Vikram Mehta.',
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
            customerPoNumber: 'SAF-REQ-10',
            items: [{ id: 'p5', name: 'Industrial Pellet Press Die (4.0mm Hole)', quantity: 8, unitPrice: 24500, gstPercent: 18, total: 196000, materialAvailability: 'available' }],
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
            customerPoNumber: 'SFC-PO-901',
            items: [
              { 
                id: 'p4', 
                name: '10HP Submersible Pump Impeller (Bronze)', 
                quantity: 40, 
                unitPrice: 8900, 
                gstPercent: 18, 
                total: 356000,
                materialAvailability: 'partially_available' // Ingot deficit
              }
            ],
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
                remarks: 'Client acknowledged delivery lead time; PO confirmed.',
                version: 2
              }
            ],
            createdBy: 'usr_sales_1'
          },
          {
            id: 'ord_kb_006',
            tenantId: tenant.id,
            quoteId: 'quote_106',
            orderNumber: 'ORD-2026-006',
            customerName: 'Thermax Energy Systems Ltd',
            phone: '9845012399',
            customerPoNumber: 'THX-PO-7721',
            items: [{ id: 'p6', name: 'Hydraulic Cylinder Assembly (120mm Bore)', quantity: 10, unitPrice: 32600, gstPercent: 18, total: 326000, materialAvailability: 'available' }],
            totalAmount: 384680,
            deliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
            status: 'fully_dispatched',
            assignedOwner: 'usr_disp_1',
            assignedOwnerName: 'Manoj Kumar',
            version: 5,
            createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
            statusHistory: [
              {
                id: 'h_6',
                orderId: 'ord_kb_006',
                orderNumber: 'ORD-2026-006',
                previousState: 'in_production',
                newState: 'fully_dispatched',
                userId: 'usr_disp_1',
                userName: 'Manoj Kumar',
                userRole: 'dispatch',
                timestamp: new Date(Date.now() - 0.5 * 86400000).toISOString(),
                remarks: '10/10 cylinders dispatched with VRL Logistics LR-4410.',
                version: 5
              }
            ],
            createdBy: 'usr_disp_1'
          },
          {
            id: 'ord_kb_007',
            tenantId: tenant.id,
            quoteId: 'quote_107',
            orderNumber: 'ORD-2026-007',
            customerName: 'Bharat Gears & Automotives',
            phone: '9822011223',
            customerPoNumber: 'BGA-AUTO-331',
            items: [{ id: 'p7', name: 'CNC Machined Transmission Case', quantity: 25, unitPrice: 21700, gstPercent: 18, total: 542500, materialAvailability: 'available' }],
            totalAmount: 640150,
            deliveryDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
            status: 'invoiced',
            assignedOwner: 'usr_sales_2',
            assignedOwnerName: 'Priya Verma',
            version: 6,
            createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
            statusHistory: [
              {
                id: 'h_7',
                orderId: 'ord_kb_007',
                orderNumber: 'ORD-2026-007',
                previousState: 'fully_dispatched',
                newState: 'invoiced',
                userId: 'usr_sales_2',
                userName: 'Priya Verma',
                userRole: 'sales',
                timestamp: new Date(Date.now() - 1.5 * 86400000).toISOString(),
                remarks: 'Tax Invoice INV-2026-099 raised and emailed.',
                version: 6
              }
            ],
            createdBy: 'usr_sales_2'
          },
          {
            id: 'ord_kb_008',
            tenantId: tenant.id,
            quoteId: 'quote_108',
            orderNumber: 'ORD-2026-008',
            customerName: 'Elecon Engineering Corp',
            phone: '9765432109',
            customerPoNumber: 'ELE-PO-881',
            items: [{ id: 'p8', name: 'Precision Planetary Gearbox (Ratio 15:1)', quantity: 4, unitPrice: 108500, gstPercent: 18, total: 434000, materialAvailability: 'available' }],
            totalAmount: 512120,
            deliveryDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
            status: 'payment_received',
            assignedOwner: 'usr_sales_2',
            assignedOwnerName: 'Priya Verma',
            version: 7,
            createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
            statusHistory: [
              {
                id: 'h_8',
                orderId: 'ord_kb_008',
                orderNumber: 'ORD-2026-008',
                previousState: 'invoiced',
                newState: 'payment_received',
                userId: 'usr_sales_2',
                userName: 'Priya Verma',
                userRole: 'sales',
                timestamp: new Date(Date.now() - 0.2 * 86400000).toISOString(),
                remarks: 'Full settlement ₹5,12,120 received via RTGS UTR#HDFC889012.',
                version: 7
              }
            ],
            createdBy: 'usr_sales_2'
          }
        ];
        localStorage.setItem(localKey, JSON.stringify(parsed));
      }

      parsed = parsed.map(o => OrderStateMachineService.seedInitialStateHistoryIfEmpty(o, profile?.name));

      // EC: An order is cancelled while the board is open
      parsed.forEach(o => {
        const prev = prevStatusesRef.current.get(o.id);
        const curr = normalizeOrderState(o.status);
        if (prev && prev !== 'cancelled' && curr === 'cancelled') {
          toastInfo(
            'Order Cancelled',
            `Order #${o.orderNumber} was cancelled by another user while the board was open.`
          );
        }
        prevStatusesRef.current.set(o.id, curr);
      });

      setOrders(parsed);
      setLoading(false);
      setLastRefreshed(new Date());
      setIsRefreshing(false);
      setRefreshCountdown(30);
    } else {
      const q = query(collection(db, 'orders'), where('tenantId', '==', tenant.id));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach(d => {
          list.push(OrderStateMachineService.seedInitialStateHistoryIfEmpty(d.data() as Order, profile?.name));
        });

        // Detect real-time cancellation
        list.forEach(o => {
          const prev = prevStatusesRef.current.get(o.id);
          const curr = normalizeOrderState(o.status);
          if (prev && prev !== 'cancelled' && curr === 'cancelled') {
            toastInfo(
              'Order Cancelled',
              `Order #${o.orderNumber} was cancelled by another user while the board was open.`
            );
          }
          prevStatusesRef.current.set(o.id, curr);
        });

        setOrders(list);
        setLoading(false);
        setLastRefreshed(new Date());
        setIsRefreshing(false);
        setRefreshCountdown(30);
      }, (err) => {
        console.error('Firestore snapshot subscription error:', err);
        setLoading(false);
        setIsRefreshing(false);
      });
      return unsub;
    }
  }, [tenant, isSandboxMode, profile?.name, toastInfo]);

  // Initial load
  useEffect(() => {
    const unsub = loadOrders();
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [loadOrders]);

  // Auto-refresh every 30 seconds per Acceptance Criteria
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders();
    }, 30000);

    const countdownInterval = setInterval(() => {
      setRefreshCountdown(prev => (prev > 1 ? prev - 1 : 30));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, [loadOrders]);

  // Save WIP Limits
  const handleSaveWipLimits = (newLimits: Record<OrderLifecycleState, number>) => {
    setWipLimits(newLimits);
    if (tenant?.id) {
      localStorage.setItem(`kanban_wip_limits_${tenant.id}`, JSON.stringify(newLimits));
    }
    toastSuccess('WIP Limits Saved', 'Work-In-Progress column capacities updated.');
    setEditingWipModal(false);
  };

  // 5. Filtered Orders Computation
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const currentState = normalizeOrderState(o.status);
      if (currentState === 'cancelled' && !showCancelledArchive) return false;

      // Text search: Order #, Customer, PO, Items
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        o.orderNumber.toLowerCase().includes(searchLower) ||
        o.customerName.toLowerCase().includes(searchLower) ||
        (o.customerPoNumber && o.customerPoNumber.toLowerCase().includes(searchLower)) ||
        o.items?.some(i => i.name.toLowerCase().includes(searchLower))
      );

      // Customer filter
      const matchesCustomer = selectedCustomer === 'all' || o.customerName === selectedCustomer;

      // Owner filter
      const matchesOwner = selectedOwner === 'all' || 
        o.assignedOwner === selectedOwner || 
        o.assignedOwnerName === selectedOwner ||
        (!o.assignedOwner && selectedOwner === 'unassigned');

      // Date Range filter
      let matchesDate = true;
      if (selectedDateRange !== 'all') {
        const orderDateStr = o.createdAt || o.updatedAt;
        if (orderDateStr) {
          const orderTime = new Date(orderDateStr).getTime();
          const now = Date.now();
          const dayMs = 86400000;
          if (selectedDateRange === 'today') {
            matchesDate = (now - orderTime) <= dayMs;
          } else if (selectedDateRange === '7d') {
            matchesDate = (now - orderTime) <= 7 * dayMs;
          } else if (selectedDateRange === '30d') {
            matchesDate = (now - orderTime) <= 30 * dayMs;
          } else if (selectedDateRange === '90d') {
            matchesDate = (now - orderTime) <= 90 * dayMs;
          }
        }
      }

      // "Show Only ATP Shortfalls" filter
      const atp = atpInfoMap.get(o.id);
      const matchesShortfall = !showOnlyShortfalls || (atp?.hasShortfall === true);

      return matchesSearch && matchesCustomer && matchesOwner && matchesDate && matchesShortfall;
    });
  }, [orders, searchTerm, selectedCustomer, selectedOwner, selectedDateRange, showOnlyShortfalls, showCancelledArchive, atpInfoMap]);

  // Unique Customers and Owners for dropdown filters
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.customerName) set.add(o.customerName);
    });
    return Array.from(set).sort();
  }, [orders]);

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

  // Total shortfalls count for filter badge
  const totalShortfallOrdersCount = useMemo(() => {
    return orders.filter(o => {
      const atp = atpInfoMap.get(o.id);
      return atp?.hasShortfall && o.status !== 'cancelled' && o.status !== 'closed';
    }).length;
  }, [orders, atpInfoMap]);

  // Group filtered orders by state
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

  // 6. Drag and Drop Actions
  const handleDragStart = (e: React.DragEvent, order: Order) => {
    // Permission check (EC: User without transition permission drags a card)
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
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverCol(null);
  };

  // Shared Transition Execution with Concurrency Conflict handling (EC 5)
  const executeOrderTransition = async (order: Order, targetState: OrderLifecycleState) => {
    const currentState = normalizeOrderState(order.status);
    if (currentState === targetState) return;

    // 1. Verify State Machine transition is valid
    const allowed = ALLOWED_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      toastError('Invalid State Transition', getInvalidDropMessage(currentState, targetState));
      return;
    }

    // 2. Role permission verification
    const rule = ORDER_STATE_TRANSITIONS.find(r => r.from === currentState && r.to === targetState);
    if (userRole !== 'admin' && (!rule || !rule.allowedRoles.includes(userRole))) {
      toastError(
        'Access Denied',
        `Your role (${userRole}) cannot move order to '${STATE_DISPLAY_NAMES[targetState]}'.`
      );
      return;
    }

    // Special cases that require resolution modal (e.g. cancelling from partially_dispatched)
    if (currentState === 'partially_dispatched' && targetState === 'cancelled') {
      setTransitionOrder(order);
      setTransitionTargetState('cancelled');
      setIsOverrideModal(false);
      return;
    }

    // Execute state transition
    try {
      const result = await OrderStateMachineService.executeTransition(
        tenantId,
        order.id,
        targetState,
        {
          userId: profile?.uid || 'user_demo',
          userName: profile?.name || 'Operations Lead',
          userRole: userRole,
          email: profile?.email
        },
        {
          expectedVersion: order.version || 1, // Concurrency guard
          remarks: `Commercial pipeline Kanban: moved to ${STATE_DISPLAY_NAMES[targetState]}`,
          isSandboxMode
        }
      );

      setOrders(prev => prev.map(o => o.id === result.order.id ? result.order : o));
      toastSuccess(
        'Order Moved',
        `Order #${order.orderNumber} successfully moved to ${STATE_DISPLAY_NAMES[targetState]}.`
      );
    } catch (err: any) {
      // EC: Two users drag the same card simultaneously
      if (err instanceof StaleStateError || err?.name === 'StaleStateError' || err?.message?.includes('Order status has changed')) {
        toastError(
          'Concurrency Conflict',
          'This order was just updated by another user. Board refreshed with latest data.'
        );
      } else {
        toastError('Transition Error', err.message || 'Failed to update order state.');
      }
      loadOrders(); // Re-sync latest state
    }
  };

  const handleDrop = async (e: React.DragEvent, targetCol: OrderLifecycleState) => {
    e.preventDefault();
    setDragOverCol(null);
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    setDraggedOrderId(null);

    if (!orderId) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    await executeOrderTransition(order, targetCol);
  };

  // Mobile / Touch Tap-to-Place execution (EC: Drag-and-drop on mobile/touch devices)
  const handleTapToPlaceDrop = async (targetCol: OrderLifecycleState) => {
    if (!tapToMoveOrder) return;
    const order = tapToMoveOrder;
    setTapToMoveOrder(null);
    await executeOrderTransition(order, targetCol);
  };

  return (
    <div className="space-y-4 font-sans select-none">
      
      {/* Top Filter & Controls Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Order #, Customer, PO, item..."
              className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters Group: Customer, Owner, Date Range, ATP Shortfalls */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Filter by Customer */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Cust:</span>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:ring-0 p-0 pr-3 cursor-pointer max-w-[130px] truncate"
              >
                <option value="all">All Customers</option>
                {uniqueCustomers.map(cust => (
                  <option key={cust} value={cust}>{cust}</option>
                ))}
              </select>
            </div>

            {/* Filter by Assigned Owner */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Owner:</span>
              <select
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:ring-0 p-0 pr-3 cursor-pointer max-w-[120px] truncate"
              >
                <option value="all">All Owners</option>
                {uniqueOwners.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
                <option value="unassigned">Unassigned</option>
              </select>
            </div>

            {/* Filter by Date Range */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:ring-0 p-0 pr-3 cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">This Quarter</option>
              </select>
            </div>

            {/* "Show Only ATP Shortfalls" Toggle Button */}
            <button
              onClick={() => setShowOnlyShortfalls(!showOnlyShortfalls)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer border ${
                showOnlyShortfalls
                  ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Filter to orders with material availability deficits"
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${showOnlyShortfalls ? 'text-rose-600' : 'text-amber-500'}`} />
              <span>ATP Shortfalls</span>
              {totalShortfallOrdersCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  showOnlyShortfalls ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {totalShortfallOrdersCount}
                </span>
              )}
            </button>

            {/* Toggle Cancelled Archive */}
            <button
              onClick={() => setShowCancelledArchive(!showCancelledArchive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer border ${
                showCancelledArchive
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle cancelled orders archive column"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Cancelled ({ordersByState.cancelled?.length || 0})</span>
            </button>
          </div>

          {/* Right Toolbar Actions: WIP Config, Auto-Refresh Status, Manual Refresh */}
          <div className="flex items-center space-x-2 shrink-0 justify-end">
            
            {/* Auto-Refresh Countdown Indicator */}
            <div className="hidden sm:flex items-center space-x-1.5 text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto-refresh: {refreshCountdown}s</span>
            </div>

            {/* BOM Explosion & ATP Calculator Trigger */}
            <button
              onClick={() => {
                setExplosionModalProductId('gear_box');
                setExplosionModalQty(50);
                setExplosionModalDate('2026-11-20');
                setIsAtpExplosionModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Launch Recursive BOM Explosion & ATP Availability Engine"
            >
              <Boxes className="h-3.5 w-3.5 text-indigo-600" />
              <span>ATP Engine</span>
            </button>

            {/* WIP Limits Modal Trigger */}
            <button
              onClick={() => setEditingWipModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Configure Work-In-Progress (WIP) column limits"
            >
              <Sliders className="h-3.5 w-3.5 text-slate-500" />
              <span>WIP Limits</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => loadOrders()}
              disabled={isRefreshing}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Refresh order pipeline now"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>

        </div>

        {/* Tap-to-Place Active Instruction Banner (EC: Mobile/Touch Drag Fallback) */}
        {tapToMoveOrder && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2">
              <Move className="h-4 w-4 text-indigo-600 animate-bounce" />
              <span>
                <strong>Tap-to-Place Active:</strong> Selected Order <strong>#{tapToMoveOrder.orderNumber}</strong> ({tapToMoveOrder.customerName}). Tap any highlighted valid column header below to complete the transition.
              </span>
            </div>
            <button
              onClick={() => setTapToMoveOrder(null)}
              className="px-2.5 py-1 bg-white border border-indigo-300 text-indigo-700 rounded-lg font-bold text-xs hover:bg-indigo-100 cursor-pointer"
            >
              Cancel Move
            </button>
          </div>
        )}

      </div>

      {/* HORIZONTAL KANBAN PIPELINE BOARD */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[1720px] flex items-start gap-3.5">
          {COMMERCIAL_COLUMNS.map((colId) => {
            const colDef = ORDER_LIFECYCLE_STATES.find(s => s.id === colId);
            const colLabel = colDef?.label || colId;
            const colOrders = ordersByState[colId] || [];
            const limit = wipLimits[colId] || 999;
            
            // WIP Warning calculation: Amber at 80%, Red at 100%+
            const isBreached = colOrders.length >= limit;
            const isNearLimit = !isBreached && colOrders.length >= Math.floor(limit * 0.8) && limit < 100;
            const isDragOver = dragOverCol === colId;

            // Touch / Tap-to-Place validation for this column
            const isTapValidTarget = tapToMoveOrder 
              ? getOrderAllowedTargetStates(tapToMoveOrder).includes(colId)
              : false;

            // Virtualization Pagination (EC: >500 orders)
            const displayLimit = columnPageSizes[colId] || 25;
            const visibleOrders = colOrders.slice(0, displayLimit);
            const hasMore = colOrders.length > displayLimit;

            return (
              <div
                key={colId}
                onDragOver={(e) => handleDragOver(e, colId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, colId)}
                onClick={() => {
                  if (tapToMoveOrder && isTapValidTarget) {
                    handleTapToPlaceDrop(colId);
                  }
                }}
                className={`w-72 shrink-0 rounded-2xl flex flex-col transition-all duration-200 border-2 ${
                  isBreached
                    ? 'bg-rose-50/50 border-rose-400 shadow-md ring-1 ring-rose-300'
                    : isNearLimit
                      ? 'bg-amber-50/40 border-amber-400 shadow-xs'
                      : isDragOver
                        ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-300 shadow-md'
                        : isTapValidTarget
                          ? 'border-dashed border-indigo-400 bg-indigo-50/30 cursor-pointer ring-2 ring-indigo-200'
                          : 'bg-slate-50/80 border-slate-200/90'
                }`}
                style={{ minHeight: '660px' }}
              >
                
                {/* Column Header */}
                <div className={`p-3.5 rounded-t-2xl border-b flex items-center justify-between ${
                  isBreached 
                    ? 'bg-rose-100/90 border-rose-300 text-rose-950 font-bold' 
                    : isNearLimit
                      ? 'bg-amber-100/90 border-amber-300 text-amber-950 font-bold'
                      : isTapValidTarget
                        ? 'bg-indigo-100/80 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-slate-100/80 border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider truncate">
                      {colLabel}
                    </span>
                    {isBreached && (
                      <span title="WIP Limit Breached (100%+) — Shopfloor Bottleneck!">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      </span>
                    )}
                    {isNearLimit && (
                      <span title="Approaching WIP Limit (80%+) — Monitor closely">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      </span>
                    )}
                  </div>

                  {/* Count & WIP Limit Badge (Amber at 80%, Red at 100%+) */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                      isBreached
                        ? 'bg-rose-600 text-white border-rose-700 font-extrabold shadow-xs animate-pulse'
                        : isNearLimit
                          ? 'bg-amber-500 text-white border-amber-600 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 font-bold'
                    }`}>
                      {colOrders.length}
                      <span className="text-[9px] font-normal opacity-80">/{limit}</span>
                    </span>
                  </div>
                </div>

                {/* Tap-to-Place Column Callout */}
                {tapToMoveOrder && isTapValidTarget && (
                  <div className="bg-indigo-600 text-white text-[10px] font-mono font-bold py-1 px-2 text-center uppercase tracking-widest cursor-pointer hover:bg-indigo-700">
                    &darr; Tap here to Place
                  </div>
                )}

                {/* Cards Container */}
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[640px] pr-1.5 scrollbar-thin">
                  {colOrders.length === 0 ? (
                    <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl text-slate-400 font-mono text-xs">
                      <span>No orders in {colLabel.toLowerCase()}</span>
                    </div>
                  ) : (
                    visibleOrders.map((order) => {
                      const daysInState = getDaysInCurrentState(order);
                      const isStale = daysInState >= 5 && colId !== 'closed';
                      const canDrag = canUserTransitionOrder(order);
                      const atp = atpInfoMap.get(order.id) || { hasShortfall: false, shortfallCount: 0, summaryText: '', limitingItems: [] };
                      const allowedTargets = getOrderAllowedTargetStates(order);
                      const isSelectedForMove = tapToMoveOrder?.id === order.id;

                      // Extract owner initials
                      const ownerName = order.assignedOwnerName || order.assignedOwner || 'Unassigned';
                      const ownerInitials = ownerName
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <div
                          key={order.id}
                          draggable={canDrag}
                          onDragStart={(e) => handleDragStart(e, order)}
                          onClick={() => {
                            if (!tapToMoveOrder) {
                              setActiveDetailOrder(order);
                            }
                          }}
                          className={`bg-white rounded-xl p-3.5 border transition-all relative group shadow-3xs ${
                            canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-indigo-300' : 'cursor-pointer hover:border-slate-300'
                          } ${
                            isStale ? 'border-l-4 border-l-rose-500' : 'border-slate-200'
                          } ${
                            isSelectedForMove ? 'ring-2 ring-indigo-500 bg-indigo-50/40' : ''
                          }`}
                        >
                          {/* Top Row: Order ID, Hold Tag, Lock indicator, Mobile Move Action */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono font-bold text-xs text-indigo-700 group-hover:underline">
                              #{order.orderNumber}
                            </span>
                            
                            <div className="flex items-center space-x-1.5">
                              {order.isOnHold && (
                                <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300 uppercase">
                                  HOLD
                                </span>
                              )}

                              {/* Non-draggable role lock icon with tooltip (EC: User without transition permission drags a card) */}
                              {!canDrag && (
                                <span 
                                  className="text-slate-300 hover:text-slate-500 cursor-help"
                                  title="You do not have permission to change this order's status."
                                >
                                  <Lock className="h-3 w-3" />
                                </span>
                              )}

                              {/* Mobile / Touch Fallback: Move Dropdown Trigger */}
                              {canDrag && allowedTargets.length > 0 && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuickMoveMenuOrderId(quickMoveMenuOrderId === order.id ? null : order.id);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                                    title="Move order to another stage..."
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Quick Move Dropdown Menu (EC: Drag-and-drop on mobile/touch devices) */}
                                  {quickMoveMenuOrderId === order.id && (
                                    <div 
                                      className="absolute right-0 top-6 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 w-48 space-y-1 text-left"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                                        Move order to:
                                      </div>
                                      {allowedTargets.map(target => (
                                        <button
                                          key={target}
                                          type="button"
                                          onClick={() => {
                                            setQuickMoveMenuOrderId(null);
                                            executeOrderTransition(order, target);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition flex items-center justify-between"
                                        >
                                          <span>{STATE_DISPLAY_NAMES[target]}</span>
                                          <ArrowRight className="h-3 w-3 text-slate-400" />
                                        </button>
                                      ))}
                                      <div className="border-t border-slate-100 pt-1 mt-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setQuickMoveMenuOrderId(null);
                                            setTapToMoveOrder(order);
                                          }}
                                          className="w-full text-left px-2 py-1 rounded text-[11px] font-mono text-indigo-600 hover:bg-indigo-50 transition flex items-center space-x-1"
                                        >
                                          <Move className="h-3 w-3" />
                                          <span>Tap-to-Place Mode</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Customer Name */}
                          <h4 className="text-xs font-bold text-slate-900 truncate mb-2" title={order.customerName}>
                            {order.customerName}
                          </h4>

                          {/* ATP Material Availability Shortfall Indicator (⚠️) with Tooltip */}
                          {atp.hasShortfall && (
                            <div 
                              className="mb-2 p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-center justify-between group/atp relative cursor-help"
                              title={atp.summaryText}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDetailOrder(order);
                              }}
                            >
                              <div className="flex items-center space-x-1.5 truncate">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                <span className="font-mono font-bold text-[10px] truncate">
                                  ⚠️ ATP Shortfall ({atp.shortfallCount} lines)
                                </span>
                              </div>
                              <span className="text-[9px] text-rose-600 underline font-mono shrink-0">
                                View
                              </span>

                              {/* Hover Popover Tooltip for Shortfall Breakdown */}
                              <div className="hidden group-hover/atp:block absolute left-0 bottom-full mb-1 z-30 bg-slate-900 text-white text-[10px] p-2.5 rounded-xl shadow-xl w-64 text-left pointer-events-none">
                                <div className="font-bold font-mono text-rose-300 uppercase tracking-wider mb-1 flex items-center space-x-1">
                                  <AlertTriangle className="h-3 w-3 text-rose-400" />
                                  <span>Material Deficit Breakdown:</span>
                                </div>
                                <ul className="space-y-1 font-mono text-[9px] text-slate-200 list-disc pl-3">
                                  {atp.limitingItems.slice(0, 3).map((item, idx) => (
                                    <li key={idx} className="truncate">{item}</li>
                                  ))}
                                </ul>
                                <div className="mt-1.5 pt-1 border-t border-slate-700 text-[9px] text-slate-400 italic">
                                  Click card to run consolidated ATP or record acknowledgement.
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Value & Days in Current State Metric */}
                          <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-100 text-slate-600">
                            <span className="font-bold text-slate-900">
                              ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                            </span>
                            
                            <span className={`text-[10px] font-bold flex items-center space-x-1 px-1.5 py-0.2 rounded ${
                              isStale ? 'bg-rose-50 text-rose-700 font-extrabold' : 'text-slate-500 bg-slate-50'
                            }`} title={`In ${colLabel} for ${daysInState} days`}>
                              <Clock className="h-3 w-3" />
                              <span>{daysInState}d in state</span>
                            </span>
                          </div>

                          {/* Assigned Owner Avatar & Name */}
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                            <div className="flex items-center space-x-1.5 truncate max-w-[190px]" title={`Assigned Owner: ${ownerName}`}>
                              <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-[9px] shrink-0">
                                {ownerInitials || <User className="h-3 w-3" />}
                              </div>
                              <span className="truncate text-slate-700 font-semibold">{ownerName}</span>
                            </div>

                            <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0">
                              v{order.version || 1}
                            </span>
                          </div>

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
                          [colId]: displayLimit + 25
                        }));
                      }}
                      className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-mono font-bold rounded-lg transition shadow-3xs cursor-pointer"
                    >
                      Load More (+{colOrders.length - displayLimit} remaining)
                    </button>
                  )}
                </div>

                {/* Column Footer: Total Value */}
                <div className="p-2.5 rounded-b-2xl bg-white/70 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono text-slate-600">
                  <span className="text-slate-400 uppercase">Total Value:</span>
                  <span className="font-bold text-slate-900">
                    ₹{colOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>

              </div>
            );
          })}

          {/* CANCELLED ARCHIVE COLUMN (Toggleable Column per Acceptance Criteria) */}
          {showCancelledArchive && (
            <div
              className="w-72 shrink-0 rounded-2xl flex flex-col transition-all duration-200 border-2 bg-rose-50/40 border-rose-200"
              style={{ minHeight: '660px' }}
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
                      <h4 className="text-xs font-bold text-slate-800 truncate mb-1">{order.customerName}</h4>
                      <p className="text-[10px] text-rose-700 italic truncate font-mono">
                        {order.cancellationReason || 'Order terminated'}
                      </p>
                      <div className="mt-2 pt-2 border-t border-rose-100 text-[10px] font-mono text-slate-500 flex justify-between">
                        <span>₹{(order.totalAmount || 0).toLocaleString('en-IN')}</span>
                        <span>{order.cancellationActor || 'Operator'}</span>
                      </div>
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
                <h3 className="text-base font-bold text-slate-900 font-sans flex items-center space-x-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  <span>Configure Work-In-Progress (WIP) Limits</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set maximum order thresholds to trigger visual bottleneck alerts (amber at 80%, red at 100%+).
                </p>
              </div>
              <button
                onClick={() => setEditingWipModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {COMMERCIAL_COLUMNS.map(colId => {
                const colDef = ORDER_LIFECYCLE_STATES.find(s => s.id === colId);
                return (
                  <div key={colId} className="p-2.5 bg-slate-50 border rounded-xl space-y-1">
                    <label className="text-[11px] font-mono font-bold text-slate-700 uppercase block truncate">
                      {colDef?.label || colId}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={wipLimits[colId] || 15}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setWipLimits(prev => ({ ...prev, [colId]: val }));
                      }}
                      className="w-full text-xs font-mono font-bold p-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                );
              })}
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
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveWipLimits(wipLimits)}
                  className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-3xs cursor-pointer"
                >
                  Save Limits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal (Clicking card opens order detail view) */}
      {activeDetailOrder && (
        <OrderDetailModal
          isOpen={!!activeDetailOrder}
          order={activeDetailOrder}
          userRole={userRole}
          userName={profile?.name || 'Operations Lead'}
          userId={profile?.uid || 'user_demo'}
          userEmail={profile?.email}
          tenantId={tenantId}
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
          tenantId={tenantId}
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

      {/* Recursive BOM Explosion & ATP Calculator Modal */}
      {isAtpExplosionModalOpen && (
        <BomExplosionAtpModal
          isOpen={isAtpExplosionModalOpen}
          onClose={() => setIsAtpExplosionModalOpen(false)}
          initialProductId={explosionModalProductId}
          initialQuantity={explosionModalQty}
          initialAsOfDate={explosionModalDate}
        />
      )}

    </div>
  );
};
