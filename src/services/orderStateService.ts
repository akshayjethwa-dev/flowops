import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  runTransaction 
} from 'firebase/firestore';
import { Order, UserRole, AppNotification, NotificationType } from '../types';
import { 
  OrderLifecycleState, 
  OrderStatusHistoryItem, 
  ORDER_STATE_TRANSITIONS, 
  ALLOWED_TRANSITIONS, 
  STATE_DISPLAY_NAMES,
  normalizeOrderState,
  InvalidTransitionError,
  UnauthorizedTransitionError,
  PreconditionFailedError,
  ValidationError,
  StaleStateError
} from '../types/orderStateMachine';
import { getBackordersForOrder } from './partialDispatchService';
import { logActivityEvent } from '../utils/activityLogger';
import { StockReservationService } from './stockReservationService';

// Re-export error classes for consumers
export {
  InvalidTransitionError,
  UnauthorizedTransitionError,
  PreconditionFailedError,
  ValidationError,
  StaleStateError
};

export interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  previousState: OrderLifecycleState;
  newState: OrderLifecycleState;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string;
  remarks?: string;
  order: Order;
  historyItem: OrderStatusHistoryItem;
}

export type OrderStatusChangedListener = (event: OrderStatusChangedEvent) => void;

// In-memory event registry
const statusChangeListeners: Set<OrderStatusChangedListener> = new Set();

/**
 * Subscribes a listener to the 'order.status.changed' event.
 * Returns an unsubscribe function.
 */
export function onOrderStatusChanged(listener: OrderStatusChangedListener): () => void {
  statusChangeListeners.add(listener);
  return () => {
    statusChangeListeners.delete(listener);
  };
}

/**
 * Emits the 'order.status.changed' event to both in-memory listeners and window DOM event.
 */
export function emitOrderStatusChanged(event: OrderStatusChangedEvent): void {
  statusChangeListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (err) {
      console.warn('[order.status.changed] listener error:', err);
    }
  });

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('order.status.changed', { detail: event }));
    } catch (e) {
      console.warn('Failed to dispatch order.status.changed custom event', e);
    }
  }
}

export interface TransitionOrderStateOptions {
  remarks?: string;
  expectedVersion?: number;
  expectedStatus?: OrderLifecycleState;
  tenantId?: string;
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
  isOverride?: boolean;
  overrideReason?: string;
  isSandboxMode?: boolean;
  metadata?: Record<string, any>;
  partialDispatchResolution?: 'invoice_dispatched_and_cancel_balance' | 'return_dispatched_and_cancel';
}

/**
 * Formats a user role for human-readable error messages (e.g. 'production' -> 'Production')
 */
function formatRoleLabel(role: string): string {
  const map: Record<string, string> = {
    production: 'Production',
    sales: 'Sales',
    dispatch: 'Dispatch',
    admin: 'Admin',
    manager: 'Manager',
    management: 'Management',
    quality: 'Quality',
    viewer: 'Viewer'
  };
  return map[role.toLowerCase()] || role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Formats action and primary contact role for unauthorized transition error
 */
function getTransitionActionAndContact(from: OrderLifecycleState, to: OrderLifecycleState): { action: string; contactRole: string } {
  if (from === 'quoted' && to === 'order_confirmed') {
    return { action: 'confirm orders', contactRole: 'Sales' };
  }
  if (from === 'enquiry' && to === 'quoted') {
    return { action: 'submit quotations', contactRole: 'Sales' };
  }
  if (from === 'quoted' && to === 'enquiry') {
    return { action: 'revise quotations', contactRole: 'Sales' };
  }
  if (from === 'order_confirmed' && to === 'in_production') {
    return { action: 'release orders to production', contactRole: 'Production' };
  }
  if (to === 'partially_dispatched' || to === 'fully_dispatched') {
    return { action: 'dispatch orders', contactRole: 'Dispatch' };
  }
  if (to === 'invoiced') {
    return { action: 'generate invoices', contactRole: 'Sales' };
  }
  if (to === 'payment_received') {
    return { action: 'record payments', contactRole: 'Sales' };
  }
  if (to === 'closed') {
    return { action: 'close orders', contactRole: 'Management' };
  }
  if (to === 'cancelled') {
    return { action: 'cancel orders', contactRole: 'Management' };
  }
  return { action: `move orders to '${STATE_DISPLAY_NAMES[to] || to}'`, contactRole: 'Sales' };
}

/**
 * Resolves user info (role, name, email) from options or environment
 */
function resolveUserInfo(userId: string, options?: TransitionOrderStateOptions): { userId: string; role: UserRole; name: string; email?: string } {
  if (options?.userRole && options?.userName) {
    return {
      userId,
      role: options.userRole,
      name: options.userName,
      email: options.userEmail
    };
  }

  // Check current Firebase Auth user
  if (auth.currentUser && auth.currentUser.uid === userId) {
    const rawRole = (auth.currentUser as any).role || localStorage.getItem('user_role') || 'sales';
    return {
      userId,
      role: rawRole as UserRole,
      name: auth.currentUser.displayName || options?.userName || 'User',
      email: auth.currentUser.email || undefined
    };
  }

  // Infer from user ID conventions or localStorage
  const lowerId = userId.toLowerCase();
  let inferredRole: UserRole = 'sales';
  if (lowerId.includes('prod')) inferredRole = 'production';
  else if (lowerId.includes('disp')) inferredRole = 'dispatch';
  else if (lowerId.includes('admin')) inferredRole = 'admin';
  else if (lowerId.includes('manag')) inferredRole = 'manager';

  const storedProfile = localStorage.getItem('user_profile');
  if (storedProfile) {
    try {
      const p = JSON.parse(storedProfile);
      if (p.uid === userId || p.id === userId) {
        return {
          userId,
          role: options?.userRole || p.role || inferredRole,
          name: options?.userName || p.name || p.displayName || 'User',
          email: options?.userEmail || p.email
        };
      }
    } catch {}
  }

  return {
    userId,
    role: options?.userRole || inferredRole,
    name: options?.userName || (inferredRole === 'production' ? 'Production User' : inferredRole === 'dispatch' ? 'Dispatch Clerk' : 'Sales User'),
    email: options?.userEmail
  };
}

/**
 * Resolves tenant ID from options, storage, or order
 */
function resolveTenantId(order?: Order, options?: TransitionOrderStateOptions): string {
  return options?.tenantId || order?.tenantId || localStorage.getItem('current_tenant_id') || 'demo_tenant';
}

/**
 * Detects whether an override transition moves an order to a state with unmet preconditions.
 * EC: Override moves order to a state with unmet preconditions (e.g., fully_dispatched with open backorders)
 * Result: Allowed, but returns persistent warning message: "This order was force-closed with 1 open backorder. Reconcile manually."
 */
export function detectUnmetPreconditions(
  order: Order,
  targetState: OrderLifecycleState,
  tenantId: string,
  options?: TransitionOrderStateOptions
): string | undefined {
  // Precondition check: fully_dispatched requires all lines/backorders to be 0
  if (targetState === 'fully_dispatched') {
    let openBackordersCount = 0;
    let totalRemainingUnits = 0;

    try {
      const linkedBackorders = getBackordersForOrder(tenantId, order.id);
      const openBos = linkedBackorders.filter(b => b.status !== 'fulfilled' && b.status !== 'cancelled');
      openBackordersCount = openBos.length;
      totalRemainingUnits = openBos.reduce(
        (acc, b: any) =>
          acc +
          (b.remainingQty ||
            b.backorderQty ||
            b.totalRemainingQty ||
            b.items?.reduce((s: number, it: any) => s + (it.quantity || 0), 0) ||
            0),
        0
      );
    } catch (e) {}

    if (totalRemainingUnits === 0 && order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.remainingQty !== undefined && item.remainingQty > 0) {
          totalRemainingUnits += item.remainingQty;
          openBackordersCount = Math.max(openBackordersCount, 1);
        }
      }
    }

    if (totalRemainingUnits > 0 || openBackordersCount > 0) {
      const count = openBackordersCount || 1;
      return `This order was force-closed with ${count} open backorder${count === 1 ? '' : 's'}. Reconcile manually.`;
    }
  }

  // Precondition check: order_confirmed with unavailable lines without ATP acknowledgement
  if (targetState === 'order_confirmed') {
    const unacknowledged = (order.items || []).filter(
      itm => itm.materialAvailability === 'unavailable' && !itm.atpAcknowledgement
    );
    if (unacknowledged.length > 0) {
      return `This order was force-confirmed with ${unacknowledged.length} unavailable line(s) lacking ATP material stock. Reconcile manually.`;
    }
  }

  // Precondition check: partially_dispatched -> cancelled without resolution
  const currentState = normalizeOrderState(order.status);
  if (currentState === 'partially_dispatched' && targetState === 'cancelled' && !options?.partialDispatchResolution) {
    return 'This order was force-cancelled with dispatched goods remaining unassigned. Reconcile manually.';
  }

  return undefined;
}

/**
 * Triggers a notification to all management role users whenever an Admin Override is executed.
 */
export async function notifyManagementOfOverride(
  tenantId: string,
  order: Order,
  previousState: OrderLifecycleState,
  targetState: OrderLifecycleState,
  actor: { name: string; role: string; userId: string },
  overrideReason: string,
  isSandbox: boolean,
  unmetPreconditionWarning?: string
): Promise<void> {
  const notifId = `notif-override-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const title = `⚠️ Admin Override: Order #${order.orderNumber}`;
  const message = `Admin ${actor.name} forced status from '${STATE_DISPLAY_NAMES[previousState]}' to '${STATE_DISPLAY_NAMES[targetState]}'. Reason: "${overrideReason}"${
    unmetPreconditionWarning ? ` • Warning: ${unmetPreconditionWarning}` : ''
  }`;

  const notification: AppNotification = {
    id: notifId,
    tenantId,
    userId: 'all', // Broadcast to all management users
    type: 'order_override' as NotificationType,
    title,
    message,
    entityId: order.id,
    entityType: 'order',
    link: `/orders`,
    read: false,
    createdAt: new Date().toISOString()
  };

  // 1. Commit to LocalStorage
  try {
    const key = `flowops_notifications_${tenantId}`;
    const cached = localStorage.getItem(key);
    const list: AppNotification[] = cached ? JSON.parse(cached) : [];
    localStorage.setItem(key, JSON.stringify([notification, ...list]));
  } catch (e) {
    console.warn('Failed to cache override notification in localStorage', e);
  }

  // 2. Commit to Firestore
  if (db && !isSandbox) {
    try {
      const { addDoc, collection: fsCol } = await import('firebase/firestore');
      await addDoc(fsCol(db, 'notifications'), notification);
    } catch (e) {
      console.warn('Failed to write override notification to Firestore', e);
    }
  }

  // 3. Dispatch DOM event for instant notification / UI alerts
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('management.notification', { detail: notification }));
      window.dispatchEvent(new CustomEvent('order.override.executed', { detail: { order, notification } }));
    } catch (e) {}
  }
}

/**
 * Validates state transition rules and preconditions.
 * Throws typed errors: InvalidTransitionError, UnauthorizedTransitionError, PreconditionFailedError, ValidationError.
 */
export function validateStateTransition(
  order: Order,
  targetState: OrderLifecycleState,
  userId: string,
  userRole: UserRole,
  options?: TransitionOrderStateOptions
): void {
  const currentState = normalizeOrderState(order.status);
  const isOverride = !!options?.isOverride;

  // 1. Transition to the same state
  if (currentState === targetState) {
    throw new InvalidTransitionError(`Order is already in '${STATE_DISPLAY_NAMES[currentState]}'.`);
  }

  // 2. Override path checks
  if (isOverride) {
    // EC: Non-admin passes isOverride: true -> Rejected with UnauthorizedTransitionError: "Only admins can override order state."
    if (userRole !== 'admin') {
      throw new UnauthorizedTransitionError('Only admins can override order state.');
    }
    // EC: overrideReason is empty or <10 chars -> Rejected with ValidationError: "Override reason must be at least 10 characters."
    if (!options?.overrideReason || options.overrideReason.trim().length < 10) {
      throw new ValidationError('Override reason must be at least 10 characters.');
    }
    return; // Overrides bypass normal transitions, role checks, and preconditions
  }

  // 3. Valid transition check against ALLOWED_TRANSITIONS map
  const allowedTargets = ALLOWED_TRANSITIONS[currentState] || [];
  if (!allowedTargets.includes(targetState)) {
    throw new InvalidTransitionError(
      `Cannot move order from '${STATE_DISPLAY_NAMES[currentState]}' to '${STATE_DISPLAY_NAMES[targetState]}'.`
    );
  }

  // 4. Role permission check against rule definition
  const rule = ORDER_STATE_TRANSITIONS.find(r => r.from === currentState && r.to === targetState);
  if (!rule || !rule.allowedRoles.includes(userRole)) {
    const { action, contactRole } = getTransitionActionAndContact(currentState, targetState);
    throw new UnauthorizedTransitionError(
      `Your role (${formatRoleLabel(userRole)}) cannot ${action}. Contact ${contactRole}.`
    );
  }

  // 5. State-specific Precondition Guards
  // Precondition A: fully_dispatched requires all lines have remainingQty = 0 (or no open backorders)
  if (targetState === 'fully_dispatched') {
    const tenantId = resolveTenantId(order, options);
    
    // Check backorders linked to this order
    let openBackordersCount = 0;
    let totalRemainingUnits = 0;

    try {
      const linkedBackorders = getBackordersForOrder(tenantId, order.id);
      const openBos = linkedBackorders.filter(b => b.status !== 'fulfilled' && b.status !== 'cancelled');
      openBackordersCount = openBos.length;
      totalRemainingUnits = openBos.reduce((acc, b: any) => acc + (b.remainingQty || b.backorderQty || b.totalRemainingQty || (b.items?.reduce((s: number, it: any) => s + (it.quantity || 0), 0)) || 0), 0);
    } catch (e) {
      // Fallback to checking line items remainingQty
    }

    // Also check order line items if remainingQty explicitly tracked
    if (totalRemainingUnits === 0 && order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.remainingQty !== undefined && item.remainingQty > 0) {
          totalRemainingUnits += item.remainingQty;
          openBackordersCount = Math.max(openBackordersCount, 1);
        }
      }
    }

    if (totalRemainingUnits > 0 || openBackordersCount > 0) {
      const count = openBackordersCount || 1;
      throw new PreconditionFailedError(
        `Cannot mark fully dispatched: ${totalRemainingUnits} units remaining across ${count} backorder${count === 1 ? '' : 's'}.`
      );
    }
  }

  // Precondition B: order_confirmed requires ATP acknowledgement if unavailable
  if (targetState === 'order_confirmed') {
    const items = order.items || [];
    for (const itm of items) {
      const isUnavailable = itm.materialAvailability === 'unavailable';
      if (isUnavailable && !itm.atpAcknowledgement) {
        throw new PreconditionFailedError(
          'Order confirmation requires ATP shortfall acknowledgement for unavailable lines.'
        );
      }
    }
  }

  // Precondition C: partially_dispatched -> cancelled requires explicit resolution
  if (currentState === 'partially_dispatched' && targetState === 'cancelled') {
    if (!options?.partialDispatchResolution) {
      throw new PreconditionFailedError(
        'Cancellation blocked: Dispatched goods must be accounted for. Please confirm whether dispatched lot will be invoiced separately or returned via Sales Return.'
      );
    }
  }

  // Precondition D: Reversible transition remarks check
  if (rule.requiresRemarks && (!options?.remarks || options.remarks.trim().length < 3)) {
    throw new PreconditionFailedError(
      `Remarks are required when reverting an order from '${STATE_DISPLAY_NAMES[currentState]}' to '${STATE_DISPLAY_NAMES[targetState]}'.`
    );
  }
}

/**
 * Transitions an order to a new lifecycle state with strict validation,
 * role verification, state guards, optimistic concurrency control, and audit logging.
 *
 * @param orderId Target order ID
 * @param targetState Target OrderLifecycleState
 * @param userId ID of the operator performing the transition
 * @param remarks Optional operator remarks
 * @param options Additional options (expectedVersion, tenantId, userRole, etc.)
 *
 * @throws InvalidTransitionError
 * @throws UnauthorizedTransitionError
 * @throws PreconditionFailedError
 * @throws StaleStateError
 */
export async function transitionOrderState(
  orderId: string,
  targetState: OrderLifecycleState,
  userId: string,
  remarks?: string,
  options?: TransitionOrderStateOptions
): Promise<{ success: boolean; newState: OrderLifecycleState; order: Order; historyItem: OrderStatusHistoryItem }> {
  const actor = resolveUserInfo(userId, options);
  const isSandbox = options?.isSandboxMode || localStorage.getItem('isSandboxMode') === 'true' || !db;
  const tenantId = resolveTenantId(undefined, options);
  const isOverride = !!options?.isOverride;
  const safeOverrideReason = (options?.overrideReason || '').trim();

  // ── SANDBOX / LOCAL STORAGE PATH ──────────────────────────────────
  if (isSandbox) {
    const localOrdersKey = `orders_${tenantId}`;
    const cachedRaw = localStorage.getItem(localOrdersKey) || '[]';
    const parsedOrders: Order[] = JSON.parse(cachedRaw);
    const orderIndex = parsedOrders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      throw new Error(`Order #${orderId} was not found in storage.`);
    }

    const currentOrder = parsedOrders[orderIndex];
    const currentVersion = currentOrder.version || 1;
    const currentStatus = normalizeOrderState(currentOrder.status);

    // Optimistic Concurrency Control (EC: StaleStateError)
    if (options?.expectedVersion !== undefined && currentVersion !== options.expectedVersion) {
      throw new StaleStateError('Order status has changed. Please refresh.');
    }
    if (options?.expectedStatus !== undefined && currentStatus !== options.expectedStatus) {
      throw new StaleStateError('Order status has changed. Please refresh.');
    }

    // Validate Transition & Preconditions
    validateStateTransition(
      currentOrder, 
      targetState, 
      userId, 
      actor.role, 
      { ...options, remarks }
    );

    const previousState = currentStatus;
    const newVersion = currentVersion + 1;
    const timestamp = new Date().toISOString();

    const unmetPreconditionWarning = isOverride 
      ? detectUnmetPreconditions(currentOrder, targetState, tenantId, options)
      : undefined;

    const historyItem: OrderStatusHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: currentOrder.id,
      orderNumber: currentOrder.orderNumber,
      previousState,
      newState: targetState,
      userId,
      userName: actor.name,
      userRole: actor.role,
      timestamp,
      remarks: remarks?.trim() || (isOverride ? `Admin Override: ${safeOverrideReason}` : `Transitioned to ${STATE_DISPLAY_NAMES[targetState]}`),
      isOverride,
      overrideReason: isOverride ? safeOverrideReason : undefined,
      unmetPreconditionWarning,
      version: newVersion,
      metadata: {
        ...(options?.metadata || {}),
        ...(options?.partialDispatchResolution ? { partialDispatchResolution: options.partialDispatchResolution } : {}),
        ...(unmetPreconditionWarning ? { unmetPreconditionWarning } : {})
      }
    };

    const updatedOrder: Order = {
      ...currentOrder,
      status: targetState,
      version: newVersion,
      updatedAt: timestamp,
      hasOverride: isOverride || currentOrder.hasOverride,
      isForceOverridden: isOverride || currentOrder.isForceOverridden,
      unmetPreconditionWarning: unmetPreconditionWarning || currentOrder.unmetPreconditionWarning,
      ...(isOverride ? {
        lastOverrideReason: safeOverrideReason,
        lastOverrideBy: actor.name,
        lastOverrideAt: timestamp
      } : {}),
      statusHistory: [historyItem, ...(currentOrder.statusHistory || [])]
    };

    // Commit to localStorage
    parsedOrders[orderIndex] = updatedOrder;
    localStorage.setItem(localOrdersKey, JSON.stringify(parsedOrders));

    // Stock Reservation Lifecycle Hooks (Acceptance Criteria 1, 4, 5 & EC 2)
    if (targetState === 'order_confirmed') {
      try {
        await StockReservationService.reserveStockForOrder(updatedOrder, {
          tenantId,
          actor,
          isSandboxMode: true
        });
      } catch (err) {
        console.warn('Stock reservation hook warning on order confirmation', err);
      }
    } else if (targetState === 'cancelled') {
      try {
        await StockReservationService.releaseReservationsForOrder(orderId, remarks || 'Order cancelled', {
          tenantId,
          actor,
          isSandboxMode: true
        });
      } catch (err) {
        console.warn('Stock reservation release hook warning on order cancellation', err);
      }
    } else if (targetState === 'fully_dispatched') {
      try {
        await StockReservationService.releaseReservationsForOrder(orderId, 'Order fully dispatched — stock consumed in assembly', {
          tenantId,
          actor,
          markConsumed: true,
          isSandboxMode: true
        });
      } catch (err) {
        console.warn('Stock reservation consumption hook warning on full dispatch', err);
      }
    }

    // Notify management role users if override
    if (isOverride) {
      await notifyManagementOfOverride(
        tenantId,
        updatedOrder,
        previousState,
        targetState,
        actor,
        safeOverrideReason,
        true,
        unmetPreconditionWarning
      );
    }

    // Log Activity Event
    logActivityEvent({
      tenantId,
      actionType: 'stage_change',
      entityType: 'order',
      entityId: orderId,
      actor: {
        userId,
        displayName: actor.name,
        email: actor.email
      },
      description: isOverride 
        ? `[OVERRIDE] Forced transition of Order #${updatedOrder.orderNumber} to ${STATE_DISPLAY_NAMES[targetState]}. Reason: ${safeOverrideReason}`
        : `Transitioned Order #${updatedOrder.orderNumber} from ${STATE_DISPLAY_NAMES[previousState]} to ${STATE_DISPLAY_NAMES[targetState]}.`,
      metadata: {
        previousState,
        newState: targetState,
        version: newVersion,
        isOverride,
        unmetPreconditionWarning
      },
      isSandboxMode: true
    });

    // Emit 'order.status.changed' event
    emitOrderStatusChanged({
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      previousState,
      newState: targetState,
      userId,
      userName: actor.name,
      userRole: actor.role,
      timestamp,
      remarks,
      order: updatedOrder,
      historyItem
    });

    return {
      success: true,
      newState: targetState,
      order: updatedOrder,
      historyItem
    };
  }

  // ── FIRESTORE RUNTRANSACTION PATH ─────────────────────────────────
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, where('id', '==', orderId));
    const qSnap = await getDocs(q);

    if (qSnap.empty) {
      // Fallback to sandbox if not yet synced in top-level firestore
      return transitionOrderState(orderId, targetState, userId, remarks, { ...options, isSandboxMode: true });
    }

    const docRef = qSnap.docs[0].ref;

    const { updatedOrder, createdHistoryItem } = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error(`Order #${orderId} does not exist in Firestore.`);
      }

      const currentOrder = snap.data() as Order;
      const currentVersion = currentOrder.version || 1;
      const currentStatus = normalizeOrderState(currentOrder.status);

      // Optimistic Concurrency Control
      if (options?.expectedVersion !== undefined && currentVersion !== options.expectedVersion) {
        throw new StaleStateError('Order status has changed. Please refresh.');
      }
      if (options?.expectedStatus !== undefined && currentStatus !== options.expectedStatus) {
        throw new StaleStateError('Order status has changed. Please refresh.');
      }

      // Validate Transition & Preconditions
      validateStateTransition(
        currentOrder, 
        targetState, 
        userId, 
        actor.role, 
        { ...options, remarks }
      );

      const previousState = currentStatus;
      const newVersion = currentVersion + 1;
      const timestamp = new Date().toISOString();

      const unmetPreconditionWarning = isOverride 
        ? detectUnmetPreconditions(currentOrder, targetState, tenantId, options)
        : undefined;

      const historyItem: OrderStatusHistoryItem = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        orderId: currentOrder.id,
        orderNumber: currentOrder.orderNumber,
        previousState,
        newState: targetState,
        userId,
        userName: actor.name,
        userRole: actor.role,
        timestamp,
        remarks: remarks?.trim() || (isOverride ? `Admin Override: ${safeOverrideReason}` : `Transitioned to ${STATE_DISPLAY_NAMES[targetState]}`),
        isOverride,
        overrideReason: isOverride ? safeOverrideReason : undefined,
        unmetPreconditionWarning,
        version: newVersion,
        metadata: {
          ...(options?.metadata || {}),
          ...(options?.partialDispatchResolution ? { partialDispatchResolution: options.partialDispatchResolution } : {}),
          ...(unmetPreconditionWarning ? { unmetPreconditionWarning } : {})
        }
      };

      const updated: Order = {
        ...currentOrder,
        status: targetState,
        version: newVersion,
        updatedAt: timestamp,
        hasOverride: isOverride || currentOrder.hasOverride,
        isForceOverridden: isOverride || currentOrder.isForceOverridden,
        unmetPreconditionWarning: unmetPreconditionWarning || currentOrder.unmetPreconditionWarning,
        ...(isOverride ? {
          lastOverrideReason: safeOverrideReason,
          lastOverrideBy: actor.name,
          lastOverrideAt: timestamp
        } : {}),
        statusHistory: [historyItem, ...(currentOrder.statusHistory || [])]
      };

      transaction.update(docRef, {
        status: targetState,
        version: newVersion,
        updatedAt: timestamp,
        hasOverride: updated.hasOverride,
        isForceOverridden: updated.isForceOverridden,
        unmetPreconditionWarning: updated.unmetPreconditionWarning || null,
        statusHistory: [historyItem, ...(currentOrder.statusHistory || [])]
      });

      return {
        updatedOrder: updated,
        createdHistoryItem: historyItem
      };
    });

    // Also mirror to localStorage
    try {
      const localOrdersKey = `orders_${tenantId}`;
      const cachedRaw = localStorage.getItem(localOrdersKey);
      if (cachedRaw) {
        const parsed: Order[] = JSON.parse(cachedRaw);
        const idx = parsed.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          parsed[idx] = updatedOrder;
          localStorage.setItem(localOrdersKey, JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.warn('Local mirror update failed', e);
    }

    // Stock Reservation Lifecycle Hooks (Acceptance Criteria 1, 4, 5 & EC 2)
    if (targetState === 'order_confirmed') {
      try {
        await StockReservationService.reserveStockForOrder(updatedOrder, {
          tenantId,
          actor,
          isSandboxMode: false
        });
      } catch (err) {
        console.warn('Stock reservation hook warning on order confirmation', err);
      }
    } else if (targetState === 'cancelled') {
      try {
        await StockReservationService.releaseReservationsForOrder(orderId, remarks || 'Order cancelled', {
          tenantId,
          actor,
          isSandboxMode: false
        });
      } catch (err) {
        console.warn('Stock reservation release hook warning on order cancellation', err);
      }
    } else if (targetState === 'fully_dispatched') {
      try {
        await StockReservationService.releaseReservationsForOrder(orderId, 'Order fully dispatched — stock consumed in assembly', {
          tenantId,
          actor,
          markConsumed: true,
          isSandboxMode: false
        });
      } catch (err) {
        console.warn('Stock reservation consumption hook warning on full dispatch', err);
      }
    }

    // Notify management role users if override
    if (isOverride) {
      await notifyManagementOfOverride(
        tenantId,
        updatedOrder,
        normalizeOrderState(createdHistoryItem.previousState),
        targetState,
        actor,
        safeOverrideReason,
        false,
        createdHistoryItem.unmetPreconditionWarning
      );
    }

    // Log Activity Event
    logActivityEvent({
      tenantId,
      actionType: 'stage_change',
      entityType: 'order',
      entityId: orderId,
      actor: {
        userId,
        displayName: actor.name,
        email: actor.email
      },
      description: isOverride 
        ? `[OVERRIDE] Forced transition of Order #${updatedOrder.orderNumber} to ${STATE_DISPLAY_NAMES[targetState]}. Reason: ${safeOverrideReason}`
        : `Transitioned Order #${updatedOrder.orderNumber} from ${STATE_DISPLAY_NAMES[createdHistoryItem.previousState as OrderLifecycleState]} to ${STATE_DISPLAY_NAMES[targetState]}.`,
      metadata: {
        previousState: createdHistoryItem.previousState,
        newState: targetState,
        version: createdHistoryItem.version,
        isOverride,
        unmetPreconditionWarning: createdHistoryItem.unmetPreconditionWarning
      },
      isSandboxMode: false
    });

    // Emit 'order.status.changed' event
    emitOrderStatusChanged({
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      previousState: normalizeOrderState(createdHistoryItem.previousState),
      newState: targetState,
      userId,
      userName: actor.name,
      userRole: actor.role,
      timestamp: createdHistoryItem.timestamp,
      remarks,
      order: updatedOrder,
      historyItem: createdHistoryItem
    });

    return {
      success: true,
      newState: targetState,
      order: updatedOrder,
      historyItem: createdHistoryItem
    };
  } catch (err: any) {
    // If it's already one of our typed errors, rethrow it directly
    if (
      err instanceof InvalidTransitionError ||
      err instanceof UnauthorizedTransitionError ||
      err instanceof PreconditionFailedError ||
      err instanceof ValidationError ||
      err instanceof StaleStateError
    ) {
      throw err;
    }

    // Check message string for typed error mapping
    const msg = err.message || '';
    if (msg.includes('Override reason must be at least')) {
      throw new ValidationError(msg);
    }
    if (msg.includes('Only admins can override')) {
      throw new UnauthorizedTransitionError(msg);
    }
    if (msg.includes('Order status has changed')) {
      throw new StaleStateError(msg);
    }
    if (msg.includes('Cannot move order') || msg.includes('already in')) {
      throw new InvalidTransitionError(msg);
    }
    if (msg.includes('cannot') && (msg.includes('Contact') || msg.includes('permission'))) {
      throw new UnauthorizedTransitionError(msg);
    }
    if (msg.includes('Cannot mark fully dispatched') || msg.includes('Order confirmation requires ATP')) {
      throw new PreconditionFailedError(msg);
    }

    throw err;
  }
}

export const orderStateService = {
  transitionOrderState,
  validateStateTransition,
  onOrderStatusChanged,
  emitOrderStatusChanged
};

export default orderStateService;
