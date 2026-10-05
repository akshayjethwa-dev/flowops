// src/utils/quotationUtils.ts

import { QuoteItem, QuotationTotals } from '../types';

/**
 * Calculates the line total after applying discount and GST.
 * Formulas:
 * taxableAmount = (quantity * unitPrice) - discount
 * tax = taxableAmount * (gstPercent / 100)
 * total = taxableAmount + tax
 */
export function calculateLineItemAmount(item: {
  quantity: number;
  unitPrice: number;
  discount?: number;
  gstPercent: number;
}): number {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  const gst = Number(item.gstPercent) || 0;
  
  const taxable = (qty * price) - discount;
  const tax = taxable * (gst / 100);
  return Math.round((taxable + tax) * 100) / 100;
}

/**
 * Calculates the full breakdown of subtotal, discount, tax, and grand total.
 */
export function calculateQuotationTotals(lineItems: QuoteItem[]): QuotationTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  lineItems.forEach(item => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    const gst = Number(item.gstPercent) || 0;

    const baseVal = qty * price;
    const taxable = baseVal - disc;
    const taxVal = taxable * (gst / 100);
    const rowTotal = taxable + taxVal;

    subtotal += baseVal;
    discountTotal += disc;
    taxTotal += taxVal;
    grandTotal += rowTotal;
  });

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

/**
 * Generates an elegant and traceable quotation number prefix.
 */
export function generateQuotationNumber(tenantId: string): string {
  const prefix = tenantId ? tenantId.substring(0, 3).toUpperCase() : 'AQ';
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const now = new Date();
  const yearMonth = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  return `${prefix}/${yearMonth}-${randomSuffix}`;
}
