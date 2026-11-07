// src/services/orderStateMachineService.ts

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { Order, UserRole } from '../types';
import { 
  OrderLifecycleState, 
  OrderStatusHistoryItem, 
  ORDER_STATE_TRANSITIONS, 
  normalizeOrderState 
} from '../types/orderStateMachine';
import { logActivityEvent } from '../utils/activityLogger';

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
  matchedRule?: typeof ORDER_STATE_TRANSITIONS[0];
  isOverrideRequired?: boolean;
}

export interface ExecuteTransitionOptions {
  remarks?: string;
  isOverride?: boolean;
  overrideReason?: string;
  expectedVersion?: number; // For optimistic concurrency check (EC 3)
  partialDispatchResolution?: 'invoice_dispatched_and_cancel_balance' | 'return_dispatched_and_cancel';
  metadata?: Record<string, any>;
  isSandboxMode?: boolean;
}

export class OrderStateMachineService {
  /**
   * Get all allowed transitions from a given state for a specific user role.
   */
  static getAllowedTransitions(currentStateRaw: string | undefined, userRole: UserRole) {
    const currentState = normalizeOrderState(currentStateRaw);
    return ORDER_STATE_TRANSITIONS.filter(rule => {
      if (rule.from !== currentState) return false;
      return rule.allowedRoles.includes(userRole);
    });
  }

  /**
   * Get any transition rule matching from -> to (regardless of role),
   * used to verify if state progression is structurally permitted in the graph.
   */
  static getTransitionRule(fromStateRaw: string | undefined, toState: OrderLifecycleState) {
    const fromState = normalizeOrderState(fromStateRaw);
    return ORDER_STATE_TRANSITIONS.find(r => r.from === fromState && r.to === toState);
  }

  /**
   * Validates if a transition is valid according to the finite state machine,
   * role-based access control, reversibility rules, and edge conditions.
   */
  static validateTransition(
    order: Order,
    targetState: OrderLifecycleState,
    userRole: UserRole,
    isOverride: boolean = false,
    overrideReason?: string,
    partialDispatchResolution?: 'invoice_dispatched_and_cancel_balance' | 'return_dispatched_and_cancel'
  ): TransitionValidationResult {
    const currentState = normalizeOrderState(order.status);

    // Same state transition is redundant unless it's a sub-dispatch
    if (currentState === targetState) {
      return {
        valid: false,
        error: `Order #${order.orderNumber} is already in '${currentState.replace('_', ' ').toUpperCase()}' state.`
      };
    }

    // Closed and Cancelled are terminal states (unless admin override with mandatory reason)
    if ((currentState === 'closed' || currentState === 'cancelled') && !isOverride) {
      return {
        valid: false,
        error: `Order #${order.orderNumber} is in terminal '${currentState.toUpperCase()}' state. Regular transitions are blocked.`
      };
    }

    // ADMIN OVERRIDE PATH (Edge Case 1)
    if (isOverride) {
      const allowedOverrideRoles: UserRole[] = ['admin', 'manager', 'management'];
      if (!allowedOverrideRoles.includes(userRole)) {
        return {
          valid: false,
          error: `Permission Denied: Only Admin or Management can execute a State Machine Override.`
        };
      }

      if (!overrideReason || overrideReason.trim().length < 5) {
        return {
          valid: false,
          error: `A mandatory reason for Admin Override is required (minimum 5 characters).`
        };
      }

      return { valid: true };
    }

    // NORMAL TRANSITION PATH: Look for rule in State Graph
    const rule = ORDER_STATE_TRANSITIONS.find(r => r.from === currentState && r.to === targetState);

    if (!rule) {
      return {
        valid: false,
        error: `Invalid Transition: Moving from '${currentState.replace('_', ' ').toUpperCase()}' to '${targetState.replace('_', ' ').toUpperCase()}' is blocked by the order state machine.`
      };
    }

    // Role Permission Check
    if (!rule.allowedRoles.includes(userRole)) {
      return {
        valid: false,
        error: `Access Denied: Role '${userRole.toUpperCase()}' does not have permission to transition order to '${targetState.replace('_', ' ').toUpperCase()}'. Required roles: ${rule.allowedRoles.join(', ')}.`
      };
    }

    // Edge Case 2: Cancellation from Partially Dispatched requires explicit handling of dispatched lot
    if (currentState === 'partially_dispatched' && targetState === 'cancelled') {
      if (!partialDispatchResolution) {
        return {
          valid: false,
          error: `Cancellation blocked: Dispatched goods must be accounted for. Please confirm whether dispatched lot will be invoiced separately or returned via Sales Return.`
        };
      }
    }

    return {
      valid: true,
      matchedRule: rule
    };
  }

  /**
   * Executes an order state transition with optimistic concurrency check (EC 3),
   * updates the order status, increments version, and appends an immutable audit history item.
   */
  static async executeTransition(
    tenantId: string,
    orderId: string,
    targetState: OrderLifecycleState,
    actor: {
      userId: string;
      userName: string;
      userRole: UserRole;
      email?: string;
    },
    options: ExecuteTransitionOptions = {}
  ): Promise<{ success: boolean; order: Order; historyItem: OrderStatusHistoryItem }> {
    const {
      remarks = '',
      isOverride = false,
      overrideReason = '',
      expectedVersion,
      partialDispatchResolution,
      metadata = {},
      isSandboxMode = false
    } = options;

    if (isSandboxMode) {
      return this.executeTransitionSandbox(
        tenantId,
        orderId,
        targetState,
        actor,
        options
      );
    }

    // FIRESTORE TRANSACTION PATH
    try {
      const ordersCol = collection(db, 'orders');
      const q = query(ordersCol, where('id', '==', orderId));
      const qSnap = await getDocs(q);

      if (qSnap.empty) {
        // Fallback to local storage if not found in top-level firestore
        return this.executeTransitionSandbox(
          tenantId,
          orderId,
          targetState,
          actor,
          options
        );
      }

      const docRef = qSnap.docs[0].ref;

      const { updatedOrder, createdHistoryItem } = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        if (!snap.exists()) {
          throw new Error(`Order #${orderId} does not exist.`);
        }

        const currentOrder = snap.data() as Order;
        const currentVersion = currentOrder.version || 1;

        // EC 3: Optimistic Concurrency Control
        // If two users attempt to transition the same order simultaneously,
        // the second action must be rejected with the exact required error message.
        if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
          throw new Error('Order status has changed. Please refresh and try again.');
        }

        // Validate transition
        const validation = this.validateTransition(
          currentOrder,
          targetState,
          actor.userRole,
          isOverride,
          overrideReason,
          partialDispatchResolution
        );

        if (!validation.valid) {
          throw new Error(validation.error || 'State transition rejected.');
        }

        const previousState = normalizeOrderState(currentOrder.status);
        const newVersion = currentVersion + 1;

        // Create immutable history item
        const historyItem: OrderStatusHistoryItem = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          previousState,
          newState: targetState,
          userId: actor.userId,
          userName: actor.userName,
          userRole: actor.userRole,
          timestamp: new Date().toISOString(),
          remarks: remarks.trim() || (isOverride ? `Admin Override: ${overrideReason}` : `Transitioned to ${targetState.replace('_', ' ')}`),
          isOverride,
          overrideReason: isOverride ? overrideReason : undefined,
          version: newVersion,
          metadata: {
            ...metadata,
            ...(partialDispatchResolution ? { partialDispatchResolution } : {})
          }
        };

        const existingHistory: OrderStatusHistoryItem[] = currentOrder.statusHistory || [];
        const newHistory = [...existingHistory, historyItem];

        const updates: Partial<Order> = {
          status: targetState as any,
          version: newVersion,
          statusHistory: newHistory,
          updatedAt: new Date().toISOString()
        };

        transaction.update(docRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });

        const updated: Order = {
          ...currentOrder,
          ...updates
        };

        return {
          updatedOrder: updated,
          createdHistoryItem: historyItem
        };
      });

      if (!updatedOrder || !createdHistoryItem) {
        throw new Error('Failed to commit order state transition.');
      }

      // Also mirror to localStorage backup
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

      // Log activity
      logActivityEvent({
        tenantId,
        actionType: 'stage_change',
        entityType: 'order',
        entityId: orderId,
        actor: {
          userId: actor.userId,
          displayName: actor.userName,
          email: actor.email
        },
        description: isOverride 
          ? `[OVERRIDE] Forced transition of Order #${updatedOrder.orderNumber} to ${targetState.toUpperCase()}. Reason: ${overrideReason}`
          : `Transitioned Order #${updatedOrder.orderNumber} from ${normalizeOrderState(updatedOrder.status).toUpperCase()} to ${targetState.toUpperCase()}.`,
        metadata: {
          previousState: createdHistoryItem.previousState,
          newState: targetState,
          version: createdHistoryItem.version,
          isOverride,
          overrideReason
        },
        isSandboxMode
      });

      return {
        success: true,
        order: updatedOrder,
        historyItem: createdHistoryItem
      };
    } catch (err: any) {
      console.error('Order state transition error:', err);
      throw err;
    }
  }

  /**
   * Sandbox & LocalStorage Execution Handler
   */
  private static executeTransitionSandbox(
    tenantId: string,
    orderId: string,
    targetState: OrderLifecycleState,
    actor: {
      userId: string;
      userName: string;
      userRole: UserRole;
      email?: string;
    },
    options: ExecuteTransitionOptions
  ): { success: boolean; order: Order; historyItem: OrderStatusHistoryItem } {
    const {
      remarks = '',
      isOverride = false,
      overrideReason = '',
      expectedVersion,
      partialDispatchResolution,
      metadata = {}
    } = options;

    const localOrdersKey = `orders_${tenantId}`;
    const cachedRaw = localStorage.getItem(localOrdersKey) || '[]';
    const parsedOrders: Order[] = JSON.parse(cachedRaw);
    const orderIndex = parsedOrders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      throw new Error(`Order #${orderId} was not found in active records.`);
    }

    const currentOrder = parsedOrders[orderIndex];
    const currentVersion = currentOrder.version || 1;

    // EC 3: Optimistic Concurrency Control
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new Error('Order status has changed. Please refresh and try again.');
    }

    // Validate transition
    const validation = this.validateTransition(
      currentOrder,
      targetState,
      actor.userRole,
      isOverride,
      overrideReason,
      partialDispatchResolution
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'State transition rejected.');
    }

    const previousState = normalizeOrderState(currentOrder.status);
    const newVersion = currentVersion + 1;

    const historyItem: OrderStatusHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: currentOrder.id,
      orderNumber: currentOrder.orderNumber,
      previousState,
      newState: targetState,
      userId: actor.userId,
      userName: actor.userName,
      userRole: actor.userRole,
      timestamp: new Date().toISOString(),
      remarks: remarks.trim() || (isOverride ? `Admin Override: ${overrideReason}` : `Transitioned to ${targetState.replace('_', ' ')}`),
      isOverride,
      overrideReason: isOverride ? overrideReason : undefined,
      version: newVersion,
      metadata: {
        ...metadata,
        ...(partialDispatchResolution ? { partialDispatchResolution } : {})
      }
    };

    const existingHistory: OrderStatusHistoryItem[] = currentOrder.statusHistory || [];
    const newHistory = [...existingHistory, historyItem];

    const updatedOrder: Order = {
      ...currentOrder,
      status: targetState as any,
      version: newVersion,
      statusHistory: newHistory,
      updatedAt: new Date().toISOString()
    };

    parsedOrders[orderIndex] = updatedOrder;
    localStorage.setItem(localOrdersKey, JSON.stringify(parsedOrders));

    // Also mirror to mock initial if this was order_test_01
    logActivityEvent({
      tenantId,
      actionType: 'stage_change',
      entityType: 'order',
      entityId: orderId,
      actor: {
        userId: actor.userId,
        displayName: actor.userName,
        email: actor.email
      },
      description: isOverride 
        ? `[OVERRIDE] Forced transition of Order #${updatedOrder.orderNumber} to ${targetState.toUpperCase()}. Reason: ${overrideReason}`
        : `Transitioned Order #${updatedOrder.orderNumber} from ${previousState.toUpperCase()} to ${targetState.toUpperCase()}.`,
      metadata: {
        previousState,
        newState: targetState,
        version: newVersion,
        isOverride,
        overrideReason
      },
      isSandboxMode: true
    });

    return {
      success: true,
      order: updatedOrder,
      historyItem
    };
  }

  /**
   * Helper to ensure an existing order has initialized status history and version.
   */
  static seedInitialStateHistoryIfEmpty(order: Order, createdByName?: string): Order {
    if (order.statusHistory && order.statusHistory.length > 0 && order.version) {
      return order;
    }

    const state = normalizeOrderState(order.status);
    const initialHistory: OrderStatusHistoryItem[] = [
      {
        id: `hist_init_${order.id}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        previousState: 'enquiry',
        newState: state,
        userId: order.createdBy || 'system',
        userName: createdByName || 'System Lead',
        userRole: 'sales',
        timestamp: order.createdAt ? (typeof order.createdAt === 'string' ? order.createdAt : new Date().toISOString()) : new Date().toISOString(),
        remarks: 'Order entered into FlowOps manufacturing registry.',
        version: 1
      }
    ];

    return {
      ...order,
      version: order.version || 1,
      statusHistory: initialHistory
    };
  }
}
