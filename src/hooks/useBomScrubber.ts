// src/hooks/useBomScrubber.ts

import { useState, useCallback, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { StockItem } from '../types';
import {
  RawBomInputItem,
  ScrubbedBomLineItem,
  ScrubbedBomSummary,
  ScrubbedBomRecord,
  SupplierCatalogMasterItem,
  AlternateComponent
} from '../types/bomScrubber';
import {
  parseExcelBomFile,
  parseTextOrPdfBom,
  scrubAndValidateBom,
  generateSampleExcelBomWorkbook,
  exportScrubbedBomReportToExcel
} from '../services/bomScrubberService';
import { DEFAULT_SUPPLIER_CATALOG } from '../services/supplierCatalogData';

// Realistic sample presets for instant test loading
export const SAMPLE_BOM_PRESETS = [
  {
    id: 'preset-hydraulic',
    title: 'Heavy Hydraulic Cylinder Assembly BOM',
    subtitle: 'High-pressure cylinder with chrome rod, seals, forged barrel, and fastener hardware',
    fileName: 'Hydraulic_Cylinder_Rev_D_BOM.xlsx',
    type: 'hydraulic' as const,
    items: [
      {
        partNumber: 'WR-1002',
        description: 'High Tensile Wire Rod 8mm Core Wire',
        quantity: 25,
        unit: 'tonnes',
        materialGrade: 'HT Steel Grade 1008',
        targetPrice: 45000,
        notes: 'In-house warehouse raw material item'
      },
      {
        partNumber: 'TS-EN8-RD45',
        description: 'Precision Piston Rod Dia 45mm x 450mm Length',
        quantity: 120,
        unit: 'pcs',
        materialGrade: 'EN8 Normalized',
        targetPrice: 950,
        notes: 'Hard chrome plated 25 micron finish'
      },
      {
        partNumber: 'KAL-VAC-INGOT-42CR',
        description: 'Cylinder Barrel Forging Billet Dia 160mm',
        quantity: 15,
        unit: 'pcs',
        materialGrade: '42CrMo4 ESR',
        targetPrice: 18500,
        notes: 'CRITICAL LEAD TIME: 45 days forging schedule'
      },
      {
        partNumber: 'PKR-POLYPAK-B-1250',
        description: 'Hydraulic Piston Polypak Seal 1.25" ID',
        quantity: 240,
        unit: 'pcs',
        materialGrade: 'Molythane 95A',
        targetPrice: 150,
        notes: 'Standard hydraulic seal pack'
      },
      {
        partNumber: 'PKR-VITON-OR-AS568-214',
        description: 'End Cap Viton O-Ring 0.984" ID x 0.139"',
        quantity: 240,
        unit: 'pcs',
        materialGrade: 'Viton FKM 75A',
        targetPrice: 35,
        notes: 'High temperature seal grade'
      },
      {
        partNumber: 'UNB-M10-PRE-LOCK-CAD',
        description: 'M10 Flange Locknut Cadmium Plated',
        quantity: 500,
        unit: 'pcs',
        materialGrade: 'Steel Class 10 (Cadmium)',
        targetPrice: 25,
        notes: 'OBSOLETE / BANNED: Drawing specifies obsolete Cadmium electroplating!'
      },
      {
        partNumber: 'UNB-M12X50-10.9',
        description: 'M12 x 50mm Socket Head Cap Screw Gr 10.9',
        quantity: 480,
        unit: 'pcs',
        materialGrade: 'Alloy Steel 10.9',
        targetPrice: 28,
        notes: 'High tensile cap screw'
      }
    ]
  },
  {
    id: 'preset-transmission',
    title: 'Automotive Transmission Sub-Assembly BOM',
    subtitle: 'Machined pinion shafts, deep groove bearings, sliding bushings, and casing fasteners',
    fileName: 'Transmission_SubAssembly_BOM.xlsx',
    type: 'transmission' as const,
    items: [
      {
        partNumber: 'TS-EN19-RD60',
        description: 'Input Splined Pinion Shaft Dia 60mm x 320mm',
        quantity: 85,
        unit: 'pcs',
        materialGrade: 'EN19 / 4140 Annealed',
        targetPrice: 2400,
        notes: 'Spline hobbed and case hardened'
      },
      {
        partNumber: 'SKF-6205-2RSH',
        description: 'Deep Groove Ball Bearing 25x52x15mm Dual Sealed',
        quantity: 170,
        unit: 'pcs',
        materialGrade: '100Cr6 Chromium Steel',
        targetPrice: 230,
        notes: 'Active standard dual rubber seal'
      },
      {
        partNumber: 'SKF-6205-RS-DISC',
        description: 'Secondary Idler Ball Bearing (Single Rubber Seal)',
        quantity: 85,
        unit: 'pcs',
        materialGrade: '100Cr6 Classic',
        targetPrice: 220,
        notes: 'OBSOLETE: Retired single-seal drawing reference'
      },
      {
        partNumber: 'TIM-30206-TAPER',
        description: 'Output Differential Tapered Roller Bearing',
        quantity: 170,
        unit: 'pcs',
        materialGrade: 'Carburized Alloy Steel',
        targetPrice: 550,
        notes: 'High torque bearing assembly'
      },
      {
        partNumber: 'GLY-PG-252830-PB',
        description: 'Reverse Gearbox Sliding Bushing 25x28x30mm',
        quantity: 85,
        unit: 'pcs',
        materialGrade: 'CuSn8 Lead-Alloy Bronze',
        targetPrice: 160,
        notes: 'END OF LIFE (EOL): Non-RoHS compliant leaded bronze'
      },
      {
        partNumber: 'TVS-M16X80-8.8',
        description: 'Gearbox Casing Hex Bolt M16 x 80mm Gr 8.8',
        quantity: 680,
        unit: 'pcs',
        materialGrade: 'Medium Carbon Steel 8.8',
        targetPrice: 42,
        notes: 'Yellow zinc passivated'
      },
      {
        partNumber: 'SND-CNMG-120408-PM-4325',
        description: 'Carbide Turning Insert for Casing Bore Machining',
        quantity: 30,
        unit: 'pcs',
        materialGrade: 'Tungsten Carbide 4325',
        targetPrice: 450,
        notes: 'Shopfloor tooling consumable'
      }
    ]
  },
  {
    id: 'preset-piping',
    title: 'High-Pressure Marine Stainless Piping Spool BOM',
    subtitle: 'SS 316L flanges, heavy laser-cut plates, Inconel relief spools, and PTFE studs',
    fileName: 'Offshore_Piping_Spool_BOM.xlsx',
    type: 'piping' as const,
    items: [
      {
        partNumber: 'JSL-SS316L-RD50',
        description: 'SS 316L Solid Flange Hub Round Bar 50mm',
        quantity: 140,
        unit: 'pcs',
        materialGrade: 'SS 316L / 1.4404',
        targetPrice: 3200,
        notes: 'Marine sour service grade'
      },
      {
        partNumber: 'JSL-SS304-PL10',
        description: 'Base Flange Laser Cutting Sheet 10mm Thk',
        quantity: 45,
        unit: 'pcs',
        materialGrade: 'SS 304 / 1.4301',
        targetPrice: 5400,
        notes: 'Laser profiled with 8 PCD holes'
      },
      {
        partNumber: 'SM-INCONEL-718-BAR',
        description: 'High Pressure Relief Valve Spool 35mm',
        quantity: 12,
        unit: 'pcs',
        materialGrade: 'Inconel 718 Aged Bar',
        targetPrice: 18000,
        notes: 'CRITICAL LEAD TIME: 75 days exotic alloy import'
      },
      {
        partNumber: 'UNB-M12X50-10.9',
        description: 'Heavy Hex Studs M12 x 50mm with Twin Nuts',
        quantity: 560,
        unit: 'pcs',
        materialGrade: 'Alloy Steel 10.9',
        targetPrice: 45,
        notes: 'PTFE coated studs for marine skid'
      }
    ]
  }
];

export function useBomScrubber(tenantId?: string, stockItems: StockItem[] = []) {
  const [activeBomTitle, setActiveBomTitle] = useState('Heavy Hydraulic Cylinder Assembly BOM');
  const [sourceFileName, setSourceFileName] = useState<string>('Hydraulic_Cylinder_Rev_D_BOM.xlsx');
  const [sourceFileType, setSourceFileType] = useState<'excel' | 'pdf' | 'csv' | 'preset' | 'manual'>('preset');
  
  // Custom catalog additions by tenant
  const [customCatalog, setCustomCatalog] = useState<SupplierCatalogMasterItem[]>([]);
  
  // Active Raw items and Scrubbed results
  const [rawItems, setRawItems] = useState<RawBomInputItem[]>(SAMPLE_BOM_PRESETS[0].items);
  const [scrubbedItems, setScrubbedItems] = useState<ScrubbedBomLineItem[]>([]);
  const [summary, setSummary] = useState<ScrubbedBomSummary | null>(null);

  // Costing config
  const [marginPercent, setMarginPercent] = useState(18);
  const [scrapBufferPercent, setScrapBufferPercent] = useState(3);
  
  // UI states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [parsingNotes, setParsingNotes] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SUPPLIER' | 'LONG_LEAD' | 'OBSOLETE' | 'UNVERIFIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedRecords, setSavedRecords] = useState<ScrubbedBomRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Execute validation whenever rawItems, stockItems, customCatalog, or margins change
  const runValidation = useCallback((
    itemsToValidate: RawBomInputItem[] = rawItems,
    mPercent = marginPercent,
    sPercent = scrapBufferPercent
  ) => {
    const result = scrubAndValidateBom(itemsToValidate, stockItems, customCatalog, {
      marginPercent: mPercent,
      scrapBufferPercent: sPercent
    });
    setScrubbedItems(result.scrubbedItems);
    setSummary(result.summary);
  }, [rawItems, stockItems, customCatalog, marginPercent, scrapBufferPercent]);

  // Initial validation run on mount or when stock changes
  useEffect(() => {
    runValidation();
  }, [runValidation]);

  // Load a pre-configured sample preset
  const loadPreset = useCallback((presetId: string) => {
    const preset = SAMPLE_BOM_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setActiveBomTitle(preset.title);
    setSourceFileName(preset.fileName);
    setSourceFileType('preset');
    setRawItems(preset.items);
    setParsingNotes([
      `Loaded preset "${preset.title}" with ${preset.items.length} engineering components.`,
      `Includes a realistic mix of warehouse inventory, supplier catalog items, long-lead billets, and obsolete legacy parts for comprehensive validation.`
    ]);
    runValidation(preset.items);
  }, [runValidation]);

  // Import Excel file (.xlsx, .xls, .csv)
  const importExcelFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const parsed = await parseExcelBomFile(file);
      const title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setActiveBomTitle(title);
      setSourceFileName(file.name);
      setSourceFileType(file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'excel');
      setRawItems(parsed.items);
      setParsingNotes(parsed.notes);
      runValidation(parsed.items);
      return { success: true, count: parsed.items.length };
    } catch (err: any) {
      console.error('Error importing Excel BOM:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [runValidation]);

  // Import Unstructured Plain Text or PDF Text BOM
  const importTextBom = useCallback((text: string, titleName = 'Pasted Text Customer BOM') => {
    setIsProcessing(true);
    try {
      const parsed = parseTextOrPdfBom(text);
      if (parsed.items.length === 0) {
        throw new Error('No line items could be detected. Please ensure parts have part numbers and quantities.');
      }
      setActiveBomTitle(titleName);
      setSourceFileName('customer-bom-extract.txt');
      setSourceFileType('pdf');
      setRawItems(parsed.items);
      setParsingNotes(parsed.notes);
      runValidation(parsed.items);
      return { success: true, count: parsed.items.length };
    } catch (err: any) {
      console.error('Error importing text BOM:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [runValidation]);

  // Pull / Refresh Real-Time Pricing
  const refreshLivePricing = useCallback(async () => {
    setIsRefreshingPrices(true);
    // Simulate real-time supplier API exchange / commodity index sync
    await new Promise(r => setTimeout(r, 650));
    runValidation();
    setIsRefreshingPrices(false);
  }, [runValidation]);

  // 1-Click Alternate Component Swap
  const substituteAlternateComponent = useCallback((itemId: string, alternate: AlternateComponent) => {
    setScrubbedItems(prev => {
      return prev.map(item => {
        if (item.id !== itemId) return item;

        // Apply alternate component
        const updatedSupplier = {
          ...item.supplier,
          supplierPartNumber: alternate.partNumber,
          manufacturer: alternate.manufacturer,
          leadTimeDays: alternate.leadTimeDays,
          unitPrice: alternate.unitPrice
        };

        const updatedRisk = {
          ...item.risk,
          lifecycleStatus: 'ACTIVE' as const,
          isObsolete: false,
          isHighRisk: alternate.leadTimeDays > 21,
          riskFactors: [`Substituted with Active Alternate: ${alternate.partNumber} (${alternate.statusReason})`]
        };

        const effectiveUnitPrice = alternate.unitPrice;
        const extendedPrice = Math.round(effectiveUnitPrice * item.quantity * 100) / 100;

        return {
          ...item,
          partNumber: alternate.partNumber,
          description: alternate.description,
          supplier: updatedSupplier,
          risk: updatedRisk,
          effectiveUnitPrice,
          extendedPrice,
          effectiveLeadTimeDays: alternate.leadTimeDays,
          validationStatus: (alternate.leadTimeDays > 21 ? 'WARNING' : 'VALID') as 'VALID' | 'WARNING' | 'CRITICAL_BLOCKER',
          validationMessage: `APPROVED SUBSTITUTE: ${alternate.partNumber} (${alternate.statusReason})`,
          hasSubstitutedAlternate: true,
          originalPartNumber: item.originalPartNumber || item.partNumber
        };
      });
    });

    // Recompute summary
    setTimeout(() => {
      setSummary(prev => {
        if (!prev) return null;
        return {
          ...prev,
          obsoleteCount: Math.max(0, prev.obsoleteCount - 1),
          procurableRate: 100,
          quotabilityScore: Math.min(100, prev.quotabilityScore + 18),
          quotabilityGrade: 'A_READY_TO_QUOTE'
        };
      });
    }, 50);
  }, []);

  // Update item price or lead time override
  const updateItemOverride = useCallback((itemId: string, overrides: { price?: number; leadTime?: number }) => {
    setScrubbedItems(prev => {
      return prev.map(item => {
        if (item.id !== itemId) return item;
        const newPrice = overrides.price !== undefined ? overrides.price : item.effectiveUnitPrice;
        const newLeadTime = overrides.leadTime !== undefined ? overrides.leadTime : item.effectiveLeadTimeDays;
        return {
          ...item,
          effectiveUnitPrice: newPrice,
          extendedPrice: Math.round(newPrice * item.quantity * 100) / 100,
          effectiveLeadTimeDays: newLeadTime,
          userOverridePrice: overrides.price,
          userOverrideLeadTime: overrides.leadTime,
          validationMessage: `Manual Costing Override: ₹${newPrice} / ${newLeadTime} days`
        };
      });
    });
  }, []);

  // Download Sample Excel Template
  const downloadSampleTemplate = useCallback((type: 'hydraulic' | 'transmission' | 'piping') => {
    const buffer = generateSampleExcelBomWorkbook(type);
    const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sample_${type.toUpperCase()}_Customer_BOM.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Export Scrubbed BOM Report to Excel
  const exportScrubbedReport = useCallback(() => {
    if (!summary) return;
    const buffer = exportScrubbedBomReportToExcel({
      bomTitle: activeBomTitle,
      items: scrubbedItems,
      summary
    });
    const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scrubbed_Validated_BOM_${activeBomTitle.replace(/\s+/g, '_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeBomTitle, scrubbedItems, summary]);

  // Save Scrubbed BOM Record to Firestore
  const saveScrubbedBomRecord = useCallback(async (rfqId?: string, rfqNumber?: string, customerName?: string) => {
    if (!tenantId || !summary) return null;
    setIsSaving(true);
    const validationId = `bom-val-${Date.now()}`;
    const record: ScrubbedBomRecord = {
      id: validationId,
      tenantId,
      rfqId,
      rfqNumber,
      customerName,
      bomTitle: activeBomTitle,
      sourceFileName,
      sourceFileType,
      items: scrubbedItems,
      summary,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || 'Costing Engineer',
      lastScrubbedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'tenants', tenantId, 'bomValidations', validationId), {
        ...record,
        timestamp: serverTimestamp()
      });
      setSavedRecords(prev => [record, ...prev]);
      return record;
    } catch (err: any) {
      console.warn('Could not persist to Firestore directly, keeping in local memory:', err);
      setSavedRecords(prev => [record, ...prev]);
      return record;
    } finally {
      setIsSaving(false);
    }
  }, [tenantId, summary, activeBomTitle, sourceFileName, sourceFileType, scrubbedItems]);

  // Filtered Items for Display Table
  const filteredItems = scrubbedItems.filter(item => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        item.partNumber.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.materialGrade && item.materialGrade.toLowerCase().includes(q)) ||
        item.supplier.supplierName.toLowerCase().includes(q);
      if (!matchSearch) return false;
    }

    // Status category filter
    if (statusFilter === 'IN_STOCK') return item.inventory.status === 'IN_STOCK';
    if (statusFilter === 'SUPPLIER') return item.supplier.matched && item.inventory.status !== 'IN_STOCK';
    if (statusFilter === 'LONG_LEAD') return item.risk.isLongLead;
    if (statusFilter === 'OBSOLETE') return item.risk.isObsolete;
    if (statusFilter === 'UNVERIFIED') return item.risk.lifecycleStatus === 'UNVERIFIED';

    return true;
  });

  return {
    activeBomTitle,
    setActiveBomTitle,
    sourceFileName,
    sourceFileType,
    rawItems,
    scrubbedItems,
    filteredItems,
    summary,
    marginPercent,
    setMarginPercent: (val: number) => {
      setMarginPercent(val);
      runValidation(rawItems, val, scrapBufferPercent);
    },
    scrapBufferPercent,
    setScrapBufferPercent: (val: number) => {
      setScrapBufferPercent(val);
      runValidation(rawItems, marginPercent, val);
    },
    isProcessing,
    isRefreshingPrices,
    parsingNotes,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    savedRecords,
    isSaving,
    loadPreset,
    importExcelFile,
    importTextBom,
    refreshLivePricing,
    substituteAlternateComponent,
    updateItemOverride,
    downloadSampleTemplate,
    exportScrubbedReport,
    saveScrubbedBomRecord,
    revalidate: runValidation
  };
}
