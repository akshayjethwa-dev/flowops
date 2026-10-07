// src/types/workOrder.ts

export type WorkOrderStatus =
  | 'draft'
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface WorkOrderOperation {
  id: string;
  name: string;
  workCenterId?: string;
  workCenterName?: string;
  sequence: number; // 10, 20, 30...
  status: WorkOrderStatus;
  standardTimeMinutes?: number;
  actualTimeMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  startedByUserId?: string;
  startedByName?: string;
  isSubcontracted?: boolean;
  subcontractorName?: string;
  subcontractRfqId?: string;
  notes?: string;
}

export type BomItemType = 'manufactured' | 'raw_material' | 'bought_out' | 'sub_assembly';

export interface ExplodedBomItem {
  id: string;
  partNumber: string;
  description: string;
  level: number; // 1 = direct component, 2 = sub-tier part
  itemType: BomItemType;
  quantityPerUnit: number;
  totalRequiredQuantity: number;
  unit: string;
  materialGrade?: string;
  stockAvailable?: number;
  allocatedStatus?: 'allocated' | 'partial' | 'shortage' | 'purchase_needed';
  leadTimeDays?: number;
  workOrderId?: string; // if a separate WO is spawned for a manufactured sub-assembly
}

export interface WorkOrder {
  id: string;
  tenantId: string;
  plantId?: string;
  orderNumber: string; // e.g. WO-2026-0001
  salesOrderId: string; // Linking SO
  salesOrderNumber: string; // e.g. SO-2026-0012
  salesOrderItemId?: string;
  quoteNumber?: string;
  customerPoNumber?: string;
  customerName: string;
  partName: string;
  partCode?: string;
  quantity: number;
  quantityCompleted?: number;
  quantityScrapped?: number;
  dueDate: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  currentOperationId?: string;
  currentOperationName?: string;
  operations: WorkOrderOperation[]; // Linking WO -> Operations
  bomItems: ExplodedBomItem[];       // Auto-BOM explosion
  autoExploded?: boolean;
  assignedOperatorIds?: string[];
  assignedOperatorNames?: string[];
  notes?: string;
  createdAt: any;
  updatedAt: any;
  updatedBy?: string;
  updatedByName?: string;
}

export interface WorkOrderGenerationPlan {
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;
  customerPoNumber?: string;
  plantId?: string;
  dueDate: string;
  priority: WorkOrderPriority;
  items: {
    salesOrderItemId: string;
    partName: string;
    partCode?: string;
    quantity: number;
    unitPrice?: number;
    selected: boolean;
    explodedBom: ExplodedBomItem[];
    routing: WorkOrderOperation[];
  }[];
}
