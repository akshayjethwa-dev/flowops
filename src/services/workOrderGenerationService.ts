// src/services/workOrderGenerationService.ts

import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { Order, QuoteItem, StockItem } from '../types';
import { 
  WorkOrder, 
  WorkOrderOperation, 
  ExplodedBomItem, 
  WorkOrderStatus, 
  WorkOrderPriority 
} from '../types/workOrder';
import { logActivityEvent } from '../utils/activityLogger';
import { sendWhatsAppNotification } from '../utils/whatsapp';

/**
 * Sequential Work Order Number Generator:
 * Produces format: WO-YYYY-XXXX (e.g. WO-2026-0001)
 */
export async function generateNextWorkOrderNumber(
  tenantId: string,
  isSandboxMode: boolean = false
): Promise<string> {
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;

  if (isSandboxMode || !db) {
    try {
      const cacheKey = `flowops_work_orders_${tenantId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list: WorkOrder[] = JSON.parse(cached);
        list.forEach((w) => {
          if (!w.orderNumber) return;
          // Format: WO-2026-0042
          const matchYear = w.orderNumber.match(/WO-(\d{4})-(\d+)/i);
          if (matchYear && parseInt(matchYear[1], 10) === currentYear) {
            const num = parseInt(matchYear[2], 10);
            if (num > maxSeq) maxSeq = num;
          } else {
            // Legacy format: WO-00042
            const matchSimple = w.orderNumber.match(/WO-(\d+)/i);
            if (matchSimple) {
              const num = parseInt(matchSimple[1], 10);
              if (num > maxSeq && num < 100000) maxSeq = num;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Error reading cached work orders for WO sequence:', e);
    }
  } else {
    try {
      const colRef = collection(db, 'tenants', tenantId, 'workOrders');
      const snap = await getDocs(colRef);
      snap.forEach((d) => {
        const data = d.data() as Partial<WorkOrder>;
        if (!data.orderNumber) return;
        const matchYear = data.orderNumber.match(/WO-(\d{4})-(\d+)/i);
        if (matchYear && parseInt(matchYear[1], 10) === currentYear) {
          const num = parseInt(matchYear[2], 10);
          if (num > maxSeq) maxSeq = num;
        } else {
          const matchSimple = data.orderNumber.match(/WO-(\d+)/i);
          if (matchSimple) {
            const num = parseInt(matchSimple[1], 10);
            if (num > maxSeq && num < 100000) maxSeq = num;
          }
        }
      });
    } catch (e) {
      console.warn('Firestore query for WO sequence failed, falling back:', e);
    }
  }

  const nextSeq = maxSeq + 1;
  const paddedSeq = nextSeq.toString().padStart(4, '0');
  return `WO-${currentYear}-${paddedSeq}`;
}

/**
 * Standard Shopfloor Routing Templates for Machined/Fabricated SME Parts
 */
export function getDefaultRoutingForPart(partName: string, specs?: string): WorkOrderOperation[] {
  const isHardened = specs?.toLowerCase().includes('hrc') || specs?.toLowerCase().includes('hard') || partName.toLowerCase().includes('gear') || partName.toLowerCase().includes('shaft');
  const isSheetMetal = partName.toLowerCase().includes('sheet') || partName.toLowerCase().includes('cover') || partName.toLowerCase().includes('bracket') || partName.toLowerCase().includes('panel');

  if (isSheetMetal) {
    return [
      {
        id: `op_${Date.now()}_1`,
        name: 'CNC Fiber Laser Cutting & Profiling',
        workCenterId: 'wc-laser-01',
        workCenterName: '12kW Fiber Laser Cell',
        sequence: 10,
        status: 'pending',
        standardTimeMinutes: 45,
        notes: 'Nest per drawing sheet thickness. Deburr edges.'
      },
      {
        id: `op_${Date.now()}_2`,
        name: 'CNC Press Brake Multi-Axis Bending',
        workCenterId: 'wc-bend-01',
        workCenterName: '250T CNC Press Brake',
        sequence: 20,
        status: 'pending',
        standardTimeMinutes: 60,
        notes: 'Check flange dimensions and angle tolerances (±0.5°).'
      },
      {
        id: `op_${Date.now()}_3`,
        name: 'TIG / MIG Precision Welding & Dressing',
        workCenterId: 'wc-weld-01',
        workCenterName: 'Welding & Dressing Bay',
        sequence: 30,
        status: 'pending',
        standardTimeMinutes: 75,
        notes: 'Inspect weld penetration and grind flush as noted.'
      },
      {
        id: `op_${Date.now()}_4`,
        name: 'Surface Treatment & Powder Coating',
        workCenterId: 'wc-paint-01',
        workCenterName: '7-Tank Epoxy Powder Plant',
        sequence: 40,
        status: 'pending',
        standardTimeMinutes: 90,
        isSubcontracted: false,
        notes: '60-80 microns coating thickness verification.'
      },
      {
        id: `op_${Date.now()}_5`,
        name: 'Final Quality Audit & Dispatch Packing',
        workCenterId: 'wc-qc-01',
        workCenterName: 'Final Inspection Station',
        sequence: 50,
        status: 'pending',
        standardTimeMinutes: 30,
        notes: 'Visual & dimensional sign-off, bubble wrap in wooden crate.'
      }
    ];
  }

  // Standard Precision Machined / Forged / Turned Part
  const ops: WorkOrderOperation[] = [
    {
      id: `op_${Date.now()}_1`,
      name: 'Billet Blank Cutting & Facing',
      workCenterId: 'wc-cut-01',
      workCenterName: 'Horizontal Band Saw #02',
      sequence: 10,
      status: 'pending',
      standardTimeMinutes: 30,
      notes: 'Cut blank with +2mm machining allowance.'
    },
    {
      id: `op_${Date.now()}_2`,
      name: 'CNC Turning & OD/ID Rough Profiling',
      workCenterId: 'wc-cnc-01',
      workCenterName: 'Doosan Puma CNC Lathe',
      sequence: 20,
      status: 'pending',
      standardTimeMinutes: 120,
      notes: 'Maintain concentricity within 0.02mm TIR.'
    },
    {
      id: `op_${Date.now()}_3`,
      name: 'VMC 4-Axis Milling & Keyway Broaching',
      workCenterId: 'wc-vmc-01',
      workCenterName: 'Mazak 4-Axis VMC Center',
      sequence: 30,
      status: 'pending',
      standardTimeMinutes: 105,
      notes: 'Mill spline/keyway and drill PCD bolt holes.'
    }
  ];

  if (isHardened) {
    ops.push({
      id: `op_${Date.now()}_4`,
      name: 'Heat Treatment & Induction Case Hardening',
      workCenterId: 'wc-ht-01',
      workCenterName: 'Sealed Quench & Induction Bay',
      sequence: 40,
      status: 'pending',
      standardTimeMinutes: 180,
      isSubcontracted: true,
      subcontractorName: 'Pragati Heat Treaters (Pvt) Ltd',
      notes: 'Case depth 1.2mm, hardness 58-62 HRC on wear zones.'
    });
    ops.push({
      id: `op_${Date.now()}_5`,
      name: 'Precision Cylindrical Finish Grinding',
      workCenterId: 'wc-grind-01',
      workCenterName: 'Jones & Shipman Cylindrical Grinder',
      sequence: 50,
      status: 'pending',
      standardTimeMinutes: 60,
      notes: 'Grind bearing journals to Ra 0.4 μm finish.'
    });
  }

  ops.push({
    id: `op_${Date.now()}_qc`,
    name: 'CMM Metrology & NDT Quality Inspection',
    workCenterId: 'wc-qc-01',
    workCenterName: 'Zeiss CMM Quality Lab',
    sequence: isHardened ? 60 : 40,
    status: 'pending',
    standardTimeMinutes: 40,
    notes: 'Verify GD&T runout, bore diameters, and surface roughness.'
  });

  ops.push({
    id: `op_${Date.now()}_pack`,
    name: 'Anti-Rust Coating, Labelling & Final Transfer',
    workCenterId: 'wc-pack-01',
    workCenterName: 'Preservation & Assembly Area',
    sequence: isHardened ? 70 : 50,
    status: 'pending',
    standardTimeMinutes: 20,
    notes: 'Dip in rust-preventive oil, tag work order traveler barcode.'
  });

  return ops;
}

/**
 * Automatically Explodes BOM for a Sales Order Item:
 * If explicit BOM lines exist (from quotation or scrubber), explodes them.
 * Otherwise, generates an engineered bill of materials based on part name and specs.
 */
export function explodeBomForSalesOrderItem(
  item: QuoteItem,
  orderQuantity: number,
  stockItems: StockItem[] = []
): ExplodedBomItem[] {
  const totalQty = orderQuantity || item.quantity || 1;
  const exploded: ExplodedBomItem[] = [];

  // 1. Check if item has explicit bomLines attached
  if (item.bomLines && item.bomLines.length > 0) {
    item.bomLines.forEach((b: any, idx: number) => {
      const qtyPerUnit = Number(b.quantity || b.quantityPerUnit || 1);
      const totalReq = qtyPerUnit * totalQty;
      const partNo = b.partNumber || b.code || `COMP-${item.id}-${idx + 1}`;
      const desc = b.description || b.name || b.partName || `Component ${idx + 1}`;

      // Check matching inventory
      const matchedStock = stockItems.find(
        (s) =>
          s.code?.toLowerCase() === partNo.toLowerCase() ||
          s.name?.toLowerCase().includes(desc.toLowerCase()) ||
          desc.toLowerCase().includes(s.name?.toLowerCase())
      );

      const available = matchedStock ? matchedStock.currentQty : 0;
      let allocatedStatus: 'allocated' | 'partial' | 'shortage' = 'shortage';
      if (available >= totalReq) {
        allocatedStatus = 'allocated';
      } else if (available > 0) {
        allocatedStatus = 'partial';
      }

      exploded.push({
        id: `bom_exp_${Date.now()}_${idx}`,
        partNumber: partNo,
        description: desc,
        level: b.level || 1,
        itemType: (b.itemType as any) || (idx === 0 ? 'raw_material' : 'manufactured'),
        quantityPerUnit: qtyPerUnit,
        totalRequiredQuantity: totalReq,
        unit: b.unit || 'pcs',
        materialGrade: b.materialGrade || b.material || 'Standard Spec',
        stockAvailable: available,
        allocatedStatus,
        leadTimeDays: b.leadTimeDays || 4
      });
    });
    return exploded;
  }

  // 2. Synthesize Intelligent Engineering BOM Explosion
  const partNameLower = item.name.toLowerCase();

  // Primary Raw Material Billet / Bar / Sheet
  const rawMaterialName = partNameLower.includes('gear')
    ? 'EN353 / 20MnCr5 Forged Round Billet Ø140mm'
    : partNameLower.includes('shaft')
    ? 'EN19 Normalized / AISI 4140 Bright Round Bar Ø65mm'
    : partNameLower.includes('pump') || partNameLower.includes('housing')
    ? 'SG Iron 500/7 Graded Casting Blank'
    : partNameLower.includes('sheet') || partNameLower.includes('cover')
    ? 'CRCA IS 513 Grade D 3.0mm Sheet Metal'
    : 'EN8D / C45 Carbon Steel Billet';

  const rawMatchedStock = stockItems.find(
    (s) =>
      s.category === 'raw_material' ||
      s.name.toLowerCase().includes('steel') ||
      s.name.toLowerCase().includes('bar') ||
      s.name.toLowerCase().includes('blank')
  );

  exploded.push({
    id: `bom_exp_${Date.now()}_raw`,
    partNumber: `RM-${item.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()}-01`,
    description: rawMaterialName,
    level: 1,
    itemType: 'raw_material',
    quantityPerUnit: 1.05, // includes 5% cut/swarf allowance
    totalRequiredQuantity: Math.ceil(totalQty * 1.05),
    unit: 'pcs',
    materialGrade: rawMaterialName.split(' ')[0] || 'EN Series',
    stockAvailable: rawMatchedStock?.currentQty ?? 250,
    allocatedStatus: (rawMatchedStock?.currentQty ?? 250) >= totalQty ? 'allocated' : 'shortage',
    leadTimeDays: 2
  });

  // Level 1 Machined Subcomponent / Core Assembly
  exploded.push({
    id: `bom_exp_${Date.now()}_core`,
    partNumber: `MFG-${item.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()}-10`,
    description: `${item.name} — Machined Core Component`,
    level: 1,
    itemType: 'manufactured',
    quantityPerUnit: 1,
    totalRequiredQuantity: totalQty,
    unit: item.unit || 'pcs',
    materialGrade: 'Final Machined Part',
    stockAvailable: 0,
    allocatedStatus: 'shortage', // Needs production
    leadTimeDays: 5
  });

  // Level 2 Hardware: Fasteners / Bolts
  exploded.push({
    id: `bom_exp_${Date.now()}_fast`,
    partNumber: 'STD-FAST-M10X35',
    description: 'High-Tensile Hex Socket Head Cap Screws M10 x 35mm (Gr 10.9)',
    level: 2,
    itemType: 'bought_out',
    quantityPerUnit: 4,
    totalRequiredQuantity: totalQty * 4,
    unit: 'pcs',
    materialGrade: 'High Tensile Alloy Steel Gr 10.9',
    stockAvailable: 500,
    allocatedStatus: 500 >= totalQty * 4 ? 'allocated' : 'partial',
    leadTimeDays: 1
  });

  // Level 2 Hardware: Sealing / Gasket / Key
  exploded.push({
    id: `bom_exp_${Date.now()}_seal`,
    partNumber: 'STD-SEAL-NBR70',
    description: 'Viton / Nitrile NBR 70 Shore Rotary Shaft Oil Seal & Circlip Ring',
    level: 2,
    itemType: 'bought_out',
    quantityPerUnit: 1,
    totalRequiredQuantity: totalQty,
    unit: 'pcs',
    materialGrade: 'NBR 70 Shore A / Spring Steel',
    stockAvailable: 120,
    allocatedStatus: 120 >= totalQty ? 'allocated' : 'partial',
    leadTimeDays: 2
  });

  return exploded;
}

export interface GenerateWorkOrdersFromSalesOrderOptions {
  tenantId: string;
  order: Order;
  plantId?: string;
  itemsToGenerate: {
    salesOrderItemId: string;
    partName: string;
    partCode?: string;
    quantity: number;
    unitPrice?: number;
    priority?: WorkOrderPriority;
    dueDate?: string;
    explodedBom: ExplodedBomItem[];
    routing: WorkOrderOperation[];
  }[];
  actor: {
    userId: string;
    displayName: string;
    email?: string;
  };
  isSandboxMode?: boolean;
}

export interface GenerateWorkOrdersResult {
  generatedWorkOrders: WorkOrder[];
  updatedOrder: Order;
}

/**
 * Execute Sales Order → Work Order Generation
 * Explodes BOM, assigns routing operations, creates sequential WO numbers,
 * and links SO → WO → Operations in Firestore and local state.
 */
export async function generateWorkOrdersFromSalesOrder(
  options: GenerateWorkOrdersFromSalesOrderOptions
): Promise<GenerateWorkOrdersResult> {
  const {
    tenantId,
    order,
    plantId = order.plantId || 'all',
    itemsToGenerate,
    actor,
    isSandboxMode = false
  } = options;

  if (!itemsToGenerate || itemsToGenerate.length === 0) {
    throw new Error('Please select at least one sales order item to generate work orders.');
  }

  const generatedWorkOrders: WorkOrder[] = [];
  const currentYear = new Date().getFullYear();

  // Read existing work orders to calculate clean sequential numbers
  let existingList: WorkOrder[] = [];
  const cacheKey = `flowops_work_orders_${tenantId}`;

  if (isSandboxMode || !db) {
    const cached = localStorage.getItem(cacheKey);
    existingList = cached ? JSON.parse(cached) : [];
  } else {
    try {
      const snap = await getDocs(collection(db, 'tenants', tenantId, 'workOrders'));
      existingList = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    } catch (e) {
      console.warn('Could not read existing work orders from firestore, using fallback:', e);
    }
  }

  // Calculate highest existing sequence
  let maxSeq = 0;
  existingList.forEach((w) => {
    if (!w.orderNumber) return;
    const matchYear = w.orderNumber.match(/WO-(\d{4})-(\d+)/i);
    if (matchYear && parseInt(matchYear[1], 10) === currentYear) {
      const num = parseInt(matchYear[2], 10);
      if (num > maxSeq) maxSeq = num;
    } else {
      const matchSimple = w.orderNumber.match(/WO-(\d+)/i);
      if (matchSimple) {
        const num = parseInt(matchSimple[1], 10);
        if (num > maxSeq && num < 100000) maxSeq = num;
      }
    }
  });

  const nowIso = new Date().toISOString();

  // Process each selected item into a linked Work Order
  for (let i = 0; i < itemsToGenerate.length; i++) {
    const itemConfig = itemsToGenerate[i];
    maxSeq += 1;
    const woNumber = `WO-${currentYear}-${maxSeq.toString().padStart(4, '0')}`;
    const woId = `wo_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

    // Initial operation
    const routingOps = (itemConfig.routing && itemConfig.routing.length > 0)
      ? itemConfig.routing
      : getDefaultRoutingForPart(itemConfig.partName);

    const firstOp = routingOps[0];

    const newWo: WorkOrder = {
      id: woId,
      tenantId,
      plantId: plantId === 'all' ? undefined : plantId,
      orderNumber: woNumber,
      salesOrderId: order.id,
      salesOrderNumber: order.orderNumber,
      salesOrderItemId: itemConfig.salesOrderItemId,
      quoteNumber: order.quoteNumber,
      customerPoNumber: order.customerPoNumber,
      customerName: order.customerName,
      partName: itemConfig.partName,
      partCode: itemConfig.partCode || `PRT-${itemConfig.partName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}`,
      quantity: itemConfig.quantity,
      quantityCompleted: 0,
      quantityScrapped: 0,
      dueDate: itemConfig.dueDate || order.deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      priority: itemConfig.priority || 'high',
      status: 'ready',
      currentOperationId: firstOp?.id,
      currentOperationName: firstOp?.name,
      operations: routingOps,
      bomItems: itemConfig.explodedBom,
      autoExploded: true,
      notes: `Auto-generated from Sales Order #${order.orderNumber}${order.customerPoNumber ? ` (Customer PO: ${order.customerPoNumber})` : ''}`,
      createdAt: isSandboxMode ? nowIso : serverTimestamp(),
      updatedAt: isSandboxMode ? nowIso : serverTimestamp(),
      updatedBy: actor.userId,
      updatedByName: actor.displayName
    };

    generatedWorkOrders.push(newWo);
  }

  // Update Sales Order document with linked Work Orders
  const woIds = generatedWorkOrders.map(w => w.id);
  const woNumbers = generatedWorkOrders.map(w => w.orderNumber);

  const updatedOrder: Order = {
    ...order,
    status: 'in-production',
    // Embed work orders link in order
    ...( {
      workOrdersGenerated: true,
      workOrderIds: woIds,
      workOrderNumbers: woNumbers
    } as any )
  };

  // Persist to Database or Sandbox Cache
  if (isSandboxMode || !db) {
    // 1. Save Work Orders
    const mergedList = [...generatedWorkOrders, ...existingList];
    localStorage.setItem(cacheKey, JSON.stringify(mergedList));

    // 2. Save Updated Order
    const cachedOrdersKey = `orders_${tenantId}`;
    const cachedOrdersRaw = localStorage.getItem(cachedOrdersKey);
    if (cachedOrdersRaw) {
      const ordersList: Order[] = JSON.parse(cachedOrdersRaw);
      const updatedOrdersList = ordersList.map(o => o.id === order.id ? updatedOrder : o);
      localStorage.setItem(cachedOrdersKey, JSON.stringify(updatedOrdersList));
    }
  } else {
    try {
      // 1. Create each Work Order in /tenants/{tenantId}/workOrders/{woId}
      for (const wo of generatedWorkOrders) {
        await setDoc(doc(db, 'tenants', tenantId, 'workOrders', wo.id), wo);
      }

      // 2. Update Sales Order in /orders/{orderId}
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'in-production',
        workOrdersGenerated: true,
        workOrderIds: woIds,
        workOrderNumbers: woNumbers,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error('Failed to persist work orders to Firestore:', err);
      // Fallback local save to ensure smooth planner continuity
      const mergedList = [...generatedWorkOrders, ...existingList];
      localStorage.setItem(cacheKey, JSON.stringify(mergedList));
    }
  }

  // Log Audit Event
  logActivityEvent({
    tenantId,
    actionType: 'create',
    entityType: 'order',
    entityId: order.id,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      email: actor.email
    },
    description: `Generated ${generatedWorkOrders.length} Work Orders (${woNumbers.join(', ')}) from Sales Order #${order.orderNumber}. Exploded BOM & assigned shopfloor routing operations.`
  });

  // Automated WhatsApp Alert to Production Team
  try {
    sendWhatsAppNotification({
      tenantId,
      recipientPhone: order.phone || '+91 98450 12891',
      recipientName: order.customerName,
      templateName: 'order_status_update',
      orderId: order.id,
      parameters: {
        customer_name: order.customerName,
        order_number: order.orderNumber,
        new_status: 'IN PRODUCTION (Work Orders Released)',
        estimated_date: order.deliveryDate || 'Within schedule'
      }
    });
  } catch (e) {
    console.warn('WhatsApp alert skipped:', e);
  }

  // Notify active listeners (useWorkOrders, boards, monitors)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('flowops:workorders_updated', {
          detail: { generatedWorkOrders, updatedOrder }
        })
      );
    } catch (e) {
      console.warn('Event dispatch error:', e);
    }
  }

  return {
    generatedWorkOrders,
    updatedOrder
  };
}
