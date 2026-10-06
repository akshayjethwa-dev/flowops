// src/components/subcontractors/SubcontractorFormModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  Save, 
  Star, 
  MapPin, 
  Phone, 
  Mail, 
  Truck, 
  Clock, 
  Check, 
  ShieldCheck,
  Tag
} from 'lucide-react';
import { 
  Subcontractor, 
  SubcontractOperationCategory, 
  SUBCONTRACT_CATEGORIES 
} from '../../types/subcontractor';
import { saveSubcontractor } from '../../services/subcontractorService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface SubcontractorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  subcontractor?: Subcontractor | null;
  onSaved: (sub: Subcontractor) => void;
}

export const SubcontractorFormModal: React.FC<SubcontractorFormModalProps> = ({
  isOpen,
  onClose,
  subcontractor,
  onSaved
}) => {
  const { tenant, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [categories, setCategories] = useState<SubcontractOperationCategory[]>(['heat_treatment']);
  const [capabilitiesSummary, setCapabilitiesSummary] = useState('');
  const [rating, setRating] = useState<number>(4.5);
  const [qualityTier, setQualityTier] = useState<'A+' | 'A' | 'B' | 'Probationary'>('A');
  const [typicalLeadTimeDays, setTypicalLeadTimeDays] = useState<number>(4);
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net');
  const [transportIncluded, setTransportIncluded] = useState(false);
  const [status, setStatus] = useState<'active' | 'preferred' | 'on_hold' | 'inactive'>('preferred');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subcontractor) {
      setName(subcontractor.name || '');
      setContactPerson(subcontractor.contactPerson || '');
      setPhone(subcontractor.phone || '');
      setEmail(subcontractor.email || '');
      setCity(subcontractor.city || '');
      setAddress(subcontractor.address || '');
      setGstNumber(subcontractor.gstNumber || '');
      setCategories(subcontractor.categories || ['heat_treatment']);
      setCapabilitiesSummary(subcontractor.capabilitiesSummary || '');
      setRating(subcontractor.rating || 4.5);
      setQualityTier(subcontractor.qualityTier || 'A');
      setTypicalLeadTimeDays(subcontractor.typicalLeadTimeDays || 4);
      setPaymentTerms(subcontractor.paymentTerms || '30 Days Net');
      setTransportIncluded(!!subcontractor.transportIncluded);
      setStatus(subcontractor.status || 'preferred');
      setNotes(subcontractor.notes || '');
    } else {
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setCity('Peenya Industrial Area, Bengaluru');
      setAddress('');
      setGstNumber('');
      setCategories(['heat_treatment']);
      setCapabilitiesSummary('');
      setRating(4.5);
      setQualityTier('A');
      setTypicalLeadTimeDays(4);
      setPaymentTerms('30 Days Net');
      setTransportIncluded(false);
      setStatus('preferred');
      setNotes('');
    }
  }, [subcontractor, isOpen]);

  if (!isOpen) return null;

  const toggleCategory = (cat: SubcontractOperationCategory) => {
    if (categories.includes(cat)) {
      if (categories.length > 1) {
        setCategories(categories.filter(c => c !== cat));
      }
    } else {
      setCategories([...categories, cat]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('Vendor Name is required');
      return;
    }
    if (!tenant?.id) return;

    setSaving(true);
    try {
      const saved = await saveSubcontractor(
        tenant.id,
        {
          id: subcontractor?.id,
          name: name.trim(),
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          city: city.trim(),
          address: address.trim(),
          gstNumber: gstNumber.trim(),
          categories,
          capabilitiesSummary: capabilitiesSummary.trim(),
          rating: Number(rating),
          qualityTier,
          typicalLeadTimeDays: Number(typicalLeadTimeDays) || 3,
          paymentTerms: paymentTerms.trim(),
          transportIncluded,
          status,
          notes: notes.trim(),
          tenantId: tenant.id
        },
        isSandboxMode
      );

      toastSuccess(
        subcontractor ? 'Subcontractor Updated' : 'Subcontractor Added',
        `${saved.name} saved to vendor master directory.`
      );
      onSaved(saved);
      onClose();
    } catch (err: any) {
      toastError('Save failed: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400 font-bold block">
                Subcontractor Directory
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">
                {subcontractor ? 'Edit Subcontractor Profile' : 'Add Certified Subcontractor'}
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

        {/* Form Body */}
        <form id="subcontractor-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs font-sans flex-1">
          
          {/* Row 1: Basic Company Name & Contact Person */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                Company / Workshop Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Pragati Heat Treaters (Pvt) Ltd"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                Primary Contact Liaison
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="e.g. Suresh Nambiar (Works Mgr)"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900"
              />
            </div>
          </div>

          {/* Row 2: Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span>Phone / WhatsApp Number</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98450 12891"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <Mail className="h-3.5 w-3.5 text-sky-600" />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="orders@pragatiheattreat.in"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono text-slate-900"
              />
            </div>
          </div>

          {/* Row 3: Industrial Area & GSTIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                <MapPin className="h-3.5 w-3.5 text-rose-600" />
                <span>City / Industrial Cluster Area</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Peenya Industrial Area, Bengaluru"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                GSTIN / Tax Registration Number
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={e => setGstNumber(e.target.value.toUpperCase())}
                placeholder="29AABCP8921K1ZT"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono text-slate-900 uppercase"
              />
            </div>
          </div>

          {/* Process / Operation Categories (Multi-select pills) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
              <Tag className="h-3.5 w-3.5 text-indigo-600" />
              <span>Outsourced Operation Specializations (Select applicable)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUBCONTRACT_CATEGORIES.map(cat => {
                const isSelected = categories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capabilities Summary */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700">
              Technical Capabilities & Machine Specification Summary
            </label>
            <textarea
              rows={2}
              value={capabilitiesSummary}
              onChange={e => setCapabilitiesSummary(e.target.value)}
              placeholder="e.g. Induction hardening up to 2m length, Sealed quench furnace for case carburizing (58-62 HRC), CNC gear hobbing Mod 1 to 8..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-800 resize-none"
            />
          </div>

          {/* Row 4: Quality Tier, Rating, Lead Time, Payment Terms */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-600 uppercase">Quality Tier</label>
              <select
                value={qualityTier}
                onChange={e => setQualityTier(e.target.value as any)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold"
              >
                <option value="A+">Tier A+ (Strategic)</option>
                <option value="A">Tier A (Certified)</option>
                <option value="B">Tier B (Standard)</option>
                <option value="Probationary">Probationary</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-600 uppercase">Rating (1-5)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={rating}
                onChange={e => setRating(parseFloat(e.target.value) || 4.0)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-600 uppercase">Avg Lead Days</label>
              <input
                type="number"
                min="1"
                value={typicalLeadTimeDays}
                onChange={e => setTypicalLeadTimeDays(parseInt(e.target.value, 10) || 3)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-600 uppercase">Vendor Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold"
              >
                <option value="preferred">⭐ Preferred</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

          </div>

          {/* Row 5: Payment Terms & Transport Included */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Commercial Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                placeholder="e.g. 30 Days Net, 100% on Inspection"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800"
              />
            </div>

            <div className="pt-4 flex items-center space-x-2.5">
              <input
                type="checkbox"
                id="transport-included"
                checked={transportIncluded}
                onChange={e => setTransportIncluded(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <label htmlFor="transport-included" className="text-xs text-slate-700 font-medium cursor-pointer">
                Free pickup & drop included in standard rates
              </label>
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
            form="subcontractor-form"
            disabled={saving}
            className="bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-xl flex items-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : subcontractor ? 'Update Vendor' : 'Add to Database'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
