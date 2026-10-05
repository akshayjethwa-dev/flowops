// src/components/quotations/LineItemsTable.tsx

import React from 'react';
import { QuoteItem } from '../../types';
import { Plus, Trash2, Hash, Percent, DollarSign, Layers } from 'lucide-react';
import { calculateLineItemAmount } from '../../utils/quotationUtils';

interface LineItemsTableProps {
  items: QuoteItem[];
  onChangeItems: (items: QuoteItem[]) => void;
}

export const LineItemRow: React.FC<{
  item: QuoteItem;
  index: number;
  onUpdate: (updated: QuoteItem) => void;
  onRemove: () => void;
}> = ({ item, index, onUpdate, onRemove }) => {
  const handleFieldChange = (field: keyof QuoteItem, value: any) => {
    const updated = { ...item, [field]: value };
    // Recalculate row total on edit
    updated.total = calculateLineItemAmount({
      quantity: field === 'quantity' ? Number(value) : item.quantity,
      unitPrice: field === 'unitPrice' ? Number(value) : item.unitPrice,
      discount: field === 'discount' ? Number(value) : (item.discount || 0),
      gstPercent: field === 'gstPercent' ? Number(value) : item.gstPercent,
    });
    onUpdate(updated);
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
      {/* Index */}
      <td className="p-3 text-slate-400 font-mono text-[11px] text-center w-8">
        {index + 1}
      </td>

      {/* Description */}
      <td className="p-3">
        <textarea
          rows={2}
          value={item.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="Enter technical specifications & product model..."
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-1 focus:ring-sky-500/30 text-xs text-slate-800 font-semibold leading-relaxed resize-none focus:outline-hidden"
        />
      </td>

      {/* HSN */}
      <td className="p-3 w-28">
        <input
          type="text"
          value={item.hsn || ''}
          onChange={(e) => handleFieldChange('hsn', e.target.value)}
          placeholder="HSN/SAC"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:bg-white focus:ring-1 focus:ring-sky-500/30 text-xs text-center font-mono focus:outline-hidden"
        />
      </td>

      {/* Quantity */}
      <td className="p-3 w-20">
        <input
          type="number"
          min={1}
          value={item.quantity || ''}
          onChange={(e) => handleFieldChange('quantity', Math.max(1, Number(e.target.value)))}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 focus:bg-white focus:ring-1 focus:ring-sky-500/30 text-xs text-center font-mono font-bold focus:outline-hidden"
        />
      </td>

      {/* Unit */}
      <td className="p-3 w-20">
        <select
          value={item.unit || 'PCS'}
          onChange={(e) => handleFieldChange('unit', e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 focus:bg-white focus:ring-1 focus:ring-sky-500/30 text-xs text-center focus:outline-hidden"
        >
          <option value="PCS">pcs</option>
          <option value="KG">kg</option>
          <option value="TONS">tons</option>
          <option value="MTRS">mtrs</option>
          <option value="BOX">box</option>
          <option value="SETS">sets</option>
        </select>
      </td>

      {/* Unit Price */}
      <td className="p-3 w-28">
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">₹</span>
          <input
            type="number"
            min={0}
            value={item.unitPrice || ''}
            onChange={(e) => handleFieldChange('unitPrice', Math.max(0, Number(e.target.value)))}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-1 py-1.5 focus:bg-white focus:ring-1 focus:ring-sky-500/30 text-xs text-right font-mono focus:outline-hidden font-bold"
          />
        </div>
      </td>

      {/* Discount */}
      <td className="p-3 w-24">
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">₹</span>
          <input
            type="number"
            min={0}
            value={item.discount || ''}
            onChange={(e) => handleFieldChange('discount', Math.max(0, Number(e.target.value)))}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-1 py-1.5 focus:bg-white focus:ring-1 focus:ring-sky-500/30 text-xs text-right font-mono focus:outline-hidden text-rose-600"
          />
        </div>
      </td>

      {/* Tax rate */}
      <td className="p-3 w-24">
        <div className="relative">
          <select
            value={item.gstPercent || 0}
            onChange={(e) => handleFieldChange('gstPercent', Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:bg-white focus:ring-1 focus:ring-sky-500/30 text-xs font-mono focus:outline-hidden"
          >
            <option value={0}>0%</option>
            <option value={5}>5%</option>
            <option value={12}>12%</option>
            <option value={18}>18%</option>
            <option value={28}>28%</option>
          </select>
        </div>
      </td>

      {/* Total Amount */}
      <td className="p-3 text-right font-mono font-bold text-slate-800 w-28">
        ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
      </td>

      {/* Clear Button */}
      <td className="p-3 text-center w-10">
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-rose-500 rounded p-1 transition-colors cursor-pointer"
          title="Remove line item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
};

export const LineItemsTable: React.FC<LineItemsTableProps> = ({ items, onChangeItems }) => {
  const handleAddNewItem = () => {
    const newItem: QuoteItem = {
      id: `itm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: '',
      hsn: '7308', // default steel fabricated structural parts
      quantity: 1,
      unit: 'PCS',
      unitPrice: 0,
      discount: 0,
      gstPercent: 18,
      total: 0,
    };
    onChangeItems([...items, newItem]);
  };

  const handleUpdateItem = (index: number, updated: QuoteItem) => {
    const itemsCopy = [...items];
    itemsCopy[index] = updated;
    onChangeItems(itemsCopy);
  };

  const handleRemoveItem = (index: number) => {
    onChangeItems(items.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 py-3 px-4 rounded-lg">
        <h4 className="text-xs uppercase font-mono tracking-wider font-extrabold text-slate-600 flex items-center space-x-1.5">
          <Layers className="h-4 w-4 text-sky-500" />
          <span>Line Items Breakdown</span>
        </h4>
        <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
          {items.length} Component Lines Listed
        </span>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-3xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-bold font-mono uppercase text-slate-500 border-b border-slate-200">
              <th className="p-3 text-center w-8">#</th>
              <th className="p-3">Specification / Particular Description *</th>
              <th className="p-3 w-28">HSN Code</th>
              <th className="p-3 w-20 text-center">Qty *</th>
              <th className="p-3 w-20 text-center">Unit</th>
              <th className="p-3 w-28 text-right">Rate *</th>
              <th className="p-3 w-24 text-right">Discount</th>
              <th className="p-3 w-24 text-center">GST Tax %</th>
              <th className="p-3 text-right w-28">Line Total</th>
              <th className="p-3 text-center w-10">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <LineItemRow
                key={item.id}
                item={item}
                index={index}
                onUpdate={(upd) => handleUpdateItem(index, upd)}
                onRemove={() => handleRemoveItem(index)}
              />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-mono text-xs">
                  Your Quotation is currently empty. Click "Add Component Particular Line" below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="block md:hidden space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 relative shadow-2xs">
            {/* Index & Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/65">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400">
                Item Line #{index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="text-rose-500 hover:text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1 text-[10px] font-bold uppercase transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-450 block">particular description *</label>
              <textarea
                rows={2}
                value={item.name}
                onChange={(e) => handleUpdateItem(index, { ...item, name: e.target.value })}
                placeholder="Enter specifications..."
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-sky-505 text-xs text-slate-800 font-medium"
              />
            </div>

            {/* Grid for parameters */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-450 mb-1 block">HSN / SAC</label>
                <input
                  type="text"
                  value={item.hsn || ''}
                  onChange={(e) => handleUpdateItem(index, { ...item, hsn: e.target.value })}
                  placeholder="HSN"
                  className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-center"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-450 mb-1 block">Unit</label>
                <select
                  value={item.unit || 'PCS'}
                  onChange={(e) => handleUpdateItem(index, { ...item, unit: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded p-1.5 text-center"
                >
                  <option value="PCS">pcs</option>
                  <option value="KG">kg</option>
                  <option value="TONS">tons</option>
                  <option value="MTRS">mtrs</option>
                  <option value="BOX">box</option>
                  <option value="SETS">sets</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-450 mb-1 block">Qty *</label>
                <input
                  type="number"
                  min={1}
                  value={item.quantity || ''}
                  onChange={(e) => {
                    const qty = Math.max(1, Number(e.target.value));
                    const total = calculateLineItemAmount({ ...item, quantity: qty });
                    handleUpdateItem(index, { ...item, quantity: qty, total });
                  }}
                  className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-center font-bold"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-450 mb-1 block">unit rate (₹) *</label>
                <input
                  type="number"
                  min={0}
                  value={item.unitPrice || ''}
                  onChange={(e) => {
                    const rate = Math.max(0, Number(e.target.value));
                    const total = calculateLineItemAmount({ ...item, unitPrice: rate });
                    handleUpdateItem(index, { ...item, unitPrice: rate, total });
                  }}
                  className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono font-bold text-right"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-450 mb-1 block">total discount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={item.discount || ''}
                  onChange={(e) => {
                    const d = Math.max(0, Number(e.target.value));
                    const total = calculateLineItemAmount({ ...item, discount: d });
                    handleUpdateItem(index, { ...item, discount: d, total });
                  }}
                  className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-right text-rose-600 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-450 mb-1 block">GST Rate %</label>
                <select
                  value={item.gstPercent || 0}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    const total = calculateLineItemAmount({ ...item, gstPercent: r });
                    handleUpdateItem(index, { ...item, gstPercent: r, total });
                  }}
                  className="w-full bg-white border border-slate-200 rounded p-1.5 font-mono text-center font-bold"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>
            </div>

            {/* Line total summary */}
            <div className="pt-2 border-t border-slate-200/70 flex justify-between items-center">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Line Item Total:</span>
              <span className="font-mono font-extrabold text-sm text-slate-800">
                ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
              </span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center font-mono py-6 text-slate-400 text-xs bg-slate-50 rounded border border-dashed border-slate-200">
            No items added yet. Append component cards.
          </p>
        )}
      </div>

      {/* APPEND ACTION BUTTON */}
      <button
        type="button"
        onClick={handleAddNewItem}
        className="w-full border-2 border-dashed border-slate-300 hover:border-sky-500 hover:bg-sky-50/20 text-slate-500 hover:text-sky-650 py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-3xs"
      >
        <Plus className="h-4 w-4" />
        <span>Add Component Particular Line</span>
      </button>
    </div>
  );
};
