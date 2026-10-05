// src/pages/rfqs/RfqCreateForm.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRfqsList } from '../../hooks/useRfqsList';
import { useCustomersList } from '../../hooks/useCustomersList';
import { DEMO_PRODUCTS } from '../../data/mockData';
import { RFQItem, Rfq } from '../../types';
import { db } from '../../firebase';
import { useToast } from '../../context/ToastContext';
import { FieldError } from '../../components/ui/FieldError';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { 
  ArrowLeft, 
  Save, 
  UserPlus, 
  Library, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  UserCheck
} from 'lucide-react';

export const RfqCreateForm: React.FC = () => {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { addRfq } = useRfqsList(tenant?.id);
  const { customers, addCustomer, loading: loadingCust } = useCustomersList(tenant?.id);
  const { toastSuccess, toastError } = useToast();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // RFQ fields state
  const [rfqNumber, setRfqNumber] = useState(`RFQ-2026-${Math.floor(1001 + Math.random() * 8999)}`);
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState<'Phone' | 'Email' | 'WhatsApp' | 'Walk-in'>('Email');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [assignedTo, setAssignedTo] = useState('Anand K.');
  const [description, setDescription] = useState('');

  // Customer linkage mode
  const [customerMode, setCustomerMode] = useState<'select' | 'quick-create'>('select');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // Quick-create customer fields
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustContact, setQuickCustContact] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustEmail, setQuickCustEmail] = useState('');
  const [quickCustCity, setQuickCustCity] = useState('');

  // Manual fallback fields (in case they don't want to save a profile, or default)
  const [fallbackContactName, setFallbackContactName] = useState('');
  const [fallbackPhone, setFallbackPhone] = useState('');
  const [fallbackEmail, setFallbackEmail] = useState('');

  // RFQ Items Builder State
  const [rfqItems, setRfqItems] = useState<RFQItem[]>([]);
  const [catalogProductId, setCatalogProductId] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemSpecs, setItemSpecs] = useState('');
  const [itemType, setItemType] = useState<'catalog' | 'custom'>('catalog');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Add Item to Builder
  const handleAddItem = () => {
    if (itemType === 'catalog') {
      if (!catalogProductId) {
        setFormError('Please select a catalog product first');
        return;
      }
      const prod = DEMO_PRODUCTS.find(p => p.id === catalogProductId);
      if (!prod) return;

      // Avoid duplication if preferred or append
      const newItem: RFQItem = {
        id: prod.id,
        name: prod.name,
        quantity: itemQuantity,
        specs: itemSpecs.trim() || undefined
      };
      setRfqItems([...rfqItems, newItem]);
      setCatalogProductId('');
      setItemQuantity(1);
      setItemSpecs('');
      setFormError(null);
    } else {
      if (!customItemName.trim()) {
        setFormError('Please enter a custom product item name');
        return;
      }
      const newItem: RFQItem = {
        id: `custom_${Date.now()}`,
        name: customItemName.trim(),
        quantity: itemQuantity,
        specs: itemSpecs.trim() || undefined
      };
      setRfqItems([...rfqItems, newItem]);
      setCustomItemName('');
      setItemQuantity(1);
      setItemSpecs('');
      setFormError(null);
    }
  };

  const handleRemoveItem = (index: number) => {
    setRfqItems(rfqItems.filter((_, i) => i !== index));
  };

  // Submit Rfq Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !profile) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    // Field Validation Form Pattern (Requirement 2)
    const errors: Record<string, string> = {};
    if (customerMode === 'select' && !selectedCustomerId) {
      errors.customerId = 'B2B Client Profile selection is required.';
    }
    if (customerMode === 'quick-create' && !quickCustName.trim()) {
      errors.quickCustName = 'Enterprise company title is required.';
    }
    if (rfqItems.length === 0) {
      errors.rfqItems = 'Please append at least one engineering compound parts line item below.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaving(false);
      toastError('Validation Mismatch', 'Please resolve highlighted inconsistencies before saving.');
      return;
    }

    try {
      let finalCustomerId = '';
      let finalCustomerName = '';
      let finalContactName = '';
      let finalPhone = '';
      let finalEmail = '';

      if (customerMode === 'select') {
        const custRef = customers.find(c => c.id === selectedCustomerId);
        if (!custRef) throw new Error('Selected customer profile is invalid');

        finalCustomerId = selectedCustomerId;
        finalCustomerName = custRef.name;
        finalContactName = fallbackContactName || custRef.contactPerson;
        finalPhone = fallbackPhone || custRef.phone || '';
        finalEmail = fallbackEmail || custRef.email || '';
      } else {
        // Quick-create customer
        const newCust = await addCustomer({
          name: quickCustName.trim(),
          type: 'customer',
          contactPerson: quickCustContact.trim() || 'Main Contact',
          phone: quickCustPhone.trim(),
          email: quickCustEmail.trim(),
          city: quickCustCity.trim() || 'Unspecified',
          billingAddress: 'Direct Enquiry Billing Address',
          shippingAddress: 'Direct Enquiry Shipping Address',
          notes: `Profile quickcreated during RFQ formulation: ${rfqNumber}`
        });

        if (!newCust || !newCust.id) {
          throw new Error('Failed to register new customer profile');
        }

        finalCustomerId = newCust.id;
        finalCustomerName = newCust.name;
        finalContactName = newCust.contactPerson;
        finalPhone = newCust.phone || '';
        finalEmail = newCust.email || '';
      }

      // Build RFQ payload
      const rfqPayload: Omit<Rfq, 'id' | 'tenantId' | 'createdAt'> = {
        rfqNumber,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        contactName: finalContactName,
        phone: finalPhone,
        email: finalEmail,
        source,
        dateReceived,
        status: 'New', // default status
        priority,
        description: description.trim(),
        assignedTo,
        attachments: [],
        items: rfqItems,
        requirements: description.trim(), // backward compatibility
        createdBy: profile.uid
      };

      // Call API
      const createdRfq = await addRfq(rfqPayload);

      // Trigger D: Create notification type "new_rfq" for all users with role "sales" or "admin"
      const rfqIsSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
      let targetUsers: string[] = [];

      if (rfqIsSandbox) {
        const cachedUsers = localStorage.getItem(`flowops_users_${tenant.id}`);
        const userList = cachedUsers ? JSON.parse(cachedUsers) : [
          { id: 'user_demo_rajesh', role: 'admin' },
          { id: 'user_demo_arjun', role: 'sales' },
          { id: 'user_demo_kabir', role: 'sales' }
        ];
        targetUsers = userList
          .filter((u: any) => u.role === 'sales' || u.role === 'admin')
          .map((u: any) => u.id);
      } else {
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const usersColRef = collection(db, 'tenants', tenant.id, 'users');
          const usersSnap = await getDocs(usersColRef);
          usersSnap.forEach(uDoc => {
            const uData = uDoc.data();
            if (uData.role === 'sales' || uData.role === 'admin') {
              targetUsers.push(uDoc.id);
            }
          });
        } catch (e) {
          console.error('Failed to fetch live tenant users for RFQ notifications', e);
        }
      }

      // Fallback if no target users found
      if (targetUsers.length === 0) {
        targetUsers.push(profile.uid);
      }

      // Create notifications
      if (rfqIsSandbox) {
        const key = `flowops_notifications_${tenant.id}`;
        const cached = localStorage.getItem(key);
        let notifs = cached ? JSON.parse(cached) : [];
        
        targetUsers.forEach(uid => {
          const newNotif = {
            id: `notif_new_rfq_${createdRfq.id || Date.now()}_${uid}_${Date.now()}`,
            tenantId: tenant.id,
            userId: uid,
            type: 'new_rfq',
            title: 'New RFQ Received',
            message: `New RFQ ${rfqNumber} received from ${finalCustomerName} regarding custom requirements.`,
            entityId: createdRfq.id || 'rfq_fallback',
            entityType: 'rfq',
            link: createdRfq.id ? `/rfqs/${createdRfq.id}` : '/rfqs',
            read: false,
            createdAt: new Date().toISOString()
          };
          notifs.push(newNotif);
        });
        localStorage.setItem(key, JSON.stringify(notifs));
        window.dispatchEvent(new Event('storage'));
      } else {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          for (const uid of targetUsers) {
            const newNotifId = `new_rfq_${createdRfq.id || Date.now()}_${uid}_${Date.now()}`;
            const docRef = doc(db, 'notifications', newNotifId);
            await setDoc(docRef, {
              id: newNotifId,
              tenantId: tenant.id,
              userId: uid,
              type: 'new_rfq',
              title: 'New RFQ Received',
              message: `New RFQ ${rfqNumber} received from ${finalCustomerName} regarding custom requirements.`,
              entityId: createdRfq.id || 'rfq_fallback',
              entityType: 'rfq',
              link: createdRfq.id ? `/rfqs/${createdRfq.id}` : '/rfqs',
              read: false,
              createdAt: new Date()
            });
          }
        } catch (err) {
          console.error('Failed to save RFQ creation notification', err);
        }
      }
      
      // Save timeline automatically in localStorage since the detail page uses it
      const timelineKey = `rfq_timeline_${tenant.id}_${createdRfq.id}`;
      const events = [
        {
          id: `ev-${Date.now()}`,
          createdAt: new Date().toISOString(),
          title: 'RFQ Generated',
          description: `Formulated the quotation file ref: ${rfqNumber} linked to ${finalCustomerName}.`,
          operatorName: assignedTo || 'Sales Representative'
        }
      ];
      localStorage.setItem(timelineKey, JSON.stringify(events));

      // Global Toast Notification Pattern (Requirement 1)
      toastSuccess('RFQ Formulated Successfully', `Quotation file ${rfqNumber} has been updated in database.`, 5000);

      // Redirect back to RFQ master pool of listings
      navigate('/rfqs');
    } catch (err: any) {
      // Backend error code mapping (Requirement 2)
      const mappedMsg = getFriendlyErrorMessage(err);
      setFormError(mappedMsg);
      toastError('Operational Mismatch Exception', mappedMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      
      {/* breadcrumb back CTA */}
      <button
        onClick={() => navigate('/rfqs')}
        className="inline-flex items-center space-x-1 text-slate-450 hover:text-slate-800 text-[10px] font-mono tracking-wider uppercase cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Return to RFQ Pool</span>
      </button>

      {/* Title block */}
      <div>
        <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
          Form Creation Wizard
        </span>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
          Formulate Manufacturing RFQ File
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Input custom engineering variables and link or onboard the procurement client profile below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Card 1: Core RFQ Specs */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
            <Library className="h-4 w-4 text-sky-500" />
            <span>RFQ Meta-Data</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-[11px]">
            {/* RFQ Serial */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">RFQ Ref Code</label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2 font-sans focus:bg-white text-slate-800 focus:outline-hidden"
                value={rfqNumber}
                onChange={(e) => setRfqNumber(e.target.value)}
              />
            </div>

            {/* Date Received */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">Received Date</label>
              <input
                type="date"
                required
                className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2 font-sans focus:bg-white text-slate-800 focus:outline-hidden"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
              />
            </div>

            {/* Inbound source */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">Source Origin</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2 font-sans focus:bg-white text-slate-800 focus:outline-hidden"
              >
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Walk-in">Walk-in</option>
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">Response Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2 font-sans focus:bg-white text-slate-800 focus:outline-hidden"
              >
                <option value="Low">Low (Standard SLA)</option>
                <option value="Medium">Medium (3-day target)</option>
                <option value="High">High (Express Costing)</option>
              </select>
            </div>

            {/* Assigned Estimator */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">Estimator Assigned</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2 font-sans focus:bg-white text-slate-800 focus:outline-hidden"
              >
                <option value="Anand K.">Anand K. (Lead Estimator)</option>
                <option value="Rajesh S.">Rajesh S. (Gears Div)</option>
                <option value="Vikram M.">Vikram M. (Machinery Specialist)</option>
                <option value="Sales Admin">Sales Admin Desk</option>
                <option value="demo_user">demo_user</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Link Customer Profile OR Onboard Customer Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <UserCheck className="h-4 w-4 text-sky-500" />
              <span>Customer Identification</span>
            </h3>

            {/* Switch tabs between selection or register */}
            <div className="inline-flex rounded-lg border border-slate-205 p-0.5 bg-slate-50 font-mono text-[9px]">
              <button
                type="button"
                onClick={() => setCustomerMode('select')}
                className={`px-2.5 py-1 rounded-md font-bold uppercase cursor-pointer ${
                  customerMode === 'select' ? 'bg-white shadow-xs text-sky-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Choose Existing
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('quick-create')}
                className={`px-2.5 py-1 rounded-md font-bold uppercase cursor-pointer flex items-center space-x-1 ${
                  customerMode === 'quick-create' ? 'bg-white shadow-xs text-sky-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <UserPlus className="h-3 w-3 shrink-0" />
                <span>Quick-Onboard New</span>
              </button>
            </div>
          </div>

          {customerMode === 'select' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
                  Select B2B Client Profile
                </label>
                <select
                  required={customerMode === 'select'}
                  className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    const selected = customers.find(c => c.id === e.target.value);
                    if (selected) {
                      setFallbackContactName(selected.contactPerson);
                      setFallbackPhone(selected.phone || '');
                      setFallbackEmail(selected.email || '');
                    }
                  }}
                >
                  <option value="">-- Click to search customer rolodex --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.city ? `(${c.city})` : ''} - Contact: {c.contactPerson}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors.customerId} />
              </div>

              {/* Show selected summary callback input fields */}
              {selectedCustomerId && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs">
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block uppercase">Contact Person</label>
                    <input
                      type="text"
                      className="mt-1 w-full bg-white border border-slate-200 rounded-md p-1.5 focus:outline-hidden text-slate-800"
                      value={fallbackContactName}
                      onChange={(e) => setFallbackContactName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block uppercase">Phone Number</label>
                    <input
                      type="text"
                      className="mt-1 w-full bg-white border border-slate-200 rounded-md p-1.5 focus:outline-hidden text-slate-800"
                      value={fallbackPhone}
                      onChange={(e) => setFallbackPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-400 block uppercase">Email Address</label>
                    <input
                      type="email"
                      className="mt-1 w-full bg-white border border-slate-200 rounded-md p-1.5 focus:outline-hidden text-slate-800"
                      value={fallbackEmail}
                      onChange={(e) => setFallbackEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-sky-50/20 border border-sky-100 rounded-xl text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-mono font-bold text-sky-700 uppercase block tracking-wider">Company / Entity Name *</label>
                <input
                  type="text"
                  required={customerMode === 'quick-create'}
                  placeholder="e.g. Jindal Steel Pipes Division"
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 focus:outline-hidden text-slate-800 text-xs"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                />
                <FieldError message={fieldErrors.quickCustName} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-sky-700 uppercase block tracking-wider">Liaison Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Mr. S. K. Jindal"
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 focus:outline-hidden text-slate-800 text-xs"
                  value={quickCustContact}
                  onChange={(e) => setQuickCustContact(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-sky-700 uppercase block tracking-wider">City Location</label>
                <input
                  type="text"
                  placeholder="e.g. New Delhi"
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 focus:outline-hidden text-slate-800 text-xs"
                  value={quickCustCity}
                  onChange={(e) => setQuickCustCity(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-sky-700 uppercase block tracking-wider">Phone Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +91 944 555 1200"
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 focus:outline-hidden text-slate-800 text-xs"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono font-bold text-sky-700 uppercase block tracking-wider">Liaison Email</label>
                <input
                  type="email"
                  placeholder="e.g. purchase@jindal_tubes.in"
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 focus:outline-hidden text-slate-800 text-xs"
                  value={quickCustEmail}
                  onChange={(e) => setQuickCustEmail(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Items Builder */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
            <Plus className="h-4 w-4 text-sky-500" />
            <span>Project Parts / Engineering Requirements Ledger</span>
          </h3>

          {/* Builder Field controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-4 border-b border-slate-200 pb-2 select-none">
              <label className="inline-flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  checked={itemType === 'catalog'}
                  onChange={() => setItemType('catalog')}
                  className="text-sky-600 focus:ring-0"
                />
                <span className="text-[10px] font-mono font-bold text-slate-650 uppercase">Standard Catalog</span>
              </label>
              <label className="inline-flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  checked={itemType === 'custom'}
                  onChange={() => setItemType('custom')}
                  className="text-sky-600 focus:ring-0"
                />
                <span className="text-[10px] font-mono font-bold text-slate-650 uppercase">Custom Specification</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              {itemType === 'catalog' ? (
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-500 block uppercase">Product Selection</label>
                  <select
                    className="w-full bg-white border border-slate-220 rounded-lg p-2 text-xs text-slate-705 focus:outline-hidden"
                    value={catalogProductId}
                    onChange={(e) => setCatalogProductId(e.target.value)}
                  >
                    <option value="">-- Choose Catalogue SKU --</option>
                    {DEMO_PRODUCTS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Custom Rate)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-500 block uppercase">Custom Design Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mild Steel Flange Casting Gear B-99"
                    className="w-full bg-white border border-slate-220 rounded-lg p-2 text-xs text-slate-700 focus:outline-hidden"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1 font-mono">
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-white border border-slate-220 rounded-lg p-1.5 focus:outline-hidden text-xs font-sans text-slate-700 text-center"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white hover:bg-sky-700 text-xs font-mono py-2 rounded-lg font-bold flex items-center justify-center space-x-1 cursor-pointer transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Append Line</span>
                </button>
              </div>

              {/* Specifications remarks */}
              <div className="sm:col-span-4 space-y-1">
                <label className="text-[9px] font-mono font-bold text-slate-505 block uppercase">Material Grade & Drawing reference remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Tolerance +/-0.02, Nickel Plated finish. Drg B-22 revision 3"
                  className="w-full bg-white border border-slate-220 rounded-lg p-2 text-xs text-slate-700 focus:outline-hidden font-mono"
                  value={itemSpecs}
                  onChange={(e) => setItemSpecs(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Current added items list */}
          {rfqItems.length > 0 ? (
            <div className="border border-slate-150 rounded-lg overflow-hidden select-none">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[9px] font-bold text-slate-400 uppercase">
                    <th className="py-2.5 px-4 text-left">SKU Item Detail</th>
                    <th className="py-2.5 px-4 text-center w-24">QTY Required</th>
                    <th className="py-2.5 px-6 text-right w-16">Erase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rfqItems.map((itm, index) => (
                    <tr key={index} className="hover:bg-slate-50/10">
                      <td className="py-2 px-4 whitespace-normal">
                        <div className="font-bold text-slate-800">{itm.name}</div>
                        {itm.specs && (
                          <div className="text-[10px] text-slate-450 font-mono mt-0.5">
                            Grade specs: {itm.specs}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 font-mono font-bold text-slate-700 text-center">
                        {itm.quantity} pcs
                      </td>
                      <td className="py-2 px-6 text-right">
                        <button
                           type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-400 hover:text-red-650 cursor-pointer p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <div className="text-center py-6 border border-dashed border-slate-205 rounded-xl text-slate-400 text-xs font-mono">
                Wait! No materials added to current costing pool. Use fields above to append components.
              </div>
              <FieldError message={fieldErrors.rfqItems} />
            </div>
          )}
        </div>

        {/* Card 4: Description textarea */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
          <label className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider block">RFQ Comprehensive Specifications Description</label>
          <textarea
            rows={3}
            placeholder="Introduce additional terms, SLA parameters, payment stipulations, client notes, packaging parameters, etc..."
            className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2.5 text-xs text-slate-700 focus:bg-white focus:outline-hidden handle-firestore"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Form Error or Save */}
        {formError && (
          <div className="bg-red-50 border border-red-250 rounded-lg p-3 flex items-center space-x-2 text-xs text-red-750 font-mono">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="flex justify-end space-x-3 pb-8 select-none">
          <button
            type="button"
            onClick={() => navigate('/rfqs')}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer transition-all"
          >
            Abort
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-350 text-white hover:bg-sky-750 text-xs font-mono uppercase tracking-wider font-bold px-5 py-2 rounded-lg cursor-pointer flex items-center space-x-2 transition-all shadow-sm"
          >
            {saving ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                <span>Formulating File...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save & Onboard RFQ</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
