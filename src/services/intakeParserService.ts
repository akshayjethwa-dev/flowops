// src/services/intakeParserService.ts

import { RFQItem, IntakeAttachment, IntakeChannel } from '../types';

export interface ParsedInquiryResult {
  customerName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  gstNumber?: string;
  subject: string;
  priority: 'Low' | 'Medium' | 'High';
  expectedDeliveryDate?: string;
  description: string;
  items: RFQItem[];
  attachments: IntakeAttachment[];
  confidenceScore: number; // 0 to 100
  parsingNotes: string[];
}

/**
 * Clean phone numbers to Indian 10-digit format or international standard
 */
export function cleanPhoneNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits;
  return rawPhone.trim();
}

/**
 * Infer Company Name from domain or signature text
 */
function inferCompanyFromDomain(email: string): string {
  if (!email || !email.includes('@')) return '';
  const domain = email.split('@')[1].toLowerCase();
  const genericDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com'];
  if (genericDomains.includes(domain)) return '';
  
  // E.g. "tatamotors.com" -> "Tata Motors"
  const namePart = domain.split('.')[0];
  return namePart
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ' Pvt Ltd';
}

/**
 * Deterministic Email Parsing Engine
 */
export function parseEmailInquiry(
  rawEmail: string,
  meta?: {
    from?: string;
    subject?: string;
    date?: string;
    attachments?: IntakeAttachment[];
  }
): ParsedInquiryResult {
  const notes: string[] = [];
  const lines = rawEmail.split('\n').map(l => l.trim()).filter(Boolean);

  let fromHeader = meta?.from || '';
  let subject = meta?.subject || '';
  let emailBody = rawEmail;

  // Extract headers if present in raw text
  for (const line of lines) {
    if (line.toLowerCase().startsWith('from:') && !fromHeader) {
      fromHeader = line.slice(5).trim();
    } else if (line.toLowerCase().startsWith('subject:') && !subject) {
      subject = line.slice(8).trim();
    }
  }

  // Parse contact name and email from "Name <email@domain.com>"
  let contactName = '';
  let emailAddress = '';
  if (fromHeader) {
    const match = fromHeader.match(/([^<]+)?<([^>]+)>/);
    if (match) {
      contactName = match[1]?.trim().replace(/^["']|["']$/g, '') || '';
      emailAddress = match[2]?.trim() || '';
    } else if (fromHeader.includes('@')) {
      emailAddress = fromHeader.trim();
      contactName = emailAddress.split('@')[0].replace(/[._-]/g, ' ');
    }
  } else {
    // Search body for email
    const emailMatch = rawEmail.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      emailAddress = emailMatch[0];
    }
  }

  // Extract phone number
  let phone = '';
  const phoneMatch = rawEmail.match(/(?:\+?91[\s-]?)?[6-9]\d{9}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
  if (phoneMatch) {
    phone = cleanPhoneNumber(phoneMatch[0]);
    notes.push(`Detected phone number: ${phone}`);
  }

  // Infer customer company name
  let customerName = inferCompanyFromDomain(emailAddress);
  const companyPattern = /(?:M\/s\.?|Company:|Company Name:|Firm:|Customer:)\s*([A-Za-z0-9\s&.,'-]{3,50})/i;
  const compMatch = rawEmail.match(companyPattern);
  if (compMatch && compMatch[1]) {
    customerName = compMatch[1].trim();
  }

  if (!customerName) {
    // Check subject for company name prefix e.g. "[L&T] RFQ for Valves"
    const subBracket = subject.match(/\[(.*?)\]/);
    if (subBracket && subBracket[1] && subBracket[1].length > 2) {
      customerName = subBracket[1].trim();
    } else if (contactName) {
      customerName = `${contactName} Enterprises`;
    } else {
      customerName = 'Commercial Buyer';
    }
  }

  // City inference (common Indian industrial hubs)
  let city = 'Pune';
  const indianCities = [
    'Pune', 'Mumbai', 'Ahmedabad', 'Bengaluru', 'Bangalore', 'Chennai', 
    'Hyderabad', 'Delhi', 'Gurugram', 'Gurgaon', 'Noida', 'Faridabad', 
    'Jamshedpur', 'Coimbatore', 'Surat', 'Vadodara', 'Rajkot', 'Nashik', 
    'Aurangabad', 'Kolhapur', 'Indore', 'Bhopal', 'Nagpur', 'Ludhiana', 'Jaipur'
  ];
  for (const c of indianCities) {
    const cityRegex = new RegExp(`\\b${c}\\b`, 'i');
    if (cityRegex.test(rawEmail) || (subject && cityRegex.test(subject))) {
      city = c;
      notes.push(`Identified industrial plant city: ${c}`);
      break;
    }
  }

  // Priority check
  let priority: 'Low' | 'Medium' | 'High' = 'Medium';
  const urgentKeywords = ['urgent', 'asap', 'immediate', 'emergency', 'critical', 'high priority', 'today', '24 hrs', 'within 2 days'];
  if (urgentKeywords.some(kw => subject.toLowerCase().includes(kw) || rawEmail.toLowerCase().includes(kw))) {
    priority = 'High';
    notes.push('Flagged High Priority based on urgency keywords in email text.');
  }

  // Delivery date extraction (e.g. "delivery by 2026-10-25" or "delivery required: 25 Oct")
  let expectedDeliveryDate = '';
  const datePattern = /(?:delivery\s*(?:by|date|required|before)?[:\s]*)(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,4})/i;
  const dateMatch = rawEmail.match(datePattern);
  if (dateMatch && dateMatch[1]) {
    try {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        expectedDeliveryDate = parsed.toISOString().split('T')[0];
        notes.push(`Extracted delivery target: ${expectedDeliveryDate}`);
      }
    } catch {
      // ignore parse err
    }
  }

  // Extract Line Items
  const items: RFQItem[] = [];
  
  // 1. Table or bulleted items extraction (e.g. "1. Part Name - Qty: 50 - Grade SS304" or "50 pcs Spur Gear EN8")
  const linesToScan = emailBody.split('\n');
  let currentItemIdx = 1;

  for (const line of linesToScan) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;

    // Pattern A: "50 nos / 50 pcs / Qty: 50" followed by part name and specs
    const qtyLeadPattern = /(?:^[-*•\d.]*\s*)?(?:(\d+)\s*(?:nos|pcs|units|sets|mtrs|kg|pieces))\s*(?:[-:–]\s*)?([A-Za-z0-9\s()/"'#.-]+)/i;
    // Pattern B: "Part Name: ... Qty: 50 ... Specs: ..."
    const keyValPattern = /(?:item|part|desc|description):\s*([^|\n,;]+).*?(?:qty|quantity):\s*(\d+)(?:.*?(?:specs|grade|material):\s*([^|\n,;]+))?/i;
    // Pattern C: "1. Flange 4 inch Class 150 - Qty: 200"
    const standardPattern = /(?:^[-*•\d.]*\s*)([A-Za-z0-9\s()/"'#.-]{4,60})\s*[-:–|]\s*(?:qty|quantity:?)?\s*(\d+)\s*(?:nos|pcs|units)?(?:\s*[-:–|]\s*(.+))?/i;

    let matched = false;

    const matchB = trimmed.match(keyValPattern);
    if (matchB) {
      const name = matchB[1].trim();
      const qty = parseInt(matchB[2], 10);
      const specs = matchB[3] ? matchB[3].trim() : '';
      if (name && qty > 0) {
        items.push({
          id: `item-${Date.now()}-${currentItemIdx++}`,
          name,
          quantity: qty,
          specs: specs || undefined
        });
        matched = true;
      }
    }

    if (!matched) {
      const matchA = trimmed.match(qtyLeadPattern);
      if (matchA) {
        const qty = parseInt(matchA[1], 10);
        let remainder = matchA[2].trim();
        let specs = '';
        if (remainder.includes('-') || remainder.includes('|')) {
          const parts = remainder.split(/[-|]/);
          remainder = parts[0].trim();
          specs = parts.slice(1).join(' ').trim();
        }
        if (remainder.length > 2 && qty > 0) {
          items.push({
            id: `item-${Date.now()}-${currentItemIdx++}`,
            name: remainder,
            quantity: qty,
            specs: specs || undefined
          });
          matched = true;
        }
      }
    }

    if (!matched) {
      const matchC = trimmed.match(standardPattern);
      if (matchC) {
        const name = matchC[1].trim();
        const qty = parseInt(matchC[2], 10);
        const specs = matchC[3] ? matchC[3].trim() : '';
        // Filter out false positives
        if (name && qty > 0 && !name.toLowerCase().includes('subject') && !name.toLowerCase().includes('phone')) {
          items.push({
            id: `item-${Date.now()}-${currentItemIdx++}`,
            name,
            quantity: qty,
            specs: specs || undefined
          });
        }
      }
    }
  }

  // If no items matched line by line, look for generic part in subject or body
  if (items.length === 0) {
    const cleanSubj = subject.replace(/^(re:|fwd:|urgent:?|rfq:?)\s*/gi, '').trim();
    items.push({
      id: `item-${Date.now()}-1`,
      name: cleanSubj || 'Custom Machined Components Lot',
      quantity: 1,
      specs: 'Refer to original email message and attachments for detailed specifications.'
    });
    notes.push('Created fallback line item based on email subject line.');
  } else {
    notes.push(`Successfully extracted ${items.length} line items from email body.`);
  }

  return {
    customerName,
    contactName: contactName || customerName.split(' ')[0],
    email: emailAddress,
    phone,
    city,
    subject: subject || 'Inquiry received via Email',
    priority,
    expectedDeliveryDate,
    description: emailBody.slice(0, 500),
    items,
    attachments: meta?.attachments || [],
    confidenceScore: items.length > 0 && emailAddress ? 88 : 70,
    parsingNotes: notes
  };
}

/**
 * Deterministic WhatsApp Message Parsing Engine
 */
export function parseWhatsAppInquiry(
  rawMessage: string,
  senderPhone?: string,
  senderName?: string
): ParsedInquiryResult {
  const notes: string[] = [];
  const text = rawMessage.trim();

  // Contact Phone
  let phone = senderPhone ? cleanPhoneNumber(senderPhone) : '';
  const inlinePhoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/);
  if (!phone && inlinePhoneMatch) {
    phone = cleanPhoneNumber(inlinePhoneMatch[0]);
    notes.push(`Detected phone number in chat: ${phone}`);
  }

  // Contact & Customer Name
  let contactName = senderName || '';
  let customerName = '';

  const signaturePattern = /(?:[-–—~]|Regards|From|Thanks|Contact:?)\s*([A-Za-z\s]{3,30})(?:[,\s]+([A-Za-z0-9\s&]{3,40}))?/i;
  const sigMatch = text.match(signaturePattern);
  if (sigMatch) {
    if (sigMatch[1]) contactName = sigMatch[1].trim();
    if (sigMatch[2]) customerName = sigMatch[2].trim();
  }

  if (!customerName) {
    if (contactName) {
      customerName = `${contactName} Fabricators`;
    } else if (phone) {
      customerName = `Client +91 ${phone.slice(-10)}`;
    } else {
      customerName = 'WhatsApp Business Lead';
    }
  }

  // City detection
  let city = 'Pune';
  const indianCities = [
    'Pune', 'Mumbai', 'Ahmedabad', 'Bengaluru', 'Bangalore', 'Chennai', 
    'Hyderabad', 'Delhi', 'Gurugram', 'Gurgaon', 'Noida', 'Faridabad', 
    'Jamshedpur', 'Coimbatore', 'Surat', 'Vadodara', 'Rajkot', 'Nashik', 
    'Chakan', 'Bhosari', 'Pimpri', 'MIDC'
  ];
  for (const c of indianCities) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(text)) {
      city = c;
      notes.push(`Identified city/hub: ${c}`);
      break;
    }
  }

  // Priority check
  let priority: 'Low' | 'Medium' | 'High' = 'Medium';
  if (/urgent|urgent rate|asap|today|immediately|critical/i.test(text)) {
    priority = 'High';
    notes.push('Marked as High Priority based on urgent request phrasing.');
  }

  // Items Extraction
  const items: RFQItem[] = [];
  // Typical WhatsApp pattern: "Need rate for 200 pcs 60mm dia EN19 forged round bars length 450mm"
  // or "50 nos SS 304 laser cut plates 10mm"
  const waItemPattern = /(?:need|require|quote for|rate for|want)?\s*(\d+)\s*(?:nos|pcs|units|pieces|sets|kg|mtrs)?\s*(?:of\s*)?([A-Za-z0-9\s()/"'#.-]{4,80})/gi;
  
  let match: RegExpExecArray | null;
  let idx = 1;
  while ((match = waItemPattern.exec(text)) !== null) {
    const qty = parseInt(match[1], 10);
    let desc = match[2].trim();
    // Stop at common sentence separators
    desc = desc.split(/(?:deliver|delivery|contact|thanks|regards|please|\.|\n)/i)[0].trim();
    
    if (desc.length > 3 && qty > 0) {
      let specs = '';
      if (desc.toLowerCase().includes('ss') || desc.toLowerCase().includes('en') || desc.toLowerCase().includes('grade') || desc.toLowerCase().includes('mm')) {
        specs = 'Extracted material/dimension specs from WhatsApp message.';
      }
      items.push({
        id: `wa-item-${Date.now()}-${idx++}`,
        name: desc,
        quantity: qty,
        specs: specs || undefined
      });
    }
  }

  // Fallback single item
  if (items.length === 0) {
    items.push({
      id: `wa-item-${Date.now()}-1`,
      name: text.length > 50 ? text.slice(0, 48) + '...' : text,
      quantity: 1,
      specs: 'Extracted from direct WhatsApp conversation.'
    });
    notes.push('Created consolidated line item from WhatsApp message text.');
  } else {
    notes.push(`Extracted ${items.length} line items from message.`);
  }

  return {
    customerName,
    contactName: contactName || 'Procurement Officer',
    email: `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@lead-inbox.com`,
    phone: phone || '9820011223',
    city,
    subject: `WhatsApp Inquiry: ${items[0]?.name || 'Custom Fabrication'}`,
    priority,
    description: text,
    items,
    attachments: [],
    confidenceScore: items.length > 0 ? 85 : 65,
    parsingNotes: notes
  };
}

/**
 * BOM Spreadsheet / CSV Parser Engine
 * Reads text content or CSV and extracts structured line items table
 */
export async function parseBOMFileContent(content: string, fileName: string): Promise<{ items: RFQItem[]; notes: string[] }> {
  const notes: string[] = [];
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: RFQItem[] = [];

  if (lines.length === 0) {
    return { items: [], notes: ['Uploaded file was empty.'] };
  }

  // Detect delimiter (comma, tab, semicolon, pipe)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes('|')) delimiter = '|';

  // Find header line
  let headerIndex = -1;
  let partNameCol = -1;
  let qtyCol = -1;
  let specsCol = -1;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    
    // Look for column names
    const pIdx = cols.findIndex(c => /item|part|name|description|product|component|material name/i.test(c));
    const qIdx = cols.findIndex(c => /qty|quantity|nos|count|units|pcs/i.test(c));
    const sIdx = cols.findIndex(c => /spec|specs|specification|grade|material|dimensions|size|finish|drawing/i.test(c));

    if (pIdx !== -1 || qIdx !== -1) {
      headerIndex = i;
      partNameCol = pIdx !== -1 ? pIdx : 0;
      qtyCol = qIdx !== -1 ? qIdx : 1;
      specsCol = sIdx !== -1 ? sIdx : 2;
      notes.push(`Detected BOM table headers at line ${i + 1}: Name col=${partNameCol + 1}, Qty col=${qtyCol + 1}`);
      break;
    }
  }

  // If no header found, default to col 0 as name, col 1 as qty, col 2 as specs
  if (headerIndex === -1) {
    headerIndex = 0;
    partNameCol = 0;
    qtyCol = 1;
    specsCol = 2;
    notes.push('Header row not identified with high confidence; using columns 1=Part Name, 2=Qty, 3=Specs.');
  }

  // Parse rows
  let rowCount = 0;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (rawCols.length === 0 || !rawCols[partNameCol]) continue;

    const name = rawCols[partNameCol];
    // Skip sub-headers or summary rows
    if (name.toLowerCase().includes('total') || name.toLowerCase().includes('subtotal')) continue;

    let qty = 1;
    if (qtyCol !== -1 && rawCols[qtyCol]) {
      const parsedQty = parseFloat(rawCols[qtyCol].replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedQty) && parsedQty > 0) {
        qty = parsedQty;
      }
    }

    let specs = '';
    if (specsCol !== -1 && rawCols[specsCol]) {
      specs = rawCols[specsCol];
    } else if (rawCols.length > 2) {
      // Gather additional columns as specs
      specs = rawCols.filter((_, idx) => idx !== partNameCol && idx !== qtyCol).join(' | ');
    }

    items.push({
      id: `bom-item-${Date.now()}-${rowCount++}`,
      name,
      quantity: Math.round(qty),
      specs: specs || undefined
    });
  }

  notes.push(`Parsed ${items.length} BOM line items from file "${fileName}".`);
  return { items, notes };
}

/**
 * Read browser File as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

/**
 * Pre-seeded realistic B2B inquiries for instant 1-click simulation
 */
export const SAMPLE_INTAKE_PRESETS = [
  {
    channel: 'Email' as IntakeChannel,
    label: 'Mahindra Auto Tier-1 Vendor Inquiry',
    sender: 'Sanjay Deshmukh <s.deshmukh@mahindra-vendor.com>',
    subject: 'URGENT RFQ: Machined Transmission Flanges & EN8 Splined Shafts',
    body: `From: Sanjay Deshmukh <s.deshmukh@mahindra-vendor.com>
To: sales@ashreyflowops.com
Subject: URGENT RFQ: Machined Transmission Flanges & EN8 Splined Shafts
Date: 2026-10-06 09:30:00

Dear Sales Engineering Team,

Please provide your best commercial quotation and lead time for the following precision CNC machined components required for our Chakan Plant assembly line:

1. EN8 Precision Splined Drive Shaft (Dia 45mm x 320mm Length) - Qty: 250 nos - Material Grade: EN8 Normalized
2. Forged Alloy Companion Flange Class 300 (PCD 120mm) - Qty: 150 nos - Finish: Black Phosphated
3. M14 High-Tensile Wheel Hub Studs (Grade 10.9) - Qty: 1200 nos - Zinc Yellow Passivated

We need delivery in batches starting 25th October 2026 at our Pune Plant receiving dock.
Please confirm if material test certificates (MTC 3.1) and heat treat reports will be provided.

Kindly share quotation on your letterhead by end of day today as this is on critical path.

Warm Regards,
Sanjay Deshmukh
Senior Procurement Engineer | Mahindra & Mahindra Tier-1 Systems
MIDC Bhosari, Pune - 411026
Phone: +91 98220 54321 | s.deshmukh@mahindra-vendor.com`,
    mockAttachment: {
      id: 'att-1',
      name: 'Transmission_Shaft_Rev_C_Drawing.pdf',
      size: 428000,
      type: 'application/pdf',
      url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'
    }
  },
  {
    channel: 'WhatsApp' as IntakeChannel,
    label: 'Urgent Piping Fabrication WhatsApp Message',
    sender: '+91 9880123456',
    subject: 'WhatsApp RFQ: SS 316 Flanges & Elbows',
    body: `Hi Anand sir, urgent quotation required for 100 pcs 4 inch SS 316 Slip-on Flanges 150# and 50 pcs 4 inch Long Radius 90 Deg Welded Elbows Schedule 40. Need dispatch to Turbhe Navi Mumbai by next Friday without delay. Please quote urgently with GST & transport. - Nilesh Patil, Apex Piping Solutions (Phone: 9880123456)`
  },
  {
    channel: 'Web Form' as IntakeChannel,
    label: 'L&T Heavy Engineering Web Form with BOM Sheet',
    sender: 'p.rao@lt-heavy.com',
    subject: 'Web Inquiry: Heavy Foundation Baseplate Fabrication',
    body: `Company: Larsen & Toubro Heavy Engineering
Contact Person: P. V. Rao
Phone: 9845012345
Email: p.rao@lt-heavy.com
City: Vadodara
GSTIN: 24AAACL1234F1Z5
Project: Thermal Unit Baseframe Fabrication Lot 3
Notes: All weldments must adhere to ASME Section IX with 100% DPT and 20% Ultrasonic testing.`
  }
];
