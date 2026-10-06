// src/hooks/useCostEngine.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { 
  CostingTemplate, 
  CostCalculationInput, 
  CostCalculationBreakdown,
  LaborRateRule,
  MachineHourRateRule,
  MaterialMarkupRule,
  SubcontractingRule,
  OverheadAndMarginRule
} from '../types/costEngine';
import { DEFAULT_COSTING_TEMPLATES } from '../services/costEngineDefaults';
import { 
  calculatePartCost, 
  createNextTemplateVersion, 
  cloneTemplate 
} from '../services/costEngineService';

const STORAGE_KEY_PREFIX = 'flowops_cost_templates_';

export function useCostEngine(tenantId?: string) {
  const [templates, setTemplates] = useState<CostingTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load templates from Firestore or fallback to defaults
  const fetchTemplates = useCallback(async () => {
    if (!tenantId) {
      setTemplates(DEFAULT_COSTING_TEMPLATES);
      setActiveTemplateId(DEFAULT_COSTING_TEMPLATES[0].id);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${tenantId}`;
      const cached = localStorage.getItem(storageKey);

      if (db) {
        try {
          const colRef = collection(db, 'tenants', tenantId, 'costingTemplates');
          const snap = await getDocs(colRef);
          
          if (!snap.empty) {
            const list: CostingTemplate[] = [];
            snap.forEach(d => {
              list.push({ id: d.id, ...d.data() } as CostingTemplate);
            });
            setTemplates(list);
            localStorage.setItem(storageKey, JSON.stringify(list));

            const defaultOne = list.find(t => t.isDefault) || list[0];
            setActiveTemplateId(defaultOne ? defaultOne.id : list[0].id);
            setLoading(false);
            return;
          }
        } catch (dbErr) {
          console.warn('Could not read costingTemplates from Firestore, using local cache:', dbErr);
        }
      }

      // Check local cache
      if (cached) {
        const parsed = JSON.parse(cached);
        setTemplates(parsed);
        const def = parsed.find((t: any) => t.isDefault) || parsed[0];
        setActiveTemplateId(def ? def.id : parsed[0].id);
      } else {
        // Seed initial default templates
        const seeded = DEFAULT_COSTING_TEMPLATES.map(t => ({
          ...t,
          tenantId
        }));
        setTemplates(seeded);
        setActiveTemplateId(seeded[0].id);
        localStorage.setItem(storageKey, JSON.stringify(seeded));
      }
    } catch (err: any) {
      console.error('Error fetching cost templates:', err);
      setError(err.message || 'Failed to load costing templates');
      setTemplates(DEFAULT_COSTING_TEMPLATES);
      setActiveTemplateId(DEFAULT_COSTING_TEMPLATES[0].id);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Active Template
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === activeTemplateId) || templates[0] || DEFAULT_COSTING_TEMPLATES[0];
  }, [templates, activeTemplateId]);

  // Save template (creates or updates)
  const saveTemplate = useCallback(async (template: CostingTemplate) => {
    const updated = {
      ...template,
      tenantId: tenantId || 'default',
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || 'Business Owner'
    };

    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === updated.id);
      const next = idx !== -1 ? [...prev] : [updated, ...prev];
      if (idx !== -1) next[idx] = updated;

      if (updated.isDefault) {
        next.forEach(t => {
          if (t.id !== updated.id) t.isDefault = false;
        });
      }

      if (tenantId) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(next));
      }
      return next;
    });

    // Sync to Firestore if available
    if (db && tenantId) {
      try {
        await setDoc(doc(db, 'tenants', tenantId, 'costingTemplates', updated.id), {
          ...updated,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.warn('Firestore sync warning for costingTemplate:', err);
      }
    }

    return updated;
  }, [tenantId]);

  // Set default template
  const setDefaultTemplate = useCallback(async (templateId: string) => {
    const t = templates.find(item => item.id === templateId);
    if (!t) return;
    await saveTemplate({ ...t, isDefault: true });
    setActiveTemplateId(templateId);
  }, [templates, saveTemplate]);

  // Create new version of a template (e.g. v2.1 -> v2.2)
  const createNewVersion = useCallback(async (
    baseTemplate: CostingTemplate, 
    changeLogNotes: string,
    isMajor = false
  ) => {
    const nextVer = createNextTemplateVersion(baseTemplate, {
      changeLog: changeLogNotes,
      isMajor,
      authorName: auth.currentUser?.email || 'Business Owner'
    });
    await saveTemplate(nextVer);
    setActiveTemplateId(nextVer.id);
    return nextVer;
  }, [saveTemplate]);

  // Clone template
  const duplicateTemplate = useCallback(async (baseTemplate: CostingTemplate, newName: string) => {
    const cloned = cloneTemplate(baseTemplate, newName, auth.currentUser?.email || 'Business Owner');
    await saveTemplate(cloned);
    setActiveTemplateId(cloned.id);
    return cloned;
  }, [saveTemplate]);

  // Delete template
  const deleteTemplate = useCallback(async (templateId: string) => {
    if (templates.length <= 1) {
      throw new Error('You must maintain at least one costing template in the system.');
    }

    setTemplates(prev => {
      const next = prev.filter(t => t.id !== templateId);
      if (tenantId) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(next));
      }
      return next;
    });

    if (activeTemplateId === templateId) {
      const remaining = templates.filter(t => t.id !== templateId);
      if (remaining.length > 0) setActiveTemplateId(remaining[0].id);
    }

    if (db && tenantId) {
      try {
        await deleteDoc(doc(db, 'tenants', tenantId, 'costingTemplates', templateId));
      } catch (err) {
        console.warn('Firestore delete warning for costingTemplate:', err);
      }
    }
  }, [templates, activeTemplateId, tenantId]);

  // Execute Cost Calculation with active template or specific template
  const calculateCost = useCallback((
    input: CostCalculationInput,
    overrideTemplate?: CostingTemplate
  ): CostCalculationBreakdown => {
    const tpl = overrideTemplate || activeTemplate;
    return calculatePartCost(input, tpl);
  }, [activeTemplate]);

  return {
    templates,
    activeTemplate,
    activeTemplateId,
    setActiveTemplateId,
    loading,
    error,
    saveTemplate,
    setDefaultTemplate,
    createNewVersion,
    duplicateTemplate,
    deleteTemplate,
    calculateCost,
    refresh: fetchTemplates
  };
}
