// src/utils/eInvoicePdfGenerator.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dispatch, Customer } from '../types';
import { EInvoiceData, EInvoiceConfig } from '../types/eInvoice';
import { EInvoiceService } from '../services/eInvoiceService';

export async function generateEInvoicePdf(
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let dispatch: Dispatch;
  let customer: any = null;
  let config: any = null;
  let isB2CFallback = false;
  let explicitEInvoice: EInvoiceData | null = null;

  if (arg1 && typeof arg1 === 'object' && ('irn' in arg1 || arg1.status === 'generated' || arg1.ackNo)) {
    // Invocation: (eInvoiceData, dispatch, config, customer)
    explicitEInvoice = arg1 as EInvoiceData;
    dispatch = arg2 as Dispatch;
    config = arg3;
    customer = arg4 || null;
  } else if (arg1 === null && arg2 && 'items' in arg2) {
    // Invocation: (null, dispatch, config, customer)
    isB2CFallback = true;
    dispatch = arg2 as Dispatch;
    config = arg3;
    customer = arg4 || null;
  } else {
    // Invocation: (dispatch, customer, config, isB2CFallback)
    dispatch = arg1 as Dispatch;
    customer = arg2 || null;
    config = arg3;
    isB2CFallback = typeof arg4 === 'boolean' ? arg4 : false;
  }

  const tenantConfig = config || EInvoiceService.getDefaultConfig(dispatch.tenantId);
  const eInv = explicitEInvoice || dispatch.eInvoice;
  const isEInvoiced = !isB2CFallback && eInv && eInv.status === 'generated';

  const customerGstin = (
    customer?.gstin || 
    customer?.gstNumber || 
    dispatch.carrierGstin || 
    (isB2CFallback ? 'URP (Unregistered Consumer)' : '27AAACG9876K1Z4')
  ).toUpperCase();
  const customerStateCode = customerGstin.substring(0, 2) || '27';
  const isInterstate = customerStateCode !== tenantConfig.supplierStateCode;

  // 1. Header & Title
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(
    isEInvoiced ? 'TAX INVOICE (e-INVOICE under CGST Rule 48(4))' : 'TAX INVOICE (B2C SUPPLY)',
    14,
    11
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    isEInvoiced ? 'Generated via GST System IRP Gateway • Digitally Signed' : 'Standard B2C Commercial Invoice • GST Exempted from IRN',
    14,
    17
  );

  let currentY = 30;

  // 2. IRN & Signed QR Code Section (Prominently featured for e-Invoice)
  if (isEInvoiced && eInv) {
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(14, currentY, 182, 36, 2, 2, 'FD');

    // Embed QR Code on the right
    if (eInv.qrCodeDataUrl) {
      try {
        doc.addImage(eInv.qrCodeDataUrl, 'PNG', 158, currentY + 2, 32, 32);
      } catch (err) {
        console.warn('Could not render QR code in PDF', err);
      }
    }

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('INVOICE REFERENCE NUMBER (IRN):', 18, currentY + 7);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    // Split IRN across 1 or 2 lines if needed
    const irnStr = eInv.irn || '';
    doc.text(irnStr.substring(0, 48), 18, currentY + 12);
    if (irnStr.length > 48) {
      doc.text(irnStr.substring(48), 18, currentY + 16);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Ack No: `, 18, currentY + 23);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(eInv.ackNo || 'N/A', 33, currentY + 23);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`Ack Date: `, 85, currentY + 23);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(eInv.ackDate || 'N/A', 102, currentY + 23);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`IRP Adapter: `, 18, currentY + 30);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text((eInv.adapter || 'NIC').toUpperCase() + ' Production Gateway (Signed)', 38, currentY + 30);

    currentY += 42;
  }

  // 3. Supplier & Buyer 2-Column Metadata Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.rect(14, currentY, 90, 44);
  doc.rect(106, currentY, 90, 44);

  // Supplier Details (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DETAILS OF SUPPLIER (CONSIGNOR):', 17, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(tenantConfig.supplierLegalName, 17, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(tenantConfig.supplierAddress, 17, currentY + 15);
  doc.text(`${tenantConfig.supplierState} - ${tenantConfig.supplierPincode} (State Code: ${tenantConfig.supplierStateCode})`, 17, currentY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${tenantConfig.supplierGstin}`, 17, currentY + 26);
  doc.setFont('helvetica', 'normal');
  doc.text(`PAN: ${tenantConfig.supplierGstin.substring(2, 12)}`, 17, currentY + 31);
  doc.text(`Invoice No: ${dispatch.invoiceNumber || 'INV-001'}`, 17, currentY + 37);
  doc.text(`Invoice Date: ${new Date().toLocaleDateString('en-IN')}`, 17, currentY + 41);

  // Buyer Details (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DETAILS OF RECIPIENT (BUYER / CONSIGNEE):', 109, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const buyerName = dispatch.customerName || customer?.name || 'Customer Corporate Accounts';
  doc.text(buyerName.substring(0, 38), 109, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const buyerAddr = customer?.shippingAddress || customer?.billingAddress || dispatch.destination || 'Works Delivery Site';
  doc.text(buyerAddr.substring(0, 45), 109, currentY + 15);
  doc.text(`Place of Supply: ${customerStateCode} - ${isInterstate ? 'Interstate' : 'Intrastate'}`, 109, currentY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text(`Buyer GSTIN: ${customerGstin}`, 109, currentY + 26);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dispatch Ref: ${dispatch.dispatchNumber || dispatch.id}`, 109, currentY + 31);
  doc.text(`Vehicle / LR No: ${dispatch.vehicleNumber || 'N/A'} • ${dispatch.lrNumber || 'Direct'}`, 109, currentY + 37);
  doc.text(`Transporter: ${dispatch.transporter || 'Direct Delivery'}`, 109, currentY + 41);

  currentY += 49;

  // 4. Line Items Table with GST Breakdown
  const items = dispatch.items || [];
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const tableBody = items.map((it, idx) => {
    const qty = Number(it.quantity) || 1;
    const rate = Number(it.unitPrice) || 0;
    const taxable = Math.round(qty * rate * 100) / 100;
    const gstRate = Number(it.gstPercent) || 18;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterstate) {
      igst = Math.round(taxable * (gstRate / 100) * 100) / 100;
    } else {
      cgst = Math.round(taxable * (gstRate / 200) * 100) / 100;
      sgst = Math.round(taxable * (gstRate / 200) * 100) / 100;
    }

    const lineTotal = taxable + cgst + sgst + igst;

    subtotal += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    const hsn = String((it as any).hsn || (it as any).hsnCode || '7308').replace(/[^0-9]/g, '');

    return [
      idx + 1,
      it.name || 'Component Item',
      hsn,
      qty,
      it.unit || 'PCS',
      `₹${rate.toLocaleString('en-IN')}`,
      `₹${taxable.toLocaleString('en-IN')}`,
      `${gstRate}%`,
      isInterstate ? `₹${igst.toLocaleString('en-IN')}` : `₹${(cgst + sgst).toLocaleString('en-IN')}`,
      `₹${lineTotal.toLocaleString('en-IN')}`
    ];
  });

  const grandTotal = subtotal + totalCgst + totalSgst + totalIgst;

  autoTable(doc, {
    startY: currentY,
    head: [[
      '#',
      'Description of Goods',
      'HSN',
      'Qty',
      'Unit',
      'Rate',
      'Taxable Val',
      'GST %',
      isInterstate ? 'IGST' : 'CGST+SGST',
      'Total'
    ]],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 50 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 20 }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 60;

  // 5. Totals & Tax Summary Table
  const summaryY = finalY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('TAX SUMMARY BREAKDOWN:', 14, summaryY);

  autoTable(doc, {
    startY: summaryY + 2,
    head: [['HSN/SAC', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Total Tax']],
    body: [[
      items[0] ? String((items[0] as any).hsn || '7308') : '7308',
      `₹${subtotal.toLocaleString('en-IN')}`,
      isInterstate ? '₹0.00' : `₹${totalCgst.toLocaleString('en-IN')}`,
      isInterstate ? '₹0.00' : `₹${totalSgst.toLocaleString('en-IN')}`,
      isInterstate ? `₹${totalIgst.toLocaleString('en-IN')}` : '₹0.00',
      `₹${(totalCgst + totalSgst + totalIgst).toLocaleString('en-IN')}`
    ]],
    theme: 'plain',
    tableWidth: 120,
    margin: { left: 14 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] }
  });

  // Grand Total Card on Right
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(138, summaryY + 2, 58, 26, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Taxable Amount:', 142, summaryY + 7);
  doc.text(`₹${subtotal.toLocaleString('en-IN')}`, 192, summaryY + 7, { align: 'right' });

  doc.text('Total GST Tax:', 142, summaryY + 13);
  doc.text(`₹${(totalCgst + totalSgst + totalIgst).toLocaleString('en-IN')}`, 192, summaryY + 13, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Invoice Total:', 142, summaryY + 21);
  doc.text(`₹${grandTotal.toLocaleString('en-IN')}`, 192, summaryY + 21, { align: 'right' });

  // 6. Statutory Declaration & Signature
  const footerY = summaryY + 36;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    isEInvoiced
      ? 'Statutory Declaration: This is an electronic invoice generated in compliance with Rule 48(4) of the CGST Rules, 2017. Authenticated digitally via the GST Invoice Registration Portal (IRP).'
      : 'Statutory Declaration: This is a standard tax invoice for B2C supply exempt from e-Invoicing under GST Notification No. 13/2020.',
    14,
    footerY,
    { maxWidth: 125 }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${tenantConfig.supplierLegalName}`, 148, footerY);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory / Finance Controller', 148, footerY + 12);

  return doc;
}

export async function downloadEInvoicePdf(
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any
): Promise<void> {
  const doc = await generateEInvoicePdf(arg1, arg2, arg3, arg4);
  const targetDispatch = (arg1 && 'items' in arg1) ? arg1 : (arg2 && 'items' in arg2 ? arg2 : null);
  const fileName = `eInvoice_${targetDispatch?.invoiceNumber || targetDispatch?.dispatchNumber || targetDispatch?.id || Date.now()}.pdf`;
  doc.save(fileName);
}

