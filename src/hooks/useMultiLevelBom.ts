// src/hooks/useMultiLevelBom.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  MultiLevelBom,
  BomRevision,
  MultiLevelBomNode,
  EngineeringChangeOrder,
  WhereUsedResult,
  BomRevisionDiff,
  EcoStatus
} from '../types/multiLevelBom';
import {
  fetchMultiLevelBoms,
  fetchEngineeringChangeOrders,
  saveMultiLevelBom,
  saveEngineeringChangeOrder,
  branchNewBomRevision,
  releaseEcoAndImplementBom,
  diffBomRevisions,
  findWhereUsed,
  calculateRollUpCost,
  filterBomByAsOfDate
} from '../services/multiLevelBomService';

export function useMultiLevelBom(tenantIdOverride?: string) {
  const { tenant, profile, isSandboxMode } = useAuth();
  const tenantId = tenantIdOverride || tenant?.id || 'tenant_default';

  const [boms, setBoms] = useState<MultiLevelBom[]>([]);
  const [ecos, setEcos] = useState<EngineeringChangeOrder[]>([]);
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>(''); // empty string means "all/no effectivity filter"
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load BOMs and ECOs
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedBoms, fetchedEcos] = await Promise.all([
        fetchMultiLevelBoms(tenantId, isSandboxMode),
        fetchEngineeringChangeOrders(tenantId, isSandboxMode)
      ]);
      setBoms(fetchedBoms);
      setEcos(fetchedEcos);

      // Auto-select first BOM if none selected or if selected BOM is not in list
      if (fetchedBoms.length > 0) {
        setSelectedBomId(prev => {
          const match = fetchedBoms.find(b => b.id === prev);
          return match ? match.id : fetchedBoms[0].id;
        });
      }
    } catch (err: any) {
      console.error('Failed to load multi-level BOMs:', err);
      setError(err?.message || 'Failed to load BOM data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, isSandboxMode]);

  useEffect(() => {
    loadData();

    // Listen to custom update events
    const handleBomsUpdated = () => {
      loadData();
    };
    const handleEcosUpdated = () => {
      loadData();
    };

    window.addEventListener('flowops:multilevel_boms_updated', handleBomsUpdated);
    window.addEventListener('flowops:ecos_updated', handleEcosUpdated);

    return () => {
      window.removeEventListener('flowops:multilevel_boms_updated', handleBomsUpdated);
      window.removeEventListener('flowops:ecos_updated', handleEcosUpdated);
    };
  }, [loadData]);

  // Current active BOM
  const selectedBom = useMemo(() => {
    return boms.find(b => b.id === selectedBomId) || boms[0] || null;
  }, [boms, selectedBomId]);

  // Ensure selected revision is synchronized with selected BOM
  useEffect(() => {
    if (selectedBom && selectedBom.revisions.length > 0) {
      // If current selectedRevisionId is not in this BOM, default to active or current revision
      const hasCurrent = selectedBom.revisions.some(r => r.id === selectedRevisionId);
      if (!hasCurrent) {
        const activeRev = selectedBom.revisions.find(r => r.id === selectedBom.currentRevisionId) 
          || selectedBom.revisions.find(r => r.status === 'released')
          || selectedBom.revisions[0];
        setSelectedRevisionId(activeRev.id);
      }
    }
  }, [selectedBom, selectedRevisionId]);

  // Current active revision
  const selectedRevision = useMemo(() => {
    if (!selectedBom) return null;
    return selectedBom.revisions.find(r => r.id === selectedRevisionId) || selectedBom.revisions[0] || null;
  }, [selectedBom, selectedRevisionId]);

  // Filtered root node based on effectivity as-of date (if specified)
  const effectiveRootNode = useMemo(() => {
    if (!selectedRevision) return null;
    if (!asOfDate) return selectedRevision.rootNode;
    return filterBomByAsOfDate(selectedRevision.rootNode, asOfDate);
  }, [selectedRevision, asOfDate]);

  // Actions
  const handleSelectBom = (id: string) => {
    setSelectedBomId(id);
    const target = boms.find(b => b.id === id);
    if (target && target.revisions.length > 0) {
      const activeRev = target.revisions.find(r => r.id === target.currentRevisionId) || target.revisions[0];
      setSelectedRevisionId(activeRev.id);
    }
  };

  const handleSelectRevision = (revId: string) => {
    setSelectedRevisionId(revId);
  };

  /**
   * Branch a new revision from an existing revision
   */
  const handleBranchRevision = async (
    bomId: string,
    baseRevisionId: string,
    newRevisionCode: string,
    changeReason: string
  ) => {
    const actor = {
      userId: profile?.uid || 'usr_eng_mgr',
      name: profile?.name || 'Engineering Manager'
    };

    const result = await branchNewBomRevision(
      tenantId,
      bomId,
      baseRevisionId,
      newRevisionCode,
      changeReason,
      actor,
      isSandboxMode
    );

    await loadData();
    setSelectedBomId(bomId);
    setSelectedRevisionId(result.newRevision.id);
    return result;
  };

  /**
   * Update or Add a node inside a revision tree
   */
  const handleSaveRevisionTree = async (
    bomId: string,
    revId: string,
    updatedRootNode: MultiLevelBomNode
  ) => {
    // Recalculate cost rollups
    calculateRollUpCost(updatedRootNode);

    const targetBom = boms.find(b => b.id === bomId);
    if (!targetBom) throw new Error('Target BOM not found');

    const updatedRevisions = targetBom.revisions.map(rev => {
      if (rev.id === revId) {
        return {
          ...rev,
          rootNode: updatedRootNode,
          rolledUpCost: updatedRootNode.rolledUpCost || 0,
          updatedAt: new Date().toISOString()
        };
      }
      return rev;
    });

    const updatedBom: MultiLevelBom = {
      ...targetBom,
      revisions: updatedRevisions,
      updatedAt: new Date().toISOString()
    };

    await saveMultiLevelBom(tenantId, updatedBom, isSandboxMode);
    await loadData();
  };

  /**
   * Helper to recursively insert or update a child node
   */
  const handleAddChildNode = async (
    bomId: string,
    revId: string,
    parentNodeId: string,
    newNodeData: Partial<MultiLevelBomNode>
  ) => {
    if (!selectedRevision) return;
    const clonedRoot: MultiLevelBomNode = JSON.parse(JSON.stringify(selectedRevision.rootNode));

    function insertRecursive(curr: MultiLevelBomNode): boolean {
      if (curr.id === parentNodeId) {
        if (!curr.children) curr.children = [];
        const newNode: MultiLevelBomNode = {
          id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          partNumber: newNodeData.partNumber || 'PRT-NEW-01',
          partName: newNodeData.partName || 'New Component',
          description: newNodeData.description || '',
          level: curr.level + 1,
          itemType: newNodeData.itemType || 'manufactured',
          quantityPerParent: Number(newNodeData.quantityPerParent) || 1,
          unit: newNodeData.unit || 'pcs',
          materialGrade: newNodeData.materialGrade || '',
          scrapFactorPercent: Number(newNodeData.scrapFactorPercent) || 0,
          unitCost: Number(newNodeData.unitCost) || 0,
          leadTimeDays: Number(newNodeData.leadTimeDays) || 1,
          workCenterOrSupplier: newNodeData.workCenterOrSupplier || '',
          drawingNumber: newNodeData.drawingNumber || '',
          drawingRevision: newNodeData.drawingRevision || '0',
          effectiveFrom: newNodeData.effectiveFrom || new Date().toISOString().slice(0, 10),
          effectiveTo: newNodeData.effectiveTo || undefined,
          notes: newNodeData.notes || '',
          children: newNodeData.children || []
        };
        curr.children.push(newNode);
        return true;
      }
      if (curr.children) {
        for (const child of curr.children) {
          if (insertRecursive(child)) return true;
        }
      }
      return false;
    }

    insertRecursive(clonedRoot);
    await handleSaveRevisionTree(bomId, revId, clonedRoot);
  };

  /**
   * Helper to recursively update an existing node
   */
  const handleUpdateNode = async (
    bomId: string,
    revId: string,
    nodeId: string,
    updatedData: Partial<MultiLevelBomNode>
  ) => {
    if (!selectedRevision) return;
    const clonedRoot: MultiLevelBomNode = JSON.parse(JSON.stringify(selectedRevision.rootNode));

    function updateRecursive(curr: MultiLevelBomNode): boolean {
      if (curr.id === nodeId) {
        Object.assign(curr, updatedData);
        return true;
      }
      if (curr.children) {
        for (const child of curr.children) {
          if (updateRecursive(child)) return true;
        }
      }
      return false;
    }

    updateRecursive(clonedRoot);
    await handleSaveRevisionTree(bomId, revId, clonedRoot);
  };

  /**
   * Helper to recursively delete a node
   */
  const handleDeleteNode = async (
    bomId: string,
    revId: string,
    nodeId: string
  ) => {
    if (!selectedRevision) return;
    const clonedRoot: MultiLevelBomNode = JSON.parse(JSON.stringify(selectedRevision.rootNode));

    if (clonedRoot.id === nodeId) {
      throw new Error('Cannot delete root assembly node');
    }

    function removeRecursive(curr: MultiLevelBomNode): boolean {
      if (curr.children) {
        const idx = curr.children.findIndex(c => c.id === nodeId);
        if (idx >= 0) {
          curr.children.splice(idx, 1);
          return true;
        }
        for (const child of curr.children) {
          if (removeRecursive(child)) return true;
        }
      }
      return false;
    }

    removeRecursive(clonedRoot);
    await handleSaveRevisionTree(bomId, revId, clonedRoot);
  };

  /**
   * Create a new Engineering Change Order
   */
  const handleCreateEco = async (
    ecoData: Omit<EngineeringChangeOrder, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ) => {
    const newEcoId = `eco_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newEco: EngineeringChangeOrder = {
      ...ecoData,
      id: newEcoId,
      tenantId,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await saveEngineeringChangeOrder(tenantId, newEco, isSandboxMode);
    await loadData();
    return newEco;
  };

  /**
   * Reviewer signs off on an ECO (Approve or Reject)
   */
  const handleReviewEco = async (
    ecoId: string,
    reviewerIndex: number,
    status: 'approved' | 'rejected',
    comments?: string
  ) => {
    const targetEco = ecos.find(e => e.id === ecoId);
    if (!targetEco) throw new Error('ECO not found');

    const updatedReviewers = [...targetEco.reviewers];
    if (updatedReviewers[reviewerIndex]) {
      updatedReviewers[reviewerIndex] = {
        ...updatedReviewers[reviewerIndex],
        status,
        comments,
        reviewedAt: new Date().toISOString()
      };
    }

    // Check if all reviewers have approved
    const allApproved = updatedReviewers.every(r => r.status === 'approved');
    const anyRejected = updatedReviewers.some(r => r.status === 'rejected');

    let overallStatus: EcoStatus = targetEco.status;
    if (anyRejected) {
      overallStatus = 'rejected';
    } else if (allApproved) {
      overallStatus = 'approved';
    }

    const updatedEco: EngineeringChangeOrder = {
      ...targetEco,
      reviewers: updatedReviewers,
      status: overallStatus,
      updatedAt: new Date().toISOString()
    };

    await saveEngineeringChangeOrder(tenantId, updatedEco, isSandboxMode);
    await loadData();
  };

  /**
   * Release and Implement an ECO to production
   */
  const handleImplementEco = async (ecoId: string, comments?: string) => {
    const actor = {
      userId: profile?.uid || 'usr_eng_mgr',
      name: profile?.name || 'Engineering Manager'
    };

    const result = await releaseEcoAndImplementBom(
      tenantId,
      ecoId,
      actor,
      comments,
      isSandboxMode
    );

    await loadData();
    return result;
  };

  /**
   * Fast Where-Used lookup across all assemblies
   */
  const handleWhereUsed = (partNumber: string): WhereUsedResult => {
    return findWhereUsed(boms, partNumber);
  };

  /**
   * Compute Side-by-Side Diff between two revisions of a BOM
   */
  const handleComputeDiff = (bomId: string, revAId: string, revBId: string): BomRevisionDiff | null => {
    const targetBom = boms.find(b => b.id === bomId);
    if (!targetBom) return null;
    const revA = targetBom.revisions.find(r => r.id === revAId);
    const revB = targetBom.revisions.find(r => r.id === revBId);
    if (!revA || !revB) return null;
    return diffBomRevisions(revA, revB);
  };

  /**
   * Create a brand new Top-Level Assembly BOM
   */
  const handleCreateNewBom = async (params: {
    assemblyPartNumber: string;
    assemblyName: string;
    description: string;
    category: string;
    unitCost?: number;
  }) => {
    const newBomId = `mlbom_${Date.now()}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const rootNode: MultiLevelBomNode = {
      id: `node_root_${Date.now()}`,
      partNumber: params.assemblyPartNumber,
      partName: params.assemblyName,
      description: params.description,
      level: 0,
      itemType: 'assembly',
      quantityPerParent: 1,
      unit: 'pcs',
      unitCost: params.unitCost || 0,
      drawingNumber: `DWG-${params.assemblyPartNumber}`,
      drawingRevision: 'A.0',
      effectiveFrom: todayIso,
      children: []
    };

    calculateRollUpCost(rootNode);

    const initialRevision: BomRevision = {
      id: `rev_${newBomId}_A`,
      bomId: newBomId,
      revision: 'Rev A.0',
      status: 'draft',
      effectiveFrom: todayIso,
      changeReason: 'Initial engineering release draft',
      rootNode,
      rolledUpCost: rootNode.rolledUpCost || 0,
      totalComponentCount: 1,
      maxLevelDepth: 0,
      createdAt: nowIso,
      createdBy: profile?.uid || 'usr_eng_mgr',
      createdByName: profile?.name || 'Engineering Manager',
      releaseNotes: 'Initial structure created'
    };

    const newBom: MultiLevelBom = {
      id: newBomId,
      tenantId,
      assemblyPartNumber: params.assemblyPartNumber,
      assemblyName: params.assemblyName,
      description: params.description,
      category: params.category || 'Mechanical Assemblies',
      currentRevisionId: initialRevision.id,
      activeRevisionCode: 'Rev A.0',
      status: 'draft',
      revisions: [initialRevision],
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: profile?.uid || 'usr_eng_mgr',
      createdByName: profile?.name || 'Engineering Manager'
    };

    await saveMultiLevelBom(tenantId, newBom, isSandboxMode);
    await loadData();
    setSelectedBomId(newBom.id);
    setSelectedRevisionId(initialRevision.id);
    return newBom;
  };

  return {
    boms,
    ecos,
    selectedBom,
    selectedRevision,
    effectiveRootNode,
    selectedBomId,
    selectedRevisionId,
    asOfDate,
    loading,
    error,
    refresh: loadData,
    selectBom: handleSelectBom,
    selectRevision: handleSelectRevision,
    setAsOfDate,
    branchRevision: handleBranchRevision,
    saveRevisionTree: handleSaveRevisionTree,
    addChildNode: handleAddChildNode,
    updateNode: handleUpdateNode,
    deleteNode: handleDeleteNode,
    createEco: handleCreateEco,
    reviewEco: handleReviewEco,
    implementEco: handleImplementEco,
    runWhereUsed: handleWhereUsed,
    computeDiff: handleComputeDiff,
    createNewBom: handleCreateNewBom
  };
}
