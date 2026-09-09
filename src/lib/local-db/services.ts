import type { Product, Customer, Order, OrderItem, CartItem, InventoryMovement, CashMovement } from "./types";
import { getDB, updateDB, uid, nextOrderNumber } from "./store";

// ─── PRODUCTS ───────────────────────────────────────────────
export function getProducts(): Product[] { return getDB().products; }
export function getVisibleProducts(): Product[] { return getDB().products.filter(p => p.visible && p.stock_actual > 0); }
export function getProductById(id: string): Product | undefined { return getDB().products.find(p => p.id === id); }
export function getProductBySlug(slug: string): Product | undefined { return getDB().products.find(p => p.slug === slug); }

export function createProduct(p: Omit<Product, "id" | "created_at" | "stock_reservado">): Product {
  const product: Product = { ...p, id: uid(), stock_reservado: 0, created_at: new Date().toISOString() };
  updateDB(db => { db.products.push(product); });
  return product;
}

export function updateProduct(id: string, updates: Partial<Product>) {
  updateDB(db => {
    const i = db.products.findIndex(p => p.id === id);
    if (i >= 0) db.products[i] = { ...db.products[i], ...updates };
  });
}

export function toggleProductVisibility(id: string) {
  updateDB(db => {
    const p = db.products.find(p => p.id === id);
    if (p) p.visible = !p.visible;
  });
}

// ─── CART (Minorista) ───────────────────────────────────────
export function getCart(): CartItem[] { return getDB().cart; }

export function addToCart(productId: string, qty: number = 1, unitPriceOverride?: number) {
  updateDB(db => {
    const existing = db.cart.find(c => c.product_id === productId);
    if (existing) {
      existing.qty += qty;
      if (unitPriceOverride !== undefined) existing.unit_price_override = unitPriceOverride;
    } else {
      const item: import("./types").CartItem = { product_id: productId, qty };
      if (unitPriceOverride !== undefined) item.unit_price_override = unitPriceOverride;
      db.cart.push(item);
    }
  });
  if (typeof window !== "undefined") window.dispatchEvent(new Event("fuelfit-cart-add"));
}

export function updateCartQty(productId: string, qty: number) {
  updateDB(db => {
    if (qty <= 0) { db.cart = db.cart.filter(c => c.product_id !== productId); }
    else {
      const item = db.cart.find(c => c.product_id === productId);
      if (item) item.qty = qty;
    }
  });
}

export function removeFromCart(productId: string) {
  updateDB(db => { db.cart = db.cart.filter(c => c.product_id !== productId); });
}

export function clearCart() { updateDB(db => { db.cart = []; }); }

export function getCartTotal(): number {
  const db = getDB();
  return db.cart.reduce((sum, item) => {
    const p = db.products.find(pr => pr.id === item.product_id);
    const unitPrice = item.unit_price_override ?? (p?.price_min_ars ?? 0);
    return sum + unitPrice * item.qty;
  }, 0);
}

export function getCartCount(): number {
  return getDB().cart.reduce((s, i) => s + i.qty, 0);
}

// ─── CART (Mayorista) ───────────────────────────────────────
export function getCartMay(): CartItem[] { return getDB().cart_mayorista; }
export function addToCartMay(productId: string, qty: number = 1, unitPriceOverride?: number) {
  updateDB(db => {
    const existing = db.cart_mayorista.find(c => c.product_id === productId);
    if (existing) {
      existing.qty += qty;
      if (unitPriceOverride !== undefined) existing.unit_price_override = unitPriceOverride;
    } else {
      db.cart_mayorista.push({ product_id: productId, qty, ...(unitPriceOverride !== undefined ? { unit_price_override: unitPriceOverride } : {}) });
    }
  });
  if (typeof window !== "undefined") window.dispatchEvent(new Event("fuelfit-cart-add"));
}
export function updateCartMayQty(productId: string, qty: number) {
  updateDB(db => {
    if (qty <= 0) { db.cart_mayorista = db.cart_mayorista.filter(c => c.product_id !== productId); }
    else { const i = db.cart_mayorista.find(c => c.product_id === productId); if (i) i.qty = qty; }
  });
}
export function removeFromCartMay(productId: string) {
  updateDB(db => { db.cart_mayorista = db.cart_mayorista.filter(c => c.product_id !== productId); });
}
export function clearCartMay() { updateDB(db => { db.cart_mayorista = []; }); }

export function getMayPrice(p: Product, qty: number): number {
  if (qty >= 100 && p.price_may_x100 > 0) return p.price_may_x100;
  if (qty >= 50 && p.price_may_x50 > 0) return p.price_may_x50;
  return p.price_may_x15;
}

// Calcula precios mayoristas considerando la composición total del carrito
// Lógica de tiers por cantidad total:
//   x15 (≥15 unidades), x50 (≥50 unidades), x100 (≥100 unidades)
export function getCartMayItemPrices(
  cart: { product_id: string; qty: number; unit_price_override?: number }[],
  products: Product[]
): Map<string, number> {
  const prices = new Map<string, number>();
  let totalUnits = 0;

  for (const item of cart) {
    if (item.unit_price_override !== undefined) continue;
    const p = products.find(pr => pr.id === item.product_id);
    if (!p) continue;
    totalUnits += item.qty;
  }

  const tier: "x100" | "x50" | "x15" = totalUnits >= 100 ? "x100" : totalUnits >= 50 ? "x50" : "x15";

  for (const item of cart) {
    if (item.unit_price_override !== undefined) {
      prices.set(item.product_id, item.unit_price_override);
      continue;
    }
    const p = products.find(pr => pr.id === item.product_id);
    if (!p) continue;

    let price: number;
    if (tier === "x100" && p.price_may_x100 > 0) price = p.price_may_x100;
    else if ((tier === "x100" || tier === "x50") && p.price_may_x50 > 0) price = p.price_may_x50;
    else price = p.price_may_x15;

    prices.set(item.product_id, price);
  }
  return prices;
}

export function getCartMayTotal(): number {
  const db = getDB();
  const prices = getCartMayItemPrices(db.cart_mayorista, db.products);
  return db.cart_mayorista.reduce((sum, item) => {
    const price = prices.get(item.product_id) ?? 0;
    return sum + price * item.qty;
  }, 0);
}

export function getCartMayCount(): number {
  return getDB().cart_mayorista.reduce((s, i) => s + i.qty, 0);
}

// ─── ORDERS ─────────────────────────────────────────────────
export function getOrders(): Order[] { return getDB().orders.sort((a, b) => b.created_at.localeCompare(a.created_at)); }
export function getOrderById(id: string): Order | undefined { return getDB().orders.find(o => o.id === id); }
export function getOrderItems(orderId: string): OrderItem[] { return getDB().order_items.filter(i => i.order_id === orderId); }
export function getOrdersByCustomerPhone(phone: string): Order[] { return getDB().orders.filter(o => o.customer_phone === phone).sort((a, b) => b.created_at.localeCompare(a.created_at)); }

export function createOrder(data: {
  type: "retail" | "wholesale";
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_id?: string;
  notes: string;
  payment_method?: string;
  items: { product_id: string; qty: number; unit_price: number }[];
}): Order {
  const num = nextOrderNumber();
  const orderId = uid();
  const total = data.items.reduce((s, i) => s + i.qty * i.unit_price, 0);

  const order: Order = {
    id: orderId, number: num, type: data.type, status: "pending",
    payment_status: "unpaid", payment_method: (data.payment_method as any) || undefined,
    customer_name: data.customer_name, customer_phone: data.customer_phone,
    customer_address: data.customer_address, customer_id: data.customer_id,
    notes: data.notes, total, created_at: new Date().toISOString(),
  };

  const orderItems: OrderItem[] = data.items.map(i => {
    const p = getProductById(i.product_id);
    return { id: uid(), order_id: orderId, product_id: i.product_id, product_name: p?.name || "", product_sku: p?.sku || "", qty: i.qty, unit_price: i.unit_price, subtotal: i.qty * i.unit_price };
  });

  updateDB(db => {
    db.orders.push(order);
    db.order_items.push(...orderItems);
    // Reserve stock
    data.items.forEach(i => {
      const p = db.products.find(pr => pr.id === i.product_id);
      if (p) { p.stock_reservado += i.qty; }
      db.inventory_movements.push({ id: uid(), product_id: i.product_id, product_sku: p?.sku || "", type: "reserva", qty: i.qty, order_id: orderId, note: `Pedido #${num}`, created_at: new Date().toISOString() });
    });
    // Auto-register / update customer
    autoRegisterCustomer(db, data.customer_name, data.customer_phone, data.customer_address, data.type);
  });

  return order;
}

function autoRegisterCustomer(db: any, name: string, phone: string, address: string, orderType: string) {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  const existing = db.customers.find((c: Customer) => c.phone.replace(/\D/g, "").slice(-10) === normalized);
  if (existing) {
    existing.previous_purchase = existing.last_purchase;
    existing.last_purchase = new Date().toISOString();
    existing.total_orders = (existing.total_orders || 0) + 1;
    // Check name mismatch
    if (name && existing.name !== name && name.toLowerCase() !== existing.name.toLowerCase()) {
      existing.has_duplicate_warning = true;
      existing.duplicate_names = existing.duplicate_names || [];
      if (!existing.duplicate_names.includes(name)) existing.duplicate_names.push(name);
    }
    if (address && !existing.address) existing.address = address;
  } else {
    db.customers.push({
      id: uid(), name, phone, address: address || "", zone: "",
      type: orderType === "wholesale" ? "wholesale" : "retail",
      code: `${orderType === "wholesale" ? "MAY" : "MIN"}-${Date.now().toString().slice(-4)}`,
      status: "active", notes: "", created_at: new Date().toISOString(),
      last_purchase: new Date().toISOString(), previous_purchase: undefined,
      total_orders: 1, has_duplicate_warning: false, duplicate_names: [],
    });
  }
}

export function confirmOrder(orderId: string, caja: string = "Oficina") {
  updateDB(db => {
    const order = db.orders.find(o => o.id === orderId);
    if (!order || order.status !== "pending") return;
    order.status = "confirmed";
    order.confirmed_at = new Date().toISOString();
    order.payment_status = "paid";

    const items = db.order_items.filter(i => i.order_id === orderId);
    items.forEach(item => {
      const p = db.products.find(pr => pr.id === item.product_id);
      if (p) {
        p.stock_actual -= item.qty;
        p.stock_reservado -= item.qty;
        if (p.stock_actual < 0) p.stock_actual = 0;
        if (p.stock_reservado < 0) p.stock_reservado = 0;
      }
      db.inventory_movements.push({ id: uid(), product_id: item.product_id, product_sku: item.product_sku, type: "egreso", qty: item.qty, order_id: orderId, note: `Confirmado #${order.number}`, created_at: new Date().toISOString() });
    });

    const currency = order.type === "wholesale" ? "USD" : "ARS";
    db.cash_movements.push({ id: uid(), type: "sale_income", amount: order.total, currency, caja, category: "Venta", order_id: orderId, note: `Pedido #${order.number} - ${order.customer_name}`, created_at: new Date().toISOString() });
  });
}

export function cancelOrder(orderId: string) {
  updateDB(db => {
    const order = db.orders.find(o => o.id === orderId);
    if (!order || order.status !== "pending") return;
    order.status = "cancelled";

    const items = db.order_items.filter(i => i.order_id === orderId);
    items.forEach(item => {
      const p = db.products.find(pr => pr.id === item.product_id);
      if (p) { p.stock_reservado -= item.qty; if (p.stock_reservado < 0) p.stock_reservado = 0; }
      db.inventory_movements.push({ id: uid(), product_id: item.product_id, product_sku: item.product_sku, type: "liberacion", qty: item.qty, order_id: orderId, note: `Cancelado #${order.number}`, created_at: new Date().toISOString() });
    });
  });
}

// ─── CUSTOMERS ──────────────────────────────────────────────
export function getCustomers(): Customer[] { return getDB().customers; }
export function getCustomerById(id: string): Customer | undefined { return getDB().customers.find(c => c.id === id); }
export function getCustomerByPhone(phone: string): Customer | undefined {
  const n = phone.replace(/\D/g, "").slice(-10);
  return getDB().customers.find(c => c.phone.replace(/\D/g, "").slice(-10) === n);
}
export function getPendingWholesalers(): Customer[] { return getDB().customers.filter(c => c.type === "wholesale" && c.status === "pending"); }
export function getDuplicateWarnings(): Customer[] { return getDB().customers.filter(c => c.has_duplicate_warning); }

export function registerWholesaler(data: { name: string; phone: string; password?: string; address?: string; zone?: string }): Customer {
  const c: Customer = { id: uid(), name: data.name, phone: data.phone, address: data.address || "", zone: data.zone || "", type: "wholesale", code: `MAY-${Date.now().toString().slice(-4)}`, status: "active", notes: "", created_at: new Date().toISOString(), total_orders: 0, has_duplicate_warning: false, duplicate_names: [] };
  updateDB(db => { db.customers.push(c); });
  return c;
}

export function approveWholesaler(id: string) { updateDB(db => { const c = db.customers.find(c => c.id === id); if (c) c.status = "active"; }); }
export function rejectWholesaler(id: string) { updateDB(db => { const c = db.customers.find(c => c.id === id); if (c) c.status = "rejected"; }); }
export function resolveDuplicate(id: string) { updateDB(db => { const c = db.customers.find(c => c.id === id); if (c) { c.has_duplicate_warning = false; c.duplicate_names = []; } }); }

export function logoutMayorista() { updateDB(db => { db.cart_mayorista = []; }); }

// ─── CASH ───────────────────────────────────────────────────
export function getCashMovements(): CashMovement[] { return getDB().cash_movements.sort((a, b) => b.created_at.localeCompare(a.created_at)); }

export function getCashBalance(): { ars: number; usd: number } {
  const db = getDB();
  let ars = 0, usd = 0;
  db.cash_movements.forEach(m => {
    const sign = m.type === "sale_income" || m.type === "manual_income" ? 1 : -1;
    if (m.currency === "ARS") ars += sign * m.amount;
    else usd += sign * m.amount;
  });
  return { ars, usd };
}

export function getCashBalanceByCaja(): Record<string, { ars: number; usd: number }> {
  const db = getDB();
  const result: Record<string, { ars: number; usd: number }> = { Luciano: { ars: 0, usd: 0 }, Santiago: { ars: 0, usd: 0 }, Oficina: { ars: 0, usd: 0 } };
  db.cash_movements.forEach(m => {
    const sign = m.type === "sale_income" || m.type === "manual_income" ? 1 : -1;
    if (!result[m.caja]) result[m.caja] = { ars: 0, usd: 0 };
    if (m.currency === "ARS") result[m.caja].ars += sign * m.amount;
    else result[m.caja].usd += sign * m.amount;
  });
  return result;
}

export function addCashMovement(data: Omit<CashMovement, "id" | "created_at">) {
  updateDB(db => { db.cash_movements.push({ ...data, id: uid(), created_at: new Date().toISOString() }); });
}

// ─── INVENTORY ──────────────────────────────────────────────
export function getInventoryMovements(): InventoryMovement[] { return getDB().inventory_movements.sort((a, b) => b.created_at.localeCompare(a.created_at)); }

// ─── DASHBOARD METRICS ──────────────────────────────────────
export function getDashboardMetrics() {
  const db = getDB();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const todayOrders = db.orders.filter(o => o.created_at.slice(0, 10) === today && o.status === "confirmed");
  const monthOrders = db.orders.filter(o => o.created_at.slice(0, 7) === thisMonth && o.status === "confirmed");
  const pendingOrders = db.orders.filter(o => o.status === "pending");
  const totalStock = db.products.reduce((s, p) => s + p.stock_actual, 0);
  const stockValueUSD = db.products.reduce((s, p) => s + p.stock_actual * p.price_may_x15, 0);
  const stockValueARS = db.products.reduce((s, p) => s + p.stock_actual * p.price_min_ars, 0);
  const lowStock = db.products.filter(p => p.visible && p.stock_actual <= 10);
  const salesToday = todayOrders.reduce((s, o) => s + o.total, 0);
  const salesMonth = monthOrders.reduce((s, o) => s + o.total, 0);
  const activeProducts = db.products.filter(p => p.visible).length;
  // monthly income/expense
  const monthCash = db.cash_movements.filter(m => m.created_at.slice(0, 7) === thisMonth);
  const monthIncome = monthCash.filter(m => m.type.includes("income")).reduce((s, m) => s + m.amount, 0);
  const monthExpense = monthCash.filter(m => !m.type.includes("income")).reduce((s, m) => s + m.amount, 0);

  return { salesToday, salesMonth, salesTodayCount: todayOrders.length, salesMonthCount: monthOrders.length,
    pendingOrders: pendingOrders.length, pendingOrdersList: pendingOrders.slice(0, 5),
    activeProducts, totalStock, stockValueUSD, stockValueARS,
    lowStock: lowStock.length, lowStockProducts: lowStock,
    monthIncome, monthExpense, monthProfit: monthIncome - monthExpense };
}

// ─── WHATSAPP HELPERS ───────────────────────────────────────
export function buildOrderWhatsApp(order: Order, items: OrderItem[]): string {
  const lines = [`🛒 *Pedido #${order.number}*`, `📋 ${order.type === "wholesale" ? "Mayorista" : "Minorista"}`, ""];
  items.forEach(i => { lines.push(`• ${i.product_name} x${i.qty} — $${i.subtotal.toLocaleString()}`); });
  lines.push("", `💰 *Total: $${order.total.toLocaleString()}*`);
  if (order.payment_method) lines.push(`💳 Pago: ${order.payment_method === "cash" ? "Efectivo" : "Transferencia"}`);
  if (order.customer_address && !order.customer_address.includes("Retiro")) {
    lines.push(`📦 Envío: ${order.customer_address}`);
  } else {
    lines.push("📍 Retiro coordinado por WhatsApp");
  }
  if (order.notes) lines.push(`📝 ${order.notes}`);
  lines.push("", `👤 ${order.customer_name}`, `📱 ${order.customer_phone}`);
  return lines.join("\n");
}

export function buildOrderWhatsAppURL(order: Order, items: OrderItem[]): string {
  const text = buildOrderWhatsApp(order, items);
  return `https://wa.me/5491172000525?text=${encodeURIComponent(text)}`;
}

export function copyOrderText(order: Order, items: OrderItem[]): string {
  return buildOrderWhatsApp(order, items);
}
