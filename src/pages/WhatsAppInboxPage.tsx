// src/pages/WhatsAppInboxPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useWhatsAppConversations } from '../hooks/useWhatsAppConversations';
import { useConversationThread } from '../hooks/useConversationThread';
import { useTenantUsers } from '../hooks/useTenantUsers';
import { useCustomersList } from '../hooks/useCustomersList';
import { useRfqsList } from '../hooks/useRfqsList';
import { useServiceTickets } from '../hooks/useServiceTickets';
import { 
  MessageSquare, 
  Search, 
  Plus, 
  Send, 
  UserPlus, 
  Check, 
  CheckCheck, 
  Sparkles, 
  User, 
  Clock, 
  Phone, 
  FileText, 
  AlertCircle, 
  ArrowRight, 
  FileCode, 
  UserCheck, 
  Filter, 
  X,
  ChevronRight,
  Download,
  AlertTriangle,
  Lightbulb,
  CornerDownRight,
  RefreshCw
} from 'lucide-react';
import { WhatsAppConversation, WhatsAppMessage, Customer, RFQ } from '../types';

interface TemplateDef {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
}

const PRESET_TEMPLATES: TemplateDef[] = [
  {
    id: 't-1',
    name: 'order_status_welding',
    category: 'utility',
    body: 'Hi {{1}}, your order {{2}} has successfully entered the Welding process stage on our Shopfloor line.',
    variables: ['Customer Name', 'Order Number']
  },
  {
    id: 't-2',
    name: 'dispatch_alert',
    category: 'utility',
    body: 'Greetings {{1}}, we have dispatched order {{2}} via {{3}}. Consignment Tracking LR: {{4}}.',
    variables: ['Customer Name', 'Order Number', 'Transporter', 'LR Number']
  },
  {
    id: 't-3',
    name: 'rfq_acknowledgement',
    category: 'utility',
    body: 'Dear {{1}}, we have received your RFQ requirements for the Alloy Valve cast parts. Representative {{2}} will forward your costing schedule shortly.',
    variables: ['Customer Name', 'Sales Representative Name']
  }
];

export const WhatsAppInboxPage: React.FC = () => {
  const { tenant, profile } = useAuth();
  const tenantId = tenant?.id;

  // Hooks data
  const { 
    conversations, 
    loading: convsLoading, 
    error: convsError,
    assignSalesUser,
    updateStatus,
    markAsRead,
    matchCustomer,
    simulateInboundMessage
  } = useWhatsAppConversations(tenantId);

  const { users } = useTenantUsers(tenantId);
  const { customers, addCustomer } = useCustomersList(tenantId);
  const { addRfq } = useRfqsList(tenantId);
  const { tickets, addServiceTicket } = useServiceTickets(tenantId);

  // State Management
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'mine' | 'unassigned' | 'resolved'>('all');
  
  // Custom Outbound Text
  const [messageText, setMessageText] = useState('');
  
  // Webhook Simulator States
  const [showWebhookSimulator, setShowWebhookSimulator] = useState(false);
  const [simulatorPhone, setSimulatorPhone] = useState('+91 95000 12345');
  const [simulatorMessage, setSimulatorMessage] = useState('Please quote price for 100 units of carbon steel gate valves and dispatch by Friday.');
  const [simulatorMediaType, setSimulatorMediaType] = useState<'none' | 'image' | 'document'>('none');
  const [simulatorMediaUrl, setSimulatorMediaUrl] = useState('');
  const [simulatorMediaName, setSimulatorMediaName] = useState('');

  // Right Drawer Action State in Workspace Pane
  const [rightDrawerAction, setRightDrawerAction] = useState<
    'none' | 'convert_rfq' | 'convert_ticket' | 'match_customer' | 'create_customer' | 'dossier'
  >('none');

  // New RFQ Drawer Draft Form Variables
  const [rfqRequirementsText, setRfqRequirementsText] = useState('');
  const [rfqLoading, setRfqLoading] = useState(false);

  // New Service Ticket Drawer Draft Form Variables
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ticketAssignee, setTicketAssignee] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);

  // New Customer Form Draft Variables
  const [newCustName, setNewCustName] = useState('');
  const [newCustType, setNewCustType] = useState<'customer' | 'dealer'>('customer');
  const [newCustContact, setNewCustContact] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [customerModalLoading, setCustomerModalLoading] = useState(false);

  // Match existing customer selection
  const [selectedCustomerIdToMatch, setSelectedCustomerIdToMatch] = useState('');

  // Template Picker States
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDef | null>(null);
  const [templateVals, setTemplateVals] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Map active selection
  const selectedConv = conversations.find(c => c.id === selectedConvId);

  // Load message thread for active conversation
  const { 
    messages, 
    loading: messagesLoading, 
    sendMessage 
  } = useConversationThread(tenantId, selectedConvId || undefined, selectedConv);

  // Mark as read whenever selecting a conversation
  useEffect(() => {
    if (selectedConvId) {
      markAsRead(selectedConvId);
      setRightDrawerAction('dossier');
    } else {
      setRightDrawerAction('none');
    }
  }, [selectedConvId, markAsRead]);

  // Scroll viewport down on message receipt
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedConvId]);

  // Preset Template variable handler
  useEffect(() => {
    if (selectedTemplate) {
      const draftVals = selectedTemplate.variables.map(v => {
        if (v === 'Customer Name') {
          return selectedConv?.customerName || selectedConv?.phone || '';
        }
        if (v === 'Sales Representative Name') {
          return profile?.name || '';
        }
        return '';
      });
      setTemplateVals(draftVals);
    } else {
      setTemplateVals([]);
    }
  }, [selectedTemplate, selectedConv, profile]);

  // Filter conversations based on criteria
  const filteredConvs = conversations.filter(c => {
    // Search filter
    const matchesSearch = 
      c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.customerName && c.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Segment tab filters
    if (activeFilter === 'unread') return c.unreadCount > 0 || c.status === 'unread';
    if (activeFilter === 'mine') return c.assignedSalesUserId === profile?.uid;
    if (activeFilter === 'unassigned') return !c.assignedSalesUserId || c.status === 'unassigned';
    if (activeFilter === 'resolved') return c.status === 'resolved';

    // 'all' excludes 'resolved' conversations out-of-box to avoid clutter unless they search or explicitly view resolved
    return c.status !== 'resolved';
  });

  // Action: Assign Sales Representative
  const handleAssignMember = (userId: string) => {
    if (!selectedConvId) return;
    const user = users.find(u => u.id === userId);
    assignSalesUser(selectedConvId, userId, user?.name);
  };

  // Action: Send custom response text
  const handleSendCustom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanWord = messageText.trim();
    if (!cleanWord || !selectedConvId) return;
    
    await sendMessage(cleanWord);
    setMessageText('');
  };

  // Action: Send WhatsApp Template response
  const handleSendTemplate = async () => {
    if (!selectedConvId || !selectedTemplate) return;
    
    // Sub variables in body string
    let finalBody = selectedTemplate.body;
    templateVals.forEach((val, index) => {
      finalBody = finalBody.replace(`{{${index + 1}}}`, val || `__`);
    });

    await sendMessage(finalBody, selectedTemplate.name, templateVals);
    setSelectedTemplate(null);
    setShowTemplatePicker(false);
  };

  // Action: Convert WhatsApp raw message text to official Core RFQ
  const handleCreateRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv) return;

    setRfqLoading(true);
    try {
      // Find or assign customer tags
      const currentCustName = selectedConv.customerName || selectedConv.phone;
      
      const payload = {
        customerName: currentCustName,
        phone: selectedConv.phone,
        email: 'info@unmatched-whatsapp-contact.com',
        requirements: rfqRequirementsText,
        items: [
          {
            id: `item-${Date.now()}`,
            name: 'Valves Requested from Inbound Chat',
            quantity: 100,
            unit: 'units',
            specification: rfqRequirementsText
          }
        ],
        status: 'pending' as const,
        createdBy: profile?.uid || 'rep'
      };

      await addRfq(payload);
      
      // Update Conversation CRM Logs
      await sendMessage(`✅ [FlowOps CRM System Action] Inbound inquiry converted into formal RFQ: "${rfqRequirementsText.slice(0, 50)}...". Our technical costing estimators are analyzing stage limits.`);
      
      // Mark convo as active/acknowledged
      await updateStatus(selectedConv.id, 'active');
      
      setRfqRequirementsText('');
      setRightDrawerAction('none');
    } catch (err) {
      console.error(err);
    } finally {
      setRfqLoading(false);
    }
  };

  // Action: Convert WhatsApp message to Service Support Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv) return;

    setTicketLoading(true);
    try {
      // Find assignee display name using id comparison only
      const assigneeObj = users.find(u => u.id === ticketAssignee);
      const created = await addServiceTicket({
        customerId: selectedConv.customerId || undefined,
        customerName: selectedConv.customerName || selectedConv.phone,
        phone: selectedConv.phone,
        subject: ticketSubject,
        description: ticketDescription,
        priority: ticketPriority,
        status: 'open',
        assignedUserId: ticketAssignee || undefined,
        assignedUserName: assigneeObj?.name || undefined,
        conversationId: selectedConv.id
      });
      
      if (created) {
        // Update Conversation CRM Logs
        await sendMessage(`🎫 [FlowOps Ticket System Action] Incoming alert converted into Support Ticket ${created.id}: "${ticketSubject}". Priority: ${ticketPriority.toUpperCase()}. Assigned to: ${assigneeObj?.name || 'Unassigned'}.`);
        
        // Mark convo as active/acknowledged
        await updateStatus(selectedConv.id, 'active');
      }

      setTicketSubject('');
      setTicketDescription('');
      setTicketPriority('medium');
      setTicketAssignee('');
      setRightDrawerAction('dossier');
    } catch (err) {
      console.error(err);
    } finally {
      setTicketLoading(false);
    }
  };

  // Action: Create full customer profile and match
  const handleCreateCustomerAndMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv) return;
    setCustomerModalLoading(true);

    try {
      const created = await addCustomer({
        name: newCustName,
        type: newCustType,
        contactPerson: newCustContact,
        phone: newCustPhone,
        email: newCustEmail,
        city: newCustCity,
        billingAddress: `${newCustCity}, India`,
        shippingAddress: `${newCustCity}, India`,
        tags: [newCustType === 'dealer' ? 'Dealer Channel' : 'Direct Industry'],
        notes: `Profile created from incoming WhatsApp thread: ${selectedConv.phone}`
      });

      if (created.id) {
        await matchCustomer(selectedConv.id, created.id, created.name);
        await sendMessage(`👤 [FlowOps CRM System] Associated WhatsApp contact ${selectedConv.phone} with new ${newCustType} profile: "${created.name}".`);
      }

      setRightDrawerAction('none');
    } catch (err) {
      console.error(err);
    } finally {
      setCustomerModalLoading(false);
    }
  };

  // Action: Match WhatsApp with existing customer
  const handleMatchExistingCustomer = async () => {
    if (!selectedConv || !selectedCustomerIdToMatch) return;
    
    const matched = customers.find(c => c.id === selectedCustomerIdToMatch);
    if (!matched) return;

    await matchCustomer(selectedConv.id, matched.id || '', matched.name);
    await sendMessage(`👤 [FlowOps CRM System] Linked WhatsApp channel to existing client record: "${matched.name}". All live interaction timelines are synchronized.`);
    
    setRightDrawerAction('none');
  };

  // Action: Trigger Webhook inbound simulator
  const handleSimulatorTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let mediaPayload: any = undefined;
    if (simulatorMediaType === 'image') {
      mediaPayload = {
        url: simulatorMediaUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=60',
        type: 'image',
        name: simulatorMediaName || 'casting_defect_reference.jpg'
      };
    } else if (simulatorMediaType === 'document') {
      mediaPayload = {
        url: simulatorMediaUrl || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        type: 'document',
        name: simulatorMediaName || 'B2B_Gate_Valve_Inquiry_Specs.pdf'
      };
    }

    await simulateInboundMessage(simulatorPhone, simulatorMessage, mediaPayload);
    
    // Reset simulator inputs
    setSimulatorMessage('');
    setSimulatorMediaType('none');
    setSimulatorMediaUrl('');
    setSimulatorMediaName('');
    setShowWebhookSimulator(false);
  };

  // Preset quick inbound simulators
  const applyPresetSimulator = (type: 'rfq' | 'service') => {
    if (type === 'rfq') {
      setSimulatorPhone('+91 93005 60100');
      setSimulatorMessage('Please send us quotes for 500 units high-pressure gate valves class 150 flanged type immediately.');
    } else if (type === 'service') {
      setSimulatorPhone('+91 94440 22110');
      setSimulatorMessage('Hi FlowOps team, the dispatch boxes arrived but box 3 is completely damaged on bottom. Forwarding image.');
      setSimulatorMediaType('image');
      setSimulatorMediaUrl('https://images.unsplash.com/photo-1549490349-8643362247b5?w=800&auto=format&fit=crop&q=60');
      setSimulatorMediaName('damaged_crates_express.jpg');
    }
  };

  // Trigger default RFQ requirements text when opening Convert to RFQ drawer
  useEffect(() => {
    if (rightDrawerAction === 'convert_rfq' && selectedConv) {
      const activeInboundMsg = messages.filter(m => m.direction === 'inbound').slice(-1)[0]?.message || selectedConv.lastMessage;
      setRfqRequirementsText(activeInboundMsg);
    }
  }, [rightDrawerAction, selectedConv, messages]);

  // Trigger default Phone field value when creating customer
  useEffect(() => {
    if (rightDrawerAction === 'create_customer' && selectedConv) {
      setNewCustPhone(selectedConv.phone);
      setNewCustName('');
      setNewCustContact('');
      setNewCustEmail('');
      setNewCustCity('');
    }
  }, [rightDrawerAction, selectedConv]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* 1. Header Banner / Simulator Trigger Desk */}
      <header className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white font-display uppercase">WhatsApp CRM Terminal</h1>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wider">
              {conversations.length} Active Feeds • {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)} Unread Conversations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Webhook simulator trigger button */}
          <button
            onClick={() => setShowWebhookSimulator(!showWebhookSimulator)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wide flex items-center space-x-1.5 transition-all cursor-pointer ${
              showWebhookSimulator 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simulate Inbound Webhook</span>
          </button>
        </div>
      </header>

      {/* 1b. Inbound Webhook Simulator Slide Panel */}
      <AnimatePresence>
        {showWebhookSimulator && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 border-b border-slate-800 p-5 overflow-hidden text-xs shrink-0 select-none"
          >
            <form onSubmit={handleSimulatorTrigger} className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-mono text-[10px] text-amber-400 uppercase font-bold tracking-widest">
                    AI Studio Webhook Request Playroom (POST /webhook/whatsapp)
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => applyPresetSimulator('rfq')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-755 text-[10px] font-mono text-slate-300 border border-slate-700 rounded cursor-pointer"
                  >
                    Preset: RFQ Request
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetSimulator('service')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-755 text-[10px] font-mono text-slate-300 border border-slate-700 rounded cursor-pointer"
                  >
                    Preset: Damaged Consignment
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Sender WhatsApp Number</label>
                  <input
                    type="text"
                    required
                    value={simulatorPhone}
                    onChange={(e) => setSimulatorPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-amber-500/50 text-xs font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Inbound Message Body Text</label>
                  <input
                    type="text"
                    required
                    value={simulatorMessage}
                    onChange={(e) => setSimulatorMessage(e.target.value)}
                    placeholder="Dealer / Client query..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-amber-500/50 text-xs"
                  />
                </div>
              </div>

              {/* Attachments for simulator */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/40 p-3 rounded border border-slate-800/40">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Simulated Media Attachment</label>
                  <select
                    value={simulatorMediaType}
                    onChange={(e) => setSimulatorMediaType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs"
                  >
                    <option value="none">No Attachment</option>
                    <option value="image">Image Preview (.jpg, .png)</option>
                    <option value="document">Document Attachment (.pdf, .xls)</option>
                  </select>
                </div>
                {simulatorMediaType !== 'none' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Media File Name</label>
                      <input
                        type="text"
                        value={simulatorMediaName}
                        onChange={(e) => setSimulatorMediaName(e.target.value)}
                        placeholder="e.g. valve_spec.pdf"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Direct Image/Doc URL (Optional)</label>
                      <input
                        type="text"
                        value={simulatorMediaUrl}
                        onChange={(e) => setSimulatorMediaUrl(e.target.value)}
                        placeholder="Leave blank for automatic sample asset link"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-[10px]"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowWebhookSimulator(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white font-mono uppercase text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono font-bold uppercase rounded text-[10px] cursor-pointer"
                >
                  Post Webhook Event ⚡
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Main Workspace Split Panel */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        
        {/* Left Side Pane: Conversation Thread Roster */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col shrink-0">
          
          {/* Hunt query controls */}
          <div className="p-3 border-b border-slate-800 space-y-2 shrink-0 select-none">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contact, chats..."
                className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-emerald-500/45 placeholder-slate-600"
              />
            </div>

            {/* Quick Segment tabs */}
            <div className="flex flex-wrap gap-1">
              {(['all', 'unread', 'mine', 'unassigned', 'resolved'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase transition-colors shrink-0 cursor-pointer ${
                    activeFilter === tab 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Roster entries viewport list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
            {convsLoading ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500 animate-pulse uppercase">
                Syncing WhatsApp Roster...
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2 select-none">
                <AlertCircle className="h-5 w-5 text-slate-600 mx-auto" />
                <p className="text-xs font-mono uppercase tracking-tight">No conversations found</p>
                <p className="text-[10px] text-slate-600">Try matching filters or clear research queries.</p>
              </div>
            ) : (
              filteredConvs.map(conv => {
                const isSelected = conv.id === selectedConvId;
                const hasUnread = conv.unreadCount > 0;
                
                // Get relative timing
                let ageStr = '';
                if (conv.lastTimestamp) {
                  const ms = Date.now() - new Date(conv.lastTimestamp).getTime();
                  const mins = Math.max(1, Math.floor(ms / 60000));
                  if (mins < 60) ageStr = `${mins}m ago`;
                  else {
                    const hours = Math.floor(mins / 60);
                    if (hours < 24) ageStr = `${hours}h ago`;
                    else ageStr = new Date(conv.lastTimestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  }
                }

                // Check assigned representative name
                const assignedRep = users.find(u => u.id === conv.assignedSalesUserId);

                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-3.5 flex flex-col space-y-1.5 transition-all cursor-pointer relative select-none ${
                      isSelected 
                        ? 'bg-slate-800/40 border-l-2 border-emerald-500 pl-3' 
                        : 'hover:bg-slate-900/30'
                    }`}
                  >
                    {/* Top Row: Contact Identity & Unread badge */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 max-w-[80%] flex items-center space-x-1.5">
                        {conv.customerId ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" title="Linked CRM Profile" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" title="Unmatched Number" />
                        )}
                        <h4 className="text-xs font-display font-semibold truncate text-slate-200">
                          {conv.customerName || conv.phone}
                        </h4>
                      </div>
                      
                      <div className="text-[9px] font-mono text-slate-500 shrink-0">
                        {ageStr}
                      </div>
                    </div>

                    {/* Middle Row: Message preview snapshot */}
                    <div className="flex items-start justify-between">
                      <p className={`text-[11px] truncate max-w-[85%] ${hasUnread ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                        {conv.lastMessage}
                      </p>
                      
                      {hasUnread && (
                        <span className="h-4.5 min-w-4.5 px-1 bg-emerald-500 text-slate-950 font-bold text-[9px] rounded-full flex items-center justify-center font-mono">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Tags and assigned liaison */}
                    <div className="flex items-center justify-between pt-1 text-[9px] font-mono text-slate-550 select-none">
                      <div className="flex items-center space-x-1">
                        {assignedRep ? (
                          <span className="flex items-center space-x-0.5 bg-sky-500/10 text-sky-400 px-1 rounded border border-sky-500/15">
                            <UserCheck className="h-2.5 w-2.5 text-sky-400" />
                            <span>{assignedRep.name.split(' ')[0]}</span>
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-500 px-1 rounded">
                            UNASSIGNED
                          </span>
                        )}

                        {conv.status === 'resolved' && (
                          <span className="bg-amber-500/10 text-amber-400 px-1 rounded border border-amber-500/15 font-bold uppercase text-[8px]">
                            RESOLVED
                          </span>
                        )}
                      </div>
                      
                      <span className="text-[9px] text-slate-500 truncate max-w-[40%]">
                        {conv.phone}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Middle Pane: Conversation Threads, quick text replies */}
        <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
          {selectedConv ? (
            <>
              {/* Active Conversation Header Details */}
              <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 select-none">
                <div className="min-w-0 flex items-center space-x-3.5">
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <User className="h-4.5 w-4.5 text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xs font-bold text-slate-200 truncate">
                        {selectedConv.customerName || selectedConv.phone}
                      </h2>
                      {selectedConv.customerId ? (
                        <span className="bg-sky-500/10 text-sky-400 text-[8px] font-mono px-1 py-0.5 rounded border border-sky-500/15">
                          B2B CUSTOMER
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 text-[8px] font-mono px-1 py-0.5 rounded border border-amber-500/15 animate-pulse">
                          UNMATCHED SENDER
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 py-0.5">
                      <Phone className="h-3 w-3 text-slate-500" />
                      <p className="text-[9px] font-mono text-slate-500 leading-none">{selectedConv.phone}</p>
                    </div>
                  </div>
                </div>

                {/* Assignment & Entity Actions Toolbar */}
                <div className="flex items-center space-x-2">
                  
                  {/* Status Controller */}
                  <select
                    value={selectedConv.status}
                    onChange={(e) => updateStatus(selectedConv.id, e.target.value as any)}
                    className="bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-300 text-[9px] font-mono uppercase px-2 py-1 rounded focus:outline-hidden cursor-pointer"
                  >
                    <option value="unread">Unread Feed</option>
                    <option value="active">Active Liaison</option>
                    <option value="unassigned">Unassigned Feed</option>
                    <option value="resolved">Mark Resolved</option>
                  </select>

                  {/* Liaison Assignee Dropdown */}
                  <div className="flex items-center space-x-1">
                    <select
                      value={selectedConv.assignedSalesUserId || ''}
                      onChange={(e) => handleAssignMember(e.target.value)}
                      className="bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-300 text-[9px] font-mono uppercase px-2 py-1 rounded focus:outline-hidden cursor-pointer"
                    >
                      <option value="">Liaison: Assign Rep</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>Assign: {u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dossier Toggle Trigger */}
                  <button
                    onClick={() => setRightDrawerAction(rightDrawerAction === 'dossier' ? 'none' : 'dossier')}
                    className={`font-mono text-[9px] uppercase px-2.5 py-1 rounded transition-all flex items-center space-x-1 cursor-pointer select-none border border-slate-700 ${
                      rightDrawerAction === 'dossier'
                        ? 'bg-sky-600 border-sky-500 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                    }`}
                    title="View Customer Dossier and Connected Tickets"
                  >
                    <span>Dossier 📋</span>
                  </button>

                  {/* Convert to RFQ Trigger */}
                  <button
                    onClick={() => setRightDrawerAction(rightDrawerAction === 'convert_rfq' ? 'none' : 'convert_rfq')}
                    className={`font-mono font-bold text-[9px] uppercase px-2.5 py-1 rounded transition-all flex items-center space-x-1 cursor-pointer select-none ${
                      rightDrawerAction === 'convert_rfq'
                        ? 'bg-emerald-500 border border-emerald-400 text-slate-950'
                        : 'bg-emerald-600 text-slate-950 hover:bg-emerald-500'
                    }`}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Convert to RFQ</span>
                  </button>

                  {/* Convert to Service Ticket Trigger */}
                  <button
                    onClick={() => setRightDrawerAction(rightDrawerAction === 'convert_ticket' ? 'none' : 'convert_ticket')}
                    className={`font-mono font-bold text-[9px] uppercase px-2.5 py-1 rounded transition-all flex items-center space-x-1 cursor-pointer select-none ${
                      rightDrawerAction === 'convert_ticket'
                        ? 'bg-rose-500 border border-rose-450 text-white'
                        : 'bg-rose-600 text-white hover:bg-rose-500'
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span>Convert to Ticket</span>
                  </button>

                  {/* Contact Matching triggers */}
                  {!selectedConv.customerId ? (
                    <button
                      onClick={() => setRightDrawerAction(rightDrawerAction === 'match_customer' ? 'none' : 'match_customer')}
                      className={`font-mono text-[9px] uppercase px-2.5 py-1 rounded transition-all flex items-center space-x-1 cursor-pointer select-none border border-slate-700 ${
                        rightDrawerAction === 'match_customer'
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : 'bg-slate-800 text-sky-400 hover:bg-slate-750'
                      }`}
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>Link Profile</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-slate-800 text-slate-500 font-mono text-[9px] uppercase px-2 py-1 rounded border border-slate-850 cursor-not-allowed flex items-center space-x-0.5"
                    >
                      <UserCheck className="h-3 w-3" />
                      <span>Linked</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Viewport Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/70 pattern-grid">
                {messagesLoading ? (
                  <div className="text-center py-20 font-mono text-xs text-slate-500 uppercase animate-pulse">
                    Spooling message stream thread...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 font-mono text-xs z-10 select-none uppercase">
                    No logs recorded. Type or select template to initiate dialogue!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isInbound = msg.direction === 'inbound';
                    const sendingStatus = msg.status;
                    
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex flex-col max-w-[70%] ${isInbound ? 'mr-auto items-start' : 'ml-auto items-end'}`}
                      >
                        {/* Interactive Message Bubble */}
                        <div className={`p-3 rounded-lg border text-xs shadow-xs relative leading-relaxed ${
                          isInbound 
                            ? 'bg-slate-900 text-slate-100 border-slate-800' 
                            : 'bg-emerald-950/40 text-emerald-100 border-emerald-900/40'
                        }`}>
                          
                          {/* Message media attachments rendered inside bubble optionally */}
                          {msg.mediaUrl && (
                            <div className="mb-2.5 rounded overflow-hidden border border-slate-800 bg-slate-950 p-2 text-[11px] font-mono flex items-center space-x-3 max-w-full">
                              {msg.mediaType === 'image' ? (
                                <div className="space-y-1.5">
                                  <img 
                                    src={msg.mediaUrl} 
                                    alt="WhatsApp Attachment Preview" 
                                    className="max-h-48 rounded object-cover max-w-full hover:scale-105 transition-transform cursor-zoom-in"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span className="truncate max-w-[150px]">{msg.mediaName || 'image_preview.jpg'}</span>
                                    <a href={msg.mediaUrl} download referrerPolicy="no-referrer" target="_blank" className="text-emerald-400 hover:underline flex items-center space-x-0.5">
                                      <Download className="h-3 w-3" />
                                      <span>Save</span>
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2.5">
                                  <div className="w-8 h-8 rounded bg-rose-500/10 text-rose-400 flex items-center justify-center">
                                    <FileCode className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0 pr-2">
                                    <p className="font-semibold text-slate-300 truncate max-w-[150px]">{msg.mediaName || 'specification_docs.pdf'}</p>
                                    <span className="text-[9px] text-slate-500">Document PDF Attachment</span>
                                  </div>
                                  <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-305 transition-all p-1.5 rounded-full hover:bg-slate-900">
                                    <Download className="h-4.5 w-4.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Raw Message body */}
                          <p className="whitespace-pre-line leading-relaxed text-slate-200">{msg.message}</p>
                        </div>

                        {/* Metadata Tagline (Time, Direction checkmarks) */}
                        <div className="flex items-center space-x-1.5 mt-1 px-1 text-[9px] font-mono text-slate-500">
                          <span>{new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          
                          {!isInbound && (
                            <>
                              <span>•</span>
                              <span title={
                                sendingStatus === 'sent' ? 'Sent (Single Check)' :
                                sendingStatus === 'delivered' ? 'Delivered (Double Check)' :
                                sendingStatus === 'read' ? 'Read (Double Blue Ticks)' : 'Queueing'
                              }>
                                {sendingStatus === 'sent' && <Check className="h-3 w-3 text-slate-500" />}
                                {sendingStatus === 'delivered' && <CheckCheck className="h-3 w-3 text-slate-400" />}
                                {sendingStatus === 'read' && <CheckCheck className="h-3 w-3 text-emerald-400" />}
                                {sendingStatus === 'pending' && <Clock className="h-2.5 w-2.5 text-slate-600 animate-pulse" />}
                              </span>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Response bar and pre-defined quick tool pickers */}
              <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-2.5 shrink-0 select-none">
                
                {/* Template picker triggers */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-[11px] font-mono">
                    <span className="text-slate-500 uppercase">Quick Actions:</span>
                    <button
                      onClick={() => {
                        setShowTemplatePicker(!showTemplatePicker);
                        setSelectedTemplate(null);
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-755 hover:text-white text-slate-300 rounded border border-slate-700 text-[10px] flex items-center space-x-1 cursor-pointer"
                    >
                      <FileText className="h-3 w-3 text-emerald-400" />
                      <span>{showTemplatePicker ? 'Close Picker' : 'Send pre-approved Meta Template'}</span>
                    </button>
                  </div>
                  
                  <span className="text-[9.5px] font-mono text-slate-600">
                    Outbound channel routing protected via secure BSP microservices
                  </span>
                </div>

                {/* Expanded Template Select Config Desk */}
                {showTemplatePicker && (
                  <div className="bg-slate-950/80 p-3.5 rounded border border-slate-800 space-y-3">
                    {!selectedTemplate ? (
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-mono text-slate-500 font-bold tracking-wider">Select Pre-Approved Meta Outbound Template</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {PRESET_TEMPLATES.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTemplate(t)}
                              className="p-2.5 bg-slate-900 hover:bg-slate-850 hover:border-emerald-600/35 border border-slate-800 rounded text-left flex flex-col space-y-1 cursor-pointer text-xs"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-mono text-[9px] text-emerald-400 font-bold uppercase truncate">{t.name}</span>
                                <span className="text-[8px] bg-slate-850 text-slate-400 px-1 rounded uppercase font-mono">{t.category}</span>
                              </div>
                              <p className="text-[10.5px] text-slate-400 line-clamp-2 leading-snug">{t.body}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="font-mono text-xs text-emerald-400 font-bold uppercase">Template Config: {selectedTemplate.name}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedTemplate(null)}
                            className="text-[10px] text-slate-400 hover:text-white uppercase font-mono cursor-pointer"
                          >
                            Back To Listing
                          </button>
                        </div>

                        {/* Rendering dynamic substitution inputs per selected template parameters */}
                        <div className="space-y-2.5">
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Substitute the variables in double brackets dynamically before sending to ensure delivery success.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {selectedTemplate.variables.map((valName, idx) => (
                              <div key={idx}>
                                <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">
                                  Variable `{`{{${idx+1}}}`}` ({valName})
                                </label>
                                <input
                                  type="text"
                                  value={templateVals[idx] || ''}
                                  onChange={(e) => {
                                    const copy = [...templateVals];
                                    copy[idx] = e.target.value;
                                    setTemplateVals(copy);
                                  }}
                                  placeholder={`Substitute variable...`}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-hidden focus:border-emerald-500/40"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="bg-slate-900 p-2.5 rounded border border-slate-800/45 text-[11px]">
                            <span className="font-mono text-[9px] text-slate-500 uppercase font-bold block mb-1">Dynamic Live Preview</span>
                            <p className="text-slate-350 italic leading-relaxed">
                              {selectedTemplate.body.split(/\{\{\d\}\}/).map((chunk, i) => (
                                <React.Fragment key={i}>
                                  {chunk}
                                  {i < selectedTemplate.variables.length && (
                                    <span className="text-emerald-400 font-bold underline px-0.5">
                                      {templateVals[i] || `[${selectedTemplate.variables[i]}]`}
                                    </span>
                                  )}
                                </React.Fragment>
                              ))}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedTemplate(null)}
                            className="px-3 py-1 text-slate-400 hover:text-white text-[10px] font-mono uppercase cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSendTemplate}
                            className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-[10px] uppercase rounded cursor-pointer"
                          >
                            Send Meta Template Delivery ⚡
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick keyboard typing input */}
                <form onSubmit={handleSendCustom} className="flex space-x-3.5">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Write a response to ${selectedConv.customerName || selectedConv.phone}...`}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className={`h-9 w-9 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      messageText.trim() 
                        ? 'bg-emerald-600 text-slate-950 hover:bg-emerald-500' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 select-none">
              <MessageSquare className="h-10 w-10 text-slate-700 animate-pulse mb-3" />
              <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Spooling Workspace</p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-sm text-center">
                Select a dealer or customer conversation thread in the left column to read transcripts, assign liaison engineers, or convert inquiries directly to core RFQs.
              </p>
            </div>
          )}
        </div>

        {/* Right Collapsible Drawer Sidebar: Quick forms panel */}
        <AnimatePresence>
          {rightDrawerAction !== 'none' && selectedConv && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 330, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="border-l border-slate-800 bg-slate-900/60 flex flex-col shrink-0 overflow-hidden text-xs"
            >
              <div className="p-4 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
                <div className="flex items-center space-x-2">
                  <CornerDownRight className="h-4 w-4 text-sky-400" />
                  <span className="font-mono text-[10px] text-sky-400 uppercase font-bold tracking-wider">
                    {rightDrawerAction === 'dossier' && 'Customer Dossier'}
                    {rightDrawerAction === 'convert_rfq' && 'Convert to RFQ'}
                    {rightDrawerAction === 'convert_ticket' && 'Convert to Ticket'}
                    {rightDrawerAction === 'match_customer' && 'Link CRM Profile'}
                    {rightDrawerAction === 'create_customer' && 'New CRM Profile'}
                  </span>
                </div>
                <button
                  onClick={() => setRightDrawerAction('none')}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Close sidebar desk"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sidebar View Switcher details */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* CHOICE 0: CUSTOMER DOSSIER DRAWER */}
                {rightDrawerAction === 'dossier' && (
                  <div className="space-y-4">
                    {/* Identification state */}
                    <div className="p-3 bg-slate-950 rounded border border-slate-850 space-y-2">
                      <span className="text-[9px] uppercase font-mono text-slate-550 font-bold tracking-wider block">CRM Profile Match</span>
                      {selectedConv.customerId ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-200">{selectedConv.customerName}</p>
                          <div className="flex items-center space-x-1.5 text-[9.5px] text-slate-400">
                            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/10 px-1 py-0.5 rounded font-mono uppercase text-[8px]">Matched B2B Client</span>
                            <span>Phone: {selectedConv.phone}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1.5 text-amber-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-semibold">Unregistered Inbound Number</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">
                            This caller is not associated with any profile. You can link this WhatsApp feed to an existing company profile or register a new one.
                          </p>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setRightDrawerAction('match_customer')}
                              className="py-1 bg-slate-900 hover:bg-slate-800 text-sky-400 text-[9px] font-mono uppercase border border-slate-800 rounded cursor-pointer"
                            >
                              Sync Profile 🔗
                            </button>
                            <button
                              type="button"
                              onClick={() => setRightDrawerAction('create_customer')}
                              className="py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 text-[9px] font-mono uppercase border border-slate-800 rounded cursor-pointer"
                            >
                              New Profile 👤
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Support Tickets Section */}
                    <div className="space-y-2 pb-1">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                        <span className="font-mono text-[9px] font-bold text-slate-405 uppercase tracking-wider block">Linked Support Tickets</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTicketSubject('');
                            setTicketDescription(selectedConv.lastMessage || '');
                            setRightDrawerAction('convert_ticket');
                          }}
                          className="text-[9px] font-mono text-rose-450 hover:text-rose-355 uppercase font-bold"
                        >
                          + Issue Ticket
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                        {tickets.filter(t => t.phone === selectedConv.phone || t.conversationId === selectedConv.id).length > 0 ? (
                          tickets.filter(t => t.phone === selectedConv.phone || t.conversationId === selectedConv.id).map(ticket => (
                            <div key={ticket.id} className="p-2.5 bg-slate-950/40 border border-slate-850 rounded hover:border-slate-800 transition-colors space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[9px] font-bold text-rose-400">{ticket.id}</span>
                                <span className={`text-[8.5px] font-mono px-1 rounded uppercase font-extrabold ${
                                  ticket.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/10' :
                                  ticket.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10' :
                                  'bg-slate-800 text-slate-400'
                                }`}>
                                  {ticket.priority}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-200 text-[11px] leading-snug line-clamp-2">{ticket.subject}</p>
                              
                              <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 pt-1">
                                <span className="flex items-center space-x-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    ticket.status === 'open' ? 'bg-amber-500' :
                                    ticket.status === 'in_progress' ? 'bg-sky-500' :
                                    'bg-emerald-500'
                                  }`} />
                                  <span className="uppercase text-slate-400">{ticket.status}</span>
                                </span>
                                <span className="truncate max-w-[120px] text-slate-550">Liaison: {ticket.assignedUserName || 'None'}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-slate-600 font-mono text-[9px]">
                            No active service tickets connected.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dynamic Action Callout */}
                    <div className="bg-slate-950/20 p-2.5 rounded border border-slate-850 text-[10px] space-y-1 text-slate-500 leading-relaxed">
                      <span className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-slate-450 block">Operational Quick Link</span>
                      <p>
                        This dashboard unifies customer liaison pipelines. Converting inbound logs logs audit journals dynamically to core B2B modules.
                      </p>
                    </div>
                  </div>
                )}

                {/* CHOICE A: CONVERT TO RFQ DRAWER */}
                {rightDrawerAction === 'convert_rfq' && (
                  <form onSubmit={handleCreateRFQ} className="space-y-4">
                    <div className="p-3 bg-slate-950 rounded border border-slate-800/40 space-y-1">
                      <span className="text-[9px] uppercase font-mono text-slate-500 font-bold tracking-wider block">Originating Caller</span>
                      <p className="text-xs font-semibold text-slate-200">{selectedConv.customerName || selectedConv.phone}</p>
                      <p className="text-[9.5px] font-mono text-slate-500 mt-0.5">Phone: {selectedConv.phone}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10.5px] font-medium text-slate-300">
                        Inquiry Requirements / Specifications
                      </label>
                      <textarea
                        required
                        rows={6}
                        value={rfqRequirementsText}
                        onChange={(e) => setRfqRequirementsText(e.target.value)}
                        placeholder="Detail items required, specifications and tolerances requested by dealer..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div className="bg-slate-950/45 p-2.5 rounded border border-slate-800 text-[10px] space-y-1.5 leading-snug">
                      <div className="flex items-center space-x-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-wider">Liaison Guidance</span>
                      </div>
                      <p className="text-slate-500">
                        Converting this will create a formal RFQ in FlowOps. The system presets default pricing checklists and registers an active event audit log immediately.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={rfqLoading}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-xs uppercase rounded cursor-pointer select-none transition-all flex items-center justify-center space-x-1.5"
                    >
                      {rfqLoading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Generating RFQ...</span>
                        </>
                      ) : (
                        <span>Generate Active RFQ 💼</span>
                      )}
                    </button>
                  </form>
                )}

                {/* CHOICE A2: CONVERT TO SERVICE SUPPORT TICKET DRAWER */}
                {rightDrawerAction === 'convert_ticket' && (
                  <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div className="p-3 bg-slate-950 rounded border border-slate-800/40 space-y-1">
                      <span className="text-[9px] uppercase font-mono text-slate-500 font-bold tracking-wider block">Originating Caller</span>
                      <p className="text-xs font-semibold text-slate-200">{selectedConv.customerName || selectedConv.phone}</p>
                      <p className="text-[9.5px] font-mono text-slate-500 mt-0.5">Phone: {selectedConv.phone}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10.5px] font-medium text-slate-300">
                        Ticket Title / Subject
                      </label>
                      <input
                        type="text"
                        required
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="e.g. Consignment Package Damaged on Box 5"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10.5px] font-medium text-slate-300">
                        Detailed Problem Description
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="Detail the issue, damaged items count, tracking ID, and expected resolution..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1">Ticket Priority</label>
                        <select
                          value={ticketPriority}
                          onChange={(e) => setTicketPriority(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-300 text-xs px-2 py-1.5 rounded focus:outline-hidden cursor-pointer"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                          <option value="urgent">Urgent Escalation</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1">Assign Liaison</label>
                        <select
                          value={ticketAssignee}
                          onChange={(e) => setTicketAssignee(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-300 text-xs px-2 py-1.5 rounded focus:outline-hidden cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={ticketLoading}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs uppercase rounded cursor-pointer select-none transition-all flex items-center justify-center space-x-1.5"
                    >
                      {ticketLoading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Generating Ticket...</span>
                        </>
                      ) : (
                        <span>Create Service Ticket 🎫</span>
                      )}
                    </button>
                  </form>
                )}


                {/* CHOICE B: MATCH / ASSOCIATE CONTACT TO CUSTOMER */}
                {rightDrawerAction === 'match_customer' && (
                  <div className="space-y-5">
                    
                    {/* OPTION B1: MATCH EXISTING LISTING */}
                    <div className="space-y-3 bg-slate-950/50 p-3 rounded border border-slate-850">
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-4 w-4 text-sky-400" />
                        <span className="font-mono text-[9px] font-bold text-sky-400 uppercase tracking-wider">Search Existing Profiles</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Select a client from the B2B roster database to associate this WhatsApp feed with their active file.
                      </p>

                      <div className="space-y-2">
                        <select
                          value={selectedCustomerIdToMatch}
                          onChange={(e) => setSelectedCustomerIdToMatch(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-300 text-xs px-2 py-1.5 rounded focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Choose Existing Client --</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.city})
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={!selectedCustomerIdToMatch}
                          onClick={handleMatchExistingCustomer}
                          className={`w-full py-1.5 font-mono font-bold uppercase rounded text-[10px] cursor-pointer transition-colors ${
                            selectedCustomerIdToMatch 
                              ? 'bg-sky-600 hover:bg-sky-500 text-white' 
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Link Selected Client Core 🔗
                        </button>
                      </div>
                    </div>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-800"></div>
                      <span className="flex-shrink mx-3 text-[9px] font-mono text-slate-500 uppercase">Or Create Profile</span>
                      <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    {/* OPTION B2: WE CREATE A BRAND NEW CUSTOMER */}
                    <form onSubmit={handleCreateCustomerAndMatch} className="space-y-3.5 bg-slate-950/30 p-3 rounded border border-slate-850">
                      <div className="flex items-center space-x-2">
                        <UserPlus className="h-4 w-4 text-emerald-400" />
                        <span className="font-mono text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-semibold">New Customer Form</span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Company / Dealer Name</label>
                          <input
                            type="text"
                            required
                            value={newCustName}
                            onChange={(e) => setNewCustName(e.target.value)}
                            placeholder="e.g. Apex Valve Corp"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Customer / Dealer Type</label>
                          <div className="flex gap-2">
                            {(['customer', 'dealer'] as const).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setNewCustType(t)}
                                className={`flex-1 py-1 text-[10px] border rounded font-mono uppercase cursor-pointer transition-colors ${
                                  newCustType === t 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 font-bold' 
                                    : 'border-slate-800 text-slate-500 hover:text-slate-350'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Primary Liaison Contact Name</label>
                          <input
                            type="text"
                            required
                            value={newCustContact}
                            onChange={(e) => setNewCustContact(e.target.value)}
                            placeholder="e.g. Rajesh Patil"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">WhatsApp phone number</label>
                          <input
                            type="text"
                            required
                            readOnly
                            value={newCustPhone}
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-slate-400 text-xs font-mono cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Email address</label>
                          <input
                            type="email"
                            required
                            value={newCustEmail}
                            onChange={(e) => setNewCustEmail(e.target.value)}
                            placeholder="e.g. procurement@apex.com"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">City Location</label>
                          <input
                            type="text"
                            required
                            value={newCustCity}
                            onChange={(e) => setNewCustCity(e.target.value)}
                            placeholder="e.g. Pune"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={customerModalLoading}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-[10px] uppercase rounded cursor-pointer flex items-center justify-center space-x-1"
                      >
                        {customerModalLoading ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Saving profile...</span>
                          </>
                        ) : (
                          <span>Create & Match Profile 👤</span>
                        )}
                      </button>
                    </form>

                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
};
export default WhatsAppInboxPage;
