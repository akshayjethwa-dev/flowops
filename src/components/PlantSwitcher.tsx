// src/components/PlantSwitcher.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, ChevronDown, Building2, Check } from 'lucide-react';

export const PlantSwitcher: React.FC = () => {
  const { plants, activePlantId, setActivePlantId, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Filter plants by user's assignedPlantIds (if set)
  const accessiblePlants = plants.filter(p => {
    if (!profile?.assignedPlantIds || profile.assignedPlantIds.length === 0) return true;
    return profile.assignedPlantIds.includes(p.id);
  });

  const activePlant = accessiblePlants.find(p => p.id === activePlantId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (accessiblePlants.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm"
      >
        <Building2 size={16} className="text-indigo-400" />
        <span className="font-medium text-slate-200 max-w-[160px] truncate">
          {activePlantId === 'all' ? 'All Plants' : activePlant?.name || 'Select Plant'}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
              Switch Plant
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            <button
              onClick={() => { setActivePlantId('all'); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activePlantId === 'all' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MapPin size={16} className="text-indigo-400" />
              <span className="flex-1 text-left">All Plants</span>
              {activePlantId === 'all' && <Check size={16} className="text-indigo-400" />}
            </button>
            {accessiblePlants.map(plant => (
              <button
                key={plant.id}
                onClick={() => { setActivePlantId(plant.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activePlantId === plant.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <MapPin size={16} className="text-slate-500" />
                <div className="flex-1 text-left">
                  <p className="font-medium truncate">{plant.name}</p>
                  <p className="text-xs text-slate-500 truncate">{plant.location}</p>
                </div>
                {activePlantId === plant.id && <Check size={16} className="text-indigo-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};