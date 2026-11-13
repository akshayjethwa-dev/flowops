// src/services/qualityHoldService.ts

import {
  QualityHoldRecord,
  QualityHoldFilterOptions,
  QualityHoldKpis,
  DispatchHoldCheck,
  QualityHoldReleaseWorkflow,
  QualityHoldHistoryEvent
} from '../types/qualityHold';

const STORAGE_KEY = 'flowops_quality_holds_v1';

const SEED_QUALITY_HOLDS: QualityHoldRecord[] = [
  {
    id: 'HLD-2026-0041',
    targetType: 'work_order',
    targetId: 'wo-gb-01',
    targetNumber: 'WO-2026-0001',
    salesOrderId: 'so-tat-01',
    salesOrderNumber: 'SO-2026-0012',
    workOrderNumber: 'WO-2026-0001',
    batchNumber: 'BATCH-2026-088',
    partName: 'Gear Blank — 42T',
    partCode: 'GB-42T',
    customerName: 'Tata Motors',
    customerPoNumber: 'PO-TAT-8921',
    quantity: 120,
    unit: 'pcs',
    status: 'active_hold',
    severity: 'critical',
    holdReasonCategory: 'dimensional_deviation',
    holdReason: 'Pitch circle diameter runout +0.065mm exceeds drawing tolerance of ±0.020mm.',
    holdDescription: 'During final coordinate measurement inspection (FQC), pitch circle concentricity and runout exceeded specification on 18 samples out of 30 inspected. Machine operator suspect CNC live tooling vibration.',
    location: 'Quarantine Bay 03 — Red Tag Cage',
    placedBy: 'Rajesh Varma',
    placedByRole: 'Senior Quality Inspector (ASQ-CQA)',
    placedAt: new Date(Date.now() - 36 * 3600000).toISOString(), // 36 hours ago
    preventDispatch: true,
    preventProductionProgression: true,
    ncrId: 'NCR-2026-0104',
    inspectionRef: 'FQC-2026-0088',
    history: [
      {
        id: 'hist-1',
        timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
        action: 'placed',
        actorName: 'Rajesh Varma',
        actorRole: 'Senior Quality Inspector',
        notes: 'Placed on Quality Hold following FQC coordinate runout non-conformance. Red quarantine tag attached.'
      },
      {
        id: 'hist-2',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
        action: 'updated',
        actorName: 'Vikram Mehta',
        actorRole: 'Lead Quality Engineer',
        notes: 'Associated Non-Conformance Report NCR-2026-0104 created. Root cause investigation opened.'
      }
    ]
  },
  {
    id: 'HLD-2026-0042',
    targetType: 'batch',
    targetId: 'batch-spindle-92',
    targetNumber: 'BATCH-2026-092',
    salesOrderId: 'so-mnh-02',
    salesOrderNumber: 'SO-2026-0015',
    workOrderNumber: 'WO-2026-0004',
    batchNumber: 'BATCH-2026-092',
    partName: 'Turbine Flange Spindle',
    partCode: 'TFS-316L',
    customerName: 'Mahindra Defense Systems',
    customerPoNumber: 'PO-MND-4410',
    quantity: 45,
    unit: 'pcs',
    status: 'active_hold',
    severity: 'major',
    holdReasonCategory: 'material_chemistry',
    holdReason: 'Heat treatment hardness test resulted in 44 HRC (specified: 48-52 HRC).',
    holdDescription: 'Rockwell C hardness test conducted on 5 sample coupons showed insufficient case hardening depth. Suspected furnace quenching oil temperature deviation at sub-contractor heat treat facility.',
    location: 'Quarantine Bay 01 — Metallurgical Audit Bin',
    placedBy: 'Anita Sharma',
    placedByRole: 'Materials QA Specialist',
    placedAt: new Date(Date.now() - 18 * 3600000).toISOString(),
    preventDispatch: true,
    preventProductionProgression: true,
    ncrId: 'NCR-2026-0108',
    inspectionRef: 'IQC-2026-0312',
    history: [
      {
        id: 'hist-3',
        timestamp: new Date(Date.now() - 18 * 3600000).toISOString(),
        action: 'placed',
        actorName: 'Anita Sharma',
        actorRole: 'Materials QA Specialist',
        notes: 'Mandatory hold placed. Subcontractor heat treatment certificates held for metallurgical audit.'
      }
    ]
  },
  {
    id: 'HLD-2026-0043',
    targetType: 'work_order',
    targetId: 'wo-bkt-02',
    targetNumber: 'WO-2026-0002',
    salesOrderId: 'so-tat-02',
    salesOrderNumber: 'SO-2026-0013',
    workOrderNumber: 'WO-2026-0002',
    batchNumber: 'LOT-BKT-2026-02',
    partName: 'Titanium Mounting Bracket',
    partCode: 'TMB-7075',
    customerName: 'Bharat Forge Aerospace',
    customerPoNumber: 'PO-BFA-9921',
    quantity: 80,
    unit: 'pcs',
    status: 'active_hold',
    severity: 'critical',
    holdReasonCategory: 'expired_gage_calibration',
    holdReason: 'Inspection performed using expired Bore Micrometer (GAGE-MIC-004).',
    holdDescription: 'Quality audit detected that bore tolerance inspection on critical Ø25.00mm H7 mounting holes was recorded using a micrometer that expired calibration 5 days prior. All 80 brackets must be re-verified with certified calibrated standard.',
    location: 'MRB Holding Vault #4',
    placedBy: 'Sanjay Deshmukh',
    placedByRole: 'Quality Assurance Manager',
    placedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    preventDispatch: true,
    preventProductionProgression: false,
    inspectionRef: 'CAL-AUDIT-2026-09',
    history: [
      {
        id: 'hist-4',
        timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
        action: 'placed',
        actorName: 'Sanjay Deshmukh',
        actorRole: 'Quality Assurance Manager',
        notes: 'Quality Hold enacted per IATF 16949 Section 7.1.5. Calibrated replacement gage deployed for 100% re-inspection.'
      }
    ]
  },
  {
    id: 'HLD-2026-0039',
    targetType: 'work_order',
    targetId: 'wo-hub-03',
    targetNumber: 'WO-2026-0003',
    salesOrderId: 'so-krl-01',
    salesOrderNumber: 'SO-2026-0010',
    workOrderNumber: 'WO-2026-0003',
    batchNumber: 'BATCH-HUB-881',
    partName: 'Alloy Hub Adapter',
    partCode: 'AHA-4140',
    customerName: 'Kirloskar Oil Engines',
    customerPoNumber: 'PO-KOE-7731',
    quantity: 150,
    unit: 'pcs',
    status: 'released',
    severity: 'major',
    holdReasonCategory: 'surface_finish',
    holdReason: 'Micro-scratches on inner sealing face after CNC turning operation.',
    holdDescription: 'Visual inspection flagged Ra 1.6µm finish roughness exceeded drawing max Ra 0.8µm on sealing face.',
    location: 'Released to Dispatch Staging Area',
    placedBy: 'Rajesh Varma',
    placedByRole: 'Senior Quality Inspector',
    placedAt: new Date(Date.now() - 96 * 3600000).toISOString(),
    preventDispatch: false,
    preventProductionProgression: false,
    ncrId: 'NCR-2026-0099',
    inspectionRef: 'IPQC-2026-0199',
    releaseWorkflow: {
      releasedBy: 'Dr. Ashok Nair',
      releasedByRole: 'Head of Quality Assurance & Compliance',
      releasedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      authorityCredentials: 'QA-DIR-IATF-LEAD-2026',
      releaseDisposition: 'rework_verified',
      releaseJustification: 'All 150 parts underwent light honing rework on precision lathe and 100% surface roughness profilometer measurement. Average Ra verified at 0.42µm (within 0.8µm specification). Customer engineering concession formally approved.',
      verificationChecklist: {
        reInspectionDone: true,
        rootCauseIdentified: true,
        quarantineTagRemoved: true,
        customerConcessionAttached: true,
        documentationUpdated: true
      },
      electronicSignature: 'SIG-QA-AUTH-ASHOK-NAIR-2026-10-12-99824',
      notes: 'Cleared for immediate packaging and dispatch release.'
    },
    history: [
      {
        id: 'hist-5',
        timestamp: new Date(Date.now() - 96 * 3600000).toISOString(),
        action: 'placed',
        actorName: 'Rajesh Varma',
        actorRole: 'Senior Quality Inspector',
        notes: 'Placed on hold due to sealing face surface finish roughness.'
      },
      {
        id: 'hist-6',
        timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
        action: 'released',
        actorName: 'Dr. Ashok Nair',
        actorRole: 'Head of Quality Assurance',
        notes: 'Formally released with digital sign-off and Certificate of Conformance endorsement.'
      }
    ]
  },
  {
    id: 'HLD-2026-0035',
    targetType: 'lot',
    targetId: 'lot-ss-raw',
    targetNumber: 'LOT-RM-SS316-09',
    partName: 'Stainless Steel Bar Stock Ø65mm',
    partCode: 'RM-SS316-BAR',
    customerName: 'Internal Raw Materials Inventory',
    quantity: 450,
    unit: 'kg',
    status: 'quarantined',
    severity: 'critical',
    holdReasonCategory: 'material_chemistry',
    holdReason: 'Spectrometer test indicates Carbon content 0.09% (exceeds SS316L max 0.03%).',
    holdDescription: 'Inbound raw material lot failed optical emission spectrometry test. Supplier supplied standard 316 instead of extra-low carbon 316L. Return to Vendor (RTV) non-conformance logged.',
    location: 'Quarantine Red Zone — Scrap & RTV Yard',
    placedBy: 'Anita Sharma',
    placedByRole: 'Materials QA Specialist',
    placedAt: new Date(Date.now() - 140 * 3600000).toISOString(),
    preventDispatch: true,
    preventProductionProgression: true,
    ncrId: 'NCR-2026-0089',
    history: [
      {
        id: 'hist-7',
        timestamp: new Date(Date.now() - 140 * 3600000).toISOString(),
        action: 'placed',
        actorName: 'Anita Sharma',
        actorRole: 'Materials QA Specialist',
        notes: 'Inbound raw material rejected at IQC and locked down.'
      },
      {
        id: 'hist-8',
        timestamp: new Date(Date.now() - 80 * 3600000).toISOString(),
        action: 'quarantined',
        actorName: 'Sanjay Deshmukh',
        actorRole: 'Quality Assurance Manager',
        notes: 'Consignment locked in RTV scrap yard. Supplier debited.'
      }
    ]
  }
];

class QualityHoldService {
  private holds: QualityHoldRecord[] = [];

  constructor() {
    this.loadHolds();
  }

  private loadHolds(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.holds = JSON.parse(stored);
      } else {
        this.holds = [...SEED_QUALITY_HOLDS];
        this.saveHolds();
      }
    } catch (e) {
      console.warn('[QualityHoldService] Failed to load holds from storage:', e);
      this.holds = [...SEED_QUALITY_HOLDS];
    }
  }

  private saveHolds(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.holds));
    } catch (e) {
      console.error('[QualityHoldService] Failed to save holds:', e);
    }
  }

  public getAllHolds(filters?: QualityHoldFilterOptions): QualityHoldRecord[] {
    let result = [...this.holds];

    if (!filters) {
      return result.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(h => 
        h.id.toLowerCase().includes(q) ||
        h.targetNumber.toLowerCase().includes(q) ||
        h.partName.toLowerCase().includes(q) ||
        (h.partCode && h.partCode.toLowerCase().includes(q)) ||
        h.customerName.toLowerCase().includes(q) ||
        (h.salesOrderNumber && h.salesOrderNumber.toLowerCase().includes(q)) ||
        (h.workOrderNumber && h.workOrderNumber.toLowerCase().includes(q)) ||
        (h.batchNumber && h.batchNumber.toLowerCase().includes(q)) ||
        h.holdReason.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q)
      );
    }

    if (filters.status && filters.status !== 'all') {
      result = result.filter(h => h.status === filters.status);
    }

    if (filters.targetType && filters.targetType !== 'all') {
      result = result.filter(h => h.targetType === filters.targetType);
    }

    if (filters.severity && filters.severity !== 'all') {
      result = result.filter(h => h.severity === filters.severity);
    }

    if (filters.reasonCategory && filters.reasonCategory !== 'all') {
      result = result.filter(h => h.holdReasonCategory === filters.reasonCategory);
    }

    return result.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  }

  public getHoldById(id: string): QualityHoldRecord | undefined {
    return this.holds.find(h => h.id === id);
  }

  public getActiveHoldForJob(targetIdOrNumber: string): QualityHoldRecord | undefined {
    const q = (targetIdOrNumber || '').toLowerCase().trim();
    return this.holds.find(h => 
      h.status === 'active_hold' &&
      h.preventProductionProgression !== false &&
      (
        h.targetId.toLowerCase() === q ||
        h.targetNumber.toLowerCase() === q ||
        (h.workOrderNumber && h.workOrderNumber.toLowerCase() === q) ||
        (h.salesOrderNumber && h.salesOrderNumber.toLowerCase() === q)
      )
    );
  }

  public getActiveHoldForTarget(identifier: string): QualityHoldRecord | undefined {
    if (!identifier) return undefined;
    const clean = identifier.trim().toLowerCase();
    return this.holds.find(h => 
      h.status === 'active_hold' && (
        h.targetNumber.toLowerCase() === clean ||
        h.targetId.toLowerCase() === clean ||
        (h.workOrderNumber && h.workOrderNumber.toLowerCase() === clean) ||
        (h.batchNumber && h.batchNumber.toLowerCase() === clean) ||
        (h.salesOrderNumber && h.salesOrderNumber.toLowerCase() === clean) ||
        (h.salesOrderId && h.salesOrderId.toLowerCase() === clean)
      )
    );
  }

  /**
   * Acceptance Criteria: "dispatch blocked"
   * Evaluates if any active quality holds exist for this order, WO, or batch
   */
  public checkDispatchBlock(orderIdOrNumber: string, woNumber?: string, batchNumber?: string): DispatchHoldCheck {
    if (!orderIdOrNumber && !woNumber && !batchNumber) {
      return { isBlocked: false, blockingHolds: [], blockReason: '' };
    }

    const identifiers = [orderIdOrNumber, woNumber, batchNumber]
      .filter((s): s is string => Boolean(s && s.trim()))
      .map(s => s.trim().toLowerCase());

    const activeHolds = this.holds.filter(h => {
      if (h.status !== 'active_hold' || !h.preventDispatch) return false;
      return identifiers.some(id => 
        h.targetNumber.toLowerCase() === id ||
        h.targetId.toLowerCase() === id ||
        (h.workOrderNumber && h.workOrderNumber.toLowerCase() === id) ||
        (h.batchNumber && h.batchNumber.toLowerCase() === id) ||
        (h.salesOrderNumber && h.salesOrderNumber.toLowerCase() === id) ||
        (h.salesOrderId && h.salesOrderId.toLowerCase() === id)
      );
    });

    if (activeHolds.length > 0) {
      const topHold = activeHolds[0];
      return {
        isBlocked: true,
        blockingHolds: activeHolds,
        blockReason: `QUALITY HOLD ACTIVE [${topHold.id}]: Batch/WO ${topHold.targetNumber} (${topHold.partName}) is under Quality Containment. Reason: ${topHold.holdReason}. Quarantine Location: ${topHold.location}. Dispatch release is strictly blocked until authorized Quality Authority sign-off.`
      };
    }

    return {
      isBlocked: false,
      blockingHolds: [],
      blockReason: ''
    };
  }

  /**
   * Acceptance Criteria: "Hold flag on WO/batch"
   */
  public placeHold(params: {
    targetType: QualityHoldRecord['targetType'];
    targetId: string;
    targetNumber: string;
    partName: string;
    partCode?: string;
    customerName: string;
    customerPoNumber?: string;
    salesOrderId?: string;
    salesOrderNumber?: string;
    workOrderNumber?: string;
    batchNumber?: string;
    quantity: number;
    unit?: string;
    severity: QualityHoldRecord['severity'];
    holdReasonCategory: QualityHoldRecord['holdReasonCategory'];
    holdReason: string;
    holdDescription: string;
    location: string;
    placedBy: string;
    placedByRole: string;
    ncrId?: string;
    inspectionRef?: string;
    preventProductionProgression?: boolean;
  }): QualityHoldRecord {
    const nextSeq = this.holds.length + 40;
    const holdId = `HLD-2026-00${nextSeq}`;

    const newHold: QualityHoldRecord = {
      id: holdId,
      targetType: params.targetType,
      targetId: params.targetId,
      targetNumber: params.targetNumber,
      partName: params.partName,
      partCode: params.partCode,
      customerName: params.customerName,
      customerPoNumber: params.customerPoNumber,
      salesOrderId: params.salesOrderId,
      salesOrderNumber: params.salesOrderNumber,
      workOrderNumber: params.workOrderNumber,
      batchNumber: params.batchNumber,
      quantity: params.quantity,
      unit: params.unit || 'pcs',
      status: 'active_hold',
      severity: params.severity,
      holdReasonCategory: params.holdReasonCategory,
      holdReason: params.holdReason,
      holdDescription: params.holdDescription,
      location: params.location,
      placedBy: params.placedBy,
      placedByRole: params.placedByRole,
      placedAt: new Date().toISOString(),
      preventDispatch: true,
      preventProductionProgression: params.preventProductionProgression !== undefined ? params.preventProductionProgression : true,
      ncrId: params.ncrId,
      inspectionRef: params.inspectionRef,
      history: [
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'placed',
          actorName: params.placedBy,
          actorRole: params.placedByRole,
          notes: `Quality Hold initiated. Non-conformance: ${params.holdReason}. Material quarantined to ${params.location}.`
        }
      ]
    };

    this.holds.unshift(newHold);
    this.saveHolds();
    return newHold;
  }

  /**
   * Acceptance Criteria: "release workflow with authority"
   */
  public releaseHold(
    holdId: string,
    releaseData: QualityHoldReleaseWorkflow
  ): QualityHoldRecord {
    const hold = this.holds.find(h => h.id === holdId);
    if (!hold) {
      throw new Error(`Quality Hold with ID ${holdId} not found.`);
    }

    hold.status = releaseData.releaseDisposition === 'scrapped_disposed' ? 'scrapped' : 'released';
    hold.preventDispatch = false;
    hold.preventProductionProgression = false;
    hold.releaseWorkflow = {
      ...releaseData,
      releasedAt: releaseData.releasedAt || new Date().toISOString()
    };

    const actionText = releaseData.releaseDisposition === 'scrapped_disposed' ? 'scrapped' : 'released';

    hold.history.push({
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: actionText,
      actorName: releaseData.releasedBy,
      actorRole: releaseData.releasedByRole,
      notes: `Hold formally ${actionText} under disposition "${releaseData.releaseDisposition}". Justification: ${releaseData.releaseJustification}. Authority Stamp: ${releaseData.authorityCredentials} (${releaseData.electronicSignature}).`
    });

    this.saveHolds();
    return hold;
  }

  public addHistoryNote(
    holdId: string,
    actorName: string,
    actorRole: string,
    notes: string
  ): QualityHoldRecord {
    const hold = this.holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold ${holdId} not found.`);

    hold.history.push({
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'updated',
      actorName,
      actorRole,
      notes
    });

    this.saveHolds();
    return hold;
  }

  public quarantineHold(
    holdId: string,
    actorName: string,
    actorRole: string,
    newLocation: string,
    reason: string
  ): QualityHoldRecord {
    const hold = this.holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold ${holdId} not found.`);

    hold.status = 'quarantined';
    hold.location = newLocation;
    hold.history.push({
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'quarantined',
      actorName,
      actorRole,
      notes: `Escalated to Hard Physical Quarantine in ${newLocation}. Reason: ${reason}`
    });

    this.saveHolds();
    return hold;
  }

  public getKpis(): QualityHoldKpis {
    const totalHolds = this.holds.length;
    const activeHolds = this.holds.filter(h => h.status === 'active_hold').length;
    const releasedHolds = this.holds.filter(h => h.status === 'released').length;
    const quarantinedHolds = this.holds.filter(h => h.status === 'quarantined' || h.status === 'scrapped').length;
    const criticalActiveCount = this.holds.filter(h => h.status === 'active_hold' && h.severity === 'critical').length;

    // Calculate average aging for active holds in hours
    const activeList = this.holds.filter(h => h.status === 'active_hold');
    let avgAgingHours = 0;
    if (activeList.length > 0) {
      const totalHours = activeList.reduce((acc, h) => {
        const diffMs = Date.now() - new Date(h.placedAt).getTime();
        return acc + Math.max(0, diffMs / 3600000);
      }, 0);
      avgAgingHours = Math.round(totalHours / activeList.length);
    }

    return {
      totalHolds,
      activeHolds,
      releasedHolds,
      quarantinedHolds,
      avgAgingHours,
      criticalActiveCount
    };
  }

  public exportCsv(filters?: QualityHoldFilterOptions): void {
    const data = this.getAllHolds(filters);
    const headers = [
      'Hold ID',
      'Status',
      'Severity',
      'Target Type',
      'Target Number',
      'Part SKU',
      'Part Description',
      'Customer',
      'Quantity',
      'Unit',
      'Containment Location',
      'Reason Category',
      'Hold Reason Summary',
      'Prevent Dispatch',
      'Placed By',
      'Placed Date',
      'Released By',
      'Release Date',
      'Release Disposition',
      'Authority E-Signature'
    ];

    const rows = data.map(h => [
      h.id,
      h.status.toUpperCase(),
      h.severity.toUpperCase(),
      h.targetType,
      `"${h.targetNumber.replace(/"/g, '""')}"`,
      `"${(h.partCode || '').replace(/"/g, '""')}"`,
      `"${h.partName.replace(/"/g, '""')}"`,
      `"${h.customerName.replace(/"/g, '""')}"`,
      h.quantity,
      h.unit,
      `"${h.location.replace(/"/g, '""')}"`,
      h.holdReasonCategory,
      `"${h.holdReason.replace(/"/g, '""')}"`,
      h.preventDispatch ? 'YES' : 'NO',
      `"${h.placedBy.replace(/"/g, '""')}"`,
      h.placedAt,
      `"${(h.releaseWorkflow?.releasedBy || '').replace(/"/g, '""')}"`,
      h.releaseWorkflow?.releasedAt || '',
      h.releaseWorkflow?.releaseDisposition || '',
      `"${(h.releaseWorkflow?.electronicSignature || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Quality_Holds_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const qualityHoldService = new QualityHoldService();
