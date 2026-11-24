'use client';

import { Order, SERVICE_CONFIG, OrderStatus, PaymentMethod } from '@/types/laundry';
import { ArrowRight, CheckCircle2, Banknote, RotateCcw, Trash2 } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onRevertStatus: (orderId: string) => Promise<void>;
  onMarkPaid: (orderId: string, method: PaymentMethod) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>; // Added delete handler prop
}

const NEXT_STATUS_MAP: Record<OrderStatus, { next: OrderStatus; label: string; btnColor: string }> = {
  queued: { next: 'washing', label: 'Start Wash', btnColor: 'bg-amber-500 text-white' },
  washing: { next: 'ready', label: 'Mark Ready', btnColor: 'bg-blue-600 text-white' },
  ready: { next: 'picked_up', label: 'Picked Up', btnColor: 'bg-slate-800 text-white' },
  picked_up: { next: 'picked_up', label: 'Done', btnColor: 'bg-slate-300 text-slate-600' },
};

export default function OrderCard({ order, onAdvanceStatus, onRevertStatus, onMarkPaid, onDeleteOrder }: OrderCardProps) {
  const service = SERVICE_CONFIG[order.service_type];
  const isUnpaid = order.payment_method === 'unpaid';
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

  return (
    <div
      className={`rounded-3xl border-4 bg-white p-4 shadow-sm transition ${
        isUnpaid ? 'border-red-500' : 'border-emerald-500'
      }`}
    >
      {/* Top Row: Tag Badge + Customer Name + Service & Price */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-slate-900 px-3.5 py-2 text-xl font-black text-white shadow-sm">
            {order.tag_number}
          </span>
          <div>
            <h3 className="text-base font-black text-slate-900 leading-tight">
              {order.customer_name}
            </h3>
            <p className="text-xs font-bold text-slate-600 mt-0.5 flex items-center gap-1">
              <span>{service.icon}</span> {service.label} ({order.load_count}x load)
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status: {order.status.replace('_', ' ')}
              </p>
              
              {/* Quick Revert Status Button */}
              {order.status !== 'queued' && (
                <button
                  onClick={() => onRevertStatus(order.id)}
                  className="flex items-center gap-0.5 text-[10px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 active:scale-95"
                  title="Revert to previous status"
                >
                  <RotateCcw className="h-3 w-3" /> Back
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <p className="text-xl font-black text-slate-900">₱{order.amount}</p>
          
          <div className="flex items-center gap-1.5 mt-1">
            {/* Tapping this badge cycles the payment method */}
            <button
              onClick={handleCyclePayment}
              className={`rounded-lg px-2 py-0.5 text-xs font-black uppercase transition active:scale-95 shadow-xs ${
                isUnpaid ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
              title="Tap to change payment method"
            >
              {order.payment_method} 🔄
            </button>

            {/* Delete / Trash Button for Accidental Orders */}
            {order.status === 'queued' && (
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-100 p-1 text-red-600 hover:bg-red-200 active:scale-95 transition"
                title="Delete accidental order"
              >
                <Trash2 className="h-3.5 w-3.5" />
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
              className="flex items-center justify-center rounded-xl bg-sky-600 py-3 text-xs font-black text-white active:scale-95 shadow"
            >
              GCASH
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-3 text-xs font-black text-emerald-700 border border-emerald-200">
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