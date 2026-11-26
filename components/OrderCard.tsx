'use client';

import { Order, SERVICE_CONFIG, OrderStatus, PaymentMethod } from '@/types/laundry';
import { ArrowRight, CheckCircle2, Banknote, RotateCcw, Trash2 } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onRevertStatus: (orderId: string) => Promise<void>;
  onMarkPaid: (orderId: string, method: PaymentMethod) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
}

const NEXT_STATUS_MAP: Record<OrderStatus, { next: OrderStatus; label: string; btnColor: string }> = {
  queued: { next: 'washing', label: 'Start Wash', btnColor: 'bg-amber-500 text-white' },
  washing: { next: 'ready', label: 'Mark Ready', btnColor: 'bg-blue-600 text-white' },
  ready: { next: 'picked_up', label: 'Picked Up', btnColor: 'bg-slate-800 text-white' },
  picked_up: { next: 'picked_up', label: 'Done', btnColor: 'bg-slate-300 text-slate-600' },
};

const getServiceDisplay = (serviceType: string) => {
  const config = SERVICE_CONFIG[serviceType as keyof typeof SERVICE_CONFIG];
  if (config) {
    return { label: config.label, icon: config.icon };
  }
  return { label: serviceType, icon: '🧺' };
};

export default function OrderCard({ order, onAdvanceStatus, onRevertStatus, onMarkPaid, onDeleteOrder }: OrderCardProps) {
  const serviceInfo = getServiceDisplay(order.service_type);
  const isUnpaid = order.payment_method === 'unpaid';
  const isGcash = order.payment_method === 'gcash';
  const action = NEXT_STATUS_MAP[order.status];

  const handleCyclePayment = () => {
    const sequence: PaymentMethod[] = ['cash', 'gcash', 'unpaid'];
    const currentIndex = sequence.indexOf(order.payment_method);
    const nextPayment = sequence[(currentIndex + 1) % sequence.length];
    onMarkPaid(order.id, nextPayment);
  };

  const handleNextAction = () => {
    if (order.status === 'ready' && isUnpaid) {
      alert('Cannot mark as picked up! Please settle the payment (Cash or GCash) first.');
      return;
    }
    onAdvanceStatus(order.id, action.next);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete Tag ${order.tag_number} (${order.customer_name})? This cannot be undone.`)) {
      onDeleteOrder(order.id);
    }
  };

  // Distinct border and solid pastel background tint by payment method
  const cardTheme = isUnpaid
    ? 'border-red-500 bg-red-50'
    : isGcash
    ? 'border-blue-500 bg-blue-50'
    : 'border-emerald-500 bg-emerald-50';

  const cycleBadgeTheme = isUnpaid
    ? 'bg-red-200/80 text-red-800 hover:bg-red-300'
    : isGcash
    ? 'bg-blue-200/80 text-blue-800 hover:bg-blue-300'
    : 'bg-emerald-200/80 text-emerald-800 hover:bg-emerald-300';

  const paidBannerTheme = isGcash
    ? 'bg-blue-200/80 text-blue-900 border-blue-300'
    : 'bg-emerald-200/80 text-emerald-900 border-emerald-300';

  return (
    <div
      className={`rounded-3xl border-4 p-4 shadow-md transition ${cardTheme}`}
    >
      {/* Top Row: Tag Badge + Customer Details + Price & Payment */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        
        {/* Left Side: Tag + Name/Service/Status */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="rounded-2xl bg-slate-900 px-3.5 py-2.5 text-xl font-black text-white shadow-sm shrink-0">
            {order.tag_number}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900 leading-tight truncate">
              {order.customer_name}
            </h3>
            <p className="text-xs font-bold text-slate-700 mt-0.5 flex items-center gap-1 truncate">
              <span>{serviceInfo.icon}</span> <span className="truncate">{serviceInfo.label}</span> ({order.load_count}x)
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                STATUS: {order.status.replace('_', ' ')}
              </p>
              
              {order.status !== 'queued' && (
                <button
                  onClick={() => onRevertStatus(order.id)}
                  className="flex items-center gap-0.5 text-[10px] font-black text-amber-800 hover:text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded-md border border-amber-300 active:scale-95"
                  title="Revert status"
                >
                  <RotateCcw className="h-3 w-3" /> Back
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Price & Payment Badge */}
        <div className="flex items-center justify-between sm:flex-col sm:items-end shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-300/60">
          <p className="text-xl font-black text-slate-900">₱{order.amount}</p>
          
          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              onClick={handleCyclePayment}
              className={`rounded-lg px-2.5 py-1 text-xs font-black uppercase transition active:scale-95 shadow-xs ${cycleBadgeTheme}`}
              title="Tap to change payment method"
            >
              {order.payment_method} 🔄
            </button>

            {order.status === 'queued' && (
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-200 p-1.5 text-red-700 hover:bg-red-300 active:scale-95 transition"
                title="Delete order"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Action Buttons (Thumb-Friendly) */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {isUnpaid ? (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onMarkPaid(order.id, 'cash')}
              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white active:scale-95 shadow"
            >
              <Banknote className="h-4 w-4" /> CASH
            </button>
            <button
              onClick={() => onMarkPaid(order.id, 'gcash')}
              className="flex items-center justify-center rounded-xl bg-blue-600 py-3 text-xs font-black text-white active:scale-95 shadow"
            >
              GCASH
            </button>
          </div>
        ) : (
          <div className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-black border ${paidBannerTheme}`}>
            <CheckCircle2 className="h-4 w-4" /> PAID ({order.payment_method.toUpperCase()})
          </div>
        )}

        <button
          onClick={handleNextAction}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black shadow active:scale-95 ${action.btnColor}`}
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}