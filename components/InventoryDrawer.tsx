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
  const [newItemName, setNewItemName] = useState('');
  const [newStock, setNewStock] = useState('50');
  const [newUnit, setNewUnit] = useState('pcs');

  const fetchInventory = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('shop_id', shopId)
      .order('item_name', { ascending: true });

    if (!error && data) {
      setItems(data as InventoryItem[]);
    }
    setLoading(false);
  }, [shopId, supabase]);

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen, fetchInventory]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || !newItemName.trim()) return;

    const { error } = await supabase.from('inventory').insert({
      shop_id: shopId,
      item_name: newItemName.trim(),
      category: 'detergent',
      current_stock: parseFloat(newStock) || 0,
      unit: newUnit,
      min_threshold: 10,
      consumption_per_load: 1.0,
    });

    if (!error) {
      setNewItemName('');
      setNewStock('50');
      fetchInventory();
    } else {
      alert('Failed to add inventory item.');
    }
  };

  const handleRestock = async (id: string, currentStock: number) => {
    const added = prompt('Enter quantity to restock:', '50');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5 bg-white z-20">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Inventory & Stock</h2>
              <p className="text-xs text-slate-500">Pillar 2: Material Depletion Tracker</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 active:scale-95">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Pro Tier Forecast Banner */}
        {subscriptionTier === 'pro' ? (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 flex items-start gap-3">
            <span className="text-xl">✨</span>
            <div>
              <p className="text-xs font-black text-amber-900 uppercase">Pro Predictive AI Active</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Based on your daily load average, stock depletion rates are synchronized with active wash orders.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
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
              <p className="text-sm font-bold text-slate-600">No inventory items added yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add items like detergent sachets or gas below.</p>
            </div>
          ) : (
            items.map((item) => {
              const isLow = item.current_stock <= item.min_threshold;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-all ${
                    isLow ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-800">{item.item_name}</p>
                      {isLow && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-700 uppercase">
                          <AlertTriangle className="h-3 w-3" /> Low Stock
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                      Category: {item.category} • Uses {item.consumption_per_load} per load
                    </p>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1.5">
                    <p className={`text-base font-black ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                      {item.current_stock} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestock(item.id, Number(item.current_stock))}
                        className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase text-white active:scale-95 flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" /> Restock
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.item_name)}
                        className="rounded-lg bg-red-100 p-1.5 text-red-600 hover:bg-red-200 active:scale-95"
                        title="Delete item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Quick Item Form */}
        <form onSubmit={handleAddItem} className="border-t bg-slate-50 p-4 space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-slate-600">Add New Supply Item</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g., Downy Sachet"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-slate-900"
              required
            />
            <input
              type="number"
              placeholder="Qty"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="w-14 shrink-0 rounded-xl border border-slate-300 px-2 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-slate-900 text-center"
              required
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white active:scale-95 flex items-center gap-1 shadow-md"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}