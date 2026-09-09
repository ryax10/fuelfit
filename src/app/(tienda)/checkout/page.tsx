"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Printer, ChevronRight, Copy, Check } from "lucide-react";
import { useDB, getCart, clearCart } from "@/lib/local-db";
import { createClient } from "@/lib/supabase/client";
import { createOrderAction } from "@/app/(tienda)/actions";
import { validateDiscountCodeAction, useDiscountCodeAction } from "@/app/admin/actions";
import type { Product, OrderItem } from "@/lib/local-db/types";

type Discount = { amount: number; currency: "ARS" | "USD"; code: string };

interface ReceiptItem {
  brand: string;
  model: string;
  flavor: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

function groupByBrandModel(items: ReceiptItem[]) {
  const groups: Map<string, ReceiptItem[]> = new Map();
  for (const item of items) {
    const key = `${item.brand}|${item.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function buildWhatsAppText(
  orderNumber: number,
  items: ReceiptItem[],
  customerName: string,
  customerPhone: string,
  delivery: "retiro" | "envio",
  address: string,
  payment: string,
  notes: string,
  subtotal: number,
  discount: Discount | null,
  arsRate: number | null,
  total: number,
): string {
  const groups = groupByBrandModel(items);
  const lines: string[] = [`*Pedido #${orderNumber} — FuelFit*`, ``];

  for (const [key, groupItems] of groups) {
    const [brand, model] = key.split("|");
    lines.push(`  *${brand.toUpperCase()} ${model.toUpperCase()}*`);
    for (const item of groupItems) {
      const label = (item.flavor && item.flavor !== item.model ? item.flavor : item.model).toLowerCase();
      lines.push(`  ${item.qty} ${label}  —  $${item.subtotal.toLocaleString("es-AR")}`);
    }
    lines.push(``);
  }

  if (discount) {
    if (discount.currency === "ARS") {
      lines.push(`  Subtotal: $${subtotal.toLocaleString("es-AR")}`);
      lines.push(`  Descuento (${discount.code}): - $${discount.amount.toLocaleString("es-AR")}`);
    } else {
      const usdToArs = arsRate ? Math.round(discount.amount * arsRate) : 0;
      lines.push(`  Subtotal: $${subtotal.toLocaleString("es-AR")}`);
      lines.push(`  Descuento (${discount.code}): - USDT ${discount.amount.toFixed(2)}${usdToArs ? ` (≈ $${usdToArs.toLocaleString("es-AR")})` : ""}`);
    }
  }
  lines.push(`  *TOTAL: $${total.toLocaleString("es-AR")}*`);
  lines.push(`  Pago: ${payment === "cash" ? "Efectivo" : "Transferencia"}`);
  if (delivery === "retiro") lines.push(`  Retiro — Lun a Sáb 10 a 18 hs`);
  else lines.push(`  Envio a: ${address}`);
  if (notes) lines.push(`  Nota: ${notes}`);
  lines.push(`  ${customerName} · ${customerPhone}`);
  return lines.join("\n");
}

interface ReceiptProps {
  orderNumber: number;
  items: ReceiptItem[];
  customerName: string;
  customerPhone: string;
  delivery: "retiro" | "envio";
  address: string;
  payment: string;
  notes: string;
  subtotal: number;
  discount: Discount | null;
  arsRate: number | null;
  total: number;
  waUrl: string;
  waText: string;
}

function Receipt({ orderNumber, items, customerName, customerPhone, delivery, address, payment, notes, subtotal, discount, arsRate, total, waUrl, waText }: ReceiptProps) {
  const groups = groupByBrandModel(items);
  const now = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const discountArs = discount
    ? (discount.currency === "ARS"
        ? discount.amount
        : (arsRate ? Math.round(discount.amount * arsRate) : 0))
    : 0;
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

      {/* Recibo */}
      <div id="receipt" className="rounded-2xl border border-border bg-bg-card p-6 print:border-0 print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-5 pb-5 border-b border-border">
          <div>
            <p className="font-display text-xl font-bold text-text-primary">FuelFit</p>
            <p className="text-xs text-text-muted mt-0.5">L a S 10 a 18 hs</p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-violet">#{orderNumber}</p>
            <p className="text-xs text-text-muted mt-0.5">{now}</p>
          </div>
        </div>

        {/* Cliente */}
        <div className="mb-4 text-sm">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">CLIENTE</p>
          <p className="font-semibold text-text-primary">{customerName}</p>
          <p className="text-text-muted">{customerPhone}</p>
        </div>

        {/* Productos agrupados */}
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
                    <p className="text-xs font-semibold text-text-secondary">${groupSubtotal.toLocaleString("es-AR")}</p>
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
                        <span className="font-semibold text-text-primary">${item.subtotal.toLocaleString("es-AR")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="border-t-2 border-border pt-4 space-y-2 text-sm">
          {discount && (
            <>
              <div className="flex justify-between text-text-muted">
                <span>Subtotal</span>
                <span className="line-through">${subtotal.toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between text-green-400">
                <span>Descuento ({discount.code})</span>
                <span>− ${discountArs.toLocaleString("es-AR")}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-text-primary">TOTAL</span>
            <span className="font-display text-2xl font-bold text-text-primary">${total.toLocaleString("es-AR")}</span>
          </div>
          <div className="mt-3 space-y-1 text-xs text-text-muted">
            <p>💳 {payment === "cash" ? "Efectivo" : "Transferencia"}</p>
            {delivery === "retiro"
              ? <p>📍 Retiro — Lun a Sáb 10 a 18 hs</p>
              : <p>🚚 Envío a: {address}</p>
            }
            {notes && <p>📝 {notes}</p>}
          </div>
        </div>
      </div>

      {/* CSS de impresión */}
      <style>{`
        @media print {
          body > *:not(#__next) { display: none; }
          #receipt { display: block !important; border: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      <div className="mt-4 text-center print:hidden">
        <Link href="/productos" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
          Seguir comprando →
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const cart = useDB(useCallback(() => getCart(), []));
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [delivery, setDelivery] = useState<"retiro" | "envio">("retiro");
  const [payment, setPayment] = useState<"cash" | "transfer">("cash");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [receiptSubtotal, setReceiptSubtotal] = useState(0);
  const [receiptDiscount, setReceiptDiscount] = useState<Discount | null>(null);
  const [receiptArsRate, setReceiptArsRate] = useState<number | null>(null);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [waUrl, setWaUrl] = useState<string>("");
  const [waText, setWaText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [outOfStockModal, setOutOfStockModal] = useState<string[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState("5491172000525");
  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [arsRate, setArsRate] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("products").select("*").eq("visible", true)
      .then(({ data }) => setProducts((data || []) as Product[]));
    supabase.from("config").select("value").eq("key", "whatsapp").single()
      .then(({ data }) => { if (data?.value) setWaPhone(data.value.replace(/\D/g, "")); });
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata) {
        const meta = data.user.user_metadata;
        if (meta.full_name) setName(meta.full_name);
        if (meta.phone) setPhone(meta.phone);
      }
    });
    fetch("/api/fx").then(r => r.json()).then(j => { if (j?.rate) setArsRate(j.rate); }).catch(() => {});
  }, []);

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

  const effectivePayment = delivery === "envio" ? "transfer" : payment;

  const cartItems = cart.map(c => {
    const p = products.find(pr => pr.id === c.product_id);
    return p ? { ...c, product: p } : null;
  }).filter(Boolean) as { product_id: string; qty: number; unit_price_override?: number; product: Product }[];

  const getUnitPrice = (item: { product: Product; unit_price_override?: number }) =>
    item.unit_price_override ?? item.product.price_min_ars;
  const subtotal = cartItems.reduce((s, i) => s + getUnitPrice(i) * i.qty, 0);
  const discountArs = discount
    ? (discount.currency === "ARS"
        ? discount.amount
        : (arsRate ? Math.round(discount.amount * arsRate) : 0))
    : 0;
  const total = Math.max(0, subtotal - discountArs);

  if (done) {
    const fullAddress = delivery === "envio" ? `${address}, ${city}` : "";
    return (
      <Receipt
        orderNumber={done}
        items={receiptItems}
        customerName={name}
        customerPhone={phone}
        delivery={delivery}
        address={fullAddress}
        payment={effectivePayment}
        notes={notes}
        subtotal={receiptSubtotal}
        discount={receiptDiscount}
        arsRate={receiptArsRate}
        total={receiptTotal}
        waUrl={waUrl}
        waText={waText}
      />
    );
  }

  if (cartItems.length === 0) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-text-muted">Tu carrito está vacío</p>
      <Link href="/productos" className="mt-4 inline-block text-violet-light hover:text-violet">← Ir al catálogo</Link>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    if (delivery === "envio" && (!address || !city)) return;
    setLoading(true);
    // Abrir ventana sincronicamente con el click — necesario para evitar popup blockers
    // despues del await. Si el navegador la bloquea o esta dentro de un webview, queda null
    // y caemos al boton manual del recibo.
    const waWindow = window.open("about:blank", "_blank");
    setSubmitError(null);
    try {
      const fullAddress = delivery === "envio" ? `${address}, ${city}` : "Retiro por nuestras oficinas";
      const orderNotes = [notes, delivery === "retiro" ? "[RETIRO]" : "[ENVÍO]", effectivePayment === "cash" ? "[EFECTIVO]" : "[TRANSFERENCIA]"].filter(Boolean).join(" ");
      const result = await createOrderAction({
        type: "retail",
        customer_name: name,
        customer_phone: phone,
        customer_address: fullAddress,
        payment_method: effectivePayment,
        notes: orderNotes,
        items: cartItems.map(i => ({ product_id: i.product_id, qty: i.qty, unit_price_override: i.unit_price_override })),
        discount_code: discount?.code,
        fx_rate_at_apply: arsRate ?? undefined,
      });
      if ("success" in result && result.success === false) {
        waWindow?.close();
        setOutOfStockModal(result.outOfStock);
        return;
      }
      const orderResult = result as { id: string; number: number; items: OrderItem[] };
      if (discount) {
        try { await useDiscountCodeAction(discount.code, orderResult.id); } catch {}
      }

      const rItems: ReceiptItem[] = orderResult.items.map(item => {
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
      const rSubtotal = rItems.reduce((s, i) => s + i.subtotal, 0);
      const rDiscountArs = discount
        ? (discount.currency === "ARS"
            ? discount.amount
            : (arsRate ? Math.round(discount.amount * arsRate) : 0))
        : 0;
      const rTotal = Math.max(0, rSubtotal - rDiscountArs);

      const text = buildWhatsAppText(
        orderResult.number, rItems, name, phone,
        delivery, delivery === "envio" ? `${address}, ${city}` : "",
        effectivePayment, notes, rSubtotal, discount, arsRate, rTotal,
      );
      const url = `https://api.whatsapp.com/send/?phone=${waPhone}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;

      // Redirect inmediato — antes de cualquier setState para minimizar delay percibido
      if (waWindow && !waWindow.closed) {
        try { waWindow.location.href = url; } catch { /* webview puede bloquear el set */ }
      } else {
        window.open(url, "_blank");
      }

      clearCart();
      setReceiptItems(rItems);
      setReceiptSubtotal(rSubtotal);
      setReceiptDiscount(discount);
      setReceiptArsRate(arsRate);
      setReceiptTotal(rTotal);
      setWaUrl(url);
      setWaText(text);
      setDone(orderResult.number);
    } catch {
      waWindow?.close();
      setSubmitError("Ocurrió un error al procesar tu pedido. Por favor, intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {outOfStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-red-400 mb-2">Sin stock disponible</h2>
            <p className="text-sm text-text-secondary mb-3">Los siguientes productos se agotaron mientras armabas tu pedido:</p>
            <ul className="mb-4 space-y-1">
              {outOfStockModal.map((n, i) => <li key={i} className="text-sm font-medium text-text-primary">• {n}</li>)}
            </ul>
            <p className="text-xs text-text-muted mb-4">Por favor, editá tu carrito y volvé a intentarlo.</p>
            <div className="flex gap-3">
              <Link href="/carrito" className="flex-1 rounded-xl border border-border px-4 py-2.5 text-center text-sm font-bold text-text-secondary hover:bg-bg-hover transition-all">Editar carrito</Link>
              <button type="button" onClick={() => setOutOfStockModal(null)} className="flex-1 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-dark transition-all">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-1.5 text-sm text-text-muted">
        <Link href="/carrito" className="hover:text-text-secondary transition-colors">Carrito</Link>
        <ChevronRight size={14} />
        <span className="text-text-primary font-medium">Checkout</span>
      </div>

      <h1 className="font-display text-2xl font-bold mb-6">Finalizar pedido</h1>
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5">
          {/* Contacto */}
          <div className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">Datos de contacto</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1.5">Nombre y Apellido *</label>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Juan Perez" className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1.5">Teléfono *</label>
                <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 9 11 1234-5678" className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" />
              </div>
            </div>
          </div>

          {/* Entrega */}
          <div className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">Entrega</h2>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDelivery("retiro")} className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${delivery === "retiro" ? "border-violet bg-violet/10 text-violet-light" : "border-border text-text-muted hover:bg-bg-hover"}`}>📍 Retiro</button>
              <button type="button" onClick={() => { setDelivery("envio"); setPayment("transfer"); }} className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${delivery === "envio" ? "border-violet bg-violet/10 text-violet-light" : "border-border text-text-muted hover:bg-bg-hover"}`}>🚚 Envío</button>
            </div>
            {delivery === "retiro" && <p className="text-sm text-text-muted">Lunes a Sábados de 10 a 18 hs.</p>}
            {delivery === "envio" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-text-secondary block mb-1.5">Dirección *</label>
                  <input required value={address} onChange={e => setAddress(e.target.value)} placeholder="Calle 1234, Piso 2" className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary block mb-1.5">Ciudad *</label>
                  <input required value={city} onChange={e => setCity(e.target.value)} placeholder="Buenos Aires" className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* Pago */}
          <div className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">Forma de pago</h2>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPayment("transfer")} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${effectivePayment === "transfer" ? "border-violet bg-violet/10 text-violet-light" : "border-border text-text-muted hover:bg-bg-hover"}`}>🏦 Transferencia</button>
              {delivery !== "envio" && (
                <button type="button" onClick={() => setPayment("cash")} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${effectivePayment === "cash" ? "border-violet bg-violet/10 text-violet-light" : "border-border text-text-muted hover:bg-bg-hover"}`}>💵 Efectivo</button>
              )}
            </div>
            {delivery === "envio" && <p className="text-xs text-yellow-400">⚠️ Los envíos solo se abonan por transferencia.</p>}
          </div>

          {/* Notas */}
          <div className="rounded-2xl border border-border bg-bg-card p-5 sm:p-6">
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">Observaciones (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Algo que necesites aclarar..." className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 outline-none" />
          </div>
        </div>

        {/* Resumen */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-bg-card p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold mb-4">Resumen</h2>
          <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
            {/* Agrupado por marca/modelo */}
            {Array.from(groupByBrandModel(cartItems.map(item => ({
              brand: item.product.brand,
              model: item.product.model,
              flavor: item.product.flavor || item.product.model,
              qty: item.qty,
              unitPrice: getUnitPrice(item),
              subtotal: getUnitPrice(item) * item.qty,
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
                        <span className="shrink-0">${item.subtotal.toLocaleString("es-AR")}</span>
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
                <p className="text-[10px] text-text-muted">
                  {discount.code} — {discount.currency === "ARS"
                    ? `$ ${discount.amount.toLocaleString("es-AR")}`
                    : `USDT ${discount.amount.toFixed(2)}${arsRate ? ` (≈ $${Math.round(discount.amount * arsRate).toLocaleString("es-AR")})` : ""}`}
                </p>
              </div>
              <button type="button" onClick={() => { setDiscount(null); setDiscountCode(""); }} className="text-[10px] text-text-muted hover:text-red-400 transition-colors">Quitar</button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm">
            {discount && (
              <>
                <div className="flex justify-between text-text-muted">
                  <span>Subtotal</span>
                  <span className="line-through">${subtotal.toLocaleString("es-AR")}</span>
                </div>
                <div className="flex justify-between text-green-400">
                  <span>Descuento</span>
                  <span>− ${discountArs.toLocaleString("es-AR")}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-bold pt-1">
              <span>Total</span>
              <span>${total.toLocaleString("es-AR")}</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            <p>{delivery === "retiro" ? "📍 Retiro" : "🚚 Envío"} · {effectivePayment === "cash" ? "💵 Efectivo" : "🏦 Transferencia"}</p>
          </div>
          {submitError && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 text-center">{submitError}</p>
          )}
          <button type="submit" disabled={loading} className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold tracking-wider text-white hover:bg-green-700 disabled:opacity-50 transition-all">
            <MessageCircle size={16} /> {loading ? "PROCESANDO..." : "FINALIZAR EN WHATSAPP"}
          </button>
          <p className="mt-3 text-[10px] text-text-muted text-center">Al confirmar se abre WhatsApp con el detalle del pedido</p>
        </div>
      </form>
    </div>
  );
}
