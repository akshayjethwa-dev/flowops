// src/components/orders/GenerateWorkOrdersModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Layers, 
  Zap, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle,
  Play, 
  ArrowRight, 
  Building2, 
  Plus, 
  Trash2, 
  FileText, 
  Boxes, 
  Truck,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Order, QuoteItem, StockItem } from '../../types';
import { 
  WorkOrder, 
  WorkOrderOperation, 
  ExplodedBomItem, 
  WorkOrderPriority 
} from '../../types/workOrder';
import { 
  generateNextWorkOrderNumber,
  explodeBomForSalesOrderItem,
  getDefaultRoutingForPart,
  generateWorkOrdersFromSalesOrder
} from '../../services/workOrderGenerationService';
import { ShopTravelerModal } from './ShopTravelerModal';
import { useAuth } from '../../hooks/useAuth';
import { useStockItems } from '../../hooks/useStockInventory';
import { useToast } from '../../context/ToastContext';

interface GenerateWorkOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess?: (workOrders: WorkOrder[], updatedOrder: Order) => void;
}

export const GenerateWorkOrdersModal: React.FC<GenerateWorkOrdersModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess
}) => {
  const navigate = useNavigate();
  const { tenant, profile, isSandboxMode } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const { items: stockItems } = useStockItems(tenant?.id);

  const [activeStep, setActiveStep] = useState<'bom' | 'routing' | 'summary'>('bom');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Global WO defaults
  const [priority, setPriority] = useState<WorkOrderPriority>('high');
  const [dueDate, setDueDate] = useState<string>(
    order.deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );

  // Per-item configuration state
  interface ItemPlanState {
    salesOrderItemId: string;
    partName: string;
    partCode: string;
    quantity: number;
    unitPrice: number;
    selected: boolean;
    explodedBom: ExplodedBomItem[];
    routing: WorkOrderOperation[];
  }

  const [itemPlans, setItemPlans] = useState<ItemPlanState[]>([]);
  const [selectedItemIdx, setSelectedItemIdx] = useState(0);

  // Generated results on success
  const [generatedResults, setGeneratedResults] = useState<WorkOrder[] | null>(null);
  const [selectedWoForTraveler, setSelectedWoForTraveler] = useState<WorkOrder | null>(null);

  // Initialize plans with auto-BOM explosion and routing assignment
  useEffect(() => {
    if (!isOpen || !order) return;

    setLoading(true);
    setGeneratedResults(null);

    const plans: ItemPlanState[] = (order.items || []).map((item, idx) => {
      const exploded = explodeBomForSalesOrderItem(item, item.quantity, stockItems);
      const routing = getDefaultRoutingForPart(item.name, item.specs);

      return {
        salesOrderItemId: item.id || `item_${idx}`,
        partName: item.name,
        partCode: `PRT-${item.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        selected: true,
        explodedBom: exploded,
        routing
      };
    });

    setItemPlans(plans);
    setSelectedItemIdx(0);
    setLoading(false);
  }, [isOpen, order, stockItems]);

  if (!isOpen) return null;

  const currentPlan = itemPlans[selectedItemIdx] || itemPlans[0];

  // Calculated aggregate stats
  const totalExplodedComponents = itemPlans.reduce(
    (acc, p) => (p.selected ? acc + p.explodedBom.length : acc),
    0
  );
  const shortagesCount = itemPlans.reduce(
    (acc, p) =>
      p.selected
        ? acc + p.explodedBom.filter((b) => b.allocatedStatus === 'shortage').length
        : acc,
    0
  );
  const totalStandardMinutes = itemPlans.reduce(
    (acc, p) =>
      p.selected
        ? acc +
          p.routing.reduce((s, r) => s + (r.standardTimeMinutes || 0), 0)
        : acc,
    0
  );

  // Operation editing
  const handleUpdateOperation = (
    opIdx: number,
    field: keyof WorkOrderOperation,
    value: any
  ) => {
    setItemPlans((prev) =>
      prev.map((plan, pIdx) => {
        if (pIdx !== selectedItemIdx) return plan;
        const newRouting = [...plan.routing];
        newRouting[opIdx] = { ...newRouting[opIdx], [field]: value };
        return { ...plan, routing: newRouting };
      })
    );
  };

  const handleAddOperation = () => {
    if (!currentPlan) return;
    const newSeq = (currentPlan.routing.length + 1) * 10;
    const newOp: WorkOrderOperation = {
      id: `op_${Date.now()}_custom`,
      name: 'Custom Milling / Finishing Operation',
      workCenterId: 'wc-general',
      workCenterName: 'General Machine Bay',
      sequence: newSeq,
      status: 'pending',
      standardTimeMinutes: 45,
      isSubcontracted: false
    };

    setItemPlans((prev) =>
      prev.map((plan, pIdx) => {
        if (pIdx !== selectedItemIdx) return plan;
        return { ...plan, routing: [...plan.routing, newOp] };
      })
    );
  };

  const handleRemoveOperation = (opIdx: number) => {
    setItemPlans((prev) =>
      prev.map((plan, pIdx) => {
        if (pIdx !== selectedItemIdx) return plan;
        return {
          ...plan,
          routing: plan.routing.filter((_, idx) => idx !== opIdx)
        };
      })
    );
  };

  // Submit Work Orders Generation
  const handleConfirmGeneration = async () => {
    const selectedPlans = itemPlans.filter((p) => p.selected);
    if (selectedPlans.length === 0) {
      toastError('Please select at least 1 sales order item to generate work orders.');
      return;
    }
    if (!tenant?.id || !profile) return;

    setSubmitting(true);
    try {
      const res = await generateWorkOrdersFromSalesOrder({
        tenantId: tenant.id,
        order,
        plantId: order.plantId,
        itemsToGenerate: selectedPlans.map((p) => ({
          salesOrderItemId: p.salesOrderItemId,
          partName: p.partName,
          partCode: p.partCode,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          priority,
          dueDate,
          explodedBom: p.explodedBom,
          routing: p.routing
        })),
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Production Planner',
          email: profile.email
        },
        isSandboxMode
      });

      setGeneratedResults(res.generatedWorkOrders);
      toastSuccess(
        `Generated ${res.generatedWorkOrders.length} Work Orders!`,
        `BOM exploded and routing operations assigned for SO #${order.orderNumber}.`
      );

      if (onSuccess) {
        onSuccess(res.generatedWorkOrders, res.updatedOrder);
      }
    } catch (e: any) {
      toastError('Work Order Generation Failed: ' + (e.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-scale-up font-sans">
        
        {/* ── Header ────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold bg-indigo-950/80 border border-indigo-800/80 px-2 py-0.5 rounded">
                  Sales Order → Work Order Generation
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {order.orderNumber}
                </span>
                {order.customerPoNumber && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.2 rounded">
                    PO: {order.customerPoNumber}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                {order.customerName} • {order.items.length} Confirmed Line Items
              </h3>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Success Screen (If Generated) ──────────────────── */}
        {generatedResults ? (
          <div className="p-8 space-y-6 text-center max-w-2xl mx-auto my-auto">
            <div className="h-16 w-16 bg-emerald-100 border-2 border-emerald-300 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">
                Work Orders Released Successfully!
              </h3>
              <p className="text-xs text-slate-500">
                Auto-BOM explosion completed and shopfloor routing operations linked to Sales Order #{order.orderNumber}.
              </p>
            </div>

            {/* Generated WOs Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {generatedResults.map((wo) => (
                <div 
                  key={wo.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {wo.orderNumber}
                    </span>
                    <span className="text-[10px] font-mono uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                      {wo.status.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {wo.partName}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Batch: {wo.quantity} pcs</span>
                    <span>{wo.operations.length} Operations</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWoForTraveler(wo)}
                    className="w-full text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg py-1.5 px-2 text-[10px] font-mono font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-colors mt-2"
                  >
                    <Printer className="h-3 w-3" />
                    <span>Print Shop Traveler Slip</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-mono font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer"
              >
                Done / Close
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/work-orders');
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer shadow-xs transition-all hover:scale-101"
              >
                <span>View Shopfloor Execution Board</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Sub-Nav Step Tabs ─────────────────────────────── */}
            <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center space-x-1 sm:space-x-3 font-mono text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveStep('bom')}
                  className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors ${
                    activeStep === 'bom'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Boxes className="h-3.5 w-3.5" />
                  <span>1. Auto-BOM Explosion</span>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full">
                    {totalExplodedComponents}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('routing')}
                  className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors ${
                    activeStep === 'routing'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>2. Routing & Operations</span>
                  <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full">
                    {Math.round(totalStandardMinutes / 60)}h
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('summary')}
                  className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors ${
                    activeStep === 'summary'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>3. Work Order Configuration</span>
                </button>
              </div>

              {/* Quick Health Indicators */}
              <div className="flex items-center space-x-3 font-mono text-[10.5px]">
                {shortagesCount > 0 ? (
                  <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center space-x-1">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <span>{shortagesCount} Stock Shortages</span>
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center space-x-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Materials Ready</span>
                  </span>
                )}
              </div>
            </div>

            {/* ── Line Items Selector Pills ─────────────────────── */}
            {itemPlans.length > 1 && (
              <div className="px-6 py-2 bg-white border-b border-slate-100 flex items-center space-x-2 overflow-x-auto text-xs shrink-0">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 shrink-0">
                  Target Part:
                </span>
                {itemPlans.map((plan, idx) => (
                  <button
                    key={plan.salesOrderItemId}
                    type="button"
                    onClick={() => setSelectedItemIdx(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap cursor-pointer transition-colors border ${
                      selectedItemIdx === idx
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {plan.partName} ({plan.quantity} pcs)
                  </button>
                ))}
              </div>
            )}

            {/* ── Main Body Content ─────────────────────────────── */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              
              {/* ────────────────── STEP 1: AUTO-BOM EXPLOSION ────────────────── */}
              {activeStep === 'bom' && currentPlan && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Exploded Bill of Materials: {currentPlan.partName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Hierarchical breakdown of raw materials, sub-assemblies, and standard bought-out hardware scaled to order batch ({currentPlan.quantity} pcs).
                      </p>
                    </div>

                    <div className="text-right font-mono text-xs">
                      <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Total Child Items</span>
                      <span className="font-bold text-slate-800">{currentPlan.explodedBom.length} Components</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[9.5px] font-mono uppercase font-bold text-slate-500 border-b border-slate-200">
                          <th className="p-3">Level</th>
                          <th className="p-3">Component / Part #</th>
                          <th className="p-3">Material Grade</th>
                          <th className="p-3">Type</th>
                          <th className="p-3 text-right">Qty/Unit</th>
                          <th className="p-3 text-right">Total Req.</th>
                          <th className="p-3 text-right">Stock Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {currentPlan.explodedBom.map((comp) => {
                          const isAllocated = comp.allocatedStatus === 'allocated';
                          const isShortage = comp.allocatedStatus === 'shortage';

                          return (
                            <tr key={comp.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-400">
                                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                  comp.level === 1 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  L{comp.level}
                                </span>
                              </td>

                              <td className="p-3 font-sans">
                                <span className="font-bold text-slate-900 block">{comp.description}</span>
                                <span className="text-[10px] font-mono text-slate-400">{comp.partNumber}</span>
                              </td>

                              <td className="p-3 text-slate-700">
                                {comp.materialGrade || '—'}
                              </td>

                              <td className="p-3">
                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  comp.itemType === 'raw_material'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : comp.itemType === 'manufactured'
                                    ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {comp.itemType.replace('_', ' ')}
                                </span>
                              </td>

                              <td className="p-3 text-right font-bold text-slate-700">
                                {comp.quantityPerUnit} {comp.unit}
                              </td>

                              <td className="p-3 text-right font-black text-slate-900">
                                {comp.totalRequiredQuantity} {comp.unit}
                              </td>

                              <td className="p-3 text-right">
                                {isAllocated ? (
                                  <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Allocated ({comp.stockAvailable})</span>
                                  </span>
                                ) : isShortage ? (
                                  <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold text-[10px]">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Shortage ({comp.stockAvailable ?? 0} avail)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold text-[10px]">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Partial ({comp.stockAvailable})</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep('routing')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Proceed to Routing Operations</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ────────────────── STEP 2: ROUTING OPERATIONS ────────────────── */}
              {activeStep === 'routing' && currentPlan && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Manufacturing Routing Assignment: {currentPlan.partName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Shopfloor machine centers, sequence steps, cycle times, and subcontracting flags for this production run.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOperation}
                      className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Step</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {currentPlan.routing.map((op, opIdx) => (
                      <div 
                        key={op.id}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-3xs"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <span className="h-8 w-8 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {op.sequence}
                          </span>

                          <div className="space-y-1 flex-1">
                            <input
                              type="text"
                              value={op.name}
                              onChange={(e) => handleUpdateOperation(opIdx, 'name', e.target.value)}
                              className="w-full text-xs font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-hidden py-0.5"
                            />
                            <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-mono text-slate-400">
                              <span className="text-slate-600 font-semibold">{op.workCenterName}</span>
                              <span>•</span>
                              <span>Std Time: {op.standardTimeMinutes} min</span>
                              {op.isSubcontracted && (
                                <>
                                  <span>•</span>
                                  <span className="text-indigo-600 font-bold">
                                    Outside Process ({op.subcontractorName || 'Subcontractor'})
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Control strip */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <label className="text-[10px] font-mono text-slate-500 flex items-center space-x-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!op.isSubcontracted}
                              onChange={(e) => handleUpdateOperation(opIdx, 'isSubcontracted', e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            <span>Outsourced</span>
                          </label>

                          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <input
                              type="number"
                              value={op.standardTimeMinutes || 30}
                              onChange={(e) => handleUpdateOperation(opIdx, 'standardTimeMinutes', Number(e.target.value))}
                              className="w-12 text-center text-xs font-mono font-bold bg-transparent focus:outline-hidden"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">min</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveOperation(opIdx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Remove Operation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep('bom')}
                      className="text-xs font-mono text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      ← Back to BOM
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveStep('summary')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Proceed to Work Order Details</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ────────────────── STEP 3: SUMMARY & CONFIGURATION ───────────── */}
              {activeStep === 'summary' && (
                <div className="space-y-5">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs font-mono uppercase tracking-wider">
                      Work Order Release Parameters
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                          Production Priority
                        </label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                          className="mt-1 w-full p-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                          <option value="urgent">🔥 Urgent (Hot Job)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                          Shopfloor Due Date
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="mt-1 w-full p-2 text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                          Initial Status
                        </label>
                        <input
                          type="text"
                          disabled
                          value="READY (Released to Line)"
                          className="mt-1 w-full p-2 text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Planned Work Orders Summary List */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs font-mono uppercase tracking-wider">
                      Work Orders to be Spawned ({itemPlans.filter((p) => p.selected).length} Orders)
                    </h4>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                      {itemPlans.map((plan, idx) => (
                        <div 
                          key={plan.salesOrderItemId}
                          className="p-3.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={plan.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setItemPlans((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, selected: checked } : p
                                  )
                                );
                              }}
                              className="h-4 w-4 rounded text-indigo-600"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{plan.partName}</span>
                              <span className="text-[10.5px] font-mono text-slate-400">
                                Part Code: {plan.partCode} • Qty: {plan.quantity} pcs
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 font-mono text-[11px] text-right">
                            <div>
                              <span className="text-slate-400 text-[9.5px] block">Exploded BOM</span>
                              <span className="font-bold text-slate-700">{plan.explodedBom.length} lines</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[9.5px] block">Routing</span>
                              <span className="font-bold text-slate-700">{plan.routing.length} operations</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* ── Footer ────────────────────────────────────────── */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-mono">
                Linking: <strong>SO #{order.orderNumber}</strong> → Work Orders → Operations
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmGeneration}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer shadow-xs transition-all hover:scale-101 disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  <span>{submitting ? 'Generating...' : '⚡ Generate & Release Work Orders'}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Shop Traveler Slip Preview Modal */}
        {selectedWoForTraveler && (
          <ShopTravelerModal
            isOpen={!!selectedWoForTraveler}
            onClose={() => setSelectedWoForTraveler(null)}
            workOrder={selectedWoForTraveler}
            companyName={tenant?.companyName}
          />
        )}

      </div>
    </div>
  );
};
