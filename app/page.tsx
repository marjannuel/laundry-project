'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Order, OrderStatus, PaymentMethod } from '@/types/laundry';
import OrderCard from '@/components/OrderCard';
import NewOrderModal from '@/components/NewOrderModal';
import ProInsightsDrawer from '@/components/ProInsightsDrawer';
import AuthScreen from '@/components/AuthScreen';
import { Plus, Sparkles, LogOut, History, X } from 'lucide-react';
import UpgradeModal from '@/components/UpgradeModal';
import InventoryDrawer from '@/components/InventoryDrawer';
import AddonsDrawer from '@/components/AddonsDrawer';

// Helper to format remaining trial time (e.g., "6d 14h" or "Expiring soon")
const getTrialTimeRemaining = (trialEndsAt: string | null) => {
  if (!trialEndsAt) return 'PRO';
  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  if (diffMs <= 0) return 'EXPIRED';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

export default function LaundryTapBoard() {
  const supabase = createClient();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('My Laundry Shop');
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false); // Inventory Drawer State
  const [isAddonsDrawerOpen, setIsAddonsDrawerOpen] = useState(false); // Addons Manager Drawer State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // Shift History Modal State
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false); // Income Report Modal State
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false); // Rename Shop Modal State
  const [loading, setLoading] = useState(true);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // 1. Check active session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setSessionChecked(true);
    });
  }, [supabase]);

  const loadShopAndOrders = useCallback(async () => {
    setLoading(true);
    
    // Get current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Check if a shop exists for this user ID
    let { data: shops } = await supabase
      .from('shops')
      .select('id, name, subscription_tier, trial_ends_at')
      .eq('owner_id', user.id)
      .limit(1);

    let currentShopId = shops?.[0]?.id ?? null;
    let currentShopName = shops?.[0]?.name ?? 'My Laundry Shop';
    let currentTier = shops?.[0]?.subscription_tier ?? 'free';
    let currentTrialEndsAt = shops?.[0]?.trial_ends_at ?? null;

    // If no shop exists, auto-create one linked to this user's real UUID (Triggers 7-day Pro trial automatically via DB)
    if (!currentShopId) {
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 7);

      const { data: newShop, error: createError } = await supabase
        .from('shops')
        .insert([
          {
            name: 'My Laundry Shop',
            location: 'Baguio City',
            subscription_tier: 'pro',
            trial_ends_at: trialExpiry.toISOString(),
            owner_id: user.id,
          },
        ])
        .select('id, name, subscription_tier, trial_ends_at')
        .single();

      if (newShop) {
        currentShopId = newShop.id;
        currentShopName = newShop.name;
        currentTier = newShop.subscription_tier || 'pro';
        currentTrialEndsAt = newShop.trial_ends_at;
      } else {
        console.error('Failed to auto-create shop:', createError);
      }
    }

    // Check if Pro trial has lapsed
    if (currentTier === 'pro' && currentTrialEndsAt) {
      if (new Date() > new Date(currentTrialEndsAt)) {
        await supabase
          .from('shops')
          .update({ subscription_tier: 'free' })
          .eq('id', currentShopId);
        currentTier = 'free';
      }
    }

    setShopId(currentShopId);
    setShopName(currentShopName);
    setSubscriptionTier(currentTier);
    setTrialEndsAt(currentTrialEndsAt);

    if (currentShopId) {
      // Load all orders sorted ASCENDING so Basket #1 stays at the top of the rack
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', currentShopId)
        .order('created_at', { ascending: true });

      if (data) setOrders(data as Order[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isAuthenticated) {
      loadShopAndOrders();
    }
  }, [isAuthenticated, loadShopAndOrders]);

  // ⚡ Supabase Realtime Listener for multi-device sync (Orders)
  useEffect(() => {
    if (!shopId) return;

    const channel = supabase
      .channel(`live-sync-${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;
            if (newOrder.shop_id !== shopId) return;
            setOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) return prev;
              return [...prev, newOrder];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;
            if (updatedOrder.shop_id !== shopId) return;
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setOrders((prev) => prev.filter((o) => o.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setShopId(null);
    setOrders([]);
  };

  const handleCreateOrder = async (payload: {
    tag_number: string;
    customer_name: string;
    customer_id?: string;
    service_id?: string;
    service_type: string;
    addons_snapshot?: any[];
    load_count: number;
    amount: number;
    payment_method: PaymentMethod;
    estimated_ready_at: string;
  }) => {
    if (!shopId) return;
    const { data, error } = await supabase
      .from('orders')
      .insert([{ 
        shop_id: shopId, 
        tag_number: payload.tag_number,
        customer_name: payload.customer_name,
        customer_id: payload.customer_id,
        service_id: payload.service_id,
        service_type: payload.service_type,
        addons_snapshot: payload.addons_snapshot || [],
        load_count: payload.load_count,
        amount: payload.amount,
        payment_method: payload.payment_method,
        estimated_ready_at: payload.estimated_ready_at,
        status: 'queued' 
      }])
      .select()
      .single();

    if (!error && data) {
      setOrders((prev) => {
        if (prev.some((o) => o.id === data.id)) return prev;
        return [...prev, data as Order];
      });
    } else {
      console.error('Error creating order:', error);
      alert('Failed to create order. Check console.');
    }
  };
  
  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    if (nextStatus === 'picked_up' && targetOrder.payment_method === 'unpaid') {
      alert('Cannot mark as picked up! Please settle the payment (Cash or GCash) first.');
      return;
    }

    const updates: Partial<Order> = { status: nextStatus };
    if (nextStatus === 'ready' || nextStatus === 'picked_up') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
      );
    }
  };

  const handleReturnToRack = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'ready', completed_at: null })
      .eq('id', orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'ready', completed_at: null } : o))
      );
    }
  };

  const handleRevertStatus = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const previousStatusMap: Record<OrderStatus, OrderStatus> = {
      queued: 'queued',
      washing: 'queued',
      ready: 'washing',
      picked_up: 'ready',
    };

    const prevStatus = previousStatusMap[targetOrder.status];
    if (prevStatus === targetOrder.status) return;

    const updates: Partial<Order> = { 
      status: prevStatus,
      completed_at: prevStatus !== 'ready' && prevStatus !== 'picked_up' ? null : targetOrder.completed_at 
    };

    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
      );
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order? Stock will be restored to inventory.')) return;

    const targetOrder = orders.find((o) => o.id === orderId);

    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert('Failed to delete order.');
      return;
    }

    // Refund / Restore inventory stock back
    if (targetOrder && shopId) {
      const { data: invItems } = await supabase
        .from('inventory')
        .select('*')
        .eq('shop_id', shopId);

      if (invItems && invItems.length > 0) {
        const addons = targetOrder.addons_snapshot || [];
        const matchedAddon = addons.find((a: any) => a?.inventory_multiplier && a.inventory_multiplier > 1.0);
        const multiplier = matchedAddon ? Number(matchedAddon.inventory_multiplier) : 1.0;
        const loadCount = targetOrder.load_count || 1;

        for (const item of invItems) {
          let rawConsumption = Number(item.consumption_per_load || 1.0);
          const unitLower = (item.unit || '').toLowerCase();
          
          if ((unitLower === 'kg' || unitLower === 'l') && rawConsumption >= 10) {
            rawConsumption = rawConsumption / 1000;
          }

          const consumedAmount = loadCount * rawConsumption * multiplier;
          const restoredStock = Number(item.current_stock) + consumedAmount;

          await supabase
            .from('inventory')
            .update({ current_stock: Number(restoredStock.toFixed(3)) })
            .eq('id', item.id);
        }
      }
    }

    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleMarkPaid = async (orderId: string, method: PaymentMethod) => {
    const { error } = await supabase
      .from('orders')
      .update({ payment_method: method })
      .eq('id', orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_method: method } : o))
      );
    }
  };

  if (!sessionChecked) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 font-bold text-slate-500">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  // --- FINANCIAL CALCULATIONS ---
  const todayString = new Date().toDateString();
  const todaysOrders = orders.filter((o) => new Date(o.created_at).toDateString() === todayString);

  const cashTotal = todaysOrders
    .filter((o) => o.payment_method === 'cash')
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const gcashTotal = todaysOrders
    .filter((o) => o.payment_method === 'gcash')
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const totalUnpaid = todaysOrders
    .filter((o) => o.payment_method === 'unpaid')
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const now = new Date();
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weeklyOrders = orders.filter((o) => new Date(o.created_at) >= startOfWeek && o.payment_method !== 'unpaid');
  const weeklyTotal = weeklyOrders.reduce((sum, o) => sum + Number(o.amount), 0);

  const monthlyOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && o.payment_method !== 'unpaid';
  });
  const monthlyTotal = monthlyOrders.reduce((sum, o) => sum + Number(o.amount), 0);

  const yearlyOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    return d.getFullYear() === now.getFullYear() && o.payment_method !== 'unpaid';
  });
  const yearlyTotal = yearlyOrders.reduce((sum, o) => sum + Number(o.amount), 0);

  const dailyIncomeGroups = orders
    .filter((o) => o.payment_method !== 'unpaid')
    .reduce((groups: Record<string, number>, order) => {
      const dateKey = new Date(order.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      groups[dateKey] = (groups[dateKey] || 0) + Number(order.amount);
      return groups;
    }, {});

  const activeOrdersOnRack = orders.filter((o) => o.status !== 'picked_up');
  const pickedUpOrders = orders.filter((o) => o.status === 'picked_up');

  return (
    <main className="min-h-screen bg-slate-100 pb-28">
      {/* Top Summary Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 shadow-md">
        <div className="mx-auto max-w-md px-4 py-3 text-white space-y-2.5">
          {/* Row 1: Shop Name & Utility Icons (Fully Responsive Mobile Fit) */}
          <div className="flex items-center justify-between gap-1">
            <div 
              className="flex items-center gap-1 cursor-pointer group min-w-0 flex-1 pr-1" 
              onClick={() => setIsRenameModalOpen(true)} 
              title="Edit Shop Name"
            >
              <h1 className="text-xs sm:text-sm font-black tracking-tight truncate group-hover:underline">{shopName}</h1>
              <span className="text-[10px] text-slate-400 shrink-0">✏️</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsIncomeModalOpen(true)}
                className="rounded-xl bg-emerald-700 px-2 py-1.5 text-[11px] font-black text-white hover:bg-emerald-800 active:scale-95 border border-emerald-600 shadow-xs flex items-center gap-1"
                title="Income Report"
              >
                💰 <span className="text-[9px] uppercase hidden xs:inline">Report</span>
              </button>

              <button
                onClick={() => setIsInventoryOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 border border-slate-700 shadow-xs text-sm"
                title="Inventory & Stock"
              >
                📦
              </button>

              <button
                onClick={() => setIsAddonsDrawerOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 border border-slate-700 shadow-xs text-sm"
                title="Manage Surcharge Chips"
              >
                🏷️
              </button>

              <button
                onClick={() => setIsHistoryOpen(true)}
                className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:text-white active:scale-95 border border-slate-700 shadow-xs"
                title="Shift History"
              >
                <History className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={handleLogout}
                className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white active:scale-95 border border-slate-700 shadow-xs"
                title="Log Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="-mt-1">
            <p className="text-[10px] font-semibold text-slate-400">{activeOrdersOnRack.length} Active Bags on Rack</p>
          </div>

          {/* Row 2: Live Financial Tally Badges */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
            <div className="flex-1 rounded-xl bg-emerald-500/20 px-2 py-1.5 border border-emerald-500/40 text-center">
              <p className="text-[8px] font-bold uppercase text-emerald-300">Cash</p>
              <p className="text-xs font-black text-emerald-400">₱{cashTotal}</p>
            </div>
            <div className="flex-1 rounded-xl bg-sky-500/20 px-2 py-1.5 border border-sky-500/40 text-center">
              <p className="text-[8px] font-bold uppercase text-sky-300">GCash</p>
              <p className="text-xs font-black text-sky-400">₱{gcashTotal}</p>
            </div>
            <div className="flex-1 rounded-xl bg-red-500/20 px-2 py-1.5 border border-red-500/40 text-center">
              <p className="text-[8px] font-bold uppercase text-red-300">Unpaid</p>
              <p className="text-xs font-black text-red-400">₱{totalUnpaid}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Active Orders Feed */}
      <div className="mx-auto max-w-md space-y-3 p-4">
        {loading ? (
          <p className="py-12 text-center font-bold text-slate-400">Loading laundry board...</p>
        ) : activeOrdersOnRack.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-extrabold text-slate-700">No active laundry bags on rack</p>
            <p className="text-sm text-slate-400 mt-1">Tap the blue button below to log a walk-in.</p>
          </div>
        ) : (
          activeOrdersOnRack.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAdvanceStatus={handleAdvanceStatus}
              onRevertStatus={handleRevertStatus}
              onMarkPaid={handleMarkPaid}
              onDeleteOrder={handleDeleteOrder}
            />
          ))
        )}
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-linear-to-t from-slate-100 via-slate-100 to-transparent p-4">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-lg font-black text-white shadow-xl active:scale-98"
          >
            <Plus className="h-6 w-6" /> NEW LAUNDRY
          </button>

          <button
            onClick={() => {
              if (subscriptionTier === 'pro') {
                setIsInsightsOpen(true);
              } else {
                setIsUpgradeModalOpen(true);
              }
            }}
            className="flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-amber-400 shadow-xl active:scale-95 relative"
            title="AI Business Advisor"
          >
            <Sparkles className="h-6 w-6" />
            {subscriptionTier === 'free' ? (
              <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-slate-900">
                FREE
              </span>
            ) : (
              <span className="absolute -top-2 -right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-white shadow-sm border border-slate-900 animate-pulse">
                {getTrialTimeRemaining(trialEndsAt)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Rename Shop Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-black text-slate-900">Change Shop Name</h2>
              <button onClick={() => setIsRenameModalOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Shop Name</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base font-bold text-slate-800 focus:border-slate-900 focus:outline-none bg-slate-50"
              />
            </div>

            <button
              onClick={async () => {
                if (!shopId) return;
                await supabase.from('shops').update({ name: shopName }).eq('id', shopId);
                setIsRenameModalOpen(false);
              }}
              className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-md active:scale-95"
            >
              SAVE SHOP NAME
            </button>
          </div>
        </div>
      )}

      {/* Shift History Modal Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between border-b p-5 bg-white z-20">
              <div>
                <h2 className="text-lg font-black text-slate-900">Shift History</h2>
                <p className="text-xs text-slate-500">{pickedUpOrders.length} completed transactions</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-600 active:scale-95">
                <X className="h-6 w-6" />
              </button>
            </div>

            {pickedUpOrders.length > 0 && (
              <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-200 flex items-center justify-between z-10">
                <p className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Completed Transactions Log
                </p>
                <span className="text-[10px] font-bold text-slate-400">Sorted by Date</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pickedUpOrders.length === 0 ? (
                <p className="py-10 text-center text-sm font-bold text-slate-400">No completed orders yet this shift.</p>
              ) : (
                pickedUpOrders.map((order) => {
                  const dateLabel = new Date(order.completed_at || order.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const timeString = order.completed_at 
                    ? new Date(order.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={order.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-black text-white">{order.tag_number}</span>
                          <p className="text-sm font-extrabold text-slate-800">{order.customer_name}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 capitalize">
                          {order.service_type.replace('_', ' ')} • <span className="font-bold uppercase text-emerald-600">{order.payment_method}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {dateLabel} • Done at {timeString}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <p className="text-base font-black text-slate-900">₱{order.amount}</p>
                        <button
                          onClick={() => handleReturnToRack(order.id)}
                          className="rounded-lg bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800 active:scale-95 border border-amber-300"
                        >
                          ↩ Return to Rack
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* Income Report Modal Drawer */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between border-b p-5 bg-white z-20">
              <div>
                <h2 className="text-lg font-black text-slate-900">Financial Ledger & Income</h2>
                <p className="text-xs text-slate-500">Collected earnings summary (Paid orders only)</p>
              </div>
              <button onClick={() => setIsIncomeModalOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-600 active:scale-95">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">This Week</p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">₱{weeklyTotal}</p>
                </div>
                <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4">
                  <p className="text-[10px] font-bold uppercase text-sky-700">This Month</p>
                  <p className="text-2xl font-black text-sky-900 mt-1">₱{monthlyTotal}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total Year Earnings ({now.getFullYear()})</p>
                  <p className="text-2xl font-black text-amber-400 mt-0.5">₱{yearlyTotal}</p>
                </div>
                <span className="text-3xl">📊</span>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
                  Daily Breakdown Ledger
                </h3>
                
                {Object.keys(dailyIncomeGroups).length === 0 ? (
                  <p className="py-8 text-center text-sm font-bold text-slate-400">No paid transactions recorded yet.</p>
                ) : (
                  Object.entries(dailyIncomeGroups).map(([dateStr, totalAmount]) => (
                    <div key={dateStr} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-900 p-2.5 text-white font-black text-xs">
                          📅
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{dateStr}</p>
                          <p className="text-[10px] font-semibold text-slate-400">Paid Collections</p>
                        </div>
                      </div>
                      <p className="text-base font-black text-emerald-600">₱{totalAmount}</p>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      <NewOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeOrders={orders}
        shopId={shopId || undefined}
        onCreateOrder={handleCreateOrder}
      />

      <ProInsightsDrawer
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        shopId={shopId}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      <InventoryDrawer
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        shopId={shopId}
        subscriptionTier={subscriptionTier}
      />

      <AddonsDrawer
        isOpen={isAddonsDrawerOpen}
        onClose={() => setIsAddonsDrawerOpen(false)}
        shopId={shopId}
      />
    </main>
  );
}