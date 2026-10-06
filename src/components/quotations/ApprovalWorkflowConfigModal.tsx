// src/components/quotations/ApprovalWorkflowConfigModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  QuoteApprovalWorkflowConfig, 
  QuoteApprovalRule, 
  DEFAULT_APPROVAL_CONFIG 
} from '../../types/quoteApproval';
import { 
  getApprovalWorkflowConfig, 
  saveApprovalWorkflowConfig 
} from '../../services/quoteApprovalService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { 
  X, 
  Sliders, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  AlertCircle, 
  Check, 
  Info,
  DollarSign,
  Percent,
  Layers,
  HelpCircle
} from 'lucide-react';

interface ApprovalWorkflowConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: QuoteApprovalWorkflowConfig) => void;
}

export const ApprovalWorkflowConfigModal: React.FC<ApprovalWorkflowConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [config, setConfig] = useState<QuoteApprovalWorkflowConfig>(DEFAULT_APPROVAL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !tenant?.id) return;

    setLoading(true);
    getApprovalWorkflowConfig(tenant.id)
      .then(cfg => {
        setConfig(cfg);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading approval config:', err);
        setConfig({ ...DEFAULT_APPROVAL_CONFIG, tenantId: tenant.id });
        setLoading(false);
      });
  }, [isOpen, tenant?.id]);

  if (!isOpen) return null;

  // Handle rule modifications
  const handleRuleChange = (index: number, field: keyof QuoteApprovalRule, value: any) => {
    const updatedRules = [...config.rules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    setConfig({ ...config, rules: updatedRules });
  };

  // Add rule tier
  const handleAddRule = () => {
    const nextLevel = config.rules.length + 1;
    const newRule: QuoteApprovalRule = {
      id: `rule-tier-${Date.now()}`,
      name: `Level ${nextLevel} Commercial Review`,
      minAmount: 150000,
      maxDiscountPercent: 20,
      requiredRole: 'management',
      approverTitle: 'Director',
      level: nextLevel,
      description: 'Custom threshold approval rule'
    };
    setConfig({ ...config, rules: [...config.rules, newRule] });
  };

  // Remove rule
  const handleRemoveRule = (index: number) => {
    if (config.rules.length <= 1) {
      toastInfo('Minimum Required', 'At least one baseline rule must remain in the workflow.');
      return;
    }
    const filtered = config.rules.filter((_, i) => i !== index);
    setConfig({ ...config, rules: filtered });
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    if (window.confirm('Reset all approval rules and thresholds to industrial defaults?')) {
      setConfig({ ...DEFAULT_APPROVAL_CONFIG, tenantId: tenant?.id || 'default' });
      toastInfo('Reset', 'Default thresholds restored. Click Save to persist.');
    }
  };

  // Save
  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await saveApprovalWorkflowConfig(tenant.id, config, profile?.uid);
      toastSuccess('Approval Rules Updated!', 'Commercial value thresholds successfully persisted across all quote drafts.');
      if (onConfigSaved) onConfigSaved(config);
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to save approval rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-in font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 border border-sky-500/20">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900 leading-none">
                Quote Approval Workflow Configuration
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Define value thresholds (e.g. &gt;₹1L needs Director authorization) to prevent unauthorized discounts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-450 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* Global Policy Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <div>
                <span className="font-bold text-slate-900 block">Enable Approval Enforcement</span>
                <span className="text-slate-500 text-[11px] leading-tight block">
                  Automatically intercept high-value or discounted quotes for supervisor sign-off.
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.preventUnauthorizedDispatch}
                onChange={(e) => setConfig({ ...config, preventUnauthorizedDispatch: e.target.checked })}
                className="mt-1 h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <div>
                <span className="font-bold text-slate-900 block">Block Unapproved PDF Dispatch</span>
                <span className="text-slate-500 text-[11px] leading-tight block">
                  Prevents staff from downloading clean PDFs or texting quotes via WhatsApp until signed off.
                </span>
              </div>
            </label>
          </div>

          {/* Rules / Thresholds Matrix */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-sky-600" />
                <span>Multi-Level Commercial Threshold Rules ({config.rules.length})</span>
              </h4>

              <button
                type="button"
                onClick={handleAddRule}
                className="text-xs font-mono font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Tier Rule</span>
              </button>
            </div>

            <div className="space-y-3">
              {config.rules.map((rule, idx) => (
                <div 
                  key={rule.id || idx}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-3xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700">
                        Tier Level {rule.level || idx + 1}
                      </span>
                      <input
                        type="text"
                        value={rule.name}
                        onChange={(e) => handleRuleChange(idx, 'name', e.target.value)}
                        placeholder="Rule Name (e.g. Director Approval)"
                        className="font-bold text-slate-900 text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200 min-w-[240px] focus:bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                      title="Remove Rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Thresholds Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block mb-1">
                        Min Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={rule.minAmount}
                        onChange={(e) => handleRuleChange(idx, 'minAmount', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-xs focus:bg-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block mb-1">
                        Max Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={rule.maxAmount || ''}
                        onChange={(e) => handleRuleChange(idx, 'maxAmount', e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-xs focus:bg-white"
                        placeholder="No Upper Bound"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block mb-1">
                        Max Discount %
                      </label>
                      <input
                        type="number"
                        value={rule.maxDiscountPercent || ''}
                        onChange={(e) => handleRuleChange(idx, 'maxDiscountPercent', e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-xs focus:bg-white"
                        placeholder="e.g. 15%"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block mb-1">
                        Required Role
                      </label>
                      <select
                        value={rule.requiredRole}
                        onChange={(e) => handleRuleChange(idx, 'requiredRole', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-xs focus:bg-white"
                      >
                        <option value="sales">Sales Engineer</option>
                        <option value="manager">Sales Manager</option>
                        <option value="management">Director / Management</option>
                        <option value="admin">Managing Director (Admin)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={rule.approverTitle}
                        onChange={(e) => handleRuleChange(idx, 'approverTitle', e.target.value)}
                        placeholder="Approver Title (e.g. Commercial Director)"
                        className="w-full bg-slate-50/70 border border-slate-200 rounded px-2 py-1 text-xs focus:bg-white"
                      />
                    </div>
                    <div className="flex-2">
                      <input
                        type="text"
                        value={rule.description}
                        onChange={(e) => handleRuleChange(idx, 'description', e.target.value)}
                        placeholder="Rule Description / Guidance"
                        className="w-full bg-slate-50/70 border border-slate-200 rounded px-2 py-1 text-xs focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-mono text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-mono font-bold hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
            >
              {saving ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save Approval Rules</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
