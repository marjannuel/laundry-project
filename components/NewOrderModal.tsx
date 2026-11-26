'use client';

import { useState, useMemo, useEffect } from 'react';
import { ServiceType, PaymentMethod, Order } from '@/types/laundry';
import { X, Plus, Minus, Check, User, Sparkles, Package, Tag, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

export interface CustomerProfile {
  id: string;
  shop_id: string;
  nickname: string;
  phone_number?: string;
  total_visits: number;
  avg_interval_days?: number;
}

interface ShopService {
  id: string;
  name: string;
  base_price: number;
  estimated_minutes: number;
}

interface ShopAddon {
  id: string;
  name: string;
  price: number;
  inventory_multiplier: number;
}

interface InventoryItem {
  id: string;
  item_name: string;
  current_stock: number;
  unit: string;
  consumption_per_load: number;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOrders: Order[];
  shopId?: string;
  onCreateOrder: (payload: {
    tag_number: string;
    customer_name: string;
    customer_id?: string;
    service_id?: string;
    service_type: ServiceType | string;
    addons_snapshot?: any[];
    load_count: number;
    amount: number;
    payment_method: PaymentMethod;
    estimated_ready_at: string;
  }) => Promise<void>;
}

export default function NewOrderModal({
  isOpen,
  onClose,
  activeOrders,
  shopId,
  onCreateOrder,
}: NewOrderModalProps) {
  // Dynamic Catalog State
  const [services, setServices] = useState<ShopService[]>([]);
  const [addons, setAddons] = useState<ShopAddon[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  
  const [loadCount, setLoadCount] = useState(1);
  const [customAmount, setCustomAmount] = useState<string>(''); // String state allows clean clearing/backspacing
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('unpaid');
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  
  // CRM State
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Inventory State
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedAddonsInventory, setSelectedAddonsInventory] = useState<Record<string, boolean>>({});

  // Quick Inline Service Creator State (Time estimate removed for Agentic AI)
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [isCreatingService, setIsCreatingService] = useState(false);

  useEffect(() => {
    if (isOpen && shopId) {
      fetchShopCatalog();
      fetchCustomers();
      fetchInventory();
      setSelectedAddonIds([]);
      setCustomAmount('');
      setIsAddingService(false);
    }
  }, [isOpen, shopId]);

  const fetchShopCatalog = async () => {
    if (!shopId) return;
    const [servRes, addonRes] = await Promise.all([
      supabase.from('shop_services').select('*').eq('shop_id', shopId).eq('is_active', true),
      supabase.from('shop_addons').select('*').eq('shop_id', shopId).eq('is_active', true),
    ]);

    if (servRes.data && servRes.data.length > 0) {
      setServices(servRes.data);
      setSelectedServiceId((prev) => 
        servRes.data.some(s => s.id === prev) ? prev : servRes.data[0].id
      );
    } else {
      setServices([]);
      setSelectedServiceId('');
    }

    if (addonRes.data) {
      setAddons(addonRes.data);
    }
  };

  const fetchCustomers = async () => {
    if (!shopId) return;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_visits', { ascending: false });

    if (!error && data) {
      setCustomers(data);
    }
  };

  const fetchInventory = async () => {
    if (!shopId) return;
    const { data, error } = await supabase
      .from('inventory')
      .select('id, item_name, current_stock, unit, consumption_per_load')
      .eq('shop_id', shopId);

    if (!error && data) {
      setInventoryItems(data);
      const defaults: Record<string, boolean> = {};
      data.forEach((item) => {
        if (item.item_name.toLowerCase().includes('detergent') || item.item_name.toLowerCase().includes('powder')) {
          defaults[item.id] = true;
        }
      });
      setSelectedAddonsInventory(defaults);
    }
  };

  // Quick inline creation (fixed time estimate default to 50 mins behind the scenes)
  const handleQuickCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingService || !shopId || !newServiceName || !newServicePrice) return;

    setIsCreatingService(true);
    try {
      const { data, error } = await supabase
        .from('shop_services')
        .insert({
          shop_id: shopId,
          name: newServiceName.trim(),
          base_price: parseFloat(newServicePrice),
          estimated_minutes: 50, // Default baseline for AI queue calculation
          pricing_unit: 'per_load',
        })
        .select()
        .single();

      if (!error && data) {
        setServices((prev) => {
          if (prev.some((s) => s.id === data.id)) return prev;
          return [...prev, data];
        });
        setSelectedServiceId(data.id);
        setNewServiceName('');
        setNewServicePrice('');
        setIsAddingService(false);
      }
    } finally {
      setIsCreatingService(false);
    }
  };

  const handleDeleteService = async (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this service type?')) return;

    const { error } = await supabase.from('shop_services').delete().eq('id', serviceId);
    if (!error) {
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      if (selectedServiceId === serviceId) {
        const remaining = services.filter((s) => s.id !== serviceId);
        setSelectedServiceId(remaining.length > 0 ? remaining[0].id : '');
      }
    } else {
      alert('Failed to delete service.');
    }
  };

  const nextAutoTag = useMemo(() => {
    const todayString = new Date().toDateString();
    const todaysOrders = activeOrders.filter((order) => {
      return new Date(order.created_at).toDateString() === todayString;
    });

    const usedTags = new Set(todaysOrders.map((o) => o.tag_number));
    let num = 1;
    while (usedTags.has(`Basket #${num}`)) {
      num++;
    }
    return `Basket #${num}`;
  }, [activeOrders]);

  // Calculate pricing
  const currentService = services.find((s) => s.id === selectedServiceId);
  const baseServicePrice = currentService ? Number(currentService.base_price) * loadCount : 0;
  
  const surchargeAddonsTotal = selectedAddonIds.reduce((sum, addonId) => {
    const addon = addons.find((a) => a.id === addonId);
    return sum + (addon ? Number(addon.price) : 0);
  }, 0);

  const calculatedTotal = baseServicePrice + surchargeAddonsTotal;
  const finalAmount = customAmount !== '' ? Math.max(0, parseInt(customAmount, 10) || 0) : calculatedTotal;

  // Queue Estimator
  const activeQueueLoads = activeOrders
    .filter((o) => o.status === 'queued' || o.status === 'washing')
    .reduce((sum, o) => sum + o.load_count, 0);

  const serviceMins = currentService ? currentService.estimated_minutes * loadCount : 50 * loadCount;
  const estimatedMinutes = serviceMins + activeQueueLoads * 15;
  const estimatedReadyDate = new Date(Date.now() + estimatedMinutes * 60_000);

  const filteredCustomers = useMemo(() => {
    if (!customerName.trim() || selectedCustomerId) return [];
    return customers.filter((c) =>
      c.nickname.toLowerCase().includes(customerName.toLowerCase())
    );
  }, [customerName, customers, selectedCustomerId]);

  if (!isOpen) return null;

  const handleSelectCustomer = (customer: CustomerProfile) => {
    setCustomerName(customer.nickname);
    setSelectedCustomerId(customer.id);
    setIsSearchingCustomer(false);
  };

  const toggleInventoryAddon = (id: string) => {
    setSelectedAddonsInventory((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSurchargeAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddQuickAmount = (increment: number) => {
    const current = customAmount !== '' ? parseInt(customAmount, 10) || 0 : calculatedTotal;
    setCustomAmount(String(current + increment));
  };

  const handleSave = async () => {
    if (!currentService) {
      alert('Please select or create a service first.');
      return;
    }

    setSubmitting(true);
    try {
      const finalName = customerName.trim() || 'Walk-in Student';
      let customerIdToSave = selectedCustomerId;

      if (shopId && finalName !== 'Walk-in Student') {
        const existing = customers.find(
          (c) => c.nickname.toLowerCase() === finalName.toLowerCase()
        );

        if (existing) {
          customerIdToSave = existing.id;
          await supabase
            .from('customers')
            .update({ total_visits: existing.total_visits + 1 })
            .eq('id', existing.id);
        } else {
          const { data: newCust, error: custError } = await supabase
            .from('customers')
            .insert({
              shop_id: shopId,
              nickname: finalName,
              total_visits: 1,
            })
            .select()
            .single();

          if (!custError && newCust) {
            customerIdToSave = newCust.id;
          }
        }
      }

      if (shopId) {
        for (const item of inventoryItems) {
          if (selectedAddonsInventory[item.id]) {
            const matchedAddon = selectedAddonIds
              .map(id => addons.find(a => a.id === id))
              .find(a => a?.inventory_multiplier && a.inventory_multiplier > 1.0);
            
            const multiplier = matchedAddon ? matchedAddon.inventory_multiplier : 1.0;
            
            // Normalized consumption calculation: 
            // If stock is in kg/L but dose was entered in grams/mL (e.g. >= 10), convert it down automatically!
            let rawConsumption = Number(item.consumption_per_load || 1.0);
            if ((item.unit === 'kg' || item.unit === 'L') && rawConsumption >= 10) {
              rawConsumption = rawConsumption / 1000;
            }

            const consumedAmount = loadCount * rawConsumption * multiplier;
            const newStock = Math.max(0, Number(item.current_stock) - consumedAmount);

            await supabase
              .from('inventory')
              .update({ current_stock: Number(newStock.toFixed(3)) })
              .eq('id', item.id);
          }
        }
      }

      const addonsSnapshot = selectedAddonIds
        .map(id => addons.find(a => a.id === id))
        .filter(Boolean);

      await onCreateOrder({
        tag_number: nextAutoTag,
        customer_name: finalName,
        customer_id: customerIdToSave,
        service_id: currentService.id,
        service_type: currentService.name,
        addons_snapshot: addonsSnapshot,
        load_count: loadCount,
        amount: finalAmount,
        payment_method: paymentMethod,
        estimated_ready_at: estimatedReadyDate.toISOString(),
      });

      setCustomerName('');
      setSelectedCustomerId(undefined);
      setLoadCount(1);
      setSelectedAddonIds([]);
      setCustomAmount('');
      setPaymentMethod('unpaid');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3 backdrop-blur-xs">
      <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b p-4 bg-slate-900 text-white shrink-0">
          <div>
            <h2 className="text-base font-black tracking-tight">Log New Laundry</h2>
            <p className="text-[11px] text-slate-400">Custom services & analogical pricing</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-800 p-2 text-slate-300 hover:text-white active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Customer Name Input */}
          <div className="relative">
            <label className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center justify-between">
              <span>Customer / Student Name</span>
              {selectedCustomerId && (
                <span className="text-emerald-600 font-black flex items-center gap-1 text-[10px]">
                  <Sparkles className="h-3 w-3" /> Regular CRM Profile Linked
                </span>
              )}
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setSelectedCustomerId(undefined);
                setIsSearchingCustomer(true);
              }}
              onFocus={() => setIsSearchingCustomer(true)}
              placeholder="e.g., John (BSCS) or Walk-in"
              className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base font-bold text-slate-800 focus:border-slate-900 focus:outline-none bg-slate-50"
            />

            {isSearchingCustomer && filteredCustomers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-2xl border-2 border-slate-200 bg-white shadow-lg z-30">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-black text-slate-900">{c.nickname}</p>
                        <p className="text-[10px] text-slate-500">{c.total_visits} total visits</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Regular
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tag & Est Ready Info */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-slate-900 px-3 py-1.5 text-lg font-black text-white">
                {nextAutoTag}
              </span>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Est. Ready Time</p>
                <p className="text-xs font-bold text-slate-700">
                  {estimatedReadyDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* DYNAMIC SERVICE SELECTOR (Time Estimate input removed) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">Service Type</label>
              <button
                type="button"
                onClick={() => setIsAddingService(!isAddingService)}
                className={`text-xs font-bold flex items-center gap-1 ${isAddingService ? 'text-red-600' : 'text-blue-600 hover:underline'}`}
              >
                {isAddingService ? (
                  <>
                    <Minus className="w-3.5 h-3.5" /> Cancel
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Add New Service
                  </>
                )}
              </button>
            </div>

            {/* Inline Quick Service Creator (Clean 2-field form) */}
            {isAddingService && (
              <form onSubmit={handleQuickCreateService} className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-3 space-y-2.5 mb-2">
                <p className="text-xs font-black text-blue-900">Create New Service On-the-Fly</p>
                <input
                  type="text"
                  placeholder="Service Name (e.g. Express Wash)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  required
                />
                <input
                  type="number"
                  step="1"
                  placeholder="Base Price (₱ whole number)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={isCreatingService}
                  className="w-full rounded-xl bg-blue-600 py-2 text-xs font-black text-white shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {isCreatingService ? 'Saving...' : 'Save & Select Service'}
                </button>
              </form>
            )}

            {services.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center">
                <p className="text-xs font-bold text-slate-500">No services configured yet.</p>
                <button
                  type="button"
                  onClick={() => setIsAddingService(true)}
                  className="mt-2 text-xs font-black text-blue-600 underline"
                >
                  Create your first service
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {services.map((s) => {
                  const isSelected = selectedServiceId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedServiceId(s.id)}
                      className={`relative group flex flex-col items-start rounded-2xl border-2 p-3 text-left transition-all cursor-pointer active:scale-98 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs font-black truncate">{s.name}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteService(e, s.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors"
                          title="Delete service"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-black text-blue-600 mt-1">₱{Number(s.base_price).toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Load Count Counter */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-3">
            <span className="text-sm font-bold text-slate-700 pl-2">Loads / Bags</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setLoadCount(Math.max(1, loadCount - 1))}
                className="rounded-xl bg-white p-2.5 shadow active:scale-95"
              >
                <Minus className="h-5 w-5 text-slate-800" />
              </button>
              <span className="text-xl font-black text-slate-900 w-6 text-center">{loadCount}</span>
              <button
                type="button"
                onClick={() => setLoadCount(loadCount + 1)}
                className="rounded-xl bg-white p-2.5 shadow active:scale-95"
              >
                <Plus className="h-5 w-5 text-slate-800" />
              </button>
            </div>
          </div>

          {/* DYNAMIC SURCHARGE CHIPS */}
          {addons.length > 0 && (
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" /> Mixed Surcharge Chips
              </label>
              <div className="flex flex-wrap gap-1.5">
                {addons.map((addon) => {
                  const isChecked = selectedAddonIds.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleSurchargeAddon(addon.id)}
                      className={`rounded-xl px-3 py-2 text-xs font-black transition-all border flex items-center gap-1.5 active:scale-95 ${
                        isChecked
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span>{addon.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isChecked ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        +₱{Number(addon.price).toFixed(0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flexible Inventory Consumables Checklist */}
          {inventoryItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider">Inventory Supplies Auto-Deduct</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {inventoryItems.map((inv) => {
                  const isChecked = !!selectedAddonsInventory[inv.id];
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => toggleInventoryAddon(inv.id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${
                        isChecked
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black truncate">{inv.item_name}</p>
                        <p className="text-[9px] opacity-75">Stock: {Number(inv.current_stock).toFixed(1)} {inv.unit}</p>
                      </div>
                      <div className={`h-4 w-4 rounded-md flex items-center justify-center border ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                        {isChecked && <Check className="h-3 w-3 stroke-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analogical Editable Total Amount with Auto-Calculated Default Display */}
          <div className="rounded-2xl bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Amount (Editable)</span>
              <span className="text-[10px] font-semibold text-amber-400">Whole pesos only</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-amber-400">₱</span>
              <input
                type="number"
                step="1"
                placeholder="0"
                value={customAmount !== '' ? customAmount : calculatedTotal}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full bg-transparent text-2xl font-black text-white focus:outline-none border-b border-slate-700 focus:border-amber-400 pb-0.5"
                required
              />
            </div>

            {/* Quick +₱5 / +₱10 / +₱20 / +₱50 Step Buttons for Fast Editing */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Add:</span>
              {[5, 10, 20, 50].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAddQuickAmount(val)}
                  className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-black text-amber-400 hover:bg-slate-700 active:scale-95 border border-slate-700"
                >
                  +{val}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomAmount('')}
                className="ml-auto rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-700"
                title="Reset to calculated total"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Payment Toggle (Unpaid / Cash / GCash) */}
          <div className="grid grid-cols-3 gap-2">
            {(['unpaid', 'cash', 'gcash'] as PaymentMethod[]).map((method) => {
              const active = paymentMethod === method;
              const styles =
                method === 'unpaid'
                  ? active
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-red-50 text-red-700 border-red-200'
                  : active
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200';

              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-2xl border-2 py-3 text-xs font-black uppercase transition active:scale-95 ${styles}`}
                >
                  {method === 'unpaid' ? 'Pay Later' : method}
                </button>
              );
            })}
          </div>

        </div>

        {/* Footer / Giant Save Button */}
        <div className="border-t p-4 bg-white shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-xl font-black text-white shadow-lg active:scale-98 disabled:opacity-50"
          >
            <Check className="h-7 w-7" />
            SAVE • ₱{finalAmount}
          </button>
        </div>

      </div>
    </div>
  );
}