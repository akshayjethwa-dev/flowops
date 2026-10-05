// src/components/FilterBar.tsx

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  SlidersHorizontal, 
  Bookmark, 
  BookmarkCheck,
  PlusCircle, 
  Trash2, 
  Calendar,
  User,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, query, where, doc } from 'firebase/firestore';
import { SavedView } from '../types';

interface FilterBarProps {
  entityType: 'rfqs' | 'customers' | 'jobs' | 'dispatches';
  tenantId: string;
  currentUserId?: string;
  searchPlaceholder?: string;
  
  // Filter variables mapping & callback
  filters: Record<string, any>;
  onFilterChange: (updated: Record<string, any>) => void;
  onClearFilters: () => void;

  // Custom configuration arrays
  statusOptions: { label: string; value: string }[];
  assigneeOptions?: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  entityType,
  tenantId,
  currentUserId,
  searchPlaceholder = "Search records...",
  filters,
  onFilterChange,
  onClearFilters,
  statusOptions,
  assigneeOptions = []
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewNameInput, setViewNameInput] = useState('');
  const [showSaveViewForm, setShowSaveViewForm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const isSandboxMode = localStorage.getItem('isSandboxMode') === 'true';
  const resolvedUserId = currentUserId || auth.currentUser?.uid || 'anonymous_user';

  // Load Saved Views from Firestore or Sandbox LocalStorage
  const fetchSavedViews = async () => {
    if (isSandboxMode || !db) {
      try {
        const key = `flowops_savedviews_${tenantId}`;
        const cached = localStorage.getItem(key) || '[]';
        const parsed = JSON.parse(cached) as SavedView[];
        setSavedViews(parsed.filter(v => v.entityType === entityType));
      } catch (err) {
        console.error('Error fetching cached sandbox saved views:', err);
      }
    } else {
      try {
        const colPath = `tenants/${tenantId}/savedViews`;
        const q = query(
          collection(db, colPath), 
          where('entityType', '==', entityType),
          where('userId', '==', resolvedUserId)
        );
        const snap = await getDocs(q);
        const list: SavedView[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as SavedView);
        });
        setSavedViews(list);
      } catch (err) {
        console.warn('Firestore savedViews fetch index warning, failing gracefully:', err);
      }
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchSavedViews();
    }
  }, [tenantId, entityType, resolvedUserId]);

  const handleSaveViewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewNameInput.trim()) return;

    // Filter out unneeded blanks to save storage space
    const filtersToSave: Record<string, any> = {};
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        filtersToSave[key] = val;
      }
    }

    const newView: Omit<SavedView, 'id'> = {
      tenantId,
      userId: resolvedUserId,
      name: viewNameInput.trim(),
      entityType,
      filters: filtersToSave,
      createdAt: new Date().toISOString()
    };

    if (isSandboxMode || !db) {
      try {
        const key = `flowops_savedviews_${tenantId}`;
        const cached = localStorage.getItem(key) || '[]';
        const parsed = JSON.parse(cached) as SavedView[];
        const record = { ...newView, id: `view_${Date.now()}` } as SavedView;
        
        const updated = [record, ...parsed];
        localStorage.setItem(key, JSON.stringify(updated));
        
        setSavedViews(updated.filter(v => v.entityType === entityType));
        setViewNameInput('');
        setShowSaveViewForm(false);
        setFeedbackMsg(`Saved view "${record.name}" successfully!`);
        setTimeout(() => setFeedbackMsg(''), 3000);
      } catch (err) {
        console.error('Sandbox savedView preserve error:', err);
      }
    } else {
      try {
        const colPath = `tenants/${tenantId}/savedViews`;
        const docRef = await addDoc(collection(db, colPath), newView);
        
        setSavedViews(prev => [{ ...newView, id: docRef.id } as SavedView, ...prev]);
        setViewNameInput('');
        setShowSaveViewForm(false);
        setFeedbackMsg(`Saved view "${newView.name}" in workspace!`);
        setTimeout(() => setFeedbackMsg(''), 3000);
      } catch (err: any) {
        console.error('Firestore saveView trace error:', err);
        alert(`Failed to save cloud filter shortcut: ${err.message}`);
      }
    }
  };

  const handleDeleteView = async (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    const conf = window.confirm('Are you sure you want to delete this saved filter configuration shortcut?');
    if (!conf) return;

    if (isSandboxMode || !db) {
      try {
        const key = `flowops_savedviews_${tenantId}`;
        const cached = localStorage.getItem(key) || '[]';
        let parsed = JSON.parse(cached) as SavedView[];
        parsed = parsed.filter(v => v.id !== viewId);
        localStorage.setItem(key, JSON.stringify(parsed));
        setSavedViews(parsed.filter(v => v.entityType === entityType));
      } catch (err) {
        console.error('Sandbox savedView delete error:', err);
      }
    } else {
      try {
        const docRef = doc(db, `tenants/${tenantId}/savedViews/${viewId}`);
        await deleteDoc(docRef);
        setSavedViews(prev => prev.filter(v => v.id !== viewId));
      } catch (err) {
        console.error('Firestore view wipe failed:', err);
      }
    }
  };

  const handleApplyView = (view: SavedView) => {
    // Merge baseline and update state
    onFilterChange({ ...view.filters });
    setFeedbackMsg(`Loaded shortcut: "${view.name}"`);
    setTimeout(() => setFeedbackMsg(''), 2500);
  };

  const handleInputChange = (field: string, value: any) => {
    onFilterChange({
      ...filters,
      [field]: value
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(([k, v]) => v !== undefined && v !== null && v !== '' && v !== 'all' && k !== 'search').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-4 shadow-3xs font-sans">
      
      {/* Primary line: Keyword, Save View trigger, expanders */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 select-none">
        
        {/* keyword bar */}
        <div className="relative flex-grow">
          <input
            type="text"
            className="w-full text-xs font-mono border border-slate-220 rounded-lg pl-9 pr-8 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-sky-500 text-slate-800"
            placeholder={searchPlaceholder}
            value={filters.search || ''}
            onChange={(e) => handleInputChange('search', e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          {filters.search && (
            <button 
              onClick={() => handleInputChange('search', '')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action controllers */}
        <div className="flex items-center space-x-2 shrink-0">
          
          {/* Collapse Drawer trigger */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-2 border rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
              showAdvanced || activeFiltersCount > 0
                ? 'bg-indigo-50 border-indigo-200 text-indigo-750 font-bold' 
                : 'bg-white text-slate-550 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-indigo-600 text-white font-mono text-[9px] px-1.5 py-0.2 rounded-full font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Saved Views quick selector */}
          <div className="relative group">
            <button
              type="button"
              className="p-1.5 bg-white border border-slate-200 text-slate-550 rounded-lg hover:bg-slate-50 hover:text-slate-700 font-medium text-xs flex items-center space-x-1 cursor-pointer transition-all"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Views ({savedViews.length})</span>
            </button>

            {/* Dropdown overlay */}
            <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg w-64 p-2.5 hidden group-hover:block hover:block z-40 animate-fade-in space-y-2 select-text">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block px-1.5 pb-1 border-b border-slate-100">
                Your Saved Filter Presets
              </span>
              {savedViews.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {savedViews.map(view => (
                    <div 
                      key={view.id}
                      onClick={() => handleApplyView(view)}
                      className="p-2.5 hover:bg-slate-100 rounded-lg flex items-center justify-between cursor-pointer group/item transition-colors"
                    >
                      <div className="min-w-0 pr-1.5">
                        <span className="text-xs font-bold text-slate-705 truncate block">{view.name}</span>
                        <span className="text-[8px] font-mono text-slate-400 block truncate">
                          {Object.entries(view.filters).map(([k, v]) => `${k}:${v}`).join(', ') || 'No filters'}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteView(e, view.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-all cursor-pointer"
                        title="Delete view shortcut"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-[10px] text-slate-400 leading-relaxed font-mono px-2">
                  No saved views yet. Save current filter state to create quick tabs.
                </div>
              )}
              
              <button
                type="button"
                onClick={() => setShowSaveViewForm(!showSaveViewForm)}
                className="w-full text-center text-[10px] font-mono font-bold text-indigo-650 hover:text-indigo-800 bg-slate-50 hover:bg-slate-100 py-1.5 rounded-lg border border-slate-150 cursor-pointer block mt-1"
              >
                + Save Current Setup
              </button>
            </div>
          </div>

          {/* Reset Filters CTA */}
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="p-2 border border-rose-100 text-rose-600 bg-rose-50/50 rounded-lg hover:bg-rose-50 cursor-pointer text-xs font-mono font-bold uppercase transition flex items-center space-x-1"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

        </div>
      </div>

      {/* Slide / Foldout expanded drawer for advanced values */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3.5 border-t border-slate-100 select-none">
          
          {/* Status Selection list */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold font-mono text-slate-450 uppercase tracking-widest block">Status Classifier</span>
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full text-xs font-sans border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden p-2 rounded-lg text-slate-700"
            >
              <option value="all">-- All Statuses --</option>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Assignee custom box */}
          {assigneeOptions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold font-mono text-slate-450 uppercase tracking-widest block">Assigned Staff</span>
              <select
                value={filters.assignedTo || 'all'}
                onChange={(e) => handleInputChange('assignedTo', e.target.value)}
                className="w-full text-xs font-sans border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden p-2 rounded-lg text-slate-700"
              >
                <option value="all">-- All Assignees --</option>
                {assigneeOptions.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date range inputs */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold font-mono text-slate-450 uppercase tracking-widest block flex items-center space-x-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>Created From</span>
            </span>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              className="w-full text-xs font-mono border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden p-2 rounded-lg text-slate-700"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] font-bold font-mono text-slate-450 uppercase tracking-widest block flex items-center space-x-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>Created To</span>
            </span>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleInputChange('endDate', e.target.value)}
              className="w-full text-xs font-mono border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden p-2 rounded-lg text-slate-700"
            />
          </div>

        </div>
      )}

      {/* Save view floating inline editor form */}
      {showSaveViewForm && (
        <form onSubmit={handleSaveViewSubmit} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in select-text">
          <div className="space-y-1 min-w-0 flex-1">
            <span className="text-[9px] font-mono font-bold text-indigo-650 uppercase tracking-wide block">Shortcut Name Creator</span>
            <input
              type="text"
              required
              className="w-full text-xs font-sans border border-slate-200 rounded-lg p-2 bg-white focus:outline-hidden"
              placeholder="e.g., Immediate High Priority Orders"
              value={viewNameInput}
              onChange={(e) => setViewNameInput(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setShowSaveViewForm(false)}
              className="px-2.5 py-1.5 text-[10px] font-mono hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
            >
              Abrot
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold rounded cursor-pointer shadow-3xs"
            >
              Verify & Save View
            </button>
          </div>
        </form>
      )}

      {/* Floating alert indicators */}
      {feedbackMsg && (
        <div className="p-2 py-1.5 bg-sky-50 border border-sky-100 text-sky-850 rounded-lg text-[10px] font-mono flex items-center space-x-1.5 animate-pulse select-none">
          <CheckCircle className="h-3.5 w-3.5 text-sky-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

    </div>
  );
};
