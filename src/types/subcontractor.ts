// src/types/subcontractor.ts

export type SubcontractOperationCategory =
  | 'heat_treatment'       // Induction hardening, Case carburizing, Annealing, Nitriding
  | 'electroplating'       // Hard chrome, Zinc trivalent, Electroless Nickel (ENP), Anodizing
  | 'coating_painting'     // Powder coating, Epoxy painting, Teflon coating, Thermal spray
  | 'cnc_machining'        // 4/5-Axis VMC milling, CNC turning, Turn-mill center
  | 'laser_cutting'        // CNC Fiber laser cutting, Waterjet, Sheet metal bending
  | 'grinding_edm'         // Cylindrical grinding, Surface grinding, Wire EDM, Spark erosion
  | 'gear_cutting'         // Gear hobbing, Gear shaping, Broaching, Spline cutting
  | 'testing_inspection'   // Ultrasonic/Radiography NDT, Dynamic balancing, CMM inspection
  | 'other';

export const SUBCONTRACT_CATEGORIES: { id: SubcontractOperationCategory; label: string; iconName?: string; desc: string }[] = [
  { id: 'heat_treatment', label: 'Heat Treatment', desc: 'Induction hardening, case carburizing, tempering, annealing' },
  { id: 'electroplating', label: 'Electroplating & Surface Treatment', desc: 'Hard chrome, zinc trivalent, nickel plating, anodizing' },
  { id: 'coating_painting', label: 'Powder Coating & Painting', desc: 'Industrial powder coating, 7-tank epoxy, thermal spray' },
  { id: 'cnc_machining', label: 'CNC Machining (Outsourced)', desc: '4/5-Axis VMC milling, CNC turning, heavy horizontal boring' },
  { id: 'laser_cutting', label: 'Laser Cutting & Bending', desc: 'High-power fiber laser profiling, CNC press brake bending' },
  { id: 'grinding_edm', label: 'Precision Grinding & Wire EDM', desc: 'Cylindrical grinding, centerless, surface, wire electrical discharge' },
  { id: 'gear_cutting', label: 'Gear Hobbing & Broaching', desc: 'Gear hobbing, gear shaping, internal broaching, spline cutting' },
  { id: 'testing_inspection', label: 'NDT Testing & Inspection', desc: 'Radiography, ultrasonic NDT, dynamic balancing, CMM dimensional check' },
  { id: 'other', label: 'Other Special Operations', desc: 'Shot blasting, rubber lining, laser cladding, special fabrication' }
];

export interface Subcontractor {
  id: string;
  tenantId: string;
  plantId?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  categories: SubcontractOperationCategory[];
  capabilitiesSummary: string;
  city: string;
  address?: string;
  gstNumber?: string;
  rating: number; // 1 to 5
  qualityTier: 'A+' | 'A' | 'B' | 'Probationary';
  typicalLeadTimeDays: number;
  paymentTerms: string;
  transportIncluded: boolean;
  status: 'active' | 'preferred' | 'on_hold' | 'inactive';
  notes?: string;
  createdAt: any;
  updatedAt?: any;
}

export type SubcontractRfqStatus =
  | 'draft'
  | 'broadcasted'
  | 'quotes_received'
  | 'under_evaluation'
  | 'awarded'
  | 'cancelled';

export interface SubcontractRfqItem {
  id: string;
  partName: string;
  partNumber?: string;
  materialGrade: string;
  quantity: number;
  unit: string;
  drawingRef?: string;
  specsAndNotes: string;
  targetUnitPrice?: number;
}

export interface SubcontractorQuoteBid {
  id: string;
  rfqId: string;
  subcontractorId: string;
  subcontractorName: string;
  vendorRating?: number;
  vendorQualityTier?: string;
  unitPrice: number;
  setupToolingCost: number;
  scrapRejectionAllowancePercent: number;
  leadTimeDays: number;
  logisticsIncluded: boolean;
  logisticsCost?: number;
  paymentTerms: string;
  validityDate?: string;
  technicalNotes?: string;
  submittedAt: string;
  status: 'received' | 'under_review' | 'counter_offered' | 'awarded' | 'rejected';
}

export interface SubcontractAwardDecision {
  rfqId: string;
  awardedBidId: string;
  subcontractorId: string;
  subcontractorName: string;
  awardedUnitPrice: number;
  awardedTotalAmount: number;
  poNumber: string; // e.g. SPO-2026-0042
  poDate: string;
  deliveryDate: string;
  decisionReason: string;
  isL1Bidder: boolean;
  awardedBy: string;
  awardedByName: string;
  awardedAt: string;
  linkedOrderId?: string;
  linkedJobId?: string;
}

export interface SubcontractRfq {
  id: string;
  rfqNumber: string; // e.g. SRFQ-2026-0012
  tenantId: string;
  plantId?: string;
  title: string;
  operationCategory: SubcontractOperationCategory;
  linkedOrderId?: string;
  linkedOrderNumber?: string;
  linkedJobId?: string;
  linkedJobName?: string;
  items: SubcontractRfqItem[];
  invitedSubcontractorIds: string[];
  invitedSubcontractors?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    broadcastedAt?: string;
  }[];
  bids: SubcontractorQuoteBid[];
  awardDecision?: SubcontractAwardDecision;
  status: SubcontractRfqStatus;
  broadcastDate?: string;
  requiredDeliveryDate: string;
  quoteDeadlineDate: string;
  specialInstructions?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  updatedAt?: any;
}
