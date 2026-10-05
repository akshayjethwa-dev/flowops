// src/pages/settings/ProductionStagesPage.tsx

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProductionStagesConfig } from '../../hooks/useProductionStagesConfig';
import { 
  Sliders, 
  CheckCircle2, 
  ChevronRight, 
  Settings, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  AlertTriangle, 
  Lock,
  Factory
} from 'lucide-react';

const PRESET_COLORS = [
  { value: 'indigo', label: 'Indigo Accent' },
  { value: 'blue', label: 'Blue Sky' },
  { value: 'amber', label: 'Amber Flame' },
  { value: 'purple', label: 'Purple Plum' },
  { value: 'pink', label: 'Rose Pink' },
  { value: 'green', label: 'Green Forest' },
  { value: 'orange', label: 'Orange Juice' },
  { value: 'teal', label: 'Teal Lagoon' }
];

export const ProductionStagesPage: React.FC = () => {
  const { profile } = useAuth();
  const { 
    stages, 
    loading, 
    error, 
    addStage, 
    reorderStages, 
    deleteStage,
    checkStageHasJobs,
    isAdmin 
  } = useProductionStagesConfig(profile?.tenantId);

  // Form states
  const [newStageName, setNewStageName] = useState('');
  const [selectedColor, setSelectedColor] = useState('indigo');
  const [isFinalCheckpoint, setIsFinalCheckpoint] = useState(false);

  // Operational state feedbacks
  const [formErr, setFormErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFormErr('Clearence denied. Admin privileges are required.');
      return;
    }

    if (!newStageName.trim()) {
      setFormErr('Please type a descriptive label name for this manufacturing checkpoint.');
      return;
    }

    setProcessing(true);
    setFormErr(null);
    setSuccessMsg(null);

    try {
      const res = await addStage(newStageName, selectedColor, isFinalCheckpoint);
      if (res) {
        setSuccessMsg(`Workflow milestone "${newStageName}" established.`);
        setNewStageName('');
        setIsFinalCheckpoint(false);
        // Auto-clear notification
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setFormErr('Failed to compile and append new shopstage.');
      }
    } catch (err: any) {
      setFormErr(err.message || 'Error occurred while saving stage config.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0 || !isAdmin) return;
    const items = [...stages];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    
    try {
      await reorderStages(items);
    } catch (err: any) {
      setFormErr(err.message || 'Reorder indexing conflict in Firestore.');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === stages.length - 1 || !isAdmin) return;
    const items = [...stages];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    
    try {
      await reorderStages(items);
    } catch (err: any) {
      setFormErr(err.message || 'Reorder indexing conflict in Firestore.');
    }
  };

  const handleDelete = async (stageId: string, name: string) => {
    if (!isAdmin) return;
    setFormErr(null);
    setSuccessMsg(null);

    // Warm check first
    const hasJobs = await checkStageHasJobs(stageId);
    if (hasJobs) {
      setFormErr(`Checkpoint "${name}" is busy. Active jobs are routed at this node. Reschedule all pending shopfloor lots before deletion.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to dismiss and eliminate manufacturing checkpoint "${name}"? This routing stage is irreversible.`)) {
      return;
    }

    try {
      await deleteStage(stageId);
      setSuccessMsg(`Milestone stage "${name}" dissolved.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setFormErr(err.message || 'Database deletion error.');
    }
  };

  const getColorClass = (colorName: string | undefined) => {
    switch (colorName) {
      case 'indigo': return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'blue': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'amber': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'purple': return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'pink': return 'bg-pink-50 border-pink-200 text-pink-700';
      case 'green': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'orange': return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'teal': return 'bg-teal-50 border-teal-200 text-teal-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Compiling checkpoint configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Info Banner */}
      <div className="pb-4 border-b border-slate-200">
        <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
          Process Engineering
        </span>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
          Manufacturing Checkpoints
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure shopfloor fabrication pipelines, milestone stages, NDT tests, and supervisor responsibility checkpoints.
        </p>
      </div>

      {(error || formErr) && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider font-mono">Process Blockage</h5>
            <p className="text-xs text-rose-600 mt-1 leading-relaxed">{error || formErr}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">Operations Complete</h5>
            <p className="text-xs text-emerald-600 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Primary configuration layouts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Stages list sequence */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sliders className="h-4.5 w-4.5 text-sky-600 shrink-0" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700">Sequence of Assembly Nodes</span>
            </div>
            <span className="text-[10px] font-mono text-slate-450 font-bold uppercase bg-slate-100 px-2 py-0.5 rounded">
              {stages.length} Checkpoints Active
            </span>
          </div>

          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div 
                key={stage.id}
                className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:shadow-xs transition-shadow flex items-start justify-between space-x-4"
              >
                <div className="flex items-start space-x-4 min-w-0 flex-1">
                  <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-xs font-bold font-mono text-slate-600 shrink-0 self-center">
                    {index + 1}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide truncate">{stage.name}</h4>
                      <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded uppercase font-semibold shrink-0 ${getColorClass(stage.color)}`}>
                        {stage.color || 'slate'}
                      </span>
                      {stage.isFinalStage && (
                        <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded uppercase shrink-0">
                          🏁 Final Dispatch Gate
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400">
                      stage parameter value: <strong className="font-semibold text-slate-600">{stage.id}</strong>
                    </p>
                  </div>
                </div>

                {/* Control utility column if user is an Administrator */}
                {isAdmin ? (
                  <div className="flex items-center space-x-1.5 shrink-0 self-center">
                    {/* Up control trigger */}
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title="Promote milestone sequencing"
                      className="p-1 px-1.5 border border-slate-200 hover:bg-slate-50 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    {/* Down control trigger */}
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === stages.length - 1}
                      title="Demote milestone sequencing"
                      className="p-1 px-1.5 border border-slate-200 hover:bg-slate-50 rounded text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    {/* Delete button only if occupied validation allows */}
                    <button
                      type="button"
                      onClick={() => handleDelete(stage.id, stage.name)}
                      title="Dissolve assembly node"
                      className="p-1 px-1.5 border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-600 rounded cursor-pointer ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-350 shrink-0 self-center" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls for Admin setup or info */}
        <div className="space-y-6">
          {isAdmin ? (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
              <div className="flex items-center space-x-1.5 pb-2 border-b border-slate-100">
                <Plus className="h-4 w-4 text-sky-600 shrink-0" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">Create Assembly Node</h4>
              </div>

              <form onSubmit={handleAddStage} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="stage-name-input" className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 font-mono">
                    Milestone Station Name *
                  </label>
                  <input
                    id="stage-name-input"
                    type="text"
                    required
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="e.g., Lathe Polishing Yard"
                    className="w-full text-xs h-10 px-3 border border-slate-200 bg-white rounded-md text-slate-800 focus:border-slate-400 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="stage-color-select" className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 font-mono">
                    Visual Display Color *
                  </label>
                  <select
                    id="stage-color-select"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full text-xs font-mono h-10 px-3 border border-slate-200 bg-white rounded-md text-slate-800 focus:border-slate-400 focus:outline-hidden"
                  >
                    {PRESET_COLORS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2.5 pt-1.5 pb-1">
                  <input
                    type="checkbox"
                    id="is-final-chk"
                    checked={isFinalCheckpoint}
                    onChange={(e) => setIsFinalCheckpoint(e.target.checked)}
                    className="h-4 w-4 border-slate-200 text-sky-600 rounded focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="is-final-chk" className="text-[11px] font-bold uppercase tracking-wide text-slate-700 font-mono cursor-pointer">
                    🏁 This is the final dispatch checkpoint
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider h-11 rounded flex items-center justify-center transition-colors cursor-pointer"
                >
                  {processing ? 'Constructing station...' : 'Commit Checkpoint Node'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-rose-220">
                <Lock className="h-4 w-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Locked Workspace</h4>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 font-mono">
                Your role does not possess the shopfloor permissions required to alter the manufacturing pipeline sequence of assembly nodes. Contact an administrator to submit a reconfiguration request.
              </p>
            </div>
          )}

          {/* Operational guidelines informational card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3.5">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
              <Settings className="h-4 w-4 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Operations Rule</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Advancing checkstages inside the <strong>Production Monitor</strong> automatically triggers corresponding outward WhatsApp push notifications to the verified purchasing dealer!
            </p>

            <div className="p-3 bg-sky-50 border border-sky-100 rounded text-[11px] text-sky-850 leading-relaxed font-sans">
              <span className="font-bold block text-sky-955 mb-1">💡 Flexible Assembly Routing</span>
              Custom checkpoints established here will dynamically populate as columns across your active shopfloor kanban-style production board!
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
