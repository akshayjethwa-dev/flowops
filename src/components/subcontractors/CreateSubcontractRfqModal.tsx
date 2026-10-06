// src/components/subcontractors/CreateSubcontractRfqModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Calendar, 
  Clock, 
  Layers, 
  FileText, 
  Check, 
  Building2, 
  Tag, 
  DollarSign,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { 
  Subcontractor, 
  SubcontractRfq, 
  SubcontractOperationCategory, 
  SUBCONTRACT_CATEGORIES 
} from '../../types/subcontractor';
import { 
  generateNextSubcontractRfqNumber, 
  createSubcontractRfq 
} from '../../services/subcontractorService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface CreateSubcontractRfqModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcontractors: Subcontractor[];
  initialCategory?: SubcontractOperationCategory;
  initialJobName?: string;
  initialPartName?: string;
  initialQuantity?: number;
  initialOrderNumber?: string;
  onRfqCreated: (createdRfq: SubcontractRfq) => void;
}

export const CreateSubcontractRfqModal: React.FC<CreateSubcontractRfqModalProps> = ({
  isOpen,
  onClose,
  subcontractors,
  initialCategory = 'heat_treatment',
  initialJobName,
  initialPartName,
  initialQuantity,
  initialOrderNumber,
  onRfqCreated
}) => {
  const { tenant, profile, isSandboxMode } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [rfqNumber, setRfqNumber] = useState('');
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SubcontractOperationCategory>(initialCategory);
  
  // Item specifics
  const [partName, setPartName] = useState('');
  const [materialGrade, setMaterialGrade] = useState('EN19 Normalized / 4140');
  const [quantity, setQuantity] = useState<number>(50);
  const [unit, setUnit] = useState('pcs');
  const [drawingRef, setDrawingRef] = useState('');
  const [specsAndNotes, setSpecsAndNotes] = useState('');
  const [targetUnitPrice, setTargetUnitPrice] = useState<string>('');

  // Linked Job/Order reference
  const [linkedOrderNumber, setLinkedOrderNumber] = useState(initialOrderNumber || '');
  const [linkedJobName, setLinkedJobName] = useState(initialJobName || '');

  // Dates
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState(
    new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [quoteDeadlineDate, setQuoteDeadlineDate] = useState(
    new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Target Subcontractor selection
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Initialize RFQ Number & prefill
  useEffect(() => {
    if (isOpen && tenant?.id) {
      setLoadingNumber(true);
      generateNextSubcontractRfqNumber(tenant.id, isSandboxMode)
        .then(nextNo => {
          setRfqNumber(nextNo);
          setLoadingNumber(false);
        })
        .catch(() => {
          setRfqNumber(`SRFQ-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
          setLoadingNumber(false);
        });

      if (initialCategory) setCategory(initialCategory);
      if (initialPartName) setPartName(initialPartName);
      if (initialQuantity) setQuantity(initialQuantity);
      if (initialJobName) setLinkedJobName(initialJobName);
      if (initialOrderNumber) setLinkedOrderNumber(initialOrderNumber);

      const defTitle = initialPartName 
        ? `${SUBCONTRACT_CATEGORIES.find(c => c.id === (initialCategory || category))?.label || 'Outsourced Operation'} for ${initialPartName}`
        : '';
      setTitle(defTitle);
    }
  }, [isOpen, tenant?.id, initialCategory, initialPartName, initialQuantity, initialJobName, initialOrderNumber, isSandboxMode]);

  // When category changes, auto-select all matching certified vendors in that category
  useEffect(() => {
    const matching = subcontractors.filter(s => s.categories.includes(category) && s.status !== 'inactive');
    setSelectedSubIds(matching.map(s => s.id));
    if (!title || title.includes('for')) {
      const catLabel = SUBCONTRACT_CATEGORIES.find(c => c.id === category)?.label || 'Outsourced Process';
      setTitle(`${catLabel} for ${partName || 'Machined Parts'}`);
    }
  }, [category, subcontractors]);

  if (!isOpen) return null;

  const matchingVendors = subcontractors.filter(s => s.categories.includes(category) && s.status !== 'inactive');
  const otherVendors = subcontractors.filter(s => !s.categories.includes(category) && s.status !== 'inactive');

  const toggleVendor = (id: string) => {
    if (selectedSubIds.includes(id)) {
      setSelectedSubIds(selectedSubIds.filter(v => v !== id));
    } else {
      setSelectedSubIds([...selectedSubIds, id]);
    }
  };

  const selectAllMatching = () => {
    setSelectedSubIds(matchingVendors.map(v => v.id));
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !partName.trim()) {
      toastError('Title and Part Name are required');
      return;
    }
    if (selectedSubIds.length === 0) {
      toastError('Please select at least 1 subcontractor to broadcast RFQ');
      return;
    }
    if (!tenant?.id || !profile) return;

    setSubmitting(true);
    try {
      const created = await createSubcontractRfq({
        tenantId: tenant.id,
        rfqData: {
          tenantId: tenant.id,
          title: title.trim(),
          operationCategory: category,
          linkedOrderNumber: linkedOrderNumber.trim() || undefined,
          linkedJobName: linkedJobName.trim() || undefined,
          items: [
            {
              id: `item_${Date.now()}`,
              partName: partName.trim(),
              materialGrade: materialGrade.trim(),
              quantity: Number(quantity) || 1,
              unit: unit.trim() || 'pcs',
              drawingRef: drawingRef.trim() || undefined,
              specsAndNotes: specsAndNotes.trim() || 'Process as per standard workshop specification drawing.',
              targetUnitPrice: targetUnitPrice ? parseFloat(targetUnitPrice) : undefined
            }
          ],
          invitedSubcontractorIds: selectedSubIds,
          status: 'broadcasted',
          requiredDeliveryDate,
          quoteDeadlineDate,
          specialInstructions: specialInstructions.trim() || undefined,
          createdBy: profile.uid,
          createdByName: profile.name || profile.email || 'Procurement Lead'
        },
        subcontractors,
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Procurement Lead',
          email: profile.email
        },
        isSandboxMode,
        autoBroadcast: true
      });

      toastSuccess(
        `RFQ #${created.rfqNumber} Broadcasted!`,
        `Outsourced RFQ pushed to ${selectedSubIds.length} subcontractors via WhatsApp & Email notification.`
      );
      onRfqCreated(created);
      onClose();
    } catch (err: any) {
      toastError('Broadcast failed: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold bg-indigo-950/60 border border-indigo-800/80 px-2 py-0.5 rounded">
                  Outsourced Process RFQ
                </span>
                <span className="text-[11px] font-mono text-slate-400">{rfqNumber || 'Generating #...'}</span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                Broadcast RFQ to Subcontractors
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

        {/* Scrollable Form */}
        <form id="create-srfq-form" onSubmit={handleBroadcast} className="p-6 overflow-y-auto space-y-5 text-xs font-sans flex-1">
          
          {/* Operation Process Category Pill Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
              <Tag className="h-3.5 w-3.5 text-indigo-600" />
              <span>Select Outsourced Operation / Process</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SUBCONTRACT_CATEGORIES.map(cat => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center justify-between">
                      <span>{cat.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-0.5 line-clamp-1">{cat.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RFQ Subject Title */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">
              RFQ Title / Scope Description <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Induction Hardening for 80 Spur Gears (Mod 4, 32T)"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
            />
          </div>

          {/* Component Specifications Box */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider block">
              Component & Lot Specifications
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Part / Component Name *</label>
                <input
                  type="text"
                  required
                  value={partName}
                  onChange={e => setPartName(e.target.value)}
                  placeholder="e.g. Forged Steel Spur Gear"
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Material Grade *</label>
                <input
                  type="text"
                  required
                  value={materialGrade}
                  onChange={e => setMaterialGrade(e.target.value)}
                  placeholder="e.g. EN19 / 4140, SS 304"
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-900 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600">Unit</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="lots">lots</option>
                    <option value="meters">meters</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Drawing Ref / CAD File ID</label>
                <input
                  type="text"
                  value={drawingRef}
                  onChange={e => setDrawingRef(e.target.value)}
                  placeholder="e.g. DRG-AF-GR-2026-08 (Rev B)"
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Target Budget Unit Price (₹)</label>
                <input
                  type="number"
                  value={targetUnitPrice}
                  onChange={e => setTargetUnitPrice(e.target.value)}
                  placeholder="e.g. 240 (Optional benchmark)"
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600">
                Technical Specifications, Tolerances & Heat-Treat/Plating Parameters
              </label>
              <textarea
                rows={2}
                value={specsAndNotes}
                onChange={e => setSpecsAndNotes(e.target.value)}
                placeholder="e.g. Induction Harden gear teeth to 54-58 HRC. Case depth 1.8-2.2mm. Mask central bore. No quench cracks. Inspection certificate required."
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-800 resize-none"
              />
            </div>
          </div>

          {/* Deadlines & Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>Quotation Deadline</span>
              </label>
              <input
                type="date"
                required
                value={quoteDeadlineDate}
                onChange={e => setQuoteDeadlineDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                <span>Target Return Delivery</span>
              </label>
              <input
                type="date"
                required
                value={requiredDeliveryDate}
                onChange={e => setRequiredDeliveryDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700">Linked Sales Order (Optional)</label>
              <input
                type="text"
                value={linkedOrderNumber}
                onChange={e => setLinkedOrderNumber(e.target.value)}
                placeholder="e.g. SO-2026-0001"
                className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-800"
              />
            </div>
          </div>

          {/* TARGET SUBCONTRACTORS BROADCAST SELECTION */}
          <div className="space-y-2.5 border-t border-slate-200 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-900 flex items-center space-x-1.5">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span>Target Subcontractors for Broadcast ({selectedSubIds.length} Selected)</span>
                </label>
                <p className="text-[10px] text-slate-500">
                  Select certified vendors to receive automated WhatsApp & Email RFQ packets.
                </p>
              </div>

              {matchingVendors.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllMatching}
                  className="text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                >
                  Select All Matching ({matchingVendors.length})
                </button>
              )}
            </div>

            {/* Matching Vendors in Process */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50">
              {matchingVendors.length > 0 ? (
                matchingVendors.map(sub => {
                  const isChecked = selectedSubIds.includes(sub.id);
                  return (
                    <div
                      key={sub.id}
                      onClick={() => toggleVendor(sub.id)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-white border-indigo-400 shadow-2xs' 
                          : 'bg-white/60 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 text-indigo-600 rounded border-slate-300 pointer-events-none"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">{sub.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800">
                              {sub.qualityTier} Tier
                            </span>
                            <span className="text-[10px] font-mono text-amber-600 font-bold">★ {sub.rating}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {sub.city} • Typical Lead: {sub.typicalLeadTimeDays} days
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150 font-semibold">
                        {sub.phone}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs">
                  No certified subcontractors cataloged for this category yet.
                </div>
              )}

              {/* Other Vendors option */}
              {otherVendors.length > 0 && (
                <div className="pt-2">
                  <span className="text-[9.5px] uppercase font-mono font-bold text-slate-400 block mb-1">
                    Other Workshop Vendors ({otherVendors.length})
                  </span>
                  <div className="space-y-1">
                    {otherVendors.map(sub => {
                      const isChecked = selectedSubIds.includes(sub.id);
                      return (
                        <div
                          key={sub.id}
                          onClick={() => toggleVendor(sub.id)}
                          className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer text-[11px] ${
                            isChecked ? 'bg-white border-indigo-300' : 'bg-white/40 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="h-3.5 w-3.5 text-indigo-600 rounded pointer-events-none"
                            />
                            <span className="font-medium text-slate-700">{sub.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{sub.city}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="create-srfq-form"
            disabled={submitting || loadingNumber || selectedSubIds.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-xl flex items-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <span>Broadcasting RFQ...</span>
            ) : (
              <>
                <Send className="h-4 w-4 text-indigo-200" />
                <span>Broadcast RFQ ({selectedSubIds.length} Vendors)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
