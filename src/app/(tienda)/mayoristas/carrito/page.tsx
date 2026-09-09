"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, Minus, Plus, Trash2, Crown, MessageCircle, Printer, Copy, Check } from "lucide-react";
import { useDB, getCartMay, updateCartMayQty, removeFromCartMay, clearCartMay, getCartMayItemPrices, getCartMayCount } from "@/lib/local-db";
import { createClient } from "@/lib/supabase/client";
import { createOrderAction } from "@/app/(tienda)/actions";
import { validateDiscountCodeAction, useDiscountCodeAction } from "@/app/admin/actions";
import type { Product } from "@/lib/local-db/types";

const MIN_USDT = 130;
const BILLETE_RECARGO_PER_UNIT = 0.15;

interface ReceiptItemMay {
  brand: string;
  model: string;
  flavor: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

function groupByBrandModel(items: ReceiptItemMay[]) {
  const groups: Map<string, ReceiptItemMay[]> = new Map();
  for (const item of items) {
    const key = `${item.brand}|${item.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function buildWhatsAppText(
  orderNumber: number,
  items: ReceiptItemMay[],
  customerName: string,
  customerPhone: string,
  notes: string,
  paymentMethod: "usdt" | "billete" | "ars",
  deliveryMode: "retiro" | "envio",
  billeteRecargo: number,
  discount?: { amount: number; currency: "ARS" | "USD"; code: string } | null,
  arsRate?: number | null
): string {
  const groups = groupByBrandModel(items);
  const totalRaw = items.reduce((s, i) => s + i.subtotal, 0);
  const discountUSD = discount?.currency === "USD" ? discount.amount : 0;
  const discountARS = discount?.currency === "ARS" ? discount.amount : 0;
  const totalBase = Math.max(0, totalRaw - discountUSD);
  const totalFinal = totalBase + billeteRecargo;

  const lines: string[] = [`*Pedido Mayorista #${orderNumber} — FuelFit*`, ``];

  for (const [key, groupItems] of groups) {
    const [brand, model] = key.split("|");
    lines.push(`  *${brand.toUpperCase()} ${model.toUpperCase()}*`);
    for (const item of groupItems) {
      const label = (item.flavor && item.flavor !== item.model ? item.flavor : item.model).toLowerCase();
      lines.push(`  ${item.qty} ${label}  —  USDT ${item.subtotal.toFixed(2)}`);
    }
    lines.push(``);
  }

  if (discount) {
    if (discountUSD > 0) lines.push(`  Descuento (${discount.code}): - USDT ${discountUSD.toFixed(2)}`);
    if (discountARS > 0) lines.push(`  Descuento ARS (${discount.code}): - $ ${discountARS.toLocaleString()} al cobrar`);
    lines.push(``);
  }
  if (billeteRecargo > 0) lines.push(`  Recargo billete: + USDT ${billeteRecargo.toFixed(2)}`);
  lines.push(`  *TOTAL: USDT ${totalFinal.toFixed(2)}*`);
  if (paymentMethod === "ars" && arsRate) {
    const arsTotal = Math.round(totalFinal * arsRate);
    lines.push(`  _(= $${arsTotal.toLocaleString("es-AR")} ARS al cambio FuelFit)_`);
  }
  if (discountARS > 0) lines.push(`  _(mas $ ${discountARS.toLocaleString()} ARS de descuento al cobrar)_`);
  const pmLabel = paymentMethod === "usdt" ? "USDT (Crypto)" : paymentMethod === "billete" ? "USD Billete" : "ARS (Pesos)";
  lines.push(`  Pago: ${pmLabel}`);
  lines.push(deliveryMode === "envio" ? `  Envio a domicilio (coordinar costo)` : `  Retiro en nuestro local`);
  if (notes) lines.push(`  Nota: ${notes}`);
  lines.push(`  ${customerName} · ${customerPhone}`);
  return lines.join("\n");
}

function MayReceiptView({
  orderNumber, items, customerName, customerPhone, notes,
  paymentMethod, deliveryMode, billeteRecargo, discount, arsRate, waUrl, waText,
}: {
  orderNumber: number; items: ReceiptItemMay[]; customerName: string; customerPhone: string;
  notes: string; paymentMethod: "usdt" | "billete" | "ars"; deliveryMode: "retiro" | "envio";
  billeteRecargo: number; discount: { amount: number; currency: "ARS" | "USD"; code: string } | null;
  arsRate: number | null;
  waUrl: string;
  waText: string;
}) {
  const groups = groupByBrandModel(items);
  const totalRaw = items.reduce((s, i) => s + i.subtotal, 0);
  const discountUSD = discount?.currency === "USD" ? discount.amount : 0;
  const discountARS = discount?.currency === "ARS" ? discount.amount : 0;
  const totalBase = Math.max(0, totalRaw - discountUSD);
  const totalFinal = totalBase + billeteRecargo;
  const now = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = waText;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* CTA principal — destacado */}
      {waUrl && (
        <div className="mb-4 print:hidden">
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-4 text-base font-bold text-white hover:bg-green-700 transition-all shadow-lg shadow-green-600/20">
            <MessageCircle size={20} /> ENVIAR PEDIDO POR WHATSAPP
          </a>
          <p className="mt-2 text-center text-[11px] text-text-muted">
            ¿Estás navegando dentro de WhatsApp? Tocá <span className="font-semibold text-text-secondary">Copiar mensaje</span> y pegalo en nuestro chat.
          </p>
        </div>
      )}

      {/* Botones secundarios */}
      <div className="flex gap-3 mb-6 print:hidden">
        <button onClick={handleCopy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-bg-hover transition-all">
          {copied ? <><Check size={16} className="text-green-400" /> ¡Copiado!</> : <><Copy size={16} /> Copiar mensaje</>}
        </button>
        <button onClick={() => window.print()}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-card px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-bg-hover transition-all">
          <Printer size={16} /> PDF
        </button>
      </div>

      <div id="receipt" className="rounded-2xl border border-border bg-bg-card p-6 print:border-0 print:p-0">
        <div className="flex items-start justify-between mb-5 pb-5 border-b border-border">
          <div>
            <p className="font-display text-xl font-bold text-text-primary">FuelFit Importaciones</p>
            <p className="text-xs text-text-muted mt-0.5">Canal Mayorista</p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-violet">#{orderNumber}</p>
            <p className="text-xs text-text-muted mt-0.5">{now}</p>
          </div>
        </div>

        <div className="mb-4 text-sm">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">CLIENTE</p>
          <p className="font-semibold text-text-primary">{customerName}</p>
          <p className="text-text-muted">{customerPhone}</p>
        </div>

        <div className="mb-5 space-y-4">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">DETALLE DEL PEDIDO</p>
          {Array.from(groups).map(([key, groupItems]) => {
            const [brand, model] = key.split("|");
            const groupSubtotal = groupItems.reduce((s, i) => s + i.subtotal, 0);
            return (
              <div key={key} className="rounded-xl border border-border overflow-hidden">
                <div className="bg-bg-secondary px-4 py-2 flex items-center justify-between">
                  <p className="text-xs font-bold tracking-wide text-text-primary uppercase">{brand} — {model}</p>
                  {groups.size > 1 && (
                    <p className="text-xs font-semibold text-green-400">USDT {groupSubtotal.toFixed(2)}</p>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {groupItems.map((item, idx) => {
                    const label = item.flavor && item.flavor !== item.model ? item.flavor : item.model;
                    return (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-violet bg-violet/10 rounded-md px-1.5 py-0.5">x{item.qty}</span>
                          <span className="text-text-secondary">{label}</span>
                        </div>
                        <span className="font-semibold text-green-400">USDT {item.subtotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t-2 border-border pt-4 space-y-2 text-sm">
          {discountUSD > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Descuento ({discount!.code})</span>
              <span>− USDT {discountUSD.toFixed(2)}</span>
            </div>
          )}
          {billeteRecargo > 0 && (
            <div className="flex justify-between text-yellow-400">
              <span>Recargo billete</span>
              <span>+ USDT {billeteRecargo.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="font-bold text-text-primary">TOTAL</span>
            <div className="text-right">
              <span className="font-display text-2xl font-bold text-green-400">USDT {totalFinal.toFixed(2)}</span>
              {paymentMethod === "ars" && arsRate && (
                <p className="text-sm font-bold text-violet-light mt-0.5">
                  = ${Math.round(totalFinal * arsRate).toLocaleString("es-AR")} ARS
                </p>
              )}
            </div>
          </div>
          {discountARS > 0 && (
            <p className="text-xs text-green-400">+ descuento de $ {discountARS.toLocaleString()} ARS al cobrar</p>
          )}
          <div className="mt-3 space-y-1 text-xs text-text-muted pt-2 border-t border-border">
            <p>💳 {paymentMethod === "usdt" ? "USDT (Crypto)" : paymentMethod === "billete" ? "USD Billete" : "ARS (Pesos)"}</p>
            <p>{deliveryMode === "retiro" ? "🏪 Retiro en nuestro local" : "🚚 Envío a domicilio (coordinar costo)"}</p>
            {notes && <p>📝 {notes}</p>}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#__next) { display: none; }
          #receipt { display: block !important; border: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      <div className="mt-4 text-center print:hidden">
        <Link href="/mayoristas/tienda" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
          Seguir comprando →
        </Link>
      </div>
    </div>
  );
}

export default function CarritoMayoristaPage() {
  const cart = useDB(useCallback(() => getCartMay(), []));
  const cartCount = useDB(useCallback(() => getCartMayCount(), []));
  const [products, setProducts] = useState<Product[]>([]);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItemMay[]>([]);
  const [waUrl, setWaUrl] = useState("");
  const [waText, setWaText] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState<{ amount: number; currency: "ARS" | "USD"; code: string } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"usdt" | "billete" | "ars">("usdt");
  const [deliveryMode, setDeliveryMode] = useState<"retiro" | "envio">("retiro");
  const [arsRate, setArsRate] = useState<number | null>(null);
  const [waPhone, setWaPhone] = useState("5491172000525");

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.from("products").select("*").eq("visible", true)
      .then(({ data }) => setProducts((data || []) as Product[]));
    supabase.from("config").select("value").eq("key", "whatsapp").single()
      .then(({ data }) => { if (data?.value) setWaPhone(data.value.replace(/\D/g, "")); });
    fetch("/api/fx")
      .then(r => r.json())
      .then(j => { if (j?.rate) setArsRate(j.rate); })
      .catch(() => {});
  }, []);

  // Precios cart-aware con lógica THC
  const priceMap = getCartMayItemPrices(cart, products);
  const cartItems = cart.map(c => {
    const p = products.find(pr => pr.id === c.product_id);
    if (!p) return null;
    const unitPrice = priceMap.get(c.product_id) ?? p.price_may_x15;
    return { ...c, product: p, unitPrice };
  }).filter(Boolean) as { product_id: string; qty: number; unit_price_override?: number; product: Product; unitPrice: number }[];

  const totalUnits = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotalRaw = cartItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const discountUSD = discount ? (discount.currency === "USD" ? discount.amount : 0) : 0;
  const discountARS = discount ? (discount.currency === "ARS" ? discount.amount : 0) : 0;
  const cartTotalBase = Math.max(0, cartTotalRaw - discountUSD);
  const billeteRecargo = paymentMethod === "billete" ? totalUnits * BILLETE_RECARGO_PER_UNIT : 0;
  const cartTotal = cartTotalBase + billeteRecargo;
  const meetsMinimum = cartTotalBase >= MIN_USDT;

  const handleApplyCode = async () => {
    if (!discountCode.trim()) return;
    setValidatingCode(true);
    setDiscountError(null);
    try {
      const result = await validateDiscountCodeAction(discountCode.trim());
      if (result.valid) {
        setDiscount({ amount: result.amount, currency: result.currency as "ARS" | "USD", code: discountCode.trim().toUpperCase() });
      } else {
        setDiscountError(result.error || "Código inválido");
        setDiscount(null);
      }
    } catch {
      setDiscountError("Error al validar el código. Intentá de nuevo.");
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !meetsMinimum) return;
    setLoading(true);
    // Abrir ventana sincronicamente con el click — necesario para evitar popup blockers
    // despues del await. Si el navegador la bloquea o esta dentro de un webview, queda null
    // y caemos al boton manual del recibo.
    const waWindow = window.open("about:blank", "_blank");
    try {
      const result = await createOrderAction({
        type: "wholesale",
        customer_name: name,
        customer_phone: phone,
        customer_address: deliveryMode === "envio" ? "Envío a domicilio" : "Retiro en comercio",
        notes: notes || "Pedido mayorista",
        wholesale_payment: paymentMethod,
        items: cartItems.map(i => ({ product_id: i.product_id, qty: i.qty })),
        discount_code: discount?.code,
        fx_rate_at_apply: arsRate ?? undefined,
      });
      if ("success" in result && result.success === false) {
        waWindow?.close();
        alert(`Sin stock disponible para: ${result.outOfStock.join(", ")}`);
        return;
      }
      const orderResult = result as { id: string; number: number; items: import("@/lib/local-db/types").OrderItem[] };
      if (discount) await useDiscountCodeAction(discount.code, orderResult.id);

      const rItems: ReceiptItemMay[] = orderResult.items.map(item => {
        const prod = cartItems.find(c => c.product_id === item.product_id)?.product;
        return {
          brand: prod?.brand || "",
          model: prod?.model || "",
          flavor: prod?.flavor || prod?.model || "",
          qty: item.qty,
          unitPrice: item.unit_price,
          subtotal: item.subtotal,
        };
      });

      const text = buildWhatsAppText(orderResult.number, rItems, name, phone, notes, paymentMethod, deliveryMode, billeteRecargo, discount, arsRate);
      const url = `https://api.whatsapp.com/send/?phone=${waPhone}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;

      // Redirect inmediato — antes de cualquier setState para minimizar delay percibido
      if (waWindow && !waWindow.closed) {
        try { waWindow.location.href = url; } catch { /* webview puede bloquear el set */ }
      } else {
        window.open(url, "_blank");
      }

      clearCartMay();
      setReceiptItems(rItems);
      setWaUrl(url);
      setWaText(text);
      setDone(orderResult.number);
    } catch {
      waWindow?.close();
      alert("Ocurrió un error al procesar tu pedido. Por favor, intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-3xl border border-border bg-bg-card px-6 py-16 text-center">
        <p className="text-text-muted text-sm">Cargando...</p>
      </div>
    </div>
  );

  if (done) return (
    <MayReceiptView
      orderNumber={done}
      items={receiptItems}
      customerName={name}
      customerPhone={phone}
      notes={notes}
      paymentMethod={paymentMethod}
      deliveryMode={deliveryMode}
      billeteRecargo={billeteRecargo}
      discount={discount}
      arsRate={arsRate}
      waUrl={waUrl}
      waText={waText}
    />
  );

  if (!mounted || cartItems.length === 0) return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3 mb-6">
        <Crown size={20} className="text-violet-light" />
        <h1 className="font-display text-2xl font-bold">Carrito Mayorista</h1>
      </div>
      <div className="flex flex-col items-center rounded-3xl border border-border bg-bg-card px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated"><ShoppingCart size={28} className="text-text-muted" /></div>
        <p className="mt-5 text-text-secondary">Tu carrito está vacío</p>
        <Link href="/mayoristas/tienda" className="mt-6 rounded-xl bg-violet px-6 py-2.5 text-sm font-bold tracking-wider text-white hover:bg-violet-dark transition-all">VER CATÁLOGO MAYORISTA</Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3 mb-6">
        <Crown size={20} className="text-violet-light" />
        <h1 className="font-display text-2xl font-bold">Carrito Mayorista ({cartCount} unidades)</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          {cartItems.map(item => (
            <div key={item.product_id} className="rounded-2xl border border-border bg-bg-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative h-14 w-14 shrink-0 rounded-xl bg-bg-secondary overflow-hidden">
                  {item.product.image ? (
                    <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-2xl">📦</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-violet/60">{item.product.brand.toUpperCase()}</p>
                  <h3 className="text-sm font-medium truncate">{item.product.model}</h3>
                  {item.product.flavor && <p className="text-xs text-text-muted">{item.product.flavor}</p>}
                  <p className="text-xs text-text-muted">USDT {item.unitPrice.toFixed(2)}/u</p>
                </div>
                <button type="button" onClick={() => removeFromCartMay(item.product_id)} className="text-text-muted hover:text-red-400 transition-colors shrink-0 p-1"><Trash2 size={16} /></button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-border">
                  <button type="button" onClick={() => updateCartMayQty(item.product_id, item.qty - 1)} disabled={item.qty <= 1} className="px-2.5 py-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={14} /></button>
                  <span className="w-14 text-center text-sm font-semibold">{item.qty}</span>
                  <button type="button" onClick={() => updateCartMayQty(item.product_id, Math.min(item.qty + 1, Math.max(1, item.product.stock_actual - item.product.stock_reservado)))} disabled={item.qty >= Math.max(1, item.product.stock_actual - item.product.stock_reservado)} className="px-2.5 py-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={14} /></button>
                </div>
                <p className="font-display text-base font-bold text-green-400">USDT {(item.unitPrice * item.qty).toFixed(2)}</p>
              </div>
              {item.qty > item.product.stock_actual - item.product.stock_reservado && (
                <p className="mt-1 text-[10px] text-yellow-400">⚠️ Solo hay {item.product.stock_actual - item.product.stock_reservado} disponibles</p>
              )}
            </div>
          ))}

          {/* Datos del comprador */}
          <div className="rounded-2xl border border-border bg-bg-card p-5 space-y-4">
            <h2 className="font-display text-base font-semibold">Datos de contacto</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="text-xs font-semibold text-text-secondary block mb-1.5">Nombre y Apellido *</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" /></div>
              <div><label className="text-xs font-semibold text-text-secondary block mb-1.5">Teléfono *</label><input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 9 11 1234-5678" className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" /></div>
            </div>
            <div><label className="text-xs font-semibold text-text-secondary block mb-1.5">Notas (opcional)</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Algo que quieras aclarar..." className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" /></div>
          </div>

          {/* Envío / Retiro */}
          <div className="rounded-2xl border border-border bg-bg-card p-5">
            <h2 className="font-display text-base font-semibold mb-3">Entrega</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMode("retiro")}
                className={`rounded-xl border p-4 text-left transition-all ${deliveryMode === "retiro" ? "border-violet bg-violet/10" : "border-border hover:border-border/80 hover:bg-bg-hover"}`}
              >
                <p className="text-sm font-bold mb-0.5">🏪 Retiro</p>
                <p className="text-xs text-text-muted">En nuestro comercio</p>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("envio")}
                className={`rounded-xl border p-4 text-left transition-all ${deliveryMode === "envio" ? "border-violet bg-violet/10" : "border-border hover:border-border/80 hover:bg-bg-hover"}`}
              >
                <p className="text-sm font-bold mb-0.5">🛵 Envío</p>
                <p className="text-xs text-text-muted">A domicilio (coordinar costo)</p>
              </button>
            </div>
          </div>

          {/* Método de pago */}
          <div className="rounded-2xl border border-border bg-bg-card p-5">
            <h2 className="font-display text-base font-semibold mb-3">Método de pago</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("usdt")}
                className={`rounded-xl border p-3 text-left transition-all ${paymentMethod === "usdt" ? "border-violet bg-violet/10" : "border-border hover:border-border/80 hover:bg-bg-hover"}`}
              >
                <p className="text-sm font-bold mb-0.5">💎 USDT</p>
                <p className="text-xs text-text-muted">Crypto</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("billete")}
                className={`rounded-xl border p-3 text-left transition-all ${paymentMethod === "billete" ? "border-violet bg-violet/10" : "border-border hover:border-border/80 hover:bg-bg-hover"}`}
              >
                <p className="text-sm font-bold mb-0.5">💵 USD</p>
                <p className="text-xs text-text-muted">Billete</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("ars")}
                className={`rounded-xl border p-3 text-left transition-all ${paymentMethod === "ars" ? "border-violet bg-violet/10" : "border-border hover:border-border/80 hover:bg-bg-hover"}`}
              >
                <p className="text-sm font-bold mb-0.5">🇦🇷 ARS</p>
                <p className="text-xs text-text-muted">Pesos</p>
              </button>
            </div>
            {paymentMethod === "billete" && (
              <p className="mt-2 text-xs text-yellow-400">Recargo: {totalUnits} u × USDT {BILLETE_RECARGO_PER_UNIT} = USDT {billeteRecargo.toFixed(2)}</p>
            )}
            {paymentMethod === "ars" && arsRate && (
              <p className="mt-2 text-xs text-violet-light">Cotización FuelFit: 1 USDT = ${arsRate.toLocaleString("es-AR")} ARS</p>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-bg-card p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold mb-4">Resumen</h2>
          <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
            {Array.from(groupByBrandModel(cartItems.map(item => ({
              brand: item.product.brand,
              model: item.product.model,
              flavor: item.product.flavor || item.product.model,
              qty: item.qty,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.qty,
            })))).map(([key, groupItems]) => {
              const [brand, model] = key.split("|");
              return (
                <div key={key}>
                  <p className="text-[10px] font-bold tracking-wider text-text-muted uppercase mb-1">{brand} — {model}</p>
                  {groupItems.map((item, idx) => {
                    const label = item.flavor && item.flavor !== item.model ? item.flavor : item.model;
                    return (
                      <div key={idx} className="flex justify-between text-text-secondary pl-2">
                        <span className="truncate mr-2">{label} x{item.qty}</span>
                        <span className="shrink-0 text-green-400">USDT {item.subtotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Código de descuento */}
          {!discount ? (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={discountCode}
                  onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(null); }}
                  placeholder="Código de descuento"
                  className="flex-1 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-xs focus:border-violet focus:outline-none uppercase"
                />
                <button type="button" onClick={handleApplyCode} disabled={validatingCode || !discountCode.trim()} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-secondary hover:bg-bg-hover disabled:opacity-40 transition-all">
                  {validatingCode ? "..." : "Aplicar"}
                </button>
              </div>
              {discountError && <p className="mt-1 text-[10px] text-red-400">{discountError}</p>}
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-green-400">✓ Descuento aplicado</p>
                <p className="text-[10px] text-text-muted">{discount.code} — {discount.currency === "USD" ? "USDT" : "$"} {discount.amount.toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => { setDiscount(null); setDiscountCode(""); }} className="text-[10px] text-text-muted hover:text-red-400 transition-colors">Quitar</button>
            </div>
          )}

          {/* Totales */}
          <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm">
            {discount && (
              <div className="flex justify-between text-text-muted">
                <span>Subtotal</span>
                <span className="line-through">USDT {cartTotalRaw.toFixed(2)}</span>
              </div>
            )}
            {discountUSD > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Descuento</span>
                <span>− USDT {discountUSD.toFixed(2)}</span>
              </div>
            )}
            {discountARS > 0 && (
              <div className="flex justify-between text-green-400 text-xs">
                <span>Desc. ARS (al cobrar)</span>
                <span>− $ {discountARS.toLocaleString()}</span>
              </div>
            )}
            {billeteRecargo > 0 && (
              <div className="flex justify-between text-yellow-400">
                <span>Recargo billete</span>
                <span>+ USDT {billeteRecargo.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span>
              <div className="text-right">
                {paymentMethod === "ars" && arsRate ? (
                  <>
                    <span className="font-display text-lg font-bold text-violet-light">
                      ${Math.round(cartTotal * arsRate).toLocaleString("es-AR")} ARS
                    </span>
                    <p className="text-[10px] font-normal text-text-muted mt-0.5">USDT {cartTotal.toFixed(2)} · @${arsRate.toLocaleString("es-AR")}</p>
                  </>
                ) : (
                  <>
                    <span className="text-green-400">USDT {cartTotal.toFixed(2)}</span>
                    {arsRate && (
                      <p className="text-[10px] font-normal text-text-muted mt-0.5">
                        ≈ ${(cartTotal * arsRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {!meetsMinimum && (
            <p className="mt-3 rounded-xl bg-yellow-500/10 px-4 py-2.5 text-xs text-yellow-400 text-center">
              {paymentMethod === "ars" && arsRate
                ? `⚠️ Mínimo $${Math.round(MIN_USDT * arsRate).toLocaleString("es-AR")} ARS (tenés $${Math.round(cartTotalBase * arsRate).toLocaleString("es-AR")})`
                : `⚠️ Mínimo USDT ${MIN_USDT} (total actual: USDT ${cartTotalBase.toFixed(2)})`
              }
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !meetsMinimum}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold tracking-wider text-white hover:bg-green-700 disabled:opacity-50 transition-all"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            {loading ? "PROCESANDO..." : "FINALIZAR EN WHATSAPP"}
          </button>
          <button type="button" onClick={() => clearCartMay()} className="mt-3 w-full text-center text-xs text-text-muted hover:text-red-400 transition-colors">Vaciar carrito</button>
          <Link href="/mayoristas/tienda" className="mt-2 block text-center text-xs text-violet-light hover:text-violet">← Seguir comprando</Link>
        </div>
      </form>
    </div>
  );
}
