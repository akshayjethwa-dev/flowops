// src/services/ewayBillService.ts

import QRCode from 'qrcode';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Dispatch, Customer, UserRole } from '../types';
import { 
  EWayBillData, 
  EWayBillPartBHistory, 
  EWayBillExtensionHistory, 
  EWayBillStatus, 
  EwbVehicleType, 
  EwbTransportMode,
  EWayBillValidationResult,
  EWayBillConfig
} from '../types/ewayBill';
import { logActivityEvent } from '../utils/activityLogger';

export const DEFAULT_EWAY_BILL_CONFIG: EWayBillConfig = {
  thresholdValue: 50000, // ₹50,000 threshold per GST rules
  autoNotifyExpiryHours: 4, // Notify within 4 hours of expiry
  simulateDistanceMismatch: false
};

export class EWayBillService {
  /**
   * Normalizes and validates Indian RTO Vehicle Number
   * Acceptable formats: MH12AB1234, GJ-06-ZZ-4012, DL 01 A 1234
   */
  static normalizeVehicleNumber(vehicleNo: string | undefined | null): string {
    if (!vehicleNo) return '';
    return vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  }

  /**
   * Validates vehicle registration number format (EC 2)
   * Format: State Code (2 letters) + District Code (1-2 digits) + Series (0-3 letters) + 4 digits
   */
  static isValidVehicleFormat(vehicleNo: string | undefined | null): boolean {
    const clean = this.normalizeVehicleNumber(vehicleNo);
    if (!clean) return false;
    // Standard Indian Vehicle Pattern: e.g., MH12AB1234, DL1C1234, GJ06ZZ4012
    const vehicleRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    return vehicleRegex.test(clean);
  }

  /**
   * Validates Transporter ID (GSTIN or 15-char Transporter ID) (EC 3)
   */
  static isValidTransporterId(transporterId: string | undefined | null): boolean {
    if (!transporterId) return false;
    const clean = transporterId.trim().toUpperCase();
    return clean.length >= 5; // e.g., GSTIN (15 chars) or TRANS ID
  }

  /**
   * Computes statutory validity for e-Way Bill based on distance:
   * Regular cargo: 1 day (24h) per 200 km (or part thereof, min 1 day)
   * Over-dimensional cargo: 1 day (24h) per 20 km (or part thereof)
   */
  static calculateValidity(
    distanceKm: number, 
    vehicleType: EwbVehicleType = 'regular', 
    startDate: Date = new Date()
  ): { validUntil: string; totalDays: number } {
    const kmPerDay = vehicleType === 'over_dimensional' ? 20 : 200;
    const safeDistance = Math.max(1, distanceKm);
    const totalDays = Math.ceil(safeDistance / kmPerDay);
    
    const expiry = new Date(startDate.getTime());
    // Validity ends at 11:59:59 PM of the computed day per GST rules
    expiry.setDate(expiry.getDate() + totalDays);
    expiry.setHours(23, 59, 59, 999);

    return {
      validUntil: expiry.toISOString(),
      totalDays
    };
  }

  /**
   * Pre-flight Validation for e-Way Bill generation (EC 1, EC 2, EC 3)
   */
  static validateEWayBillEligibility(
    dispatch: Dispatch,
    options?: {
      thresholdValue?: number;
      distanceKm?: number;
      vehicleNumber?: string;
      transporterId?: string;
    }
  ): EWayBillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const threshold = options?.thresholdValue ?? DEFAULT_EWAY_BILL_CONFIG.thresholdValue;

    // Calculate total dispatch value
    const items = dispatch.items || [];
    const totalCargoValue = items.reduce((sum, it) => {
      const lineTotal = it.total || (it.quantity * it.unitPrice * (1 + (it.gstPercent || 18) / 100));
      return sum + lineTotal;
    }, 0);

    // 1. Threshold Check (EC 1)
    const thresholdExceeded = totalCargoValue >= threshold;
    if (!thresholdExceeded) {
      errors.push(`e-Way Bill not required below ₹${threshold.toLocaleString('en-IN')}.`);
    }

    // 2. Transporter ID Check (EC 3)
    const transporterId = options?.transporterId || dispatch.carrierGstin || (dispatch as any).transporterId || '';
    const transporterIdValid = this.isValidTransporterId(transporterId);
    if (!transporterIdValid) {
      errors.push('Transporter ID is required. Update the dispatch.');
    }

    // 3. Vehicle Number Format Check (EC 2)
    const rawVehicle = options?.vehicleNumber || dispatch.vehicleNumber || '';
    const normalizedVehicleNumber = this.normalizeVehicleNumber(rawVehicle);
    const vehicleFormatValid = this.isValidVehicleFormat(rawVehicle);
    if (!vehicleFormatValid) {
      errors.push('Vehicle number must be in format MH12AB1234.');
    }

    // 4. Distance in KM Check
    const distanceKm = options?.distanceKm ?? (dispatch as any).distanceKm ?? (dispatch as any).ewbDistanceKm ?? 0;
    const distanceValid = distanceKm > 0;
    if (!distanceValid) {
      errors.push('Valid transit distance (in KM) is required.');
    }

    // 5. Linked e-Invoice IRN or manual Invoice/consignment document number
    const hasIrn = Boolean(dispatch.irn || dispatch.eInvoice?.irn);
    const hasInvoiceNumber = Boolean(dispatch.invoiceNumber || dispatch.dispatchNumber);
    const irnOrInvoicePresent = hasIrn || hasInvoiceNumber;
    if (!irnOrInvoicePresent) {
      errors.push('A valid Tax Invoice or Delivery Challan number is required.');
    }

    const isValid = thresholdExceeded && transporterIdValid && vehicleFormatValid && distanceValid && irnOrInvoicePresent;

    return {
      isValid,
      errors,
      warnings,
      checks: {
        thresholdExceeded,
        vehicleFormatValid,
        transporterIdValid,
        distanceValid,
        irnOrInvoicePresent
      },
      dispatchValue: totalCargoValue,
      threshold,
      normalizedVehicleNumber
    };
  }

  /**
   * Generates a statutory 12-digit e-Way Bill Number e.g. "2410 8829 4102"
   */
  static generateMockEwbNumber(): string {
    const statePrefix = '24'; // Gujarat / MH GST prefix
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    return `${statePrefix}${randomDigits}`;
  }

  /**
   * Generates a high-resolution QR Code data URL containing statutory e-Way Bill payload
   */
  static async generateQrCode(payloadText: string): Promise<string> {
    try {
      return await QRCode.toDataURL(payloadText, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 250,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    } catch (e) {
      console.warn('Failed to generate EWB QR Code', e);
      return '';
    }
  }

  /**
   * Main Action: Generates e-Way Bill for Dispatch Record
   */
  static async generateEWayBillForDispatch(
    tenantId: string,
    dispatch: Dispatch,
    params: {
      transporterId: string;
      transporterName: string;
      vehicleNumber: string;
      vehicleType: EwbVehicleType;
      transportMode: EwbTransportMode;
      distanceKm: number;
      fromPincode?: string;
      toPincode?: string;
      simulateDistanceMismatch?: boolean;
    },
    actor?: { userId?: string; name?: string; role?: string }
  ): Promise<EWayBillData> {
    // EC 6: Distance Mismatch Simulation check
    if (params.simulateDistanceMismatch) {
      await new Promise(r => setTimeout(r, 600));
      throw new Error('Distance validation failed. Correct the distance and retry.');
    }

    // Pre-flight validation
    const validation = this.validateEWayBillEligibility(dispatch, {
      transporterId: params.transporterId,
      vehicleNumber: params.vehicleNumber,
      distanceKm: params.distanceKm
    });

    if (!validation.isValid) {
      throw new Error(validation.errors[0] || 'e-Way Bill validation failed.');
    }

    const normalizedVehicle = this.normalizeVehicleNumber(params.vehicleNumber);
    const { validUntil } = this.calculateValidity(params.distanceKm, params.vehicleType);
    const ewayBillNumber = this.generateMockEwbNumber();
    const generatedAt = new Date().toISOString();

    // Financial aggregation
    const items = dispatch.items || [];
    const taxableAmount = items.reduce((s, it) => s + (it.unitPrice * it.quantity), 0);
    const totalTax = items.reduce((s, it) => s + ((it.unitPrice * it.quantity) * ((it.gstPercent || 18) / 100)), 0);
    const cgstAmount = Math.round(totalTax / 2);
    const sgstAmount = Math.round(totalTax / 2);
    const totalInvoiceValue = taxableAmount + totalTax;

    const qrPayload = `EWB:${ewayBillNumber}|DOC:${dispatch.invoiceNumber}|VEH:${normalizedVehicle}|DIST:${params.distanceKm}|EXP:${validUntil}`;
    const qrCodeDataUrl = await this.generateQrCode(qrPayload);

    const ewayBillData: EWayBillData = {
      ewayBillNumber,
      ewbNumber: ewayBillNumber,
      generatedAt,
      validUntil,
      validUpto: validUntil,
      status: 'active',
      distanceKm: params.distanceKm,
      transporterId: params.transporterId.trim().toUpperCase(),
      transporterName: params.transporterName || dispatch.transporter || 'National Logistics Carrier',
      vehicleNumber: normalizedVehicle,
      vehicleType: params.vehicleType,
      transportMode: params.transportMode,

      fromGstin: (dispatch as any).supplierGstin || '27AABCS1429B1ZB',
      fromTradeName: (dispatch as any).supplierName || 'NexFlow Manufacturing Industries Ltd',
      fromAddress: 'Plot 42, MIDC Industrial Area, Chakan',
      fromPincode: params.fromPincode || '410501',
      fromState: 'Maharashtra',
      fromStateCode: '27',

      toGstin: (dispatch as any).customerGstin || '27AAACG9999A1Z5',
      toTradeName: dispatch.customerName || 'B2B Client Ltd',
      toAddress: (dispatch as any).shippingAddress || dispatch.destination || 'Industrial Estate, Pune',
      toPincode: params.toPincode || '411018',
      toState: 'Maharashtra',
      toStateCode: '27',

      docType: 'INV',
      docNumber: dispatch.invoiceNumber || dispatch.dispatchNumber || `DSP-${dispatch.id}`,
      docDate: dispatch.dispatchDate || new Date().toISOString().substring(0, 10),
      linkedIrn: dispatch.irn || dispatch.eInvoice?.irn,

      mainHsnCode: (items[0] as any)?.hsn || (items[0] as any)?.hsnCode || '8483',
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      totalInvoiceValue,

      partBHistory: [
        {
          vehicleNumber: normalizedVehicle,
          fromPlace: 'Chakan Plant',
          fromState: 'Maharashtra',
          transDocNo: dispatch.lrNumber || dispatch.LRNumber || `LR-${Math.floor(100000 + Math.random() * 900000)}`,
          transDocDate: new Date().toISOString().substring(0, 10),
          reasonCode: '4',
          reasonDescription: 'First Time / Origin Point',
          remarks: 'Initial dispatch loading at factory bay',
          updatedAt: generatedAt,
          updatedBy: actor?.name || 'Dispatch Clerk'
        }
      ],
      extensions: [],
      qrCodeDataUrl,
      barcodeData: ewayBillNumber
    };

    // Update dispatch record
    await this.persistEWayBillToDispatch(tenantId, dispatch.id, ewayBillData);

    logActivityEvent({
      tenantId,
      actionType: 'create',
      entityType: 'order',
      entityId: dispatch.id,
      actor: {
        userId: actor?.userId || 'dispatch_clerk',
        displayName: actor?.name || 'Dispatch Clerk',
        email: ''
      },
      description: `Generated e-Way Bill #${ewayBillNumber} for Dispatch #${dispatch.dispatchNumber || dispatch.invoiceNumber}. Validity until ${new Date(validUntil).toLocaleDateString()}.`,
      metadata: { ewayBillNumber, validUntil, vehicleNumber: normalizedVehicle },
      isSandboxMode: localStorage.getItem('isSandboxMode') === 'true'
    });

    return ewayBillData;
  }

  /**
   * Part B Update (Vehicle change mid-transit) (EC 5)
   */
  static async updatePartBVehicle(
    tenantId: string,
    dispatchId: string,
    params: {
      newVehicleNumber: string;
      fromPlace: string;
      fromState: string;
      reasonCode: '1' | '2' | '3' | '4';
      remarks: string;
      transDocNo?: string;
    },
    actor?: { userId?: string; name?: string; role?: string }
  ): Promise<EWayBillData> {
    const normalizedVehicle = this.normalizeVehicleNumber(params.newVehicleNumber);
    if (!this.isValidVehicleFormat(normalizedVehicle)) {
      throw new Error('Vehicle number must be in format MH12AB1234.');
    }

    const currentEwb = await this.getEWayBillForDispatch(tenantId, dispatchId);
    if (!currentEwb) {
      throw new Error('No active e-Way Bill found on dispatch.');
    }

    if (currentEwb.status === 'cancelled') {
      throw new Error('Cannot update Part B on a cancelled e-Way Bill.');
    }

    const reasonMap: Record<string, string> = {
      '1': 'Due to Breakdown of previous vehicle',
      '2': 'Due to Transshipment between hubs',
      '3': 'Others (Operational route adjustment)',
      '4': 'First Time'
    };

    const historyEntry: EWayBillPartBHistory = {
      id: `pb_${Date.now()}`,
      vehicleNumber: normalizedVehicle,
      fromPlace: params.fromPlace.trim() || 'Transit Hub',
      fromState: params.fromState.trim() || 'Maharashtra',
      transDocNo: params.transDocNo || currentEwb.partBHistory[0]?.transDocNo || 'LR-TRANSFER',
      transDocDate: new Date().toISOString().substring(0, 10),
      reasonCode: params.reasonCode,
      reasonDescription: reasonMap[params.reasonCode] || 'Transit update',
      remarks: params.remarks.trim() || 'Vehicle changed mid-transit',
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.name || 'Dispatch Clerk'
    };

    const updatedEwb: EWayBillData = {
      ...currentEwb,
      vehicleNumber: normalizedVehicle,
      partBHistory: [historyEntry, ...(currentEwb.partBHistory || [])]
    };

    await this.persistEWayBillToDispatch(tenantId, dispatchId, updatedEwb, normalizedVehicle);

    logActivityEvent({
      tenantId,
      actionType: 'update',
      entityType: 'order',
      entityId: dispatchId,
      actor: {
        userId: actor?.userId || 'dispatch_clerk',
        displayName: actor?.name || 'Dispatch Clerk',
        email: ''
      },
      description: `Updated Part B (Vehicle Change) on e-Way Bill #${currentEwb.ewayBillNumber} to ${normalizedVehicle}. Reason: ${historyEntry.reasonDescription}.`,
      metadata: { newVehicleNumber: normalizedVehicle, reasonCode: params.reasonCode },
      isSandboxMode: localStorage.getItem('isSandboxMode') === 'true'
    });

    return updatedEwb;
  }

  /**
   * Validity Extension (EC 4: when expired or expiring mid-transit)
   */
  static async extendEWayBillValidity(
    tenantId: string,
    dispatchId: string,
    params: {
      remainingDistanceKm: number;
      currentLocation: string;
      reason: string;
      consignmentStatus: 'in_transit' | 'in_movement';
    },
    actor?: { userId?: string; name?: string; role?: string }
  ): Promise<EWayBillData> {
    if (params.remainingDistanceKm <= 0) {
      throw new Error('Remaining distance must be greater than 0 KM for validity extension.');
    }

    const currentEwb = await this.getEWayBillForDispatch(tenantId, dispatchId);
    if (!currentEwb) {
      throw new Error('No e-Way Bill found to extend.');
    }

    if (currentEwb.status === 'cancelled') {
      throw new Error('Cancelled e-Way Bills cannot be extended.');
    }

    // Extension formula: 1 day per 200 km remaining (or 20 km for ODC)
    const kmPerDay = currentEwb.vehicleType === 'over_dimensional' ? 20 : 200;
    const additionalDays = Math.ceil(params.remainingDistanceKm / kmPerDay);

    const prevValidDate = new Date(currentEwb.validUntil);
    const baseDate = new Date() > prevValidDate ? new Date() : prevValidDate;
    
    const newValidDate = new Date(baseDate.getTime());
    newValidDate.setDate(newValidDate.getDate() + additionalDays);
    newValidDate.setHours(23, 59, 59, 999);
    const newValidUntil = newValidDate.toISOString();

    const extensionEntry: EWayBillExtensionHistory = {
      id: `ext_${Date.now()}`,
      extendedAt: new Date().toISOString(),
      extendedBy: actor?.name || 'Dispatch Clerk',
      previousValidUntil: currentEwb.validUntil,
      newValidUntil,
      remainingDistanceKm: params.remainingDistanceKm,
      currentLocation: params.currentLocation.trim() || 'Highway Checkpost',
      reason: params.reason.trim() || 'Transit delay due to traffic / breakdown',
      consignmentStatus: params.consignmentStatus
    };

    const updatedEwb: EWayBillData = {
      ...currentEwb,
      validUntil: newValidUntil,
      status: 'active', // Restores from expired or expiring_soon back to active
      extensions: [extensionEntry, ...(currentEwb.extensions || [])]
    };

    await this.persistEWayBillToDispatch(tenantId, dispatchId, updatedEwb);

    logActivityEvent({
      tenantId,
      actionType: 'update',
      entityType: 'order',
      entityId: dispatchId,
      actor: {
        userId: actor?.userId || 'dispatch_clerk',
        displayName: actor?.name || 'Dispatch Clerk',
        email: ''
      },
      description: `Extended validity of e-Way Bill #${currentEwb.ewayBillNumber} until ${new Date(newValidUntil).toLocaleDateString()} for ${params.remainingDistanceKm} km remaining.`,
      metadata: { previousValidUntil: currentEwb.validUntil, newValidUntil },
      isSandboxMode: localStorage.getItem('isSandboxMode') === 'true'
    });

    return updatedEwb;
  }

  /**
   * Cancel e-Way Bill (within 24 hours of generation)
   */
  static async cancelEWayBill(
    tenantId: string,
    dispatchId: string,
    reason: string,
    remarks: string,
    actor?: { userId?: string; name?: string; role?: string }
  ): Promise<EWayBillData> {
    const currentEwb = await this.getEWayBillForDispatch(tenantId, dispatchId);
    if (!currentEwb) {
      throw new Error('No e-Way Bill found to cancel.');
    }

    // Check 24-hour GST cancellation window
    const genTime = new Date(currentEwb.generatedAt).getTime();
    const now = Date.now();
    const hoursSinceGen = (now - genTime) / (1000 * 3600);
    if (hoursSinceGen > 24) {
      throw new Error('Statutory limit exceeded: e-Way Bills cannot be cancelled on the portal after 24 hours of generation.');
    }

    const updatedEwb: EWayBillData = {
      ...currentEwb,
      status: 'cancelled',
      cancelReason: `${reason} - ${remarks}`.trim(),
      cancelledAt: new Date().toISOString(),
      cancelledBy: actor?.name || 'Dispatch Clerk'
    };

    await this.persistEWayBillToDispatch(tenantId, dispatchId, updatedEwb);

    logActivityEvent({
      tenantId,
      actionType: 'update',
      entityType: 'order',
      entityId: dispatchId,
      actor: {
        userId: actor?.userId || 'dispatch_clerk',
        displayName: actor?.name || 'Dispatch Clerk',
        email: ''
      },
      description: `Cancelled e-Way Bill #${currentEwb.ewayBillNumber}. Reason: ${reason} (${remarks}).`,
      metadata: { ewayBillNumber: currentEwb.ewayBillNumber, reason },
      isSandboxMode: localStorage.getItem('isSandboxMode') === 'true'
    });

    return updatedEwb;
  }

  /**
   * Background Checker: checks for expiring e-Way Bills (within 4 hours of expiry)
   * Updates status to 'expiring_soon' or 'expired' (EC 4)
   */
  static checkExpiringEWayBills(tenantId: string): {
    expiringSoonCount: number;
    expiredCount: number;
    alerts: Array<{ dispatchId: string; ewbNumber: string; hoursLeft: number; status: EWayBillStatus }>;
  } {
    const alerts: Array<{ dispatchId: string; ewbNumber: string; hoursLeft: number; status: EWayBillStatus }> = [];
    let expiringSoonCount = 0;
    let expiredCount = 0;

    if (typeof window === 'undefined') return { expiringSoonCount, expiredCount, alerts };

    try {
      const cached = localStorage.getItem(`dispatches_${tenantId}`);
      if (!cached) return { expiringSoonCount, expiredCount, alerts };

      const dispatches: Dispatch[] = JSON.parse(cached);
      let hasChanges = false;

      const updatedDispatches = dispatches.map(disp => {
        const ewb: EWayBillData | undefined = disp.ewayBill;
        if (!ewb || ewb.status === 'cancelled') return disp;

        const validUntil = new Date(ewb.validUntil).getTime();
        const now = Date.now();
        const msLeft = validUntil - now;
        const hoursLeft = msLeft / (1000 * 3600);

        let newStatus: EWayBillStatus = ewb.status;

        if (msLeft <= 0) {
          // Expired (EC 4)
          newStatus = 'expired';
          expiredCount++;
          alerts.push({ dispatchId: disp.id, ewbNumber: ewb.ewayBillNumber, hoursLeft: 0, status: 'expired' });
        } else if (hoursLeft <= DEFAULT_EWAY_BILL_CONFIG.autoNotifyExpiryHours) {
          // Expiring within 4 hours
          newStatus = 'expiring_soon';
          expiringSoonCount++;
          alerts.push({ dispatchId: disp.id, ewbNumber: ewb.ewayBillNumber, hoursLeft: parseFloat(hoursLeft.toFixed(1)), status: 'expiring_soon' });
        } else {
          newStatus = 'active';
        }

        if (newStatus !== ewb.status) {
          hasChanges = true;
          return {
            ...disp,
            ewbStatus: newStatus,
            ewayBill: { ...ewb, status: newStatus }
          };
        }

        return disp;
      });

      if (hasChanges) {
        localStorage.setItem(`dispatches_${tenantId}`, JSON.stringify(updatedDispatches));
        window.dispatchEvent(new CustomEvent('ewaybill.expiring.alert', { detail: { alerts } }));
      }
    } catch (e) {
      console.warn('Error checking expiring e-Way Bills', e);
    }

    return { expiringSoonCount, expiredCount, alerts };
  }

  /**
   * Helper: fetches e-Way bill data from dispatch record
   */
  private static async getEWayBillForDispatch(tenantId: string, dispatchId: string): Promise<EWayBillData | null> {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`dispatches_${tenantId}`);
        if (cached) {
          const list: Dispatch[] = JSON.parse(cached);
          const found = list.find(d => d.id === dispatchId);
          if (found?.ewayBill) return found.ewayBill as EWayBillData;
        }
      } catch (e) {
        console.warn('Error reading dispatch cache for EWB', e);
      }
    }
    return null;
  }

  /**
   * Helper: persists e-Way Bill data to Firestore and LocalStorage
   */
  private static async persistEWayBillToDispatch(
    tenantId: string,
    dispatchId: string,
    ewbData: EWayBillData,
    updatedVehicle?: string
  ): Promise<void> {
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`dispatches_${tenantId}`);
        if (cached) {
          const list: Dispatch[] = JSON.parse(cached);
          const updated = list.map(d => {
            if (d.id === dispatchId) {
              return {
                ...d,
                ewayBill: ewbData,
                ewbNumber: ewbData.ewayBillNumber,
                ewbValidUntil: ewbData.validUntil,
                ewbStatus: ewbData.status,
                ewbDistanceKm: ewbData.distanceKm,
                vehicleNumber: updatedVehicle || ewbData.vehicleNumber || d.vehicleNumber,
                transporter: ewbData.transporterName || d.transporter,
                carrierGstin: ewbData.transporterId || d.carrierGstin
              };
            }
            return d;
          });
          localStorage.setItem(`dispatches_${tenantId}`, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn('Error updating local dispatch with EWB', e);
      }
    }

    if (!isSandbox && db) {
      try {
        const ref = doc(db, 'tenants', tenantId, 'dispatches', dispatchId);
        await updateDoc(ref, {
          ewayBill: ewbData,
          ewbNumber: ewbData.ewayBillNumber,
          ewbValidUntil: ewbData.validUntil,
          ewbStatus: ewbData.status,
          ewbDistanceKm: ewbData.distanceKm,
          vehicleNumber: updatedVehicle || ewbData.vehicleNumber,
          transporter: ewbData.transporterName,
          carrierGstin: ewbData.transporterId
        });
      } catch (e) {
        console.warn('Firestore update for EWB failed, falling back to local state', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ewaybill.updated', { detail: { dispatchId, ewbData } }));
    }
  }
}

export const ewayBillService = EWayBillService;
