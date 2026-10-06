// src/components/cost-engine/InteractiveCostEstimatorModal.tsx

import React, { useState, useMemo } from 'react';
import { 
  CostingTemplate, 
  CostCalculationInput, 
  CostCalculationBreakdown,
  CostOperationInput,
  SubcontractItemInput
} from '../../types/costEngine';
import { calculatePartCost } from '../../services/costEngineService';
import { 
  X, 
  Calculator, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  DollarSign, 
  Cpu, 
  Layers, 
  Truck, 
  Percent, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Info
} from 'lucide-react';

interface InteractiveCostEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CostingTemplate;
  initialPartName?: string;
  initialQuantity?: number;
  initialRawMaterialCost?: number;
  onApplyToQuote?: (result: {
    partName: string;
    quantity: number;
    unitPrice: number;
    breakdown: CostCalculationBreakdown;
    specSummary: string;
  }) => void;
}

export const InteractiveCostEstimatorModal: React.FC<InteractiveCostEstimatorModalProps> = ({
  isOpen,
  onClose,
  template,
  initialPartName = 'Custom CNC Machined Component',
  initialQuantity = 100,
  initialRawMaterialCost = 450,
  onApplyToQuote
}) => {
  // Input Form State
  const [partName, setPartName] = useState(initialPartName);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [materialType, setMaterialType] = useState(template.materialMarkups[0]?.category || 'Alloy & Carbon Steel (EN8, EN19)');
  const [rawMaterialCost, setRawMaterialCost] = useState(initialRawMaterialCost);
  const [materialWeightKg, setMaterialWeightKg] = useState(2.5);
  const [rushOrder, setRushOrder] = useState(false);
  const [marginOverride, setMarginOverride] = useState<number | undefined>(undefined);

  // Operations state
  const [operations, setOperations] = useState<CostOperationInput[]>([
    {
      id: 'op-1',
      description: 'CNC Turning Rough & Finish Facing',
      machineId: template.machineHourRates[2]?.id || template.machineHourRates[0]?.id,
      cycleTimeMinutes: 12,
      setupTimeMinutes: 45,
      laborRoleId: template.laborRates[1]?.id
    },
    {
      id: 'op-2',
      description: '3-Axis VMC Milling PCD Holes & Slots',
      machineId: template.machineHourRates[1]?.id || template.machineHourRates[0]?.id,
      cycleTimeMinutes: 18,
      setupTimeMinutes: 60,
      laborRoleId: template.laborRates[2]?.id
    }
  ]);

  // Subcontracting operations state
  const [subcontracts, setSubcontracts] = useState<SubcontractItemInput[]>([
    {
      id: 'sub-item-1',
      subcontractRuleId: template.subcontractingRules[0]?.id || '',
      unitsOrKg: 2.5
    }
  ]);

  if (!isOpen) return null;

  // Add Operation
  const addOperation = () => {
    const newOp: CostOperationInput = {
      id: `op-${Date.now()}`,
      description: 'Secondary Deburring / Drilling',
      machineId: template.machineHourRates[0]?.id,
      cycleTimeMinutes: 8,
      setupTimeMinutes: 15,
      laborRoleId: template.laborRates[2]?.id
    };
    setOperations([...operations, newOp]);
  };

  const removeOperation = (id: string) => {
    setOperations(operations.filter(o => o.id !== id));
  };

  // Add Subcontract
  const addSubcontract = () => {
    const newSub: SubcontractItemInput = {
      id: `sub-${Date.now()}`,
      subcontractRuleId: template.subcontractingRules[1]?.id || template.subcontractingRules[0]?.id || '',
      unitsOrKg: 2.5
    };
    setSubcontracts([...subcontracts, newSub]);
  };

  const removeSubcontract = (id: string) => {
    setSubcontracts(subcontracts.filter(s => s.id !== id));
  };

  // Compute breakdown in real time
  const breakdown: CostCalculationBreakdown = useMemo(() => {
    const input: CostCalculationInput = {
      partName,
      quantity,
      materialType,
      rawMaterialCostPerUnit: rawMaterialCost,
      materialWeightKg,
      operations,
      subcontractProcesses: subcontracts,
      rushOrder,
      targetMarginOverride: marginOverride
    };
    return calculatePartCost(input, template);
  }, [partName, quantity, materialType, rawMaterialCost, materialWeightKg, operations, subcontracts, rushOrder, marginOverride, template]);

  const handleApply = () => {
    const specSummary = `Costed via ${template.name} (${template.version}) | Direct Mfg: ₹${breakdown.unitDirectMfgCost} | Subcontract: ₹${breakdown.unitSubcontractTotal} | Overheads: ₹${breakdown.unitFactoryOverhead + breakdown.unitAdminOverhead} | Margin: ${breakdown.effectiveMarginPercent}% | Est Lead Time: ${breakdown.estimatedProductionLeadTimeDays}d`;
    onApplyToQuote?.({
      partName,
      quantity,
      unitPrice: breakdown.unitQuotePrice,
      breakdown,
      specSummary
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-600 rounded-lg text-white">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold font-display uppercase tracking-wider">
                  Cost Engine Estimator & Quote Formulator
                </h3>
                <span className="px-2 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-bold">
                  Active Rule: {template.name} ({template.version})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bottom-up manufacturing quotation calculation based on verified factory labor, machine hour rates, and subcontracting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Left Inputs (60%) & Right Live Breakdown (40%) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          
          {/* ── LEFT: Interactive Inputs ─────────────────────────────────── */}
          <div className="lg:col-span-7 p-6 space-y-6">
            
            {/* Component & Batch Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Component / Drawing Name *
                </label>
                <input
                  type="text"
                  value={partName}
                  onChange={e => setPartName(e.target.value)}
                  className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. Splined Pinion Drive Shaft Rev C"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Batch Quantity (Nos) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full text-xs font-mono font-bold p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Raw Material Parameters */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-slate-900 flex items-center space-x-1.5">
                  <Layers className="h-4 w-4 text-sky-600" />
                  <span>1. Direct Material Parameters</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">
                    Material Alloy Category
                  </label>
                  <select
                    value={materialType}
                    onChange={e => setMaterialType(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {template.materialMarkups.map(m => (
                      <option key={m.id} value={m.category}>{m.category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">
                    Raw Material Cost (₹ / pc)
                  </label>
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-400 font-mono text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={rawMaterialCost}
                      onChange={e => setRawMaterialCost(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold p-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">
                    Unit Weight (Kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={materialWeightKg}
                    onChange={e => setMaterialWeightKg(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono p-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Machining & Setup Work Centers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-slate-900 flex items-center space-x-1.5">
                  <Cpu className="h-4 w-4 text-sky-600" />
                  <span>2. Machining & Shopfloor Operations</span>
                </span>
                <button
                  type="button"
                  onClick={addOperation}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-mono font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Operation</span>
                </button>
              </div>

              <div className="space-y-2">
                {operations.map((op, idx) => (
                  <div key={op.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={op.description}
                        onChange={e => {
                          const updated = [...operations];
                          updated[idx].description = e.target.value;
                          setOperations(updated);
                        }}
                        className="flex-1 font-semibold text-slate-900 border-b border-slate-200 focus:border-sky-500 pb-0.5"
                        placeholder="Operation Description"
                      />
                      <button
                        type="button"
                        onClick={() => removeOperation(op.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-sans">
                      <div>
                        <label className="block text-[9px] font-mono text-slate-500 uppercase">Work Center (MHR)</label>
                        <select
                          value={op.machineId}
                          onChange={e => {
                            const updated = [...operations];
                            updated[idx].machineId = e.target.value;
                            setOperations(updated);
                          }}
                          className="w-full text-[11px] p-1 border rounded bg-slate-50"
                        >
                          {template.machineHourRates.map(m => (
                            <option key={m.id} value={m.id}>{m.code} - ₹{m.hourlyRate}/hr</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-slate-500 uppercase">Cycle Time (Mins)</label>
                        <input
                          type="number"
                          min="0"
                          value={op.cycleTimeMinutes}
                          onChange={e => {
                            const updated = [...operations];
                            updated[idx].cycleTimeMinutes = parseFloat(e.target.value) || 0;
                            setOperations(updated);
                          }}
                          className="w-full text-[11px] font-mono p-1 border rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-slate-500 uppercase">Batch Setup (Mins)</label>
                        <input
                          type="number"
                          min="0"
                          value={op.setupTimeMinutes || 0}
                          onChange={e => {
                            const updated = [...operations];
                            updated[idx].setupTimeMinutes = parseFloat(e.target.value) || 0;
                            setOperations(updated);
                          }}
                          className="w-full text-[11px] font-mono p-1 border rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-slate-500 uppercase">Labor Role</label>
                        <select
                          value={op.laborRoleId}
                          onChange={e => {
                            const updated = [...operations];
                            updated[idx].laborRoleId = e.target.value;
                            setOperations(updated);
                          }}
                          className="w-full text-[11px] p-1 border rounded bg-slate-50"
                        >
                          {template.laborRates.map(l => (
                            <option key={l.id} value={l.id}>{l.role.split(' ')[0]} - ₹{l.hourlyRate}/h</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subcontracting Operations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-slate-900 flex items-center space-x-1.5">
                  <Truck className="h-4 w-4 text-sky-600" />
                  <span>3. Subcontracting & Outside Processing</span>
                </span>
                <button
                  type="button"
                  onClick={addSubcontract}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-mono font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Subcontract Process</span>
                </button>
              </div>

              {subcontracts.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg">
                  No outside processes assigned (100% in-house manufacturing).
                </div>
              ) : (
                <div className="space-y-2">
                  {subcontracts.map((sub, idx) => (
                    <div key={sub.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase">Process</label>
                          <select
                            value={sub.subcontractRuleId}
                            onChange={e => {
                              const updated = [...subcontracts];
                              updated[idx].subcontractRuleId = e.target.value;
                              setSubcontracts(updated);
                            }}
                            className="w-full text-xs p-1 border rounded bg-slate-50"
                          >
                            {template.subcontractingRules.map(s => (
                              <option key={s.id} value={s.id}>{s.processName} (₹{s.baseRate}/{s.pricingBasis.replace('per_', '')})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono text-slate-500 uppercase">Quantity / Weight Basis</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={sub.unitsOrKg || materialWeightKg}
                            onChange={e => {
                              const updated = [...subcontracts];
                              updated[idx].unitsOrKg = parseFloat(e.target.value) || 1;
                              setSubcontracts(updated);
                            }}
                            className="w-full text-xs font-mono p-1 border rounded"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSubcontract(sub.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Priority & Margin Sliders */}
            <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-sky-900 flex items-center space-x-1.5">
                  <Percent className="h-4 w-4 text-sky-600" />
                  <span>4. Commercial Pricing Controls</span>
                </span>
                <label className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rushOrder}
                    onChange={e => setRushOrder(e.target.checked)}
                    className="accent-amber-600 h-4 w-4 rounded"
                  />
                  <span>Rush Emergency Job (+{template.overheads.rushOrderPremiumPercent}%)</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-600 mb-1">
                    <span>Target Margin Override:</span>
                    <strong className="text-sky-900">
                      {marginOverride !== undefined ? `${marginOverride}%` : `${template.overheads.defaultMarginPercent}% (Template Standard)`}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="45"
                    step="1"
                    value={marginOverride !== undefined ? marginOverride : template.overheads.defaultMarginPercent}
                    onChange={e => setMarginOverride(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
                {marginOverride !== undefined && (
                  <button
                    type="button"
                    onClick={() => setMarginOverride(undefined)}
                    className="text-[10px] font-mono text-slate-400 hover:text-slate-700 underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* ── RIGHT: Real-Time Commercial Breakdown ────────────────────── */}
          <div className="lg:col-span-5 p-6 bg-slate-50 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Costing Breakdown Ledger
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  BATCH: {breakdown.quantity} PCS
                </span>
              </div>

              {/* Cost Stack Table */}
              <div className="space-y-2.5 text-xs">
                {/* 1. Direct Material */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70">
                  <div>
                    <span className="font-semibold text-slate-800">1. Raw Material + Scrap/Handling</span>
                    <div className="text-[10px] text-slate-400">Net ₹{breakdown.unitRawMaterialNet} + Scrap ₹{breakdown.unitMaterialScrapAmount}</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{breakdown.unitMaterialTotal.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 2. Machining & Setup */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70">
                  <div>
                    <span className="font-semibold text-slate-800">2. Machine Center Time (MHR)</span>
                    <div className="text-[10px] text-slate-400">Cycle ₹{breakdown.unitMachiningCost} + Setup ₹{breakdown.unitSetupCost}</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{(breakdown.unitMachiningCost + breakdown.unitSetupCost).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 3. Direct Labor */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70">
                  <div>
                    <span className="font-semibold text-slate-800">3. Shopfloor Direct Labor</span>
                    <div className="text-[10px] text-slate-400">Machinists, Setup & QA allocation</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{breakdown.unitLaborCost.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 4. Subcontracting */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70">
                  <div>
                    <span className="font-semibold text-slate-800">4. Outside Subcontracting</span>
                    <div className="text-[10px] text-slate-400">Base ₹{breakdown.unitSubcontractingCost} + Handling ₹{breakdown.unitSubcontractHandlingAmount}</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{breakdown.unitSubcontractTotal.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 5. Overheads */}
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70">
                  <div>
                    <span className="font-semibold text-slate-800">5. Factory & Admin Overhead</span>
                    <div className="text-[10px] text-slate-400">Factory ({template.overheads.factoryOverheadPercent}%) + Admin ({template.overheads.adminSalesOverheadPercent}%)</div>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{(breakdown.unitFactoryOverhead + breakdown.unitAdminOverhead).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Net Cost Summary Line */}
                <div className="flex items-center justify-between py-2 bg-slate-200/60 px-3 rounded-lg font-mono">
                  <span className="font-bold text-slate-700 text-xs">Net Factory Cost per Unit:</span>
                  <span className="font-black text-slate-900 text-sm">₹{breakdown.unitTotalManufacturingCost.toLocaleString('en-IN')}</span>
                </div>

                {/* Profit Margin */}
                <div className="flex items-center justify-between py-1.5 text-emerald-800">
                  <span className="font-semibold">Profit Margin ({breakdown.effectiveMarginPercent}%)</span>
                  <span className="font-mono font-bold">
                    +₹{breakdown.unitMarginAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Prominent Unit Quote Price Banner */}
              <div className="p-4 rounded-xl bg-slate-900 text-white shadow-md space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
                  <span>Calculated Quote Price</span>
                  <span className="text-emerald-400 font-bold">
                    {breakdown.effectiveMarginPercent}% Net Margin
                  </span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-black font-display text-white">
                    ₹{breakdown.unitQuotePrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/ Unit</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                  <span>Batch Total ({quantity} Pcs):</span>
                  <strong className="text-white text-sm">₹{breakdown.totalExtendedQuotePrice.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* Lead Time Indicator */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-center space-x-3 text-xs">
                <Clock className="h-5 w-5 text-sky-600 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">
                    Est. Production Lead Time: {breakdown.estimatedProductionLeadTimeDays} Working Days
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Accounts for cycle time, batch setups, and subcontracting turnaround buffers.
                  </div>
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-mono font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-2 shadow-xs cursor-pointer transition-colors"
              >
                <span>Apply & Export to Quotation</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
