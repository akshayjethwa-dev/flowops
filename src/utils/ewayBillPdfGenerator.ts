// src/utils/ewayBillPdfGenerator.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dispatch } from '../types';
import { EWayBillData } from '../types/ewayBill';

export async function generateEWayBillPdf(
  dispatch: Dispatch,
  ewbInput?: EWayBillData
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const ewb: EWayBillData | undefined = ewbInput || dispatch.ewayBill;
  if (!ewb) {
    throw new Error('No e-Way Bill data found on dispatch record.');
  }

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GOVERNMENT OF INDIA · GST E-WAY BILL SYSTEM', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('FORM GST EWB-01 · Consolidated Transit Consignment Permit (Rule 138)', 14, 17);

  // Status Badge in Header
  const statusLabel = ewb.status === 'cancelled' 
    ? 'CANCELLED' 
    : ewb.status === 'expired' 
    ? 'EXPIRED' 
    : ewb.status === 'expiring_soon' 
    ? 'EXPIRING SOON' 
    : 'ACTIVE / VALID';

  doc.setFillColor(ewb.status === 'cancelled' ? 225 : ewb.status === 'expired' ? 225 : 16, 185, 129);
  doc.roundedRect(160, 6, 36, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(statusLabel, 178, 12.5, { align: 'center' });

  let currentY = 30;

  // 2. Primary Number & Validity Card
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, 182, 34, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('E-WAY BILL NUMBER (EWB NO):', 18, currentY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(ewb.ewayBillNumber, 18, currentY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated Date: ${new Date(ewb.generatedAt).toLocaleString()}`, 18, currentY + 22);
  doc.text(`Valid Until: ${new Date(ewb.validUntil).toLocaleString()} (${ewb.distanceKm} KM Approx Distance)`, 18, currentY + 28);

  // Embed QR Code
  if (ewb.qrCodeDataUrl) {
    try {
      doc.addImage(ewb.qrCodeDataUrl, 'PNG', 160, currentY + 2, 30, 30);
    } catch (e) {
      console.warn('Could not render EWB QR in PDF', e);
    }
  }

  currentY += 40;

  // 3. Linked Document and e-Invoice IRN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DOCUMENT & REFERENCE MAPPING', 14, currentY);

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
    body: [
      [
        'Document Type', ewb.docType === 'INV' ? 'Tax Invoice' : 'Delivery Challan',
        'Document No & Date', `${ewb.docNumber} dt. ${ewb.docDate}`,
        'Supply Category', 'Outward Supply - Standard B2B'
      ],
      [
        'Linked e-Invoice IRN', 
        { content: ewb.linkedIrn || 'Not Applicable (Consignment Document)', colSpan: 5, styles: { fontStyle: 'italic', textColor: [71, 85, 105] } }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 4. PART-A: Consignor and Consignee Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. PART-A: CONSIGNOR & CONSIGNEE DETAILS', 14, currentY);

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
    columns: [
      { header: 'Attribute', dataKey: 'attr' },
      { header: 'FROM (Consignor / Supplier)', dataKey: 'from' },
      { header: 'TO (Consignee / Recipient)', dataKey: 'to' }
    ],
    body: [
      { attr: 'GSTIN / Legal ID', from: ewb.fromGstin, to: ewb.toGstin },
      { attr: 'Trade / Business Name', from: ewb.fromTradeName, to: ewb.toTradeName },
      { attr: 'Address & Dispatch Bay', from: ewb.fromAddress, to: ewb.toAddress },
      { attr: 'State & Pincode', from: `${ewb.fromState} (${ewb.fromPincode})`, to: `${ewb.toState} (${ewb.toPincode})` }
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 5. Value and Tax Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('3. CONSIGNMENT GOODS VALUATION & TAX SUMMARY', 14, currentY);

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
    body: [
      [
        'Main HSN Code', ewb.mainHsnCode,
        'Taxable Value', `₹${ewb.taxableAmount.toLocaleString('en-IN')}`,
        'CGST + SGST', `₹${(ewb.cgstAmount + ewb.sgstAmount).toLocaleString('en-IN')}`
      ],
      [
        'IGST Amount', `₹${ewb.igstAmount.toLocaleString('en-IN')}`,
        'Total Invoice Value', `₹${ewb.totalInvoiceValue.toLocaleString('en-IN')}`,
        'Total Quantity', `${(dispatch.items || []).reduce((s, it) => s + (it.quantity || 1), 0)} Units`
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 6. PART-B: Vehicle and Transporter Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('4. PART-B: TRANSPORTATION & VEHICLE DETAILS', 14, currentY);

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
    body: [
      [
        'Mode of Transport', ewb.transportMode.toUpperCase(),
        'Vehicle Type', ewb.vehicleType === 'over_dimensional' ? 'Over Dimensional Cargo (ODC)' : 'Regular Road Freight',
        'Vehicle Registration No', ewb.vehicleNumber
      ],
      [
        'Transporter ID (GSTIN)', ewb.transporterId,
        'Transporter Name', ewb.transporterName,
        'Lorry Receipt / Trans Doc', dispatch.lrNumber || dispatch.LRNumber || 'LR-REGISTERED'
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 7. Part B Vehicle Update History (if vehicle changed mid-transit)
  if (ewb.partBHistory && ewb.partBHistory.length > 1) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('5. PART-B VEHICLE UPDATE & MULTI-LEG HISTORY', 14, currentY);

    autoTable(doc, {
      startY: currentY + 3,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.8, textColor: [15, 23, 42] },
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
      columns: [
        { header: 'Vehicle No', dataKey: 'veh' },
        { header: 'From Place / State', dataKey: 'place' },
        { header: 'Reason', dataKey: 'reason' },
        { header: 'Updated At', dataKey: 'date' },
        { header: 'Remarks', dataKey: 'remarks' }
      ],
      body: ewb.partBHistory.map(h => ({
        veh: h.vehicleNumber,
        place: `${h.fromPlace}, ${h.fromState}`,
        reason: h.reasonDescription,
        date: new Date(h.updatedAt).toLocaleString(),
        remarks: h.remarks || 'Vehicle changed'
      }))
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 8. Statutory Disclaimer Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Statutory Certification: This is an electronic transit permit generated in compliance with Section 68 of the CGST Act, 2017 read with Rule 138 of the CGST Rules. Goods may be inspected by authorised tax officers in transit.',
    14,
    pageHeight - 12,
    { maxWidth: 182 }
  );

  return doc;
}

export async function downloadEWayBillPdf(
  dispatchOrEwb: any,
  secondArg?: any,
  _thirdArg?: any
): Promise<void> {
  let dispatch: Dispatch;
  let ewbInput: EWayBillData | undefined;

  if (dispatchOrEwb && ('items' in dispatchOrEwb || 'dispatchNumber' in dispatchOrEwb || 'invoiceNumber' in dispatchOrEwb)) {
    dispatch = dispatchOrEwb as Dispatch;
    ewbInput = secondArg as EWayBillData;
  } else if (secondArg && ('items' in secondArg || 'dispatchNumber' in secondArg || 'invoiceNumber' in secondArg)) {
    dispatch = secondArg as Dispatch;
    ewbInput = dispatchOrEwb as EWayBillData;
  } else {
    dispatch = (secondArg || dispatchOrEwb) as Dispatch;
    ewbInput = (dispatchOrEwb || secondArg) as EWayBillData;
  }

  const doc = await generateEWayBillPdf(dispatch, ewbInput);
  const ewb = ewbInput || dispatch?.ewayBill;
  const fileName = `EWayBill_${ewb?.ewayBillNumber || ewb?.ewbNumber || dispatch?.dispatchNumber || dispatch?.invoiceNumber || 'permit'}.pdf`;
  doc.save(fileName);
}
