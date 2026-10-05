// src/utils/exportUtils.ts

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Triggers a client-side browser download of CSV data.
 * Adheres strictly to the guideline of not using third-party CSV libraries.
 */
export function exportToCSV(headers: string[], rows: any[][], filename: string) {
  const csvContent = [
    // Header row
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    // Data rows
    ...rows.map(row => 
      row.map(val => {
        const strVal = val === null || val === undefined ? '' : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a highly styled PDF report.
 * Uses jspdf and jspdf-autotable with custom status mapping and professional footer numbering.
 */
export function exportReportToPDF(
  reportTitle: string,
  headers: string[],
  rows: any[][],
  companyName: string,
  activePlant: string,
  fileName: string
) {
  // Create jsPDF instance (A4, portrait, mm)
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const totalPagesExp = '{total_pages_count_string}';

  // Draw corporate layout top-accent bar in Sky-500
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, 210, 8, 'F');

  // Header Details
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(reportTitle, 15, 22);

  // Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(15, 26, 195, 26);

  // Metadata block (Sub-header)
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Organization: ${companyName}`, 15, 33);
  doc.text(`Plant Context: ${activePlant}`, 15, 38);
  
  doc.text(`Generated On: ${timestamp} IST`, 130, 33);
  doc.text('Data Source: Live Factory Logs', 130, 38);

  // Render Table
  autoTable(doc, {
    startY: 44,
    head: [headers],
    body: rows,
    theme: 'striped',
    margin: { left: 15, right: 15 },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      font: 'Helvetica',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42], // deep dark slate-900 for modern industrial contrast
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // light slate-50
    },
    // Cell styling hooks to color-code statuses dynamically and cleanly
    didParseCell: (data) => {
      if (data.row.section === 'body') {
        const textVal = String(data.cell.raw || '').toLowerCase().trim();

        // 1. Positive/Won/Success triggers (Excellent Status green)
        if (['won', 'paid', 'delivered', 'ok', 'completed'].includes(textVal)) {
          data.cell.styles.textColor = [16, 185, 129]; // emerald-500
          data.cell.styles.fontStyle = 'bold';
        } 
        // 2. Negative/Lost/Outlier alerts (Attention Red)
        else if (['lost', 'overdue', 'cancelled', 'yes', 'reorder', 'delayed'].includes(textVal)) {
          data.cell.styles.textColor = [239, 68, 68]; // red-500
          data.cell.styles.fontStyle = 'bold';
        } 
        // 3. Middle stages (Amber Orange)
        else if (
          ['quoted', 'partial', 'in-production', 'dispatched', 'in progress', 'shipped'].some(s => textVal.includes(s))
        ) {
          data.cell.styles.textColor = [245, 158, 11]; // amber-500
          data.cell.styles.fontStyle = 'bold';
        } 
        // 4. Initial entry (Sky Blue)
        else if (['new', 'sent', 'pending', 'no', 'draft', 'planned'].includes(textVal)) {
          data.cell.styles.textColor = [14, 165, 233]; // sky-500
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    // Page footer numbering callbacks
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Gray decorative footer divider
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

      // Left-aligned system footer label
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Ashrey FlowOps™ — Connected Manufacturing CRM', 15, pageHeight - 10);

      // Right-aligned dynamic page totalizer
      const currentPageNum = data.pageNumber || doc.internal.pages.length - 1;
      const pageText = `Page ${currentPageNum} of ${totalPagesExp}`;
      doc.text(pageText, pageWidth - 15 - doc.getTextWidth(pageText), pageHeight - 10);
    }
  });

  // Replace total pages placeholder string safely at the end of compilation
  if (typeof (doc as any).putTotalPages === 'function') {
    (doc as any).putTotalPages(totalPagesExp);
  }

  // Save/Download operation trigger
  doc.save(`${fileName}.pdf`);
}
