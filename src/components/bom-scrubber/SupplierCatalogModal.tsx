// src/components/bom-scrubber/SupplierCatalogModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Building2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Filter,
  DollarSign,
  Tag,
  Phone,
  Mail
} from 'lucide-react';
import { DEFAULT_SUPPLIER_CATALOG } from '../../services/supplierCatalogData';
import { SupplierCatalogMasterItem } from '../../types/bomScrubber';

interface SupplierCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  customCatalog?: SupplierCatalogMasterItem[];
  onAddCustomItem?: (item: SupplierCatalogMasterItem) => void;
}

export const SupplierCatalogModal: React.FC<SupplierCatalogModalProps> = ({
  isOpen,
  onClose,
  customCatalog = [],
  onAddCustomItem
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // New item form state
  const [formData, setFormData] = useState({
    supplierName: '',
    supplierLocation: '',
    partNumber: '',
    manufacturer: '',
    description: '',
    materialGrade: '',
    category: 'raw_material' as any,
    moq: 1,
    leadTimeDays: 7,
    baseUnitPrice: 100,
    currency: 'INR',
    lifecycleStatus: 'ACTIVE' as any,
    notes: ''
  });

  if (!isOpen) return null;

  const allItems = [...DEFAULT_SUPPLIER_CATALOG, ...customCatalog];

  const filteredItems = allItems.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.partNumber.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q) ||
        item.materialGrade.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSubmitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partNumber || !formData.supplierName) return;

    const newItem: SupplierCatalogMasterItem = {
      id: `custom-sup-${Date.now()}`,
      ...formData,
      alternates: []
    };

    onAddCustomItem?.(newItem);
    setShowAddForm(false);
    setFormData({
      supplierName: '',
      supplierLocation: '',
      partNumber: '',
      manufacturer: '',
      description: '',
      materialGrade: '',
      category: 'raw_material',
      moq: 1,
      leadTimeDays: 7,
      baseUnitPrice: 100,
      currency: 'INR',
      lifecycleStatus: 'ACTIVE',
      notes: ''
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-600 rounded-lg text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display uppercase tracking-wider">
                Qualified Industrial Supplier Catalogs
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Indexed component database for automated BOM availability, pricing, lead time, and obsolescence lookups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-1 min-w-[280px] items-center space-x-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Part #, Material Grade, Manufacturer, or Supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-sans focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Categories</option>
              <option value="raw_material">Raw Materials & Steels</option>
              <option value="fasteners">Fasteners & Hardware</option>
              <option value="bearings">Bearings & Bushings</option>
              <option value="seals_hydraulics">Hydraulics & Seals</option>
              <option value="tooling">Cutting Tooling</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{showAddForm ? 'Cancel New Item' : 'Add Catalog Item'}</span>
            </button>
          </div>
        </div>

        {/* Optional Add Item Form */}
        {showAddForm && (
          <form onSubmit={handleSubmitNewItem} className="p-4 bg-sky-50/50 border-b border-sky-100 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">Supplier Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tata Steel / Unbrako"
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded p-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">Part Number / MPN *</label>
              <input
                type="text"
                required
                placeholder="e.g. TS-EN8-RD45"
                value={formData.partNumber}
                onChange={e => setFormData({ ...formData, partNumber: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded p-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">Description</label>
              <input
                type="text"
                placeholder="Specification details"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded p-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">Material Grade</label>
              <input
                type="text"
                placeholder="e.g. EN8 / SS 304"
                value={formData.materialGrade}
                onChange={e => setFormData({ ...formData, materialGrade: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded p-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">Base Price (INR ₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.baseUnitPrice}
                onChange={e => setFormData({ ...formData, baseUnitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-300 rounded p-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                value={formData.leadTimeDays}
                onChange={e => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-white border border-slate-300 rounded p-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-slate-600 mb-1">Lifecycle Status</label>
              <select
                value={formData.lifecycleStatus}
                onChange={e => setFormData({ ...formData, lifecycleStatus: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded p-1.5"
              >
                <option value="ACTIVE">ACTIVE (In Production)</option>
                <option value="NRND">NRND (Not Recommended for New Designs)</option>
                <option value="OBSOLETE">OBSOLETE / Discontinued</option>
                <option value="EOL">EOL (End of Life)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-mono font-bold tracking-wider text-xs cursor-pointer"
              >
                Save To Catalog
              </button>
            </div>
          </form>
        )}

        {/* Catalog Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Part # / MPN</th>
                <th className="py-2.5 px-3">Component Description</th>
                <th className="py-2.5 px-3">Supplier / Location</th>
                <th className="py-2.5 px-3">Lead Time</th>
                <th className="py-2.5 px-3">Unit Price (₹)</th>
                <th className="py-2.5 px-3">Lifecycle</th>
                <th className="py-2.5 px-3">Approved Alternates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredItems.map(item => {
                const isObsolete = item.lifecycleStatus === 'OBSOLETE' || item.lifecycleStatus === 'EOL';
                const isLongLead = item.leadTimeDays > 21;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">{item.partNumber}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.manufacturer}</div>
                    </td>
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="font-medium text-slate-800 truncate" title={item.description}>
                        {item.description}
                      </div>
                      <div className="text-[10px] text-slate-500">Grade: {item.materialGrade || 'Standard'}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{item.supplierName}</div>
                      <div className="text-[10px] text-slate-400">{item.supplierLocation}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.leadTimeDays <= 7
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isLongLead
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        <Clock className="h-3 w-3 mr-1" />
                        {item.leadTimeDays} Days
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      ₹{item.baseUnitPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {isObsolete ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="h-3 w-3 mr-1 text-rose-600" />
                          {item.lifecycleStatus}
                        </span>
                      ) : item.lifecycleStatus === 'NRND' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          NRND
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-500">
                      {item.alternates && item.alternates.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.alternates.map(alt => (
                            <span key={alt} className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                              {alt}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Direct Source Only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> qualified vendor component entries
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-lg cursor-pointer"
          >
            Close Catalog
          </button>
        </div>
      </div>
    </div>
  );
};
