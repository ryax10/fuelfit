"use server";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product, Customer, Order, OrderItem, CashMovement, InventoryMovement, AuditLog } from "@/lib/local-db/types";

/** Redondea a 2 decimales para evitar errores de punto flotante en comparaciones monetarias */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Consume FIFO desde inventory_movements y devuelve los lotes consumidos.
 * Lee todos los ingresos/egresos del producto, reconstruye lotes disponibles
 * (el orden más viejo primero) y consume `qty` desde el frente.
 * Si los lotes no alcanzan, completa con `fallbackUnitCost` (cost_price del producto).
 */
async function consumeFifoLots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productId: string,
  qtyToConsume: number,
  fallbackUnitCost: number,
): Promise<{ qty: number; unit_cost: number }[]> {
  const { data: movs } = await supabase
    .from("inventory_movements")
    .select("type, qty, unit_cost, created_at")
    .eq("product_id", productId)
    .in("type", ["ingreso", "egreso", "ajuste_positivo", "ajuste_negativo"])
    .order("created_at", { ascending: true });

  const lots: { qty: number; unit_cost: number }[] = [];
  for (const m of (movs || []) as { type: string; qty: number; unit_cost: number | null }[]) {
    if (m.type === "ingreso" || m.type === "ajuste_positivo") {
      lots.push({ qty: m.qty, unit_cost: m.unit_cost ?? 0 });
    } else if (m.type === "egreso" || m.type === "ajuste_negativo") {
      let toConsume = m.qty;
      while (toConsume > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.qty <= toConsume) {
          toConsume -= lot.qty;
          lots.shift();
        } else {
          lot.qty -= toConsume;
          toConsume = 0;
        }
      }
    }
  }

  const consumed: { qty: number; unit_cost: number }[] = [];
  let remaining = qtyToConsume;
  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0];
    if (lot.qty <= remaining) {
      consumed.push({ qty: lot.qty, unit_cost: lot.unit_cost });
      remaining -= lot.qty;
      lots.shift();
    } else {
      consumed.push({ qty: remaining, unit_cost: lot.unit_cost });
      lot.qty -= remaining;
      remaining = 0;
    }
  }
  if (remaining > 0) {
    consumed.push({ qty: remaining, unit_cost: fallbackUnitCost });
  }
  return consumed;
}

// ─── TIPOS NUEVOS ─────────────────────────────────────────────

export interface Purchase {
  id: string;
  number: number;
  supplier: string;
  currency: "ARS" | "USD";
  total: number;
  // payment_status se usa también como estado de la compra:
  // "pending"  = registrada, sin pago, sin stock
  // "partial"  = pago adelantado, sin stock aún
  // "received" = mercadería recibida + stock actualizado (puede tener deuda de pago)
  // "paid"     = todo completado (pago + stock)
  payment_status: "pending" | "partial" | "received" | "paid" | "cancelled";
  paid_amount: number;
  note: string;
  created_at: string;
  received_at?: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  qty: number;
  unit_cost: number;
  subtotal: number;
}

export interface Debt {
  id: string;
  type: "receivable" | "payable";
  entity_name: string;
  entity_type: "customer" | "supplier";
  entity_id?: string;
  original_amount: number;
  currency: "ARS" | "USD";
  paid_amount: number;
  order_id?: string;
  purchase_id?: string;
  note: string;
  status: "pending" | "partial" | "paid" | "cancelled" | "archived";
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  currency: "ARS" | "USD";
  caja: string;
  note: string;
  created_at: string;
}

export interface BalanceSnapshot {
  id: string;
  period: string;
  snapshot_date: string;
  cash_ars: number;
  cash_usd: number;
  cash_usdt: number;
  stock_value_usd: number;
  in_transit_value_usd: number;
  inventory_cost_usd: number;
  inventory_value_ars: number;
  patrimonio_neto_usd: number;
  total_sales_ars: number;
  total_sales_usd: number;
  total_expenses_ars: number;
  total_expenses_usd: number;
  total_purchases_usd: number;
  receivable_ars: number;
  receivable_usd: number;
  payable_ars: number;
  payable_usd: number;
  active_products: number;
  total_stock: number;
  fx_usdt_ars: number;
  notes: string;
  created_at: string;
}

export interface LiveBalance {
  fxRate: number;
  /** FX usado para convertir deudas ARS → USD (promedio FullVIP del día, fallback fxRate). */
  fxRateDebts: number;
  /** "fullvip" si pudo obtener Binance + Cripto; "config" si tuvo que caer al FX manual. */
  fxRateDebtsSource: "fullvip" | "config";
  stockValueUSD: number;
  cashUsd: number;
  cashArs: number;
  cashArsUSD: number;
  inTransitValueUSD: number;
  receivableUSD: number;
  receivableARS: number;
  payableUSD: number;
  payableARS: number;
  totalAssetsUSD: number;
  totalLiabilitiesUSD: number;
  patrimonioNeto: number;
  activeProducts: number;
  totalStock: number;
  cajaBreakdown: Record<string, { ars: number; usd: number }>;
}

// ─── AUTH ────────────────────────────────────────────────────

async function requireAdminSession() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // Si la variable de entorno no está configurada, no hay forma de verificar sesiones
    console.error("CRÍTICO: ADMIN_SECRET no está configurado en las variables de entorno");
    redirect("/admin/login");
  }
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session) redirect("/admin/login");
  const colonIdx = session.indexOf(":");
  if (colonIdx === -1) redirect("/admin/login");
  const username = session.slice(0, colonIdx);
  const sig = session.slice(colonIdx + 1);
  const expected = createHmac("sha256", secret).update(username).digest("hex");
  // Usar timingSafeEqual para evitar timing oracle en la verificación del token
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) redirect("/admin/login");
  } catch {
    redirect("/admin/login");
  }
}

/** Devuelve el username del actor de la sesión actual sin redirigir. Asume que requireAdminSession ya validó. */
async function currentActor(): Promise<string> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value || "";
  const colonIdx = session.indexOf(":");
  if (colonIdx === -1) return "";
  return session.slice(0, colonIdx);
}

/** Inserta una entrada en audit_logs. Nunca tira excepción para no bloquear la operación principal. */
async function logAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  targetType: "cash_movement" | "order" | "debt" | "customer",
  targetId: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  reason: string,
  actor: string,
) {
  try {
    await supabase.from("audit_logs").insert({
      target_type: targetType,
      target_id: targetId,
      action,
      before_json: before,
      after_json: after,
      reason: reason || "",
      actor: actor || "",
    });
  } catch (e) {
    console.error("audit_log insert failed", e);
  }
}

// ─── PRODUCTOS ───────────────────────────────────────────────

export async function getProductsAction(): Promise<Product[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as Product[];
}

export async function createProductAction(
  p: Omit<Product, "id" | "created_at" | "stock_reservado">
): Promise<Product> {
  await requireAdminSession();
  const supabase = createAdminClient();

  // Validar SKU duplicado antes de insertar
  if (p.sku) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("sku", p.sku.toUpperCase())
      .maybeSingle();
    if (existing) throw new Error(`Ya existe un producto con el SKU "${p.sku.toUpperCase()}"`);
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...p, stock_reservado: 0 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateProductAction(id: string, updates: Partial<Product>) {
  await requireAdminSession();
  await createAdminClient().from("products").update(updates).eq("id", id);
}

export async function uppercaseAllProductsAction() {
  await requireAdminSession();
  const supabase = createAdminClient();
  const { data: products } = await supabase.from("products").select("id, brand, model, flavor, name, sku");
  if (!products) return;
  for (const p of products) {
    await supabase.from("products").update({
      brand: p.brand?.toUpperCase() ?? p.brand,
      model: p.model?.toUpperCase() ?? p.model,
      flavor: p.flavor?.toUpperCase() ?? p.flavor,
      name: p.name?.toUpperCase() ?? p.name,
      sku: p.sku?.toUpperCase() ?? p.sku,
    }).eq("id", p.id);
  }
}

export async function deleteProductAction(id: string, mode: "plain" | "loss" = "plain", units?: number) {
  await requireAdminSession();
  const supabase = createAdminClient();

  // Bloquear eliminación si hay pedidos activos (pending/confirmed) con este producto
  const { data: activeItems } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("product_id", id);
  if (activeItems && activeItems.length > 0) {
    const orderIds = activeItems.map((i: { order_id: string }) => i.order_id);
    const { data: activeOrders } = await (supabase as any)
      .from("orders")
      .select("number")
      .in("id", orderIds)
      .in("status", ["pending", "confirmed"]) as { data: { number: number }[] | null };
    if (activeOrders && activeOrders.length > 0) {
      const nums = activeOrders.map((o) => `#${o.number}`).join(", ");
      throw new Error(`No se puede eliminar: el producto tiene pedidos activos (${nums})`);
    }
  }

  if (mode === "loss") {
    const { data: product } = await (supabase as any).from("products").select("cost_price, stock_actual, name, sku, units_per_pack").eq("id", id).single() as { data: { cost_price: number; stock_actual: number; name: string; sku: string; units_per_pack: number } | null };
    if (product && product.cost_price > 0) {
      const qty = units ?? product.stock_actual;
      const upp = (product.units_per_pack ?? 1) || 1;
      const unitCost = product.cost_price / upp;
      const totalCost = unitCost * qty;
      await supabase.from("cash_movements").insert({
        type: "manual_expense",
        amount: totalCost,
        currency: "USD",
        caja: "Oficina",
        note: `Pérdida de stock: ${product.name} (${qty} uds × U$D ${unitCost.toFixed(4)}) [SKU: ${product.sku}]`,
      });
      // Si no elimina todas las unidades, solo resta del stock
      if (qty < product.stock_actual) {
        await supabase.from("products").update({ stock_actual: product.stock_actual - qty }).eq("id", id);
        return;
      }
    }
  }

  await supabase.from("inventory_movements").delete().eq("product_id", id);
  await supabase.from("purchase_items").delete().eq("product_id", id);
  await supabase.from("order_items").delete().eq("product_id", id);
  await supabase.from("products").delete().eq("id", id);
}

export async function bulkSetVisibilityAction(ids: string[], visible: boolean) {
  await requireAdminSession();
  await createAdminClient().from("products").update({ visible }).in("id", ids);
}

export async function toggleProductVisibilityAction(id: string) {
  await requireAdminSession();
  const supabase = createAdminClient();
  const { data } = await supabase.from("products").select("visible").eq("id", id).single();
  if (data) {
    await supabase.from("products").update({ visible: !data.visible }).eq("id", id);
  }
}

// ─── PEDIDOS ─────────────────────────────────────────────────

export async function getOrdersAction(): Promise<Order[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as Order[];
}

export async function getOrdersWithCostAction(month?: string) {
  await requireAdminSession();
  const supabase = createAdminClient();
  const [ordersRes, itemsRes, prodsRes, invMovRes] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("order_items").select("order_id, product_id, qty"),
    supabase.from("products").select("id, cost_price, units_per_pack"),
    // Costo histórico real por order_id+product_id desde inventory_movements
    supabase.from("inventory_movements").select("order_id, product_id, qty, unit_cost").eq("type", "egreso").not("order_id", "is", null),
  ]);
  // Costo histórico FIFO: sumar (qty * unit_cost) por (order_id, product_id) — multi-lote.
  const histCostByKey: Record<string, number> = {};
  const histQtyByKey: Record<string, number> = {};
  for (const m of invMovRes.data || []) {
    if (m.order_id && m.product_id) {
      const k = `${m.order_id}:${m.product_id}`;
      histCostByKey[k] = (histCostByKey[k] ?? 0) + m.qty * (m.unit_cost ?? 0);
      histQtyByKey[k] = (histQtyByKey[k] ?? 0) + m.qty;
    }
  }
  // Costo actual como fallback (para órdenes sin egresos aún — pending)
  const currentCostMap: Record<string, number> = {};
  for (const p of prodsRes.data || []) {
    const upack = (p.units_per_pack ?? 1) || 1;
    currentCostMap[p.id] = (p.cost_price ?? 0) / upack;
  }
  const orderCostMap: Record<string, number> = {};
  const orderUnitsMap: Record<string, number> = {};
  for (const it of itemsRes.data || []) {
    if (!orderCostMap[it.order_id]) orderCostMap[it.order_id] = 0;
    if (!orderUnitsMap[it.order_id]) orderUnitsMap[it.order_id] = 0;
    const k = `${it.order_id}:${it.product_id}`;
    if (histQtyByKey[k] && histQtyByKey[k] >= it.qty) {
      orderCostMap[it.order_id] += histCostByKey[k];
    } else {
      orderCostMap[it.order_id] += it.qty * (currentCostMap[it.product_id] ?? 0);
    }
    orderUnitsMap[it.order_id] += it.qty;
  }
  const rows = (ordersRes.data || []).map((o: any) => ({
    ...(o as Order),
    total_cost: Math.round((orderCostMap[o.id] ?? 0) * 100) / 100,
    total_units: orderUnitsMap[o.id] ?? 0,
  }));

  // Filtro de mes opcional: para confirmed → confirmed_at, para pending → created_at,
  // para cancelled → created_at. Si no se pasa month, devuelve todo (compat).
  if (!month) return rows;
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const startISO = `${month}-01T00:00:00`;
  const endISO = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59`;
  return rows.filter(o => {
    const ref = o.status === "confirmed" ? (o.confirmed_at || o.created_at) : o.created_at;
    return !!ref && ref >= startISO && ref <= endISO;
  });
}

export async function getOrderByIdAction(id: string): Promise<Order | null> {
  await requireAdminSession();
  const { data } = await createAdminClient().from("orders").select("*").eq("id", id).single();
  return (data || null) as Order | null;
}

export async function getOrderItemsAction(orderId: string): Promise<(OrderItem & { unit_cost: number; brand: string; model: string; flavor: string })[]> {
  await requireAdminSession();
  const supabase = createAdminClient();
  const [itemsRes, prodsRes, invMovRes] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", orderId),
    (supabase as any).from("products").select("id, cost_price, units_per_pack, brand, model, flavor"),
    // Costo histórico real al momento de la venta — puede haber múltiples filas egreso por producto (FIFO multi-lote)
    supabase.from("inventory_movements").select("product_id, qty, unit_cost").eq("order_id", orderId).eq("type", "egreso"),
  ]);
  // Costo histórico FIFO ponderado por cantidad: sumar costo y qty por producto, luego promediar.
  const histAggMap: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const m of invMovRes.data || []) {
    if (m.product_id != null) {
      if (!histAggMap[m.product_id]) histAggMap[m.product_id] = { totalCost: 0, totalQty: 0 };
      histAggMap[m.product_id].totalCost += m.qty * (m.unit_cost ?? 0);
      histAggMap[m.product_id].totalQty += m.qty;
    }
  }
  const prodInfoMap: Record<string, { cost: number; brand: string; model: string; flavor: string }> = {};
  for (const p of prodsRes.data || []) {
    const upack = (p.units_per_pack ?? 1) || 1;
    prodInfoMap[p.id] = { cost: (p.cost_price ?? 0) / upack, brand: p.brand || "", model: p.model || "", flavor: p.flavor || "" };
  }
  return (itemsRes.data || []).map((i: any) => {
    const agg = histAggMap[i.product_id];
    const histUnitCost = agg && agg.totalQty > 0 ? agg.totalCost / agg.totalQty : null;
    return {
      ...(i as OrderItem),
      unit_cost: histUnitCost ?? prodInfoMap[i.product_id]?.cost ?? 0,
      brand: prodInfoMap[i.product_id]?.brand ?? "",
      model: prodInfoMap[i.product_id]?.model ?? "",
      flavor: prodInfoMap[i.product_id]?.flavor ?? "",
    };
  });
}

export async function getOrderPaymentsAction(orderId: string): Promise<{ movements: CashMovement[]; debts: Debt[] }> {
  await requireAdminSession();
  const supabase = createAdminClient();
  const [{ data: movements }, { data: debts }] = await Promise.all([
    supabase.from("cash_movements").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
    supabase.from("debts").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
  ]);
  return { movements: (movements || []) as CashMovement[], debts: (debts || []) as Debt[] };
}

export async function getOrdersByCustomerPhoneAction(phone: string): Promise<Order[]> {
  await requireAdminSession();
  const normalized = phone.replace(/\D/g, "").slice(-10);
  const { data } = await createAdminClient()
    .from("orders")
    .select("*")
    .ilike("customer_phone", `%${normalized}`)
    .order("created_at", { ascending: false });
  return (data || []) as Order[];
}

export async function confirmOrderAction(
  orderId: string,
  payments: { caja: string; currency: "ARS" | "USD"; amount: number }[],
  fxRate: number,
  confirmedAt?: string,
) {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "pending") return;

  // Leer wholesale_min_qty para auto-upgrade de cliente
  const { data: wMinRow } = await supabase.from("config").select("value").eq("key", "wholesale_min_qty").maybeSingle();
  const wholesaleMinQty = parseInt(wMinRow?.value ?? "15") || 15;

  // Moneda base del pedido: mayorista = USD, minorista = ARS
  const orderCurrency: "ARS" | "USD" = order.type === "wholesale" ? "USD" : "ARS";

  // Total cobrado normalizado a la moneda del pedido
  const totalPaidNormalized = round2(payments.reduce((sum, p) => {
    if (p.amount <= 0) return sum;
    if (p.currency === orderCurrency) return sum + p.amount;
    return orderCurrency === "ARS"
      ? sum + p.amount * fxRate   // USD → ARS
      : sum + p.amount / fxRate;  // ARS → USD
  }, 0));

  const remaining = round2(order.total - totalPaidNormalized);
  const paymentStatus = totalPaidNormalized >= order.total ? "paid" : totalPaidNormalized > 0 ? "partial" : "pending";

  await supabase.from("orders").update({
    status: "confirmed",
    confirmed_at: confirmedAt || new Date().toISOString(),
    payment_status: paymentStatus,
  }).eq("id", orderId);

  // FIFO: Para cada producto, calcular lotes disponibles consumiendo desde el más viejo.
  // Si una venta abarca más de un lote, se generan múltiples filas egreso (una por lote).
  const productIds = (order.order_items || []).map((i: any) => i.product_id);
  const fallbackCostMap: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: prods } = await (supabase as any)
      .from("products")
      .select("id, cost_price, units_per_pack")
      .in("id", productIds);
    for (const p of (prods || [])) {
      const upp = (p.units_per_pack ?? 1) || 1;
      fallbackCostMap[p.id] = (p.cost_price ?? 0) / upp;
    }
  }

  for (const item of (order.order_items || [])) {
    const { data: product } = await supabase
      .from("products")
      .select("stock_actual, stock_reservado")
      .eq("id", item.product_id)
      .single();
    if (!product) continue;

    const consumed = await consumeFifoLots(supabase, item.product_id, item.qty, fallbackCostMap[item.product_id] ?? 0);

    await supabase.from("products").update({
      stock_actual: Math.max(0, product.stock_actual - item.qty),
      stock_reservado: Math.max(0, product.stock_reservado - item.qty),
    }).eq("id", item.product_id);

    for (const c of consumed) {
      await supabase.from("inventory_movements").insert({
        product_id: item.product_id,
        product_sku: item.product_sku,
        type: "egreso",
        qty: c.qty,
        unit_cost: c.unit_cost,
        order_id: orderId,
        note: `Confirmado #${order.number}`,
      });
    }
  }

  // Registrar un cash_movement por cada fila de pago
  for (const p of payments) {
    if (p.amount <= 0) continue;
    await supabase.from("cash_movements").insert({
      type: "sale_income",
      amount: p.amount,
      currency: p.currency,
      caja: p.caja,
      category: paymentStatus === "paid" ? "Venta" : "Venta (parcial)",
      order_id: orderId,
      note: `Pedido #${order.number} - ${order.customer_name}`,
      ...(confirmedAt ? { created_at: confirmedAt } : {}),
    });
  }

  // Verificar si ya existe una deuda RECEIVABLE para este pedido (evitar duplicados por doble confirmación)
  // Usamos .limit(1) en lugar de .maybeSingle() para no fallar si hay múltiples deudas vinculadas
  const { data: existingDebtRows } = await supabase
    .from("debts")
    .select("id, status, paid_amount, original_amount")
    .eq("order_id", orderId)
    .eq("type", "receivable")
    .limit(1);
  const existingDebt = existingDebtRows?.[0] ?? null;

  if (!existingDebt) {
    // Primera confirmación: crear deuda si aplica
    if (remaining > 0.01) {
      await supabase.from("debts").insert({
        type: "receivable",
        entity_name: order.customer_name,
        entity_type: "customer",
        entity_id: order.customer_id,
        original_amount: order.total,
        currency: orderCurrency,
        paid_amount: totalPaidNormalized,
        order_id: orderId,
        note: `Pedido #${order.number}`,
        status: paymentStatus,
      });
    }
    // Si el cliente pagó más → saldo a favor (deuda a pagar al cliente)
    if (remaining < -0.01) {
      await supabase.from("debts").insert({
        type: "payable",
        entity_name: order.customer_name,
        entity_type: "customer",
        entity_id: order.customer_id,
        original_amount: Math.abs(remaining),
        currency: orderCurrency,
        paid_amount: 0,
        order_id: orderId,
        note: `Saldo a favor - Pedido #${order.number}`,
        status: "pending",
      });
    }
  } else if (existingDebt.status !== "paid") {
    // Deuda existente no pagada: actualizar paid_amount con el nuevo pago
    const newPaid = Math.min(
      (existingDebt.paid_amount || 0) + totalPaidNormalized,
      existingDebt.original_amount
    );
    const newStatus = newPaid >= existingDebt.original_amount ? "paid" : "partial";
    await supabase.from("debts").update({ paid_amount: newPaid, status: newStatus }).eq("id", existingDebt.id);
  }

  // Auto-upgrade: si el pedido tiene wholesale_min_qty+ unidades y el cliente es minorista → mayorista
  const totalQty = (order.order_items || []).reduce((s: number, item: any) => s + item.qty, 0);
  if (totalQty >= wholesaleMinQty && order.customer_phone) {
    const normalized = order.customer_phone.replace(/\D/g, "").slice(-10);
    const { data: customerRows } = await supabase
      .from("customers")
      .select("id, type")
      .ilike("phone", `%${normalized}`)
      .limit(1);
    const customer = customerRows?.[0] ?? null;
    if (customer && customer.type === "retail") {
      await supabase.from("customers").update({ type: "wholesale" }).eq("id", customer.id);
    }
  }

  // Deduplicación de clientes
  const orderPhone = order.customer_phone?.trim();
  const orderName = order.customer_name?.trim().toLowerCase();

  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at");

  let duplicateWarning: { type: "phone" | "name"; customer: Customer } | null = null;

  if (existingCustomers) {
    let exactMatch: Customer | null = null;
    let phoneOnlyMatch: Customer | null = null;
    let nameOnlyMatch: Customer | null = null;

    for (const c of existingCustomers) {
      const cPhone = c.phone?.trim();
      const cName = c.name?.trim().toLowerCase();
      const phoneMatch = cPhone && orderPhone && cPhone === orderPhone;
      const nameMatch = cName && orderName && cName === orderName;

      if (phoneMatch && nameMatch) { exactMatch = c as Customer; break; }
      if (phoneMatch && !nameMatch) phoneOnlyMatch = c as Customer;
      if (nameMatch && !phoneMatch) nameOnlyMatch = c as Customer;
    }

    if (exactMatch) {
      // Merge automático: reasignar pedidos y deudas del invitado al cliente registrado
      await supabase.from("orders")
        .update({ customer_id: exactMatch.id })
        .eq("customer_phone", orderPhone)
        .is("customer_id", null);

      await supabase.from("debts")
        .update({ entity_id: exactMatch.id, entity_name: exactMatch.name })
        .eq("entity_name", order.customer_name)
        .is("entity_id", null);
    }

    duplicateWarning = phoneOnlyMatch
      ? { type: "phone", customer: phoneOnlyMatch }
      : nameOnlyMatch
      ? { type: "name", customer: nameOnlyMatch }
      : null;
  }

  return { success: true, duplicateWarning };
}

/**
 * Confirma un pedido como CAMBIO/REPOSICIÓN (sin cobro):
 * - Marca la orden como confirmed con payment_status='exchange'.
 * - Descuenta stock y genera inventory_movements egreso (FIFO real → costo a P&L).
 * - NO crea cash_movements (nadie cobró nada).
 * - NO crea deudas (no hay nada por cobrar).
 * El P&L lo computa como pérdida total a precio de costo.
 */
export async function confirmExchangeAction(orderId: string) {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "pending") return;

  await supabase.from("orders").update({
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
    payment_status: "exchange",
    total: 0,
  }).eq("id", orderId);

  // FIFO real para que el COGS quede contabilizado como pérdida
  const productIds = (order.order_items || []).map((i: any) => i.product_id);
  const fallbackCostMap: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: prods } = await (supabase as any)
      .from("products")
      .select("id, cost_price, units_per_pack")
      .in("id", productIds);
    for (const p of (prods || [])) {
      const upp = (p.units_per_pack ?? 1) || 1;
      fallbackCostMap[p.id] = (p.cost_price ?? 0) / upp;
    }
  }

  for (const item of (order.order_items || [])) {
    const { data: product } = await supabase
      .from("products")
      .select("stock_actual, stock_reservado")
      .eq("id", item.product_id)
      .single();
    if (!product) continue;

    const consumed = await consumeFifoLots(supabase, item.product_id, item.qty, fallbackCostMap[item.product_id] ?? 0);

    await supabase.from("products").update({
      stock_actual: Math.max(0, product.stock_actual - item.qty),
      stock_reservado: Math.max(0, product.stock_reservado - item.qty),
    }).eq("id", item.product_id);

    for (const c of consumed) {
      await supabase.from("inventory_movements").insert({
        product_id: item.product_id,
        product_sku: item.product_sku,
        type: "egreso",
        qty: c.qty,
        unit_cost: c.unit_cost,
        order_id: orderId,
        note: `Cambio/reposición #${order.number}`,
      });
    }
  }

  return { success: true };
}

export async function cancelOrderAction(orderId: string, reverseCash: boolean = false) {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (!order || order.status === "cancelled") return;

  await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);

  for (const item of (order.order_items || [])) {
    const { data: product } = await supabase
      .from("products")
      .select("stock_actual, stock_reservado")
      .eq("id", item.product_id)
      .single();

    if (product) {
      if (order.status === "pending") {
        // Liberar stock reservado
        await supabase.from("products").update({
          stock_reservado: Math.max(0, product.stock_reservado - item.qty),
        }).eq("id", item.product_id);
        await supabase.from("inventory_movements").insert({
          product_id: item.product_id,
          product_sku: item.product_sku,
          type: "liberacion",
          qty: item.qty,
          order_id: orderId,
          note: `Cancelado #${order.number}`,
        });
      } else if (order.status === "confirmed") {
        // Devolver stock al inventario y liberar los lotes FIFO consumidos
        // borrando los egresos (en vez de un ajuste_positivo a costo 0).
        await supabase.from("products").update({
          stock_actual: product.stock_actual + item.qty,
        }).eq("id", item.product_id);
        await supabase.from("inventory_movements")
          .delete()
          .eq("order_id", orderId)
          .eq("product_id", item.product_id)
          .eq("type", "egreso");
      }
    }
  }

  // Revertir movimientos de caja si se solicita
  if (reverseCash) {
    await supabase.from("cash_movements").delete().eq("order_id", orderId);
  }

  // Eliminar deudas asociadas al pedido cancelado
  if (order.status === "confirmed") {
    // Siempre eliminar deudas receivable (lo que el cliente nos debía — se cancela la venta)
    const { data: receivableDebts } = await supabase.from("debts").select("id").eq("order_id", orderId).eq("type", "receivable");
    const receivableIds = (receivableDebts || []).map((d: { id: string }) => d.id);
    if (receivableIds.length > 0) {
      // Si se revierte efectivo, revertir también los cobros de deuda que no tienen order_id
      if (reverseCash) {
        const { data: dps } = await supabase.from("debt_payments")
          .select("amount, currency, caja")
          .in("debt_id", receivableIds);
        // Agrupar por caja+currency para crear un único ajuste_out por combinación
        const reversals: Record<string, { amount: number; currency: string; caja: string }> = {};
        for (const dp of (dps || []) as { amount: number; currency: string; caja: string }[]) {
          const key = `${dp.caja}:${dp.currency}`;
          if (!reversals[key]) reversals[key] = { amount: 0, currency: dp.currency, caja: dp.caja };
          reversals[key].amount = round2(reversals[key].amount + dp.amount);
        }
        for (const rev of Object.values(reversals)) {
          if (rev.amount > 0.001) {
            await supabase.from("cash_movements").insert({
              type: "ajuste_out",
              amount: rev.amount,
              currency: rev.currency,
              caja: rev.caja,
              category: "Reversa cobro deuda",
              note: `Cancelación pedido #${order.number} — reversa cobro deuda`,
            });
          }
        }
      }
      await supabase.from("debt_payments").delete().in("debt_id", receivableIds);
      await supabase.from("debts").delete().in("id", receivableIds);
    }
    // Solo eliminar deudas payable (saldo a favor del cliente) si también se revierte el efectivo.
    // Si no se revierte el efectivo, el cliente ya pagó ese dinero y el crédito debe permanecer.
    if (reverseCash) {
      const { data: payableDebts } = await supabase.from("debts").select("id").eq("order_id", orderId).eq("type", "payable");
      const payableIds = (payableDebts || []).map((d: { id: string }) => d.id);
      if (payableIds.length > 0) {
        await supabase.from("debt_payments").delete().in("debt_id", payableIds);
        await supabase.from("debts").delete().in("id", payableIds);
      }
    }
  }
}

// ─── CLIENTES ────────────────────────────────────────────────

export async function getCustomersAction(): Promise<Customer[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as Customer[];
}

export async function resolveDuplicateAction(id: string) {
  await requireAdminSession();
  await createAdminClient()
    .from("customers")
    .update({ has_duplicate_warning: false, duplicate_names: [] })
    .eq("id", id);
}

export async function updateCustomerStatusAction(id: string, status: "active" | "pending" | "rejected" | "blocked") {
  await requireAdminSession();
  await createAdminClient().from("customers").update({ status }).eq("id", id);
}

export async function updateCustomerAction(id: string, data: {
  name: string; phone: string; address: string; zone: string; notes: string; nickname?: string;
}) {
  await requireAdminSession();
  // Excluir campos que no existen en la tabla customers
  const { nickname: _ignored, ...validFields } = data;
  await createAdminClient().from("customers").update(validFields).eq("id", id);
}

// ─── CAJA ─────────────────────────────────────────────────────

export async function getCashMovementsAction(): Promise<CashMovement[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("cash_movements")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as CashMovement[];
}

export async function addCashMovementAction(
  movement: Omit<CashMovement, "id" | "created_at"> & { created_at?: string }
) {
  await requireAdminSession();
  const { error } = await createAdminClient().from("cash_movements").insert(movement);
  if (error) throw new Error(error.message);
}

export async function createManualDebtAction(
  type: "receivable" | "payable",
  entityName: string,
  entityType: "customer" | "supplier",
  amount: number,
  currency: "ARS" | "USD",
  note: string
): Promise<void> {
  await requireAdminSession();
  await createAdminClient().from("debts").insert({
    type,
    entity_name: entityName,
    entity_type: entityType,
    original_amount: amount,
    currency,
    paid_amount: 0,
    status: "pending",
    note: note || (type === "receivable" ? "Deuda a cobrar" : "Deuda a pagar"),
  });
}

// ─── INVENTARIO ──────────────────────────────────────────────

export async function getInventoryMovementsAction(): Promise<InventoryMovement[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as InventoryMovement[];
}

// ─── COMPRAS (PURCHASES) + FIFO ───────────────────────────────

export async function getPurchasesAction(): Promise<Purchase[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("purchases")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as Purchase[];
}

export async function getPurchaseItemsAction(purchaseId: string): Promise<PurchaseItem[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("purchase_items")
    .select("*")
    .eq("purchase_id", purchaseId);
  return (data || []) as PurchaseItem[];
}

export async function createPurchaseAction(
  purchase: { supplier: string; currency: "ARS" | "USD"; note: string; purchase_date?: string },
  items: { product_id: string; product_sku: string; product_name: string; qty: number; unit_cost: number }[]
): Promise<{ purchaseId: string }> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const total = items.reduce((s, i) => s + i.qty * i.unit_cost, 0);

  const insertPayload = {
    supplier: purchase.supplier,
    currency: purchase.currency,
    note: purchase.note,
    total,
    payment_status: "pending" as string,
    paid_amount: 0,
    ...(purchase.purchase_date ? { created_at: purchase.purchase_date } : {}),
  };

  const { data: pur, error } = await supabase
    .from("purchases")
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("purchase_items").insert(
    items.map(i => ({
      purchase_id: pur.id,
      product_id: i.product_id,
      product_sku: i.product_sku,
      product_name: i.product_name,
      qty: i.qty,
      unit_cost: i.unit_cost,
      subtotal: i.qty * i.unit_cost,
    }))
  );

  return { purchaseId: pur.id };
}

export async function getPurchaseByIdAction(purchaseId: string): Promise<Purchase | null> {
  await requireAdminSession();
  const { data } = await createAdminClient().from("purchases").select("*").eq("id", purchaseId).single();
  return (data as Purchase) || null;
}

/**
 * confirmType "partial": pago adelantado → impacta caja, NO suma stock. payment_status → "partial".
 * confirmType "received": recepción de mercadería → suma stock. payment_status → "received" o "paid" si ya todo pagado.
 *   Si paidAmount > 0 en "received", también impacta caja.
 */
export async function confirmPurchaseAction(
  purchaseId: string,
  confirmType: "partial" | "received",
  caja: string,
  paidAmount: number,
  currency: "ARS" | "USD",
  receivedDate?: string
): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: pur } = await supabase.from("purchases").select("*").eq("id", purchaseId).single();
  if (!pur) throw new Error("Compra no encontrada");

  const purchase = pur as Purchase;

  // Convertir el pago a la moneda de la compra para actualizar paid_amount correctamente.
  // Si la moneda del pago difiere, leer el tipo de cambio desde config.
  let paidInPurchaseCurrency: number;
  if (currency === purchase.currency) {
    paidInPurchaseCurrency = paidAmount;
  } else {
    // Leer FX desde config (fallback a 1000 si no está configurado)
    const { data: fxRow } = await supabase.from("config").select("value").eq("key", "fx_usdt_ars").maybeSingle();
    const fxRate = parseFloat(fxRow?.value ?? "1000") || 1000;
    paidInPurchaseCurrency = purchase.currency === "USD"
      ? paidAmount / fxRate   // ARS → USD
      : paidAmount * fxRate;  // USD → ARS
  }
  const newPaidAmount = round2((purchase.paid_amount || 0) + paidInPurchaseCurrency);
  const remaining = round2(purchase.total - newPaidAmount);

  // Estado: si recibió mercadería → "received" o "paid" (si también está todo pagado)
  //         si solo pagó adelantado → "partial"
  let newStatus: Purchase["payment_status"];
  if (confirmType === "received") {
    // Llegó la mercadería: "paid" si ya está todo pagado, "received" si queda deuda
    newStatus = remaining <= 0.01 ? "paid" : "received";
  } else {
    // Pago adelantado: siempre queda en "partial" aunque haya pagado el total,
    // porque la mercadería todavía no llegó
    newStatus = "partial";
  }

  const updatePayload: Record<string, unknown> = {
    payment_status: newStatus,
    paid_amount: newPaidAmount,
  };
  if (confirmType === "received" && receivedDate) updatePayload.received_at = receivedDate;
  else if (confirmType === "received" && !receivedDate) updatePayload.received_at = new Date().toISOString();

  await supabase.from("purchases").update(updatePayload).eq("id", purchaseId);

  // Impactar caja si se pagó algo
  if (paidAmount > 0.001) {
    await supabase.from("cash_movements").insert({
      type: "purchase_expense",
      amount: paidAmount,
      currency,
      caja,
      category: "Compra",
      note: `Compra #${purchase.number} - ${purchase.supplier}`,
    });
  }

  // Generar, actualizar o saldar deuda
  // Usar .limit(1) para evitar error si hay múltiples deudas asociadas a la misma compra
  const { data: existingDebtRows } = await supabase.from("debts").select("id").eq("purchase_id", purchaseId).limit(1);
  const existingDebt = existingDebtRows?.[0] ?? null;

  if (remaining > 0.01) {
    // Queda saldo a pagar al proveedor
    if (existingDebt) {
      await supabase.from("debts").update({
        paid_amount: newPaidAmount,
        status: "partial",
      }).eq("id", existingDebt.id);
    } else {
      await supabase.from("debts").insert({
        type: "payable",
        entity_name: purchase.supplier,
        entity_type: "supplier",
        original_amount: purchase.total,
        currency: purchase.currency, // siempre en la moneda de la compra, no del pago
        paid_amount: paidInPurchaseCurrency,
        purchase_id: purchaseId,
        note: `Compra #${purchase.number}`,
        status: paidInPurchaseCurrency > 0 ? "partial" : "pending",
      });
    }
  } else if (remaining < -0.01) {
    // Pagó de más: saldar deuda existente y crear deuda a cobrar por el exceso
    if (existingDebt) {
      await supabase.from("debts").update({ paid_amount: purchase.total, status: "paid" }).eq("id", existingDebt.id);
    }
    const excess = Math.abs(remaining);
    await supabase.from("debts").insert({
      type: "receivable",
      entity_name: purchase.supplier,
      entity_type: "supplier",
      original_amount: excess,
      currency,
      paid_amount: 0,
      purchase_id: purchaseId,
      note: `Excedente de pago — Compra #${purchase.number}`,
      status: "pending",
    });
  } else {
    // Pagado exacto: saldar deuda si existía
    if (existingDebt) {
      await supabase.from("debts").update({ paid_amount: purchase.total, status: "paid" }).eq("id", existingDebt.id);
    }
  }

  // Si es recepción de mercadería: actualizar stock e inventory_movements
  // Guard basado en movimientos reales (no en status), para evitar doble stock
  // incluso si el status ya era "received" pero el stock no llegó a aplicarse.
  if (confirmType === "received") {
    const { data: existingMovements } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("purchase_id", purchaseId)
      .eq("type", "ingreso")
      .limit(1);
    const stockAlreadyApplied = existingMovements && existingMovements.length > 0;

    if (stockAlreadyApplied) {
      // Stock ya fue aplicado — no hacer nada más (solo el pago ya fue registrado arriba)
      return;
    }

    const { data: purchaseItems, error: itemsError } = await supabase
      .from("purchase_items")
      .select("*")
      .eq("purchase_id", purchaseId);

    if (itemsError) throw new Error(`Error al leer items de la compra: ${itemsError.message}`);
    if (!purchaseItems || purchaseItems.length === 0) throw new Error("La compra no tiene items registrados. No se puede recibir.");

    // FX para convertir unit_cost a USD si la compra es en ARS (cost_price siempre en USD)
    let fxForCost = 1;
    if (purchase.currency === "ARS") {
      const { data: fxRow } = await supabase.from("config").select("value").eq("key", "fx_usdt_ars").maybeSingle();
      fxForCost = parseFloat(fxRow?.value ?? "1000") || 1000;
    }

    for (const item of purchaseItems) {
      // Leer stock actual justo antes de actualizar para evitar race conditions
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, stock_actual")
        .eq("id", item.product_id)
        .single();

      if (productError || !product) throw new Error(`Producto no encontrado (id: ${item.product_id}): ${productError?.message ?? "sin datos"}`);

      // Sobrescribir cost_price con el unit_cost de la compra (convertido a USD si la compra era ARS).
      // Esto mantiene el "último costo conocido" actualizado y mejora el fallback FIFO
      // para stock cargado manualmente sin lotes registrados.
      const newCostUsd = purchase.currency === "USD" ? item.unit_cost : item.unit_cost / fxForCost;

      const { error: stockError } = await supabase
        .from("products")
        .update({
          stock_actual: product.stock_actual + item.qty,
          cost_price: newCostUsd,
        })
        .eq("id", item.product_id);

      if (stockError) throw new Error(`Error al actualizar stock de "${item.product_name}": ${stockError.message}`);

      const { error: movError } = await supabase.from("inventory_movements").insert({
        product_id: item.product_id,
        product_sku: item.product_sku,
        type: "ingreso",
        qty: item.qty,
        unit_cost: item.unit_cost,
        purchase_id: purchaseId,
        note: `Compra #${purchase.number} - ${purchase.supplier}`,
      });

      if (movError) throw new Error(`Error al registrar movimiento de inventario: ${movError.message}`);
    }
  }
}

export async function cancelPurchaseAction(purchaseId: string): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();
  // Una sola consulta para obtener todos los campos necesarios
  const { data: pur } = await supabase.from("purchases").select("payment_status, number, supplier").eq("id", purchaseId).single();
  // No se puede cancelar lo que ya está pagado o ya fue cancelado
  if (!pur || pur.payment_status === "paid" || pur.payment_status === "cancelled") return;

  // Si la mercadería ya fue recibida ("received"), revertir el stock de todos los ítems
  if (pur.payment_status === "received") {
    const { data: purchaseItems } = await supabase
      .from("purchase_items")
      .select("product_id, qty")
      .eq("purchase_id", purchaseId);
    for (const item of (purchaseItems || []) as { product_id: string; qty: number }[]) {
      const { data: product } = await supabase.from("products").select("stock_actual").eq("id", item.product_id).single();
      if (product) {
        await supabase.from("products")
          .update({ stock_actual: Math.max(0, product.stock_actual - item.qty) })
          .eq("id", item.product_id);
      }
    }
    // Eliminar los inventory_movements de ingreso generados al recibir esta compra
    await supabase.from("inventory_movements").delete().eq("purchase_id", purchaseId).eq("type", "ingreso");
  }

  await supabase.from("purchases").update({ payment_status: "cancelled" }).eq("id", purchaseId);
  // Revertir movimientos de caja asociados (pagos adelantados que ya se habían registrado)
  // El patrón usa prefijo exacto "Compra #N - " (con espacio y guión) para evitar que el número
  // de la compra #12 también coincida con notas de la compra #123, #1234, etc.
  await supabase.from("cash_movements").delete()
    .eq("type", "purchase_expense")
    .like("note", `Compra #${pur.number} - %`);
  // Cancelar deuda asociada si existe
  await supabase.from("debts").delete().eq("purchase_id", purchaseId);
}

// ─── DEUDAS ───────────────────────────────────────────────────

export interface CustomerAccount {
  key: string;
  entityId: string | null;
  entityName: string;
  entityType: "customer" | "supplier";
  phone?: string;
  balanceARS: { receivable: number; credit: number; net: number };
  balanceUSD: { receivable: number; credit: number; net: number };
  hasBalance: boolean;
  debts: Debt[];
}

export async function getCustomerAccountsAction(): Promise<CustomerAccount[]> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: debts } = await supabase
    .from("debts")
    .select("*")
    .order("created_at", { ascending: true });

  const allDebts = (debts || []) as Debt[];

  // Agrupar por entity_id si existe, si no por nombre normalizado
  const groups = new Map<string, { key: string; name: string; entityId: string | null; entityType: "customer" | "supplier"; debts: Debt[] }>();
  for (const debt of allDebts) {
    const key = debt.entity_id ? `id:${debt.entity_id}` : `name:${debt.entity_name.toLowerCase().trim()}`;
    if (!groups.has(key)) {
      groups.set(key, { key, name: debt.entity_name, entityId: debt.entity_id || null, entityType: debt.entity_type as "customer" | "supplier", debts: [] });
    }
    groups.get(key)!.debts.push(debt);
  }

  // Traer nombre completo y teléfono de clientes con entity_id
  const customerIds = [...groups.values()].filter(g => g.entityId && g.entityType === "customer").map(g => g.entityId!);
  const phoneMap: Record<string, string> = {};
  const nameMap: Record<string, string> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabase.from("customers").select("id, name, phone").in("id", customerIds);
    for (const c of (customers || [])) {
      phoneMap[c.id] = c.phone;
      nameMap[c.id] = c.name;
    }
  }

  return [...groups.values()].map(g => {
    const pending = g.debts.filter(d => d.status === "pending" || d.status === "partial");
    const receivable = pending.filter(d => d.type === "receivable");
    const credit = pending.filter(d => d.type === "payable");

    const calcARS = (arr: Debt[]) => arr.filter(d => d.currency === "ARS").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
    const calcUSD = (arr: Debt[]) => arr.filter(d => d.currency === "USD").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);

    const recARS = calcARS(receivable), credARS = calcARS(credit);
    const recUSD = calcUSD(receivable), credUSD = calcUSD(credit);

    return {
      key: g.key,
      entityId: g.entityId,
      entityName: g.entityId ? (nameMap[g.entityId] || g.name) : g.name,
      entityType: g.entityType,
      phone: g.entityId ? phoneMap[g.entityId] : undefined,
      balanceARS: { receivable: recARS, credit: credARS, net: recARS - credARS },
      balanceUSD: { receivable: recUSD, credit: credUSD, net: recUSD - credUSD },
      hasBalance: recARS > 0 || credARS > 0 || recUSD > 0 || credUSD > 0,
      debts: g.debts,
    };
  }).filter(a => a.debts.length > 0);
}

export async function getCustomerDebtBalanceAction(
  customerId: string | null,
  customerName: string
): Promise<{ receivableARS: number; receivableUSD: number; payableARS: number; payableUSD: number }> {
  await requireAdminSession();
  const supabase = createAdminClient();

  let query = supabase.from("debts").select("type, currency, original_amount, paid_amount").in("status", ["pending", "partial"]);

  if (customerId) {
    query = query.eq("entity_id", customerId);
  } else {
    query = query.ilike("entity_name", customerName.trim());
  }

  const { data } = await query;
  const debts = (data || []) as { type: string; currency: string; original_amount: number; paid_amount: number }[];

  const sum = (type: string, currency: string) =>
    debts.filter(d => d.type === type && d.currency === currency).reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);

  return {
    receivableARS: sum("receivable", "ARS"),
    receivableUSD: sum("receivable", "USD"),
    payableARS: sum("payable", "ARS"),
    payableUSD: sum("payable", "USD"),
  };
}

export async function payCustomerAccountAction(
  entityId: string | null,
  entityName: string,
  amount: number,
  currency: "ARS" | "USD",
  caja: string,
  note: string = "",
  /**
   * Si se pasa fxRate>0, habilita FX dual: busca deudas receivable en CUALQUIER moneda
   * y convierte el monto recibido para aplicar a cada deuda. Sin fxRate (default), mantiene
   * el comportamiento previo (solo deudas en misma moneda que el pago).
   */
  fxRate?: number,
): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();

  // Si llegó fxRate: ramo FX dual — aplica a deudas en cualquier moneda.
  if (fxRate && fxRate > 0) {
    let q = supabase.from("debts").select("*").eq("type", "receivable").neq("status", "paid").neq("status", "cancelled").neq("status", "archived").order("created_at", { ascending: true });
    if (entityId) q = q.eq("entity_id", entityId);
    else q = q.ilike("entity_name", entityName.trim());
    const { data } = await q;
    const receivableDebts = (data || []) as Debt[];

    // remainingPayment se mantiene en la moneda del PAGO (currency) y se descuenta a medida
    // que se cubre cada deuda (convirtiendo el "toPay" en moneda-de-deuda a moneda-de-pago).
    let remainingPayment = round2(amount);
    for (const debt of receivableDebts) {
      if (remainingPayment <= 0.001) break;
      const debtRemaining = round2(debt.original_amount - debt.paid_amount);
      if (debtRemaining <= 0.001) continue;

      // Cuánto del pago entrante (en su moneda) equivale a `debtRemaining` (en moneda de deuda)
      let paymentNeededForFullDebt: number;
      if (debt.currency === currency) {
        paymentNeededForFullDebt = debtRemaining;
      } else if (debt.currency === "ARS" && currency === "USD") {
        paymentNeededForFullDebt = debtRemaining / fxRate;
      } else if (debt.currency === "USD" && currency === "ARS") {
        paymentNeededForFullDebt = debtRemaining * fxRate;
      } else {
        paymentNeededForFullDebt = debtRemaining;
      }
      paymentNeededForFullDebt = round2(paymentNeededForFullDebt);

      const paymentApplied = round2(Math.min(remainingPayment, paymentNeededForFullDebt));
      // Convertir paymentApplied a la moneda de la deuda
      let amountInDebtCurrency: number;
      if (debt.currency === currency) {
        amountInDebtCurrency = paymentApplied;
      } else if (debt.currency === "ARS" && currency === "USD") {
        amountInDebtCurrency = paymentApplied * fxRate;
      } else if (debt.currency === "USD" && currency === "ARS") {
        amountInDebtCurrency = paymentApplied / fxRate;
      } else {
        amountInDebtCurrency = paymentApplied;
      }
      amountInDebtCurrency = round2(Math.min(amountInDebtCurrency, debtRemaining));

      const newPaid = round2(debt.paid_amount + amountInDebtCurrency);
      const newStatus = newPaid >= debt.original_amount ? "paid" : "partial";
      await supabase.from("debts").update({ paid_amount: newPaid, status: newStatus }).eq("id", debt.id);

      await supabase.from("debt_payments").insert({
        debt_id: debt.id,
        amount: amountInDebtCurrency,
        currency: debt.currency,
        caja,
        note: (note || `Pago de cuenta - ${entityName}`) + (debt.currency !== currency ? ` [${paymentApplied} ${currency} @ FX ${fxRate} = ${amountInDebtCurrency.toFixed(2)} ${debt.currency}]` : ""),
        payment_currency: currency,
        payment_amount: paymentApplied,
        fx_rate_used: debt.currency !== currency ? fxRate : null,
      });

      remainingPayment = round2(remainingPayment - paymentApplied);
    }

    // Excedente queda como saldo a favor en la moneda del pago
    if (remainingPayment > 0.01) {
      await supabase.from("debts").insert({
        type: "payable",
        entity_name: entityName,
        entity_type: "customer",
        entity_id: entityId || undefined,
        original_amount: remainingPayment,
        currency,
        paid_amount: 0,
        note: `Saldo a favor${note ? " - " + note : ""}`,
        status: "pending",
      });
    }

    await supabase.from("cash_movements").insert({
      type: "manual_income",
      amount,
      currency,
      caja,
      category: "Cobro deuda",
      note: note || `Cobro cuenta - ${entityName}`,
    });
    return;
  }

  // Comportamiento clásico (sin FX dual): solo deudas misma moneda.
  let q = supabase.from("debts").select("*").eq("type", "receivable").eq("currency", currency).neq("status", "paid").order("created_at", { ascending: true });
  if (entityId) q = q.eq("entity_id", entityId);
  else q = q.ilike("entity_name", entityName.trim());

  const { data } = await q;
  const receivableDebts = (data || []) as Debt[];

  // Aplicar pago a deudas en orden
  let remaining = round2(amount);
  for (const debt of receivableDebts) {
    if (remaining <= 0.01) break;
    const debtRemaining = round2(debt.original_amount - debt.paid_amount);
    const toPay = round2(Math.min(remaining, debtRemaining));
    const newPaid = round2(debt.paid_amount + toPay);

    await supabase.from("debts").update({
      paid_amount: newPaid,
      status: newPaid >= debt.original_amount ? "paid" : "partial",
    }).eq("id", debt.id);

    await supabase.from("debt_payments").insert({
      debt_id: debt.id,
      amount: toPay,
      currency,
      caja,
      note: note || `Pago de cuenta - ${entityName}`,
    });

    remaining = round2(remaining - toPay);
  }

  // Si sobró dinero → registrar como saldo a favor (payable)
  if (remaining > 0.01) {
    await supabase.from("debts").insert({
      type: "payable",
      entity_name: entityName,
      entity_type: "customer",
      entity_id: entityId || undefined,
      original_amount: remaining,
      currency,
      paid_amount: 0,
      note: `Saldo a favor${note ? " - " + note : ""}`,
      status: "pending",
    });
  }

  // Registrar en caja
  await supabase.from("cash_movements").insert({
    type: "manual_income",
    amount,
    currency,
    caja,
    category: "Cobro deuda",
    note: note || `Cobro cuenta - ${entityName}`,
  });
}

export async function getDebtsAction(): Promise<Debt[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("debts")
    .select("*")
    .in("status", ["pending", "partial"])
    .order("created_at", { ascending: false });
  return (data || []) as Debt[];
}

export async function getAllDebtsAction(): Promise<Debt[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("debts")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as Debt[];
}

export async function getDebtPaymentsAction(debtId: string): Promise<DebtPayment[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("debt_payments")
    .select("*")
    .eq("debt_id", debtId)
    .order("created_at", { ascending: false });
  return (data || []) as DebtPayment[];
}

export async function payDebtAction(
  debtId: string,
  amount: number,
  caja: string,
  note: string = ""
): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: debt } = await supabase.from("debts").select("*").eq("id", debtId).single();
  if (!debt) throw new Error("Deuda no encontrada");

  const remaining = round2(debt.original_amount - (debt.paid_amount || 0));
  const toPay = round2(Math.min(amount, remaining));
  const excess = round2(amount - toPay);

  const newPaid = round2((debt.paid_amount || 0) + toPay);
  const newStatus = newPaid >= debt.original_amount ? "paid" : "partial";

  await supabase.from("debts").update({
    paid_amount: newPaid,
    status: newStatus,
  }).eq("id", debtId);

  await supabase.from("debt_payments").insert({
    debt_id: debtId,
    amount: toPay,
    currency: debt.currency,
    caja,
    note: note || `Pago de deuda`,
  });

  // Impactar en caja por el monto total recibido/pagado
  const movType = debt.type === "receivable" ? "manual_income" : "manual_expense";
  // Deudas standalone (sin purchase_id) son gastos operativos reales → afectan profit
  const movCategory = debt.type === "receivable"
    ? "Cobro deuda"
    : (!debt.purchase_id ? "Gasto operativo" : "Pago deuda");
  await supabase.from("cash_movements").insert({
    type: movType,
    amount,
    currency: debt.currency,
    caja,
    category: movCategory,
    note: note || `Pago deuda - ${debt.entity_name}`,
  });

  // Si pagó de más → crear deuda del tipo opuesto por el excedente
  if (excess > 0.01) {
    const oppositeType = debt.type === "receivable" ? "payable" : "receivable";
    await supabase.from("debts").insert({
      type: oppositeType,
      entity_name: debt.entity_name,
      entity_type: debt.entity_type,
      entity_id: debt.entity_id || undefined,
      original_amount: excess,
      currency: debt.currency,
      paid_amount: 0,
      status: "pending",
      note: `Excedente de pago — ${debt.entity_name}`,
    });
  }

  // Actualizar purchase si corresponde
  if (debt.purchase_id && debt.type === "payable") {
    const { data: purchase } = await supabase.from("purchases").select("currency, payment_status").eq("id", debt.purchase_id).single();
    // Determinar el nuevo estado de la compra:
    // - Si la deuda quedó saldada → "paid"
    // - Si la compra ya estaba en "received" (mercadería llegó pero quedó deuda) → mantener "received"
    // - Otros casos → "partial"
    let purchaseNewStatus: string;
    if (newStatus === "paid") {
      purchaseNewStatus = "paid";
    } else if (purchase?.payment_status === "received") {
      purchaseNewStatus = "received";
    } else {
      purchaseNewStatus = "partial";
    }
    // Solo actualizar paid_amount si las monedas coinciden para evitar mezclar valores
    const purchaseUpdate: { payment_status: string; paid_amount?: number } = { payment_status: purchaseNewStatus };
    if (purchase && purchase.currency === debt.currency) {
      purchaseUpdate.paid_amount = newPaid;
    }
    await supabase.from("purchases").update(purchaseUpdate).eq("id", debt.purchase_id);
  }
}

export async function deleteDebtAction(debtId: string): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();
  await supabase.from("debt_payments").delete().eq("debt_id", debtId);
  await supabase.from("debts").delete().eq("id", debtId);
}

/**
 * Cancela una deuda — la marca como "cancelled".
 * NO impacta caja ni P&L: como si la deuda nunca hubiera existido.
 * La deuda permanece en la tabla pero se filtra de los pendientes.
 */
export async function cancelDebtAction(debtId: string, reason?: string): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();
  const noteSuffix = reason?.trim() ? ` — Cancelada: ${reason.trim()}` : " — Cancelada";
  const { data: debt } = await supabase.from("debts").select("note").eq("id", debtId).single();
  const newNote = `${debt?.note || ""}${noteSuffix}`.trim();
  await supabase.from("debts").update({ status: "cancelled", note: newNote }).eq("id", debtId);
}

/**
 * Archiva una deuda — la marca como "archived" y registra el impacto en P&L.
 * - Receivable archivada → manual_expense con category "Castigo deuda incobrable" (pérdida).
 * - Payable archivada → manual_income con category "Perdón de deuda recibido" (ganancia).
 * Se usa affects_cash=false para que NO impacte el balance de caja, solo P&L.
 */
export async function archiveDebtAction(debtId: string, reason?: string): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: debt } = await supabase.from("debts").select("*").eq("id", debtId).single();
  if (!debt) throw new Error("Deuda no encontrada");
  if (debt.status === "paid" || debt.status === "archived" || debt.status === "cancelled") return;

  const remaining = round2(debt.original_amount - debt.paid_amount);
  if (remaining <= 0.001) {
    await supabase.from("debts").update({ status: "archived" }).eq("id", debtId);
    return;
  }

  const isReceivable = debt.type === "receivable";
  const movType = isReceivable ? "manual_expense" : "manual_income";
  const category = isReceivable ? "Castigo deuda incobrable" : "Perdón de deuda recibido";
  const note = `${isReceivable ? "Castigo" : "Perdón"} - ${debt.entity_name}${reason?.trim() ? ` - ${reason.trim()}` : ""}`;

  await supabase.from("cash_movements").insert({
    type: movType,
    amount: remaining,
    currency: debt.currency,
    caja: "Oficina",
    category,
    note,
    affects_cash: false, // No mueve caja real, solo afecta P&L
  });

  const noteSuffix = reason?.trim() ? ` — Archivada: ${reason.trim()}` : " — Archivada";
  const newNote = `${debt.note || ""}${noteSuffix}`.trim();
  await supabase.from("debts").update({ status: "archived", note: newNote }).eq("id", debtId);
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────

export async function getConfigAction(): Promise<Record<string, string>> {
  await requireAdminSession();
  const { data } = await createAdminClient().from("config").select("*");
  const result: Record<string, string> = {};
  for (const row of data || []) {
    result[row.key] = row.value;
  }
  return result;
}

const NUMERIC_CONFIG_KEYS = ["fx_usdt_ars", "wholesale_min_qty"];

export async function setConfigAction(key: string, value: string): Promise<void> {
  await requireAdminSession();
  if (NUMERIC_CONFIG_KEYS.includes(key)) {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) throw new Error(`Valor inválido para "${key}": debe ser un número positivo`);
  }
  await createAdminClient().from("config").upsert({ key, value, updated_at: new Date().toISOString() });
}

export async function setManyConfigAction(pairs: Record<string, string>): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();
  for (const [key, value] of Object.entries(pairs)) {
    if (NUMERIC_CONFIG_KEYS.includes(key)) {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) throw new Error(`Valor inválido para "${key}": debe ser un número positivo`);
    }
    await supabase.from("config").upsert({ key, value, updated_at: new Date().toISOString() });
  }
}

// ─── FX RATE LIVE ─────────────────────────────────────────────

export interface FxRatesResult {
  binance: number | null;
  dolarhoy: number | null;
  average: number | null;
  error?: string;
}

export async function fetchLiveFxRatesAction(): Promise<FxRatesResult> {
  await requireAdminSession();

  let binance: number | null = null;
  let dolarhoy: number | null = null;

  // Binance P2P: precio promedio de los 3 mejores anuncios de venta de USDT por ARS
  try {
    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset: "USDT", fiat: "ARS", tradeType: "SELL",
        page: 1, rows: 3, payTypes: [],
      }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const prices: number[] = (json?.data || []).map((d: { adv: { price: string } }) => parseFloat(d.adv.price)).filter((p: number) => p > 0);
      if (prices.length > 0) binance = Math.round((prices.reduce((a: number, b: number) => a + b, 0) / prices.length) * 100) / 100;
    }
  } catch { /* ignore */ }

  // DolarHoy API (dolarapi.com): tasa cripto ARS
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/cripto", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      // Usamos "venta" como referencia de precio de compra de USD
      if (json?.venta) dolarhoy = Math.round(parseFloat(json.venta) * 100) / 100;
    }
  } catch { /* ignore */ }

  const values = [binance, dolarhoy].filter((v): v is number => v !== null);
  const average = values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;

  return { binance, dolarhoy, average };
}

// ─── PROFIT / GANANCIAS ───────────────────────────────────────

export async function getProfitDataAction(month?: string) {
  await requireAdminSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const period = month || new Date().toISOString().slice(0, 7);

  const [year, mon] = period.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const startDate = `${period}-01`;
  const endDate = `${period}-${String(lastDay).padStart(2, "0")}`;
  const startISO = `${startDate}T00:00:00`;
  const endISO = `${endDate}T23:59:59`;

  // FX FullVIP venta (único para todas las conversiones ARS→USD)
  const fxFullvip = await getFxFullvipVenta();

  // Traemos pending + confirmed sin filtrar por mes en DB (filtramos en JS)
  // porque para confirmed importa confirmed_at y para pending importa created_at.
  const [ordersRes, cashRes, cfgRes, invMovRes, prodsRes] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").in("status", ["pending", "confirmed"]),
    supabase.from("cash_movements").select("*")
      .gte("created_at", startISO).lte("created_at", endISO),
    supabase.from("config").select("*"),
    // COGS real: todos los egresos (sin filtrar por fecha — el match es por order_id)
    supabase.from("inventory_movements").select("order_id, product_id, qty, unit_cost").eq("type", "egreso").not("order_id", "is", null),
    supabase.from("products").select("id, cost_price, units_per_pack"),
  ]);

  const cfg: Record<string, string> = {};
  for (const row of cfgRes.data || []) cfg[row.key] = row.value;
  const fxDefault = Math.max(1, parseFloat(cfg["fx_usdt_ars"] || "") || 1000);

  // Mapa de COGS histórico por (order_id, product_id) — multi-lote FIFO
  const cogsAggMap: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const m of invMovRes.data || []) {
    if (m.order_id && m.product_id) {
      const k = `${m.order_id}:${m.product_id}`;
      if (!cogsAggMap[k]) cogsAggMap[k] = { totalCost: 0, totalQty: 0 };
      cogsAggMap[k].totalCost += m.qty * (m.unit_cost ?? 0);
      cogsAggMap[k].totalQty += m.qty;
    }
  }
  // Costo actual por producto (fallback para pendings sin egresos todavía)
  const currentCostMap: Record<string, number> = {};
  for (const p of prodsRes.data || []) {
    const upack = (p.units_per_pack ?? 1) || 1;
    currentCostMap[p.id] = (p.cost_price ?? 0) / upack;
  }

  const allOrders = (ordersRes.data || []) as any[];
  const movements = (cashRes.data || []) as CashMovement[];

  // Filtrar por mes: confirmed por confirmed_at, pending por created_at
  const inPeriod = (iso: string | null | undefined) =>
    !!iso && iso >= startISO && iso <= endISO;
  const periodOrders = allOrders.filter(o =>
    o.status === "confirmed" ? inPeriod(o.confirmed_at) :
    o.status === "pending"   ? inPeriod(o.created_at) :
    false
  );

  type OrderProfit = {
    id: string; number: number; date: string; customerName: string;
    type: string; status: string; fxUsed: number;
    revenueUsd: number; cogsUsd: number; grossProfitUsd: number;
    items: { name: string; qty: number; unitPrice: number; costPrice: number; revenueUsd: number; cogsUsd: number; grossProfitUsd: number }[];
  };

  const orderProfits: OrderProfit[] = [];

  for (const order of periodOrders) {
    const items = (order.order_items || []) as any[];
    const isRetail = order.type === "retail";
    const isExchange = order.payment_status === "exchange";

    // Revenue de la orden: o.total ya incluye descuento y recargo aplicados server-side.
    // Si es cambio (exchange) → 0.
    const orderRevenueUsd = isExchange
      ? 0
      : isRetail
      ? Math.max(0, (order.total ?? 0) / fxFullvip)
      : Math.max(0, order.total ?? 0);

    // Costo: sumar (qty * unit_cost) de cada item.
    //  - Si hay egreso histórico con qty suficiente, usar costo histórico (FIFO).
    //  - Si no (típico en pending), usar cost_price actual del producto como fallback.
    let orderCogsUsd = 0;
    const itemDetails: OrderProfit["items"] = [];
    for (const item of items) {
      const k = `${order.id}:${item.product_id}`;
      const agg = cogsAggMap[k];
      let cogsUsd: number;
      let unitCost: number;
      if (agg && agg.totalQty >= item.qty) {
        cogsUsd = agg.totalCost;
        unitCost = agg.totalQty > 0 ? agg.totalCost / agg.totalQty : 0;
      } else {
        unitCost = currentCostMap[item.product_id] ?? 0;
        cogsUsd = unitCost * item.qty;
      }
      orderCogsUsd += cogsUsd;
      // Revenue por item solo informativo (proporcional a unit_price)
      const itemSubtotalSrc = item.unit_price * item.qty;
      const itemSubtotalUsd = isRetail ? itemSubtotalSrc / fxFullvip : itemSubtotalSrc;
      const itemRevenueUsd = isExchange ? 0 : itemSubtotalUsd;
      itemDetails.push({
        name: item.product_name,
        qty: item.qty,
        unitPrice: item.unit_price,
        costPrice: unitCost,
        revenueUsd: itemRevenueUsd,
        cogsUsd,
        grossProfitUsd: itemRevenueUsd - cogsUsd,
      });
    }

    orderProfits.push({
      id: order.id,
      number: order.number,
      date: order.confirmed_at || order.created_at,
      customerName: order.customer_name,
      type: order.type,
      status: order.status,
      fxUsed: fxFullvip,
      revenueUsd: orderRevenueUsd,
      cogsUsd: orderCogsUsd,
      grossProfitUsd: orderRevenueUsd - orderCogsUsd,
      items: itemDetails,
    });
  }

  const totalRevenueUsd = orderProfits.reduce((s, o) => s + o.revenueUsd, 0);
  const totalCogsUsd = orderProfits.reduce((s, o) => s + o.cogsUsd, 0);
  const totalGrossProfitUsd = orderProfits.reduce((s, o) => s + o.grossProfitUsd, 0);
  const totalUnitsSold = orderProfits.reduce((s, o) => s + o.items.reduce((si, i) => si + i.qty, 0), 0);

  // ── Gastos operativos (manual_expense, NO purchase_expense, NO anulados) ──
  type ExpenseRow = {
    date: string; description: string; category: string;
    currency: string; amount: number; fxUsed: number; amountUsd: number;
  };

  const expenseDetail: ExpenseRow[] = movements
    .filter(m => m.type === "manual_expense" && m.category !== "Pago deuda" && !m.voided)
    .map(m => {
      const amountUsd = m.currency === "USD" ? m.amount : m.amount / fxFullvip;
      return {
        date: m.created_at,
        description: m.note || m.category,
        category: m.category,
        currency: m.currency,
        amount: m.amount,
        fxUsed: fxFullvip,
        amountUsd,
      };
    });

  const totalExpensesUsd = expenseDetail.reduce((s, e) => s + e.amountUsd, 0);

  // ── Otros ingresos manuales (excluye cobros de deuda ya en revenue, y anulados) ──
  const otherIncomeDetail = movements
    .filter(m => m.type === "manual_income" && m.category !== "Cobro deuda" && !m.voided)
    .map(m => {
      const amountUsd = m.currency === "USD" ? m.amount : m.amount / fxFullvip;
      return {
        date: m.created_at,
        description: m.note || m.category,
        category: m.category,
        currency: m.currency,
        amount: m.amount,
        fxUsed: fxFullvip,
        amountUsd,
      };
    });

  const totalOtherIncomeUsd = otherIncomeDetail.reduce((s, e) => s + e.amountUsd, 0);

  const netProfitUsd = totalGrossProfitUsd - totalExpensesUsd + totalOtherIncomeUsd;

  const expensesByCategory: Record<string, number> = {};
  for (const e of expenseDetail) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amountUsd;
  }

  return {
    period,
    fxDefault,
    fxFullvip,
    dailyFxMap: {} as Record<string, number>,
    totalRevenueUsd,
    totalCogsUsd,
    totalGrossProfitUsd,
    totalUnitsSold,
    totalExpensesUsd,
    totalOtherIncomeUsd,
    netProfitUsd,
    ordersCount: orderProfits.length,
    orderProfits,
    expenseDetail,
    otherIncomeDetail,
    expensesByCategory,
  };
}

// ─── BALANCE (SNAPSHOTS AUTOMÁTICOS) ─────────────────────────

export async function getBalanceSnapshotsAction(): Promise<BalanceSnapshot[]> {
  await requireAdminSession();
  const { data } = await createAdminClient()
    .from("balance_snapshots")
    .select("*")
    .order("period", { ascending: false });
  return (data || []) as BalanceSnapshot[];
}

export async function ensureMonthlySnapshotAction(): Promise<{ created: boolean; period: string }> {
  await requireAdminSession();
  const supabase = createAdminClient();

  // El snapshot es del mes ANTERIOR (se toma el 01 del mes actual)
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = prevMonth.toISOString().slice(0, 7);

  // Verificar si ya existe
  const { data: existing } = await supabase.from("balance_snapshots").select("id").eq("period", period).maybeSingle();
  if (existing) return { created: false, period };

  // Calcular datos del período
  const [snapshotYear, snapshotMon] = period.split("-").map(Number);
  const lastDayOfMonth = new Date(snapshotYear, snapshotMon, 0).getDate();
  const periodEnd = `${period}-${String(lastDayOfMonth).padStart(2, "0")}`;
  const [{ data: products }, { data: cashMov }, { data: purs }, { data: debts }, { data: cfgRows }, { data: postPeriodMovs }] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("cash_movements").select("*").gte("created_at", `${period}-01T00:00:00`).lte("created_at", `${periodEnd}T23:59:59`),
    supabase.from("purchases").select("*").gte("created_at", `${period}-01T00:00:00`).lte("created_at", `${periodEnd}T23:59:59`),
    supabase.from("debts").select("*"),
    supabase.from("config").select("*"),
    // Movimientos de inventario POSTERIORES al período para reconstruir stock histórico
    supabase.from("inventory_movements").select("product_id, type, qty").gt("created_at", `${periodEnd}T23:59:59`),
  ]);

  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value;
  const fxRate = Math.max(1, parseFloat(cfg["fx_usdt_ars"] || "") || 1000);

  const prods = (products || []) as Product[];
  const movements = (cashMov || []) as CashMovement[];
  const purchases = (purs || []) as Purchase[];
  const allDebts = (debts || []) as Debt[];

  // Reconstruir stock al fin del período: stock_actual - ingresos_post + egresos_post
  // Tipos que suman stock: ingreso, ajuste_positivo
  // Tipos que restan stock: egreso, ajuste_negativo
  // "liberacion" solo afecta stock_reservado → se ignora para stock_actual
  const stockAdjust: Record<string, number> = {};
  for (const m of (postPeriodMovs || []) as { product_id: string; type: string; qty: number }[]) {
    if (!stockAdjust[m.product_id]) stockAdjust[m.product_id] = 0;
    if (["ingreso", "ajuste_positivo"].includes(m.type)) stockAdjust[m.product_id] -= m.qty;
    else if (["egreso", "ajuste_negativo"].includes(m.type)) stockAdjust[m.product_id] += m.qty;
  }

  // Caja acumulada hasta el fin del período del snapshot (no incluir movimientos posteriores)
  let cashArs = 0, cashUsd = 0;
  const allMovs = (await supabase.from("cash_movements").select("type, amount, currency, created_at")
    .lte("created_at", `${periodEnd}T23:59:59`)).data || [];
  for (const m of allMovs as { type: string; amount: number; currency: string; created_at: string }[]) {
    const sign = ["sale_income", "manual_income", "ajuste_in"].includes(m.type) ? 1 : -1;
    if (m.currency === "ARS") cashArs += sign * m.amount;
    else cashUsd += sign * m.amount;
  }

  const inventoryCostUsd = prods.reduce((s, p) => {
    const upp = ((p as any).units_per_pack ?? 1) || 1;
    const historicStock = Math.max(0, p.stock_actual + (stockAdjust[p.id] || 0));
    return s + (historicStock / upp) * (p.price_may_x15 || 0);
  }, 0);
  const inventoryValueArs = prods.reduce((s, p) => {
    const upp = ((p as any).units_per_pack ?? 1) || 1;
    const historicStock = Math.max(0, p.stock_actual + (stockAdjust[p.id] || 0));
    return s + (historicStock / upp) * p.price_min_ars;
  }, 0);

  const salesArs = movements.filter(m => m.type === "sale_income" && m.currency === "ARS").reduce((s, m) => s + m.amount, 0);
  const salesUsd = movements.filter(m => m.type === "sale_income" && m.currency === "USD").reduce((s, m) => s + m.amount, 0);
  // Solo gastos operativos (manual_expense). purchase_expense ya está en total_purchases_usd — no doblar conteo.
  // Excluir "Pago deuda" (no es gasto operativo, es cancelación de pasivo)
  const expensesArs = movements.filter(m => m.type === "manual_expense" && m.currency === "ARS" && m.category !== "Pago deuda").reduce((s, m) => s + m.amount, 0);
  const expensesUsd = movements.filter(m => m.type === "manual_expense" && m.currency === "USD" && m.category !== "Pago deuda").reduce((s, m) => s + m.amount, 0);
  const purchasesUsd = purchases.filter(p => p.currency === "USD").reduce((s, p) => s + p.total, 0);

  const pendingDebts = allDebts.filter(d => d.status === "pending" || d.status === "partial");
  const receivableArs = pendingDebts.filter(d => d.type === "receivable" && d.currency === "ARS").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  const receivableUsd = pendingDebts.filter(d => d.type === "receivable" && d.currency === "USD").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  const payableArs = pendingDebts.filter(d => d.type === "payable" && d.currency === "ARS").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  const payableUsd = pendingDebts.filter(d => d.type === "payable" && d.currency === "USD").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);

  const activeProducts = prods.filter(p => p.visible).length;
  const totalStock = prods.reduce((s, p) => Math.max(0, p.stock_actual + (stockAdjust[p.id] || 0)), 0);
  const stockValueUsd = prods.reduce((s, p) => {
    const upp = ((p as any).units_per_pack ?? 1) || 1;
    const historicStock = Math.max(0, p.stock_actual + (stockAdjust[p.id] || 0));
    return s + (historicStock / upp) * (p.price_may_x15 || 0);
  }, 0);
  const patrimonioNetoUsd = (cashUsd + cashArs / fxRate) + stockValueUsd + receivableUsd + receivableArs / fxRate - payableUsd - payableArs / fxRate;

  const snapshot = {
    period,
    snapshot_date: now.toISOString().slice(0, 10),
    cash_ars: cashArs,
    cash_usd: cashUsd,
    cash_usdt: 0,
    inventory_cost_usd: inventoryCostUsd,
    inventory_value_ars: inventoryValueArs,
    stock_value_usd: stockValueUsd,
    in_transit_value_usd: 0,
    patrimonio_neto_usd: patrimonioNetoUsd,
    total_sales_ars: salesArs,
    total_sales_usd: salesUsd,
    total_expenses_ars: expensesArs,
    total_expenses_usd: expensesUsd,
    total_purchases_usd: purchasesUsd,
    receivable_ars: receivableArs,
    receivable_usd: receivableUsd,
    payable_ars: payableArs,
    payable_usd: payableUsd,
    active_products: activeProducts,
    total_stock: totalStock,
    fx_usdt_ars: fxRate,
    notes: `Balance automático generado el ${now.toLocaleDateString("es-AR")}`,
  };

  await supabase.from("balance_snapshots").insert(snapshot);
  return { created: true, period };
}

// ─── BALANCE GENERAL ─────────────────────────────────────────

async function computeBalance(supabase: ReturnType<typeof createAdminClient>): Promise<LiveBalance> {
  const [
    { data: products },
    { data: allMovs },
    { data: allDebts },
    { data: cfgRows },
    { data: partialPurchases },
    binance,
    cripto,
  ] = await Promise.all([
    (supabase as any).from("products").select("id, price_may_x15, cost_price, stock_actual, visible, units_per_pack"),
    (supabase as any).from("cash_movements").select("type, amount, currency, caja, affects_cash").eq("affects_cash", true),
    supabase.from("debts").select("type, currency, original_amount, paid_amount, status"),
    supabase.from("config").select("key, value"),
    supabase.from("purchases").select("id").eq("payment_status", "partial"),
    getBinanceP2PAction().catch(() => ({ buy: null, sell: null })),
    getDolarCriptoAction().catch(() => ({ compra: null, venta: null })),
  ]);

  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value;
  const fxRate = Math.max(1, parseFloat(cfg["fx_usdt_ars"] || "") || 1000);

  // FX para deudas ARS → USD: mid del promedio FullVIP del día.
  // FullVIP = promedio entre Binance P2P y Dolar Cripto. Mid = (compra + venta) / 2.
  // Si alguno de los 4 valores no está disponible, fallback al fxRate del config.
  let fxRateDebts = fxRate;
  let fxRateDebtsSource: "fullvip" | "config" = "config";
  if (binance.buy != null && binance.sell != null && cripto.compra != null && cripto.venta != null) {
    const fullvipCompra = (binance.buy + cripto.compra) / 2;
    const fullvipVenta = (binance.sell + cripto.venta) / 2;
    const mid = (fullvipCompra + fullvipVenta) / 2;
    if (mid > 0) {
      fxRateDebts = mid;
      fxRateDebtsSource = "fullvip";
    }
  }

  const prods = (products || []) as unknown as { id: string; price_may_x15: number; cost_price: number | null; stock_actual: number; visible: boolean; units_per_pack: number | null }[];
  const movements = (allMovs || []) as CashMovement[];
  const debts = (allDebts || []) as Debt[];

  const stockValueUSD = prods.reduce((s, p) => {
    const upp = (p.units_per_pack ?? 1) || 1;
    return s + (p.stock_actual / upp) * (p.price_may_x15 || 0);
  }, 0);
  const activeProducts = prods.filter(p => p.visible).length;
  const totalStock = prods.reduce((s, p) => s + p.stock_actual, 0);

  let cashArs = 0, cashUsd = 0;
  const cajaBreakdown: Record<string, { ars: number; usd: number }> = {};
  for (const m of movements as (CashMovement & { caja: string })[]) {
    const sign = ["sale_income", "manual_income", "ajuste_in"].includes(m.type) ? 1 : -1;
    if (m.currency === "ARS") cashArs += sign * m.amount;
    else cashUsd += sign * m.amount;
    // Desglose por caja
    if (m.caja) {
      if (!cajaBreakdown[m.caja]) cajaBreakdown[m.caja] = { ars: 0, usd: 0 };
      if (m.currency === "ARS") cajaBreakdown[m.caja].ars += sign * m.amount;
      else cajaBreakdown[m.caja].usd += sign * m.amount;
    }
  }

  let inTransitValueUSD = 0;
  const partialIds = (partialPurchases || []).map((p: { id: string }) => p.id);
  if (partialIds.length > 0) {
    const { data: transitItems } = await supabase
      .from("purchase_items")
      .select("qty, product_id")
      .in("purchase_id", partialIds);
    for (const item of (transitItems || []) as { qty: number; product_id: string }[]) {
      const prod = prods.find(p => p.id === item.product_id);
      if (prod) {
        // Valorizar al costo (cost_price), no al precio de venta mayorista
        const unitValue = prod.cost_price || prod.price_may_x15 || 0;
        inTransitValueUSD += item.qty * unitValue;
      }
    }
  }

  const pendingDebts = debts.filter(d => d.status === "pending" || d.status === "partial");
  const receivableUSD = pendingDebts.filter(d => d.type === "receivable" && d.currency === "USD").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  const receivableARS = pendingDebts.filter(d => d.type === "receivable" && d.currency === "ARS").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  const payableUSD = pendingDebts.filter(d => d.type === "payable" && d.currency === "USD").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  const payableARS = pendingDebts.filter(d => d.type === "payable" && d.currency === "ARS").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);

  // Caja ARS y stock siguen con el FX del config (refleja el valor "vigente" interno).
  // Las deudas usan el FX promedio FullVIP del día (más fiel al mercado).
  const totalAssetsUSD = stockValueUSD + cashUsd + (cashArs / fxRate) + inTransitValueUSD + receivableUSD + (receivableARS / fxRateDebts);
  const totalLiabilitiesUSD = payableUSD + (payableARS / fxRateDebts);
  const patrimonioNeto = totalAssetsUSD - totalLiabilitiesUSD;

  return { fxRate, fxRateDebts, fxRateDebtsSource, stockValueUSD, cashUsd, cashArs, cashArsUSD: cashArs / fxRate, inTransitValueUSD, receivableUSD, receivableARS, payableUSD, payableARS, totalAssetsUSD, totalLiabilitiesUSD, patrimonioNeto, activeProducts, totalStock, cajaBreakdown };
}

export async function getCurrentBalanceAction(): Promise<LiveBalance> {
  await requireAdminSession();
  return computeBalance(createAdminClient());
}

export async function closeMonthAction(): Promise<{ period: string }> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const now = new Date();
  const period = now.toISOString().slice(0, 7);
  const snapshotDate = now.toISOString().slice(0, 10);

  const b = await computeBalance(supabase);

  // Calcular ventas/gastos/compras del período actual (igual que ensureMonthlySnapshotAction)
  const [{ data: periodMovs }, { data: periodPurchases }, { data: prodsForCost }] = await Promise.all([
    supabase.from("cash_movements").select("type, amount, currency")
      .gte("created_at", `${period}-01T00:00:00`)
      .lte("created_at", `${snapshotDate}T23:59:59`),
    supabase.from("purchases").select("total, currency")
      .gte("created_at", `${period}-01T00:00:00`)
      .lte("created_at", `${snapshotDate}T23:59:59`),
    (supabase as any).from("products").select("stock_actual, cost_price, units_per_pack"),
  ]);
  const movs = (periodMovs || []) as CashMovement[];
  const salesArs = movs.filter(m => m.type === "sale_income" && m.currency === "ARS").reduce((s, m) => s + m.amount, 0);
  const salesUsd = movs.filter(m => m.type === "sale_income" && m.currency === "USD").reduce((s, m) => s + m.amount, 0);
  const expensesArs = movs.filter(m => m.type === "manual_expense" && m.currency === "ARS" && m.category !== "Pago deuda").reduce((s, m) => s + m.amount, 0);
  const expensesUsd = movs.filter(m => m.type === "manual_expense" && m.currency === "USD" && m.category !== "Pago deuda").reduce((s, m) => s + m.amount, 0);
  const purchasesUsd = (periodPurchases || []).filter((p: { currency: string }) => p.currency === "USD").reduce((s: number, p: { total: number }) => s + p.total, 0);
  const inventoryCostUsd = (prodsForCost || []).reduce((s: number, pr: { stock_actual: number; cost_price: number | null; units_per_pack: number | null }) => {
    const upp = (pr.units_per_pack ?? 1) || 1;
    return s + (pr.stock_actual / upp) * (pr.cost_price || 0);
  }, 0);

  const snapshot = {
    period,
    snapshot_date: snapshotDate,
    cash_ars: b.cashArs,
    cash_usd: b.cashUsd,
    cash_usdt: 0,
    stock_value_usd: b.stockValueUSD,
    in_transit_value_usd: b.inTransitValueUSD,
    inventory_cost_usd: inventoryCostUsd,
    inventory_value_ars: 0,
    total_sales_ars: salesArs,
    total_sales_usd: salesUsd,
    total_expenses_ars: expensesArs,
    total_expenses_usd: expensesUsd,
    total_purchases_usd: purchasesUsd,
    receivable_ars: b.receivableARS,
    receivable_usd: b.receivableUSD,
    payable_ars: b.payableARS,
    payable_usd: b.payableUSD,
    active_products: b.activeProducts,
    total_stock: b.totalStock,
    fx_usdt_ars: b.fxRate,
    patrimonio_neto_usd: b.patrimonioNeto,
    notes: `Cierre manual — ${snapshotDate}`,
  };

  await supabase.from("balance_snapshots").upsert(snapshot, { onConflict: "period" });
  return { period };
}

export async function deletePurchaseAction(purchaseId: string): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { data: pur } = await supabase.from("purchases").select("*").eq("id", purchaseId).single();
  if (!pur) throw new Error("Compra no encontrada");
  const purchase = pur as Purchase;

  // Revertir stock si fue recibida
  if (purchase.payment_status === "received" || purchase.payment_status === "paid") {
    const { data: purchaseItems } = await supabase.from("purchase_items").select("*").eq("purchase_id", purchaseId);
    for (const item of (purchaseItems || []) as PurchaseItem[]) {
      const { data: prod } = await supabase.from("products").select("stock_actual").eq("id", item.product_id).single();
      if (prod) {
        await supabase.from("products").update({
          stock_actual: Math.max(0, prod.stock_actual - item.qty),
        }).eq("id", item.product_id);
      }
    }
  }

  // Eliminar movimientos de caja asociados (solo purchase_expense con nota exacta de la compra)
  await supabase.from("cash_movements")
    .delete()
    .eq("type", "purchase_expense")
    .like("note", `Compra #${purchase.number} - %`);

  // Eliminar resto (cascade elimina purchase_items e inventory_movements por FK)
  await supabase.from("debts").delete().eq("purchase_id", purchaseId);
  await supabase.from("inventory_movements").delete().eq("purchase_id", purchaseId);
  await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId);
  await supabase.from("purchases").delete().eq("id", purchaseId);
}

// ─── UPLOAD DE IMAGEN ─────────────────────────────────────────

export async function uploadProductImageAction(formData: FormData): Promise<string> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const file = formData.get("file") as File;
  if (!file) throw new Error("No se recibió archivo");

  const filename = `product-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Auto-crear el bucket si no existe
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === "product-images");
  if (!bucketExists) {
    const { error: bucketError } = await supabase.storage.createBucket("product-images", { public: true });
    if (bucketError) throw new Error(`No se pudo crear el bucket: ${bucketError.message}`);
  }

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filename, buffer, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filename);
  return urlData.publicUrl;
}

// ─── IMPORT IMAGEN DESDE URL EXTERNA ─────────────────────────
// Descarga la imagen de la URL y la re-sube a Supabase Storage
// para garantizar que sea una URL propia (evita CORS y expiración)

export async function importImageFromUrlAction(imageUrl: string): Promise<string> {
  await requireAdminSession();
  const supabase = createAdminClient();

  // Validar que la URL no apunte a IPs privadas/internas (prevenir SSRF)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("URL inválida");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Solo se permiten URLs HTTP/HTTPS");
  }
  const hostname = parsedUrl.hostname.toLowerCase();
  const privatePatterns = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|::1$|fc00:|fe80:)/;
  const private172 = /^172\.(1[6-9]|2\d|3[01])\./;
  if (privatePatterns.test(hostname) || private172.test(hostname)) {
    throw new Error("No se puede acceder a direcciones de red privada");
  }

  let res: Response;
  try {
    res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error("No se pudo conectar con la URL de la imagen");
  }
  if (!res.ok) throw new Error(`La URL devolvió error ${res.status}`);

  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("La URL no apunta a una imagen válida");

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 10_000_000) throw new Error("La imagen es demasiado grande (máx 10 MB)");

  const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";
  const filename = `product-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === "product-images");
  if (!bucketExists) {
    const { error: bucketError } = await supabase.storage.createBucket("product-images", { public: true });
    if (bucketError) throw new Error(`No se pudo crear el bucket: ${bucketError.message}`);
  }

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filename, buffer, { contentType, upsert: false });
  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filename);
  return urlData.publicUrl;
}

// ─── BRAND LOGOS ──────────────────────────────────────────────

const BRAND_LOGOS_CONFIG_KEY = "brand_logos_map";

export async function getBrandLogosMapAction(): Promise<Record<string, string>> {
  const { data } = await createAdminClient()
    .from("config").select("value").eq("key", BRAND_LOGOS_CONFIG_KEY).maybeSingle();
  try { return data?.value ? JSON.parse(data.value) : {}; } catch { return {}; }
}

export async function uploadBrandLogoAction(brand: string, formData: FormData): Promise<string> {
  await requireAdminSession();
  const supabase = createAdminClient();
  const file = formData.get("file") as File;
  if (!file) throw new Error("No se recibió archivo");

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Procesar con Sharp: detectar fondo y recolorear a violet-light #c084fc
  const sharp = (await import("sharp")).default;
  const { data: raw, info } = await sharp(inputBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  const TR = 192, TG = 132, TB = 252; // #c084fc

  // Detectar tipo de fondo por esquina superior-izquierda
  const tl = { r: raw[0], g: raw[1], b: raw[2], a: raw[3] };
  const isTransparentOrDark = tl.a < 10 || (tl.r < 30 && tl.g < 30 && tl.b < 30);
  const isWhite = tl.r > 240 && tl.g > 240 && tl.b > 240;

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = raw[o], g = raw[o + 1], b = raw[o + 2];
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    let alpha: number;

    if (isWhite) {
      const whiteness = (r + g + b) / (3 * 255);
      if      (whiteness > 0.92) alpha = 0;
      else if (whiteness > 0.78) alpha = Math.round(((0.92 - whiteness) / 0.14) * 255);
      else                       alpha = 255;
    } else {
      if      (lum < 0.12) alpha = 0;
      else if (lum < 0.35) alpha = Math.round(((lum - 0.12) / 0.23) * 255);
      else                 alpha = 255;
    }
    out[i * 4] = TR; out[i * 4 + 1] = TG; out[i * 4 + 2] = TB; out[i * 4 + 3] = alpha;
  }

  const processed = await sharp(out, { raw: { width, height, channels: 4 } })
    .blur(isTransparentOrDark && !isWhite ? 1.5 : 0)
    .png().toBuffer();

  const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const filename = `brands/${slug}-vip.png`;

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === "product-images")) {
    await supabase.storage.createBucket("product-images", { public: true });
  }
  await supabase.storage.from("product-images").upload(filename, processed, {
    contentType: "image/png", upsert: true,
  });

  const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filename);
  const url = urlData.publicUrl;

  // Guardar en config como JSON
  const current = await getBrandLogosMapAction();
  current[brand.toUpperCase()] = url;
  await supabase.from("config").upsert(
    { key: BRAND_LOGOS_CONFIG_KEY, value: JSON.stringify(current) },
    { onConflict: "key" }
  );

  return url;
}

// ─── DOLAR CRIPTO (dolarapi.com) ─────────────────────────────

export async function getDolarCriptoAction(): Promise<{ compra: number | null; venta: number | null }> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/cripto", { cache: "no-store" });
    const json = await res.json();
    return {
      compra: json?.compra ? parseFloat(json.compra) : null,
      venta:  json?.venta  ? parseFloat(json.venta)  : null,
    };
  } catch {
    return { compra: null, venta: null };
  }
}

// ─── BINANCE P2P ─────────────────────────────────────────────

export async function getBinanceP2PAction(): Promise<{ buy: number | null; sell: number | null }> {
  const fetchSide = async (tradeType: "BUY" | "SELL"): Promise<number | null> => {
    try {
      const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: "USDT", fiat: "ARS", tradeType,
          page: 1, rows: 3,
          payTypes: [], publisherType: null, merchantCheck: false,
        }),
        cache: "no-store",
      });
      const json = await res.json();
      const price = json?.data?.[0]?.adv?.price;
      return price ? parseFloat(price) : null;
    } catch {
      return null;
    }
  };
  // "SELL" ads = merchants selling USDT = user buys USDT (higher price)
  // "BUY" ads  = merchants buying USDT  = user sells USDT (lower price)
  const [buy, sell] = await Promise.all([fetchSide("SELL"), fetchSide("BUY")]);
  return { buy, sell };
}

// ─── FX FULLVIP VENTA (cache 30 min) ─────────────────────────
// Promedio entre Binance P2P (venta del user) y DolarHoy cripto venta. Es el FX
// que se usa para convertir ARS→USD en /admin/profit y /admin/sales para que
// ambos coincidan con el "FX FullVIP venta" del dashboard.
async function getFxFullvipVenta(): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data: row } = await supabase
    .from("config")
    .select("value, updated_at")
    .eq("key", "fx_fullvip_venta")
    .maybeSingle();
  const cached = row?.value ? parseFloat(row.value) : null;
  const updatedAt = row?.updated_at ? new Date(row.updated_at) : null;
  const ageMin = updatedAt ? (Date.now() - updatedAt.getTime()) / 60000 : Infinity;
  if (cached && ageMin < 30) return cached;

  const [p2p, cripto] = await Promise.all([
    getBinanceP2PAction().catch(() => ({ buy: null, sell: null })),
    getDolarCriptoAction().catch(() => ({ compra: null, venta: null })),
  ]);
  if (p2p.sell != null && cripto.venta != null) {
    const fv = Math.round(((p2p.sell + cripto.venta) / 2) * 100) / 100;
    await supabase.from("config").upsert(
      { key: "fx_fullvip_venta", value: String(fv) },
      { onConflict: "key" },
    );
    return fv;
  }
  if (cached) return cached;
  // Fallback final: fx_usdt_ars del config
  const { data: f } = await supabase.from("config").select("value").eq("key", "fx_usdt_ars").maybeSingle();
  return Math.max(1, parseFloat(f?.value || "1000") || 1000);
}

// Server action expuesta para que páginas cliente lean el FX FullVIP venta.
export async function getFxFullvipVentaAction(): Promise<number> {
  await requireAdminSession();
  return getFxFullvipVenta();
}

// Polling liviano: cuenta pedidos pendientes + id del más reciente.
// Usado por el dashboard para disparar la alerta sonora cuando entra un pedido nuevo.
export async function getPendingOrdersCountAction(): Promise<{ count: number; latestId: string | null }> {
  await requireAdminSession();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const rows = (data || []) as { id: string }[];
  return { count: rows.length, latestId: rows[0]?.id ?? null };
}

// ─── DASHBOARD ───────────────────────────────────────────────

export async function getDashboardDataAction() {
  await requireAdminSession();
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [
    { data: products },
    { data: orders },
    { data: orderItems },
    { data: cashMovements },
    { data: cfgRows },
    { data: debtsData },
    profitData,
  ] = await Promise.all([
    supabase.from("products").select("*"),
    // Solo órdenes de los últimos 3 meses — el dashboard no necesita historial completo
    supabase.from("orders").select("*").gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10)).order("created_at", { ascending: false }),
    supabase.from("order_items").select("order_id, product_id, unit_price, qty").gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10)),
    // Solo movimientos de caja del año en curso — suficiente para totales acumulados del dashboard
    supabase.from("cash_movements").select("*").gte("created_at", `${new Date().getFullYear()}-01-01T00:00:00`),
    supabase.from("config").select("key, value"),
    supabase.from("debts").select("*").in("status", ["pending", "partial"]),
    getProfitDataAction(new Date().toISOString().slice(0, 7)),
  ]);

  const p = (products || []) as Product[];
  const o = (orders || []) as Order[];
  const c = (cashMovements || []) as CashMovement[];
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value;
  const fxRate = Math.max(1, parseFloat(cfg["fx_usdt_ars"] || "") || 1000);

  const todayOrders = o.filter(ord => ord.confirmed_at && ord.confirmed_at.slice(0, 10) === today && ord.status === "confirmed");
  const monthOrders = o.filter(ord => ord.confirmed_at && ord.confirmed_at.slice(0, 7) === thisMonth && ord.status === "confirmed");
  const pendingOrders = o.filter(ord => ord.status === "pending");

  const totalStock = p.reduce((s, pr) => s + pr.stock_actual, 0);
  const stockValueUSD = p.reduce((s, pr) => {
    const upp = ((pr as any).units_per_pack ?? 1) || 1;
    return s + (pr.stock_actual / upp) * pr.price_may_x15;
  }, 0);
  const stockValueARS = Math.round(stockValueUSD * fxRate);

  // Ventas en USDT (retail: ARS/fx, wholesale: USDT directo)
  const orderToUSD = (ord: Order) => ord.type === "wholesale" ? ord.total : ord.total / fxRate;
  const salesTodayUSD = todayOrders.reduce((s, ord) => s + orderToUSD(ord), 0);
  // salesMonthUSD usa la misma lógica que ganancias (suma de items) para que coincidan
  const salesMonthUSD = profitData.totalRevenueUsd;
  const salesToday = todayOrders.reduce((s, ord) => s + ord.total, 0);
  const salesMonth = monthOrders.reduce((s, ord) => s + ord.total, 0);

  // Ganancia bruta del día — filtra orderProfits cuyo confirmed_at sea hoy
  const todayProfits = profitData.orderProfits.filter(op => op.date.slice(0, 10) === today);
  const salesTodayProfitUSD = todayProfits.reduce((s, op) => s + op.grossProfitUsd, 0);

  // Mapa qty por orden (para mostrar unidades)
  const itemsByOrder = new Map<string, number>();
  for (const item of (orderItems || [])) {
    itemsByOrder.set(item.order_id, (itemsByOrder.get(item.order_id) || 0) + item.qty);
  }
  const salesTodayUnits = todayOrders.reduce((s, ord) => s + (itemsByOrder.get(ord.id) || 0), 0);
  const salesMonthUnits = monthOrders.reduce((s, ord) => s + (itemsByOrder.get(ord.id) || 0), 0);
  const activeProducts = p.filter(pr => pr.visible).length;

  // ── Ganancia del mes — replica exacta de la página Ganancias ──
  const monthIncomeUSD = profitData.totalRevenueUsd;
  const monthCogsUSD = profitData.totalCogsUsd;
  const monthGrossProfitUSD = profitData.totalGrossProfitUsd;
  const monthExpensesOpUSD = profitData.totalExpensesUsd;
  const monthExpenseUSD = profitData.totalCogsUsd + profitData.totalExpensesUsd;
  const monthProfitUSD = profitData.netProfitUsd;

  const isAjuste = (type: string) => type === "ajuste_in" || type === "ajuste_out";
  const toUSD = (m: CashMovement) => m.currency === "USD" ? m.amount : m.amount / fxRate;
  const monthCash = c.filter(m => m.created_at.slice(0, 7) === thisMonth);
  const monthIncome2 = monthCash.filter(m => m.type.includes("income")).reduce((s, m) => s + m.amount, 0);
  const monthExpense2 = monthCash.filter(m => !m.type.includes("income") && !isAjuste(m.type)).reduce((s, m) => s + m.amount, 0);

  // Caja
  const cashSign = (type: string) => ["sale_income", "manual_income", "ajuste_in"].includes(type) ? 1 : -1;
  const monthIncome = monthCash.filter(m => m.type.includes("income")).reduce((s, m) => s + m.amount, 0);
  const monthExpense = monthCash.filter(m => !m.type.includes("income") && !isAjuste(m.type)).reduce((s, m) => s + m.amount, 0);

  // Solo sumamos al balance de caja los movimientos con affects_cash=true.
  // Los marcados con false (ej: gastos previos a un reset de caja) cuentan en P&L pero no acá.
  const cashAffecting = c.filter(m => m.affects_cash !== false);

  let cashArs = 0, cashUsd = 0;
  cashAffecting.forEach(m => {
    const sign = cashSign(m.type);
    if (m.currency === "ARS") cashArs += sign * m.amount;
    else cashUsd += sign * m.amount;
  });

  const byCaja: Record<string, { ars: number; usd: number }> = {
    Luciano: { ars: 0, usd: 0 },
    Santiago: { ars: 0, usd: 0 },
    Oficina: { ars: 0, usd: 0 },
  };
  cashAffecting.forEach(m => {
    const sign = cashSign(m.type);
    if (!byCaja[m.caja]) byCaja[m.caja] = { ars: 0, usd: 0 };
    if (m.currency === "ARS") byCaja[m.caja].ars += sign * m.amount;
    else byCaja[m.caja].usd += sign * m.amount;
  });

  // Deudas pendientes
  const debts = (debtsData || []) as Debt[];
  const receivable = debts.filter(d => d.type === "receivable");
  const payable = debts.filter(d => d.type === "payable");

  return {
    activeProducts, totalStock, stockValueUSD, stockValueARS,
    salesToday, salesMonth, salesTodayUSD, salesMonthUSD, salesTodayProfitUSD,
    salesTodayCount: todayOrders.length, salesMonthCount: monthOrders.length,
    salesTodayUnits, salesMonthUnits,
    pendingOrdersCount: pendingOrders.length,
    pendingOrdersList: pendingOrders.slice(0, 5),
    monthIncome: monthIncome2, monthExpense: monthExpense2, monthProfit: monthIncome2 - monthExpense2,
    monthIncomeUSD, monthCogsUSD, monthGrossProfitUSD, monthExpensesOpUSD, monthExpenseUSD, monthProfitUSD,
    lastMonthIncomeUSD: 0, lastMonthExpenseUSD: 0, lastMonthProfitUSD: 0,
    lastMonthLabel: "",
    cash: { ars: cashArs, usd: cashUsd },
    byCaja,
    products: p,
    debtsReceivable: receivable,
    debtsPayable: payable,
  };
}

// ─── CÓDIGOS DE DESCUENTO ──────────────────────────────────────

export async function generateDiscountCodeAction(amount: number, currency: "ARS" | "USD"): Promise<string> {
  await requireAdminSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  let unique = false;
  while (!unique) {
    code = "FULL-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const { data } = await supabase.from("discount_codes").select("id").eq("code", code).maybeSingle();
    if (!data) unique = true;
  }
  await supabase.from("discount_codes").insert({ code, amount, currency });
  return code;
}

export async function validateDiscountCodeAction(code: string): Promise<{ valid: boolean; amount: number; currency: string; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data } = await supabase.from("discount_codes").select("*").eq("code", code.toUpperCase().trim()).maybeSingle();
  if (!data) return { valid: false, amount: 0, currency: "USD", error: "Código inválido" };
  if (data.used) return { valid: false, amount: 0, currency: "USD", error: "Este código ya fue utilizado" };
  if (!data.amount || data.amount <= 0) return { valid: false, amount: 0, currency: "USD", error: "Código sin monto configurado" };
  if (!["ARS", "USD"].includes(data.currency)) return { valid: false, amount: 0, currency: "USD", error: "Código con moneda inválida" };
  return { valid: true, amount: data.amount, currency: data.currency };
}

export async function useDiscountCodeAction(code: string, orderId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  await supabase.from("discount_codes").update({ used: true, used_at: new Date().toISOString(), used_by_order: orderId }).eq("code", code.toUpperCase().trim());
}

// ─── AUDITORÍA / EDICIÓN DE MOVIMIENTOS Y PEDIDOS ──────────────

/**
 * Devuelve los logs de auditoría para un target específico (movimiento, pedido, deuda).
 */
export async function getAuditLogsAction(
  targetType: "cash_movement" | "order" | "debt" | "customer",
  targetId: string,
): Promise<AuditLog[]> {
  await requireAdminSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false });
  return (data || []) as AuditLog[];
}

/**
 * Edita un movimiento de caja (amount, currency, caja, category, note).
 * Registra un audit_log con el diff. Si el movimiento estaba vinculado a un debt_payment,
 * NO toca la deuda — para eso usar voidCashMovementAction y volver a cobrar.
 */
export async function editCashMovementAction(
  movementId: string,
  patch: { amount?: number; currency?: "ARS" | "USD"; caja?: string; category?: string; note?: string },
  reason: string,
): Promise<void> {
  await requireAdminSession();
  if (!reason?.trim()) throw new Error("Motivo de edición requerido");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const actor = await currentActor();

  const { data: before } = await supabase.from("cash_movements").select("*").eq("id", movementId).single();
  if (!before) throw new Error("Movimiento no encontrado");
  if (before.voided) throw new Error("No se puede editar un movimiento anulado");

  const update: Record<string, unknown> = {};
  if (patch.amount !== undefined && patch.amount !== before.amount) update.amount = patch.amount;
  if (patch.currency !== undefined && patch.currency !== before.currency) update.currency = patch.currency;
  if (patch.caja !== undefined && patch.caja !== before.caja) update.caja = patch.caja;
  if (patch.category !== undefined && patch.category !== before.category) update.category = patch.category;
  if (patch.note !== undefined && patch.note !== before.note) update.note = patch.note;
  if (Object.keys(update).length === 0) return;

  await supabase.from("cash_movements").update(update).eq("id", movementId);
  await logAudit(supabase, "cash_movement", movementId, "edit", before, { ...before, ...update }, reason.trim(), actor);

  // Si cambió el monto y es un cobro de venta vinculado a pedido, recalcular la deuda del pedido
  if (patch.amount !== undefined && before.type === "sale_income" && before.order_id) {
    const { data: orderRow } = await supabase.from("orders").select("type").eq("id", before.order_id).single();
    if (orderRow) {
      const orderCurrency: "ARS" | "USD" = orderRow.type === "wholesale" ? "USD" : "ARS";
      const { data: debtRows } = await supabase
        .from("debts").select("id, original_amount, paid_amount, status")
        .eq("order_id", before.order_id).eq("type", "receivable").limit(1);
      const debt = debtRows?.[0];
      if (debt && debt.status !== "cancelled" && debt.status !== "archived") {
        // Suma todos los cash_movements no anulados del pedido (ya incluye el monto editado)
        const { data: movs } = await supabase
          .from("cash_movements").select("amount, currency")
          .eq("order_id", before.order_id).eq("type", "sale_income").neq("voided", true);
        // FX actual para conversión entre monedas
        const { data: fxRow } = await supabase.from("config").select("value").eq("key", "fx_usdt_ars").maybeSingle();
        const fxRate = parseFloat(fxRow?.value || "1000") || 1000;
        const fromConfirmation = round2((movs || []).reduce((sum: number, m: { amount: number; currency: string }) => {
          if (m.currency === orderCurrency) return sum + m.amount;
          return orderCurrency === "ARS" ? sum + m.amount * fxRate : sum + m.amount / fxRate;
        }, 0));
        // Pagos posteriores registrados vía la sección de deudas
        const { data: dps } = await supabase.from("debt_payments").select("amount").eq("debt_id", debt.id);
        const fromDebtPayments = round2((dps || []).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0));
        const totalPaid = round2(fromConfirmation + fromDebtPayments);
        const newPaid = round2(Math.min(totalPaid, debt.original_amount));
        const newStatus = newPaid <= 0.001 ? "pending" : newPaid >= debt.original_amount - 0.01 ? "paid" : "partial";
        if (Math.abs(newPaid - debt.paid_amount) > 0.001) {
          await supabase.from("debts").update({ paid_amount: newPaid, status: newStatus }).eq("id", debt.id);
        }
      }
    }
  }
}

/**
 * Anula un movimiento de caja: setea voided=true, affects_cash=false (deja de impactar caja).
 * Si el movimiento provino de un cobro de deuda (debt_payment_id presente), revierte el pago:
 *   - Borra el debt_payment.
 *   - Resta el monto del paid_amount de la deuda.
 *   - Recalcula el status de la deuda (partial/pending).
 *   - Si en el mismo segundo se generó una deuda de excedente del lado opuesto, la borra (limpieza).
 */
export async function voidCashMovementAction(movementId: string, reason: string): Promise<void> {
  await requireAdminSession();
  if (!reason?.trim()) throw new Error("Motivo de anulación requerido");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const actor = await currentActor();

  const { data: mov } = await supabase.from("cash_movements").select("*").eq("id", movementId).single();
  if (!mov) throw new Error("Movimiento no encontrado");
  if (mov.voided) return;

  const before = { movement: mov as Record<string, unknown>, debt_payment: null as Record<string, unknown> | null, debt_after: null as Record<string, unknown> | null };
  const after: Record<string, unknown> = { voided: true };

  // Si el movimiento estaba ligado a un pago de deuda, revertir el pago
  if (mov.debt_payment_id) {
    const { data: dp } = await supabase.from("debt_payments").select("*").eq("id", mov.debt_payment_id).single();
    if (dp) {
      before.debt_payment = dp as Record<string, unknown>;
      const { data: debt } = await supabase.from("debts").select("*").eq("id", dp.debt_id).single();
      if (debt) {
        const newPaid = round2(Math.max(0, debt.paid_amount - dp.amount));
        const newStatus = newPaid <= 0.001 ? "pending" : (newPaid >= debt.original_amount ? "paid" : "partial");
        await supabase.from("debts").update({ paid_amount: newPaid, status: newStatus }).eq("id", debt.id);
        before.debt_after = { paid_amount: newPaid, status: newStatus };
        // Limpiar deuda de excedente generada en el mismo instante
        const dpInstant = new Date(dp.created_at);
        const winStart = new Date(dpInstant.getTime() - 2000).toISOString();
        const winEnd = new Date(dpInstant.getTime() + 2000).toISOString();
        const oppositeType = debt.type === "receivable" ? "payable" : "receivable";
        await supabase.from("debts")
          .delete()
          .eq("entity_name", debt.entity_name)
          .eq("type", oppositeType)
          .eq("paid_amount", 0)
          .gte("created_at", winStart)
          .lte("created_at", winEnd);
      }
      await supabase.from("debt_payments").delete().eq("id", dp.id);
    }
  }

  await supabase.from("cash_movements").update({
    voided: true,
    voided_at: new Date().toISOString(),
    voided_reason: reason.trim(),
    affects_cash: false,
  }).eq("id", movementId);

  await logAudit(supabase, "cash_movement", movementId, "void", before, after, reason.trim(), actor);
}

// ─── EDICIÓN DE PEDIDOS PENDIENTES ────────────────────────────

interface EditPendingOrderInput {
  items: { product_id: string; product_sku: string; product_name: string; qty: number; unit_price: number }[];
  discount_amount?: number;
  discount_currency?: "ARS" | "USD" | null;
  surcharge_amount?: number;
  surcharge_note?: string;
  notes?: string;
}

/**
 * Edita un pedido en estado pending: items (qty/agregar/quitar), descuento, recargo.
 * Ajusta stock_reservado por delta y recalcula el total. Audit log con el diff.
 * Solo permite editar pedidos pending — los confirmados/cancelados no.
 */
export async function editPendingOrderAction(
  orderId: string,
  patch: EditPendingOrderInput,
  reason: string,
): Promise<void> {
  await requireAdminSession();
  if (!reason?.trim()) throw new Error("Motivo de edición requerido");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const actor = await currentActor();

  const { data: order } = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single();
  if (!order) throw new Error("Pedido no encontrado");
  if (order.status !== "pending") throw new Error("Solo se pueden editar pedidos pendientes");

  const beforeItems = (order.order_items || []) as { id: string; product_id: string; qty: number; unit_price: number }[];
  const beforeMap = new Map(beforeItems.map(i => [i.product_id, i]));
  const newMap = new Map(patch.items.map(i => [i.product_id, i]));

  // Calcular deltas de stock_reservado para cada producto
  const allIds = new Set<string>([...beforeMap.keys(), ...newMap.keys()]);
  for (const productId of allIds) {
    const oldQty = beforeMap.get(productId)?.qty || 0;
    const newQty = newMap.get(productId)?.qty || 0;
    const delta = newQty - oldQty;
    if (delta === 0) continue;

    const { data: prod } = await supabase.from("products").select("stock_actual, stock_reservado, sku").eq("id", productId).single();
    if (!prod) throw new Error(`Producto ${productId} no encontrado`);

    if (delta > 0) {
      const available = prod.stock_actual - prod.stock_reservado;
      if (available < delta) throw new Error(`Sin stock para ${prod.sku}: necesita ${delta} y hay ${available}`);
    }
    await supabase.from("products").update({
      stock_reservado: Math.max(0, prod.stock_reservado + delta),
    }).eq("id", productId);
    await supabase.from("inventory_movements").insert({
      product_id: productId,
      product_sku: prod.sku,
      type: delta > 0 ? "reserva" : "liberacion",
      qty: Math.abs(delta),
      order_id: orderId,
      note: `Edición pedido #${order.number}: ${oldQty} → ${newQty}`,
    });
  }

  // Reemplazar items: borrar los que desaparecieron, actualizar/insertar el resto
  const newProductIds = new Set(patch.items.map(i => i.product_id));
  const toDelete = beforeItems.filter(b => !newProductIds.has(b.product_id)).map(b => b.id);
  if (toDelete.length > 0) {
    await supabase.from("order_items").delete().in("id", toDelete);
  }
  for (const newItem of patch.items) {
    const existing = beforeMap.get(newItem.product_id);
    const subtotal = round2(newItem.qty * newItem.unit_price);
    if (existing) {
      await supabase.from("order_items").update({
        qty: newItem.qty,
        unit_price: newItem.unit_price,
        subtotal,
        product_name: newItem.product_name,
        product_sku: newItem.product_sku,
      }).eq("id", existing.id);
    } else {
      await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: newItem.product_id,
        product_name: newItem.product_name,
        product_sku: newItem.product_sku,
        qty: newItem.qty,
        unit_price: newItem.unit_price,
        subtotal,
      });
    }
  }

  // Recalcular total: subtotal items - discount + surcharge (en moneda del pedido)
  const itemsTotal = patch.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const discount = patch.discount_amount ?? order.discount_amount ?? 0;
  const surcharge = patch.surcharge_amount ?? order.surcharge_amount ?? 0;
  const newTotal = round2(Math.max(0, itemsTotal - discount + surcharge));

  const orderUpdate: Record<string, unknown> = { total: newTotal };
  if (patch.discount_amount !== undefined) orderUpdate.discount_amount = patch.discount_amount;
  if (patch.discount_currency !== undefined) orderUpdate.discount_currency = patch.discount_currency;
  if (patch.surcharge_amount !== undefined) orderUpdate.surcharge_amount = patch.surcharge_amount;
  if (patch.surcharge_note !== undefined) orderUpdate.surcharge_note = patch.surcharge_note;
  if (patch.notes !== undefined) orderUpdate.notes = patch.notes;

  await supabase.from("orders").update(orderUpdate).eq("id", orderId);

  await logAudit(supabase, "order", orderId, "edit",
    { items: beforeItems, total: order.total, discount_amount: order.discount_amount, surcharge_amount: order.surcharge_amount, notes: order.notes },
    { items: patch.items, total: newTotal, discount_amount: orderUpdate.discount_amount ?? order.discount_amount, surcharge_amount: orderUpdate.surcharge_amount ?? order.surcharge_amount, notes: orderUpdate.notes ?? order.notes },
    reason.trim(), actor);

  // Refrescar catálogo para que el delta de stock_reservado se vea sin esperar al revalidate
  try { revalidatePath("/productos"); revalidatePath("/mayoristas/tienda"); revalidatePath("/"); } catch {}
}

// ─── EDICIÓN DE PEDIDOS CONFIRMADOS (solo descuento/recargo) ─

/**
 * Edita un pedido CONFIRMADO ajustando solo descuento/recargo (no items).
 * Recalcula total, ajusta la deuda receivable asociada (si la hay) por el delta y
 * registra el cambio para que P&L lo refleje. No toca cash_movements existentes.
 */
export async function editConfirmedOrderAction(
  orderId: string,
  patch: { discount_amount?: number; discount_currency?: "ARS" | "USD" | null; surcharge_amount?: number; surcharge_note?: string },
  reason: string,
): Promise<void> {
  await requireAdminSession();
  if (!reason?.trim()) throw new Error("Motivo de edición requerido");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const actor = await currentActor();

  const { data: order } = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single();
  if (!order) throw new Error("Pedido no encontrado");
  if (order.status !== "confirmed") throw new Error("Solo se pueden ajustar descuentos/recargos en pedidos confirmados con esta acción");

  const itemsTotal = (order.order_items || []).reduce((s: number, it: { qty: number; unit_price: number }) => s + it.qty * it.unit_price, 0);
  const newDiscount = patch.discount_amount !== undefined ? Math.max(0, patch.discount_amount) : (order.discount_amount || 0);
  const newSurcharge = patch.surcharge_amount !== undefined ? Math.max(0, patch.surcharge_amount) : (order.surcharge_amount || 0);
  const newTotal = round2(Math.max(0, itemsTotal - newDiscount + newSurcharge));
  const oldTotal = round2(order.total);
  const delta = round2(newTotal - oldTotal);

  const orderUpdate: Record<string, unknown> = { total: newTotal };
  if (patch.discount_amount !== undefined) orderUpdate.discount_amount = newDiscount;
  if (patch.discount_currency !== undefined) orderUpdate.discount_currency = patch.discount_currency;
  if (patch.surcharge_amount !== undefined) orderUpdate.surcharge_amount = newSurcharge;
  if (patch.surcharge_note !== undefined) orderUpdate.surcharge_note = patch.surcharge_note;

  await supabase.from("orders").update(orderUpdate).eq("id", orderId);

  // Buscar deuda receivable asociada al pedido (la generada al confirmar la venta)
  const { data: debtRows } = await supabase.from("debts").select("*").eq("order_id", orderId).eq("type", "receivable").in("status", ["pending", "partial", "paid"]).limit(1);
  const debt = debtRows?.[0] ?? null;

  if (Math.abs(delta) > 0.001) {
    if (debt) {
      const newOriginal = round2(Math.max(0, debt.original_amount + delta));
      let newStatus: string;
      let payableExtra = 0;
      if (newOriginal <= 0.001) {
        newStatus = "paid";
        // Si pagaron de más respecto al nuevo total, lo que sobre va a payable
        payableExtra = round2(debt.paid_amount - newOriginal);
      } else if (debt.paid_amount >= newOriginal) {
        newStatus = "paid";
        payableExtra = round2(debt.paid_amount - newOriginal);
      } else if (debt.paid_amount > 0) {
        newStatus = "partial";
      } else {
        newStatus = "pending";
      }
      await supabase.from("debts").update({ original_amount: newOriginal, status: newStatus }).eq("id", debt.id);

      if (payableExtra > 0.01) {
        await supabase.from("debts").insert({
          type: "payable",
          entity_name: debt.entity_name,
          entity_type: debt.entity_type,
          entity_id: debt.entity_id || undefined,
          original_amount: payableExtra,
          currency: debt.currency,
          paid_amount: 0,
          order_id: orderId,
          note: `Saldo a favor por descuento aplicado post-confirmación — Pedido #${order.number}`,
          status: "pending",
        });
      }

      // Sincronizar payment_status del pedido si aplica
      const newPaymentStatus = newStatus === "paid" ? "paid" : (debt.paid_amount > 0 ? "partial" : "unpaid");
      if (order.payment_status !== "exchange") {
        await supabase.from("orders").update({ payment_status: newPaymentStatus }).eq("id", orderId);
      }
    } else {
      // No había deuda. Si delta<0 (descuento mayor) → saldo a favor del cliente.
      // Si delta>0 (recargo mayor) → nueva receivable.
      const orderCurrency: "ARS" | "USD" = order.type === "wholesale" ? "USD" : "ARS";
      if (delta < -0.01) {
        await supabase.from("debts").insert({
          type: "payable",
          entity_name: order.customer_name,
          entity_type: "customer",
          entity_id: order.customer_id || undefined,
          original_amount: Math.abs(delta),
          currency: orderCurrency,
          paid_amount: 0,
          order_id: orderId,
          note: `Saldo a favor por descuento aplicado post-confirmación — Pedido #${order.number}`,
          status: "pending",
        });
      } else if (delta > 0.01) {
        await supabase.from("debts").insert({
          type: "receivable",
          entity_name: order.customer_name,
          entity_type: "customer",
          entity_id: order.customer_id || undefined,
          original_amount: delta,
          currency: orderCurrency,
          paid_amount: 0,
          order_id: orderId,
          note: `Recargo aplicado post-confirmación — Pedido #${order.number}`,
          status: "pending",
        });
        if (order.payment_status === "paid") {
          await supabase.from("orders").update({ payment_status: "partial" }).eq("id", orderId);
        }
      }
    }
  }

  await logAudit(supabase, "order", orderId, "edit_confirmed",
    { total: oldTotal, discount_amount: order.discount_amount, surcharge_amount: order.surcharge_amount },
    { total: newTotal, discount_amount: newDiscount, surcharge_amount: newSurcharge },
    reason.trim(), actor);
}

// ─── UNIFICAR CLIENTES DUPLICADOS ─────────────────────────────

/**
 * Fusiona dos clientes: reasigna todas las orders, debts y cash_movements del "source"
 * al "target", suma total_orders y conserva el last_purchase más reciente.
 * Después borra el source. Audit log con snapshot del source.
 */
export async function mergeCustomersAction(
  sourceId: string,
  targetId: string,
  reason: string = "Unificación de duplicados",
): Promise<void> {
  await requireAdminSession();
  if (sourceId === targetId) throw new Error("source y target son iguales");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const actor = await currentActor();

  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", sourceId).single(),
    supabase.from("customers").select("*").eq("id", targetId).single(),
  ]);
  if (!source) throw new Error("Cliente origen no encontrado");
  if (!target) throw new Error("Cliente destino no encontrado");

  // Reasignar pedidos, deudas y entidades vinculadas
  await supabase.from("orders").update({ customer_id: targetId }).eq("customer_id", sourceId);
  await supabase.from("debts").update({ entity_id: targetId, entity_name: target.name }).eq("entity_id", sourceId);

  // Mergear stats del cliente
  const lastA = source.last_purchase ? new Date(source.last_purchase).getTime() : 0;
  const lastB = target.last_purchase ? new Date(target.last_purchase).getTime() : 0;
  const lastPurchase = Math.max(lastA, lastB);
  const totalOrders = (source.total_orders || 0) + (target.total_orders || 0);
  await supabase.from("customers").update({
    total_orders: totalOrders,
    last_purchase: lastPurchase ? new Date(lastPurchase).toISOString() : target.last_purchase,
    address: target.address || source.address,
    notes: [target.notes, source.notes].filter((s: string) => s?.trim()).join(" | "),
  }).eq("id", targetId);

  // Borrar el origen
  await supabase.from("customers").delete().eq("id", sourceId);

  await logAudit(supabase, "customer", targetId, "merge_customer",
    { source }, { merged_into: targetId }, reason.trim() || "Unificación de duplicados", actor);
}

// ─── PAGO DE DEUDAS CON FX DUAL ───────────────────────────────

/**
 * Cobra/paga una deuda permitiendo que la moneda del pago sea distinta a la de la deuda.
 * - Convierte el monto recibido a la moneda de la deuda usando fxRate (USDT_ARS).
 * - El cash_movement se registra con la moneda real recibida (paymentCurrency/paymentAmount).
 * - El debt_payment guarda monto en moneda de la deuda + payment_currency/payment_amount/fx_rate_used.
 * - Si el equivalente convertido supera la deuda, el excedente queda como saldo a favor en la moneda de la deuda.
 */
export async function payDebtFxAction(
  debtId: string,
  paymentAmount: number,
  paymentCurrency: "ARS" | "USD",
  caja: string,
  fxRate: number,
  note: string = "",
): Promise<void> {
  await requireAdminSession();
  if (!(paymentAmount > 0)) throw new Error("Monto inválido");
  if (!(fxRate > 0)) throw new Error("FX inválido");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const actor = await currentActor();

  const { data: debt } = await supabase.from("debts").select("*").eq("id", debtId).single();
  if (!debt) throw new Error("Deuda no encontrada");

  // Convertir paymentAmount a la moneda de la deuda
  let amountInDebtCurrency: number;
  if (paymentCurrency === debt.currency) {
    amountInDebtCurrency = paymentAmount;
  } else if (debt.currency === "ARS" && paymentCurrency === "USD") {
    amountInDebtCurrency = paymentAmount * fxRate;
  } else if (debt.currency === "USD" && paymentCurrency === "ARS") {
    amountInDebtCurrency = paymentAmount / fxRate;
  } else {
    amountInDebtCurrency = paymentAmount;
  }
  amountInDebtCurrency = round2(amountInDebtCurrency);

  const remaining = round2(debt.original_amount - (debt.paid_amount || 0));
  const toPay = round2(Math.min(amountInDebtCurrency, remaining));
  const excess = round2(amountInDebtCurrency - toPay);

  const newPaid = round2((debt.paid_amount || 0) + toPay);
  const newStatus = newPaid >= debt.original_amount ? "paid" : "partial";

  await supabase.from("debts").update({ paid_amount: newPaid, status: newStatus }).eq("id", debtId);

  // Registrar el debt_payment en moneda de la deuda + datos del pago real
  const fxNote = paymentCurrency !== debt.currency
    ? ` [Pago ${paymentAmount} ${paymentCurrency} @ FX ${fxRate} = ${toPay.toFixed(2)} ${debt.currency}]`
    : "";
  const { data: dpInserted } = await supabase.from("debt_payments").insert({
    debt_id: debtId,
    amount: toPay,
    currency: debt.currency,
    caja,
    note: (note || `Pago de deuda`) + fxNote,
    payment_currency: paymentCurrency,
    payment_amount: paymentAmount,
    fx_rate_used: paymentCurrency !== debt.currency ? fxRate : null,
  }).select("id").single();

  // cash_movement con la moneda real recibida; vinculado al debt_payment para reversión
  const movType = debt.type === "receivable" ? "manual_income" : "manual_expense";
  const movCategoryFx = debt.type === "receivable"
    ? "Cobro deuda"
    : (!debt.purchase_id ? "Gasto operativo" : "Pago deuda");
  await supabase.from("cash_movements").insert({
    type: movType,
    amount: paymentAmount,
    currency: paymentCurrency,
    caja,
    category: movCategoryFx,
    note: (note || `Pago deuda - ${debt.entity_name}`) + fxNote,
    debt_payment_id: dpInserted?.id,
  });

  // Excedente como saldo a favor en la moneda de la deuda (decisión de producto)
  if (excess > 0.01) {
    const oppositeType = debt.type === "receivable" ? "payable" : "receivable";
    await supabase.from("debts").insert({
      type: oppositeType,
      entity_name: debt.entity_name,
      entity_type: debt.entity_type,
      entity_id: debt.entity_id || undefined,
      original_amount: excess,
      currency: debt.currency,
      paid_amount: 0,
      status: "pending",
      note: `Excedente de pago — ${debt.entity_name}`,
    });
  }

  // Sincronizar purchase si la deuda era de una compra
  if (debt.purchase_id && debt.type === "payable") {
    const { data: purchase } = await supabase.from("purchases").select("currency, payment_status").eq("id", debt.purchase_id).single();
    let purchaseNewStatus: string;
    if (newStatus === "paid") purchaseNewStatus = "paid";
    else if (purchase?.payment_status === "received") purchaseNewStatus = "received";
    else purchaseNewStatus = "partial";
    const purchaseUpdate: { payment_status: string; paid_amount?: number } = { payment_status: purchaseNewStatus };
    if (purchase && purchase.currency === debt.currency) purchaseUpdate.paid_amount = newPaid;
    await supabase.from("purchases").update(purchaseUpdate).eq("id", debt.purchase_id);
  }

  await logAudit(supabase, "debt", debtId, "payment", { paid_amount: debt.paid_amount, status: debt.status }, { paid_amount: newPaid, status: newStatus, payment: { paymentAmount, paymentCurrency, fxRate, caja } }, note || "", actor);
}
