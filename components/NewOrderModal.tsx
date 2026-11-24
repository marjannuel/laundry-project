'use client';

import { useState, useMemo, useEffect } from 'react';
import { ServiceType, PaymentMethod, SERVICE_CONFIG, Order } from '@/types/laundry';
import { X, Plus, Minus, Check, User, Sparkles, Package } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// Initialize Supabase client helper
const supabase = createClient();

export interface CustomerProfile {
  id: string;
  shop_id: string;
  nickname: string;
  phone_number?: string;
  total_visits: number;
  avg_interval_days?: number;
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
    service_type: ServiceType;
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
  const [selectedService, setSelectedService] = useState<ServiceType>('wash_dry');
  const [loadCount, setLoadCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('unpaid');
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  
  // CRM State
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Inventory Add-on State
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});

  // Fetch shop customers and inventory when modal opens
  useEffect(() => {
    if (isOpen && shopId) {
      fetchCustomers();
      fetchInventory();
    }
  }, [isOpen, shopId]);

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
      // Auto-enable items that act as default (e.g., standard detergent)
      const defaults: Record<string, boolean> = {};
      data.forEach((item) => {
        if (item.item_name.toLowerCase().includes('detergent') || item.item_name.toLowerCase().includes('powder')) {
          defaults[item.id] = true;
        }
      });
      setSelectedAddons(defaults);
    }
  };

  // Automatically find lowest unused basket tag for TODAY (#1, #2, #3...)
  const nextAutoTag = useMemo(() => {
    const todayString = new Date().toDateString();
    
    const todaysOrders = activeOrders.filter((order) => {
      return new Date(order.created_at).toDateString() === todayString;
    });

    const usedTags = new Set(todaysOrders.map((o) => o.tag_number));
    let num = 1;
    while (usedTags.has(`#${num}`)) {
      num++;
    }
    return `#${num}`;
  }, [activeOrders]);

  const totalAmount = SERVICE_CONFIG[selectedService].defaultPrice * loadCount;

  // Baseline Queue Estimator (1.5 hrs base + 45 mins per active load ahead)
  const activeQueueLoads = activeOrders
    .filter((o) => o.status === 'queued' || o.status === 'washing')
    .reduce((sum, o) => sum + o.load_count, 0);

  const estimatedMinutes = 90 + activeQueueLoads * 45;
  const estimatedReadyDate = new Date(Date.now() + estimatedMinutes * 60_000);

  // Filter customer suggestions based on input text using schema's 'nickname'
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

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const finalName = customerName.trim() || 'Walk-in Student';
      let customerIdToSave = selectedCustomerId;

      // If a shopId exists and it's a real name (not just default walk-in)
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

      // --- AUTOMATED INVENTORY DEPLETION ---
      if (shopId) {
        for (const item of inventoryItems) {
          if (selectedAddons[item.id]) {
            const consumedAmount = loadCount * (item.consumption_per_load || 1.0);
            const newStock = Math.max(0, Number(item.current_stock) - consumedAmount);

            await supabase
              .from('inventory')
              .update({ current_stock: newStock })
              .eq('id', item.id);
          }
        }
      }

      // Create the order with the linked customer_id
      await onCreateOrder({
        tag_number: nextAutoTag,
        customer_name: finalName,
        customer_id: customerIdToSave,
        service_type: selectedService,
        load_count: loadCount,
        amount: totalAmount,
        payment_method: paymentMethod,
        estimated_ready_at: estimatedReadyDate.toISOString(),
      });

      // Reset form states
      setCustomerName('');
      setSelectedCustomerId(undefined);
      setLoadCount(1);
      setPaymentMethod('unpaid');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        
        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Customer Name Input with CRM Autocomplete */}
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

            {/* CRM Autocomplete Dropdown suggestions */}
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

          {/* Header with Auto-Assigned Tag */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-slate-900 px-4 py-2 text-2xl font-black text-white">
                Tag {nextAutoTag}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Est. Ready</p>
                <p className="text-sm font-bold text-slate-700">
                  {estimatedReadyDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-slate-100 p-3 text-slate-600 active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* 1-Tap Service Grid */}
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(SERVICE_CONFIG) as ServiceType[]).map((key) => {
              const item = SERVICE_CONFIG[key];
              const isSelected = selectedService === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedService(key)}
                  className={`flex flex-col items-center justify-center rounded-2xl border-4 p-4 transition active:scale-95 ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <span className="text-3xl mb-1">{item.icon}</span>
                  <span className="text-base font-bold">{item.label}</span>
                  <span className={`text-sm ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    ₱{item.defaultPrice}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Load Counter (- 1 +) */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-3">
            <span className="text-base font-bold text-slate-700 pl-2">Loads / Bags</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setLoadCount(Math.max(1, loadCount - 1))}
                className="rounded-xl bg-white p-3 shadow active:scale-95"
              >
                <Minus className="h-6 w-6 text-slate-800" />
              </button>
              <span className="text-2xl font-black text-slate-900 w-6 text-center">{loadCount}</span>
              <button
                type="button"
                onClick={() => setLoadCount(loadCount + 1)}
                className="rounded-xl bg-white p-3 shadow active:scale-95"
              >
                <Plus className="h-6 w-6 text-slate-800" />
              </button>
            </div>
          </div>

          {/* Flexible Inventory Consumables Checklist */}
          {inventoryItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider">Supplies Used for this Order</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {inventoryItems.map((inv) => {
                  const isChecked = !!selectedAddons[inv.id];
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => toggleAddon(inv.id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${
                        isChecked
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black truncate">{inv.item_name}</p>
                        <p className="text-[9px] opacity-75">Left: {inv.current_stock} {inv.unit}</p>
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
                  className={`rounded-2xl border-2 py-3 text-sm font-black uppercase transition active:scale-95 ${styles}`}
                >
                  {method === 'unpaid' ? 'Pay Later' : method}
                </button>
              );
            })}
          </div>

        </div>

        {/* Footer / Giant Save Button */}
        <div className="border-t p-4 bg-white">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-xl font-black text-white shadow-lg active:scale-98 disabled:opacity-50"
          >
            <Check className="h-7 w-7" />
            SAVE • ₱{totalAmount}
          </button>
        </div>

      </div>
    </div>
  );
}