export type ServiceType = 'wash_dry' | 'wash_only' | 'dry_only' | 'comforter' | 'fold_only';
export type PaymentMethod = 'unpaid' | 'cash' | 'gcash';
export type OrderStatus = 'queued' | 'washing' | 'ready' | 'picked_up';

export interface Order {
  id: string;
  shop_id: string;
  customer_id: string | null;
  customer_name: string; // <-- Added
  tag_number: string;
  service_type: ServiceType;
  load_count: number;
  amount: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  estimated_ready_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export const SERVICE_CONFIG: Record<
  ServiceType,
  { label: string; defaultPrice: number; color: string; icon: string }
> = {
  wash_dry: { label: 'Wash & Dry', defaultPrice: 150, color: 'bg-blue-600', icon: '🧺' },
  wash_only: { label: 'Wash Only', defaultPrice: 80, color: 'bg-cyan-600', icon: '💧' },
  dry_only: { label: 'Dry Only', defaultPrice: 80, color: 'bg-amber-600', icon: '☀️' },
  comforter: { label: 'Comforter', defaultPrice: 200, color: 'bg-purple-600', icon: '🛏️' },
  fold_only: { label: 'Fold Only', defaultPrice: 40, color: 'bg-emerald-600', icon: '👕' },
};