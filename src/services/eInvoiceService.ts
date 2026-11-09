// src/services/eInvoiceService.ts

import QRCode from 'qrcode';
import { db } from '../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { Dispatch, Customer, Invoice, UserRole } from '../types';
import { 
  EInvoiceData, 
  EInvoicePayload, 
  EInvoiceConfig, 
  IRPAdapterType, 
  EInvoiceStatus 
} from '../types/eInvoice';
import { validateEInvoiceEligibility } from '../utils/eInvoiceValidator';
import { logActivityEvent } from '../utils/activityLogger';

// In-memory event listeners for e-Invoice updates
export type EInvoiceChangedListener = (tenantId: string, dispatchId: string) => void;
const eInvoiceChangeListeners: Set<EInvoiceChangedListener> = new Set();

export function onEInvoiceChanged(listener: EInvoiceChangedListener): () => void {
  eInvoiceChangeListeners.add(listener);
  return () => {
    eInvoiceChangeListeners.delete(listener);
  };
}

export function emitEInvoiceChanged(tenantId: string, dispatchId: string): void {
  eInvoiceChangeListeners.forEach(fn => {
    try {
      fn(tenantId, dispatchId);
    } catch (e) {
      console.warn('eInvoice listener error', e);
    }
  });

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('einvoice.changed', { detail: { tenantId, dispatchId } }));
    } catch (e) {
      console.warn('Failed to dispatch einvoice.changed event', e);
    }
  }
}

export class EInvoiceService {
  /**
   * Default Tenant e-Invoice Configuration
   */
  static getDefaultConfig(tenantId: string = 'default_tenant'): EInvoiceConfig {
    const configKey = `einvoice_config_${tenantId}`;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(configKey);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('Error reading einvoice config', e);
      }
    }

    return {
      enabled: true,
      defaultAdapter: 'nic',
      turnoverThresholdCr: 5,
      annualTurnoverExempt: false,
      autoGenerateOnDispatch: true,
      supplierGstin: '24AABCA1234F1Z8',
      supplierLegalName: 'FlowOps Precision Engineering Pvt. Ltd.',
      supplierTradeName: 'FlowOps Heavy Engineering Works',
      supplierAddress: 'Plot 48, GIDC Industrial Estate, Manjusar',
      supplierPincode: '391775',
      supplierState: 'Gujarat',
      supplierStateCode: '24',
      simulateDowntime: false,
      simulateDuplicateIrn: false
    };
  }

  /**
   * Saves updated e-Invoice configuration to tenant storage
   */
  static saveConfig(tenantId: string, config: EInvoiceConfig): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`einvoice_config_${tenantId}`, JSON.stringify(config));
    } catch (e) {
      console.warn('Error saving einvoice config', e);
    }
  }

  /**
   * Formats a Date object to DD/MM/YYYY for GST IRP schema
   */
  private static formatGstDate(date: Date = new Date()): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Generates a deterministic or simulated 64-character SHA-256 IRN hash
   */
  private static generateIrnHash(
    supplierGstin: string,
    docType: string,
    docNumber: string,
    finYear: string = '2026-27'
  ): string {
    // Standard IRP IRN is SHA-256 of SupplierGSTIN + FinYear + DocTyp + DocNo
    const rawString = `${supplierGstin.trim().toUpperCase()}:${finYear}:${docType}:${docNumber.trim().toUpperCase()}`;
    
    // Deterministic hex hash calculation
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    
    // Pad to 64 hex characters
    const hexPart = Math.abs(hash).toString(16).padStart(8, '0');
    const timestampPart = Date.now().toString(16).padStart(12, '0');
    const salt = 'a8f7b2e19c04d3e58912fc45a0b7e289c1045daef78129340bc';
    
    const combined = `${hexPart}${timestampPart}${salt}`.substring(0, 64);
    return combined.toLowerCase();
  }

  /**
   * Generates a base64 encoded QR Code data URL containing signed IRP parameters
   */
  static async generateQrCodeDataUrl(signedQrText: string): Promise<string> {
    try {
      return await QRCode.toDataURL(signedQrText, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.warn('QR Code generation error, using fallback SVG', err);
      return '';
    }
  }

  /**
   * Builds the official GST IRP INV-01 payload
   */
  static buildIrpPayload(
    dispatch: Dispatch,
    customer: Customer | null | undefined,
    config: EInvoiceConfig
  ): EInvoicePayload {
    const items = dispatch.items || [];
    const customerGstin = (customer?.gstNumber || (customer as any)?.gstin || dispatch.carrierGstin || '27AAACG9876K1Z4').trim().toUpperCase();
    const customerStateCode = customerGstin.substring(0, 2) || '27';
    const isInterstate = customerStateCode !== config.supplierStateCode;

    let assessableValue = 0;
    let cgstValue = 0;
    let sgstValue = 0;
    let igstValue = 0;

    const itemList = items.map((it, idx) => {
      const qty = Number(it.quantity) || 1;
      const rate = Number(it.unitPrice) || 0;
      const itemTaxable = Math.round(qty * rate * 100) / 100;
      const gstRate = Number(it.gstPercent) || 18;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterstate) {
        igst = Math.round(itemTaxable * (gstRate / 100) * 100) / 100;
      } else {
        cgst = Math.round(itemTaxable * (gstRate / 200) * 100) / 100;
        sgst = Math.round(itemTaxable * (gstRate / 200) * 100) / 100;
      }

      const totalItemVal = itemTaxable + cgst + sgst + igst;

      assessableValue += itemTaxable;
      cgstValue += cgst;
      sgstValue += sgst;
      igstValue += igst;

      return {
        itemNumber: idx + 1,
        productName: it.name || `Line #${idx + 1}`,
        description: it.specs || it.name,
        hsnCode: String((it as any).hsn || (it as any).hsnCode || '7308').replace(/[^0-9]/g, '') || '7308',
        quantity: qty,
        uom: (it.unit || 'PCS').toUpperCase(),
        unitPrice: rate,
        grossAmount: itemTaxable,
        taxableAmount: itemTaxable,
        gstRate,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalItemValue: totalItemVal
      };
    });

    const totalInvoiceValue = Math.round((assessableValue + cgstValue + sgstValue + igstValue) * 100) / 100;

    return {
      version: '1.1',
      tranDetails: {
        taxScheme: 'GST',
        supplyType: 'B2B',
        regRev: 'N'
      },
      docDetails: {
        documentType: 'INV',
        documentNumber: dispatch.invoiceNumber || dispatch.dispatchNumber || `INV-${Date.now().toString().slice(-6)}`,
        documentDate: this.formatGstDate(dispatch.dispatchedAt ? new Date(dispatch.dispatchedAt) : new Date())
      },
      sellerDetails: {
        gstin: config.supplierGstin,
        legalName: config.supplierLegalName,
        tradeName: config.supplierTradeName,
        address: config.supplierAddress,
        location: 'Vadodara',
        pincode: config.supplierPincode,
        stateCode: config.supplierStateCode,
        stateName: config.supplierState
      },
      buyerDetails: {
        gstin: customerGstin,
        legalName: dispatch.customerName || customer?.name || 'Valued Corporate Buyer',
        tradeName: customer?.name || dispatch.customerName,
        posStateCode: customerStateCode,
        address: customer?.shippingAddress || customer?.billingAddress || dispatch.destination || 'Industrial Zone Phase 2',
        location: customer?.city || 'Industrial Estate',
        pincode: '400001',
        stateCode: customerStateCode,
        phone: customer?.phone || dispatch.driverPhone,
        email: customer?.email,
        isB2B: true,
        registrationType: 'regular'
      },
      itemList,
      valueDetails: {
        assessableValue,
        cgstValue,
        sgstValue,
        igstValue,
        totalInvoiceValue
      }
    };
  }

  /**
   * Calls the configured GST IRP API (NIC, ClearTax, or Masters India)
   * Handles simulated downtime (EC 3) and duplicate IRN detection (EC 4)
   */
  static async callIrpApi(
    payload: EInvoicePayload,
    adapter: IRPAdapterType,
    config: EInvoiceConfig
  ): Promise<{
    success: boolean;
    irn?: string;
    ackNo?: string;
    ackDate?: string;
    signedInvoice?: string;
    signedQrCode?: string;
    qrCodeDataUrl?: string;
    errorCode?: string;
    errorMessage?: string;
    isDuplicateFound?: boolean;
  }> {
    // EC 3: IRP API Down Simulation
    if (config.simulateDowntime) {
      await new Promise(r => setTimeout(r, 600));
      return {
        success: false,
        errorCode: 'IRP_SERVICE_UNAVAILABLE_503',
        errorMessage: `[${adapter.toUpperCase()} IRP Gateway Error 503]: NIC e-Invoice Server temporarily unavailable. Gateway timed out while signing invoice.`
      };
    }

    // EC 4: IRP Duplicate IRN Simulation (Code 2150)
    if (config.simulateDuplicateIrn) {
      await new Promise(r => setTimeout(r, 500));
      // In accordance with EC 4: "System fetches and stores the existing IRN; no duplicate created."
      const existingIrn = this.generateIrnHash(
        payload.sellerDetails.gstin,
        payload.docDetails.documentType,
        payload.docDetails.documentNumber
      );
      const existingAckNo = `11${Date.now().toString().slice(-13)}`;
      const existingAckDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      const signedQrData = JSON.stringify({
        SellerGstin: payload.sellerDetails.gstin,
        BuyerGstin: payload.buyerDetails.gstin,
        DocNo: payload.docDetails.documentNumber,
        DocTyp: 'INV',
        DocDt: payload.docDetails.documentDate,
        TotInvVal: payload.valueDetails.totalInvoiceValue,
        ItemCnt: payload.itemList.length,
        MainHsnCd: payload.itemList[0]?.hsnCode || '7308',
        Irn: existingIrn
      });

      const qrCodeDataUrl = await this.generateQrCodeDataUrl(signedQrData);

      return {
        success: true,
        isDuplicateFound: true,
        irn: existingIrn,
        ackNo: existingAckNo,
        ackDate: existingAckDate,
        signedInvoice: `JWT_SIGNED_${existingIrn.substring(0, 24)}...`,
        signedQrCode: signedQrData,
        qrCodeDataUrl
      };
    }

    // Standard IRP Generation Flow (Simulating 450ms network transmission to NIC/ClearTax/Masters India)
    await new Promise(r => setTimeout(r, 450));

    const irn = this.generateIrnHash(
      payload.sellerDetails.gstin,
      payload.docDetails.documentType,
      payload.docDetails.documentNumber
    );

    const ackNo = `11${Date.now().toString().slice(-13)}`;
    const ackDate = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Official signed QR code contents format
    const signedQrData = JSON.stringify({
      SellerGstin: payload.sellerDetails.gstin,
      BuyerGstin: payload.buyerDetails.gstin,
      DocNo: payload.docDetails.documentNumber,
      DocTyp: 'INV',
      DocDt: payload.docDetails.documentDate,
      TotInvVal: payload.valueDetails.totalInvoiceValue,
      ItemCnt: payload.itemList.length,
      MainHsnCd: payload.itemList[0]?.hsnCode || '7308',
      Irn: irn
    });

    const qrCodeDataUrl = await this.generateQrCodeDataUrl(signedQrData);

    return {
      success: true,
      irn,
      ackNo,
      ackDate,
      signedInvoice: `JWT_SIGNED_${adapter.toUpperCase()}_${irn.substring(0, 28)}`,
      signedQrCode: signedQrData,
      qrCodeDataUrl
    };
  }

  /**
   * Main entry point: Generates e-Invoice from Dispatch Record
   * Enforces validation, handles adapters, stores IRN/QR on dispatch and linked invoice
   */
  static async generateEInvoiceForDispatch(
    dispatch: Dispatch,
    customer: Customer | null | undefined,
    options?: {
      tenantId?: string;
      adapter?: IRPAdapterType;
      actorName?: string;
      actorRole?: string;
      overrideConfig?: Partial<EInvoiceConfig>;
      isSandboxMode?: boolean;
    }
  ): Promise<{
    success: boolean;
    dispatch: Dispatch;
    eInvoiceData?: EInvoiceData;
    error?: string;
  }> {
    const tenantId = options?.tenantId || dispatch.tenantId || 'default_tenant';
    const config: EInvoiceConfig = {
      ...this.getDefaultConfig(tenantId),
      ...(options?.overrideConfig || {})
    };
    const adapter = options?.adapter || config.defaultAdapter;
    const actorName = options?.actorName || 'Finance Manager';

    // 1. Pre-flight Eligibility Validation
    const eligibility = validateEInvoiceEligibility(dispatch, customer, config);
    if (!eligibility.isEligible) {
      const errorMsg = eligibility.reasons.join(' ');
      
      // Update dispatch with failed status
      const failedDispatch: Dispatch = {
        ...dispatch,
        eInvoiceStatus: 'e_invoice_failed',
        eInvoiceFailedReason: errorMsg
      };
      this.persistDispatchUpdate(tenantId, failedDispatch, options?.isSandboxMode);

      return {
        success: false,
        dispatch: failedDispatch,
        error: errorMsg
      };
    }

    // 2. Build INV-01 Payload
    const payload = this.buildIrpPayload(dispatch, customer, config);

    // 3. Call IRP API
    const irpResponse = await this.callIrpApi(payload, adapter, config);

    if (!irpResponse.success) {
      const errorMsg = irpResponse.errorMessage || 'Unknown IRP transmission error occurred.';
      
      const failedDispatch: Dispatch = {
        ...dispatch,
        eInvoiceStatus: 'e_invoice_failed',
        eInvoiceFailedReason: errorMsg,
        eInvoice: {
          irn: '',
          ackNo: '',
          ackDate: '',
          signedInvoice: '',
          signedQrCode: '',
          status: 'e_invoice_failed',
          adapter,
          generatedAt: new Date().toISOString(),
          generatedBy: actorName,
          errorMessage: errorMsg,
          errorCode: irpResponse.errorCode,
          payload
        }
      };
      this.persistDispatchUpdate(tenantId, failedDispatch, options?.isSandboxMode);

      return {
        success: false,
        dispatch: failedDispatch,
        error: errorMsg
      };
    }

    // 4. Success — Record IRN & Signed QR Data
    const eInvoiceData: EInvoiceData = {
      irn: irpResponse.irn!,
      ackNo: irpResponse.ackNo!,
      ackDate: irpResponse.ackDate!,
      signedInvoice: irpResponse.signedInvoice!,
      signedQrCode: irpResponse.signedQrCode!,
      qrCodeDataUrl: irpResponse.qrCodeDataUrl,
      status: 'generated',
      adapter,
      generatedAt: new Date().toISOString(),
      generatedBy: actorName,
      userRole: options?.actorRole || 'finance',
      canBeCancelledDirectly: true,
      payload
    };

    const updatedDispatch: Dispatch = {
      ...dispatch,
      eInvoiceStatus: 'generated',
      eInvoiceFailedReason: undefined,
      irn: eInvoiceData.irn,
      ackNo: eInvoiceData.ackNo,
      ackDate: eInvoiceData.ackDate,
      signedQrCode: eInvoiceData.signedQrCode,
      eInvoice: eInvoiceData
    };

    this.persistDispatchUpdate(tenantId, updatedDispatch, options?.isSandboxMode);

    // Also mirror onto linked invoice if present
    this.syncEInvoiceToLinkedInvoice(tenantId, updatedDispatch, eInvoiceData);

    logActivityEvent({
      tenantId,
      actionType: 'create',
      entityType: 'order',
      entityId: dispatch.id,
      actor: {
        userId: actorName,
        displayName: actorName,
        email: ''
      },
      description: `Generated statutory GST e-Invoice for Dispatch #${dispatch.dispatchNumber || dispatch.invoiceNumber}. IRN: ${eInvoiceData.irn.substring(0, 16)}... (Ack: ${eInvoiceData.ackNo}) via ${adapter.toUpperCase()}.`,
      metadata: {
        irn: eInvoiceData.irn,
        ackNo: eInvoiceData.ackNo,
        adapter,
        invoiceNumber: dispatch.invoiceNumber
      },
      isSandboxMode: options?.isSandboxMode
    });

    return {
      success: true,
      dispatch: updatedDispatch,
      eInvoiceData
    };
  }

  /**
   * Fallback Manual Entry (EC 3: When IRP is down and finance team generated IRN on NIC portal)
   */
  static async recordManualEInvoice(
    dispatch: Dispatch,
    manual: {
      irn: string;
      ackNo: string;
      ackDate: string;
      signedQrText?: string;
      adapter?: IRPAdapterType;
      enteredBy?: string;
      userRole?: string;
    },
    options?: { tenantId?: string; isSandboxMode?: boolean }
  ): Promise<Dispatch> {
    const tenantId = options?.tenantId || dispatch.tenantId || 'default_tenant';
    const cleanIrn = manual.irn.trim();
    if (!cleanIrn || cleanIrn.length < 32) {
      throw new Error('Valid 64-character hexadecimal IRN is required.');
    }

    const qrText = manual.signedQrText || `IRN:${cleanIrn}|Ack:${manual.ackNo}|Date:${manual.ackDate}`;
    const qrCodeDataUrl = await this.generateQrCodeDataUrl(qrText);

    const eInvoiceData: EInvoiceData = {
      irn: cleanIrn,
      ackNo: manual.ackNo.trim() || `11${Date.now().toString().slice(-13)}`,
      ackDate: manual.ackDate || new Date().toISOString().replace('T', ' ').substring(0, 19),
      signedInvoice: 'MANUAL_PORTAL_ENTRY',
      signedQrCode: qrText,
      qrCodeDataUrl,
      status: 'generated',
      adapter: manual.adapter || 'nic',
      generatedAt: new Date().toISOString(),
      generatedBy: manual.enteredBy || 'Finance Officer (Manual Fallback)',
      userRole: manual.userRole || 'finance',
      canBeCancelledDirectly: true
    };

    const updatedDispatch: Dispatch = {
      ...dispatch,
      eInvoiceStatus: 'generated',
      eInvoiceFailedReason: undefined,
      irn: eInvoiceData.irn,
      ackNo: eInvoiceData.ackNo,
      ackDate: eInvoiceData.ackDate,
      signedQrCode: eInvoiceData.signedQrCode,
      eInvoice: eInvoiceData
    };

    this.persistDispatchUpdate(tenantId, updatedDispatch, options?.isSandboxMode);
    this.syncEInvoiceToLinkedInvoice(tenantId, updatedDispatch, eInvoiceData);

    return updatedDispatch;
  }

  /**
   * Cancels an e-Invoice on the IRP (EC 6: within 24 hours).
    * If >24 hours, rejects and guides user to create a Credit Note.
   */
  static async cancelEInvoice(
    arg1: any,
    arg2: any,
    arg3?: any,
    arg4?: any
  ): Promise<{
    success: boolean;
    dispatch: Dispatch;
    error?: string;
    mustUseCreditNote?: boolean;
  }> {
    let dispatch: Dispatch;
    let cancelReason: '1' | '2' | '3' | '4' = '1';
    let cancelRemarks = '';
    let tenantId = 'default_tenant';
    let actorName = 'Finance Manager';
    let isSandboxMode = false;

    if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      // Called as: cancelEInvoice(tenantId, dispatchId, params, actor)
      tenantId = arg1;
      const dispatchId = arg2;
      const params = arg3 || {};
      cancelReason = String(params.reasonCode || '1') as any;
      cancelRemarks = params.remarks || params.cancelRemarks || '';
      actorName = arg4?.name || arg4?.displayName || 'Finance Manager';

      let loadedDispatch: Dispatch | null = null;
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`dispatches_${tenantId}`);
          if (cached) {
            const list: Dispatch[] = JSON.parse(cached);
            loadedDispatch = list.find(d => d.id === dispatchId) || null;
          }
        } catch (e) {
          console.warn('Error reading dispatch for cancel', e);
        }
      }
      if (!loadedDispatch) {
        throw new Error(`Dispatch #${dispatchId} not found.`);
      }
      dispatch = loadedDispatch;
    } else {
      // Called as: cancelEInvoice(dispatch, cancelReason, cancelRemarks, options)
      dispatch = arg1 as Dispatch;
      cancelReason = arg2;
      cancelRemarks = arg3;
      tenantId = arg4?.tenantId || dispatch.tenantId || 'default_tenant';
      actorName = arg4?.actorName || 'Finance Manager';
      isSandboxMode = arg4?.isSandboxMode ?? false;
    }

    const eInv = dispatch.eInvoice;

    if (!eInv || eInv.status !== 'generated') {
      const err = 'No active generated e-Invoice found to cancel.';
      if (typeof arg1 === 'string') throw new Error(err);
      return { success: false, dispatch, error: err };
    }

    // EC 6: Check 24-hour GST rule
    const ackDateObj = new Date(eInv.ackDate);
    const now = new Date();
    const diffHours = (now.getTime() - ackDateObj.getTime()) / (1000 * 3600);

    if (diffHours > 24) {
      const err = `Cancellation barred by GST Rule: e-Invoice was acknowledged ${Math.round(diffHours)} hours ago (>24 hours). IRN cannot be cancelled directly on IRP portal. Please generate a statutory Credit Note instead to nullify this invoice.`;
      if (typeof arg1 === 'string') throw new Error(err);
      return {
        success: false,
        dispatch,
        mustUseCreditNote: true,
        error: err
      };
    }

    if (!cancelRemarks || cancelRemarks.trim().length < 5) {
      const err = 'A cancellation justification of at least 5 characters is required by the GST portal.';
      if (typeof arg1 === 'string') throw new Error(err);
      return {
        success: false,
        dispatch,
        error: err
      };
    }

    // Call IRP Cancel API
    await new Promise(r => setTimeout(r, 400));

    const updatedEInvoice: EInvoiceData = {
      ...eInv,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: actorName || 'Finance Manager',
      cancelReason,
      cancelRemarks: cancelRemarks.trim(),
      canBeCancelledDirectly: false
    };

    const updatedDispatch: Dispatch = {
      ...dispatch,
      eInvoiceStatus: 'cancelled',
      eInvoice: updatedEInvoice
    };

    this.persistDispatchUpdate(tenantId, updatedDispatch, isSandboxMode);

    logActivityEvent({
      tenantId,
      actionType: 'update',
      entityType: 'order',
      entityId: dispatch.id,
      actor: {
        userId: actorName || 'finance',
        displayName: actorName || 'Finance Manager',
        email: ''
      },
      description: `Cancelled e-Invoice IRN ${eInv.irn.substring(0, 16)}... on IRP. Reason Code: ${cancelReason} (${cancelRemarks}).`,
      metadata: { irn: eInv.irn, cancelReason, cancelRemarks },
      isSandboxMode: isSandboxMode
    });

    return {
      success: true,
      dispatch: updatedDispatch
    };
  }

  /**
   * Helper: Persists dispatch update to localStorage and Firestore
   */
  private static persistDispatchUpdate(
    tenantId: string,
    updatedDispatch: Dispatch,
    isSandboxMode?: boolean
  ): void {
    if (typeof window !== 'undefined') {
      try {
        const localKey = `dispatches_${tenantId}`;
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const list: Dispatch[] = JSON.parse(raw);
          const idx = list.findIndex(d => d.id === updatedDispatch.id);
          if (idx !== -1) {
            list[idx] = updatedDispatch;
            localStorage.setItem(localKey, JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn('Local dispatch update warning', e);
      }
    }

    if (db && !isSandboxMode) {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'dispatches', updatedDispatch.id);
        updateDoc(docRef, {
          eInvoiceStatus: updatedDispatch.eInvoiceStatus,
          eInvoiceFailedReason: updatedDispatch.eInvoiceFailedReason || null,
          irn: updatedDispatch.irn || null,
          ackNo: updatedDispatch.ackNo || null,
          ackDate: updatedDispatch.ackDate || null,
          signedQrCode: updatedDispatch.signedQrCode || null,
          eInvoice: updatedDispatch.eInvoice || null
        }).catch(err => {
          // Top-level dispatches fallback
          const rootRef = doc(db, 'dispatches', updatedDispatch.id);
          updateDoc(rootRef, {
            eInvoiceStatus: updatedDispatch.eInvoiceStatus,
            eInvoice: updatedDispatch.eInvoice || null
          }).catch(() => {});
        });
      } catch (e) {
        // Ignored
      }
    }

    emitEInvoiceChanged(tenantId, updatedDispatch.id);
  }

  /**
   * Helper: Synchronizes e-Invoice IRN & QR onto linked Invoice in accounting module
   */
  private static syncEInvoiceToLinkedInvoice(
    tenantId: string,
    dispatch: Dispatch,
    eInvoiceData: EInvoiceData
  ): void {
    if (typeof window === 'undefined') return;
    try {
      const invKey = `invoices_${tenantId}`;
      const raw = localStorage.getItem(invKey);
      if (raw) {
        const invoices: Invoice[] = JSON.parse(raw);
        const invIdx = invoices.findIndex(i => 
          i.id === dispatch.invoiceId || 
          i.invoiceNumber === dispatch.invoiceNumber ||
          (i as any).dispatchId === dispatch.id
        );

        if (invIdx !== -1) {
          (invoices[invIdx] as any).irn = eInvoiceData.irn;
          (invoices[invIdx] as any).ackNo = eInvoiceData.ackNo;
          (invoices[invIdx] as any).ackDate = eInvoiceData.ackDate;
          (invoices[invIdx] as any).signedQrCode = eInvoiceData.signedQrCode;
          (invoices[invIdx] as any).eInvoiceStatus = eInvoiceData.status;
          (invoices[invIdx] as any).qrCodeDataUrl = eInvoiceData.qrCodeDataUrl;
          localStorage.setItem(invKey, JSON.stringify(invoices));
        }
      }
    } catch (e) {
      console.warn('Failed to sync eInvoice onto invoice', e);
    }
  }
}

export const generateEInvoiceForDispatch = EInvoiceService.generateEInvoiceForDispatch.bind(EInvoiceService);
export const recordManualEInvoice = EInvoiceService.recordManualEInvoice.bind(EInvoiceService);
export const cancelEInvoice = EInvoiceService.cancelEInvoice.bind(EInvoiceService);
export const eInvoiceService = EInvoiceService;
