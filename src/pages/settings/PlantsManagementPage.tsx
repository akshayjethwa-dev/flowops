// src/pages/settings/PlantsManagementPage.tsx

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Layers, 
  ShieldCheck, 
  Radio, 
  Building,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../firebaseErrors';

export interface PlantFacility {
  id: string;
  name: string;
  address: string;
  gstin?: string;
  preset: 'forging' | 'foundry' | 'assembly';
  presetLabel: string;
  checkpointsCount: number;
  isActiveScope?: boolean;
  createdAt: string;
}

const DEFAULT_PLANTS: PlantFacility[] = [
  {
    id: 'plant_main_01',
    name: 'Elecon Main Unit',
    address: 'Industrial Area Phase 2, Chikhli, Pune, MH',
    gstin: '27AADCA1112B1Z1',
    preset: 'forging',
    presetLabel: 'Forging Preset',
    checkpointsCount: 6,
    isActiveScope: true,
    createdAt: new Date().toISOString()
  }
];

export const PlantsManagementPage: React.FC = () => {
  const { tenant, isSandboxMode } = useAuth();
  const tenantId = tenant?.id || 'sandbox_tenant';

  const [plants, setPlants] = useState<PlantFacility[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [plantName, setPlantName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [preset, setPreset] = useState<'forging' | 'foundry' | 'assembly'>('forging');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeScopeId, setActiveScopeId] = useState<string>('plant_main_01');

  // Load plants on mount
  useEffect(() => {
    loadPlants();
  }, [tenantId]);

  const loadPlants = async () => {
    setLoading(true);
    setErrorMessage(null);
    const storageKey = `flowops_plants_${tenantId}`;
    try {
      if (isSandboxMode || !db) {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlants(parsed);
            const active = parsed.find(p => p.isActiveScope);
            if (active) setActiveScopeId(active.id);
          } else {
            setPlants(DEFAULT_PLANTS);
            localStorage.setItem(storageKey, JSON.stringify(DEFAULT_PLANTS));
          }
        } else {
          setPlants(DEFAULT_PLANTS);
          localStorage.setItem(storageKey, JSON.stringify(DEFAULT_PLANTS));
        }
      } else {
        const tenantDocRef = doc(db, 'tenants', tenantId);
        const snap = await getDoc(tenantDocRef);
        if (snap.exists() && snap.data().plants) {
          const fetchedPlants: PlantFacility[] = snap.data().plants;
          setPlants(fetchedPlants);
          const active = fetchedPlants.find(p => p.isActiveScope);
          if (active) setActiveScopeId(active.id);
        } else {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            setPlants(JSON.parse(cached));
          } else {
            setPlants(DEFAULT_PLANTS);
            localStorage.setItem(storageKey, JSON.stringify(DEFAULT_PLANTS));
          }
        }
      }
    } catch (err) {
      console.error('Error loading plants:', err);
      setPlants(DEFAULT_PLANTS);
    } finally {
      setLoading(false);
    }
  };

  const savePlantsList = async (newList: PlantFacility[]) => {
    const storageKey = `flowops_plants_${tenantId}`;

    if (!isSandboxMode && db && tenantId) {
      try {
        const tenantDocRef = doc(db, 'tenants', tenantId);
        await setDoc(tenantDocRef, { plants: newList }, { merge: true });
      } catch (err) {
        // Bubble up error to handler for unified display
        handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}`);
        throw err; 
      }
    }
    
    // Set local state only if DB write succeeded (or if in sandbox mode)
    setPlants(newList);
    localStorage.setItem(storageKey, JSON.stringify(newList));
  };

  const handleRegisterPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantName.trim() || !address.trim()) return;

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const rawName = plantName.trim();

    // Check if duplicate or similar plant exists
    const nameExists = plants.some(p => p.name.toLowerCase().trim() === rawName.toLowerCase());
    
    if (nameExists) {
      setErrorMessage('Failed to register the plant. Check if a similar name exists.');
      setIsSubmitting(false);
      return;
    }

    const presetLabels = {
      forging: 'Forging Preset',
      foundry: 'Foundry Preset',
      assembly: 'Custom Assembly Preset'
    };

    const newPlant: PlantFacility = {
      id: `plant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: rawName,
      address: address.trim(),
      // FIX: Ensure we save an empty string instead of undefined so Firestore doesn't crash
      gstin: gstin.trim(), 
      preset,
      presetLabel: presetLabels[preset],
      checkpointsCount: preset === 'assembly' ? 4 : 6,
      isActiveScope: plants.length === 0,
      createdAt: new Date().toISOString()
    };

    try {
      const updated = [...plants, newPlant];
      await savePlantsList(updated);

      setPlantName('');
      setAddress('');
      setGstin('');
      setSuccessMessage(`Plant facility "${rawName}" successfully registered & integrated into infrastructure.`);
      setTimeout(() => setSuccessMessage(null), 6000);
      
    } catch (err: any) {
      console.error('Error adding plant facility:', err);
      let displayMsg = err.message || 'Failed to register the plant.';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
           displayMsg = parsed.error;
        }
      } catch (e) {
        // Leave displayMsg as-is
      }
      setErrorMessage(displayMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActiveScope = async (plantId: string) => {
    const updated = plants.map(p => ({
      ...p,
      isActiveScope: p.id === plantId
    }));
    try {
      await savePlantsList(updated);
      setActiveScopeId(plantId);
    } catch (err) {
      console.error('Error setting active scope', err);
    }
  };

  const handleDeletePlant = async (plantId: string) => {
    if (plants.length <= 1) {
      alert('You must maintain at least one active plant facility in your workspace.');
      return;
    }
    
    const updated = plants.filter(p => p.id !== plantId);
    if (!updated.some(p => p.isActiveScope)) {
      updated[0].isActiveScope = true;
      setActiveScopeId(updated[0].id);
    }
    
    try {
      await savePlantsList(updated);
    } catch (err) {
      console.error('Error deleting plant', err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-rose-600 uppercase font-bold mb-1">
            <Building2 className="h-3.5 w-3.5" />
            <span>Enterprise Logistics & Nodes</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Manage Plants & Facilities
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Establish and orchestrate multi-plant dispatch yards, assign production workflows, and toggle active workspace scopes.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <ShieldCheck className="h-3 w-3 text-slate-500" />
            <span>DB ISOLATION GUARD ACTIVE</span>
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h5 className="font-semibold text-emerald-900 font-mono uppercase">Plant Registered Successfully</h5>
            <p className="mt-0.5 text-emerald-700 leading-relaxed">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h5 className="font-semibold text-rose-900 font-mono uppercase">Operations Alert</h5>
            <p className="mt-0.5 text-rose-700 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Infrastructure List vs Registration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Active Plant Infrastructure List (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
              <span>Active Plant Infrastructure ({plants.length})</span>
            </h3>
            <button
              onClick={loadPlants}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh infrastructure list"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-mono">
              Syncing active plant nodes...
            </div>
          ) : plants.length === 0 ? (
            <div className="p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-2">
              <Building className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium text-slate-600">No registered plant facilities found.</p>
              <p className="text-[11px] text-slate-400">Use the registration panel on the right to onboard your first facility.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {plants.map((plant) => (
                <div
                  key={plant.id}
                  className={`p-5 rounded-xl border transition-all ${
                    plant.isActiveScope 
                      ? 'bg-white border-rose-300 shadow-sm ring-1 ring-rose-500/20' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-slate-900">{plant.name}</h4>
                        {plant.isActiveScope && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                            Active Scope
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{plant.address}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {plant.gstin && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                            GSTIN: {plant.gstin}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 flex items-center space-x-1">
                          <Layers className="h-3 w-3 text-slate-500" />
                          <span>{plant.presetLabel} ({plant.checkpointsCount} stages)</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {!plant.isActiveScope && (
                        <button
                          onClick={() => handleSetActiveScope(plant.id)}
                          className="px-2.5 py-1 text-[10px] font-mono font-bold text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-all cursor-pointer"
                        >
                          Set Active Scope
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePlant(plant.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete plant facility"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Register New Plant Form Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-mono tracking-wider text-slate-900 uppercase">
                Register New Plant
              </h3>
              <p className="text-[11px] text-slate-500">Onboard a secondary unit or dispatch yard</p>
            </div>
          </div>

          <form onSubmit={handleRegisterPlant} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 mb-1">
                Plant Facility Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Unit 1"
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-hidden transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Branded title of the physical plant (appears in dispatch sheets)
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 mb-1">
                Physical Site Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Anand Industrial Estate, Gujarat"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-hidden transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Full street address for transport logistics mapping
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 mb-1">
                Facility GSTIN (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 33AAACB1234F1Z3"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-hidden transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Plant-specific GSTIN if separate from company baseline
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 mb-2">
                Production Stages Preset <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                {/* Forging Preset */}
                <div
                  onClick={() => setPreset('forging')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    preset === 'forging'
                      ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-500/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Layers className="h-3.5 w-3.5 text-rose-600" />
                      <span>Forging Preset</span>
                    </span>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      preset === 'forging' ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300'
                    }`}>
                      {preset === 'forging' && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    6 checkpoints: Material Cutting, Heating, CNC Machining, Assembly, QC, Dispatch.
                  </p>
                </div>

                {/* Foundry Preset */}
                <div
                  onClick={() => setPreset('foundry')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    preset === 'foundry'
                      ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-500/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Layers className="h-3.5 w-3.5 text-rose-600" />
                      <span>Foundry Preset</span>
                    </span>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      preset === 'foundry' ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300'
                    }`}>
                      {preset === 'foundry' && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    6 checkpoints: Raw Material, Casting, Fettling, Heat Treatment, NDT, Ready.
                  </p>
                </div>

                {/* Custom Assembly */}
                <div
                  onClick={() => setPreset('assembly')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    preset === 'assembly'
                      ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-500/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Layers className="h-3.5 w-3.5 text-rose-600" />
                      <span>Custom Assembly Preset</span>
                    </span>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      preset === 'assembly' ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300'
                    }`}>
                      {preset === 'assembly' && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    4 checkpoints: Components Inbound, Sub-Assembly, Final Inspection, Packing.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !plantName.trim() || !address.trim()}
              className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-mono text-xs uppercase font-bold tracking-wider py-3 rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <span>Registering Plant...</span>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Register Plant Facility</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};