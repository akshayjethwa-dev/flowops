// src/utils/atpReportPdfGenerator.ts

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OrderAtpSummary, OrderAtpLineSummary } from '../types/materialAvailability';

export interface AtpReportPdfOptions {
  companyName?: string;
  preparedBy?: string;
  notes?: string;
  customerPoNumber?: string;
  deliveryDate?: string;
}

export function generateAtpReportPdf(
  summary: OrderAtpSummary,
  options?: AtpReportPdfOptions
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors
  const primaryNavy: [number, number, number] = [30, 41, 59]; // slate-800
  const accentIndigo: [number, number, number] = [67, 56, 202]; // indigo-700
  const emeraldGreen: [number, number, number] = [16, 185, 129];
  const amberYellow: [number, number, number] = [217, 119, 6];
  const roseRed: [number, number, number] = [225, 29, 72];
  const slateGray: [number, number, number] = [100, 116, 139];

  // 1. Header Banner
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FLOWOPS INDUSTRIAL ERP', margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Commercial Engineering & Supply Chain Management', margin, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CONSOLIDATED ATP AVAILABILITY REPORT', pageWidth - margin, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date(summary.checkTimestamp).toLocaleString()}`, pageWidth - margin, 18, { align: 'right' });

  // 2. Order Metadata Card
  let currentY = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'FD');

  doc.setTextColor(...primaryNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ORDER & COMMERCIAL REFERENCE', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateGray);

  // Column 1
  doc.text(`Order Number:`, margin + 4, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(summary.orderNumber || summary.orderId, margin + 28, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateGray);
  doc.text(`Customer:`, margin + 4, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(summary.customerName || 'Direct Commercial Buyer', margin + 28, currentY + 18);

  // Column 2
  const col2X = margin + 75;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateGray);
  doc.text(`Customer PO:`, col2X, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(options?.customerPoNumber || 'PO-VERIFIED', col2X + 24, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateGray);
  doc.text(`Target Delivery:`, col2X, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(options?.deliveryDate || 'Flexible / As Advised', col2X + 24, currentY + 18);

  // Column 3
  const col3X = margin + 135;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateGray);
  doc.text(`Sales Handler:`, col3X, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(options?.preparedBy || 'Sales Management', col3X + 22, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateGray);
  doc.text(`Feasibility:`, col3X, currentY + 18);
  doc.setFont('helvetica', 'bold');
  if (summary.overallStatus === 'available') {
    doc.setTextColor(...emeraldGreen);
    doc.text('100% FEASIBLE', col3X + 22, currentY + 18);
  } else if (summary.overallStatus === 'partially_available') {
    doc.setTextColor(...amberYellow);
    doc.text('PARTIAL SHORTFALL', col3X + 22, currentY + 18);
  } else {
    doc.setTextColor(...roseRed);
    doc.text('BOTTLENECK / SHORT', col3X + 22, currentY + 18);
  }

  // 3. Executive KPI Tiles
  currentY += 30;
  const tileWidth = (pageWidth - margin * 2 - 12) / 4;
  const tileHeight = 20;

  // Tile 1: Total Lines
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, tileWidth, tileHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateGray);
  doc.text('TOTAL LINES', margin + 4, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(String(summary.totalLines), margin + 4, currentY + 15);

  // Tile 2: Available
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin + tileWidth + 4, currentY, tileWidth, tileHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text('AVAILABLE (GREEN)', margin + tileWidth + 8, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(4, 120, 87);
  doc.text(String(summary.availableLinesCount), margin + tileWidth + 8, currentY + 15);

  // Tile 3: Partial & Unavailable
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin + (tileWidth + 4) * 2, currentY, tileWidth, tileHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(153, 27, 27);
  doc.text('SHORTFALL LINES', margin + (tileWidth + 4) * 2 + 4, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(185, 28, 28);
  const shortCount = summary.partiallyAvailableLinesCount + summary.unavailableLinesCount;
  doc.text(`${shortCount} (${summary.partiallyAvailableLinesCount} Part / ${summary.unavailableLinesCount} Unavail)`, margin + (tileWidth + 4) * 2 + 4, currentY + 15);

  // Tile 4: Earliest Possible Fulfilment Date
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(margin + (tileWidth + 4) * 3, currentY, tileWidth, tileHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 48, 163);
  doc.text('EARLIEST FULFILMENT', margin + (tileWidth + 4) * 3 + 4, currentY + 6);
  doc.setFontSize(10);
  doc.setTextColor(30, 27, 75);
  const earliestFormatted = summary.earliestPossibleFulfilmentDate === 'Immediate'
    ? 'Immediate'
    : summary.earliestPossibleFulfilmentDate
    ? new Date(summary.earliestPossibleFulfilmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Immediate';
  doc.text(earliestFormatted, margin + (tileWidth + 4) * 3 + 4, currentY + 14);

  // 4. Line Items Table
  currentY += tileHeight + 8;

  const tableRows = summary.lineResults.map((lr) => {
    let statusText = '';
    if (lr.failedFromNetwork) {
      statusText = '[FAILED] Network Connection Failed';
    } else if (lr.isProductDeleted) {
      statusText = '[ERROR] Product not found in catalog';
    } else if (lr.isNoStockNoBom) {
      statusText = 'Unavailable (No Stock / No BOM)';
    } else if (lr.status === 'available') {
      statusText = 'Available';
    } else if (lr.status === 'partially_available') {
      statusText = 'Partially Available';
    } else {
      statusText = 'Unavailable';
    }

    let shortfallDetails = '';
    if (lr.isProductDeleted) {
      shortfallDetails = 'Error: Product record was deleted after order line creation.';
    } else if (lr.failedFromNetwork) {
      shortfallDetails = 'Evaluation interrupted. Retry advised.';
    } else if (lr.shortfallComponents.length > 0) {
      shortfallDetails = lr.shortfallComponents
        .map(sc => `${sc.partName}: Shortfall ${sc.shortfall} ${sc.unit} (Avail: ${sc.currentStock}). Replenishment: ${sc.expectedReplenishmentDate || 'No PO'}`)
        .join('\n');
    } else if (lr.status === 'available') {
      shortfallDetails = '100% components in warehouse stock. Zero lead time.';
    } else {
      shortfallDetails = lr.summaryText || 'Zero unreserved stock balance.';
    }

    return [
      `#${lr.lineIndex}`,
      lr.productName,
      `${lr.orderedQty} ${lr.unit}`,
      statusText,
      shortfallDetails
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Component Description', 'Ordered Qty', 'ATP Status', 'Shortfall Breakdown & Replenishment']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: accentIndigo,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 35 },
      4: { cellWidth: 'auto' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw);
        if (text.includes('Available') && !text.includes('Partially')) {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (text.includes('Partially')) {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        } else if (text.includes('Unavailable') || text.includes('ERROR') || text.includes('FAILED')) {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin }
  });

  // 5. Managerial Delivery Negotiation Recommendation
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 60;

  if (finalY < pageHeight - 35) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, finalY, pageWidth - margin * 2, 20, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text('COMMERCIAL FULFILMENT & DELIVERY RECOMMENDATION', margin + 4, finalY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateGray);

    if (summary.overallStatus === 'available') {
      doc.text('• Feasibility Verdict: Immediate manufacturing dispatch approved. All materials allocated.', margin + 4, finalY + 10);
      doc.text('• Commercial Commitment: Customer promised date can be firmly confirmed without reservation buffer.', margin + 4, finalY + 15);
    } else {
      const bText = summary.criticalBottleneckComponent 
        ? `Longest replenishment bottleneck: ${summary.criticalBottleneckComponent.partName} (${summary.longestLeadTimeDays} days lead time).`
        : 'Multiple components require procurement allocation.';
      doc.text(`• Feasibility Verdict: Staggered delivery or delivery date renegotiation recommended to ${earliestFormatted}.`, margin + 4, finalY + 10);
      doc.text(`• Commercial Commitment: ${bText}`, margin + 4, finalY + 15);
    }
  }

  // 6. Footer on all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFontSize(7);
    doc.setTextColor(...slateGray);
    doc.text('FlowOps Manufacturing ERP • Real-Time ATP Feasibility Report • Confidential', margin, pageHeight - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  return doc;
}

export function downloadAtpReportPdf(
  summary: OrderAtpSummary,
  options?: AtpReportPdfOptions
): void {
  const doc = generateAtpReportPdf(summary, options);
  const fileName = `ATP_Report_${summary.orderNumber || summary.orderId}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
