// src/components/rfq-intake/IntakeWhatsAppChannel.tsx

import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  CheckCircle, 
  Phone, 
  User, 
  Building, 
  Layers, 
  Plus, 
  Trash2, 
  ArrowRight, 
  HelpCircle,
  Clock,
  Flame
} from 'lucide-react';
import { 
  parseWhatsAppInquiry, 
  ParsedInquiryResult, 
  SAMPLE_INTAKE_PRESETS 
} from '../../services/intakeParserService';
import { IntakeInquiry, RFQItem } from '../../types';

interface IntakeWhatsAppChannelProps {
  onQueueInquiry: (inquiry: Omit<IntakeInquiry, 'id' | 'tenantId' | 'receivedAt' | 'status'>) => Promise<void>;
  onDirectConvert: (inquiryData: any) => Promise<void>;
}

export const IntakeWhatsAppChannel: React.FC<IntakeWhatsAppChannelProps> = ({
  onQueueInquiry,
  onDirectConvert
}) => {
  const samplePreset = SAMPLE_INTAKE_PRESETS[1];
  
  const [senderPhone, setSenderPhone] = useState(samplePreset.sender);
  const [senderName, setSenderName] = useState('Nilesh Patil (Apex Piping)');
  const [chatMessage, setChatMessage] = useState(samplePreset.body);

  const [parsedResult, setParsedResult] = useState<ParsedInquiryResult | null>(() => {
    return parseWhatsAppInquiry(samplePreset.body, samplePreset.sender, 'Nilesh Patil');
  });

  const [parsing, setParsing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Parse handler
  const handleParse = () => {
    setParsing(true);
    setTimeout(() => {
      const res = parseWhatsAppInquiry(chatMessage, senderPhone, senderName);
      setParsedResult(res);
      setParsing(false);
    }, 200);
  };

  // Preset selector
  const handleSelectPreset = (text: string, phone: string, name: string) => {
    setChatMessage(text);
    setSenderPhone(phone);
    setSenderName(name);
    const res = parseWhatsAppInquiry(text, phone, name);
    setParsedResult(res);
  };

  // Add line item
  const handleAddLineItem = () => {
    if (!parsedResult) return;
    const newItem: RFQItem = {
      id: `item-wa-${Date.now()}`,
      name: 'Custom Fabricated Fitting / Flange',
      quantity: 50,
      specs: 'Material: Stainless Steel'
    };
    setParsedResult({
      ...parsedResult,
      items: [...parsedResult.items, newItem]
    });
  };

  const handleRemoveLineItem = (idx: number) => {
    if (!parsedResult) return;
    const updated = [...parsedResult.items];
    updated.splice(idx, 1);
    setParsedResult({
      ...parsedResult,
      items: updated
    });
  };

  const handleUpdateLineItem = (idx: number, field: keyof RFQItem, val: any) => {
    if (!parsedResult) return;
    const updated = [...parsedResult.items];
    updated[idx] = { ...updated[idx], [field]: val };
    setParsedResult({
      ...parsedResult,
      items: updated
    });
  };

  // Queue to Intake
  const handleQueue = async () => {
    if (!parsedResult) return;
    await onQueueInquiry({
      channel: 'WhatsApp',
      sourceIdentifier: senderPhone,
      subject: parsedResult.subject,
      rawContent: chatMessage,
      customerName: parsedResult.customerName,
      contactName: parsedResult.contactName,
      email: parsedResult.email,
      phone: parsedResult.phone,
      city: parsedResult.city,
      priority: parsedResult.priority,
      expectedDeliveryDate: parsedResult.expectedDeliveryDate,
      description: parsedResult.description,
      items: parsedResult.items,
      attachments: []
    });
    setActionSuccess('WhatsApp inquiry queued for sales estimation!');
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Direct convert to RFQ
  const handleDirectConvert = async () => {
    if (!parsedResult) return;
    await onDirectConvert({
      channel: 'WhatsApp',
      sourceIdentifier: senderPhone,
      subject: parsedResult.subject,
      rawContent: chatMessage,
      customerName: parsedResult.customerName,
      contactName: parsedResult.contactName,
      email: parsedResult.email,
      phone: parsedResult.phone,
      city: parsedResult.city,
      priority: parsedResult.priority,
      expectedDeliveryDate: parsedResult.expectedDeliveryDate,
      description: parsedResult.description,
      items: parsedResult.items,
      attachments: []
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">
                WhatsApp Business NLP Message Parser
              </h3>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                <span>AiSensy Live Webhook Connected</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically captures informal WhatsApp chat quotes, extracts part dimensions, quantities, and customer contact data.
            </p>
          </div>
        </div>

        {/* Quick Sample Inquiries Chips */}
        <div className="flex items-center flex-wrap gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase mr-1">Quick Scenarios:</span>
          <button
            type="button"
            onClick={() => handleSelectPreset(
              `Hi Anand sir, urgent quotation required for 100 pcs 4 inch SS 316 Slip-on Flanges 150# and 50 pcs 4 inch Long Radius 90 Deg Welded Elbows Schedule 40. Need dispatch to Turbhe Navi Mumbai by next Friday without delay. - Nilesh Patil, Apex Piping Solutions (Phone: 9880123456)`,
              '+91 9880123456',
              'Nilesh Patil'
            )}
            className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
          >
            Piping Flanges
          </button>
          <button
            type="button"
            onClick={() => handleSelectPreset(
              `Sir urgent quote for 500 nos M20 Eye Bolts DIN 580 forged steel and 250 nos Grade 80 Shackles 3.25 Ton for our crane maintenance at Bhosari. Please send PDF quote on this WhatsApp ASAP. - Vikram Joshi, Precision Cranes Pune (9823456789)`,
              '+91 9823456789',
              'Vikram Joshi'
            )}
            className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
          >
            Forged Hardware
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-mono flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main 2-Column Parser Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: WhatsApp Chat Transcript Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-3.5 shadow-3xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <span>WhatsApp Message Transcript</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                Direct Chat Feed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  Sender Phone No.
                </label>
                <input
                  type="text"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                  placeholder="+91 9880123456"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  Sender Profile Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                  placeholder="Nilesh Patil"
                />
              </div>
            </div>

            {/* Chat bubble simulator */}
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Incoming Customer Message
              </label>
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg space-y-2">
                <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-3xs space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-emerald-700 font-mono font-bold pb-1 border-b border-emerald-100">
                    <span>{senderName || 'Customer'} ({senderPhone})</span>
                    <span>Just Now</span>
                  </div>
                  <textarea
                    rows={6}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="w-full text-xs font-sans text-slate-800 bg-transparent border-none p-0 focus:ring-0 resize-none leading-relaxed"
                    placeholder="Type or paste WhatsApp message text here..."
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleParse}
              disabled={parsing}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{parsing ? 'Parsing Natural Language...' : 'Parse WhatsApp Inquiry'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Extracted Entities & Structured RFQ */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-3xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block leading-none">
                  NLP Extractor Output
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">
                  Extracted RFQ Line Items
                </h4>
              </div>

              {parsedResult && (
                <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded text-[11px] font-mono font-bold">
                  <span>Confidence: {parsedResult.confidenceScore}%</span>
                </div>
              )}
            </div>

            {parsedResult ? (
              <div className="space-y-4">
                
                {/* Identified Identity Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Customer Company</span>
                    <span className="font-bold text-slate-800 font-sans text-sm flex items-center space-x-1 mt-0.5">
                      <Building className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span>{parsedResult.customerName}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Contact Person</span>
                    <span className="font-medium text-slate-700 flex items-center space-x-1 mt-0.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{parsedResult.contactName}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">WhatsApp Phone Number</span>
                    <span className="font-mono text-slate-700 mt-0.5 flex items-center space-x-1">
                      <Phone className="h-3 w-3 text-emerald-600" />
                      <span>{parsedResult.phone}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Plant / Delivery City</span>
                    <span className="font-mono text-slate-700 mt-0.5">
                      📍 {parsedResult.city}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Priority</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase mt-1 ${
                      parsedResult.priority === 'High' 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {parsedResult.priority === 'High' ? '🔥 High Urgency' : 'Standard Priority'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Source Channel</span>
                    <span className="font-mono text-emerald-700 font-bold mt-0.5 block">
                      WhatsApp Messaging API
                    </span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center space-x-1">
                      <Layers className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Parsed Parts & Quantities ({parsedResult.items.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-2 py-1 text-[10px] font-mono font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 rounded border border-emerald-200 flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Part</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold">#</th>
                          <th className="py-2 px-3 font-semibold">Item Specification</th>
                          <th className="py-2 px-3 font-semibold w-24">Quantity</th>
                          <th className="py-2 px-3 font-semibold">Material / Notes</th>
                          <th className="py-2 px-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {parsedResult.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateLineItem(idx, 'name', e.target.value)}
                                className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-slate-800 text-xs"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleUpdateLineItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                                className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800 text-xs"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                              <input
                                type="text"
                                value={item.specs || ''}
                                onChange={(e) => handleUpdateLineItem(idx, 'specs', e.target.value)}
                                className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-500 text-xs"
                                placeholder="Specs, Grade, Finish"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Diagnostics notes */}
                {parsedResult.parsingNotes.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-500 space-y-1">
                    <span className="font-bold text-slate-600 uppercase text-[9px] block">Parser Intelligence:</span>
                    {parsedResult.parsingNotes.map((note, idx) => (
                      <p key={idx}>✓ {note}</p>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleQueue}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-all"
                  >
                    Save to Inbound Queue
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectConvert}
                    className="w-full sm:w-auto px-5 py-2 text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
                  >
                    <span>Create Formal RFQ Record</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs font-mono">
                Click "Parse WhatsApp Inquiry" to extract structured parts and buyer details.
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
