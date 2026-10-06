// src/components/cost-engine/CostRuleBuilder.tsx

import React, { useState } from 'react';
import { 
  CostingTemplate, 
  LaborRateRule, 
  MachineHourRateRule, 
  MaterialMarkupRule, 
  SubcontractingRule, 
  OverheadAndMarginRule,
  SkillLevel,
  SubcontractPricingBasis
} from '../../types/costEngine';
import { 
  Sliders, 
  Users, 
  Cpu, 
  Layers, 
  Truck, 
  Percent, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  Building, 
  ShieldCheck, 
  Copy, 
  History, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  FileCheck
} from 'lucide-react';

interface CostRuleBuilderProps {
  template: CostingTemplate;
  onUpdateTemplate: (updated: CostingTemplate) => void;
  onCreateNewVersion: (changeLog: string, isMajor: boolean) => void;
  onDuplicateTemplate: (newName: string) => void;
  onSetDefault: () => void;
  onDeleteTemplate?: () => void;
  canDelete?: boolean;
}

export const CostRuleBuilder: React.FC<CostRuleBuilderProps> = ({
  template,
  onUpdateTemplate,
  onCreateNewVersion,
  onDuplicateTemplate,
  onSetDefault,
  onDeleteTemplate,
  canDelete = false
}) => {
  const [activeTab, setActiveTab] = useState<'labor' | 'machines' | 'materials' | 'subcontract' | 'overheads'>('machines');
  
  // Versioning modal
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [changeLogText, setChangeLogText] = useState('');
  const [isMajorVersion, setIsMajorVersion] = useState(false);

  // Clone modal
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState(`${template.name} (Custom Copy)`);

  // Local editable template state
  const handleUpdateLabor = (newLabor: LaborRateRule[]) => {
    onUpdateTemplate({ ...template, laborRates: newLabor });
  };

  const handleUpdateMachines = (newMachines: MachineHourRateRule[]) => {
    onUpdateTemplate({ ...template, machineHourRates: newMachines });
  };

  const handleUpdateMaterials = (newMaterials: MaterialMarkupRule[]) => {
    onUpdateTemplate({ ...template, materialMarkups: newMaterials });
  };

  const handleUpdateSubcontract = (newSub: SubcontractingRule[]) => {
    onUpdateTemplate({ ...template, subcontractingRules: newSub });
  };

  const handleUpdateOverheads = (newOverheads: OverheadAndMarginRule) => {
    onUpdateTemplate({ ...template, overheads: newOverheads });
  };

  // ── Labor Rate Handlers ─────────────────────────────────────
  const addLaborRule = () => {
    const newRule: LaborRateRule = {
      id: `lr-${Date.now()}`,
      role: 'New Technical Role',
      hourlyRate: 350,
      overtimeMultiplier: 1.5,
      skillLevel: 'skilled',
      efficiencyFactor: 1.0,
      description: 'Standard day-shift role'
    };
    handleUpdateLabor([...template.laborRates, newRule]);
  };

  const removeLaborRule = (id: string) => {
    handleUpdateLabor(template.laborRates.filter(r => r.id !== id));
  };

  // ── Machine Hour Rate Handlers ──────────────────────────────
  const addMachineRule = () => {
    const newRule: MachineHourRateRule = {
      id: `mhr-${Date.now()}`,
      machineName: 'New CNC / Work Center',
      code: `WC-${Math.floor(10 + Math.random() * 90)}`,
      hourlyRate: 600,
      setupHourlyRate: 400,
      powerRatingKw: 15,
      depreciationPerHr: 120,
      toolingAllowancePerHr: 75,
      description: 'Factory workstation'
    };
    handleUpdateMachines([...template.machineHourRates, newRule]);
  };

  const removeMachineRule = (id: string) => {
    handleUpdateMachines(template.machineHourRates.filter(r => r.id !== id));
  };

  // ── Material Markup Handlers ────────────────────────────────
  const addMaterialRule = () => {
    const newRule: MaterialMarkupRule = {
      id: `mm-${Date.now()}`,
      category: 'New Material Category',
      scrapFactorPercent: 8,
      handlingMarkupPercent: 5,
      freightPerKg: 4.0,
      notes: 'Custom alloy/stock rule'
    };
    handleUpdateMaterials([...template.materialMarkups, newRule]);
  };

  const removeMaterialRule = (id: string) => {
    handleUpdateMaterials(template.materialMarkups.filter(r => r.id !== id));
  };

  // ── Subcontracting Handlers ─────────────────────────────────
  const addSubcontractRule = () => {
    const newRule: SubcontractingRule = {
      id: `sub-${Date.now()}`,
      processName: 'Outside Treatment / Plating',
      pricingBasis: 'per_kg',
      baseRate: 40,
      handlingMarkupPercent: 10,
      standardLeadTimeDays: 4,
      preferredVendorName: 'Approved Subcontractor'
    };
    handleUpdateSubcontract([...template.subcontractingRules, newRule]);
  };

  const removeSubcontractRule = (id: string) => {
    handleUpdateSubcontract(template.subcontractingRules.filter(r => r.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── Template Header Banner ─────────────────────────────────── */}
      <div className="p-5 bg-slate-900 text-white border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
              Costing Template
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-bold">
              {template.version}
            </span>
            {template.isDefault && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-mono font-bold flex items-center space-x-1">
                <Check className="h-3 w-3" />
                <span>Default Template</span>
              </span>
            )}
          </div>
          <h2 className="text-lg md:text-xl font-bold font-display uppercase tracking-tight mt-1 text-white">
            {template.name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            {template.description}
          </p>
          {template.changeLogNotes && (
            <div className="mt-2 flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
              <History className="h-3.5 w-3.5 text-sky-400" />
              <span>Changelog: {template.changeLogNotes}</span>
            </div>
          )}
        </div>

        {/* Template Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!template.isDefault && (
            <button
              onClick={onSetDefault}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Set as Default</span>
            </button>
          )}

          <button
            onClick={() => setShowVersionModal(true)}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            <span>Create New Version</span>
          </button>

          <button
            onClick={() => setShowCloneModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-sky-400" />
            <span>Clone</span>
          </button>

          {canDelete && (
            <button
              onClick={onDeleteTemplate}
              className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700 cursor-pointer transition-colors"
              title="Delete this template"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Sub-navigation Tabs ───────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 bg-slate-50 px-4 overflow-x-auto select-none gap-2">
        {[
          { id: 'machines', label: `Machine Hour Rates (${template.machineHourRates.length})`, icon: Cpu },
          { id: 'labor', label: `Labor Rates (${template.laborRates.length})`, icon: Users },
          { id: 'materials', label: `Material Markups (${template.materialMarkups.length})`, icon: Layers },
          { id: 'subcontract', label: `Subcontracting (${template.subcontractingRules.length})`, icon: Truck },
          { id: 'overheads', label: 'Overheads & Margins', icon: Percent },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 text-xs uppercase font-mono font-bold tracking-wider flex items-center space-x-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'border-sky-600 text-slate-900 bg-white shadow-3xs' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Contents ────────────────────────────────────────────── */}
      <div className="p-5">
        {/* 1. MACHINE HOUR RATES BUILDER */}
        {activeTab === 'machines' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide">
                  Machine Hour Rates (MHR) & Work Centers
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cost per running hour for each machine center, accounting for power consumption, capital depreciation, and tooling wear.
                </p>
              </div>
              <button
                onClick={addMachineRule}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              >
                <Plus className="h-3.5 w-3.5 text-sky-400" />
                <span>Add Work Center</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Machine / Work Center</th>
                    <th className="py-2.5 px-3">Hourly Rate (₹/hr)</th>
                    <th className="py-2.5 px-3">Setup Rate (₹/hr)</th>
                    <th className="py-2.5 px-3">Power (kW)</th>
                    <th className="py-2.5 px-3">Tooling Allowance (₹)</th>
                    <th className="py-2.5 px-3">Depreciation (₹)</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {template.machineHourRates.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="text"
                          value={m.code}
                          onChange={e => {
                            const updated = [...template.machineHourRates];
                            updated[idx].code = e.target.value;
                            handleUpdateMachines(updated);
                          }}
                          className="w-24 px-1.5 py-1 font-bold text-slate-800 border border-slate-300 rounded font-mono text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={m.machineName}
                          onChange={e => {
                            const updated = [...template.machineHourRates];
                            updated[idx].machineName = e.target.value;
                            handleUpdateMachines(updated);
                          }}
                          className="w-full min-w-[200px] px-2 py-1 font-medium text-slate-900 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={m.hourlyRate}
                            onChange={e => {
                              const updated = [...template.machineHourRates];
                              updated[idx].hourlyRate = parseFloat(e.target.value) || 0;
                              handleUpdateMachines(updated);
                            }}
                            className="w-20 px-1.5 py-1 font-bold text-slate-900 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={m.setupHourlyRate}
                            onChange={e => {
                              const updated = [...template.machineHourRates];
                              updated[idx].setupHourlyRate = parseFloat(e.target.value) || 0;
                              handleUpdateMachines(updated);
                            }}
                            className="w-20 px-1.5 py-1 text-slate-800 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="number"
                          min="0"
                          value={m.powerRatingKw}
                          onChange={e => {
                            const updated = [...template.machineHourRates];
                            updated[idx].powerRatingKw = parseFloat(e.target.value) || 0;
                            handleUpdateMachines(updated);
                          }}
                          className="w-16 px-1.5 py-1 text-slate-700 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="number"
                          min="0"
                          value={m.toolingAllowancePerHr || 0}
                          onChange={e => {
                            const updated = [...template.machineHourRates];
                            updated[idx].toolingAllowancePerHr = parseFloat(e.target.value) || 0;
                            handleUpdateMachines(updated);
                          }}
                          className="w-16 px-1.5 py-1 text-slate-700 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="number"
                          min="0"
                          value={m.depreciationPerHr || 0}
                          onChange={e => {
                            const updated = [...template.machineHourRates];
                            updated[idx].depreciationPerHr = parseFloat(e.target.value) || 0;
                            handleUpdateMachines(updated);
                          }}
                          className="w-16 px-1.5 py-1 text-slate-700 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => removeMachineRule(m.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. LABOR RATES BUILDER */}
        {activeTab === 'labor' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide">
                  Labor & Technician Hourly Rates
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct labor rates mapped by specialization and efficiency factor for programming, machining, welding, and QC.
                </p>
              </div>
              <button
                onClick={addLaborRule}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              >
                <Plus className="h-3.5 w-3.5 text-sky-400" />
                <span>Add Labor Role</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Trade / Role Name</th>
                    <th className="py-2.5 px-3">Skill Classification</th>
                    <th className="py-2.5 px-3">Base Hourly Rate (₹/hr)</th>
                    <th className="py-2.5 px-3">OT Multiplier</th>
                    <th className="py-2.5 px-3">Efficiency Factor</th>
                    <th className="py-2.5 px-3">Shift Rate (8 Hrs)</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {template.laborRates.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={l.role}
                          onChange={e => {
                            const updated = [...template.laborRates];
                            updated[idx].role = e.target.value;
                            handleUpdateLabor(updated);
                          }}
                          className="w-full min-w-[200px] px-2 py-1 font-semibold text-slate-900 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={l.skillLevel}
                          onChange={e => {
                            const updated = [...template.laborRates];
                            updated[idx].skillLevel = e.target.value as SkillLevel;
                            handleUpdateLabor(updated);
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-700"
                        >
                          <option value="specialist">Specialist / Lead</option>
                          <option value="skilled">Skilled</option>
                          <option value="semi_skilled">Semi-Skilled</option>
                          <option value="unskilled">Unskilled Helper</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={l.hourlyRate}
                            onChange={e => {
                              const updated = [...template.laborRates];
                              updated[idx].hourlyRate = parseFloat(e.target.value) || 0;
                              handleUpdateLabor(updated);
                            }}
                            className="w-20 px-1.5 py-1 font-bold text-slate-900 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={l.overtimeMultiplier}
                          onChange={e => {
                            const updated = [...template.laborRates];
                            updated[idx].overtimeMultiplier = parseFloat(e.target.value) || 1.5;
                            handleUpdateLabor(updated);
                          }}
                          className="w-16 px-1.5 py-1 text-slate-700 border border-slate-300 rounded text-xs"
                        />
                        <span className="text-slate-400 ml-1">x</span>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="number"
                          step="0.05"
                          min="0.5"
                          max="1.5"
                          value={l.efficiencyFactor}
                          onChange={e => {
                            const updated = [...template.laborRates];
                            updated[idx].efficiencyFactor = parseFloat(e.target.value) || 1.0;
                            handleUpdateLabor(updated);
                          }}
                          className="w-16 px-1.5 py-1 text-slate-700 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                        ₹{(l.hourlyRate * 8).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => removeLaborRule(l.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. MATERIAL MARKUPS & SCRAP BUILDER */}
        {activeTab === 'materials' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide">
                  Material Scrap Allowance & Handling Markups
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Category-specific scrap waste factors, inventory cutting allowances, and inward freight buffers.
                </p>
              </div>
              <button
                onClick={addMaterialRule}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              >
                <Plus className="h-3.5 w-3.5 text-sky-400" />
                <span>Add Material Rule</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Material Category / Alloy Spec</th>
                    <th className="py-2.5 px-3">Scrap Factor (%)</th>
                    <th className="py-2.5 px-3">Handling Markup (%)</th>
                    <th className="py-2.5 px-3">Freight Inward (₹/kg)</th>
                    <th className="py-2.5 px-3">Total Landed Add-on</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {template.materialMarkups.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={m.category}
                          onChange={e => {
                            const updated = [...template.materialMarkups];
                            updated[idx].category = e.target.value;
                            handleUpdateMaterials(updated);
                          }}
                          className="w-full min-w-[240px] px-2 py-1 font-semibold text-slate-900 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={m.scrapFactorPercent}
                            onChange={e => {
                              const updated = [...template.materialMarkups];
                              updated[idx].scrapFactorPercent = parseFloat(e.target.value) || 0;
                              handleUpdateMaterials(updated);
                            }}
                            className="w-16 px-1.5 py-1 font-bold text-slate-900 border border-slate-300 rounded text-xs"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={m.handlingMarkupPercent}
                            onChange={e => {
                              const updated = [...template.materialMarkups];
                              updated[idx].handlingMarkupPercent = parseFloat(e.target.value) || 0;
                              handleUpdateMaterials(updated);
                            }}
                            className="w-16 px-1.5 py-1 text-slate-800 border border-slate-300 rounded text-xs"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={m.freightPerKg || 0}
                            onChange={e => {
                              const updated = [...template.materialMarkups];
                              updated[idx].freightPerKg = parseFloat(e.target.value) || 0;
                              handleUpdateMaterials(updated);
                            }}
                            className="w-16 px-1.5 py-1 text-slate-800 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-sky-700">
                        +{m.scrapFactorPercent + m.handlingMarkupPercent}%
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => removeMaterialRule(m.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. SUBCONTRACTING / OUTSIDE PROCESSING BUILDER */}
        {activeTab === 'subcontract' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide">
                  Subcontracting & Special Outsourced Operations
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Heat treatment, surface electroplating, powder coating, and NDT inspection with vendor handling markups and turnaround lead times.
                </p>
              </div>
              <button
                onClick={addSubcontractRule}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              >
                <Plus className="h-3.5 w-3.5 text-sky-400" />
                <span>Add Subcontract Process</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Process / Treatment</th>
                    <th className="py-2.5 px-3">Pricing Basis</th>
                    <th className="py-2.5 px-3">Vendor Rate (₹)</th>
                    <th className="py-2.5 px-3">Handling Markup (%)</th>
                    <th className="py-2.5 px-3">Turnaround (Days)</th>
                    <th className="py-2.5 px-3">Preferred Vendor</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {template.subcontractingRules.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={s.processName}
                          onChange={e => {
                            const updated = [...template.subcontractingRules];
                            updated[idx].processName = e.target.value;
                            handleUpdateSubcontract(updated);
                          }}
                          className="w-full min-w-[220px] px-2 py-1 font-semibold text-slate-900 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={s.pricingBasis}
                          onChange={e => {
                            const updated = [...template.subcontractingRules];
                            updated[idx].pricingBasis = e.target.value as SubcontractPricingBasis;
                            handleUpdateSubcontract(updated);
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-700"
                        >
                          <option value="per_kg">Per Kg</option>
                          <option value="per_piece">Per Piece</option>
                          <option value="per_sq_meter">Per Sq. Meter</option>
                          <option value="fixed_batch_charge">Fixed Batch Charge</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={s.baseRate}
                            onChange={e => {
                              const updated = [...template.subcontractingRules];
                              updated[idx].baseRate = parseFloat(e.target.value) || 0;
                              handleUpdateSubcontract(updated);
                            }}
                            className="w-20 px-1.5 py-1 font-bold text-slate-900 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={s.handlingMarkupPercent}
                            onChange={e => {
                              const updated = [...template.subcontractingRules];
                              updated[idx].handlingMarkupPercent = parseFloat(e.target.value) || 0;
                              handleUpdateSubcontract(updated);
                            }}
                            className="w-16 px-1.5 py-1 text-slate-800 border border-slate-300 rounded text-xs"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="1"
                            value={s.standardLeadTimeDays}
                            onChange={e => {
                              const updated = [...template.subcontractingRules];
                              updated[idx].standardLeadTimeDays = parseInt(e.target.value, 10) || 1;
                              handleUpdateSubcontract(updated);
                            }}
                            className="w-14 px-1.5 py-1 text-slate-800 border border-slate-300 rounded text-xs"
                          />
                          <span className="text-slate-400 text-[10px]">days</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={s.preferredVendorName || ''}
                          onChange={e => {
                            const updated = [...template.subcontractingRules];
                            updated[idx].preferredVendorName = e.target.value;
                            handleUpdateSubcontract(updated);
                          }}
                          placeholder="Vendor Name"
                          className="w-full px-2 py-1 text-slate-700 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => removeSubcontractRule(s.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. OVERHEADS, MARGINS & VOLUME DISCOUNTS BUILDER */}
        {activeTab === 'overheads' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wide">
                Factory Overheads, Commercial Margins & Pricing Guardrails
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Indirect cost allocations, baseline profit expectations, emergency rush job premiums, and tiered volume price breaks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Factory Overhead */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-slate-700">
                    Factory General Overhead
                  </label>
                  <span className="font-mono font-bold text-sky-700 text-sm">
                    {template.overheads.factoryOverheadPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={template.overheads.factoryOverheadPercent}
                  onChange={e => {
                    handleUpdateOverheads({
                      ...template.overheads,
                      factoryOverheadPercent: parseInt(e.target.value, 10)
                    });
                  }}
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  Applied directly on internal manufacturing (materials, machining, and shopfloor labor) for plant rent, supervisory staff, and indirect consumables.
                </p>
              </div>

              {/* Administrative Overhead */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-slate-700">
                    Admin & Sales Overhead
                  </label>
                  <span className="font-mono font-bold text-sky-700 text-sm">
                    {template.overheads.adminSalesOverheadPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={template.overheads.adminSalesOverheadPercent}
                  onChange={e => {
                    handleUpdateOverheads({
                      ...template.overheads,
                      adminSalesOverheadPercent: parseInt(e.target.value, 10)
                    });
                  }}
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  Applied on total manufacturing cost for office admin, sales operations, logistics coordination, and finance expenses.
                </p>
              </div>

              {/* Default Target Margin */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-emerald-900">
                    Default Target Profit Margin
                  </label>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {template.overheads.defaultMarginPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="1"
                  value={template.overheads.defaultMarginPercent}
                  onChange={e => {
                    handleUpdateOverheads({
                      ...template.overheads,
                      defaultMarginPercent: parseInt(e.target.value, 10)
                    });
                  }}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-600">
                  Baseline net profit margin applied to every quote generated under this cost template.
                </p>
              </div>

              {/* Rush Order Premium */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-amber-900">
                    Rush Priority Surcharge
                  </label>
                  <span className="font-mono font-bold text-amber-800 text-sm">
                    +{template.overheads.rushOrderPremiumPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={template.overheads.rushOrderPremiumPercent}
                  onChange={e => {
                    handleUpdateOverheads({
                      ...template.overheads,
                      rushOrderPremiumPercent: parseInt(e.target.value, 10)
                    });
                  }}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-600">
                  Automatically added when customer requests expedited emergency turnaround.
                </p>
              </div>
            </div>

            {/* Minimum Order Value */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-mono font-bold uppercase text-slate-800 block">
                  Minimum Order Value (MOV) Guardrail
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Small-batch orders below this threshold will be rounded up to cover machine setup and tooling changeover costs.
                </p>
              </div>
              <div className="flex items-center space-x-2 font-mono">
                <span className="text-sm font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={template.overheads.minOrderValue}
                  onChange={e => {
                    handleUpdateOverheads({
                      ...template.overheads,
                      minOrderValue: parseFloat(e.target.value) || 0
                    });
                  }}
                  className="w-32 px-3 py-1.5 font-bold text-sm text-slate-900 border border-slate-300 rounded-lg text-right"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Version Modal ───────────────────────────────────────────── */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-scale-up">
            <h3 className="text-base font-bold text-slate-900 font-display uppercase tracking-wide">
              Create Versioned Cost Revision
            </h3>
            <p className="text-xs text-slate-500">
              Preserve historical accuracy for previous quotes while publishing an updated cost structure for future estimations.
            </p>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                Version Release Notes *
              </label>
              <textarea
                rows={3}
                required
                value={changeLogText}
                onChange={e => setChangeLogText(e.target.value)}
                placeholder="e.g. Revised CNC machinist hourly wages by 8% and updated power tariffs for Q4 2026."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isMajor"
                checked={isMajorVersion}
                onChange={e => setIsMajorVersion(e.target.checked)}
                className="h-4 w-4 rounded text-sky-600 accent-sky-600 cursor-pointer"
              />
              <label htmlFor="isMajor" className="text-xs text-slate-700 font-medium cursor-pointer">
                Major Version Release (e.g. v2.1 → v3.0)
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onCreateNewVersion(changeLogText, isMajorVersion);
                  setShowVersionModal(false);
                  setChangeLogText('');
                }}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Publish New Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clone Modal ─────────────────────────────────────────────── */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-scale-up">
            <h3 className="text-base font-bold text-slate-900 font-display uppercase tracking-wide">
              Clone Costing Template
            </h3>
            <p className="text-xs text-slate-500">
              Create a new independent costing profile branch starting with version v1.0.
            </p>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                New Template Title *
              </label>
              <input
                type="text"
                required
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloneModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDuplicateTemplate(cloneName);
                  setShowCloneModal(false);
                }}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold rounded-lg cursor-pointer shadow-xs"
              >
                Clone Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
