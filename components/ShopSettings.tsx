'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client'; // Adjust your supabase client path if needed
import { Plus, Trash2, Save, Settings, Layers, Package, Tag } from 'lucide-react';

interface ShopService {
  id: string;
  name: string;
  base_price: number;
  pricing_unit: 'per_load' | 'per_kg' | 'flat';
  estimated_minutes: number;
  is_active: boolean;
}

interface ShopAddon {
  id: string;
  name: string;
  price: number;
  inventory_multiplier: number;
  is_active: boolean;
}

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  current_stock: number;
  unit: string;
  consumption_per_load: number;
  auto_deduct: boolean;
}

export default function ShopSettings({ shopId }: { shopId: string }) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'services' | 'addons' | 'inventory'>('services');

  const [services, setServices] = useState<ShopService[]>([]);
  const [addons, setAddons] = useState<ShopAddon[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New item form states
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceMinutes, setNewServiceMinutes] = useState('50');

  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');

  const [newInvName, setNewInvName] = useState('');
  const [newInvStock, setNewInvStock] = useState('');
  const [newInvUnit, setNewInvUnit] = useState('kg');
  const [newInvUsage, setNewInvUsage] = useState('0.065');

  useEffect(() => {
    fetchAllSettings();
  }, [shopId]);

  async function fetchAllSettings() {
    setLoading(true);
    const [servRes, addonRes, invRes] = await Promise.all([
      supabase.from('shop_services').select('*').eq('shop_id', shopId).order('created_at'),
      supabase.from('shop_addons').select('*').eq('shop_id', shopId).order('created_at'),
      supabase.from('inventory').select('*').eq('shop_id', shopId).order('created_at'),
    ]);

    if (servRes.data) setServices(servRes.data);
    if (addonRes.data) setAddons(addonRes.data);
    if (invRes.data) setInventory(invRes.data);
    setLoading(false);
  }

  // --- SERVICE ACTIONS ---
  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!newServiceName || !newServicePrice) return;

    const { error } = await supabase.from('shop_services').insert({
      shop_id: shopId,
      name: newServiceName,
      base_price: parseFloat(newServicePrice),
      estimated_minutes: parseInt(newServiceMinutes) || 50,
      pricing_unit: 'per_load',
    });

    if (!error) {
      setNewServiceName('');
      setNewServicePrice('');
      fetchAllSettings();
    }
  }

  async function handleDeleteService(id: string) {
    await supabase.from('shop_services').delete().eq('id', id);
    fetchAllSettings();
  }

  // --- ADDON ACTIONS ---
  async function handleAddAddon(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddonName || !newAddonPrice) return;

    const { error } = await supabase.from('shop_addons').insert({
      shop_id: shopId,
      name: newAddonName,
      price: parseFloat(newAddonPrice),
      inventory_multiplier: 1.5, // 1.5x soap consumption for comforters/heavy loads
    });

    if (!error) {
      setNewAddonName('');
      setNewAddonPrice('');
      fetchAllSettings();
    }
  }

  async function handleDeleteAddon(id: string) {
    await supabase.from('shop_addons').delete().eq('id', id);
    fetchAllSettings();
  }

  // --- INVENTORY ACTIONS ---
  async function handleAddInventory(e: React.FormEvent) {
    e.preventDefault();
    if (!newInvName || !newInvStock) return;

    const { error } = await supabase.from('inventory').insert({
      shop_id: shopId,
      item_name: newInvName,
      category: 'detergent',
      current_stock: parseFloat(newInvStock),
      unit: newInvUnit,
      consumption_per_load: parseFloat(newInvUsage) || 0.065,
      auto_deduct: true,
    });

    if (!error) {
      setNewInvName('');
      setNewInvStock('');
      fetchAllSettings();
    }
  }

  async function handleDeleteInventory(id: string) {
    await supabase.from('inventory').delete().eq('id', id);
    fetchAllSettings();
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading shop settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" /> Shop Operations Settings
          </h1>
          <p className="text-sm text-gray-500">Customize your services, surcharge chips, and bulk inventory ratios.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex rounded-lg bg-gray-100 p-1 font-medium text-sm">
        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-all ${
            activeTab === 'services' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4" /> Services & Rates
        </button>
        <button
          onClick={() => setActiveTab('addons')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-all ${
            activeTab === 'addons' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Tag className="w-4 h-4" /> Surcharge Chips
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-all ${
            activeTab === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4" /> Bulk Inventory
        </button>
      </div>

      {/* TAB 1: SERVICES & RATES */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <form onSubmit={handleAddService} className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-1.5">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Service Name</label>
              <input
                type="text"
                placeholder="e.g. Regular Wash & Dry"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Base Price (₱)</label>
              <input
                type="number"
                step="0.01"
                placeholder="150"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duration (Mins)</label>
              <input
                type="number"
                placeholder="50"
                value={newServiceMinutes}
                onChange={(e) => setNewServiceMinutes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5 h-9.5">
              <Plus className="w-4 h-4" /> Add Service
            </button>
          </form>

          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {services.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">No services configured yet. Add your first service above.</p>
            ) : (
              services.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    <p className="text-xs text-gray-500">Est. duration: {s.estimated_minutes} mins</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-blue-600">₱{Number(s.base_price).toFixed(2)}</span>
                    <button onClick={() => handleDeleteService(s.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SURCHARGE CHIPS */}
      {activeTab === 'addons' && (
        <div className="space-y-6">
          <form onSubmit={handleAddAddon} className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Surcharge Chip Label</label>
              <input
                type="text"
                placeholder="e.g. + Comforter / Blanket"
                value={newAddonName}
                onChange={(e) => setNewAddonName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Fee (₱)</label>
              <input
                type="number"
                step="0.01"
                placeholder="50"
                value={newAddonPrice}
                onChange={(e) => setNewAddonPrice(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <button type="submit" className="sm:col-span-3 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Surcharge Chip
            </button>
          </form>

          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {addons.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">No surcharge chips configured yet (e.g. Comforters, Heavy Stains).</p>
            ) : (
              addons.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold">
                      {a.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-900">+₱{Number(a.price).toFixed(2)}</span>
                    <button onClick={() => handleDeleteAddon(a.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BULK INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <form onSubmit={handleAddInventory} className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Supply Name</label>
              <input
                type="text"
                placeholder="e.g. Ariel Powder (Sack)"
                value={newInvName}
                onChange={(e) => setNewInvName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Qty</label>
              <input
                type="number"
                step="0.001"
                placeholder="10.0"
                value={newInvStock}
                onChange={(e) => setNewInvStock(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
              <select
                value={newInvUnit}
                onChange={(e) => setNewInvUnit(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="mL">mL</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Usage / Load</label>
              <input
                type="number"
                step="0.001"
                placeholder="0.065"
                value={newInvUsage}
                onChange={(e) => setNewInvUsage(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <button type="submit" className="sm:col-span-5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Bulk Inventory Supply
            </button>
          </form>

          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {inventory.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">No bulk inventory items added yet.</p>
            ) : (
              inventory.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <h3 className="font-semibold text-gray-900">{inv.item_name}</h3>
                    <p className="text-xs text-gray-500">
                      Deduction: {inv.consumption_per_load} {inv.unit} per load
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{Number(inv.current_stock).toFixed(3)} {inv.unit}</span>
                      <p className="text-xs text-emerald-600 font-medium">In Stock</p>
                    </div>
                    <button onClick={() => handleDeleteInventory(inv.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}