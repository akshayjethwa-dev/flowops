// src/components/quotations/QuotationPDFPreviewModal.tsx

import React, { useState } from 'react';
import { Quote, TenantConfig } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useGeneratePDF } from '../../hooks/useQuotations';
import { jsPDF } from 'jspdf';
import { SendQuotationDialog } from './SendQuotationDialog';
import { QuotationVersionHistory } from './QuotationVersionHistory';
import { FileDown, Send, Printer, X, FileText, Check, FileCheck, Layers, HelpCircle } from 'lucide-react';

interface QuotationPDFPreviewModalProps {
  quote: Quote;
  onClose: () => void;
  onRefreshList?: () => void;
}

export const QuotationPDFPreviewModal: React.FC<QuotationPDFPreviewModalProps> = ({ quote, onClose, onRefreshList }) => {
  const { tenant, profile } = useAuth();
  const { generatePDF, loading: generating, error: genError } = useGeneratePDF();
  const [activeTab, setActiveTab] = useState<'preview' | 'versions' | 'dispatch'>('preview');
  
  // Use either direct quote.downloadUrl or a generated session state downloadUrl
  const [activeDownloadUrl, setActiveDownloadUrl] = useState<string | null>(quote.downloadUrl || null);
  const [generationSuccess, setGenerationSuccess] = useState<boolean>(false);

  // Default Tenant fallbacks
  const currentCompanyName = tenant?.companyName || 'Ashrey Engineering Works';
  const currentGstin = tenant?.gstin || (tenant as any)?.gstNumber || '27AAACA1234A1Z9';
  const currentAddress = tenant?.address || 'Plot No. 45, Sector II, MIDC Industrial Area, Pune, Maharashtra - 411018';
  const currentEmail = (tenant as any)?.contactEmail || (tenant as any)?.email || 'sales@ashreyengineering.com';
  const currentPhone = (tenant as any)?.contactPhone || (tenant as any)?.phone || '+91 98765 43210';

  // Calculations for split GST on invoice preview
  const subtotal = quote.subtotal || 0;
  const discountTotal = quote.discountTotal || 0;
  const gstAmount = quote.gstAmount || 0;
  const grandTotal = quote.total || 0;
  const cgstVal = gstAmount / 2;
  const sgstVal = gstAmount / 2;

  // Render text-based Indian rupee conversion
  const numberToIndianWords = (num: number): string => {
    try {
      const a = [
        '', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ',
        'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '
      ];
      const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

      const numStr = Math.floor(num).toString();
      if (numStr.length > 9) return 'Amount too large';

      const n = ('000000000' + numStr).substr(-9);
      let str = '';
      
      const crore = parseInt(n.substr(0, 2));
      const lakh = parseInt(n.substr(2, 2));
      const thousand = parseInt(n.substr(4, 2));
      const hundreds = parseInt(n.substr(6, 1));
      const tensDigits = parseInt(n.substr(7, 2));

      if (crore > 0) {
        str += (crore < 20 ? a[crore] : b[Math.floor(crore / 10)] + ' ' + a[crore % 10]) + 'crore ';
      }
      if (lakh > 0) {
        str += (lakh < 20 ? a[lakh] : b[Math.floor(lakh / 10)] + ' ' + a[lakh % 10]) + 'lakh ';
      }
      if (thousand > 0) {
        str += (thousand < 20 ? a[thousand] : b[Math.floor(thousand / 10)] + ' ' + a[thousand % 10]) + 'thousand ';
      }
      if (hundreds > 0) {
        str += a[hundreds] + 'hundred ';
      }
      if (tensDigits > 0) {
        str += (tensDigits < 20 ? a[tensDigits] : b[Math.floor(tensDigits / 10)] + ' ' + a[tensDigits % 10]);
      }

      const words = str.trim();
      return words ? words.toUpperCase() + ' ONLY' : 'ZERO RUPEES ONLY';
    } catch {
      return '';
    }
  };

  const verbalTotal = numberToIndianWords(grandTotal);

  // TRIGGER REAL HIGH-FIDELITY PDF GENERATION CLIENT SIDE USING JSPDF
  const handleCompileAndRegisterPDF = async () => {
    setGenerationSuccess(false);

    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // PDF Setup Constants
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;
      let y = margin;

      // 1. TOP LETTERHEAD HEADER BACKGROUND
      doc.setFillColor(15, 23, 42); // slate-900 color
      doc.rect(0, 0, 210, 32, 'F');

      // 2. TEXT BRANDING
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(currentCompanyName.toUpperCase(), margin, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const headerContact = `GSTIN: ${currentGstin} | Tel: ${currentPhone} | Email: ${currentEmail}`;
      doc.text(headerContact, margin, 17);
      
      const cleanAddr = currentAddress.substring(0, 95);
      doc.text(cleanAddr, margin, 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(56, 189, 248); // sky blue sky-400
      doc.text('OFFICIAL QUOTATION', 135, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`Doc Ref: ${quote.quoteNumber}`, 135, 20);
      doc.text(`Rev: v${(quote.pdfVersion || 0) + 1}`, 135, 24);

      y = 38;

      // 3. SECTIONS LAYOUT (TWO COLUMN B2B DETAILS)
      // Supplier Details (Left) / Customer Details (Right)
      doc.setDrawColor(226, 232, 240); // border-slate-200
      doc.setLineWidth(0.2);
      doc.line(margin, y, 210 - margin, y);
      
      y += 6;
      
      // LEFT COLUMN: SUPPLIER
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text('SUPPLIER (SENDER MASTER):', margin, y);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      y += 4.5;
      doc.text(currentCompanyName, margin, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      y += 4;
      doc.text(`GSTIN No: ${currentGstin}`, margin, y);
      y += 4;
      doc.text(`Contact: ${currentPhone}`, margin, y);
      y += 4;
      doc.text(`Email: ${currentEmail}`, margin, y);

      // RIGHT COLUMN: CLIENT
      let yClient = 38 + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('CLIENT (BILL TO ENTITY):', 115, yClient);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      yClient += 4.5;
      doc.text(quote.customerName.toUpperCase(), 115, yClient);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      if (quote.phone) {
        yClient += 4;
        doc.text(`Contact: ${quote.phone}`, 115, yClient);
      }
      if (quote.email) {
        yClient += 4;
        doc.text(`Email: ${quote.email}`, 115, yClient);
      }
      yClient += 4;
      doc.text(`Direct Inquiry Ref: ${quote.rfqId === 'direct_quote' ? 'Direct Proposal' : quote.rfqId}`, 115, yClient);

      y = Math.max(y, yClient) + 8;

      // 4. METADATA CARDS
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(margin, y, 210 - margin * 2, 12, 'F');
      doc.rect(margin, y, 210 - margin * 2, 12, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      
      const qDateStr = quote.date ? new Date(quote.date).toLocaleDateString() : new Date().toLocaleDateString();
      const vDateStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'N/A';
      
      doc.text(`Raise Date: ${qDateStr}`, margin + 5, y + 7.5);
      doc.text(`Validity Threshold: ${vDateStr}`, margin + 65, y + 7.5);
      doc.text(`FOB Dispatch: Works`, margin + 135, y + 7.5);

      y += 18;

      // 5. TECHNICAL LINE ITEMS TABLE HEADER
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(margin, y, 210 - margin * 2, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('S.No.', margin + 2, y + 5);
      doc.text('Technical Particulars / Product Specifications', margin + 12, y + 5);
      doc.text('HSN', margin + 85, y + 5);
      doc.text('Qty', margin + 102, y + 5);
      doc.text('Unit', margin + 115, y + 5);
      doc.text('Rate (Rs)', margin + 128, y + 5);
      doc.text('Disc (Rs)', margin + 145, y + 5);
      doc.text('GST Rate', margin + 162, y + 5);
      doc.text('Line Total (Rs)', margin + 180, y + 5);

      y += 8;

      // 6. DRAW ITEMS
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      (quote.items || []).forEach((item, index) => {
        // Row backgrounds zebra stripe
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, 210 - margin * 2, 9, 'F');
        }
        
        doc.text((index + 1).toString(), margin + 3, y + 6);
        
        // Multi-line wrap for long spec names
        const splitSpec = doc.splitTextToSize(item.name, 68);
        doc.text(splitSpec, margin + 12, y + 5);

        doc.text(item.hsn || '7308', margin + 85, y + 6);
        doc.text(item.quantity.toString(), margin + 102, y + 6);
        doc.text(item.unit || 'PCS', margin + 115, y + 6);
        doc.text(item.unitPrice.toLocaleString('en-IN'), margin + 128, y + 6);
        doc.text((item.discount || 0).toLocaleString('en-IN'), margin + 145, y + 6);
        doc.text(`${item.gstPercent}%`, margin + 162, y + 6);
        doc.text(item.total.toLocaleString('en-IN'), margin + 180, y + 6);

        // Adjust Y based on lines of text
        const textHeightOffset = (splitSpec.length - 1) * 3;
        y += 9 + textHeightOffset;
      });

      y += 4;

      // Draw thin bottom divider
      doc.line(margin, y, 210 - margin, y);
      y += 6;

      // 7. FINANCIAL SUMMARY PANEL (RIGHT ALIGNED)
      const sumX = 135;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      
      doc.text('Net Taxable Subtotal:', sumX, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}`, 182, y);
      
      if (discountTotal > 0) {
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(225, 29, 72); // rose-600
        doc.text('Deductions/Discounts:', sumX, y);
        doc.text(`- Rs. ${discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}`, 182, y);
      }

      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Central GST (CGST 9%):`, sumX, y);
      doc.text(`Rs. ${cgstVal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}`, 182, y);

      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.text(`State GST (SGST 9%):`, sumX, y);
      doc.text(`Rs. ${sgstVal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}`, 182, y);

      y += 6;
      doc.setDrawColor(203, 213, 225);
      doc.line(sumX, y - 2, 210 - margin, y - 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Grand Total:', sumX, y);
      doc.text(`Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}`, 180, y);

      // Rs in words
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const verbalWordsWrap = doc.splitTextToSize(`RUPEES ${verbalTotal}`, 180);
      doc.text(verbalWordsWrap, margin, y);

      y += 12;

      // 8. TERMS & CONDITIONS (LEFT BOTTOM BLOCK)
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, 210 - margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('TERMS AND SPECIAL CONDITIONS:', margin, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      
      const tcTxt = quote.termsAndConditions || `
1. Price Validity: 30 days from dispatch.
2. Delivery Lead Time: 2-3 weeks post official technical approval.
3. Tax Assessment: Subject to 18% standard Integrated/Central and State GST.
4. Transport Freight: Borne exclusively by client works unless stated otherwise.
5. Standard Payment: 50% advance allocation, 50% post foundry inspection before loading.`;

      const wrappedTerms = doc.splitTextToSize(tcTxt.trim(), 110);
      doc.text(wrappedTerms, margin, y + 4);

      // 9. SIGNATURE BLOCKS
      const sigY = y + 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('AUTHORIZED SIGNATORY', 145, sigY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('--------------------------------------------', 142, sigY + 12);
      doc.text(`${currentCompanyName}`, 144, sigY + 15);

      // FOOTER PAGE INDEX
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('This is a computer-generated commercial estimation form dispatched securely via Ashrey FlowOps CRM.', margin, pageHeight - 10);
      doc.text('Stamp and physical verification not mandatory.', margin + 115, pageHeight - 10);

      // Output Blobs and execute update
      const pdfBlob = doc.output('blob');
      const downloadPath = await generatePDF(quote, pdfBlob);
      setActiveDownloadUrl(downloadPath);
      setGenerationSuccess(true);
      
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      console.error(err);
      alert(`PDF Compilation issue: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-7xl w-full flex flex-col h-[90vh]">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white px-6 py-4.5 rounded-t-2xl flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl border border-amber-500/20">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Technical Quotation Builder & PDF Desk</h3>
              <p className="text-[10px] text-slate-400 font-mono">ID Ref: {quote.quoteNumber} | Customer: {quote.customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL CONTROL SUBBAR */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap gap-4 items-center justify-between shrink-0">
          {/* Section Selector Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1 border transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 border-slate-250 shadow-3xs'
                  : 'text-slate-400 border-transparent hover:text-slate-700'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Live PDF View</span>
            </button>

            <button
              onClick={() => setActiveTab('versions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1 border transition-all cursor-pointer ${
                activeTab === 'versions'
                  ? 'bg-white text-slate-900 border-slate-250 shadow-3xs'
                  : 'text-slate-400 border-transparent hover:text-slate-700'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Version History ({quote.pdfVersions?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1 border transition-all cursor-pointer ${
                activeTab === 'dispatch'
                  ? 'bg-white text-slate-900 border-slate-250 shadow-3xs'
                  : 'text-slate-400 border-transparent hover:text-slate-700'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>Dispatch via WhatsApp/Email</span>
            </button>
          </div>

          {/* Quick PDF Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCompileAndRegisterPDF}
              disabled={generating}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-3xs transition-all hover:scale-101 cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span>{quote.downloadUrl ? 'Re-Generate & Version PDF' : 'Generate & Store PDF v1'}</span>
            </button>

            {activeDownloadUrl && (
              <a
                href={activeDownloadUrl}
                target="_blank"
                rel="noreferrer referrer"
                download={`Quotation_${quote.quoteNumber}.pdf`}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <FileDown className="h-4 w-4" />
                <span>Download PDF</span>
              </a>
            )}
          </div>
        </div>

        {/* WORKSPACE AREA (TWO PANELS ON LARGE SCREENS) */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          
          {/* LEFT SCROLLABLE PANEL (REALTIME VISUAL LAYOUT) */}
          <div className="flex-1 overflow-y-auto bg-slate-100 p-6 flex justify-center items-start">
            
            {activeTab === 'preview' && (
              <div className="w-full max-w-[800px] bg-white rounded-xs shadow-md p-10 border border-slate-300 font-sans text-slate-800 font-medium select-text relative leading-relaxed scroll-smooth" id="formal-pdf-mock">
                
                {/* PDF Header Stripe */}
                <div className="border-b-4 border-slate-900 pb-5 mb-6 flex justify-between items-start">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-sky-600">b2b quote sheet</span>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-tight">{currentCompanyName}</h2>
                    <ul className="text-[10px] text-slate-500 space-y-0.5 font-mono">
                      <li>GSTIN No: <span className="font-bold text-slate-700">{currentGstin}</span></li>
                      <li>Contact: {currentPhone} | Email: {currentEmail}</li>
                      <li>Address: {currentAddress}</li>
                    </ul>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="inline-block bg-sky-50 border border-sky-100 text-sky-800 font-bold font-mono uppercase tracking-wider text-[9px] px-2.5 py-0.5 rounded">
                      Commercial Proposal
                    </span>
                    <p className="text-xs text-slate-450 font-mono">File Ref: <span className="font-bold text-slate-800">{quote.quoteNumber}</span></p>
                    <p className="text-[10px] text-slate-450 font-mono">Active Rev: <span className="font-bold text-amber-700">v{quote.pdfVersion || 1}</span></p>
                  </div>
                </div>

                {/* Sender/Receiver Column Panel */}
                <div className="grid grid-cols-2 gap-8 pb-6 border-b border-slate-100 text-xs">
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">issued from (supplier):</p>
                    <p className="font-bold text-slate-900">{currentCompanyName}</p>
                    <p className="text-slate-500 font-mono leading-relaxed text-[11px]">{currentAddress}</p>
                    <p className="text-slate-500 font-mono text-[11.5px] pt-1">GSTIN: {currentGstin}</p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">billing to (customer):</p>
                    <p className="font-extrabold text-slate-900 uppercase">{(quote.customerName || '').toUpperCase()}</p>
                    {quote.phone && <p className="text-slate-600 font-mono text-[11.5px]">Cel: {quote.phone}</p>}
                    {quote.email && <p className="text-slate-600 font-mono text-[11.5px] truncate">Email: {quote.email}</p>}
                    <p className="text-slate-450 text-[10px] pt-1 font-mono uppercase leading-none">Inquiry Code: {quote.rfqId === 'direct_quote' ? 'Direct Deal' : quote.rfqId}</p>
                  </div>
                </div>

                {/* Mini Parameters Block */}
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 py-3.5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-450 block uppercase font-bold">Quotation Date:</span>
                    <span className="font-bold text-slate-700">{quote.date ? new Date(quote.date).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 block uppercase font-bold">Expiration Date:</span>
                    <span className="font-bold text-slate-700 font-mono text-rose-600">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 block uppercase font-bold">Est. Dispatch Place:</span>
                    <span className="font-bold text-slate-700">Works (FOB Site)</span>
                  </div>
                </div>

                {/* Render Table */}
                <div className="py-6 scroll-smooth">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white font-mono text-[9px] uppercase tracking-wider">
                        <th className="p-2.5 text-center w-8">#</th>
                        <th className="p-2.5">Component Technical Specs</th>
                        <th className="p-2.5 text-center w-14">HSN</th>
                        <th className="p-2.5 text-center w-12">Qty</th>
                        <th className="p-2.5 text-center w-12">Unit</th>
                        <th className="p-2.5 text-right w-20">Rate</th>
                        <th className="p-2.5 text-right w-16">Disc</th>
                        <th className="p-2.5 text-center w-16">GST %</th>
                        <th className="p-2.5 text-right w-24">Taxable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {(quote.items || []).map((itm, index) => (
                        <tr key={itm.id} className="hover:bg-slate-50/40 text-slate-700 leading-relaxed">
                          <td className="p-2.5 text-center font-mono text-slate-400">{index + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900 whitespace-pre-line">{itm.name}</td>
                          <td className="p-2.5 text-center font-mono text-[11px]">{itm.hsn || '7308'}</td>
                          <td className="p-2.5 text-center font-mono">{itm.quantity}</td>
                          <td className="p-2.5 text-center font-mono uppercase text-slate-400">{itm.unit || 'PCS'}</td>
                          <td className="p-2.5 text-right font-mono font-medium">₹{itm.unitPrice.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono text-rose-600">-₹{(itm.discount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-center font-mono font-semibold">{itm.gstPercent}%</td>
                          <td className="p-2.5 text-right font-mono font-extrabold text-slate-800">
                            ₹{itm.total.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals split */}
                <div className="pt-4 border-t border-slate-150 flex flex-col items-end space-y-1.5 text-xs pr-1 font-mono">
                  <div className="flex justify-between w-64 text-slate-500">
                    <span>Taxable Subtotal:</span>
                    <span className="font-semibold text-slate-800">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
                  </div>
                  
                  {discountTotal > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Group Discount Applied:</span>
                      <span>- ₹{discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-500">
                    <span>Central GST (CGST 9%):</span>
                    <span>₹{cgstVal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
                  </div>

                  <div className="flex justify-between text-slate-500">
                    <span>State GST (SGST 9%):</span>
                    <span>₹{sgstVal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
                  </div>

                  <div className="flex justify-between w-64 text-sm font-black text-slate-900 border-t-2 border-slate-350 pt-2 font-sans">
                    <span>Final Quote Total (INR):</span>
                    <span className="font-mono">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
                  </div>

                  <p className="text-[8.5px] font-mono leading-tight uppercase font-medium bg-slate-50 text-slate-450 border border-slate-100 p-2 rounded mt-1.5 max-w-sm text-right">
                    Amount in Words: <span className="font-bold text-slate-700">Rs. {verbalTotal}</span>
                  </p>
                </div>

                {/* Terms and conditions block */}
                <div className="pt-10 border-t border-slate-150 mt-10 text-xs">
                  <span className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-2">Terms & Special Conditions</span>
                  <div className="bg-slate-50 border border-slate-150 rounded-lg p-4 font-normal text-slate-500 leading-relaxed text-[11px] whitespace-pre-line">
                    {quote.termsAndConditions || `
                    1. Price Validity: 30 days from dispatch.
                    2. Delivery Lead Time: 2-3 weeks post official technical approval.
                    3. Tax Assessment: Subject to 18% standard Integrated/Central and State GST.
                    4. Transport Freight: Borne exclusively by client works unless stated otherwise.
                    5. Standard Payment: 50% advance allocation, 50% post foundry inspection before loading.
                    `}
                  </div>
                </div>

                {/* Signature panels */}
                <div className="pt-16 mt-1 flex justify-between items-end text-xs">
                  <div className="space-y-1">
                    <div className="h-10" />
                    <p className="font-mono text-slate-400">--------------------------------------------</p>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Client Seal & Approved Sign</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-slate-600 uppercase text-[9.5px]">{currentCompanyName}</p>
                    <div className="h-10" />
                    <p className="font-mono text-slate-400">--------------------------------------------</p>
                    <p className="text-[10px] uppercase font-bold text-slate-500">Authorized Signatory</p>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'versions' && (
              <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <QuotationVersionHistory quote={quote} onPreviewUrl={(url) => setActiveDownloadUrl(url)} />
              </div>
            )}

            {activeTab === 'dispatch' && (
              <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                {activeDownloadUrl ? (
                  <SendQuotationDialog 
                    quote={quote} 
                    downloadUrl={activeDownloadUrl} 
                    onClose={() => setActiveTab('preview')} 
                  />
                ) : (
                  <div className="text-center py-8 space-y-4 font-sans text-slate-800">
                    <HelpCircle className="h-12 w-12 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold leading-relaxed px-5 text-slate-500">
                      Kindly click **"Generate v1 PDF"** or compilate the document versions before launching transmission dispatches.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR ACTIONS INFO PANEL */}
          <div className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 p-5 flex flex-col space-y-5 overflow-y-auto shrink-0 font-sans">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-500 font-mono tracking-wider">Quotation Parameters</h4>
              <p className="text-xs text-slate-400">B2B commercial validation & PDF controls.</p>
            </div>

            {generationSuccess && (
              <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center space-x-1 text-emerald-800 text-xs font-bold leading-none">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>PDF Document Compiled</span>
                </div>
                <p className="text-[10.5px] text-emerald-600 leading-relaxed pt-0.5">
                  Document has been registered to cloud archives. Version history incremented successfully.
                </p>
              </div>
            )}

            {genError && (
              <div className="bg-rose-50 border border-rose-150 rounded-xl p-3 text-[11px] text-rose-700">
                <p className="font-bold">Compilation Failed</p>
                <p className="font-mono text-[10px] mt-0.5">{genError}</p>
              </div>
            )}

            <div className="space-y-3.5 bg-white border border-slate-200 rounded-xl p-4 text-xs">
              <span className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">active record index</span>
              <ul className="space-y-2 text-slate-600 font-mono">
                <li className="flex justify-between"><span className="text-slate-405">Status:</span> <span className="font-bold uppercase text-sky-750">{quote.status}</span></li>
                <li className="flex justify-between"><span className="text-slate-405">Currency:</span> <span>INR</span></li>
                <li className="flex justify-between"><span className="text-slate-405">Total Items:</span> <span>{quote.items?.length || 0}</span></li>
                <li className="flex justify-between"><span className="text-slate-405">Grand Total:</span> <span className="font-extrabold text-slate-900">₹{quote.total?.toLocaleString('en-IN')}</span></li>
              </ul>
            </div>

            <div className="flex-1" />

            <div className="border-t border-slate-200 pt-4.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase py-2.5 rounded-lg cursor-pointer text-center block shadow-3xs"
              >
                Close PDF Window
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
