'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Package, AlertTriangle, Plus, RefreshCw, Trash2 } from 'lucide-react';

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  current_stock: number;
  unit: string;
  min_threshold: number;
  consumption_per_load: number;
}

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string | null;
  subscriptionTier: string;
}

export default function InventoryDrawer({
  isOpen,
  onClose,
  shopId,
  subscriptionTier,
}: InventoryDrawerProps) {
  const supabase = createClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inventory form state & submission guard lock
  const [newItemName, setNewItemName] = useState('');
  const [newStock, setNewStock] = useState('2000');
  const [newUnit, setNewUnit] = useState('g');
  const [newConsumption, setNewConsumption] = useState('65');
  const [newCategory, setNewCategory] = useState('detergent');
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  const fetchInventory = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('shop_id', shopId)
      .order('item_name', { ascending: true });

    if (!error && data) {
      // Low-stock priority sorting: Low stock items float to the very top
      const sortedItems = (data as InventoryItem[]).sort((a, b) => {
        const aIsLow = a.current_stock <= a.min_threshold ? 1 : 0;
        const bIsLow = b.current_stock <= b.min_threshold ? 1 : 0;
        return bIsLow - aIsLow;
      });
      setItems(sortedItems);
    }
    setLoading(false);
  }, [shopId, supabase]);

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen, fetchInventory]);

  const getUsageHint = () => {
    if (newUnit === 'kg') return '(in grams, e.g. 65)';
    if (newUnit === 'L') return '(in milliliters, e.g. 50)';
    if (newUnit === 'g' || newUnit === 'mL') return '(e.g. 50)';
    return '(e.g. 1 or 2)';
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingItem || !shopId || !newItemName.trim()) return;

    setIsSubmittingItem(true);
    try {
      let doseValue = parseFloat(newConsumption) || 0;
      if (doseValue < 0) doseValue = 0;
      if (doseValue > 1000) doseValue = 1000;

      const { error } = await supabase.from('inventory').insert({
        shop_id: shopId,
        item_name: newItemName.trim(),
        category: newCategory,
        current_stock: parseFloat(newStock) || 0,
        unit: newUnit,
        min_threshold: 10,
        consumption_per_load: doseValue,
        auto_deduct: true,
      });

      if (!error) {
        setNewItemName('');
        setNewStock('2000');
        setNewConsumption('65');
        fetchInventory();
      } else {
        alert('Failed to add inventory item.');
      }
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleRestock = async (id: string, currentStock: number, unit: string) => {
    const added = prompt(`Enter quantity to restock (${unit}):`, unit === 'g' || unit === 'mL' ? '1000' : '10');
    if (!added || isNaN(Number(added))) return;

    const updatedStock = currentStock + Number(added);
    const { error } = await supabase
      .from('inventory')
      .update({ current_stock: updatedStock })
      .eq('id', id);

    if (!error) {
      fetchInventory();
    }
  };

  const handleDeleteItem = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}" from inventory?`)) return;

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchInventory();
    } else {
      alert('Failed to delete item.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3 backdrop-blur-xs">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5 bg-white z-20 shrink-0">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Inventory & Stock</h2>
              <p className="text-xs text-slate-500">Low stock items prioritized on top</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 active:scale-95">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Pro Tier Forecast Banner */}
        {subscriptionTier === 'pro' ? (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 flex items-start gap-3 shrink-0">
            <span className="text-xl">✨</span>
            <div>
              <p className="text-xs font-black text-amber-900 uppercase">Pro Predictive AI Active</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Stock depletion rates are synchronized with active wash loads and comforter multipliers.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between shrink-0">
            <div className="text-xs">
              <span className="font-bold text-amber-400 uppercase">Free Tier:</span> Basic Stock Ledger
            </div>
            <span className="text-[10px] bg-amber-500 text-slate-900 font-black px-2 py-0.5 rounded-full">
              PRO UNLOCKS FORECASTS
            </span>
          </div>
        )}

        {/* Inventory List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="py-10 text-center text-sm font-bold text-slate-400">Loading inventory stock...</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No inventory items added yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add detergent sacks, softeners, or sachets below.</p>
            </div>
          ) : (
            items.map((item) => {
              const isLow = item.current_stock <= item.min_threshold;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 shadow-xs transition-all space-y-3 ${
                    isLow ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-800 break-words">{item.item_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        {item.category} • Uses {item.consumption_per_load} {item.unit === 'kg' ? 'g' : item.unit === 'L' ? 'mL' : item.unit} / load
                      </p>
                    </div>

                    {isLow && (
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black text-red-700 uppercase animate-pulse">
                        <AlertTriangle className="h-3 w-3" /> Low Stock
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Current Stock</p>
                      <p className={`text-base font-black ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                        {Number(item.current_stock).toFixed(item.unit === 'pcs' || item.unit === 'scoops' ? 0 : 1)}{' '}
                        <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestock(item.id, Number(item.current_stock), item.unit)}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-white active:scale-95 flex items-center gap-1 shadow-xs"
                      >
                        <RefreshCw className="h-3 w-3" /> Restock
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.item_name)}
                        className="rounded-xl bg-red-100 p-2 text-red-600 hover:bg-red-200 active:scale-95 border border-red-200"
                        title="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add New Supply Form with Fixed Single-Line Header Alignment */}
        <form onSubmit={handleAddItem} className="border-t bg-slate-50 p-4 space-y-3 shrink-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">Add Supply Item (Precision Ledger)</p>
          
          <div>
            <input
              type="text"
              placeholder="Supply Name (e.g., Ariel Powder Sack)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
              required
            />
          </div>

          {/* Grid layout with single-line truncated labels to ensure perfect horizontal alignment */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block truncate" title="Total Stock Qty">
                Stock Qty
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max="10000"
                placeholder="2000"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block truncate" title="Unit">
                Unit
              </label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="mL">mL</option>
                <option value="scoops">Scoop(s)</option>
                <option value="sackets">Sacket(s)</option>
                <option value="pcs">Pcs</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block truncate" title="Dose per load">
                Dose / Load
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max="1000"
                placeholder="65"
                value={newConsumption}
                onChange={(e) => setNewConsumption(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingItem}
            className="w-full rounded-xl bg-blue-600 py-3 text-xs font-black text-white shadow-md active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {isSubmittingItem ? 'SAVING...' : 'ADD SUPPLY TO LEDGER'}
          </button>
        </form>

      </div>
    </div>
  );
}