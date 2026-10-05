// src/components/quotations/QuotationTotalsPanel.tsx

import React from 'react';
import { QuotationTotals } from '../../types';
import { Calculator } from 'lucide-react';

interface QuotationTotalsPanelProps {
  totals: QuotationTotals;
}

export const QuotationTotalsPanel: React.FC<QuotationTotalsPanelProps> = ({ totals }) => {
  const { subtotal, discountTotal, taxTotal, grandTotal } = totals;

  // Render CGST and SGST splits for standard Indian tax transparency (9% + 9% assuming 18% average)
  const cgstVal = taxTotal / 2;
  const sgstVal = taxTotal / 2;

  // Simple number to Indian words utility for legal compliance
  const numberToIndianWords = (num: number): string => {
    try {
      const a = [
        '', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ',
        'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '
      ];
      const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

      const numStr = Math.floor(num).toString();
      if (numStr.length > 9) return 'Amount too large for verbal description';

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

  const amountInWords = numberToIndianWords(grandTotal);

  return (
    <div className="bg-slate-50 border border-slate-205 rounded-xl p-5 shadow-3xs max-w-sm ml-auto space-y-4">
      <div className="flex items-center space-x-1 border-b border-slate-200 pb-2 mb-2">
        <Calculator className="h-4.5 w-4.5 text-sky-500" />
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">Cost Summary (INR)</h4>
      </div>

      <div className="space-y-2 text-xs font-mono">
        <div className="flex justify-between text-slate-550">
          <span>Gross Subtotal:</span>
          <span className="font-semibold text-slate-800">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
        </div>

        {discountTotal > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>Special Deductions:</span>
            <span>- ₹{discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
          </div>
        )}

        <div className="flex justify-between text-slate-550 pt-1 border-t border-dashed border-slate-200">
          <span>Central GST (CGST):</span>
          <span>₹{cgstVal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
        </div>

        <div className="flex justify-between text-slate-550">
          <span>State GST (SGST):</span>
          <span>₹{sgstVal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
        </div>

        <div className="flex justify-between text-sky-650 font-bold">
          <span>Total Tax Value (GST):</span>
          <span>+ ₹{taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
        </div>

        <div className="flex flex-col pt-3 border-t-2 border-slate-300 text-slate-900 gap-1.5">
          <div className="flex justify-between text-sm font-black font-sans">
            <span>Grand Total:</span>
            <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</span>
          </div>
          <p className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-tight leading-relaxed max-w-xs text-right mt-1 bg-white border border-slate-150/60 p-1.5 rounded">
            Rs. {amountInWords}
          </p>
        </div>
      </div>
    </div>
  );
};
