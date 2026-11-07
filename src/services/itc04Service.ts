// src/services/itc04Service.ts

import * as XLSX from 'xlsx';
import { 
  JobWorkGatePass, 
  JobWorkGRN, 
  ITC04Quarter, 
  ITC04FilingMode, 
  ITC04ReportSummary, 
  ITC04Table4Entry, 
  ITC04Table5AEntry 
} from '../types/jobWork';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Validates Indian 15-character Goods and Services Tax Identification Number (GSTIN)
 * Format: 2 digits (State code) + 10 characters (PAN) + 1 digit (Entity) + 'Z' + 1 checksum
 * Example: 27AABCT9981K1Z3
 */
export function validateIndianGstin(gstin: string | undefined | null): { 
  isValid: boolean; 
  stateCode: string; 
  error?: string 
} {
  if (!gstin || typeof gstin !== 'string' || !gstin.trim()) {
    return {
      isValid: false,
      stateCode: '',
      error: 'GSTIN is missing. Job worker must have a valid 15-digit GSTIN.'
    };
  }

  const clean = gstin.trim().toUpperCase();

  // Special allowable legal code for Unregistered Person in certain B2C contexts, but flagged in ITC-04
  if (clean === 'URP') {
    return {
      isValid: true,
      stateCode: '99',
      error: undefined
    };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  
  if (!gstinRegex.test(clean)) {
    return {
      isValid: false,
      stateCode: clean.length >= 2 && /^\d{2}$/.test(clean.substring(0, 2)) ? clean.substring(0, 2) : '',
      error: `Invalid GSTIN format "${clean}". Must be 15 alphanumeric characters (e.g. 27AABCT9981K1Z3).`
    };
  }

  const stateCode = clean.substring(0, 2);
  return {
    isValid: true,
    stateCode,
    error: undefined
  };
}

/**
 * Standard GST Unique Quantity Code (UQC) Mapping
 * Aligns ERP stock UOM to official GST Portal UQC dictionary
 */
export function getStandardUQC(uom: string): string {
  if (!uom) return 'OTH';
  const clean = uom.trim().toLowerCase();

  if (clean === 'kg' || clean === 'kgs' || clean === 'kilogram' || clean === 'kilograms') {
    return 'KGS';
  }
  if (clean === 'ton' || clean === 'tons' || clean === 'tonnes' || clean === 'mt') {
    return 'TON';
  }
  if (clean === 'nos' || clean === 'units' || clean === 'unit' || clean === 'pcs' || clean === 'pieces' || clean === 'no') {
    return 'NOS';
  }
  if (clean === 'mtr' || clean === 'meter' || clean === 'meters' || clean === 'm') {
    return 'MTR';
  }
  if (clean === 'ltr' || clean === 'litre' || clean === 'litres' || clean === 'l') {
    return 'LTR';
  }
  if (clean === 'box' || clean === 'boxes') {
    return 'BOX';
  }
  if (clean === 'set' || clean === 'sets') {
    return 'SET';
  }
  if (clean === 'sqm' || clean === 'sqmtr' || clean === 'sq m') {
    return 'SQM';
  }
  return clean.substring(0, 3).toUpperCase();
}

/**
 * Calculates start and end dates and GST filing period code (fp) for a Quarter and Financial Year
 */
export function getQuarterDateRange(
  quarter: ITC04Quarter, 
  financialYear: string
): { startDate: Date; endDate: Date; label: string; fp: string; yearStart: number; yearEnd: number } {
  // Parse financial year e.g. "FY2026-27" or "2026-2027" or "2026"
  let startYear = 2026;
  if (financialYear.includes('-')) {
    const parts = financialYear.replace(/[^0-9-]/g, '').split('-');
    startYear = parseInt(parts[0], 10) || 2026;
  } else {
    startYear = parseInt(financialYear.replace(/[^0-9]/g, ''), 10) || 2026;
  }
  const endYear = startYear + 1;

  let startDate: Date;
  let endDate: Date;
  let fp = '122026';
  let label = '';

  switch (quarter) {
    case 'Q1':
      startDate = new Date(startYear, 3, 1, 0, 0, 0); // 1 Apr
      endDate = new Date(startYear, 5, 30, 23, 59, 59); // 30 Jun
      fp = `06${startYear}`;
      label = `Q1 (Apr - Jun ${startYear})`;
      break;
    case 'Q2':
      startDate = new Date(startYear, 6, 1, 0, 0, 0); // 1 Jul
      endDate = new Date(startYear, 8, 30, 23, 59, 59); // 30 Sep
      fp = `09${startYear}`;
      label = `Q2 (Jul - Sep ${startYear})`;
      break;
    case 'Q3':
      startDate = new Date(startYear, 9, 1, 0, 0, 0); // 1 Oct
      endDate = new Date(startYear, 11, 31, 23, 59, 59); // 31 Dec
      fp = `12${startYear}`;
      label = `Q3 (Oct - Dec ${startYear})`;
      break;
    case 'Q4':
      startDate = new Date(endYear, 0, 1, 0, 0, 0); // 1 Jan
      endDate = new Date(endYear, 2, 31, 23, 59, 59); // 31 Mar
      fp = `03${endYear}`;
      label = `Q4 (Jan - Mar ${endYear})`;
      break;
  }

  return { startDate, endDate, label, fp, yearStart: startYear, yearEnd: endYear };
}

/**
 * Formats a Date to DD-MM-YYYY format required by GST Offline Utility
 */
export function formatGstDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Generates comprehensive ITC-04 data, reconciliation summary, and validates all gate passes
 * Covers Acceptance Criteria, EC 1 (pending open passes), EC 2 (GSTIN validation), and EC 3 (Dual-role).
 */
export function generateITC04Summary(
  allPasses: JobWorkGatePass[],
  grns: JobWorkGRN[],
  quarter: ITC04Quarter,
  financialYear: string,
  filingMode: ITC04FilingMode,
  principalGstin: string = '27AAACF1234F1Z5'
): ITC04ReportSummary {
  const { startDate, endDate, label } = getQuarterDateRange(quarter, financialYear);

  // 1. Filter Outward and Inward passes
  // For Mode 'principal': standard outward dispatched to job workers
  // For Mode 'job_worker': customer free-issue materials (where internal remarks or type indicate customer job work)
  const isJobWorkerMode = filingMode === 'job_worker';

  const relevantPasses = allPasses.filter(p => {
    // If job worker mode, look for passes tagged with customer free-issue or customer job work
    const isCustomerFreeIssue = p.internalRemarks?.toLowerCase().includes('customer') || 
                                p.natureOfWork?.toLowerCase().includes('free-issue') ||
                                (p as any).isCustomerFreeIssue === true;

    if (isJobWorkerMode) {
      return isCustomerFreeIssue;
    } else {
      // Principal mode includes standard manufacturing job work
      return !isCustomerFreeIssue;
    }
  });

  const outwardPasses = relevantPasses.filter(p => p.type === 'outward');
  const inwardPasses = relevantPasses.filter(p => p.type === 'inward');

  const table4Entries: ITC04Table4Entry[] = [];
  const table5AEntries: ITC04Table5AEntry[] = [];
  const warnings: string[] = [];
  const blockingErrors: string[] = [];

  let invalidGstinCount = 0;
  let mismatchCount = 0;
  let totalQuantitySent = 0;
  let totalQuantityReturned = 0;
  let totalQuantityPending = 0;
  let totalTaxableValue = 0;

  let totalReturnedPassesCount = 0;
  let totalPendingPassesCount = 0;

  // 2. Build Table 4 (Inputs / Capital goods sent for job work)
  for (const pass of outwardPasses) {
    const gstinVal = validateIndianGstin(pass.jobWorkerGst);
    if (!gstinVal.isValid) {
      invalidGstinCount++;
      blockingErrors.push(`Gate Pass ${pass.gatePassNumber} (${pass.jobWorkerName}): ${gstinVal.error}`);
    }

    const isFullyReturned = pass.status === 'fully_returned' || pass.status === 'completed';
    const isPartiallyReturned = pass.status === 'partially_returned';
    const isPending = !isFullyReturned;

    if (isFullyReturned) {
      totalReturnedPassesCount++;
    } else {
      totalPendingPassesCount++;
      // EC 1: Warning for open gate pass
      warnings.push(`Challan ${pass.gatePassNumber} is open with ${pass.jobWorkerName} (Expected: ${pass.expectedReturnDate || 'N/A'}). Included as "Sent, Not Yet Returned".`);
    }

    for (const item of pass.items) {
      const uqc = getStandardUQC(item.uom);
      const qtySent = item.quantity;
      const qtyReturned = item.returnedQty || 0;
      const qtyPending = Math.max(0, qtySent - qtyReturned - (item.rejectedQty || 0) - (item.shortClosedQty || 0));
      const taxableVal = item.totalValue || (qtySent * (item.ratePerUnit || 100));

      totalQuantitySent += qtySent;
      totalQuantityReturned += qtyReturned;
      totalQuantityPending += qtyPending;
      totalTaxableValue += taxableVal;

      // Mismatch check: Quantity returned cannot exceed quantity sent
      let isMismatch = false;
      let mismatchReason: string | undefined = undefined;
      if (qtyReturned + (item.rejectedQty || 0) > qtySent + 0.001) {
        isMismatch = true;
        mismatchCount++;
        mismatchReason = `Returned quantity (${qtyReturned}) exceeds sent quantity (${qtySent})`;
        warnings.push(`Mismatch on ${pass.gatePassNumber}: ${mismatchReason}`);
      }

      table4Entries.push({
        id: `t4-${pass.id}-${item.id}`,
        gatePassId: pass.id,
        gatePassNumber: pass.gatePassNumber,
        challanDate: formatGstDate(pass.dispatchedDate),
        jobWorkerId: pass.jobWorkerId,
        jobWorkerName: pass.jobWorkerName,
        jobWorkerGstin: pass.jobWorkerGst || '',
        stateCode: gstinVal.stateCode || '27',
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialDescription: item.materialName,
        uqc,
        quantitySent: qtySent,
        taxableValue: taxableVal,
        natureOfJobWork: pass.natureOfWork,
        typeOfGoods: 'Inputs',
        returnStatus: isFullyReturned ? 'fully_returned' : isPartiallyReturned ? 'partially_returned' : 'pending',
        quantityReturned: qtyReturned,
        quantityPending: qtyPending,
        isValidGstin: gstinVal.isValid,
        gstinValidationError: gstinVal.error,
        isMismatch,
        mismatchReason
      });
    }
  }

  // 3. Build Table 5A (Inputs / Capital goods received back from Job Worker)
  for (const inward of inwardPasses) {
    const parentOutward = allPasses.find(p => p.id === inward.linkedOutwardGatePassId || p.gatePassNumber === inward.linkedOutwardGatePassNumber);
    const gstinVal = validateIndianGstin(inward.jobWorkerGst || parentOutward?.jobWorkerGst);

    for (const item of inward.items) {
      const uqc = getStandardUQC(item.uom);
      const qtyReceived = item.returnedQty || item.quantity;
      const qtyRejected = item.rejectedQty || 0;

      table5AEntries.push({
        id: `t5a-${inward.id}-${item.id}`,
        inwardGatePassId: inward.id,
        inwardGatePassNumber: inward.gatePassNumber,
        inwardReceiptDate: formatGstDate(inward.dispatchedDate),
        originalChallanNumber: inward.linkedOutwardGatePassNumber || 'N/A',
        originalChallanDate: parentOutward ? formatGstDate(parentOutward.dispatchedDate) : formatGstDate(inward.dispatchedDate),
        jobWorkerId: inward.jobWorkerId,
        jobWorkerName: inward.jobWorkerName,
        jobWorkerGstin: inward.jobWorkerGst || parentOutward?.jobWorkerGst || '',
        stateCode: gstinVal.stateCode || '27',
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialDescription: item.materialName,
        uqc,
        quantityReceived: qtyReceived,
        quantityRejected: qtyRejected,
        natureOfJobWork: inward.natureOfWork || parentOutward?.natureOfWork || 'Job Work Return',
        typeOfGoods: 'Inputs',
        grnNumber: inward.grnNumber,
        isValidGstin: gstinVal.isValid,
        gstinValidationError: gstinVal.error
      });
    }
  }

  // 4. Export eligibility: blocked strictly if any GSTIN is invalid (EC 2), but allowed with warnings if passes are open (EC 1)
  const canExport = invalidGstinCount === 0;

  return {
    quarter,
    financialYear,
    periodLabel: `${label} - FY ${financialYear}`,
    filingMode,
    principalGstin,
    totalOutwardPasses: outwardPasses.length,
    totalReturnedPasses: totalReturnedPassesCount,
    totalPendingPasses: totalPendingPassesCount,
    totalTable4Items: table4Entries.length,
    totalTable5AItems: table5AEntries.length,
    totalQuantitySent,
    totalQuantityReturned,
    totalQuantityPending,
    totalTaxableValue,
    invalidGstinCount,
    mismatchCount,
    canExport,
    warnings,
    blockingErrors,
    table4: table4Entries,
    table5A: table5AEntries
  };
}

/**
 * Updates a Job Worker's GSTIN across gate passes and storage cache (EC 2 Quick Correction)
 */
export async function updateJobWorkerGstin(
  tenantId: string,
  vendorId: string,
  newGstin: string,
  gatePassId?: string,
  isSandboxMode: boolean = false
): Promise<void> {
  const gstinVal = validateIndianGstin(newGstin);
  if (!gstinVal.isValid) {
    throw new Error(gstinVal.error || 'Invalid GSTIN');
  }

  const cleanGstin = newGstin.trim().toUpperCase();

  // 1. Update in local storage gate passes cache
  const key = `job_work_gate_passes_${tenantId}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    const list: JobWorkGatePass[] = JSON.parse(raw);
    const updated = list.map(p => {
      if (p.jobWorkerId === vendorId || (gatePassId && p.id === gatePassId)) {
        return {
          ...p,
          jobWorkerGst: cleanGstin,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    localStorage.setItem(key, JSON.stringify(updated));
  }

  // 2. Update Firestore if live
  if (!isSandboxMode && db) {
    try {
      if (gatePassId) {
        await updateDoc(doc(db, 'tenants', tenantId, 'jobWorkGatePasses', gatePassId), {
          jobWorkerGst: cleanGstin,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Firestore updateJobWorkerGstin error:', e);
    }
  }
}

/**
 * Downloads official GST Portal Offline Tool compliant JSON file
 */
export function downloadITC04Json(summary: ITC04ReportSummary): void {
  const { quarter, financialYear, principalGstin, table4, table5A } = summary;
  const { fp } = getQuarterDateRange(quarter, financialYear);

  // Group Table 4 by Job Worker GSTIN and Challan Number per GST schema
  const tbl4Map = new Map<string, any>();
  for (const item of table4) {
    const key = `${item.jobWorkerGstin}_${item.gatePassNumber}`;
    if (!tbl4Map.has(key)) {
      tbl4Map.set(key, {
        jw_gstin: item.jobWorkerGstin,
        jw_trade_name: item.jobWorkerName,
        state_cd: item.stateCode,
        ch_no: item.gatePassNumber,
        ch_dt: item.challanDate,
        itms: []
      });
    }
    tbl4Map.get(key).itms.push({
      item_id: item.materialCode,
      itm_desc: item.materialDescription,
      uqc: item.uqc,
      qty: item.quantitySent,
      txval: Math.round(item.taxableValue),
      nature_job: item.natureOfJobWork,
      type_goods: item.typeOfGoods,
      return_status: item.returnStatus,
      qty_returned: item.quantityReturned,
      qty_pending: item.quantityPending
    });
  }

  // Group Table 5A by Inward Challan and Job Worker
  const tbl5aMap = new Map<string, any>();
  for (const item of table5A) {
    const key = `${item.jobWorkerGstin}_${item.inwardGatePassNumber}`;
    if (!tbl5aMap.has(key)) {
      tbl5aMap.set(key, {
        jw_gstin: item.jobWorkerGstin,
        jw_trade_name: item.jobWorkerName,
        state_cd: item.stateCode,
        orig_ch_no: item.originalChallanNumber,
        orig_ch_dt: item.originalChallanDate,
        inw_ch_no: item.inwardGatePassNumber,
        inw_ch_dt: item.inwardReceiptDate,
        itms: []
      });
    }
    tbl5aMap.get(key).itms.push({
      item_id: item.materialCode,
      itm_desc: item.materialDescription,
      uqc: item.uqc,
      qty_recvd: item.quantityReceived,
      qty_rej: item.quantityRejected,
      nature_job: item.natureOfJobWork,
      type_goods: item.typeOfGoods,
      grn_no: item.grnNumber
    });
  }

  const exportPayload = {
    gstin: principalGstin,
    fp: fp,
    quarter: quarter,
    financial_year: financialYear,
    filing_mode: summary.filingMode,
    version: 'ITC04_v1.2',
    timestamp: new Date().toISOString(),
    summary: {
      total_challans_sent: summary.totalOutwardPasses,
      total_challans_returned: summary.totalReturnedPasses,
      total_challans_pending: summary.totalPendingPasses,
      total_qty_sent: summary.totalQuantitySent,
      total_qty_returned: summary.totalQuantityReturned,
      total_qty_pending: summary.totalQuantityPending,
      total_taxable_value: summary.totalTaxableValue
    },
    tbl4: Array.from(tbl4Map.values()),
    tbl5a: Array.from(tbl5aMap.values())
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportPayload, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `ITC04_${principalGstin}_${quarter}_${financialYear.replace('/', '-')}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Downloads formatted multi-sheet Excel file (.xlsx) matching GST Portal Offline Utility
 */
export function downloadITC04Excel(summary: ITC04ReportSummary): void {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Table 4 (Inputs Sent for Job Work)
  const tbl4Data = summary.table4.map((t, idx) => ({
    'Sr No': idx + 1,
    'Job Worker GSTIN': t.jobWorkerGstin,
    'Job Worker Name': t.jobWorkerName,
    'State Code': t.stateCode,
    'Challan Number': t.gatePassNumber,
    'Challan Date': t.challanDate,
    'Type of Goods': t.typeOfGoods,
    'Material Code': t.materialCode,
    'Description of Goods': t.materialDescription,
    'Unique Quantity Code (UQC)': t.uqc,
    'Quantity Sent': t.quantitySent,
    'Taxable Value (INR)': t.taxableValue,
    'Nature of Job Work': t.natureOfJobWork,
    'Return Status': t.returnStatus.replace('_', ' ').toUpperCase(),
    'Quantity Returned': t.quantityReturned,
    'Quantity Pending': t.quantityPending,
    'GSTIN Status': t.isValidGstin ? 'VALID' : 'INVALID/MISSING'
  }));
  const wsTable4 = XLSX.utils.json_to_sheet(tbl4Data);
  XLSX.utils.book_append_sheet(workbook, wsTable4, 'Table 4 (Inputs Sent)');

  // Sheet 2: Table 5A (Goods Received Back)
  const tbl5aData = summary.table5A.map((t, idx) => ({
    'Sr No': idx + 1,
    'Job Worker GSTIN': t.jobWorkerGstin,
    'Job Worker Name': t.jobWorkerName,
    'State Code': t.stateCode,
    'Original Outward Challan No': t.originalChallanNumber,
    'Original Outward Challan Date': t.originalChallanDate,
    'Inward Challan / GP No': t.inwardGatePassNumber,
    'Inward Receipt Date': t.inwardReceiptDate,
    'GRN Number': t.grnNumber || 'N/A',
    'Type of Goods': t.typeOfGoods,
    'Material Code': t.materialCode,
    'Description of Goods': t.materialDescription,
    'UQC': t.uqc,
    'Quantity Received (Good)': t.quantityReceived,
    'Quantity Rejected': t.quantityRejected,
    'Nature of Job Work': t.natureOfJobWork
  }));
  const wsTable5A = XLSX.utils.json_to_sheet(tbl5aData);
  XLSX.utils.book_append_sheet(workbook, wsTable5A, 'Table 5A (Received Back)');

  // Sheet 3: Filing Summary & Reconciliation
  const summaryData = [
    { 'Parameter': 'Filing Period', 'Value': summary.periodLabel },
    { 'Parameter': 'Filing Mode', 'Value': summary.filingMode === 'principal' ? 'As Principal (Sending Goods)' : 'As Job Worker (Customer Free-Issue)' },
    { 'Parameter': 'Principal GSTIN', 'Value': summary.principalGstin },
    { 'Parameter': 'Total Outward Gate Passes', 'Value': summary.totalOutwardPasses },
    { 'Parameter': 'Fully Returned Gate Passes', 'Value': summary.totalReturnedPasses },
    { 'Parameter': 'Open / Pending Gate Passes', 'Value': summary.totalPendingPasses },
    { 'Parameter': 'Total Quantity Sent', 'Value': summary.totalQuantitySent },
    { 'Parameter': 'Total Quantity Returned', 'Value': summary.totalQuantityReturned },
    { 'Parameter': 'Total Quantity Pending with Job Workers', 'Value': summary.totalQuantityPending },
    { 'Parameter': 'Total Taxable Value (INR)', 'Value': summary.totalTaxableValue },
    { 'Parameter': 'Invalid GSTINs Flagged', 'Value': summary.invalidGstinCount },
    { 'Parameter': 'Mismatches Detected', 'Value': summary.mismatchCount },
    { 'Parameter': 'Export Compliance Status', 'Value': summary.canExport ? 'CLEARED FOR GST PORTAL' : 'BLOCKED - CORRECTION REQUIRED' },
    { 'Parameter': 'Export Timestamp', 'Value': new Date().toISOString() }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Reconciliation Summary');

  XLSX.writeFile(workbook, `GST_ITC04_${summary.principalGstin}_${summary.quarter}_${summary.financialYear.replace('/', '-')}.xlsx`);
}
