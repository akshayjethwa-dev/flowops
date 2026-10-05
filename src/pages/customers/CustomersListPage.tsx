// src/pages/customers/CustomersListPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCustomersList } from '../../hooks/useCustomersList';
import { usePaginatedCollectionQuery } from '../../hooks/usePaginatedCollectionQuery';
import { useTenantUsers } from '../../hooks/useTenantUsers';
import { FilterBar } from '../../components/FilterBar';
import { ExportButton } from '../../components/ExportButton';
import { Customer } from '../../types';
import { db } from '../../firebase';
import { 
  Users, 
  Plus, 
  Phone, 
  MapPin, 
  Building2, 
  ChevronRight, 
  X, 
  Edit2, 
  Trash2,
  AlertCircle,
  ArrowRightLeft
} from 'lucide-react';
import { TextField } from '../../components/ui/TextField';

export const CustomersListPage: React.FC = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();

  // Unified Filter mapping
  const [filters, setFilters] = useState<Record<string, any>>({
    search: '',
    status: '',
    tag: '',
    assignedSalesUserId: '',
    city: ''
  });

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  // Map FilterBar's 'status' output to the 'type' field expected by the collection schema
  const queryFilters = {
    search: filters.search,
    type: filters.status === 'customer' || filters.status === 'dealer' ? filters.status : '',
    tag: filters.tag,
    assignedSalesUserId: filters.assignedSalesUserId,
    city: filters.city
  };

  // Lazy chunked loader
  const {
    data: customers,
    loading: listLoading,
    loadingMore,
    hasMore,
    error: listError,
    loadMore
  } = usePaginatedCollectionQuery<Customer & { id: string }>(
    tenant?.id ? `tenants/${tenant.id}/customers` : 'customers',
    {
      filters: queryFilters,
      pageSize: 8,
      sortField: 'createdAt',
      sortDirection: 'desc',
      isSandbox,
      localBackupKey: `customers_${tenant?.id}`
    }
  );

  // Still resolve mutations from baseline list hook
  const { 
    addCustomer, 
    updateCustomer, 
    deleteCustomer 
  } = useCustomersList(tenant?.id);

  // Retrieve tenant users to map assignments
  const { users: tenantUsers } = useTenantUsers(tenant?.id);
  const salesExecutives = (tenantUsers || []).filter(
    u => u.role === 'sales' || u.role === 'admin' || u.role === 'management'
  );

  // Slide-over Form States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'customer' | 'dealer'>('customer');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [assignedSalesUserId, setAssignedSalesUserId] = useState('');

  // Reset form helper
  const resetForm = () => {
    setName('');
    setType('customer');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setGstNumber('');
    setBillingAddress('');
    setShippingAddress('');
    setCity('');
    setNotes('');
    setTagsInput('');
    setAssignedSalesUserId('');
    setEditingCustomer(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, cust: Customer) => {
    e.stopPropagation();
    setEditingCustomer(cust);
    setName(cust.name);
    setType(cust.type);
    setContactPerson(cust.contactPerson);
    setPhone(cust.phone);
    setEmail(cust.email || '');
    setGstNumber(cust.gstNumber || '');
    setBillingAddress(cust.billingAddress || '');
    setShippingAddress(cust.shippingAddress || '');
    setCity(cust.city);
    setNotes(cust.notes || '');
    setTagsInput(cust.tags ? cust.tags.join(', ') : '');
    setAssignedSalesUserId(cust.assignedSalesUserId || '');
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contactPerson || !phone || !city) {
      alert('Please fill out all required fields.');
      return;
    }

    const processedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const customerPayload: Omit<Customer, 'tenantId'> = {
      name,
      type,
      contactPerson,
      phone,
      email,
      gstNumber: gstNumber || undefined,
      billingAddress,
      shippingAddress,
      city,
      notes: notes || undefined,
      tags: processedTags,
      assignedSalesUserId: assignedSalesUserId || undefined
    };

    try {
      if (editingCustomer?.id) {
        await updateCustomer(editingCustomer.id, customerPayload);
        alert(`Successfully updated profile for ${name}`);
      } else {
        await addCustomer(customerPayload);
        alert(`Successfully registered new customer profile: ${name}`);
      }
      setIsDrawerOpen(false);
      resetForm();
    } catch (err: any) {
      alert(`Operation failed: ${err.message || err}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, custName: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the profile for "${custName}"? This operation cannot be undone.`)) {
      try {
        await deleteCustomer(id);
        alert('Customer record deleted.');
      } catch (err: any) {
        alert(`Error deleting customer: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6 font-sans relative">
      
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-205 gap-3">
        <div>
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Corporate Ledger
          </span>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-1 leading-none">
            Customers & Dealers
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Onboard, review, and maintain high-volume corporate accounts, dealership chains, shipping coordinates, and regional GSTIN registers.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
          <ExportButton
            data={customers}
            filenamePrefix="customers_registry"
            headersMap={{
              name: 'Enterprise Name',
              type: 'Category',
              contactPerson: 'Contact Person',
              phone: 'Phone',
              email: 'Email',
              gstNumber: 'GSTIN',
              city: 'Zone',
              billingAddress: 'Billing Address',
              shippingAddress: 'Shipping Address',
              notes: 'Internal Operator Notes'
            }}
            label="Export CSV"
          />
          <button
            onClick={handleOpenCreate}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 text-sky-200 shrink-0" />
            <span>Add Custom Member</span>
          </button>
        </div>
      </div>

      {/* Dynamic FilterBar component */}
      <FilterBar
        entityType="customers"
        tenantId={tenant?.id || 'demo'}
        filters={filters}
        onFilterChange={(updated) => setFilters(updated)}
        onClearFilters={() => setFilters({
          search: '',
          status: '',
          tag: '',
          assignedSalesUserId: '',
          city: ''
        })}
        searchPlaceholder="Search customers by company, phone, email, contact agent..."
        statusOptions={[
          { label: 'All Categories', value: '' },
          { label: 'Standard Customer', value: 'customer' },
          { label: 'Wholesale Dealer', value: 'dealer' }
        ]}
      />

      {/* Real-time Sub-ledger Filter Tray */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center text-xs text-slate-700">
        <div className="font-mono font-bold uppercase text-[9px] text-slate-450 tracking-wider">
          CRM Filters:
        </div>
        
        {/* City Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 font-mono text-[9px]">Zone/City:</span>
          <input
            type="text"
            value={filters.city || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
            placeholder="Pune, MH"
            className="border border-slate-200 bg-white rounded-lg px-2 py-1 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-sky-500 max-w-[120px] font-mono text-slate-800"
          />
        </div>

        {/* Assigned Sales Rep Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 font-mono text-[9px]">Liaison Representative:</span>
          <select
            value={filters.assignedSalesUserId || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, assignedSalesUserId: e.target.value }))}
            className="border border-slate-200 bg-white rounded-lg px-2 py-1 text-[11px] focus:outline-hidden text-slate-800 font-sans"
          >
            <option value="">All Executives</option>
            {salesExecutives.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-400 font-mono text-[9px]">Profile Tag:</span>
          <input
            type="text"
            value={filters.tag || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, tag: e.target.value }))}
            placeholder="e.g. Priority"
            className="border border-slate-200 bg-white rounded-lg px-2 py-1 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-sky-500 max-w-[120px] font-mono text-slate-800"
          />
        </div>

        {(filters.city || filters.assignedSalesUserId || filters.tag) && (
          <button
            onClick={() => setFilters(prev => ({ ...prev, city: '', assignedSalesUserId: '', tag: '' }))}
            className="ml-auto text-[9px] text-rose-600 hover:text-rose-800 font-mono font-bold uppercase transition cursor-pointer"
          >
            × Clear CRM Filters
          </button>
        )}
      </div>

      {/* Customer Lists Core */}
      {listLoading ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl space-y-4">
          <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-slate-405 font-mono uppercase tracking-wider">Syncing Corporate Master Directory...</p>
        </div>
      ) : listError ? (
        <div className="bg-red-50/50 border border-red-200 rounded-xl p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
          <h4 className="font-bold text-slate-900 text-sm">Failed to Sync Corporate Records</h4>
          <p className="text-[11px] text-slate-505 mt-1">{listError}</p>
        </div>
      ) : customers.length > 0 ? (
        <div className="space-y-4">
          {/* DESKTOP TABULAR VIEW */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs select-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-150 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Name & Description</th>
                    <th className="py-3 px-5">Account Type</th>
                    <th className="py-3 px-5">City Zone</th>
                    <th className="py-3 px-5">Phone Link</th>
                    <th className="py-3 px-5 text-right font-bold pr-6">Action Pane</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {customers.map((c) => (
                    <tr 
                      key={c.id} 
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="hover:bg-slate-50/35 transition-colors cursor-pointer group"
                    >
                      {/* Name & tags */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-800 group-hover:text-sky-650 transition-colors flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-slate-400 group-hover:text-sky-600 shrink-0" />
                          <span>{c.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-450 mt-1 flex items-center space-x-1">
                          <span className="font-mono">{c.contactPerson}</span>
                          {c.email && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[150px] font-mono lowercase">{c.email}</span>
                            </>
                          )}
                        </div>
                        {c.assignedSalesUserId && (
                          <div className="text-[10px] mt-1 text-slate-500">
                            <span className="font-mono bg-indigo-50/50 hover:bg-indigo-50 text-indigo-750 px-1.5 py-0.5 rounded border border-indigo-100 font-semibold text-[9px]">
                              Liaison: {salesExecutives.find(u => u.id === c.assignedSalesUserId)?.name || 'Account Rep'}
                            </span>
                          </div>
                        )}
                        {/* Tags display */}
                        {c.tags && c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {c.tags.map((tag, idx) => (
                              <span key={idx} className="bg-slate-50 text-slate-500 font-mono text-[8px] px-1.5 py-0.2 rounded font-semibold border border-slate-150/50">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-4 px-5 align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-[9px] uppercase tracking-wider border ${
                          c.type === 'dealer' 
                            ? 'bg-indigo-50 text-indigo-750 border-indigo-100' 
                            : 'bg-emerald-50 text-emerald-755 border-emerald-100'
                        }`}>
                          {c.type}
                        </span>
                      </td>

                      {/* City */}
                      <td className="py-4 px-5 align-middle">
                        <div className="flex items-center space-x-1 text-slate-650">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{c.city}</span>
                        </div>
                      </td>

                      {/* Phone Link */}
                      <td className="py-4 px-5 align-middle font-mono text-slate-600 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      </td>

                      {/* Control buttons */}
                      <td className="py-4 px-6 text-right whitespace-nowrap align-middle">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={(e) => handleOpenEdit(e, c)}
                            className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 text-slate-650 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <Edit2 className="h-3 w-3 shrink-0" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, c.id!, c.name)}
                            className="p-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 hover:border-red-200 rounded-lg transition-all cursor-pointer"
                            title="Delete customer record"
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                          </button>
                          <span className="p-1 text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARD LAYOUT */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {customers.map((c) => (
              <div 
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                className="bg-white border border-slate-205 rounded-xl p-4 space-y-4 hover:border-slate-300 transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 flex items-center space-x-1.5 leading-tight">
                      <Building2 className="h-4.5 w-4.5 text-sky-500 shrink-0" />
                      <span>{c.name}</span>
                    </h3>
                    <p className="text-[10px] font-mono text-slate-500 leading-none mt-0.5">Contact: {c.contactPerson}</p>
                    {c.assignedSalesUserId && (
                      <p className="text-[9px] font-mono text-indigo-755 font-semibold bg-indigo-50/40 px-1 py-0.5 rounded border border-indigo-100 inline-block mt-1 select-none">
                        Rep: {salesExecutives.find(u => u.id === c.assignedSalesUserId)?.name || 'Account Rep'}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-mono font-bold text-[8px] uppercase tracking-wide border ${
                    c.type === 'dealer' 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  }`}>
                    {c.type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-slate-100 pt-3 text-slate-650">
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{c.city}</span>
                  </div>
                  <div className="flex items-center space-x-1 font-mono">
                    <Phone className="h-3.5 w-3.5 text-slate-405 shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                </div>

                {c.tags && c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((tag, idx) => (
                      <span key={idx} className="bg-slate-50 text-slate-505 font-mono text-[8px] px-1.5 py-0.2 rounded border border-slate-200/60">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[9px] font-bold font-mono text-sky-655 flex items-center space-x-1">
                    <span>Manage Hub</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                  
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={(e) => handleOpenEdit(e, c)}
                      className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, c.id!, c.name)}
                      className="p-1 hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 rounded-md transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Trigger */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-mono text-[10.5px] uppercase font-bold tracking-wider rounded-xl transition-all shadow-xs shrink-0 flex items-center space-x-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Syncing Next segment...</span>
                  </>
                ) : (
                  <span>Load More Accounts</span>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl select-none max-w-2xl mx-auto space-y-4">
          <div className="h-12 w-12 bg-sky-50 text-sky-650 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto p-4">
            <h4 className="font-bold text-slate-905 text-sm">No Accounts Registered</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              No matching client or regional dealer profile corresponds with your active filtering bounds. Select "Add Custom Member" to onboard.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] font-mono uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm inline-flex items-center space-x-1.5"
          >
            <Plus className="h-3.5 w-3.5 text-slate-400" />
            <span>Onboard first record</span>
          </button>
        </div>
      )}

      {/* DRAWER SLIDE-OVER FORM MODAL */}
      {isDrawerOpen && (
        <div className="fixed inset-0 overflow-hidden z-20">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" onClick={() => setIsDrawerOpen(false)} />

          <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-lg md:max-w-xl bg-white shadow-2xl flex flex-col h-full transform transition-transform duration-350 ease-out py-0">
              
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-150 flex items-center justify-between bg-slate-50/60 shrink-0 select-none">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-sky-600 block leading-none">
                    {editingCustomer ? 'Update Profile' : 'Onboard Client'}
                  </span>
                  <h3 className="text-md font-bold text-slate-900 leading-none">
                    {editingCustomer ? `Editing: ${editingCustomer.name}` : 'Register Corporate Entity'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Scrollable Form body */}
              <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-5 min-h-0 select-none">
                
                {/* 1. Brand name */}
                <TextField
                  id="form-company-name"
                  label="Enterprise / Company Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Maharashtra Power & Tools"
                />

                {/* 2. Type selections */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    Account ClassificationType *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setType('customer')}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        type === 'customer'
                          ? 'border-emerald-500 bg-emerald-50/30 text-emerald-800 font-bold'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-655'
                      }`}
                    >
                      <Building2 className={`h-5 w-5 mb-1 ${type === 'customer' ? 'text-emerald-600' : 'text-slate-404'}`} />
                      <span className="text-xs uppercase tracking-wider font-mono">Customer</span>
                      <span className="text-[8px] text-slate-400 font-sans font-normal normal-case mt-0.5 mt-1 block">Simple custom orders</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('dealer')}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        type === 'dealer'
                          ? 'border-indigo-500 bg-indigo-50/30 text-indigo-800 font-bold'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-655'
                      }`}
                    >
                      <ArrowRightLeft className={`h-5 w-5 mb-1 ${type === 'dealer' ? 'text-indigo-600' : 'text-slate-404'}`} />
                      <span className="text-xs uppercase tracking-wider font-mono">Dealer</span>
                      <span className="text-[8px] text-slate-400 font-sans font-normal normal-case mt-0.5 mt-1 block">High-volume wholesale hub</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 3. Contact person */}
                  <TextField
                    id="form-contact"
                    label="Primary Liaison Officer *"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    required
                    placeholder="e.g. Anand Kulkarni"
                  />

                  {/* 4. Phone */}
                  <TextField
                    id="form-phone"
                    label="WhatsApp Notification Phone *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="e.g. 919880123456"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 5. Email */}
                  <TextField
                    id="form-email"
                    label="Billing Email Address"
                    value={email}
                    type="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. purchase@kirloskar.in"
                  />

                  {/* 6. GSTIN */}
                  <TextField
                    id="form-gstin"
                    label="GST Identification Number (GSTIN)"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 27AAAAA1111A1Z1"
                  />
                </div>

                {/* 7. City */}
                <TextField
                  id="form-city"
                  label="Primary Zone / City Location *"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  placeholder="e.g. Pune, MH"
                />

                {/* 8. Billing address */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    Billing Address & Registered corporate seat
                  </label>
                  <textarea
                    className="w-full text-xs font-sans border border-slate-200 hover:border-slate-250 bg-slate-50 rounded-lg p-2.5 min-h-[50px] focus:bg-white focus:outline-hidden text-slate-800"
                    placeholder="Enter official billing coordinate details..."
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                  />
                </div>

                {/* 9. Shipping address */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    Shipping Address / Lorry unloading yard
                  </label>
                  <textarea
                    className="w-full text-xs font-sans border border-slate-200 hover:border-slate-250 bg-slate-50 rounded-lg p-2.5 min-h-[50px] focus:bg-white focus:outline-hidden text-slate-800"
                    placeholder="Enter factory delivery gates, dispatch yards, or warehouse address..."
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                  />
                </div>

                {/* 10. Tags */}
                <TextField
                  id="form-tags"
                  label="Classification Tags (comma-separated)"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. Priority, Dealer, High-Volume, Strict_QA"
                />

                {/* Assigned Account Sales Rep Assignment */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    Assigned Account Sales Executive
                  </label>
                  <select
                    id="form-assigned-sales-rep"
                    className="w-full text-xs font-sans border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:outline-hidden text-slate-800"
                    value={assignedSalesUserId}
                    onChange={(e) => setAssignedSalesUserId(e.target.value)}
                  >
                    <option value="">-- No Assignment / General Accounts --</option>
                    {salesExecutives.map((exec) => (
                      <option key={exec.id} value={exec.id}>
                        {exec.name} ({exec.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 11. Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    Internal Operator Notes
                  </label>
                  <textarea
                    className="w-full text-xs font-sans border border-slate-200 hover:border-slate-250 bg-slate-50 rounded-lg p-2.5 min-h-[60px] focus:bg-white focus:outline-hidden text-slate-800"
                    placeholder="Enter any private trade terms, transport lorry preferences, or special billing directives..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Action panel inside drawer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => {
                       setIsDrawerOpen(false);
                       resetForm();
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-605 hover:text-slate-800 hover:bg-slate-50 text-xs font-mono font-bold uppercase transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition shadow-sm"
                  >
                    {editingCustomer ? 'Update Ledger' : 'Onboard Now'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
