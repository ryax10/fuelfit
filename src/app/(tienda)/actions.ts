"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderItem } from "@/lib/local-db/types";

interface DBProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  price_min_ars: number;
  price_may_x15: number;
  price_may_x50: number;
  price_may_x100: number;
  stock_actual: number;
  stock_reservado: number;
  visible: boolean;
  unit_sale_options?: { options: { qty: number; price: number }[] } | null;
}

export interface CreateOrderInput {
  type: "retail" | "wholesale";
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes: string;
  payment_method?: string;
  // Mayorista: forma de pago que define recargo de billete USD
  wholesale_payment?: "usdt" | "billete" | "ars";
  items: { product_id: string; qty: number; unit_price_override?: number }[];
  /** Código de descuento aplicado por el cliente (validado server-side). */
  discount_code?: string;
  /** FX ARS por USD que vio el cliente para convertir códigos USD → ARS en pedidos retail. */
  fx_rate_at_apply?: number;
}

// Recargo USDT por unidad cuando se paga en billete USD físico (mayorista)
const BILLETE_SURCHARGE_PER_UNIT = 0.15;

export async function createOrderAction(
  data: CreateOrderInput
): Promise<{ id: string; number: number; items: OrderItem[] } | { success: false; outOfStock: string[] }> {
  // Validaciones básicas de entrada
  if (!data.customer_name?.trim()) throw new Error("Nombre requerido");
  if (!data.customer_phone?.trim()) throw new Error("Teléfono requerido");
  if (!data.items?.length) throw new Error("El pedido no tiene productos");
  if (!["retail", "wholesale"].includes(data.type)) throw new Error("Tipo inválido");

  const MIN_WHOLESALE_USDT = 130;

  const supabase = createAdminClient();

  // Obtener precios reales desde la DB — nunca confiar en precios del cliente
  const productIds = data.items.map((i) => i.product_id);
  const { data: products, error: productsError } = await (supabase as any)
    .from("products")
    .select("id, name, sku, category, price_min_ars, price_may_x15, price_may_x50, price_may_x100, stock_actual, stock_reservado, visible, unit_sale_options")
    .in("id", productIds) as { data: DBProduct[] | null; error: unknown };

  if (productsError || !products) throw new Error("Error al verificar productos");

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Validar que todos los productos existen, son visibles y tienen stock
  const outOfStock: string[] = [];
  for (const item of data.items) {
    if (item.qty < 1) throw new Error("Cantidad inválida");
    const p = productMap.get(item.product_id);
    if (!p) throw new Error(`Producto no encontrado: ${item.product_id}`);
    if (!p.visible) throw new Error(`Producto no disponible: ${p.name}`);
    const available = p.stock_actual - p.stock_reservado;
    if (available < item.qty) outOfStock.push(p.name);
  }
  if (outOfStock.length > 0) return { success: false, outOfStock };

  // Calcular tier mayorista basado en el carrito completo (no por ítem individual)
  let wholesaleTier: "x100" | "x50" | "x15" = "x15";
  if (data.type === "wholesale") {
    const totalUnits = data.items.reduce((s, i) => s + i.qty, 0);
    wholesaleTier = totalUnits >= 100 ? "x100" : totalUnits >= 50 ? "x50" : "x15";
  }

  // Calcular precios server-side según el tipo de pedido
  const enrichedItems: Omit<OrderItem, "id">[] = data.items.map((item) => {
    const p = productMap.get(item.product_id)!;
    let unit_price: number;

    if (data.type === "wholesale") {
      // Precio mayorista escalonado por cantidad total del carrito
      if (wholesaleTier === "x100" && p.price_may_x100 > 0) unit_price = p.price_may_x100;
      else if ((wholesaleTier === "x100" || wholesaleTier === "x50") && p.price_may_x50 > 0) unit_price = p.price_may_x50;
      else unit_price = p.price_may_x15;
      if (unit_price <= 0) throw new Error(`Producto sin precio mayorista configurado: ${p.name}`);
    } else {
      // Si viene un override, validarlo contra unit_sale_options del producto en DB
      if (item.unit_price_override && item.unit_price_override > 0) {
        const validOpts = p.unit_sale_options?.options ?? [];
        const matched = validOpts.find(o => o.qty === item.qty && o.price > 0);
        unit_price = matched ? matched.price / matched.qty : p.price_min_ars;
      } else {
        unit_price = p.price_min_ars;
      }
      if (unit_price <= 0) throw new Error(`Producto sin precio minorista configurado: ${p.name}`);
    }

    return {
      order_id: "",
      product_id: item.product_id,
      product_name: p.name,
      product_sku: p.sku,
      qty: item.qty,
      unit_price,
      subtotal: item.qty * unit_price,
    };
  });

  const itemsTotal = enrichedItems.reduce((s, i) => s + i.subtotal, 0);

  // Validar mínimo mayorista contra el subtotal de items (sin recargo)
  if (data.type === "wholesale" && itemsTotal < MIN_WHOLESALE_USDT) {
    throw new Error(`El pedido mayorista debe superar USDT ${MIN_WHOLESALE_USDT}`);
  }

  // Recargo billete USD: aplica solo a mayorista cuando paga en billete fisico
  const totalUnits = data.items.reduce((s, i) => s + i.qty, 0);
  const billeteRecargo = data.type === "wholesale" && data.wholesale_payment === "billete"
    ? Math.round(totalUnits * BILLETE_SURCHARGE_PER_UNIT * 100) / 100
    : 0;

  // Descuento: validar el código server-side y descontarlo del total en la moneda del pedido
  const orderCurrency: "ARS" | "USD" = data.type === "wholesale" ? "USD" : "ARS";
  let discountInOrderCurrency = 0;
  let discountCodeApplied: string | null = null;
  let discountCurrencyRaw: "ARS" | "USD" | null = null;
  let discountAmountRaw = 0;
  if (data.discount_code?.trim()) {
    const codeUpper = data.discount_code.trim().toUpperCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: codeRow } = await (supabase as any).from("discount_codes").select("*").eq("code", codeUpper).maybeSingle();
    if (codeRow && !codeRow.used && codeRow.amount > 0 && (codeRow.currency === "ARS" || codeRow.currency === "USD")) {
      discountCodeApplied = codeUpper;
      discountCurrencyRaw = codeRow.currency;
      discountAmountRaw = codeRow.amount;
      if (codeRow.currency === orderCurrency) {
        discountInOrderCurrency = codeRow.amount;
      } else if (orderCurrency === "ARS" && codeRow.currency === "USD") {
        const fx = data.fx_rate_at_apply && data.fx_rate_at_apply > 0 ? data.fx_rate_at_apply : 0;
        discountInOrderCurrency = fx > 0 ? Math.round(codeRow.amount * fx) : 0;
      } else if (orderCurrency === "USD" && codeRow.currency === "ARS") {
        const fx = data.fx_rate_at_apply && data.fx_rate_at_apply > 0 ? data.fx_rate_at_apply : 0;
        discountInOrderCurrency = fx > 0 ? Math.round((codeRow.amount / fx) * 100) / 100 : 0;
      }
    }
  }

  const total = Math.max(0, Math.round((itemsTotal + billeteRecargo - discountInOrderCurrency) * 100) / 100);

  const baseNotes = data.notes?.trim() || "";
  const noteParts: string[] = baseNotes ? [baseNotes] : [];
  if (billeteRecargo > 0) noteParts.push(`Recargo billete USDT ${billeteRecargo.toFixed(2)} (${totalUnits}u × ${BILLETE_SURCHARGE_PER_UNIT})`);
  if (discountCodeApplied) noteParts.push(`Descuento ${discountCodeApplied} -${discountAmountRaw} ${discountCurrencyRaw}`);
  const finalNotes = noteParts.join(" | ");

  // Crear pedido
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      type: data.type,
      customer_name: data.customer_name.trim(),
      customer_phone: data.customer_phone.trim(),
      customer_address: data.customer_address?.trim() || "",
      notes: finalNotes,
      payment_method: data.payment_method || null,
      total,
      status: "pending",
      payment_status: "unpaid",
      discount_code: discountCodeApplied,
      discount_amount: discountInOrderCurrency,
      discount_currency: discountCodeApplied ? orderCurrency : null,
      surcharge_amount: billeteRecargo,
      surcharge_note: billeteRecargo > 0 ? `Recargo billete USDT (${totalUnits}u × ${BILLETE_SURCHARGE_PER_UNIT})` : "",
    })
    .select("id, number")
    .single();

  if (error || !order) throw new Error("Error al crear el pedido");

  // Asignar order_id a los items
  const itemsWithOrderId = enrichedItems.map((i) => ({ ...i, order_id: order.id }));

  // Insertar items
  const { data: insertedItems } = await supabase
    .from("order_items")
    .insert(itemsWithOrderId)
    .select();

  // Reservar stock atómicamente — condición: stock_actual >= stock_reservado + qty
  const reservedItems: string[] = []; // product_ids ya reservados (para rollback)
  const outOfStockNames: string[] = [];

  for (const item of data.items) {
    const p = productMap.get(item.product_id)!;

    // Leer stock fresco justo antes de reservar para evitar race condition
    const { data: freshProduct } = await supabase
      .from("products")
      .select("stock_actual, stock_reservado")
      .eq("id", item.product_id)
      .single();

    if (!freshProduct || freshProduct.stock_actual - freshProduct.stock_reservado < item.qty) {
      outOfStockNames.push(p.name);
      // Revertir reservas anteriores: leer valor fresco antes de decrementar para evitar race en rollback
      for (const reservedId of reservedItems) {
        const reservedQty = data.items.find(i => i.product_id === reservedId)!.qty;
        const { data: currentState } = await supabase
          .from("products").select("stock_reservado").eq("id", reservedId).single();
        if (currentState) {
          await supabase.from("products")
            .update({ stock_reservado: Math.max(0, currentState.stock_reservado - reservedQty) })
            .eq("id", reservedId);
        }
      }
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
      return { success: false, outOfStock: outOfStockNames };
    }

    const newReserved = freshProduct.stock_reservado + item.qty;

    // Optimistic lock: solo actualiza si stock_reservado no cambió desde la lectura
    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({ stock_reservado: newReserved })
      .eq("id", item.product_id)
      .eq("stock_reservado", freshProduct.stock_reservado) // optimistic lock
      .gte("stock_actual", newReserved) // garantía adicional de stock suficiente
      .select("id");

    if (updateError || !updated || updated.length === 0) {
      // Stock tomado por otro cliente — revertir reservas anteriores
      outOfStockNames.push(p.name);

      // Revertir los ítems que ya habíamos reservado: leer valor fresco antes de decrementar
      for (const reservedId of reservedItems) {
        const reservedQty = data.items.find(i => i.product_id === reservedId)!.qty;
        const { data: currentState } = await supabase
          .from("products").select("stock_reservado").eq("id", reservedId).single();
        if (currentState) {
          await supabase.from("products")
            .update({ stock_reservado: Math.max(0, currentState.stock_reservado - reservedQty) })
            .eq("id", reservedId);
        }
      }

      // Eliminar el pedido creado
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);

      return { success: false, outOfStock: outOfStockNames };
    }

    reservedItems.push(item.product_id);

    await supabase.from("inventory_movements").insert({
      product_id: item.product_id,
      product_sku: p.sku,
      type: "reserva",
      qty: item.qty,
      order_id: order.id,
      note: `Pedido #${order.number}`,
    });
  }

  // Auto-registrar cliente y linkear al pedido
  // Usar .limit(1) para evitar error si hay clientes duplicados con el mismo teléfono
  const normalized = data.customer_phone.replace(/\D/g, "").slice(-10);
  const { data: existingRows } = await supabase
    .from("customers")
    .select("id, last_purchase, total_orders")
    .ilike("phone", `%${normalized}`)
    .limit(1);
  const existing = existingRows?.[0] ?? null;

  let customerId: string | null = null;
  if (existing) {
    customerId = existing.id;
    await supabase.from("customers").update({
      previous_purchase: existing.last_purchase,
      last_purchase: new Date().toISOString(),
      total_orders: (existing.total_orders || 0) + 1,
    }).eq("id", existing.id);
  } else {
    const type = data.type === "wholesale" ? "wholesale" : "retail";
    const { data: newCustomer } = await supabase.from("customers").insert({
      name: data.customer_name,
      phone: data.customer_phone,
      address: data.customer_address || "",
      type,
      code: `${type === "wholesale" ? "MAY" : "MIN"}-${Date.now().toString().slice(-4)}`,
      status: "active",
      last_purchase: new Date().toISOString(),
      total_orders: 1,
    }).select("id").single();
    if (newCustomer) customerId = newCustomer.id;
  }

  // Linkar customer_id al pedido
  if (customerId) {
    await supabase.from("orders").update({ customer_id: customerId }).eq("id", order.id);
  }

  // Refrescar el catálogo público para que el stock_reservado se vea sin esperar al revalidate
  try {
    revalidatePath("/productos");
    revalidatePath("/mayoristas/tienda");
    revalidatePath("/");
  } catch { /* tolerante a errores de revalidate */ }

  return {
    id: order.id,
    number: order.number,
    items: (insertedItems || []) as OrderItem[],
  };
}
