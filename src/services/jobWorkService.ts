// src/services/jobWorkService.ts

import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  JobWorkGatePass, 
  GatePassItem, 
  JobWorkerStockBalance, 
  InwardReturnInput,
  JobWorkKPIs,
  JobWorkGRN,
  VendorStockLedgerTransaction 
} from '../types/jobWork';
import { StockItem, StockLedgerEntry } from '../types';
import { logActivityEvent } from '../utils/activityLogger';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

// ── INITIAL SEED OUTWARD GATE PASSES ──────────────────────────────────────────
export const SEED_JOB_WORK_GATE_PASSES = (tenantId: string): JobWorkGatePass[] => [
  // ── 1. PENDING #1 (Open pass, material not yet returned) ──
  {
    id: 'gp-out-001',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0001',
    type: 'outward',
    jobWorkerId: 'sub-xyz',
    jobWorkerName: 'XYZ Heat Treatment Works',
    jobWorkerGst: '27AABCT9981K1Z3',
    jobWorkerAddress: 'Plot W-41, MIDC Industrial Area, Chakan Phase 2, Pune 410501',
    jobWorkerPhone: '+91 98220 55412',
    jobWorkerContactPerson: 'Pravin Shinde',
    natureOfWork: 'Heat Treatment (Sealed Quench Carburizing to 58-62 HRC)',
    expectedReturnDate: '2026-11-10',
    dispatchedDate: '2026-11-02',
    linkedJobWorkOrderNumber: 'JWO-2026-0042',
    linkedJobWorkOrderId: 'jwo-42',
    linkedWorkOrderNumber: 'WO-2026-001',
    vehicleDetails: {
      modeOfTransport: 'road',
      transporterName: 'Direct Factory Pick-up (XYZ Logistics)',
      vehicleNumber: 'MH-12-PQ-9021',
      driverName: 'Sanjay Pawar',
      driverPhone: '+91 98901 22345',
      lrNumber: 'LR-XYZ-4491',
      lrDate: '2026-11-02',
      ewayBillNumber: '291039481920'
    },
    items: [
      {
        id: 'item-gp-1',
        materialId: 'stock-ms-cast',
        materialCode: 'MS-CAST-01',
        materialName: 'MS Casting Grade FG260',
        quantity: 500,
        uom: 'Kg',
        batchHeatNo: 'HT-2026-B89',
        ratePerUnit: 140,
        totalValue: 70000,
        remarks: 'Pre-machined surfaces masked. Surface case depth 0.8-1.2mm required.',
        returnedQty: 0,
        rejectedQty: 0,
        shortClosedQty: 0,
        balanceWithVendor: 500
      }
    ],
    totalDispatchedQty: 500,
    totalEstimatedValue: 70000,
    status: 'issued',
    gstChallanRule: 'Delivery Challan for Job Work as per Section 143 of CGST Act, 2017 & Rule 45',
    internalRemarks: 'Priority batch for Caterpillar gear assemblies. Target delivery by 10 Nov.',
    createdBy: 'user-stores',
    createdByName: 'Sunil Jadhav (Stores Officer)',
    createdAt: new Date('2026-11-02T10:30:00Z').toISOString(),
    updatedAt: new Date('2026-11-02T10:30:00Z').toISOString()
  },

  // ── 2. RETURNED #1 ──
  {
    id: 'gp-out-002',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0002',
    type: 'outward',
    jobWorkerId: 'sub-pragati',
    jobWorkerName: 'Pragati Heat Treaters (Pvt) Ltd',
    jobWorkerGst: '29AABCP8921K1ZT',
    jobWorkerAddress: 'Plot 48/B, Phase 2, Peenya Industrial Area, Bengaluru 560058',
    jobWorkerPhone: '+91 98450 12891',
    jobWorkerContactPerson: 'Suresh Nambiar',
    natureOfWork: 'Induction Hardening & Liquid Nitriding',
    expectedReturnDate: '2026-10-20',
    dispatchedDate: '2026-10-12',
    linkedJobWorkOrderNumber: 'JWO-2026-0045',
    linkedWorkOrderNumber: 'WO-2026-004',
    vehicleDetails: {
      modeOfTransport: 'road',
      transporterName: 'VRL Logistics Ltd',
      vehicleNumber: 'KA-04-MK-3312',
      driverName: 'Manjunath Gowda',
      driverPhone: '+91 94480 88211',
      lrNumber: 'VRL-BLR-90812',
      lrDate: '2026-10-12',
      ewayBillNumber: '381928491022'
    },
    items: [
      {
        id: 'item-gp-2',
        materialId: 'stock-1',
        materialCode: 'WR-1002',
        materialName: 'Wire Rod — High Tensile Steel 8mm',
        quantity: 2.5,
        uom: 'tonnes',
        batchHeatNo: 'TATA-H882',
        ratePerUnit: 62000,
        totalValue: 155000,
        remarks: 'Coil tags intact. Zero oxidation during gas purge.',
        returnedQty: 2.5,
        rejectedQty: 0,
        shortClosedQty: 0,
        balanceWithVendor: 0
      }
    ],
    totalDispatchedQty: 2.5,
    totalEstimatedValue: 155000,
    status: 'fully_returned',
    gstChallanRule: 'Delivery Challan for Job Work as per Section 143 of CGST Act, 2017 & Rule 45',
    internalRemarks: 'Full lot returned on 18 Oct via GP/IN/2026/0002.',
    createdBy: 'user-stores',
    createdByName: 'Sunil Jadhav (Stores Officer)',
    createdAt: new Date('2026-10-12T09:15:00Z').toISOString(),
    updatedAt: new Date('2026-10-18T14:30:00Z').toISOString()
  },

  // ── 3. PENDING #2 (Open pass, material not yet returned) ──
  {
    id: 'gp-out-003',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0003',
    type: 'outward',
    jobWorkerId: 'sub-apex',
    jobWorkerName: 'Apex Precision CNC Works',
    jobWorkerGst: '27AABCA4312M1ZM',
    jobWorkerAddress: 'Sector 7, PCMC Industrial Cluster, Bhosari MIDC, Pune 411026',
    jobWorkerPhone: '+91 98221 44502',
    jobWorkerContactPerson: 'Kailash Deshmukh',
    natureOfWork: 'CNC Profile Milling & Spline Broaching',
    expectedReturnDate: '2026-11-18',
    dispatchedDate: '2026-11-04',
    linkedJobWorkOrderNumber: 'JWO-2026-0048',
    vehicleDetails: {
      modeOfTransport: 'road',
      transporterName: 'Internal Factory Bolero Pickup',
      vehicleNumber: 'MH-14-GH-7711',
      driverName: 'Dattatray Shinde',
      driverPhone: '+91 97632 11094'
    },
    items: [
      {
        id: 'item-gp-3',
        materialId: 'stock-2',
        materialCode: 'CS-FC300',
        materialName: 'Forged Crankshaft — FC300 Machined',
        quantity: 20,
        uom: 'units',
        batchHeatNo: 'FC-LOT-44',
        ratePerUnit: 3500,
        totalValue: 70000,
        remarks: 'Spline gauge reference SP-G-44 sent along with traveler.',
        returnedQty: 0,
        rejectedQty: 0,
        shortClosedQty: 0,
        balanceWithVendor: 20
      }
    ],
    totalDispatchedQty: 20,
    totalEstimatedValue: 70000,
    status: 'issued',
    gstChallanRule: 'Delivery Challan for Job Work as per Section 143 of CGST Act, 2017 & Rule 45',
    internalRemarks: 'Urgent delivery for assembly line batch starting 20 Nov.',
    createdBy: 'user-stores',
    createdByName: 'Sunil Jadhav (Stores Officer)',
    createdAt: new Date('2026-11-04T11:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-04T11:00:00Z').toISOString()
  },

  // ── 4. RETURNED #2 ──
  {
    id: 'gp-out-004',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0004',
    type: 'outward',
    jobWorkerId: 'sub-surface',
    jobWorkerName: 'Super Surface Coaters',
    jobWorkerGst: '27AAACS8819L1ZX',
    natureOfWork: 'Hard Chrome Plating 25 Microns',
    expectedReturnDate: '2026-10-15',
    dispatchedDate: '2026-10-05',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Om Logistics', vehicleNumber: 'MH-12-AR-8812' },
    items: [{
      id: 'it-4', materialCode: 'FL-ADP-12', materialName: 'Flange Adapter Mild Steel',
      quantity: 120, uom: 'units', ratePerUnit: 450, totalValue: 54000,
      returnedQty: 120, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 120, totalEstimatedValue: 54000, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-05T09:00:00Z').toISOString(),
    updatedAt: new Date('2026-10-14T15:00:00Z').toISOString()
  },

  // ── 5. RETURNED #3 ──
  {
    id: 'gp-out-005',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0005',
    type: 'outward',
    jobWorkerId: 'sub-gear',
    jobWorkerName: 'Precision Gear Cutters',
    jobWorkerGst: '27AABCP7712N1Z4',
    natureOfWork: 'Gear Hobbing & Tooth Chamfering',
    expectedReturnDate: '2026-10-25',
    dispatchedDate: '2026-10-18',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Self Tempo', vehicleNumber: 'MH-14-CC-1920' },
    items: [{
      id: 'it-5', materialCode: 'SP-PIN-20', materialName: 'Spur Pinion EN353 Forged Blank',
      quantity: 250, uom: 'units', ratePerUnit: 680, totalValue: 170000,
      returnedQty: 250, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 250, totalEstimatedValue: 170000, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-18T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-10-24T16:00:00Z').toISOString()
  },

  // ── 6. RETURNED #4 ──
  {
    id: 'gp-out-006',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0006',
    type: 'outward',
    jobWorkerId: 'sub-vardhman',
    jobWorkerName: 'Vardhman Electroplaters',
    jobWorkerGst: '27AAACV6610Q1Z8',
    natureOfWork: 'Zinc Yellow Passivation (RoHS Compliant)',
    expectedReturnDate: '2026-10-29',
    dispatchedDate: '2026-10-22',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Safexpress Ltd', vehicleNumber: 'MH-12-JJ-4011' },
    items: [{
      id: 'it-6', materialCode: 'FS-STUD-16', materialName: 'High Tensile Studs Grade 8.8 M16',
      quantity: 1200, uom: 'Kg', ratePerUnit: 110, totalValue: 132000,
      returnedQty: 1200, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 1200, totalEstimatedValue: 132000, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-22T08:30:00Z').toISOString(),
    updatedAt: new Date('2026-10-28T14:00:00Z').toISOString()
  },

  // ── 7. RETURNED #5 ──
  {
    id: 'gp-out-007',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0007',
    type: 'outward',
    jobWorkerId: 'sub-techmark',
    jobWorkerName: 'TechMark Grinding Works',
    jobWorkerGst: '27AABCT5511R1Z2',
    natureOfWork: 'Internal & External Cylindrical Grinding',
    expectedReturnDate: '2026-11-04',
    dispatchedDate: '2026-10-27',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Direct Pick-up', vehicleNumber: 'MH-14-AA-2200' },
    items: [{
      id: 'it-7', materialCode: 'HYD-CYL-45', materialName: 'Hydraulic Cylinder Barrel Tube',
      quantity: 45, uom: 'units', ratePerUnit: 4200, totalValue: 189000,
      returnedQty: 45, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 45, totalEstimatedValue: 189000, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-27T11:15:00Z').toISOString(),
    updatedAt: new Date('2026-11-03T17:00:00Z').toISOString()
  },

  // ── 8. RETURNED #6 ──
  {
    id: 'gp-out-008',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0008',
    type: 'outward',
    jobWorkerId: 'sub-modern',
    jobWorkerName: 'Modern Laser & Punching Co',
    jobWorkerGst: '27AABCM4410K1ZB',
    natureOfWork: 'Laser Cutting & CNC Press Brake Bending',
    expectedReturnDate: '2026-11-07',
    dispatchedDate: '2026-11-01',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'VRL Logistics', vehicleNumber: 'MH-12-GG-9922' },
    items: [{
      id: 'it-8', materialCode: 'SS-SHT-2MM', materialName: 'Stainless Steel Sheet 304 2mm',
      quantity: 300, uom: 'Kg', ratePerUnit: 280, totalValue: 84000,
      returnedQty: 300, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 300, totalEstimatedValue: 84000, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-01T09:45:00Z').toISOString(),
    updatedAt: new Date('2026-11-06T15:30:00Z').toISOString()
  },

  // ── 9. RETURNED #7 ──
  {
    id: 'gp-out-009',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0009',
    type: 'outward',
    jobWorkerId: 'sub-delta',
    jobWorkerName: 'Delta Nitriders (P) Ltd',
    jobWorkerGst: '27AABCD3319P1ZW',
    natureOfWork: 'Gas Nitriding 650 HV 0.3mm',
    expectedReturnDate: '2026-11-10',
    dispatchedDate: '2026-11-03',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Factory Tempo', vehicleNumber: 'MH-14-EE-3344' },
    items: [{
      id: 'it-9', materialCode: 'CAM-BLK-80', materialName: 'Camshaft Blank Alloy Steel',
      quantity: 80, uom: 'units', ratePerUnit: 1800, totalValue: 144000,
      returnedQty: 80, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 80, totalEstimatedValue: 144000, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-03T10:20:00Z').toISOString(),
    updatedAt: new Date('2026-11-09T16:00:00Z').toISOString()
  },

  // ── 10. RETURNED #8 ──
  {
    id: 'gp-out-010',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0010',
    type: 'outward',
    jobWorkerId: 'sub-shinde',
    jobWorkerName: 'Shinde Broaching Tech',
    jobWorkerGst: '27AABCS2218M1ZT',
    natureOfWork: 'Internal Involute Spline Broaching',
    expectedReturnDate: '2026-11-15',
    dispatchedDate: '2026-11-08',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Direct Tempo', vehicleNumber: 'MH-12-ZZ-5501' },
    items: [{
      id: 'it-10', materialCode: 'SPL-BSH-600', materialName: 'Spline Bushing EN8D',
      quantity: 600, uom: 'units', ratePerUnit: 160, totalValue: 96000,
      returnedQty: 600, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 600, totalEstimatedValue: 96000, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-08T11:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-14T17:15:00Z').toISOString()
  },

  // ── 11. RETURNED #9 ──
  {
    id: 'gp-out-011',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0011',
    type: 'outward',
    jobWorkerId: 'sub-omkar',
    jobWorkerName: 'Omkar Induction Hardening',
    jobWorkerGst: '27AABCO1117N1ZQ',
    natureOfWork: 'Single Shot Induction Hardening',
    expectedReturnDate: '2026-11-19',
    dispatchedDate: '2026-11-12',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Factory Bolero', vehicleNumber: 'MH-14-DD-9911' },
    items: [{
      id: 'it-11', materialCode: 'DRV-SHT-60', materialName: 'Drive Shaft 60mm Dia x 900mm',
      quantity: 35, uom: 'units', ratePerUnit: 2900, totalValue: 101500,
      returnedQty: 35, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 35, totalEstimatedValue: 101500, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-12T09:30:00Z').toISOString(),
    updatedAt: new Date('2026-11-18T15:45:00Z').toISOString()
  },

  // ── 12. RETURNED #10 ──
  {
    id: 'gp-out-012',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/0012',
    type: 'outward',
    jobWorkerId: 'sub-chakan',
    jobWorkerName: 'Chakan Powder Coaters',
    jobWorkerGst: '27AABCC0016Q1ZL',
    natureOfWork: '7-Tank Pure Polyester Powder Coating 80 Microns',
    expectedReturnDate: '2026-11-23',
    dispatchedDate: '2026-11-16',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'VRL Logistics', vehicleNumber: 'MH-12-FF-8844' },
    items: [{
      id: 'it-12', materialCode: 'ENC-PNL-150', materialName: 'Control Panel Sheet Enclosure Panels',
      quantity: 150, uom: 'units', ratePerUnit: 850, totalValue: 127500,
      returnedQty: 150, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 150, totalEstimatedValue: 127500, status: 'fully_returned',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-16T10:15:00Z').toISOString(),
    updatedAt: new Date('2026-11-22T16:30:00Z').toISOString()
  },

  // ── DUAL-ROLE SCENARIO (EC 3: Company as Job Worker / Customer Free-Issue Material) ──
  {
    id: 'gp-out-cf-001',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/CF-01',
    type: 'outward',
    jobWorkerId: 'cust-tata',
    jobWorkerName: 'Tata Motors Ltd (Commercial Vehicles)',
    jobWorkerGst: '27AAACT2727Q1ZW',
    natureOfWork: 'Customer Free-Issue Machining of Axle Housings',
    expectedReturnDate: '2026-11-25',
    dispatchedDate: '2026-11-10',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Tata Logistics', vehicleNumber: 'MH-14-AZ-9901' },
    items: [{
      id: 'it-cf-1', materialCode: 'TATA-AXL-100', materialName: 'Free-Issue Axle Casing Castings',
      quantity: 100, uom: 'units', ratePerUnit: 6500, totalValue: 650000,
      returnedQty: 100, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 100, totalEstimatedValue: 650000, status: 'fully_returned',
    internalRemarks: 'Customer Free-Issue Material under job work contract TML-PO-4412.',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-10T11:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-24T14:00:00Z').toISOString()
  },
  {
    id: 'gp-out-cf-002',
    tenantId,
    gatePassNumber: 'GP/OUT/2026/CF-02',
    type: 'outward',
    jobWorkerId: 'cust-bforge',
    jobWorkerName: 'Bharat Forge Ltd (Forging Division)',
    jobWorkerGst: '27AAACB1234F1Z8',
    natureOfWork: 'Customer Free-Issue CNC Turning & Spline Cutting',
    expectedReturnDate: '2026-11-28',
    dispatchedDate: '2026-11-14',
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Direct Trailer', vehicleNumber: 'MH-12-BF-7711' },
    items: [{
      id: 'it-cf-2', materialCode: 'BF-CRK-50', materialName: 'Free-Issue Heavy Crankshaft Forgings',
      quantity: 50, uom: 'units', ratePerUnit: 14000, totalValue: 700000,
      returnedQty: 50, rejectedQty: 0, balanceWithVendor: 0
    }],
    totalDispatchedQty: 50, totalEstimatedValue: 700000, status: 'fully_returned',
    internalRemarks: 'Customer Free-Issue Material subcontracted to us as Job Worker.',
    createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-14T09:30:00Z').toISOString(),
    updatedAt: new Date('2026-11-27T16:00:00Z').toISOString()
  },

  // ── INWARD GATE PASSES FOR THE RETURNED ONES (Table 5A Linkage) ──
  {
    id: 'gp-in-002',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0002',
    type: 'inward',
    jobWorkerId: 'sub-pragati',
    jobWorkerName: 'Pragati Heat Treaters (Pvt) Ltd',
    jobWorkerGst: '29AABCP8921K1ZT',
    natureOfWork: 'Inward Return from Induction Hardening',
    expectedReturnDate: '2026-10-20',
    dispatchedDate: '2026-10-18',
    linkedOutwardGatePassId: 'gp-out-002',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0002',
    grnNumber: 'GRN/JW/2026/0002',
    grnId: 'grn-002',
    processingCharges: 14500,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'VRL Logistics Ltd', vehicleNumber: 'KA-04-MK-3312' },
    items: [{
      id: 'in-it-2', materialCode: 'WR-1002', materialName: 'Wire Rod — High Tensile Steel 8mm',
      quantity: 2.5, uom: 'tonnes', returnedQty: 2.5, rejectedQty: 0
    }],
    totalDispatchedQty: 2.5, totalProcessedQty: 2.5, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-18T14:30:00Z').toISOString(), updatedAt: new Date('2026-10-18T14:30:00Z').toISOString()
  },
  {
    id: 'gp-in-004',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0004',
    type: 'inward',
    jobWorkerId: 'sub-surface',
    jobWorkerName: 'Super Surface Coaters',
    jobWorkerGst: '27AAACS8819L1ZX',
    natureOfWork: 'Inward Return from Chrome Plating',
    dispatchedDate: '2026-10-14',
    expectedReturnDate: '2026-10-15',
    linkedOutwardGatePassId: 'gp-out-004',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0004',
    grnNumber: 'GRN/JW/2026/0004',
    processingCharges: 8400,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Om Logistics', vehicleNumber: 'MH-12-AR-8812' },
    items: [{ id: 'in-it-4', materialCode: 'FL-ADP-12', materialName: 'Flange Adapter Mild Steel', quantity: 120, uom: 'units', returnedQty: 120, rejectedQty: 0 }],
    totalDispatchedQty: 120, totalProcessedQty: 120, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-14T15:00:00Z').toISOString(), updatedAt: new Date('2026-10-14T15:00:00Z').toISOString()
  },
  {
    id: 'gp-in-005',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0005',
    type: 'inward',
    jobWorkerId: 'sub-gear',
    jobWorkerName: 'Precision Gear Cutters',
    jobWorkerGst: '27AABCP7712N1Z4',
    natureOfWork: 'Inward Return from Gear Hobbing',
    dispatchedDate: '2026-10-24',
    expectedReturnDate: '2026-10-25',
    linkedOutwardGatePassId: 'gp-out-005',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0005',
    grnNumber: 'GRN/JW/2026/0005',
    processingCharges: 22000,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Self Tempo', vehicleNumber: 'MH-14-CC-1920' },
    items: [{ id: 'in-it-5', materialCode: 'SP-PIN-20', materialName: 'Spur Pinion EN353 Forged Blank', quantity: 250, uom: 'units', returnedQty: 250, rejectedQty: 0 }],
    totalDispatchedQty: 250, totalProcessedQty: 250, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-24T16:00:00Z').toISOString(), updatedAt: new Date('2026-10-24T16:00:00Z').toISOString()
  },
  {
    id: 'gp-in-006',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0006',
    type: 'inward',
    jobWorkerId: 'sub-vardhman',
    jobWorkerName: 'Vardhman Electroplaters',
    jobWorkerGst: '27AAACV6610Q1Z8',
    natureOfWork: 'Inward Return from Zinc Passivation',
    dispatchedDate: '2026-10-28',
    expectedReturnDate: '2026-10-29',
    linkedOutwardGatePassId: 'gp-out-006',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0006',
    grnNumber: 'GRN/JW/2026/0006',
    processingCharges: 9600,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Safexpress', vehicleNumber: 'MH-12-JJ-4011' },
    items: [{ id: 'in-it-6', materialCode: 'FS-STUD-16', materialName: 'High Tensile Studs Grade 8.8 M16', quantity: 1200, uom: 'Kg', returnedQty: 1200, rejectedQty: 0 }],
    totalDispatchedQty: 1200, totalProcessedQty: 1200, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-10-28T14:00:00Z').toISOString(), updatedAt: new Date('2026-10-28T14:00:00Z').toISOString()
  },
  {
    id: 'gp-in-007',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0007',
    type: 'inward',
    jobWorkerId: 'sub-techmark',
    jobWorkerName: 'TechMark Grinding Works',
    jobWorkerGst: '27AABCT5511R1Z2',
    natureOfWork: 'Inward Return from Cylindrical Grinding',
    dispatchedDate: '2026-11-03',
    expectedReturnDate: '2026-11-04',
    linkedOutwardGatePassId: 'gp-out-007',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0007',
    grnNumber: 'GRN/JW/2026/0007',
    processingCharges: 18000,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Direct Pick-up', vehicleNumber: 'MH-14-AA-2200' },
    items: [{ id: 'in-it-7', materialCode: 'HYD-CYL-45', materialName: 'Hydraulic Cylinder Barrel Tube', quantity: 45, uom: 'units', returnedQty: 45, rejectedQty: 0 }],
    totalDispatchedQty: 45, totalProcessedQty: 45, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-03T17:00:00Z').toISOString(), updatedAt: new Date('2026-11-03T17:00:00Z').toISOString()
  },
  {
    id: 'gp-in-008',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0008',
    type: 'inward',
    jobWorkerId: 'sub-modern',
    jobWorkerName: 'Modern Laser & Punching Co',
    jobWorkerGst: '27AABCM4410K1ZB',
    natureOfWork: 'Inward Return from Laser & Bending',
    dispatchedDate: '2026-11-06',
    expectedReturnDate: '2026-11-07',
    linkedOutwardGatePassId: 'gp-out-008',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0008',
    grnNumber: 'GRN/JW/2026/0008',
    processingCharges: 11500,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'VRL Logistics', vehicleNumber: 'MH-12-GG-9922' },
    items: [{ id: 'in-it-8', materialCode: 'SS-SHT-2MM', materialName: 'Stainless Steel Sheet 304 2mm', quantity: 300, uom: 'Kg', returnedQty: 300, rejectedQty: 0 }],
    totalDispatchedQty: 300, totalProcessedQty: 300, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-06T15:30:00Z').toISOString(), updatedAt: new Date('2026-11-06T15:30:00Z').toISOString()
  },
  {
    id: 'gp-in-009',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0009',
    type: 'inward',
    jobWorkerId: 'sub-delta',
    jobWorkerName: 'Delta Nitriders (P) Ltd',
    jobWorkerGst: '27AABCD3319P1ZW',
    natureOfWork: 'Inward Return from Gas Nitriding',
    dispatchedDate: '2026-11-09',
    expectedReturnDate: '2026-11-10',
    linkedOutwardGatePassId: 'gp-out-009',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0009',
    grnNumber: 'GRN/JW/2026/0009',
    processingCharges: 16000,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Factory Tempo', vehicleNumber: 'MH-14-EE-3344' },
    items: [{ id: 'in-it-9', materialCode: 'CAM-BLK-80', materialName: 'Camshaft Blank Alloy Steel', quantity: 80, uom: 'units', returnedQty: 80, rejectedQty: 0 }],
    totalDispatchedQty: 80, totalProcessedQty: 80, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-09T16:00:00Z').toISOString(), updatedAt: new Date('2026-11-09T16:00:00Z').toISOString()
  },
  {
    id: 'gp-in-010',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0010',
    type: 'inward',
    jobWorkerId: 'sub-shinde',
    jobWorkerName: 'Shinde Broaching Tech',
    jobWorkerGst: '27AABCS2218M1ZT',
    natureOfWork: 'Inward Return from Spline Broaching',
    dispatchedDate: '2026-11-14',
    expectedReturnDate: '2026-11-15',
    linkedOutwardGatePassId: 'gp-out-010',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0010',
    grnNumber: 'GRN/JW/2026/0010',
    processingCharges: 14000,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Direct Tempo', vehicleNumber: 'MH-12-ZZ-5501' },
    items: [{ id: 'in-it-10', materialCode: 'SPL-BSH-600', materialName: 'Spline Bushing EN8D', quantity: 600, uom: 'units', returnedQty: 600, rejectedQty: 0 }],
    totalDispatchedQty: 600, totalProcessedQty: 600, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-14T17:15:00Z').toISOString(), updatedAt: new Date('2026-11-14T17:15:00Z').toISOString()
  },
  {
    id: 'gp-in-011',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0011',
    type: 'inward',
    jobWorkerId: 'sub-omkar',
    jobWorkerName: 'Omkar Induction Hardening',
    jobWorkerGst: '27AABCO1117N1ZQ',
    natureOfWork: 'Inward Return from Single Shot Hardening',
    dispatchedDate: '2026-11-18',
    expectedReturnDate: '2026-11-19',
    linkedOutwardGatePassId: 'gp-out-011',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0011',
    grnNumber: 'GRN/JW/2026/0011',
    processingCharges: 13200,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'Factory Bolero', vehicleNumber: 'MH-14-DD-9911' },
    items: [{ id: 'in-it-11', materialCode: 'DRV-SHT-60', materialName: 'Drive Shaft 60mm Dia x 900mm', quantity: 35, uom: 'units', returnedQty: 35, rejectedQty: 0 }],
    totalDispatchedQty: 35, totalProcessedQty: 35, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-18T15:45:00Z').toISOString(), updatedAt: new Date('2026-11-18T15:45:00Z').toISOString()
  },
  {
    id: 'gp-in-012',
    tenantId,
    gatePassNumber: 'GP/IN/2026/0012',
    type: 'inward',
    jobWorkerId: 'sub-chakan',
    jobWorkerName: 'Chakan Powder Coaters',
    jobWorkerGst: '27AABCC0016Q1ZL',
    natureOfWork: 'Inward Return from Powder Coating',
    dispatchedDate: '2026-11-22',
    expectedReturnDate: '2026-11-23',
    linkedOutwardGatePassId: 'gp-out-012',
    linkedOutwardGatePassNumber: 'GP/OUT/2026/0012',
    grnNumber: 'GRN/JW/2026/0012',
    processingCharges: 15500,
    vehicleDetails: { modeOfTransport: 'road', transporterName: 'VRL Logistics', vehicleNumber: 'MH-12-FF-8844' },
    items: [{ id: 'in-it-12', materialCode: 'ENC-PNL-150', materialName: 'Control Panel Sheet Enclosure Panels', quantity: 150, uom: 'units', returnedQty: 150, rejectedQty: 0 }],
    totalDispatchedQty: 150, totalProcessedQty: 150, totalRejectedQty: 0, totalEstimatedValue: 0,
    status: 'completed', createdBy: 'user-stores', createdByName: 'Sunil Jadhav',
    createdAt: new Date('2026-11-22T16:30:00Z').toISOString(), updatedAt: new Date('2026-11-22T16:30:00Z').toISOString()
  }
];

// ── INITIAL SEED JOB WORKER STOCK BALANCES ─────────────────────────────────────
export const SEED_JOB_WORKER_STOCKS = (tenantId: string): JobWorkerStockBalance[] => [
  {
    id: 'sub-xyz_stock-ms-cast',
    tenantId,
    vendorId: 'sub-xyz',
    vendorName: 'XYZ Heat Treatment Works',
    materialId: 'stock-ms-cast',
    materialCode: 'MS-CAST-01',
    materialName: 'MS Casting Grade FG260',
    uom: 'Kg',
    quantityWithVendor: 500,
    totalOutwardQty: 500,
    totalReturnedQty: 0,
    totalRejectedQty: 0,
    totalShortClosedQty: 0,
    lastGatePassNumber: 'GP/OUT/2026/0001',
    lastDispatchedDate: '2026-11-02',
    expectedReturnDate: '2026-11-10',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'sub-pragati_stock-1',
    tenantId,
    vendorId: 'sub-pragati',
    vendorName: 'Pragati Heat Treaters (Pvt) Ltd',
    materialId: 'stock-1',
    materialCode: 'WR-1002',
    materialName: 'Wire Rod — High Tensile Steel 8mm',
    uom: 'tonnes',
    quantityWithVendor: 1.5,
    totalOutwardQty: 2.5,
    totalReturnedQty: 1.0,
    totalRejectedQty: 0,
    totalShortClosedQty: 0,
    lastGatePassNumber: 'GP/OUT/2026/0002',
    lastDispatchedDate: '2026-11-03',
    expectedReturnDate: '2026-11-14',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'sub-apex_stock-2',
    tenantId,
    vendorId: 'sub-apex',
    vendorName: 'Apex Precision CNC Works',
    materialId: 'stock-2',
    materialCode: 'CS-FC300',
    materialName: 'Forged Crankshaft — FC300 Machined',
    uom: 'units',
    quantityWithVendor: 20,
    totalOutwardQty: 20,
    totalReturnedQty: 0,
    totalRejectedQty: 0,
    totalShortClosedQty: 0,
    lastGatePassNumber: 'GP/OUT/2026/0003',
    lastDispatchedDate: '2026-11-04',
    expectedReturnDate: '2026-11-18',
    lastUpdated: new Date().toISOString()
  }
];

// ── INITIAL SEED JOB WORK GRNS ─────────────────────────────────────────────────
export const SEED_JOB_WORK_GRNS = (tenantId: string): JobWorkGRN[] => [
  {
    id: 'grn-001',
    tenantId,
    grnNumber: 'GRN/JW/2026/0001',
    inwardGatePassId: 'gp-in-seed-1',
    inwardGatePassNumber: 'GP/IN/2026/0001',
    outwardGatePassId: 'gp-out-002',
    outwardGatePassNumber: 'GP/OUT/2026/0002',
    jobWorkerId: 'sub-pragati',
    jobWorkerName: 'Pragati Heat Treaters (Pvt) Ltd',
    jobWorkerGst: '29AABCP8921K1ZT',
    receiptDate: '2026-11-05',
    items: [
      {
        materialId: 'stock-1',
        materialCode: 'WR-1002',
        materialName: 'Wire Rod — High Tensile Steel 8mm',
        uom: 'tonnes',
        sentQty: 2.5,
        receivedQty: 1.0,
        processedQty: 1.0,
        rejectedQty: 0
      }
    ],
    totalProcessedQty: 1.0,
    totalRejectedQty: 0,
    processingCharges: 12000,
    isProcessingChargeDisputed: false,
    disputeStatus: 'none',
    vendorChallanNo: 'DC-PRAG-491',
    vendorInvoiceNo: 'INV-2026-88',
    vehicleNumber: 'KA-04-MK-3312',
    receivedBy: 'user-stores',
    receivedByName: 'Sunil Jadhav (Stores Officer)',
    inspectionRemarks: 'Partial delivery lot 1 accepted. Hardness checked 58 HRC.',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
  }
];

// ── INITIAL SEED VENDOR STOCK LEDGER TRANSACTIONS ─────────────────────────────
export const SEED_VENDOR_STOCK_LEDGER = (tenantId: string): VendorStockLedgerTransaction[] => [
  {
    id: 'vled-1',
    tenantId,
    vendorId: 'sub-xyz',
    vendorName: 'XYZ Heat Treatment Works',
    materialId: 'stock-ms-cast',
    materialCode: 'MS-CAST-01',
    materialName: 'MS Casting Grade FG260',
    uom: 'Kg',
    timestamp: '2026-11-02T10:30:00Z',
    transactionType: 'outward_dispatch',
    refNumber: 'GP/OUT/2026/0001',
    sentQty: 500,
    returnedQty: 0,
    rejectedQty: 0,
    balanceQty: 500,
    remarks: 'Dispatched for Sealed Quench Carburizing',
    performedBy: 'user-stores',
    performedByName: 'Sunil Jadhav'
  },
  {
    id: 'vled-2',
    tenantId,
    vendorId: 'sub-pragati',
    vendorName: 'Pragati Heat Treaters (Pvt) Ltd',
    materialId: 'stock-1',
    materialCode: 'WR-1002',
    materialName: 'Wire Rod — High Tensile Steel 8mm',
    uom: 'tonnes',
    timestamp: '2026-11-03T11:15:00Z',
    transactionType: 'outward_dispatch',
    refNumber: 'GP/OUT/2026/0002',
    sentQty: 2.5,
    returnedQty: 0,
    rejectedQty: 0,
    balanceQty: 2.5,
    remarks: 'Dispatched for Induction Hardening',
    performedBy: 'user-stores',
    performedByName: 'Sunil Jadhav'
  },
  {
    id: 'vled-3',
    tenantId,
    vendorId: 'sub-pragati',
    vendorName: 'Pragati Heat Treaters (Pvt) Ltd',
    materialId: 'stock-1',
    materialCode: 'WR-1002',
    materialName: 'Wire Rod — High Tensile Steel 8mm',
    uom: 'tonnes',
    timestamp: '2026-11-05T14:45:00Z',
    transactionType: 'inward_processed',
    refNumber: 'GRN/JW/2026/0001',
    sentQty: 0,
    returnedQty: 1.0,
    rejectedQty: 0,
    balanceQty: 1.5,
    remarks: 'First partial return received. Processing charges ₹12,000.',
    performedBy: 'user-stores',
    performedByName: 'Sunil Jadhav'
  },
  {
    id: 'vled-4',
    tenantId,
    vendorId: 'sub-apex',
    vendorName: 'Apex Precision CNC Works',
    materialId: 'stock-2',
    materialCode: 'CS-FC300',
    materialName: 'Forged Crankshaft — FC300 Machined',
    uom: 'units',
    timestamp: '2026-11-04T16:00:00Z',
    transactionType: 'outward_dispatch',
    refNumber: 'GP/OUT/2026/0003',
    sentQty: 20,
    returnedQty: 0,
    rejectedQty: 0,
    balanceQty: 20,
    remarks: 'Dispatched for CNC Profile Milling',
    performedBy: 'user-stores',
    performedByName: 'Sunil Jadhav'
  }
];

// ── LOCAL STORAGE REPOSITORY HELPERS ──────────────────────────────────────────

export function getCachedGatePasses(tenantId: string): JobWorkGatePass[] {
  try {
    const raw = localStorage.getItem(`job_work_gate_passes_${tenantId}`);
    if (!raw) {
      const seeds = SEED_JOB_WORK_GATE_PASSES(tenantId);
      localStorage.setItem(`job_work_gate_passes_${tenantId}`, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached gate passes:', e);
    return SEED_JOB_WORK_GATE_PASSES(tenantId);
  }
}

export function saveCachedGatePasses(tenantId: string, items: JobWorkGatePass[]): void {
  localStorage.setItem(`job_work_gate_passes_${tenantId}`, JSON.stringify(items));
}

export function getCachedJobWorkerStocks(tenantId: string): JobWorkerStockBalance[] {
  try {
    const raw = localStorage.getItem(`job_worker_stocks_${tenantId}`);
    if (!raw) {
      const seeds = SEED_JOB_WORKER_STOCKS(tenantId);
      localStorage.setItem(`job_worker_stocks_${tenantId}`, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached job worker stock:', e);
    return SEED_JOB_WORKER_STOCKS(tenantId);
  }
}

export function saveCachedJobWorkerStocks(tenantId: string, items: JobWorkerStockBalance[]): void {
  localStorage.setItem(`job_worker_stocks_${tenantId}`, JSON.stringify(items));
}

export function getCachedGrns(tenantId: string): JobWorkGRN[] {
  try {
    const raw = localStorage.getItem(`job_work_grns_${tenantId}`);
    if (!raw) {
      const seeds = SEED_JOB_WORK_GRNS(tenantId);
      localStorage.setItem(`job_work_grns_${tenantId}`, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached GRNs:', e);
    return SEED_JOB_WORK_GRNS(tenantId);
  }
}

export function saveCachedGrns(tenantId: string, items: JobWorkGRN[]): void {
  localStorage.setItem(`job_work_grns_${tenantId}`, JSON.stringify(items));
}

export function getCachedVendorStockLedger(tenantId: string): VendorStockLedgerTransaction[] {
  try {
    const raw = localStorage.getItem(`vendor_stock_ledger_${tenantId}`);
    if (!raw) {
      const seeds = SEED_VENDOR_STOCK_LEDGER(tenantId);
      localStorage.setItem(`vendor_stock_ledger_${tenantId}`, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached vendor stock ledger:', e);
    return SEED_VENDOR_STOCK_LEDGER(tenantId);
  }
}

export function saveCachedVendorStockLedger(tenantId: string, items: VendorStockLedgerTransaction[]): void {
  localStorage.setItem(`vendor_stock_ledger_${tenantId}`, JSON.stringify(items));
}

// ── SEQUENTIAL NUMBER GENERATORS ──────────────────────────────────────────────

export function generateGatePassNumber(type: 'outward' | 'inward', existingList: JobWorkGatePass[]): string {
  const currentYear = new Date().getFullYear();
  const prefix = type === 'outward' ? `GP/OUT/${currentYear}/` : `GP/IN/${currentYear}/`;
  
  const matchingNumbers = existingList
    .filter(gp => gp.gatePassNumber && gp.gatePassNumber.startsWith(prefix))
    .map(gp => {
      const parts = gp.gatePassNumber.split('/');
      const numPart = parseInt(parts[parts.length - 1], 10);
      return isNaN(numPart) ? 0 : numPart;
    });

  const nextSeq = (matchingNumbers.length > 0 ? Math.max(...matchingNumbers) : 0) + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export function generateGrnNumber(existingGrns: JobWorkGRN[]): string {
  const currentYear = new Date().getFullYear();
  const prefix = `GRN/JW/${currentYear}/`;
  
  const matchingNumbers = existingGrns
    .filter(g => g.grnNumber && g.grnNumber.startsWith(prefix))
    .map(g => {
      const parts = g.grnNumber.split('/');
      const numPart = parseInt(parts[parts.length - 1], 10);
      return isNaN(numPart) ? 0 : numPart;
    });

  const nextSeq = (matchingNumbers.length > 0 ? Math.max(...matchingNumbers) : 0) + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ── CORE DATA ACCESS AND STOCK INTEGRATIONS ────────────────────────────────────

/**
 * Fetch all Gate Passes for a tenant
 */
export async function fetchGatePasses(tenantId: string, isSandboxMode: boolean = false): Promise<JobWorkGatePass[]> {
  if (isSandboxMode || !db) {
    return getCachedGatePasses(tenantId);
  }

  try {
    const colPath = `tenants/${tenantId}/jobWorkGatePasses`;
    const q = collection(db, colPath);
    const snap = await getDocs(q);
    if (snap.empty) {
      const seeds = SEED_JOB_WORK_GATE_PASSES(tenantId);
      for (const s of seeds) {
        await setDoc(doc(db, 'tenants', tenantId, 'jobWorkGatePasses', s.id), s);
      }
      return seeds;
    }
    const list: JobWorkGatePass[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as JobWorkGatePass);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Firestore fetchGatePasses fallback to local cache:', error);
    return getCachedGatePasses(tenantId);
  }
}

/**
 * Fetch live stock balances currently held with Job Workers
 */
export async function fetchJobWorkerStocks(tenantId: string, isSandboxMode: boolean = false): Promise<JobWorkerStockBalance[]> {
  if (isSandboxMode || !db) {
    return getCachedJobWorkerStocks(tenantId);
  }

  try {
    const colPath = `tenants/${tenantId}/jobWorkerStocks`;
    const q = collection(db, colPath);
    const snap = await getDocs(q);
    if (snap.empty) {
      const seeds = SEED_JOB_WORKER_STOCKS(tenantId);
      for (const s of seeds) {
        await setDoc(doc(db, 'tenants', tenantId, 'jobWorkerStocks', s.id), s);
      }
      return seeds;
    }
    const list: JobWorkerStockBalance[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as JobWorkerStockBalance);
    });
    return list;
  } catch (error) {
    console.warn('Firestore fetchJobWorkerStocks fallback to local cache:', error);
    return getCachedJobWorkerStocks(tenantId);
  }
}

/**
 * Fetch auto-generated GRNs
 */
export async function fetchJobWorkGrns(tenantId: string, isSandboxMode: boolean = false): Promise<JobWorkGRN[]> {
  if (isSandboxMode || !db) {
    return getCachedGrns(tenantId);
  }

  try {
    const colPath = `tenants/${tenantId}/jobWorkGRNs`;
    const q = collection(db, colPath);
    const snap = await getDocs(q);
    if (snap.empty) {
      const seeds = SEED_JOB_WORK_GRNS(tenantId);
      for (const s of seeds) {
        await setDoc(doc(db, 'tenants', tenantId, 'jobWorkGRNs', s.id), s);
      }
      return seeds;
    }
    const list: JobWorkGRN[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as JobWorkGRN);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Firestore fetchJobWorkGrns fallback to local cache:', error);
    return getCachedGrns(tenantId);
  }
}

/**
 * Fetch detailed Vendor Stock Ledger transactions
 */
export async function fetchVendorStockLedger(
  tenantId: string, 
  vendorId?: string, 
  isSandboxMode: boolean = false
): Promise<VendorStockLedgerTransaction[]> {
  let list: VendorStockLedgerTransaction[] = [];
  if (isSandboxMode || !db) {
    list = getCachedVendorStockLedger(tenantId);
  } else {
    try {
      const colPath = `tenants/${tenantId}/vendorStockLedger`;
      const snap = await getDocs(collection(db, colPath));
      if (snap.empty) {
        list = SEED_VENDOR_STOCK_LEDGER(tenantId);
        for (const s of list) {
          await setDoc(doc(db, 'tenants', tenantId, 'vendorStockLedger', s.id), s);
        }
      } else {
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as VendorStockLedgerTransaction));
      }
    } catch (e) {
      list = getCachedVendorStockLedger(tenantId);
    }
  }

  if (vendorId && vendorId !== 'all') {
    list = list.filter(l => l.vendorId === vendorId);
  }

  return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Validates stock availability before issuing gate pass.
 */
export async function validateOwnStockAvailability(
  tenantId: string,
  items: { materialId?: string; materialCode: string; materialName: string; quantity: number; uom: string }[],
  isSandboxMode: boolean = false
): Promise<{ isValid: boolean; error?: string }> {
  let stockItems: StockItem[] = [];
  if (isSandboxMode || !db) {
    const raw = localStorage.getItem(`stock_items_${tenantId}`);
    stockItems = raw ? JSON.parse(raw) : [];
  } else {
    try {
      const colPath = `tenants/${tenantId}/stockItems`;
      const snap = await getDocs(collection(db, colPath));
      snap.forEach(d => stockItems.push({ id: d.id, ...d.data() } as StockItem));
    } catch (e) {
      const raw = localStorage.getItem(`stock_items_${tenantId}`);
      stockItems = raw ? JSON.parse(raw) : [];
    }
  }

  for (const item of items) {
    const matched = stockItems.find(s => 
      (item.materialId && s.id === item.materialId) || 
      (s.code && s.code.toLowerCase() === item.materialCode.toLowerCase()) ||
      (s.name && s.name.toLowerCase() === item.materialName.toLowerCase())
    );

    if (matched) {
      const availableQty = matched.currentQty;
      if (item.quantity > availableQty) {
        return {
          isValid: false,
          error: `Insufficient own stock for ${matched.name || item.materialName}. Available: ${availableQty} ${matched.unit || item.uom}.`
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * CREATE OUTWARD GATE PASS
 */
export async function createOutwardGatePass(
  tenantId: string,
  data: Omit<JobWorkGatePass, 'id' | 'tenantId' | 'gatePassNumber' | 'type' | 'status' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName'>,
  user: { uid: string; displayName?: string | null; email?: string | null },
  isSandboxMode: boolean = false
): Promise<JobWorkGatePass> {
  const val = await validateOwnStockAvailability(tenantId, data.items, isSandboxMode);
  if (!val.isValid) {
    throw new Error(val.error || 'Stock validation failed.');
  }

  const existingPasses = isSandboxMode || !db ? getCachedGatePasses(tenantId) : await fetchGatePasses(tenantId, false);
  const gatePassNumber = generateGatePassNumber('outward', existingPasses);
  const passId = `gp-out-${Date.now()}`;

  const createdByName = user.displayName || user.email || 'Stores User';

  const newPass: JobWorkGatePass = {
    ...data,
    id: passId,
    tenantId,
    gatePassNumber,
    type: 'outward',
    status: 'issued',
    createdBy: user.uid,
    createdByName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: data.items.map((it, idx) => ({
      ...it,
      id: it.id || `gp-item-${Date.now()}-${idx}`,
      returnedQty: 0,
      rejectedQty: 0,
      shortClosedQty: 0,
      balanceWithVendor: it.quantity
    }))
  };

  // 1. Reduce "Own Stock" and add ledger entries
  await deductOwnStockForGatePass(tenantId, newPass, user, isSandboxMode);

  // 2. Update "Stock with Job Worker" for that vendor
  await incrementJobWorkerStock(tenantId, newPass, isSandboxMode);

  // 3. Append to Vendor Stock Ledger
  await appendOutwardToVendorLedger(tenantId, newPass, user, isSandboxMode);

  // 4. Save Gate Pass record
  if (isSandboxMode || !db) {
    const list = getCachedGatePasses(tenantId);
    saveCachedGatePasses(tenantId, [newPass, ...list]);
  } else {
    try {
      const docRef = doc(db, 'tenants', tenantId, 'jobWorkGatePasses', passId);
      await setDoc(docRef, newPass);
    } catch (e) {
      console.warn('Error saving gate pass to firestore, updating local cache:', e);
      const list = getCachedGatePasses(tenantId);
      saveCachedGatePasses(tenantId, [newPass, ...list]);
    }
  }

  // 5. Activity Log audit
  await logActivityEvent({
    tenantId,
    actor: { userId: user.uid, displayName: createdByName },
    actionType: 'status_change',
    entityType: 'job',
    entityId: passId,
    description: `Outward Gate Pass ${gatePassNumber} issued to ${newPass.jobWorkerName} for ${newPass.natureOfWork} (${newPass.totalDispatchedQty} items dispatched). Own stock reduced.`,
    metadata: {
      gatePassNumber,
      jobWorkerName: newPass.jobWorkerName,
      natureOfWork: newPass.natureOfWork,
      vehicleNumber: newPass.vehicleDetails.vehicleNumber,
      totalQty: newPass.totalDispatchedQty
    }
  });

  return newPass;
}

/**
 * Deduct Own Stock when outward gate pass is issued
 */
async function deductOwnStockForGatePass(
  tenantId: string,
  gatePass: JobWorkGatePass,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean
): Promise<void> {
  const userName = user.displayName || 'Stores User';

  if (isSandboxMode || !db) {
    const key = `stock_items_${tenantId}`;
    const raw = localStorage.getItem(key);
    let items: StockItem[] = raw ? JSON.parse(raw) : [];

    for (const lineItem of gatePass.items) {
      const idx = items.findIndex(s => 
        (lineItem.materialId && s.id === lineItem.materialId) ||
        (s.code && s.code.toLowerCase() === lineItem.materialCode.toLowerCase()) ||
        (s.name && s.name.toLowerCase() === lineItem.materialName.toLowerCase())
      );

      if (idx !== -1) {
        const itemObj = items[idx];
        const newQty = Math.max(0, itemObj.currentQty - lineItem.quantity);
        items[idx] = {
          ...itemObj,
          currentQty: newQty,
          lastUpdated: new Date().toISOString(),
          updatedBy: user.uid,
          updatedByName: userName
        };

        const ledgerKey = `ledger_${tenantId}_${itemObj.id}`;
        const rawLedger = localStorage.getItem(ledgerKey);
        const ledgerList: StockLedgerEntry[] = rawLedger ? JSON.parse(rawLedger) : [];
        const entry: StockLedgerEntry = {
          id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          tenantId,
          itemId: itemObj.id,
          timestamp: new Date().toISOString(),
          type: 'outward',
          qty: lineItem.quantity,
          reason: `Outward Job Work Gate Pass ${gatePass.gatePassNumber} to ${gatePass.jobWorkerName} for ${gatePass.natureOfWork}`,
          updatedBy: user.uid,
          updatedByName: userName,
          qtyAfter: newQty
        };
        localStorage.setItem(ledgerKey, JSON.stringify([entry, ...ledgerList]));
      }
    }
    localStorage.setItem(key, JSON.stringify(items));
  } else {
    try {
      const batch = writeBatch(db);
      for (const lineItem of gatePass.items) {
        if (!lineItem.materialId) continue;
        const itemRef = doc(db, 'tenants', tenantId, 'stockItems', lineItem.materialId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const prevQty = (itemSnap.data() as StockItem).currentQty || 0;
          const newQty = Math.max(0, prevQty - lineItem.quantity);

          batch.update(itemRef, {
            currentQty: newQty,
            lastUpdated: serverTimestamp(),
            updatedBy: user.uid,
            updatedByName: userName
          });

          const ledgerRef = doc(collection(db, 'tenants', tenantId, 'stockItems', lineItem.materialId, 'ledger'));
          batch.set(ledgerRef, {
            tenantId,
            itemId: lineItem.materialId,
            timestamp: serverTimestamp(),
            type: 'outward',
            qty: lineItem.quantity,
            reason: `Outward Job Work Gate Pass ${gatePass.gatePassNumber} to ${gatePass.jobWorkerName} for ${gatePass.natureOfWork}`,
            updatedBy: user.uid,
            updatedByName: userName,
            qtyAfter: newQty
          });
        }
      }
      await batch.commit();
    } catch (e) {
      console.warn('Firestore stock deduction batch failed, fallback to local cache:', e);
      await deductOwnStockForGatePass(tenantId, gatePass, user, true);
    }
  }
}

/**
 * Increment / update "Stock with Job Worker"
 */
async function incrementJobWorkerStock(
  tenantId: string,
  gatePass: JobWorkGatePass,
  isSandboxMode: boolean
): Promise<void> {
  const currentStocks = isSandboxMode || !db 
    ? getCachedJobWorkerStocks(tenantId) 
    : await fetchJobWorkerStocks(tenantId, false);

  const updatedStocks = [...currentStocks];

  for (const item of gatePass.items) {
    const stockKey = `${gatePass.jobWorkerId}_${item.materialCode || item.materialId || 'item'}`;
    const existingIdx = updatedStocks.findIndex(s => 
      s.vendorId === gatePass.jobWorkerId && 
      (s.materialCode === item.materialCode || s.materialId === item.materialId)
    );

    if (existingIdx !== -1) {
      const curr = updatedStocks[existingIdx];
      updatedStocks[existingIdx] = {
        ...curr,
        quantityWithVendor: curr.quantityWithVendor + item.quantity,
        totalOutwardQty: curr.totalOutwardQty + item.quantity,
        lastGatePassNumber: gatePass.gatePassNumber,
        lastDispatchedDate: gatePass.dispatchedDate,
        expectedReturnDate: gatePass.expectedReturnDate,
        lastUpdated: new Date().toISOString()
      };
    } else {
      updatedStocks.push({
        id: stockKey,
        tenantId,
        plantId: gatePass.plantId,
        vendorId: gatePass.jobWorkerId,
        vendorName: gatePass.jobWorkerName,
        materialId: item.materialId || item.materialCode,
        materialCode: item.materialCode,
        materialName: item.materialName,
        uom: item.uom,
        quantityWithVendor: item.quantity,
        totalOutwardQty: item.quantity,
        totalReturnedQty: 0,
        totalRejectedQty: 0,
        totalShortClosedQty: 0,
        lastGatePassNumber: gatePass.gatePassNumber,
        lastDispatchedDate: gatePass.dispatchedDate,
        expectedReturnDate: gatePass.expectedReturnDate,
        lastUpdated: new Date().toISOString()
      });
    }
  }

  saveCachedJobWorkerStocks(tenantId, updatedStocks);

  if (!isSandboxMode && db) {
    try {
      for (const stk of updatedStocks) {
        await setDoc(doc(db, 'tenants', tenantId, 'jobWorkerStocks', stk.id), stk);
      }
    } catch (e) {
      console.warn('Error saving jobWorkerStocks to firestore:', e);
    }
  }
}

/**
 * Append outward dispatch transactions to Vendor Stock Ledger
 */
async function appendOutwardToVendorLedger(
  tenantId: string,
  gatePass: JobWorkGatePass,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean
): Promise<void> {
  const jwStocks = isSandboxMode || !db ? getCachedJobWorkerStocks(tenantId) : await fetchJobWorkerStocks(tenantId, false);
  const currentLedger = isSandboxMode || !db ? getCachedVendorStockLedger(tenantId) : await fetchVendorStockLedger(tenantId, undefined, false);
  const newTransactions: VendorStockLedgerTransaction[] = [];

  for (const item of gatePass.items) {
    const matchedStock = jwStocks.find(s => s.vendorId === gatePass.jobWorkerId && (s.materialCode === item.materialCode || s.materialId === item.materialId));
    const balance = matchedStock ? matchedStock.quantityWithVendor : item.quantity;

    newTransactions.push({
      id: `vled-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      tenantId,
      vendorId: gatePass.jobWorkerId,
      vendorName: gatePass.jobWorkerName,
      materialId: item.materialId || item.materialCode,
      materialCode: item.materialCode,
      materialName: item.materialName,
      uom: item.uom,
      timestamp: new Date().toISOString(),
      transactionType: 'outward_dispatch',
      refNumber: gatePass.gatePassNumber,
      sentQty: item.quantity,
      returnedQty: 0,
      rejectedQty: 0,
      balanceQty: balance,
      remarks: `Outward GP issued for ${gatePass.natureOfWork}`,
      performedBy: user.uid,
      performedByName: user.displayName || 'Stores User'
    });
  }

  saveCachedVendorStockLedger(tenantId, [...newTransactions, ...currentLedger]);

  if (!isSandboxMode && db) {
    try {
      for (const t of newTransactions) {
        await setDoc(doc(db, 'tenants', tenantId, 'vendorStockLedger', t.id), t);
      }
    } catch (e) {
      console.warn('Firestore appendOutwardToVendorLedger error:', e);
    }
  }
}

/**
 * CANCEL GATE PASS
 */
export async function cancelGatePass(
  tenantId: string,
  gatePassId: string,
  cancellationReason: string,
  materialPhysicallyLeft: boolean,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean = false
): Promise<JobWorkGatePass> {
  const passes = isSandboxMode || !db ? getCachedGatePasses(tenantId) : await fetchGatePasses(tenantId, false);
  const target = passes.find(p => p.id === gatePassId);
  if (!target) throw new Error('Gate pass not found.');

  if (target.status === 'cancelled') {
    throw new Error('Gate pass is already cancelled.');
  }

  const cancelledByName = user.displayName || 'Stores User';
  const updatedPass: JobWorkGatePass = {
    ...target,
    status: 'cancelled',
    cancellationReason,
    cancelledAt: new Date().toISOString(),
    cancelledBy: user.uid,
    cancelledByName,
    materialPhysicallyLeft,
    updatedAt: new Date().toISOString()
  };

  if (!materialPhysicallyLeft) {
    await reverseStockForCancelledGatePass(tenantId, target, cancellationReason, user, isSandboxMode);
  } else {
    console.log(`[Gate Pass Cancelled] Material has physically left factory. Stock remains with vendor (${target.jobWorkerName}). No auto-reversal executed.`);
  }

  const updatedList = passes.map(p => p.id === gatePassId ? updatedPass : p);
  saveCachedGatePasses(tenantId, updatedList);

  if (!isSandboxMode && db) {
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'jobWorkGatePasses', gatePassId), {
        status: 'cancelled',
        cancellationReason,
        cancelledAt: updatedPass.cancelledAt,
        cancelledBy: user.uid,
        cancelledByName,
        materialPhysicallyLeft,
        updatedAt: updatedPass.updatedAt
      });
    } catch (e) {
      console.warn('Firestore cancelGatePass update failed:', e);
    }
  }

  await logActivityEvent({
    tenantId,
    actor: { userId: user.uid, displayName: cancelledByName },
    actionType: 'status_change',
    entityType: 'job',
    entityId: gatePassId,
    description: `Gate Pass ${target.gatePassNumber} CANCELLED. Reason: ${cancellationReason}. ${
      materialPhysicallyLeft 
        ? '⚠️ Material physically left factory: Stock remains tracked at vendor (no auto-reversal).'
        : 'Material had not left factory: Own stock restored and vendor stock reversed.'
    }`,
    metadata: {
      gatePassNumber: target.gatePassNumber,
      cancellationReason,
      materialPhysicallyLeft
    }
  });

  return updatedPass;
}

/**
 * Reverses own stock and job worker stock when cancelled prior to physical departure
 */
async function reverseStockForCancelledGatePass(
  tenantId: string,
  gatePass: JobWorkGatePass,
  reason: string,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean
): Promise<void> {
  const userName = user.displayName || 'Stores User';

  const itemKey = `stock_items_${tenantId}`;
  const rawItems = localStorage.getItem(itemKey);
  let stockItems: StockItem[] = rawItems ? JSON.parse(rawItems) : [];

  for (const item of gatePass.items) {
    const idx = stockItems.findIndex(s => 
      (item.materialId && s.id === item.materialId) ||
      (s.code && s.code.toLowerCase() === item.materialCode.toLowerCase())
    );

    if (idx !== -1) {
      const curr = stockItems[idx];
      const newQty = curr.currentQty + item.quantity;
      stockItems[idx] = {
        ...curr,
        currentQty: newQty,
        lastUpdated: new Date().toISOString(),
        updatedBy: user.uid,
        updatedByName: userName
      };

      const ledgerKey = `ledger_${tenantId}_${curr.id}`;
      const rawLedger = localStorage.getItem(ledgerKey);
      const ledgerList: StockLedgerEntry[] = rawLedger ? JSON.parse(rawLedger) : [];
      ledgerList.unshift({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenantId,
        itemId: curr.id,
        timestamp: new Date().toISOString(),
        type: 'inward',
        qty: item.quantity,
        reason: `Cancellation Reversal for GP ${gatePass.gatePassNumber} (Material never left factory): ${reason}`,
        updatedBy: user.uid,
        updatedByName: userName,
        qtyAfter: newQty
      });
      localStorage.setItem(ledgerKey, JSON.stringify(ledgerList));
    }
  }
  localStorage.setItem(itemKey, JSON.stringify(stockItems));

  const jwStocks = getCachedJobWorkerStocks(tenantId);
  const updatedJwStocks = jwStocks.map(s => {
    if (s.vendorId === gatePass.jobWorkerId) {
      const matchedItem = gatePass.items.find(i => i.materialCode === s.materialCode || i.materialId === s.materialId);
      if (matchedItem) {
        return {
          ...s,
          quantityWithVendor: Math.max(0, s.quantityWithVendor - matchedItem.quantity),
          lastUpdated: new Date().toISOString()
        };
      }
    }
    return s;
  });
  saveCachedJobWorkerStocks(tenantId, updatedJwStocks);
}

/**
 * SHORT-CLOSE GATE PASS
 */
export async function shortCloseGatePass(
  tenantId: string,
  gatePassId: string,
  shortCloseReason: string,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean = false
): Promise<JobWorkGatePass> {
  const passes = isSandboxMode || !db ? getCachedGatePasses(tenantId) : await fetchGatePasses(tenantId, false);
  const target = passes.find(p => p.id === gatePassId);
  if (!target) throw new Error('Gate pass not found.');

  const shortClosedByName = user.displayName || 'Stores User';

  const updatedItems = target.items.map(it => {
    const balance = it.balanceWithVendor || 0;
    return {
      ...it,
      shortClosedQty: (it.shortClosedQty || 0) + balance,
      balanceWithVendor: 0
    };
  });

  const updatedPass: JobWorkGatePass = {
    ...target,
    items: updatedItems,
    status: 'short_closed',
    shortCloseReason,
    shortClosedAt: new Date().toISOString(),
    shortClosedBy: user.uid,
    shortClosedByName,
    updatedAt: new Date().toISOString()
  };

  const jwStocks = isSandboxMode || !db ? getCachedJobWorkerStocks(tenantId) : await fetchJobWorkerStocks(tenantId, false);
  const updatedJwStocks = jwStocks.map(s => {
    if (s.vendorId === target.jobWorkerId) {
      const match = target.items.find(i => i.materialCode === s.materialCode || i.materialId === s.materialId);
      if (match) {
        const balance = match.balanceWithVendor || 0;
        return {
          ...s,
          quantityWithVendor: Math.max(0, s.quantityWithVendor - balance),
          totalShortClosedQty: (s.totalShortClosedQty || 0) + balance,
          lastUpdated: new Date().toISOString()
        };
      }
    }
    return s;
  });
  saveCachedJobWorkerStocks(tenantId, updatedJwStocks);

  const updatedList = passes.map(p => p.id === gatePassId ? updatedPass : p);
  saveCachedGatePasses(tenantId, updatedList);

  if (!isSandboxMode && db) {
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'jobWorkGatePasses', gatePassId), {
        status: 'short_closed',
        items: updatedItems,
        shortCloseReason,
        shortClosedAt: updatedPass.shortClosedAt,
        shortClosedBy: user.uid,
        shortClosedByName,
        updatedAt: updatedPass.updatedAt
      });
    } catch (e) {
      console.warn('Firestore shortCloseGatePass update failed:', e);
    }
  }

  await logActivityEvent({
    tenantId,
    actor: { userId: user.uid, displayName: shortClosedByName },
    actionType: 'status_change',
    entityType: 'job',
    entityId: gatePassId,
    description: `Gate Pass ${target.gatePassNumber} SHORT-CLOSED. Reason: ${shortCloseReason}. Vendor stock balance cleared.`,
    metadata: { gatePassNumber: target.gatePassNumber, shortCloseReason }
  });

  return updatedPass;
}

/**
 * CREATE INWARD GATE PASS & RECONCILE RETURNS
 * Acceptance Criteria & Edge Cases:
 * 1. Fields: Received Qty, Processed Qty, Rejected Qty, Processing Charges.
 * 2. Own Stock: Increased ONLY by Processed Qty (Rejected Qty must not increase Own Stock).
 * 3. Stock with Job Worker: Decreased by Sent/Accounted Qty (Processed + Rejected + Scrap).
 * 4. GRN Auto-Generated: With unique GRN number (GRN/JW/YYYY/XXXX).
 * 5. Vendor Stock Ledger: Updates Sent, Returned, and Balance Qty with Vendor.
 * 6. Outward GP Status: Updates to 'Partially Returned' or 'Fully Returned'.
 * 7. EC: Received Qty > Sent Qty -> Blocks with: "Received quantity cannot exceed sent quantity."
 * 8. EC: Damaged items tracked with reason.
 * 9. EC: Disputed processing charges flaggable for finance review before payment.
 */
export async function createInwardGatePass(
  tenantId: string,
  input: InwardReturnInput,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean = false
): Promise<{ inwardPass: JobWorkGatePass; outwardPass: JobWorkGatePass; grn: JobWorkGRN }> {
  const passes = isSandboxMode || !db ? getCachedGatePasses(tenantId) : await fetchGatePasses(tenantId, false);
  const outwardPass = passes.find(p => p.id === input.outwardGatePassId);
  if (!outwardPass) throw new Error('Referenced Outward Gate Pass not found.');

  const existingGrns = isSandboxMode || !db ? getCachedGrns(tenantId) : await fetchJobWorkGrns(tenantId, false);
  const grnNumber = generateGrnNumber(existingGrns);
  const grnId = `grn-${Date.now()}`;

  const inwardGpNumber = generateGatePassNumber('inward', passes);
  const inwardId = `gp-in-${Date.now()}`;
  const userName = user.displayName || 'Stores User';

  // ── 1. VALIDATION FOR EDGE CASES: Received Qty > Sent Qty ───────────────────
  for (const it of input.items) {
    const receivedQty = (it.processedQty || 0) + (it.rejectedQty || 0);
    const sentQty = it.sentQty;

    // Check 1: single receipt exceeds original sent quantity
    if (receivedQty > sentQty + 0.0001) {
      throw new Error('Received quantity cannot exceed sent quantity.');
    }

    // Check 2: cumulative receipt across multiple partial returns exceeds sent quantity
    const origItem = outwardPass.items.find(i => i.id === it.gatePassItemId || i.materialCode === it.materialCode);
    if (origItem) {
      const alreadyAccounted = (origItem.returnedQty || 0) + (origItem.rejectedQty || 0) + (origItem.shortClosedQty || 0);
      if (alreadyAccounted + receivedQty > origItem.quantity + 0.0001) {
        throw new Error('Received quantity cannot exceed sent quantity.');
      }
    }
  }

  // ── 2. PREPARE INWARD LINE ITEMS ────────────────────────────────────────────
  const inwardItems: GatePassItem[] = input.items.map((it, idx) => {
    const physicalReceived = (it.processedQty || 0) + (it.rejectedQty || 0);
    return {
      id: `gp-in-item-${Date.now()}-${idx}`,
      materialId: it.materialId,
      materialCode: it.materialCode,
      materialName: it.materialName,
      quantity: physicalReceived,
      uom: it.uom,
      returnedQty: it.processedQty,  // Good processed goods
      rejectedQty: it.rejectedQty,  // Damaged / rejected goods
      rejectionReason: it.rejectionReason,
      shortClosedQty: it.scrapQty || 0,
      remarks: it.remarks || (it.rejectedQty > 0 ? `Includes ${it.rejectedQty} ${it.uom} rejected/damaged: ${it.rejectionReason || 'Defective'}` : 'Accepted processed stock')
    };
  });

  const totalReceivedAtDock = inwardItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalProcessedQty = input.items.reduce((acc, curr) => acc + (curr.processedQty || 0), 0);
  const totalRejectedQty = input.items.reduce((acc, curr) => acc + (curr.rejectedQty || 0), 0);

  // ── 3. AUTO-GENERATE GRN RECORD ─────────────────────────────────────────────
  const newGrn: JobWorkGRN = {
    id: grnId,
    tenantId,
    plantId: outwardPass.plantId,
    grnNumber,
    inwardGatePassId: inwardId,
    inwardGatePassNumber: inwardGpNumber,
    outwardGatePassId: outwardPass.id,
    outwardGatePassNumber: outwardPass.gatePassNumber,
    jobWorkerId: input.jobWorkerId,
    jobWorkerName: input.jobWorkerName,
    jobWorkerGst: outwardPass.jobWorkerGst,
    receiptDate: input.inwardDate,
    items: input.items.map(it => ({
      materialId: it.materialId,
      materialCode: it.materialCode,
      materialName: it.materialName,
      uom: it.uom,
      sentQty: it.sentQty,
      receivedQty: (it.processedQty || 0) + (it.rejectedQty || 0),
      processedQty: it.processedQty,
      rejectedQty: it.rejectedQty,
      rejectionReason: it.rejectionReason,
      scrapReworkDisposition: it.rejectionDisposition || (it.rejectedQty > 0 ? 'quarantine' : undefined)
    })),
    totalProcessedQty,
    totalRejectedQty,
    processingCharges: input.processingCharges || 0,
    isProcessingChargeDisputed: input.isProcessingChargeDisputed || false,
    disputeReason: input.disputeReason || undefined,
    disputeStatus: input.isProcessingChargeDisputed ? 'disputed' : 'none',
    vendorChallanNo: input.vendorDeliveryChallanNo,
    vendorInvoiceNo: input.vendorInvoiceNo,
    vehicleNumber: input.vehicleDetails?.vehicleNumber,
    receivedBy: user.uid,
    receivedByName: userName,
    inspectionRemarks: input.generalRemarks || `Receipt Inspection: ${input.inspectionStatus}. Good: ${totalProcessedQty}, Rejected: ${totalRejectedQty}`,
    createdAt: new Date().toISOString()
  };

  // ── 4. CONSTRUCT INWARD GATE PASS ───────────────────────────────────────────
  const inwardPass: JobWorkGatePass = {
    id: inwardId,
    tenantId,
    plantId: outwardPass.plantId,
    gatePassNumber: inwardGpNumber,
    type: 'inward',
    jobWorkerId: input.jobWorkerId,
    jobWorkerName: input.jobWorkerName,
    jobWorkerGst: outwardPass.jobWorkerGst,
    jobWorkerAddress: outwardPass.jobWorkerAddress,
    natureOfWork: `Inward Return from ${outwardPass.natureOfWork}`,
    expectedReturnDate: outwardPass.expectedReturnDate,
    dispatchedDate: input.inwardDate,
    linkedOutwardGatePassId: outwardPass.id,
    linkedOutwardGatePassNumber: outwardPass.gatePassNumber,
    linkedJobWorkOrderNumber: outwardPass.linkedJobWorkOrderNumber,
    linkedWorkOrderNumber: outwardPass.linkedWorkOrderNumber,
    grnNumber,
    grnId,
    processingCharges: input.processingCharges || 0,
    isProcessingChargeDisputed: input.isProcessingChargeDisputed || false,
    disputeReason: input.disputeReason || undefined,
    disputeStatus: input.isProcessingChargeDisputed ? 'disputed' : 'none',
    vehicleDetails: {
      modeOfTransport: input.vehicleDetails?.modeOfTransport || 'road',
      transporterName: input.vehicleDetails?.transporterName || outwardPass.vehicleDetails.transporterName,
      vehicleNumber: input.vehicleDetails?.vehicleNumber || outwardPass.vehicleDetails.vehicleNumber,
      driverName: input.vehicleDetails?.driverName,
      driverPhone: input.vehicleDetails?.driverPhone,
      lrNumber: input.vehicleDetails?.lrNumber,
      lrDate: input.inwardDate
    },
    items: inwardItems,
    totalDispatchedQty: totalReceivedAtDock,
    totalProcessedQty,
    totalRejectedQty,
    totalEstimatedValue: 0,
    status: 'completed',
    gstChallanRule: 'Delivery Inward Challan for return of Job Work goods under Rule 45',
    internalRemarks: input.generalRemarks || `Challan: ${input.vendorDeliveryChallanNo || 'N/A'}. Processing Charges: ₹${(input.processingCharges || 0).toLocaleString('en-IN')}`,
    vendorDeliveryChallanNo: input.vendorDeliveryChallanNo,
    vendorInvoiceNo: input.vendorInvoiceNo,
    createdBy: user.uid,
    createdByName: userName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // ── 5. UPDATE OWN STOCK (ONLY Processed Qty, NOT Rejected Qty) ─────────────
  await restoreOwnStockFromInward(tenantId, inwardPass, outwardPass, user, isSandboxMode);

  // ── 6. DECREASE "STOCK WITH JOB WORKER" (Sent/Accounted Qty) ───────────────
  await decrementJobWorkerStock(tenantId, input, outwardPass, isSandboxMode);

  // ── 7. UPDATE OUTWARD GATE PASS STATUS & LINE ITEM BALANCES ─────────────────
  let allFullyReturned = true;
  const updatedOutwardItems = outwardPass.items.map(origItem => {
    const returnedMatch = input.items.find(i => i.gatePassItemId === origItem.id || i.materialCode === origItem.materialCode);
    if (returnedMatch) {
      const newReturned = (origItem.returnedQty || 0) + (returnedMatch.processedQty || 0);
      const newRejected = (origItem.rejectedQty || 0) + (returnedMatch.rejectedQty || 0);
      const newScrap = (origItem.shortClosedQty || 0) + (returnedMatch.scrapQty || 0);
      const totalAccounted = newReturned + newRejected + newScrap;
      const newBalance = Math.max(0, origItem.quantity - totalAccounted);

      if (newBalance > 0.0001) allFullyReturned = false;

      return {
        ...origItem,
        returnedQty: newReturned,
        rejectedQty: newRejected,
        shortClosedQty: newScrap,
        balanceWithVendor: newBalance
      };
    }

    if ((origItem.balanceWithVendor || 0) > 0.0001) {
      allFullyReturned = false;
    }
    return origItem;
  });

  const updatedOutwardPass: JobWorkGatePass = {
    ...outwardPass,
    items: updatedOutwardItems,
    status: allFullyReturned ? 'fully_returned' : 'partially_returned',
    updatedAt: new Date().toISOString()
  };

  // ── 8. APPEND TRANSACTIONS TO VENDOR STOCK LEDGER ────────────────────────────
  await appendInwardToVendorLedger(tenantId, inwardPass, outwardPass, input, newGrn, user, isSandboxMode);

  // ── 9. COMMIT CACHE & PERSISTENCE ───────────────────────────────────────────
  // Save GRN
  const currentGrns = isSandboxMode || !db ? getCachedGrns(tenantId) : await fetchJobWorkGrns(tenantId, false);
  saveCachedGrns(tenantId, [newGrn, ...currentGrns]);

  // Save Gate Passes
  const updatedList = [inwardPass, ...passes.map(p => p.id === outwardPass.id ? updatedOutwardPass : p)];
  saveCachedGatePasses(tenantId, updatedList);

  if (!isSandboxMode && db) {
    try {
      await setDoc(doc(db, 'tenants', tenantId, 'jobWorkGatePasses', inwardId), inwardPass);
      await setDoc(doc(db, 'tenants', tenantId, 'jobWorkGRNs', grnId), newGrn);
      await updateDoc(doc(db, 'tenants', tenantId, 'jobWorkGatePasses', outwardPass.id), {
        items: updatedOutwardItems,
        status: updatedOutwardPass.status,
        updatedAt: updatedOutwardPass.updatedAt
      });
    } catch (e) {
      console.warn('Firestore inward save error, cached locally:', e);
    }
  }

  // ── 10. ACTIVITY LOG ────────────────────────────────────────────────────────
  await logActivityEvent({
    tenantId,
    actor: { userId: user.uid, displayName: userName },
    actionType: 'status_change',
    entityType: 'job',
    entityId: inwardId,
    description: `Inward Gate Pass ${inwardGpNumber} & ${grnNumber} generated for ${input.jobWorkerName}. Processed Qty: ${totalProcessedQty} added to Own Stock. Rejected Qty: ${totalRejectedQty} logged. Outward GP ${outwardPass.gatePassNumber} status: ${updatedOutwardPass.status}.`,
    metadata: {
      inwardGpNumber,
      grnNumber,
      outwardGpNumber: outwardPass.gatePassNumber,
      vendorName: input.jobWorkerName,
      totalProcessedQty,
      totalRejectedQty,
      processingCharges: input.processingCharges,
      isDisputed: input.isProcessingChargeDisputed,
      outwardStatus: updatedOutwardPass.status
    }
  });

  return { inwardPass, outwardPass: updatedOutwardPass, grn: newGrn };
}

/**
 * Restores own stock from inward return:
 * CRITICAL RULE: Own Stock increases ONLY by Processed Qty (good accepted goods).
 * Rejected Qty does NOT increase usable stock and is tracked separately.
 */
async function restoreOwnStockFromInward(
  tenantId: string,
  inwardPass: JobWorkGatePass,
  outwardPass: JobWorkGatePass,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean
): Promise<void> {
  const userName = user.displayName || 'Stores User';
  const key = `stock_items_${tenantId}`;
  const rawItems = localStorage.getItem(key);
  let stockItems: StockItem[] = rawItems ? JSON.parse(rawItems) : [];

  for (const lineItem of inwardPass.items) {
    // Only processed/good quantity restores usable Own Stock!
    const qtyToRestore = lineItem.returnedQty || 0;
    if (qtyToRestore <= 0) continue;

    const idx = stockItems.findIndex(s => 
      (lineItem.materialId && s.id === lineItem.materialId) ||
      (s.code && s.code.toLowerCase() === lineItem.materialCode.toLowerCase())
    );

    if (idx !== -1) {
      const curr = stockItems[idx];
      const newQty = curr.currentQty + qtyToRestore;
      stockItems[idx] = {
        ...curr,
        currentQty: newQty,
        lastUpdated: new Date().toISOString(),
        updatedBy: user.uid,
        updatedByName: userName
      };

      const ledgerKey = `ledger_${tenantId}_${curr.id}`;
      const rawLedger = localStorage.getItem(ledgerKey);
      const ledgerList: StockLedgerEntry[] = rawLedger ? JSON.parse(rawLedger) : [];
      ledgerList.unshift({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenantId,
        itemId: curr.id,
        timestamp: new Date().toISOString(),
        type: 'inward',
        qty: qtyToRestore,
        reason: `Job Work Inward Return ${inwardPass.gatePassNumber} (GRN: ${inwardPass.grnNumber}) from ${inwardPass.jobWorkerName} - Processed stock restored`,
        updatedBy: user.uid,
        updatedByName: userName,
        qtyAfter: newQty
      });
      localStorage.setItem(ledgerKey, JSON.stringify(ledgerList));
    }
  }
  localStorage.setItem(key, JSON.stringify(stockItems));
}

/**
 * Decrement stock at job worker when items are returned/accounted
 */
async function decrementJobWorkerStock(
  tenantId: string,
  input: InwardReturnInput,
  outwardPass: JobWorkGatePass,
  isSandboxMode: boolean
): Promise<void> {
  const jwStocks = isSandboxMode || !db ? getCachedJobWorkerStocks(tenantId) : await fetchJobWorkerStocks(tenantId, false);
  const updatedJwStocks = jwStocks.map(s => {
    if (s.vendorId === input.jobWorkerId) {
      const match = input.items.find(i => i.materialCode === s.materialCode || i.materialId === s.materialId);
      if (match) {
        // Deduction equals total accounted: processed + rejected + scrap
        const totalDeduction = (match.processedQty || 0) + (match.rejectedQty || 0) + (match.scrapQty || 0);
        return {
          ...s,
          quantityWithVendor: Math.max(0, s.quantityWithVendor - totalDeduction),
          totalReturnedQty: (s.totalReturnedQty || 0) + (match.processedQty || 0),
          totalRejectedQty: (s.totalRejectedQty || 0) + (match.rejectedQty || 0),
          totalShortClosedQty: (s.totalShortClosedQty || 0) + (match.scrapQty || 0),
          lastUpdated: new Date().toISOString()
        };
      }
    }
    return s;
  });
  saveCachedJobWorkerStocks(tenantId, updatedJwStocks);
}

/**
 * Append Inward transactions to Vendor Stock Ledger
 */
async function appendInwardToVendorLedger(
  tenantId: string,
  inwardPass: JobWorkGatePass,
  outwardPass: JobWorkGatePass,
  input: InwardReturnInput,
  grn: JobWorkGRN,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean
): Promise<void> {
  const jwStocks = isSandboxMode || !db ? getCachedJobWorkerStocks(tenantId) : await fetchJobWorkerStocks(tenantId, false);
  const currentLedger = isSandboxMode || !db ? getCachedVendorStockLedger(tenantId) : await fetchVendorStockLedger(tenantId, undefined, false);
  const newTransactions: VendorStockLedgerTransaction[] = [];
  const userName = user.displayName || 'Stores User';

  for (const item of input.items) {
    const matchedStock = jwStocks.find(s => s.vendorId === input.jobWorkerId && (s.materialCode === item.materialCode || s.materialId === item.materialId));
    const balance = matchedStock ? matchedStock.quantityWithVendor : 0;

    // Transaction 1: Processed & returned to Own Stock
    if ((item.processedQty || 0) > 0) {
      newTransactions.push({
        id: `vled-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenantId,
        vendorId: input.jobWorkerId,
        vendorName: input.jobWorkerName,
        materialId: item.materialId || item.materialCode,
        materialCode: item.materialCode,
        materialName: item.materialName,
        uom: item.uom,
        timestamp: new Date().toISOString(),
        transactionType: 'inward_processed',
        refNumber: grn.grnNumber,
        sentQty: 0,
        returnedQty: item.processedQty,
        rejectedQty: 0,
        balanceQty: balance,
        remarks: `GRN ${grn.grnNumber} (Inward GP ${inwardPass.gatePassNumber}) Processed goods received. Charges: ₹${input.processingCharges}`,
        performedBy: user.uid,
        performedByName: userName
      });
    }

    // Transaction 2: Rejected goods (if any)
    if ((item.rejectedQty || 0) > 0) {
      newTransactions.push({
        id: `vled-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenantId,
        vendorId: input.jobWorkerId,
        vendorName: input.jobWorkerName,
        materialId: item.materialId || item.materialCode,
        materialCode: item.materialCode,
        materialName: item.materialName,
        uom: item.uom,
        timestamp: new Date().toISOString(),
        transactionType: 'inward_rejected',
        refNumber: grn.grnNumber,
        sentQty: 0,
        returnedQty: 0,
        rejectedQty: item.rejectedQty,
        balanceQty: balance,
        remarks: `Rejected upon return: ${item.rejectionReason || 'Damaged/Defective'}. Disposition: ${item.rejectionDisposition || 'quarantine'}`,
        performedBy: user.uid,
        performedByName: userName
      });
    }
  }

  saveCachedVendorStockLedger(tenantId, [...newTransactions, ...currentLedger]);

  if (!isSandboxMode && db) {
    try {
      for (const t of newTransactions) {
        await setDoc(doc(db, 'tenants', tenantId, 'vendorStockLedger', t.id), t);
      }
    } catch (e) {
      console.warn('Firestore appendInwardToVendorLedger error:', e);
    }
  }
}

/**
 * Resolve or approve a disputed processing charge line
 */
export async function resolveProcessingChargeDispute(
  tenantId: string,
  grnId: string,
  resolution: 'approved' | 'settled',
  notes: string,
  user: { uid: string; displayName?: string | null },
  isSandboxMode: boolean = false
): Promise<JobWorkGRN> {
  const grns = isSandboxMode || !db ? getCachedGrns(tenantId) : await fetchJobWorkGrns(tenantId, false);
  const target = grns.find(g => g.id === grnId);
  if (!target) throw new Error('GRN not found.');

  const resolvedByName = user.displayName || 'Finance Officer';
  const updatedGrn: JobWorkGRN = {
    ...target,
    isProcessingChargeDisputed: false,
    disputeStatus: resolution,
    disputeResolvedAt: new Date().toISOString(),
    disputeResolvedBy: user.uid,
    inspectionRemarks: `${target.inspectionRemarks || ''} | Finance Review: ${notes} (Resolved by ${resolvedByName})`
  };

  const updatedGrns = grns.map(g => g.id === grnId ? updatedGrn : g);
  saveCachedGrns(tenantId, updatedGrns);

  // Also update inward gate pass
  const passes = isSandboxMode || !db ? getCachedGatePasses(tenantId) : await fetchGatePasses(tenantId, false);
  const updatedPasses = passes.map(p => {
    if (p.id === target.inwardGatePassId) {
      return {
        ...p,
        isProcessingChargeDisputed: false,
        disputeStatus: resolution
      };
    }
    return p;
  });
  saveCachedGatePasses(tenantId, updatedPasses);

  if (!isSandboxMode && db) {
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'jobWorkGRNs', grnId), {
        isProcessingChargeDisputed: false,
        disputeStatus: resolution,
        disputeResolvedAt: updatedGrn.disputeResolvedAt,
        disputeResolvedBy: user.uid,
        inspectionRemarks: updatedGrn.inspectionRemarks
      });
      await updateDoc(doc(db, 'tenants', tenantId, 'jobWorkGatePasses', target.inwardGatePassId), {
        isProcessingChargeDisputed: false,
        disputeStatus: resolution
      });
    } catch (e) {
      console.warn('Firestore resolveProcessingChargeDispute error:', e);
    }
  }

  await logActivityEvent({
    tenantId,
    actor: { userId: user.uid, displayName: resolvedByName },
    actionType: 'status_change',
    entityType: 'job',
    entityId: grnId,
    description: `Processing charge dispute for ${target.grnNumber} resolved (${resolution}). Notes: ${notes}`,
    metadata: { grnNumber: target.grnNumber, resolution, notes }
  });

  return updatedGrn;
}

/**
 * Compute real-time KPIs for Job Work dashboard
 */
export function calculateJobWorkKPIs(
  passes: JobWorkGatePass[], 
  stocks: JobWorkerStockBalance[],
  grns: JobWorkGRN[] = []
): JobWorkKPIs {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const activePasses = passes.filter(p => p.status === 'issued' || p.status === 'in_transit' || p.status === 'partially_returned');
  const dispatchedToday = passes.filter(p => p.type === 'outward' && p.dispatchedDate === todayStr).length;
  
  const pendingReturns = passes.filter(p => 
    p.type === 'outward' && (p.status === 'issued' || p.status === 'partially_returned')
  ).length;

  const overdue = passes.filter(p => {
    if (p.type !== 'outward' || p.status === 'completed' || p.status === 'fully_returned' || p.status === 'cancelled' || p.status === 'short_closed') {
      return false;
    }
    return p.expectedReturnDate && new Date(p.expectedReturnDate) < now;
  }).length;

  const activeVendors = new Set(stocks.filter(s => s.quantityWithVendor > 0).map(s => s.vendorId)).size;
  const itemsWithVendors = stocks.filter(s => s.quantityWithVendor > 0).length;
  const disputedCharges = grns.filter(g => g.isProcessingChargeDisputed).length;

  return {
    totalActiveGatePasses: activePasses.length,
    totalDispatchedToday: dispatchedToday,
    totalPendingReturns: pendingReturns,
    totalOverdueGatePasses: overdue,
    totalActiveVendorsCount: activeVendors,
    totalStockItemsWithVendors: itemsWithVendors,
    totalGrnsGenerated: grns.length,
    totalDisputedChargesCount: disputedCharges
  };
}
