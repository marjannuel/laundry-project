'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Trash2, Settings, Layers, Package, Tag, X } from 'lucide-react';

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

interface ShopSettingsModalProps {
  shopId: string;
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: () => void; // Optional callback to refresh New Laundry modal options
}

export default function ShopSettingsModal({
  shopId,
  isOpen,
  onClose,
  onSettingsUpdated,
}: ShopSettingsModalProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'services' | 'addons' | 'inventory'>('services');

  const [services, setServices] = useState<ShopService[]>([]);
  const [addons, setAddons] = useState<ShopAddon[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Service form states
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceMinutes, setNewServiceMinutes] = useState('50');

  // Addon form states
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');
  const [newAddonMultiplier, setNewAddonMultiplier] = useState('1.5');

  // Inventory form states
  const [newInvName, setNewInvName] = useState('');
  const [newInvStock, setNewInvStock] = useState('');
  const [newInvUnit, setNewInvUnit] = useState('kg');
  const [newInvUsage, setNewInvUsage] = useState('0.065');

  useEffect(() => {
    if (isOpen && shopId) {
      fetchAllSettings();
    }
  }, [isOpen, shopId]);

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
      name: newServiceName.trim(),
      base_price: parseFloat(newServicePrice),
      estimated_minutes: parseInt(newServiceMinutes) || 50,
      pricing_unit: 'per_load',
    });

    if (!error) {
      setNewServiceName('');
      setNewServicePrice('');
      await fetchAllSettings();
      onSettingsUpdated?.();
    }
  }

  async function handleDeleteService(id: string) {
    await supabase.from('shop_services').delete().eq('id', id);
    await fetchAllSettings();
    onSettingsUpdated?.();
  }

  // --- ADDON ACTIONS ---
  async function handleAddAddon(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddonName || !newAddonPrice) return;

    const { error } = await supabase.from('shop_addons').insert({
      shop_id: shopId,
      name: newAddonName.trim(),
      price: parseFloat(newAddonPrice),
      inventory_multiplier: parseFloat(newAddonMultiplier) || 1.0,
    });

    if (!error) {
      setNewAddonName('');
      setNewAddonPrice('');
      await fetchAllSettings();
      onSettingsUpdated?.();
    }
  }

  async function handleDeleteAddon(id: string) {
    await supabase.from('shop_addons').delete().eq('id', id);
    await fetchAllSettings();
    onSettingsUpdated?.();
  }

  // --- INVENTORY ACTIONS ---
  async function handleAddInventory(e: React.FormEvent) {
    e.preventDefault();
    if (!newInvName || !newInvStock) return;

    const { error } = await supabase.from('inventory').insert({
      shop_id: shopId,
      item_name: newInvName.trim(),
      category: 'detergent',
      current_stock: parseFloat(newInvStock),
      unit: newInvUnit,
      consumption_per_load: parseFloat(newInvUsage) || 0,
      auto_deduct: parseFloat(newInvUsage) > 0,
    });

    if (!error) {
      setNewInvName('');
      setNewInvStock('');
      await fetchAllSettings();
      onSettingsUpdated?.();
    }
  }

  async function handleDeleteInventory(id: string) {
    await supabase.from('inventory').delete().eq('id', id);
    await fetchAllSettings();
    onSettingsUpdated?.();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
      {/* Bottom Sheet on Mobile, Centered Card on Desktop */}
      <div className="bg-gray-50 w-full sm:max-w-2xl h-[90dvh] sm:h-[82vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Sticky Header */}
        <div className="bg-white px-4 py-3.5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base leading-tight">Shop Settings</h2>
              <p className="text-xs text-gray-500">Services, surcharges & bulk scoop ratios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 active:bg-gray-200"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sticky Tab Bar */}
        <div className="bg-white px-3 py-2 border-b shrink-0">
          <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all ${
                activeTab === 'services' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Services
            </button>
            <button
              onClick={() => setActiveTab('addons')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all ${
                activeTab === 'addons' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600'
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> Surcharges
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all ${
                activeTab === 'inventory' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600'
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Bulk Stock
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading configurations...</div>
          ) : (
            <>
              {/* TAB 1: SERVICES */}
              {activeTab === 'services' && (
                <>
                  <form onSubmit={handleAddService} className="bg-white p-3.5 rounded-xl border space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Service Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Regular Wash & Dry"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Base Price (₱)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="150"
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Est. Mins</label>
                        <input
                          type="number"
                          placeholder="50"
                          value={newServiceMinutes}
                          onChange={(e) => setNewServiceMinutes(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add Service
                    </button>
                  </form>

                  <div className="bg-white rounded-xl border divide-y">
                    {services.length === 0 ? (
                      <p className="p-6 text-center text-xs text-gray-400">No services added yet.</p>
                    ) : (
                      services.map((s) => (
                        <div key={s.id} className="p-3.5 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{s.name}</p>
                            <p className="text-xs text-gray-500">{s.estimated_minutes} mins</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm text-blue-600">₱{Number(s.base_price).toFixed(2)}</span>
                            <button
                              onClick={() => handleDeleteService(s.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: SURCHARGE CHIPS */}
              {activeTab === 'addons' && (
                <>
                  <form onSubmit={handleAddAddon} className="bg-white p-3.5 rounded-xl border space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Surcharge Chip Label</label>
                      <input
                        type="text"
                        placeholder="e.g. + Comforter or + Blanket"
                        value={newAddonName}
                        onChange={(e) => setNewAddonName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Extra Fee (₱)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="50"
                          value={newAddonPrice}
                          onChange={(e) => setNewAddonPrice(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Soap Multiplier</label>
                        <select
                          value={newAddonMultiplier}
                          onChange={(e) => setNewAddonMultiplier(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1.0">1.0x (Normal)</option>
                          <option value="1.5">1.5x (+50% soap)</option>
                          <option value="2.0">2.0x (Double soap)</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add Surcharge Chip
                    </button>
                  </form>

                  <div className="bg-white rounded-xl border divide-y">
                    {addons.length === 0 ? (
                      <p className="p-6 text-center text-xs text-gray-400">No surcharge chips added yet.</p>
                    ) : (
                      addons.map((a) => (
                        <div key={a.id} className="p-3.5 flex items-center justify-between">
                          <div>
                            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                              {a.name}
                            </span>
                            <p className="text-[11px] text-gray-400 mt-1">{a.inventory_multiplier}x detergent usage</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm text-gray-900">+₱{Number(a.price).toFixed(2)}</span>
                            <button
                              onClick={() => handleDeleteAddon(a.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* TAB 3: BULK INVENTORY */}
              {activeTab === 'inventory' && (
                <>
                  <form onSubmit={handleAddInventory} className="bg-white p-3.5 rounded-xl border space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Supply Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Bulk Powder Detergent (Sack)"
                        value={newInvName}
                        onChange={(e) => setNewInvName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Qty</label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="10.0"
                          value={newInvStock}
                          onChange={(e) => setNewInvStock(e.target.value)}
                          className="w-full border rounded-lg px-2.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
                        <select
                          value={newInvUnit}
                          onChange={(e) => setNewInvUnit(e.target.value)}
                          className="w-full border rounded-lg px-2 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="mL">mL</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Scoop / Load</label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="0.065"
                          value={newInvUsage}
                          onChange={(e) => setNewInvUsage(e.target.value)}
                          className="w-full border rounded-lg px-2.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add Supply Item
                    </button>
                  </form>

                  <div className="bg-white rounded-xl border divide-y">
                    {inventory.length === 0 ? (
                      <p className="p-6 text-center text-xs text-gray-400">No bulk supplies added yet.</p>
                    ) : (
                      inventory.map((inv) => (
                        <div key={inv.id} className="p-3.5 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{inv.item_name}</p>
                            <p className="text-xs text-gray-500">
                              Uses {inv.consumption_per_load} {inv.unit} / load
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-sm text-gray-900">
                                {Number(inv.current_stock).toFixed(3)} {inv.unit}
                              </p>
                              <p className="text-[11px] text-emerald-600 font-medium">
                                ~{inv.consumption_per_load > 0 ? Math.floor(inv.current_stock / inv.consumption_per_load) : '∞'} loads left
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteInventory(inv.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="bg-white px-4 py-3 border-t shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}