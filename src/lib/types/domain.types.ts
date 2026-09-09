/**
 * Tipos del dominio — se completarán en FASE 2 cuando
 * se conecte a Supabase y se genere database.types.ts.
 *
 * Por ahora son placeholders para que los imports funcionen.
 */

// Roles
export type UserRole = "admin" | "buyer";
export type BuyerType = "retail" | "wholesale";

// Pedidos
export type OrderStatus = "pending" | "confirmed" | "cancelled";
export type OrderType = "retail" | "wholesale";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded" | "exchange";
export type PaymentMethod = "cash" | "transfer" | "mercadopago" | "other";

// Inventario
export type InventoryMovementType =
  | "ingreso"
  | "egreso"
  | "reserva"
  | "liberacion"
  | "ajuste_positivo"
  | "ajuste_negativo";

// Caja
export type CashMovementType =
  | "sale_income"
  | "manual_income"
  | "manual_expense"
  | "purchase_expense"
  | "refund"
  | "ajuste_in"
  | "ajuste_out";
