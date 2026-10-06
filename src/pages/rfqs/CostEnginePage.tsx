// src/pages/rfqs/CostEnginePage.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCostEngine } from '../../hooks/useCostEngine';
import { CostRuleBuilder } from '../../components/cost-engine/CostRuleBuilder';
import { InteractiveCostEstimatorModal } from '../../components/cost-engine/InteractiveCostEstimatorModal';
import { useToast } from '../../context/ToastContext';
import { 
  Sliders, 
  Calculator, 
  Sparkles, 
  History, 
  ArrowLeft, 
  Plus, 
  Copy, 
  FileCheck, 
  Info,
  CheckCircle2,
  HelpCircle,
  Percent
} from 'lucide-react';

export const CostEnginePage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const {
    templates,
    activeTemplate,
    activeTemplateId,
    setActiveTemplateId,
    saveTemplate,
    setDefaultTemplate,
    createNewVersion,
    duplicateTemplate,
    deleteTemplate
  } = useCostEngine(tenant?.id);

  const [estimatorModalOpen, setEstimatorModalOpen] = useState(false);

  // Update active template
  const handleUpdateTemplate = async (updated: any) => {
    try {
      await saveTemplate(updated);
      toastSuccess(`Updated costing rules for ${updated.name}!`);
    } catch (err: any) {
      toastError(`Failed to save template: ${err.message || err}`);
    }
  };

  // Create new version
  const handleCreateNewVersion = async (changeLog: string, isMajor: boolean) => {
    try {
      const newVer = await createNewVersion(activeTemplate, changeLog, isMajor);
      toastSuccess(`Published version ${newVer.version} for ${newVer.name}!`);
    } catch (err: any) {
      toastError(`Failed to publish version: ${err.message || err}`);
    }
  };

  // Clone template
  const handleDuplicateTemplate = async (newName: string) => {
    try {
      const cloned = await duplicateTemplate(activeTemplate, newName);
      toastSuccess(`Cloned template "${cloned.name}" as new costing profile.`);
    } catch (err: any) {
      toastError(`Failed to clone template: ${err.message || err}`);
    }
  };

  // Set default
  const handleSetDefault = async () => {
    try {
      await setDefaultTemplate(activeTemplate.id);
      toastSuccess(`Set "${activeTemplate.name}" as default costing template for quotes.`);
    } catch (err: any) {
      toastError('Could not set default template.');
    }
  };

  // Delete
  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete template "${activeTemplate.name}"?`)) {
      try {
        await deleteTemplate(activeTemplate.id);
        toastSuccess('Deleted costing template.');
      } catch (err: any) {
        toastError(err.message || 'Could not delete template.');
      }
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/rfqs')}
            className="text-xs font-mono font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1.5 mb-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to RFQs & Estimations Hub</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
              Configurable Cost Engine
            </h1>
            <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              Bottom-Up Quotation Rules
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-2xl">
            Define customized costing rules including shopfloor labor wages, Machine Hour Rates (MHR), 
            material scrap & handling buffers, outsourced subcontracting operations, and overhead allocations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setEstimatorModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Calculator className="h-4 w-4" />
            <span>Test Live Quote Calculator</span>
          </button>
        </div>
      </div>

      {/* ── Versioned Template Switcher Bar ────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono font-bold uppercase text-slate-700">
            Select Costing Profile:
          </span>
          <select
            value={activeTemplateId}
            onChange={e => setActiveTemplateId(e.target.value)}
            className="text-xs font-semibold p-2 bg-white border border-slate-300 rounded-lg min-w-[260px] text-slate-900 focus:ring-2 focus:ring-sky-500"
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.version}) {t.isDefault ? '★ [DEFAULT]' : ''}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 font-mono">
            {templates.length} Profile(s) Available
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-sans">
          <Info className="h-4 w-4 text-sky-600 shrink-0" />
          <span>Every quotation automatically tags the active template version for complete audit traceability.</span>
        </div>
      </div>

      {/* ── Cost Rule Builder Component ───────────────────────────── */}
      {activeTemplate && (
        <CostRuleBuilder
          template={activeTemplate}
          onUpdateTemplate={handleUpdateTemplate}
          onCreateNewVersion={handleCreateNewVersion}
          onDuplicateTemplate={handleDuplicateTemplate}
          onSetDefault={handleSetDefault}
          onDeleteTemplate={handleDelete}
          canDelete={templates.length > 1}
        />
      )}

      {/* ── Interactive Live Cost Estimator Modal ──────────────────── */}
      {activeTemplate && (
        <InteractiveCostEstimatorModal
          isOpen={estimatorModalOpen}
          onClose={() => setEstimatorModalOpen(false)}
          template={activeTemplate}
          onApplyToQuote={(res) => {
            // Route to RFQ Quotation editor with pre-filled line items
            navigate('/rfqs/new', {
              state: {
                prefilledItems: [
                  {
                    name: res.partName,
                    quantity: res.quantity,
                    unitPrice: res.unitPrice,
                    specs: res.specSummary
                  }
                ],
                customerName: 'Engineering Client',
                description: `Costed using Cost Engine Template: ${activeTemplate.name} (${activeTemplate.version}). Est Lead Time: ${res.breakdown.estimatedProductionLeadTimeDays}d.`
              }
            });
            toastSuccess('Injected cost-calculated line item into new RFQ Quotation form!');
          }}
        />
      )}
    </div>
  );
};
