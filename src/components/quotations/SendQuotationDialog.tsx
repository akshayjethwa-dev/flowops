// src/components/quotations/SendQuotationDialog.tsx

import React, { useState } from 'react';
import { Quote } from '../../types';
import { useSendQuotation } from '../../hooks/useQuotations';
import { Mail, MessageSquare, Send, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface SendQuotationDialogProps {
  quote: Quote;
  downloadUrl: string;
  onClose: () => void;
}

export const SendQuotationDialog: React.FC<SendQuotationDialogProps> = ({ quote, downloadUrl, onClose }) => {
  const [recipientPhone, setRecipientPhone] = useState(quote.phone || '');
  const [recipientEmail, setRecipientEmail] = useState(quote.email || '');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  
  const { sendWhatsApp, sendEmail, loading, error } = useSendQuotation();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    try {
      if (channel === 'whatsapp') {
        const payloadQuote = { ...quote, phone: recipientPhone };
        await sendWhatsApp(payloadQuote, downloadUrl);
        setSuccessMsg(`Quotation dispatched successfully via WhatsApp cell outbox directly!`);
      } else {
        await sendEmail(quote, downloadUrl, recipientEmail);
        setSuccessMsg(`Quotation dispatched successfully via standard professional B2B SMTP!`);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-md flex flex-col space-y-4 max-w-sm w-full font-sans">
      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
        <div>
          <h4 className="text-sm font-bold text-slate-900 tracking-tight">Direct B2B Dispatcher</h4>
          <p className="text-[10px] text-slate-400 font-mono">Quotes Sheet: #{quote.quoteNumber}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {successMsg ? (
        <div className="space-y-4 py-3 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 border border-emerald-200">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800">Transmission Authorized</p>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-2">{successMsg}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase py-2 rounded-lg cursor-pointer"
          >
            Finished
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-4">
          
          {/* Channel Select tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setChannel('whatsapp')}
              className={`py-1.5 rounded-md font-bold uppercase text-[10px] tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                channel === 'whatsapp'
                  ? 'bg-white text-emerald-700 shadow-3xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>WhatsApp BSP</span>
            </button>

            <button
              type="button"
              onClick={() => setChannel('email')}
              className={`py-1.5 rounded-md font-bold uppercase text-[10px] tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                channel === 'email'
                  ? 'bg-white text-sky-700 shadow-3xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Mail className="h-4 w-4" />
              <span>Professional Email</span>
            </button>
          </div>

          {/* Form parameters */}
          {channel === 'whatsapp' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase font-mono text-slate-400">Recipient Phone Dialcell</label>
              <input
                type="text"
                required
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. 91xxxxxxxx"
                className="w-full border border-slate-205 rounded-xl px-3 py-2 text-xs font-mono"
              />
              <p className="text-[9px] text-slate-400 leading-tight">
                Will dispatch dynamic WhatsApp greeting attaching the secure host link.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase font-mono text-slate-400">Client Inbox Email Address</label>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="procurement@clientcorp.com"
                className="w-full border border-slate-205 rounded-xl px-3 py-2 text-xs"
              />
              <p className="text-[9px] text-slate-400 leading-tight">
                Includes B2B invoice-level styling, item list subtotal references & file linkage.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start bg-rose-50 border border-rose-100 rounded-lg p-2.5 gap-2 text-[10px] text-rose-700 font-medium">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Transmission Error</p>
                <p className="font-mono mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              channel === 'whatsapp'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Send className="h-4 w-4 text-sky-102" />
                <span>Transmit Quotation</span>
              </>
            )}
          </button>

        </form>
      )}
    </div>
  );
};
