// src/services/subcontractorService.ts

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Subcontractor, 
  SubcontractRfq, 
  SubcontractorQuoteBid, 
  SubcontractAwardDecision,
  SubcontractOperationCategory
} from '../types/subcontractor';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { logActivityEvent } from '../utils/activityLogger';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

// ── DEFAULT CERTIFIED SUBCONTRACTORS MASTER DATA ─────────────────────────────
export const DEFAULT_SUBCONTRACTORS: Subcontractor[] = [
  {
    id: 'sub-pragati',
    tenantId: 'default',
    name: 'Pragati Heat Treaters (Pvt) Ltd',
    contactPerson: 'Suresh Nambiar',
    phone: '+91 98450 12891',
    email: 'suresh@pragatiheattreat.in',
    categories: ['heat_treatment'],
    capabilitiesSummary: 'Induction Hardening up to 2.2m shaft length, Sealed Quench Furnace for Case Carburizing (58-62 HRC), Gas Nitriding.',
    city: 'Peenya Industrial Area, Bengaluru',
    address: 'Plot 48/B, Phase 2, Peenya Industrial Area, Bengaluru, Karnataka 560058',
    gstNumber: '29AABCP8921K1ZT',
    rating: 4.9,
    qualityTier: 'A+',
    typicalLeadTimeDays: 4,
    paymentTerms: '30 Days Net',
    transportIncluded: true,
    status: 'preferred',
    notes: 'ISO 9001:2015 certified. Fast turnaround for automotive & pump shafts.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sub-apex',
    tenantId: 'default',
    name: 'Apex Precision CNC Works',
    contactPerson: 'Kailash Deshmukh',
    phone: '+91 98221 44502',
    email: 'kailash@apexcncworks.com',
    categories: ['cnc_machining', 'gear_cutting'],
    capabilitiesSummary: '5-Axis Mazak VMC, Doosan CNC Turning centers (Dia 400mm max), CNC Gear Hobber for spur & helical gears (Mod 1 to 8).',
    city: 'Bhosari MIDC, Pune',
    address: 'Sector 7, PCMC Industrial Cluster, Bhosari MIDC, Pune, Maharashtra 411026',
    gstNumber: '27AABCA4312M1ZM',
    rating: 4.7,
    qualityTier: 'A',
    typicalLeadTimeDays: 7,
    paymentTerms: '45 Days Net',
    transportIncluded: false,
    status: 'preferred',
    notes: 'Specialist in heavy flange milling and gear spline cutting.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sub-chamunda',
    tenantId: 'default',
    name: 'Shree Chamunda Electroplaters',
    contactPerson: 'M. Selvaraj',
    phone: '+91 94441 87620',
    email: 'selva@chamundaplating.in',
    categories: ['electroplating'],
    capabilitiesSummary: 'Hard Chrome Plating (20-60 microns, Ra 0.2 finish), Electroless Nickel Plating (ENP High Phos), Trivalent Zinc Passivation.',
    city: 'Ambattur Industrial Estate, Chennai',
    address: 'No. 12-A, South Phase, Ambattur Industrial Estate, Chennai, Tamil Nadu 600058',
    gstNumber: '33AAECS5431P1ZD',
    rating: 4.6,
    qualityTier: 'A',
    typicalLeadTimeDays: 5,
    paymentTerms: '30 Days Net',
    transportIncluded: true,
    status: 'preferred',
    notes: 'Strict plating thickness verification with digital eddy-current gauges.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sub-lasertech',
    tenantId: 'default',
    name: 'LaserTech Metalcrafts LLP',
    contactPerson: 'Gaurav Singhal',
    phone: '+91 98110 59231',
    email: 'gaurav@lasertechmetal.com',
    categories: ['laser_cutting'],
    capabilitiesSummary: '12kW Fiber Laser (cuts MS up to 32mm, SS up to 25mm), 250T CNC Press Brake for high-precision multi-bend sheet fabrications.',
    city: 'IMT Manesar, Gurugram',
    address: 'Plot 182, Sector 8, IMT Manesar, Gurugram, Haryana 122051',
    gstNumber: '06AALCL9814G1ZF',
    rating: 4.8,
    qualityTier: 'A+',
    typicalLeadTimeDays: 3,
    paymentTerms: '100% Against Delivery',
    transportIncluded: false,
    status: 'preferred',
    notes: 'Same-day quotation turnaround, nesting optimization for low scrap.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sub-microfinish',
    tenantId: 'default',
    name: 'MicroFinish Grinding & EDM Solutions',
    contactPerson: 'Bhavin Patel',
    phone: '+91 98250 33819',
    email: 'bhavin@microfinishprecision.com',
    categories: ['grinding_edm'],
    capabilitiesSummary: 'High-precision Cylindrical Grinding (sub-micron ±0.002mm), Internal Bore Grinding, Sodick Wire EDM for die matrices.',
    city: 'Vatva GIDC, Ahmedabad',
    address: 'Phase 3, Vatva GIDC Industrial Park, Ahmedabad, Gujarat 382445',
    gstNumber: '24AABCM7619N1ZL',
    rating: 4.5,
    qualityTier: 'A',
    typicalLeadTimeDays: 6,
    paymentTerms: '30 Days Net',
    transportIncluded: false,
    status: 'active',
    notes: 'Air-conditioned grinding bay for tight thermal stability.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sub-duracoat',
    tenantId: 'default',
    name: 'Duracoat Industrial Finishes',
    contactPerson: 'C. K. Ramaswamy',
    phone: '+91 97410 82194',
    email: 'ramaswamy@duracoat.co.in',
    categories: ['coating_painting'],
    capabilitiesSummary: '7-Tank Automated Pre-treatment, Epoxy & Pure Polyester Powder Coating (RAL Shades), 1000-hr Salt Spray Test compliant.',
    city: 'Peenya Industrial Area, Bengaluru',
    address: 'No. 34, 3rd Cross, Peenya 1st Stage, Bengaluru, Karnataka 560058',
    gstNumber: '29AADCD1943R1ZS',
    rating: 4.4,
    qualityTier: 'B',
    typicalLeadTimeDays: 4,
    paymentTerms: '30 Days Net',
    transportIncluded: true,
    status: 'active',
    notes: 'Large conveyorized oven for high batch runs.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sub-kalyani',
    tenantId: 'default',
    name: 'Kalyani Thermal Dynamics',
    contactPerson: 'Manoj Joshi',
    phone: '+91 98900 66211',
    email: 'mjoshi@kalyanithermal.in',
    categories: ['heat_treatment'],
    capabilitiesSummary: 'Vacuum Heat Treatment for tool steels (H13, D2), Sub-zero cryogenic treatment (-196°C), Stress Relieving up to 5 tons.',
    city: 'Chakan MIDC, Pune',
    address: 'Plot 79, Chakan Industrial Area Phase 2, Pune, Maharashtra 410501',
    gstNumber: '27AAACK6129F1ZK',
    rating: 4.8,
    qualityTier: 'A+',
    typicalLeadTimeDays: 5,
    paymentTerms: '30 Days Net',
    transportIncluded: false,
    status: 'active',
    notes: 'Zero decarburization guarantee on high alloy tool steels.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sub-sunshine',
    tenantId: 'default',
    name: 'Sunshine Surface Technologies',
    contactPerson: 'Dinesh Pillai',
    phone: '+91 98840 91823',
    email: 'dinesh@sunshinesurface.com',
    categories: ['electroplating', 'coating_painting'],
    capabilitiesSummary: 'Hard Anodizing (Type III 50 microns), Chromate Conversion Coating (Alodine 1200), Black Oxide chemical treatment.',
    city: 'Sriperumbudur Industrial Hub, Chennai',
    address: 'SIPCOT Industrial Park, Sriperumbudur, Tamil Nadu 602105',
    gstNumber: '33AASSS2918Q1ZC',
    rating: 4.5,
    qualityTier: 'A',
    typicalLeadTimeDays: 5,
    paymentTerms: '15 Days Net',
    transportIncluded: true,
    status: 'active',
    notes: 'Defence & aerospace approved surface finishing facility.',
    createdAt: new Date().toISOString()
  }
];

// ── DEFAULT INITIAL SUBCONTRACT RFQS WITH REALISTIC BIDS ──────────────────────
export const DEFAULT_SUBCONTRACT_RFQS: SubcontractRfq[] = [
  {
    id: 'srfq-001',
    rfqNumber: 'SRFQ-2026-0001',
    tenantId: 'default',
    title: 'Induction Hardening & Nitriding for Spur Gears (80 Units)',
    operationCategory: 'heat_treatment',
    linkedOrderNumber: 'SO-2026-0001',
    linkedJobName: 'Forged Steel Spur Gear (Mod 4, 32T)',
    items: [
      {
        id: 'srfq-item-1',
        partName: 'Spur Gear Teeth Pitch Circle Induction Hardening',
        partNumber: 'GEAR-MOD4-32T',
        materialGrade: 'EN19 Normalized / 4140',
        quantity: 80,
        unit: 'pcs',
        drawingRef: 'DRG-AF-GR-2026-08',
        specsAndNotes: 'Induction Harden gear teeth to 54-58 HRC. Effective case depth: 1.8mm to 2.2mm. Mask central bore & keyway.',
        targetUnitPrice: 240
      }
    ],
    invitedSubcontractorIds: ['sub-pragati', 'sub-kalyani'],
    invitedSubcontractors: [
      { id: 'sub-pragati', name: 'Pragati Heat Treaters (Pvt) Ltd', phone: '+91 98450 12891', email: 'suresh@pragatiheattreat.in', broadcastedAt: '2026-10-04T10:15:00Z' },
      { id: 'sub-kalyani', name: 'Kalyani Thermal Dynamics', phone: '+91 98900 66211', email: 'mjoshi@kalyanithermal.in', broadcastedAt: '2026-10-04T10:15:00Z' }
    ],
    bids: [
      {
        id: 'bid-101',
        rfqId: 'srfq-001',
        subcontractorId: 'sub-pragati',
        subcontractorName: 'Pragati Heat Treaters (Pvt) Ltd',
        vendorRating: 4.9,
        vendorQualityTier: 'A+',
        unitPrice: 220,
        setupToolingCost: 1500,
        scrapRejectionAllowancePercent: 1.0,
        leadTimeDays: 3,
        logisticsIncluded: true,
        logisticsCost: 0,
        paymentTerms: '30 Days Net',
        validityDate: '2026-11-15',
        technicalNotes: 'Induction coil fixture available for Mod 4 32T. Immediate loading possible. Free pickup & drop.',
        submittedAt: '2026-10-05T09:30:00Z',
        status: 'received'
      },
      {
        id: 'bid-102',
        rfqId: 'srfq-001',
        subcontractorId: 'sub-kalyani',
        subcontractorName: 'Kalyani Thermal Dynamics',
        vendorRating: 4.8,
        vendorQualityTier: 'A+',
        unitPrice: 260,
        setupToolingCost: 2000,
        scrapRejectionAllowancePercent: 0.5,
        leadTimeDays: 5,
        logisticsIncluded: false,
        logisticsCost: 1200,
        paymentTerms: '30 Days Net',
        validityDate: '2026-11-20',
        technicalNotes: 'Dual-frequency induction scanner. Microstructure & case depth test certificates included with lot.',
        submittedAt: '2026-10-05T14:15:00Z',
        status: 'received'
      }
    ],
    status: 'quotes_received',
    broadcastDate: '2026-10-04T10:15:00Z',
    requiredDeliveryDate: '2026-10-25',
    quoteDeadlineDate: '2026-10-10',
    specialInstructions: 'Critical: Maintain runout within 0.03mm after quench. Hardness test report mandatory with each batch.',
    createdBy: 'procurement_lead',
    createdByName: 'V. Raman (Procurement Mgr)',
    createdAt: '2026-10-04T10:00:00Z'
  },
  {
    id: 'srfq-002',
    rfqNumber: 'SRFQ-2026-0002',
    tenantId: 'default',
    title: 'Hard Chrome Plating 35-40 Micron for Hydraulic Piston Rods (50 Units)',
    operationCategory: 'electroplating',
    linkedOrderNumber: 'SO-2026-0002',
    linkedJobName: 'High-Pressure Hydraulic Ram Rod',
    items: [
      {
        id: 'srfq-item-2',
        partName: 'Hydraulic Piston Rod OD Plating',
        partNumber: 'CYL-ROD-50-650',
        materialGrade: 'EN8D Induction Hardened Chrome-Plated Steel',
        quantity: 50,
        unit: 'pcs',
        drawingRef: 'HYD-ROD-650-R2',
        specsAndNotes: 'Hard Chrome Plating 35 to 40 microns thick. Surface roughness Ra ≤ 0.2 µm. 100-hr salt spray rating minimum.',
        targetUnitPrice: 480
      }
    ],
    invitedSubcontractorIds: ['sub-chamunda', 'sub-sunshine'],
    invitedSubcontractors: [
      { id: 'sub-chamunda', name: 'Shree Chamunda Electroplaters', phone: '+91 94441 87620', email: 'selva@chamundaplating.in', broadcastedAt: '2026-10-02T11:00:00Z' },
      { id: 'sub-sunshine', name: 'Sunshine Surface Technologies', phone: '+91 98840 91823', email: 'dinesh@sunshinesurface.com', broadcastedAt: '2026-10-02T11:00:00Z' }
    ],
    bids: [
      {
        id: 'bid-201',
        rfqId: 'srfq-002',
        subcontractorId: 'sub-chamunda',
        subcontractorName: 'Shree Chamunda Electroplaters',
        vendorRating: 4.6,
        vendorQualityTier: 'A',
        unitPrice: 450,
        setupToolingCost: 1000,
        scrapRejectionAllowancePercent: 1.0,
        leadTimeDays: 4,
        logisticsIncluded: true,
        logisticsCost: 0,
        paymentTerms: '30 Days Net',
        validityDate: '2026-11-01',
        technicalNotes: 'Vertical plating tanks prevent distortion. Micro-crack chrome finish for extended seal lifespan.',
        submittedAt: '2026-10-03T11:20:00Z',
        status: 'awarded'
      },
      {
        id: 'bid-202',
        rfqId: 'srfq-002',
        subcontractorId: 'sub-sunshine',
        subcontractorName: 'Sunshine Surface Technologies',
        vendorRating: 4.5,
        vendorQualityTier: 'A',
        unitPrice: 510,
        setupToolingCost: 1800,
        scrapRejectionAllowancePercent: 2.0,
        leadTimeDays: 6,
        logisticsIncluded: true,
        logisticsCost: 0,
        paymentTerms: '15 Days Net',
        validityDate: '2026-11-05',
        technicalNotes: 'High-build chrome plating with final superfinishing belt polishing.',
        submittedAt: '2026-10-03T16:45:00Z',
        status: 'rejected'
      }
    ],
    awardDecision: {
      rfqId: 'srfq-002',
      awardedBidId: 'bid-201',
      subcontractorId: 'sub-chamunda',
      subcontractorName: 'Shree Chamunda Electroplaters',
      awardedUnitPrice: 450,
      awardedTotalAmount: 23500, // 50 * 450 + 1000 setup
      poNumber: 'SPO-2026-0018',
      poDate: '2026-10-04',
      deliveryDate: '2026-10-18',
      decisionReason: 'Awarded to L1 bidder (Shree Chamunda). Lowest total landed cost of ₹23,500 with included logistics, faster 4-day turnaround, and proven hydraulic rod plating track record.',
      isL1Bidder: true,
      awardedBy: 'procurement_lead',
      awardedByName: 'V. Raman (Procurement Mgr)',
      awardedAt: '2026-10-04T15:30:00Z',
      linkedOrderId: 'order_test_01'
    },
    status: 'awarded',
    broadcastDate: '2026-10-02T11:00:00Z',
    requiredDeliveryDate: '2026-10-20',
    quoteDeadlineDate: '2026-10-04',
    specialInstructions: 'Inspect with magnetic dial gauge after chrome plating. Must pass copper sulphate pinhole test.',
    createdBy: 'procurement_lead',
    createdByName: 'V. Raman (Procurement Mgr)',
    createdAt: '2026-10-02T10:30:00Z'
  },
  {
    id: 'srfq-003',
    rfqNumber: 'SRFQ-2026-0003',
    tenantId: 'default',
    title: 'High-Precision 5-Axis Milling for Impeller Casings (12 Units)',
    operationCategory: 'cnc_machining',
    linkedJobName: '10HP Submersible Pump Impeller (Bronze)',
    items: [
      {
        id: 'srfq-item-3',
        partName: '5-Axis CNC Profile Milling of Vanes',
        partNumber: 'PUMP-IMP-10HP',
        materialGrade: 'Phosphor Bronze Casting (IS 28)',
        quantity: 12,
        unit: 'pcs',
        drawingRef: 'IMP-BR-300-CAD',
        specsAndNotes: 'Multi-axis continuous contouring of curved hydrodynamic vanes. Balance to ISO 1940 Grade G2.5.',
        targetUnitPrice: 1800
      }
    ],
    invitedSubcontractorIds: ['sub-apex'],
    invitedSubcontractors: [
      { id: 'sub-apex', name: 'Apex Precision CNC Works', phone: '+91 98221 44502', email: 'kailash@apexcncworks.com', broadcastedAt: '2026-10-05T16:00:00Z' }
    ],
    bids: [],
    status: 'broadcasted',
    broadcastDate: '2026-10-05T16:00:00Z',
    requiredDeliveryDate: '2026-10-30',
    quoteDeadlineDate: '2026-10-12',
    specialInstructions: '3D STEP file attached. Soft jaws required to avoid clamping damage on raw bronze castings.',
    createdBy: 'procurement_lead',
    createdByName: 'V. Raman (Procurement Mgr)',
    createdAt: '2026-10-05T15:45:00Z'
  }
];

// ── LOCAL STORAGE REPOSITORIES & SYNC HELPERS ─────────────────────────────────

export function getCachedSubcontractors(tenantId: string): Subcontractor[] {
  try {
    const raw = localStorage.getItem(`subcontractors_${tenantId}`);
    if (!raw) {
      localStorage.setItem(`subcontractors_${tenantId}`, JSON.stringify(DEFAULT_SUBCONTRACTORS));
      return DEFAULT_SUBCONTRACTORS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached subcontractors:', e);
    return DEFAULT_SUBCONTRACTORS;
  }
}

export function saveCachedSubcontractors(tenantId: string, items: Subcontractor[]): void {
  localStorage.setItem(`subcontractors_${tenantId}`, JSON.stringify(items));
}

export function getCachedSubcontractRfqs(tenantId: string): SubcontractRfq[] {
  try {
    const raw = localStorage.getItem(`subcontract_rfqs_${tenantId}`);
    if (!raw) {
      localStorage.setItem(`subcontract_rfqs_${tenantId}`, JSON.stringify(DEFAULT_SUBCONTRACT_RFQS));
      return DEFAULT_SUBCONTRACT_RFQS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached subcontract RFQs:', e);
    return DEFAULT_SUBCONTRACT_RFQS;
  }
}

export function saveCachedSubcontractRfqs(tenantId: string, items: SubcontractRfq[]): void {
  localStorage.setItem(`subcontract_rfqs_${tenantId}`, JSON.stringify(items));
}

// ── FIRESTORE & UNIFIED CRUD API ──────────────────────────────────────────────

/**
 * Fetch all certified subcontractors for a tenant
 */
export async function fetchSubcontractors(tenantId: string, isSandboxMode: boolean = false): Promise<Subcontractor[]> {
  if (isSandboxMode || !db) {
    return getCachedSubcontractors(tenantId);
  }

  try {
    const q = query(collection(db, 'subcontractors'), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    if (snap.empty) {
      // Seed default subcontractors if empty in tenant
      for (const sub of DEFAULT_SUBCONTRACTORS) {
        await setDoc(doc(db, 'subcontractors', sub.id), { ...sub, tenantId });
      }
      return DEFAULT_SUBCONTRACTORS.map(s => ({ ...s, tenantId }));
    }
    const list: Subcontractor[] = [];
    snap.forEach(d => list.push(d.data() as Subcontractor));
    return list;
  } catch (err) {
    console.warn('Firestore query for subcontractors failed, falling back to local cache:', err);
    return getCachedSubcontractors(tenantId);
  }
}

/**
 * Create or update a subcontractor record in the database
 */
export async function saveSubcontractor(
  tenantId: string, 
  sub: Omit<Subcontractor, 'id' | 'createdAt'> & { id?: string },
  isSandboxMode: boolean = false
): Promise<Subcontractor> {
  const id = sub.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const record: Subcontractor = {
    ...sub,
    id,
    tenantId,
    createdAt: (sub as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isSandboxMode || !db) {
    const list = getCachedSubcontractors(tenantId);
    const existingIdx = list.findIndex(s => s.id === id);
    const updated = existingIdx >= 0
      ? list.map(s => s.id === id ? record : s)
      : [record, ...list];
    saveCachedSubcontractors(tenantId, updated);
  } else {
    try {
      await setDoc(doc(db, 'subcontractors', id), record);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'subcontractors');
    }
  }

  return record;
}

/**
 * Delete a subcontractor
 */
export async function deleteSubcontractor(tenantId: string, id: string, isSandboxMode: boolean = false): Promise<void> {
  if (isSandboxMode || !db) {
    const list = getCachedSubcontractors(tenantId);
    saveCachedSubcontractors(tenantId, list.filter(s => s.id !== id));
  } else {
    try {
      await deleteDoc(doc(db, 'subcontractors', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'subcontractors');
    }
  }
}

/**
 * Fetch all Subcontract RFQs for a tenant
 */
export async function fetchSubcontractRfqs(tenantId: string, isSandboxMode: boolean = false): Promise<SubcontractRfq[]> {
  if (isSandboxMode || !db) {
    return getCachedSubcontractRfqs(tenantId);
  }

  try {
    const q = query(collection(db, 'subcontractRfqs'), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    if (snap.empty) {
      // Seed initial subcontract RFQs
      for (const rfq of DEFAULT_SUBCONTRACT_RFQS) {
        await setDoc(doc(db, 'subcontractRfqs', rfq.id), { ...rfq, tenantId });
      }
      return DEFAULT_SUBCONTRACT_RFQS.map(r => ({ ...r, tenantId }));
    }
    const list: SubcontractRfq[] = [];
    snap.forEach(d => list.push(d.data() as SubcontractRfq));
    // Sort by createdAt descending
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.warn('Firestore query for subcontract RFQs failed, falling back to cache:', err);
    return getCachedSubcontractRfqs(tenantId);
  }
}

/**
 * Sequential Subcontract RFQ Number Generator (e.g. SRFQ-2026-0004)
 */
export async function generateNextSubcontractRfqNumber(tenantId: string, isSandboxMode: boolean = false): Promise<string> {
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;

  const rfqs = await fetchSubcontractRfqs(tenantId, isSandboxMode);
  rfqs.forEach(r => {
    const match = r.rfqNumber.match(/SRFQ-(\d{4})-(\d+)/i);
    if (match && parseInt(match[1], 10) === currentYear) {
      const num = parseInt(match[2], 10);
      if (num > maxSeq) maxSeq = num;
    }
  });

  const nextSeq = maxSeq + 1;
  return `SRFQ-${currentYear}-${nextSeq.toString().padStart(4, '0')}`;
}

/**
 * Sequential Subcontract Purchase Order Number Generator (e.g. SPO-2026-0042)
 */
export async function generateNextSubcontractPoNumber(tenantId: string, isSandboxMode: boolean = false): Promise<string> {
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;

  const rfqs = await fetchSubcontractRfqs(tenantId, isSandboxMode);
  rfqs.forEach(r => {
    if (r.awardDecision?.poNumber) {
      const match = r.awardDecision.poNumber.match(/SPO-(\d{4})-(\d+)/i);
      if (match && parseInt(match[1], 10) === currentYear) {
        const num = parseInt(match[2], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  return `SPO-${currentYear}-${nextSeq.toString().padStart(4, '0')}`;
}

/**
 * Create a Subcontract RFQ and optionally broadcast to selected vendors
 */
export async function createSubcontractRfq(
  options: {
    tenantId: string;
    rfqData: Omit<SubcontractRfq, 'id' | 'rfqNumber' | 'createdAt' | 'bids'>;
    subcontractors: Subcontractor[];
    actor: { userId: string; displayName: string; email?: string };
    isSandboxMode?: boolean;
    autoBroadcast?: boolean;
  }
): Promise<SubcontractRfq> {
  const { tenantId, rfqData, subcontractors, actor, isSandboxMode = false, autoBroadcast = true } = options;
  const id = `srfq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const rfqNumber = await generateNextSubcontractRfqNumber(tenantId, isSandboxMode);

  const selectedSubs = subcontractors.filter(s => rfqData.invitedSubcontractorIds.includes(s.id));
  const invitedList = selectedSubs.map(s => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    broadcastedAt: autoBroadcast ? new Date().toISOString() : undefined
  }));

  const initialStatus = autoBroadcast ? 'broadcasted' : 'draft';

  const newRfq: SubcontractRfq = {
    ...rfqData,
    id,
    rfqNumber,
    tenantId,
    invitedSubcontractors: invitedList,
    bids: [],
    status: initialStatus,
    broadcastDate: autoBroadcast ? new Date().toISOString() : undefined,
    createdBy: actor.userId,
    createdByName: actor.displayName,
    createdAt: new Date().toISOString()
  };

  // Persistence
  if (isSandboxMode || !db) {
    const list = getCachedSubcontractRfqs(tenantId);
    saveCachedSubcontractRfqs(tenantId, [newRfq, ...list]);
  } else {
    try {
      await setDoc(doc(db, 'subcontractRfqs', id), newRfq);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'subcontractRfqs');
    }
  }

  // Audit log
  logActivityEvent({
    tenantId,
    actionType: 'create',
    entityType: 'rfq',
    entityId: newRfq.id,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      email: actor.email
    },
    description: `Created Subcontract RFQ #${rfqNumber}: "${newRfq.title}" for process [${newRfq.operationCategory.toUpperCase()}]. Broadcasted to ${invitedList.length} vendors.`,
    metadata: {
      rfqNumber,
      process: newRfq.operationCategory,
      vendorsCount: invitedList.length,
      itemsCount: newRfq.items.length
    },
    isSandboxMode
  });

  // Automated WhatsApp Broadcast Simulation to Selected Subcontractors
  if (autoBroadcast) {
    for (const sub of selectedSubs) {
      try {
        await sendWhatsAppNotification({
          recipientName: sub.contactPerson || sub.name,
          recipientPhone: sub.phone,
          templateName: 'rfq_broadcast',
          tenantId,
          parameters: {
            rfqNumber,
            process: newRfq.operationCategory.replace('_', ' ').toUpperCase(),
            partName: newRfq.items[0]?.partName || 'Industrial Component',
            quantity: newRfq.items[0]?.quantity?.toString() || '1',
            deadline: new Date(newRfq.quoteDeadlineDate).toLocaleDateString('en-IN')
          }
        });
      } catch (e) {
        console.warn('Subcontractor WhatsApp alert skipped:', e);
      }
    }
  }

  return newRfq;
}

/**
 * Broadcast an existing RFQ to additional or all matching subcontractors
 */
export async function broadcastRfqToSubcontractors(
  options: {
    tenantId: string;
    rfqId: string;
    subcontractors: Subcontractor[];
    actor: { userId: string; displayName: string; email?: string };
    isSandboxMode?: boolean;
  }
): Promise<SubcontractRfq> {
  const { tenantId, rfqId, subcontractors, actor, isSandboxMode = false } = options;
  const list = await fetchSubcontractRfqs(tenantId, isSandboxMode);
  const target = list.find(r => r.id === rfqId);
  if (!target) throw new Error('Subcontract RFQ not found');

  const existingIds = new Set(target.invitedSubcontractorIds);
  const newSubIds = subcontractors.map(s => s.id);
  const combinedIds = Array.from(new Set([...target.invitedSubcontractorIds, ...newSubIds]));

  const updatedInvited = subcontractors.map(s => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    broadcastedAt: new Date().toISOString()
  }));

  const updated: SubcontractRfq = {
    ...target,
    invitedSubcontractorIds: combinedIds,
    invitedSubcontractors: [
      ...(target.invitedSubcontractors || []).filter(inv => !newSubIds.includes(inv.id)),
      ...updatedInvited
    ],
    status: target.status === 'draft' ? 'broadcasted' : target.status,
    broadcastDate: target.broadcastDate || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isSandboxMode || !db) {
    const updatedList = list.map(r => r.id === rfqId ? updated : r);
    saveCachedSubcontractRfqs(tenantId, updatedList);
  } else {
    try {
      await updateDoc(doc(db, 'subcontractRfqs', rfqId), updated as any);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'subcontractRfqs');
    }
  }

  // Audit log
  logActivityEvent({
    tenantId,
    actionType: 'update',
    entityType: 'rfq',
    entityId: target.id,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      email: actor.email
    },
    description: `Broadcasted Subcontract RFQ #${target.rfqNumber} to ${subcontractors.length} subcontractors via WhatsApp & Email dispatch.`,
    isSandboxMode
  });

  // Automated WhatsApp message simulation
  for (const sub of subcontractors) {
    try {
      await sendWhatsAppNotification({
        recipientName: sub.contactPerson || sub.name,
        recipientPhone: sub.phone,
        templateName: 'rfq_broadcast',
        tenantId,
        parameters: {
          rfqNumber: target.rfqNumber,
          process: target.operationCategory.replace('_', ' ').toUpperCase(),
          partName: target.items[0]?.partName || 'Precision Component',
          quantity: target.items[0]?.quantity?.toString() || '1',
          deadline: new Date(target.quoteDeadlineDate).toLocaleDateString('en-IN')
        }
      });
    } catch (e) {
      // Non-blocking
    }
  }

  return updated;
}

/**
 * Log or update an incoming vendor quotation bid for an RFQ
 */
export async function submitSubcontractorBid(
  options: {
    tenantId: string;
    rfqId: string;
    bid: Omit<SubcontractorQuoteBid, 'id' | 'rfqId' | 'submittedAt'> & { id?: string };
    actor: { userId: string; displayName: string };
    isSandboxMode?: boolean;
  }
): Promise<SubcontractRfq> {
  const { tenantId, rfqId, bid, actor, isSandboxMode = false } = options;
  const list = await fetchSubcontractRfqs(tenantId, isSandboxMode);
  const target = list.find(r => r.id === rfqId);
  if (!target) throw new Error('Subcontract RFQ not found');

  const bidId = bid.id || `bid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanBid: SubcontractorQuoteBid = {
    ...bid,
    id: bidId,
    rfqId,
    submittedAt: new Date().toISOString()
  };

  const existingBids = target.bids || [];
  const updatedBids = existingBids.some(b => b.subcontractorId === cleanBid.subcontractorId)
    ? existingBids.map(b => b.subcontractorId === cleanBid.subcontractorId ? cleanBid : b)
    : [...existingBids, cleanBid];

  const updatedStatus = target.status === 'draft' || target.status === 'broadcasted' 
    ? 'quotes_received' 
    : target.status;

  const updated: SubcontractRfq = {
    ...target,
    bids: updatedBids,
    status: updatedStatus,
    updatedAt: new Date().toISOString()
  };

  if (isSandboxMode || !db) {
    const updatedList = list.map(r => r.id === rfqId ? updated : r);
    saveCachedSubcontractRfqs(tenantId, updatedList);
  } else {
    try {
      await updateDoc(doc(db, 'subcontractRfqs', rfqId), updated as any);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'subcontractRfqs');
    }
  }

  logActivityEvent({
    tenantId,
    actionType: 'create',
    entityType: 'quotation',
    entityId: bidId,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName
    },
    description: `Logged incoming quote bid from ${cleanBid.subcontractorName} for Subcontract RFQ #${target.rfqNumber}: ₹${cleanBid.unitPrice}/pc (Lead Time: ${cleanBid.leadTimeDays}d).`,
    isSandboxMode
  });

  return updated;
}

/**
 * Quote Comparison Matrix Math Helper:
 * Total Landed Batch Cost = (Unit Price * Quantity) + Setup/Tooling Cost + Logistics (if not included)
 */
export function calculateBidLandedTotal(bid: SubcontractorQuoteBid, totalQuantity: number): number {
  const partsCost = (bid.unitPrice || 0) * (totalQuantity || 1);
  const setupCost = bid.setupToolingCost || 0;
  const transportCost = (!bid.logisticsIncluded && bid.logisticsCost) ? bid.logisticsCost : 0;
  return partsCost + setupCost + transportCost;
}

/**
 * Identifies the Lowest Cost (L1) Bidder for an RFQ
 */
export function findL1Bidder(bids: SubcontractorQuoteBid[], totalQuantity: number): SubcontractorQuoteBid | null {
  if (!bids || bids.length === 0) return null;
  let lowestBid = bids[0];
  let lowestCost = calculateBidLandedTotal(bids[0], totalQuantity);

  for (let i = 1; i < bids.length; i++) {
    const cost = calculateBidLandedTotal(bids[i], totalQuantity);
    if (cost < lowestCost) {
      lowestCost = cost;
      lowestBid = bids[i];
    }
  }

  return lowestBid;
}

/**
 * Identifies the Fastest Lead Time Bidder for an RFQ
 */
export function findFastestBidder(bids: SubcontractorQuoteBid[]): SubcontractorQuoteBid | null {
  if (!bids || bids.length === 0) return null;
  let fastest = bids[0];

  for (let i = 1; i < bids.length; i++) {
    if (bids[i].leadTimeDays < fastest.leadTimeDays) {
      fastest = bids[i];
    }
  }

  return fastest;
}

/**
 * Formal Award Decision Tracking:
 * Selects winning vendor, creates Subcontract Purchase Order (SPO#), updates bid statuses,
 * logs decision rationale and triggers alert.
 */
export async function awardSubcontractRfq(
  options: {
    tenantId: string;
    rfqId: string;
    bidId: string;
    decisionReason: string;
    deliveryDate: string;
    poNumberOverride?: string;
    actor: { userId: string; displayName: string; email?: string };
    isSandboxMode?: boolean;
  }
): Promise<SubcontractRfq> {
  const { tenantId, rfqId, bidId, decisionReason, deliveryDate, poNumberOverride, actor, isSandboxMode = false } = options;
  const list = await fetchSubcontractRfqs(tenantId, isSandboxMode);
  const target = list.find(r => r.id === rfqId);
  if (!target) throw new Error('Subcontract RFQ not found');

  const selectedBid = target.bids.find(b => b.id === bidId);
  if (!selectedBid) throw new Error('Selected quotation bid not found');

  const totalQty = target.items.reduce((sum, it) => sum + (it.quantity || 0), 0) || 1;
  const landedTotal = calculateBidLandedTotal(selectedBid, totalQty);

  const l1Bid = findL1Bidder(target.bids, totalQty);
  const isL1 = l1Bid?.id === selectedBid.id;

  const poNumber = poNumberOverride?.trim() || await generateNextSubcontractPoNumber(tenantId, isSandboxMode);

  const decision: SubcontractAwardDecision = {
    rfqId,
    awardedBidId: bidId,
    subcontractorId: selectedBid.subcontractorId,
    subcontractorName: selectedBid.subcontractorName,
    awardedUnitPrice: selectedBid.unitPrice,
    awardedTotalAmount: landedTotal,
    poNumber,
    poDate: new Date().toISOString().split('T')[0],
    deliveryDate: deliveryDate || new Date(Date.now() + (selectedBid.leadTimeDays || 7) * 24 * 3600 * 1000).toISOString().split('T')[0],
    decisionReason: decisionReason.trim(),
    isL1Bidder: isL1,
    awardedBy: actor.userId,
    awardedByName: actor.displayName,
    awardedAt: new Date().toISOString(),
    linkedOrderId: target.linkedOrderId,
    linkedJobId: target.linkedJobId
  };

  // Update bid statuses: selected becomes 'awarded', others become 'rejected'
  const updatedBids = target.bids.map(b => ({
    ...b,
    status: b.id === bidId ? ('awarded' as const) : ('rejected' as const)
  }));

  const updated: SubcontractRfq = {
    ...target,
    bids: updatedBids,
    awardDecision: decision,
    status: 'awarded',
    updatedAt: new Date().toISOString()
  };

  // Persist
  if (isSandboxMode || !db) {
    const updatedList = list.map(r => r.id === rfqId ? updated : r);
    saveCachedSubcontractRfqs(tenantId, updatedList);
  } else {
    try {
      await updateDoc(doc(db, 'subcontractRfqs', rfqId), updated as any);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'subcontractRfqs');
    }
  }

  // Audit log
  logActivityEvent({
    tenantId,
    actionType: 'create',
    entityType: 'order',
    entityId: poNumber,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      email: actor.email
    },
    description: `Awarded Subcontract RFQ #${target.rfqNumber} to ${selectedBid.subcontractorName}. Issued PO #${poNumber} for ₹${landedTotal.toLocaleString('en-IN')}. Reason: ${decisionReason}`,
    metadata: {
      rfqNumber: target.rfqNumber,
      poNumber,
      vendor: selectedBid.subcontractorName,
      unitPrice: selectedBid.unitPrice,
      totalAmount: landedTotal,
      isL1
    },
    isSandboxMode
  });

  // Automated WhatsApp Award Alert to Subcontractor
  const subRecord = (await fetchSubcontractors(tenantId, isSandboxMode)).find(s => s.id === selectedBid.subcontractorId);
  if (subRecord?.phone) {
    try {
      await sendWhatsAppNotification({
        recipientName: subRecord.contactPerson || subRecord.name,
        recipientPhone: subRecord.phone,
        templateName: 'order_confirmed',
        tenantId,
        parameters: {
          orderNumber: poNumber,
          customerPoNumber: target.rfqNumber,
          deliveryDate: new Date(decision.deliveryDate).toLocaleDateString('en-IN'),
          companyName: 'Ashrey FlowOps',
          total: landedTotal.toLocaleString('en-IN')
        }
      });
    } catch (e) {
      // Non-blocking
    }
  }

  return updated;
}
