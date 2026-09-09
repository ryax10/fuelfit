import type { OrderStatus, OrderType, PaymentStatus, PaymentMethod, InventoryMovementType, CashMovementType, BuyerType } from "@/lib/types/domain.types";

export interface Product {
  id: string;
  sku: string;
  brand: string;
  model: string;
  flavor: string;
  slug: string;
  name: string;
  category: "suplementos" | "ropa" | "accesorios";
  price_min_ars: number;
  price_may_x15: number;
  price_may_x50: number;
  price_may_x100: number;
  cost_price: number;
  units_per_pack?: number; // unidades por pack (para cálculo de costo unitario en ganancias)
  unit_sale_options?: { options: { qty: number; price: number }[] } | null; // precio = total por esa cantidad
  featured?: boolean;
  is_new?: boolean;
  stock_actual: number;
  stock_reservado: number;
  image: string;
  visible: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  type: BuyerType;
  code: string;
  // password existe en la DB (columna legacy), no se usa en la app
  password?: string | null;
  status: "active" | "pending" | "rejected" | "blocked";
  notes: string;
  created_at: string;
  last_purchase?: string | null;
  previous_purchase?: string | null;
  total_orders?: number;
  nickname?: string | null;
  has_duplicate_warning?: boolean;
  duplicate_names?: string[];
}

export interface Order {
  id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_id?: string;
  notes: string;
  total: number;
  created_at: string;
  confirmed_at?: string;
  discount_code?: string | null;
  discount_amount?: number;
  discount_currency?: "ARS" | "USD" | null;
  surcharge_amount?: number;
  surcharge_note?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_sku: string;
  type: InventoryMovementType;
  qty: number;
  order_id?: string;
  note: string;
  created_at: string;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  currency: "ARS" | "USD";
  caja: string;
  category: string;
  order_id?: string;
  note: string;
  created_at: string;
  /** Si false, el movimiento NO impacta el balance de caja pero sí cuenta en P&L. */
  affects_cash?: boolean;
  /** Si true, el movimiento fue anulado y queda solo como historial. No suma a caja ni a P&L. */
  voided?: boolean;
  voided_at?: string | null;
  voided_reason?: string | null;
  /** Vincula el movimiento al pago de deuda que lo originó (para reversiones automáticas). */
  debt_payment_id?: string | null;
}

export interface AuditLog {
  id: string;
  target_type: "cash_movement" | "order" | "debt" | "customer";
  target_id: string;
  action: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  reason: string;
  actor: string;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  qty: number;
  unit_price_override?: number;
}

export interface LocalDB {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  order_items: OrderItem[];
  inventory_movements: InventoryMovement[];
  cash_movements: CashMovement[];
  cart: CartItem[];
  cart_mayorista: CartItem[];
  order_counter: number;
}
