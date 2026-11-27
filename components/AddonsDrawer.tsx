'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, Package } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

interface ShopAddon {
  id: string;
  name: string;
  price: number;
  inventory_multiplier: number;
  is_active: boolean;
}

interface AddonsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string | null;
}

export default function AddonsDrawer({ isOpen, onClose, shopId }: AddonsDrawerProps) {
  const [addons, setAddons] = useState<ShopAddon[]>([]);
  const [loading, setLoading] = useState(false);

  // New Addon Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [multiplier, setMultiplier] = useState('1.5');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && shopId) {
      fetchAddons();
    }
  }, [isOpen, shopId]);

  const fetchAddons = async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('shop_addons')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setAddons(data);
    }
    setLoading(false);
  };

  const handleCreateAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || !name.trim() || !price) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('shop_addons')
        .insert({
          shop_id: shopId,
          name: name.trim(),
          price: parseFloat(price),
          inventory_multiplier: parseFloat(multiplier) || 1.0,
          is_active: true,
        })
        .select()
        .single();

      if (!error && data) {
        setAddons((prev) => [...prev, data]);
        setName('');
        setPrice('');
        setMultiplier('1.5');
      } else {
        alert('Failed to create addon.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this surcharge chip?')) return;

    const { error } = await supabase.from('shop_addons').delete().eq('id', id);
    if (!error) {
      setAddons((prev) => prev.filter((a) => a.id !== id));
    } else {
      alert('Failed to delete addon.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-black tracking-tight">Surcharge Chips Manager</h2>
              <p className="text-[11px] text-slate-400">Configure custom add-ons & multipliers</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-800 p-2 text-slate-300 hover:text-white active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Quick Create Form */}
          <form onSubmit={handleCreateAddon} className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-700">Add New Surcharge Chip</p>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Chip Name</label>
              <input
                type="text"
                placeholder="e.g. Comforter, Extra Bleach"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Price (₱)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Inventory Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="1.5"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> {isSubmitting ? 'Adding...' : 'Add Surcharge Chip'}
            </button>
          </form>

          {/* Addons List */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
              Active Shop Chips ({addons.length})
            </p>

            {loading ? (
              <p className="py-8 text-center text-xs font-bold text-slate-400">Loading chips...</p>
            ) : addons.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="text-xs font-bold text-slate-500">No surcharge chips created yet.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Use the form above to add your first chip.</p>
              </div>
            ) : (
              addons.map((addon) => (
                <div key={addon.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">{addon.name}</span>
                      <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-black">
                        +₱{Number(addon.price).toFixed(0)}
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
                      <Package className="h-3 w-3 text-slate-500" /> Inventory Multiplier: {addon.inventory_multiplier}x
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteAddon(addon.id)}
                    className="rounded-xl p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Delete chip"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
}