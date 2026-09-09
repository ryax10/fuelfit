"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { Copy, Check, MessageCircle, Plus, Trash2, Pencil, History } from "lucide-react";
import { getOrderByIdAction, getOrderItemsAction, confirmOrderAction, confirmExchangeAction, cancelOrderAction, getOrderPaymentsAction, getCustomerDebtBalanceAction, getConfigAction, getProductsAction, editPendingOrderAction, editConfirmedOrderAction, getAuditLogsAction, mergeCustomersAction } from "@/app/admin/actions";
import type { Order, OrderItem, CashMovement, AuditLog, Product } from "@/lib/local-db/types";

type OrderItemWithCost = OrderItem & { unit_cost: number; brand: string; model: string; flavor: string };
import type { Debt } from "@/app/admin/actions";

type PaymentRow = { id: number; caja: string; currency: "ARS" | "USD"; amount: string };
type EditItem = { product_id: string; product_sku: string; product_name: string; qty: number; unit_price: number };

function buildWhatsApp(order: Order, items: OrderItemWithCost[]): string {
  const isWholesale = order.type === "wholesale";
  const sym = isWholesale ? "USDT" : "$";
  const fmt = (n: number) => isWholesale ? n.toFixed(2) : n.toLocaleString("es-AR");

  // Agrupar por brand + model
  const groups: Map<string, OrderItemWithCost[]> = new Map();
  for (const item of items) {
    const key = `${item.brand}|${item.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const lines: string[] = [
    `*Pedido${isWholesale ? " Mayorista" : ""} #${order.number} — FuelFit*`,
    ``,
  ];

  for (const [key, groupItems] of groups) {
    const [brand, model] = key.split("|");
    lines.push(`  *${brand.toUpperCase()} ${model.toUpperCase()}*`);
    for (const item of groupItems) {
      const label = (item.flavor && item.flavor !== item.model ? item.flavor : item.model).toLowerCase();
      lines.push(`  ${item.qty} ${label}  —  ${sym} ${fmt(item.subtotal)}`);
    }
    lines.push(``);
  }

  lines.push(`  *TOTAL: ${sym} ${fmt(order.total)}*`);
  if (order.payment_method) lines.push(`  Pago: ${order.payment_method === "cash" ? "Efectivo" : order.payment_method === "transfer" ? "Transferencia" : order.payment_method}`);
  if (order.customer_address && !order.customer_address.toLowerCase().includes("retiro")) lines.push(`  Envio a: ${order.customer_address}`);
  else lines.push(`  Retiro — L a S 10 a 18 hs`);
  if (order.notes) lines.push(`  Nota: ${order.notes}`);
  lines.push(`  ${order.customer_name} · ${order.customer_phone}`);
  return lines.join("\n");
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItemWithCost[]>([]);
  const [payments, setPayments] = useState<{ movements: CashMovement[]; debts: Debt[] }>({ movements: [], debts: [] });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [fxRate, setFxRate] = useState(1000);
  const [cancelModal, setCancelModal] = useState(false);
  const [exchangeModal, setExchangeModal] = useState(false);
  const [cajas, setCajas] = useState<string[]>(["Oficina", "Luciano", "Santiago"]);
  const [duplicateWarning, setDuplicateWarning] = useState<{ type: "phone" | "name"; customer: { id: string; name: string; phone: string } } | null>(null);

  // Fecha de cobro (default hoy, modificable para cargar cobros atrasados)
  const [confirmedDate, setConfirmedDate] = useState(new Date().toISOString().split("T")[0]);

  // Filas de pago multi-moneda
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const nextId = useRef(2);

  // Deudas previas del cliente
  const [existingBalance, setExistingBalance] = useState<{ receivableARS: number; receivableUSD: number; payableARS: number; payableUSD: number } | null>(null);

  // Edición de pedido pendiente
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editDiscount, setEditDiscount] = useState("");
  const [editSurcharge, setEditSurcharge] = useState("");
  const [editSurchargeNote, setEditSurchargeNote] = useState("");
  const [editReason, setEditReason] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    const [o, its, pay, cfg] = await Promise.all([
      getOrderByIdAction(id), getOrderItemsAction(id), getOrderPaymentsAction(id), getConfigAction(),
    ]);
    setOrder(o);
    setItems(its);
    setPayments(pay);
    const fx = parseFloat(cfg["fx_usdt_ars"] || "1000");
    setFxRate(fx);
    // Leer cajas desde config
    try {
      const cajasRaw = cfg["cajas"];
      if (cajasRaw) {
        const parsed = JSON.parse(cajasRaw);
        if (Array.isArray(parsed) && parsed.length > 0) setCajas(parsed);
      }
    } catch { /* mantener default */ }
    if (o) {
      const defaultCurrency: "ARS" | "USD" = o.type === "wholesale" ? "USD" : "ARS";
      const defaultCaja = cfg["default_caja"] || "Oficina";
      setPaymentRows([{ id: 1, caja: defaultCaja, currency: defaultCurrency, amount: String(o.total) }]);
      if (o.status === "pending") {
        const bal = await getCustomerDebtBalanceAction(o.customer_id || null, o.customer_name);
        setExistingBalance(bal);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="py-16 text-center text-text-muted text-sm">Cargando...</div>;
  if (!order) return <div className="py-16 text-center text-text-muted">Pedido no encontrado <Link href="/admin/sales" className="text-violet-light">← Volver</Link></div>;

  const handleCopy = () => {
    navigator.clipboard.writeText(buildWhatsApp(order, items));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const addPaymentRow = () => {
    const orderCurrency: "ARS" | "USD" = order?.type === "wholesale" ? "USD" : "ARS";
    setPaymentRows(prev => [...prev, { id: nextId.current++, caja: "Oficina", currency: orderCurrency, amount: "" }]);
  };

  const removePaymentRow = (rowId: number) => {
    setPaymentRows(prev => prev.filter(r => r.id !== rowId));
  };

  const updateRow = (rowId: number, field: keyof PaymentRow, value: string) => {
    setPaymentRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const handleConfirm = async () => {
    const validPayments = paymentRows
      .map(r => ({ caja: r.caja, currency: r.currency, amount: parseFloat(r.amount) || 0 }))
      .filter(p => p.amount > 0);
    if (validPayments.length === 0) {
      const ok = confirm(`¿Confirmar la venta sin cobrar? Se va a generar una deuda completa por ${order?.type === "wholesale" ? "U$D" : "$"} ${order?.total.toLocaleString()}.`);
      if (!ok) return;
    }
    setActing(true);
    try {
      const result = await confirmOrderAction(id, validPayments, fxRate, `${confirmedDate}T12:00:00.000Z`);
      if (result && "duplicateWarning" in result && result.duplicateWarning) {
        setDuplicateWarning(result.duplicateWarning as { type: "phone" | "name"; customer: { id: string; name: string; phone: string } });
      }
      await load();
    } catch (err) {
      alert("Error al confirmar: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setActing(false);
    }
  };

  const handleExchange = async () => {
    setExchangeModal(false);
    setActing(true);
    try {
      await confirmExchangeAction(id);
      await load();
    } catch (err) {
      alert("Error al marcar como cambio: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async (reverseCash: boolean) => {
    setCancelModal(false);
    setActing(true);
    try {
      await cancelOrderAction(id, reverseCash);
      await load();
    } catch (err) {
      alert("Error al cancelar: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setActing(false);
    }
  };

  // Usar el teléfono del cliente para abrir el chat (no un número hardcodeado)
  const customerPhoneE164 = order.customer_phone?.replace(/\D/g, "") || "";
  const waUrl = `https://wa.me/${customerPhoneE164}?text=${encodeURIComponent(buildWhatsApp(order, items))}`;
  const orderCurrency: "ARS" | "USD" = order.type === "wholesale" ? "USD" : "ARS";
  const sym = orderCurrency === "USD" ? "U$D" : "$";

  // Total cobrado normalizado a la moneda del pedido
  const totalPaidNormalized = paymentRows.reduce((sum, r) => {
    const amt = parseFloat(r.amount) || 0;
    if (amt <= 0) return sum;
    if (r.currency === orderCurrency) return sum + amt;
    return orderCurrency === "ARS" ? sum + amt * fxRate : sum + amt / fxRate;
  }, 0);
  const remaining = order.total - totalPaidNormalized;

  // Balance previo del cliente en la moneda del pedido
  const prevRec = existingBalance ? (orderCurrency === "USD" ? existingBalance.receivableUSD : existingBalance.receivableARS) : 0;
  const prevPay = existingBalance ? (orderCurrency === "USD" ? existingBalance.payableUSD : existingBalance.payableARS) : 0;
  const prevNet = prevRec - prevPay;

  return (
    <div>
      {/* Banner de posible duplicado */}
      {duplicateWarning && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm text-yellow-300">
            <span className="font-bold">Posible duplicado:</span> Existe un cliente &quot;{duplicateWarning.customer.name}&quot; con el mismo {duplicateWarning.type === "phone" ? "teléfono" : "nombre"}.
            ¿Es la misma persona? Si sí, podés unificarlos para que las deudas y pedidos queden en una sola cuenta.
          </p>
          <div className="flex gap-2 shrink-0">
            <button onClick={async () => {
              if (!order.customer_id) { alert("Este pedido no tiene cliente asignado todavía"); return; }
              const ok = confirm(`¿Unificar este cliente con "${duplicateWarning.customer.name}"?\n\nSe reasignarán todos los pedidos y deudas al cliente "${duplicateWarning.customer.name}", y se borrará el otro registro.`);
              if (!ok) return;
              try {
                // El "source" es el cliente del pedido actual, el "target" es el duplicado encontrado
                await mergeCustomersAction(order.customer_id, duplicateWarning.customer.id, "Unificación desde banner de pedido");
                setDuplicateWarning(null);
                await load();
              } catch (err) {
                alert("Error al unificar: " + (err instanceof Error ? err.message : "Error desconocido"));
              }
            }} className="rounded-lg bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 text-xs font-bold text-yellow-200 hover:bg-yellow-500/30 transition-all">
              Unificar con {duplicateWarning.customer.name}
            </button>
            <Link href={`/admin/customers`} className="rounded-lg border border-yellow-500/40 px-3 py-1 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/20 transition-all">
              Ver clientes
            </Link>
            <button onClick={() => setDuplicateWarning(null)} className="text-yellow-400/60 hover:text-yellow-300 text-xs px-1" title="Son personas distintas, ignorar">✕</button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/admin/sales" className="text-xs text-violet-light hover:text-violet">← Volver a pedidos</Link>
          <h1 className="font-display text-2xl font-bold mt-1">Pedido #{order.number}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(order.status === "pending" || order.status === "confirmed") && !editing && (
            <button onClick={async () => {
              if (order.status === "pending" && allProducts.length === 0) {
                try { const ps = await getProductsAction(); setAllProducts(ps); } catch {}
              }
              setEditItems(items.map(i => ({ product_id: i.product_id, product_sku: i.product_sku, product_name: i.product_name, qty: i.qty, unit_price: i.unit_price })));
              setEditDiscount(String(order.discount_amount || 0));
              setEditSurcharge(String(order.surcharge_amount || 0));
              setEditSurchargeNote(order.surcharge_note || "");
              setEditReason("");
              setEditing(true);
            }} className="flex items-center gap-2 rounded-xl border border-violet/40 bg-violet/10 px-4 py-2.5 text-sm text-violet-light hover:bg-violet/20 transition-all">
              <Pencil size={14} /> {order.status === "pending" ? "Editar pedido" : "Editar descuento/recargo"}
            </button>
          )}
          <button onClick={async () => {
            const next = !showAudit;
            setShowAudit(next);
            if (next && auditLogs.length === 0) {
              try { const logs = await getAuditLogsAction("order", id); setAuditLogs(logs); } catch {}
            }
          }} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all" title="Historial de ediciones">
            <History size={14} /> Historial
          </button>
          <button onClick={handleCopy} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all">
            {copied ? <><Check size={14} className="text-green-400" /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-green-600/30 px-4 py-2.5 text-sm text-green-400 hover:bg-green-600/10 transition-all">
            <MessageCircle size={14} /> WhatsApp
          </a>
        </div>
      </div>

      {showAudit && (
        <div className="mb-4 rounded-xl border border-border bg-bg-card p-4">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-2">HISTORIAL DE EDICIONES</p>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-text-muted">Sin ediciones registradas.</p>
          ) : (
            <div className="space-y-1.5">
              {auditLogs.map(log => (
                <div key={log.id} className="text-xs">
                  <span className="text-text-muted">{new Date(log.created_at).toLocaleString()}</span>
                  <span className="ml-2 rounded bg-violet/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-light">{log.action}</span>
                  {log.actor && <span className="ml-2 text-text-secondary">{log.actor}</span>}
                  <span className="ml-2 text-text-secondary">{log.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (order.status === "pending" || order.status === "confirmed") && (() => {
        const isPending = order.status === "pending";
        const subtotal = isPending
          ? editItems.reduce((s, i) => s + i.qty * i.unit_price, 0)
          : items.reduce((s, i) => s + i.subtotal, 0);
        const disc = parseFloat(editDiscount) || 0;
        const surc = parseFloat(editSurcharge) || 0;
        const newTotal = Math.max(0, subtotal - disc + surc);
        const oldTotal = order.total;
        const delta = newTotal - oldTotal;
        const sym2 = order.type === "wholesale" ? "U$D" : "$";
        const visibleProds = allProducts.filter(p => p.visible);
        return (
          <div className="mb-6 rounded-xl border border-violet/40 bg-violet/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold tracking-wider text-violet-light">
                {isPending ? "EDITAR PEDIDO PENDIENTE" : "EDITAR DESCUENTO/RECARGO (CONFIRMADO)"}
              </p>
              <button onClick={() => setEditing(false)} className="text-xs text-text-muted hover:text-text-primary">✕ Cerrar</button>
            </div>

            {!isPending && (
              <p className="mb-4 text-xs text-text-muted">
                El pedido ya está confirmado. Solo podés ajustar descuento y recargo. El cambio en el total se reflejará automáticamente en la deuda asociada y en ganancias.
              </p>
            )}

            {isPending && (
              <div className="space-y-2 mb-4">
                {editItems.map((it, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2">
                    <span className="text-xs text-text-muted w-5 text-right">{idx + 1}.</span>
                    <span className="flex-1 min-w-[180px] text-sm">{it.product_name} <span className="text-text-muted">({it.product_sku})</span></span>
                    <input type="number" min={1} value={it.qty}
                      onChange={e => setEditItems(prev => prev.map((p, i) => i === idx ? { ...p, qty: Math.max(1, parseInt(e.target.value) || 1) } : p))}
                      className="w-16 rounded-lg border border-border bg-bg-card px-2 py-1 text-xs text-center" />
                    <span className="text-xs text-text-muted">×</span>
                    <input type="number" min={0} step="0.01" value={it.unit_price}
                      onChange={e => setEditItems(prev => prev.map((p, i) => i === idx ? { ...p, unit_price: parseFloat(e.target.value) || 0 } : p))}
                      className="w-24 rounded-lg border border-border bg-bg-card px-2 py-1 text-xs text-right" />
                    <span className="text-xs text-text-muted w-24 text-right">{sym2} {(it.qty * it.unit_price).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
                    <button onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isPending && (
              <div className="mb-4">
                <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1">AGREGAR PRODUCTO</label>
                <select onChange={e => {
                  const pid = e.target.value;
                  if (!pid) return;
                  const p = visibleProds.find(x => x.id === pid);
                  if (!p) return;
                  const fallbackPrice = order.type === "wholesale" ? p.price_may_x15 : p.price_min_ars;
                  setEditItems(prev => prev.find(i => i.product_id === p.id)
                    ? prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i)
                    : [...prev, { product_id: p.id, product_sku: p.sku, product_name: p.name, qty: 1, unit_price: fallbackPrice }]);
                  e.target.value = "";
                }} className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm">
                  <option value="">Elegí un producto…</option>
                  {visibleProds.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — stock {p.stock_actual - p.stock_reservado}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div>
                <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1">DESCUENTO ({orderCurrency})</label>
                <input type="number" min={0} step="0.01" value={editDiscount} onChange={e => setEditDiscount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1">RECARGO ({orderCurrency})</label>
                <input type="number" min={0} step="0.01" value={editSurcharge} onChange={e => setEditSurcharge(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1">NOTA RECARGO</label>
                <input value={editSurchargeNote} onChange={e => setEditSurchargeNote(e.target.value)} placeholder="Ej: envío"
                  className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="rounded-lg bg-bg-secondary p-3 mb-4 text-sm space-y-0.5">
              <p className="flex justify-between"><span className="text-text-muted">Subtotal</span><span>{sym2} {subtotal.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span></p>
              {disc > 0 && <p className="flex justify-between text-green-400"><span>− Descuento</span><span>{sym2} {disc.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span></p>}
              {surc > 0 && <p className="flex justify-between text-yellow-400"><span>+ Recargo</span><span>{sym2} {surc.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span></p>}
              <p className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Nuevo total</span><span>{sym2} {newTotal.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span></p>
              {!isPending && Math.abs(delta) > 0.001 && (
                <p className={`text-xs pt-1 ${delta < 0 ? "text-green-400" : "text-yellow-400"}`}>
                  Cambio respecto al total original: {delta > 0 ? "+" : ""}{sym2} {delta.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  {delta < 0 ? " — la deuda receivable se ajusta a la baja (o queda saldo a favor si ya cobraste de más)" : " — se genera nueva deuda por la diferencia"}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1">MOTIVO DE EDICIÓN *</label>
              <input value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Ej: cliente cambió cantidades"
                className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm" />
            </div>

            <div className="flex gap-2">
              <button disabled={savingEdit || !editReason.trim() || (isPending && editItems.length === 0)} onClick={async () => {
                setSavingEdit(true);
                try {
                  if (isPending) {
                    await editPendingOrderAction(id, {
                      items: editItems.map(it => ({ product_id: it.product_id, product_sku: it.product_sku, product_name: it.product_name, qty: it.qty, unit_price: it.unit_price })),
                      discount_amount: parseFloat(editDiscount) || 0,
                      discount_currency: orderCurrency,
                      surcharge_amount: parseFloat(editSurcharge) || 0,
                      surcharge_note: editSurchargeNote,
                    }, editReason);
                  } else {
                    await editConfirmedOrderAction(id, {
                      discount_amount: parseFloat(editDiscount) || 0,
                      discount_currency: orderCurrency,
                      surcharge_amount: parseFloat(editSurcharge) || 0,
                      surcharge_note: editSurchargeNote,
                    }, editReason);
                  }
                  setEditing(false);
                  setAuditLogs([]); // refresh on demand
                  await load();
                } catch (err) {
                  alert("Error al editar: " + (err instanceof Error ? err.message : "Error desconocido"));
                } finally {
                  setSavingEdit(false);
                }
              }} className="rounded-xl bg-violet px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50">
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </button>
              <button onClick={() => setEditing(false)} className="rounded-xl border border-border px-5 py-2.5 text-sm text-text-muted hover:bg-bg-hover">Cancelar</button>
            </div>
          </div>
        );
      })()}

      {/* Panel de confirmación */}
      {order.status === "pending" && (
        <div className="mb-6 rounded-xl border border-border bg-bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-wider text-text-muted">CONFIRMAR VENTA</p>
            <p className="text-xs text-text-muted">Total del pedido: <span className="font-bold text-text-primary">{sym} {order.total.toLocaleString()}</span> · FX: ${fxRate.toLocaleString()}</p>
          </div>

          {/* Filas de pago */}
          <div className="space-y-2 mb-3">
            {paymentRows.map((row, idx) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted w-5 text-right">{idx + 1}.</span>
                <select value={row.caja} onChange={e => updateRow(row.id, "caja", e.target.value)}
                  className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none">
                  {cajas.map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={row.currency} onChange={e => updateRow(row.id, "currency", e.target.value)}
                  className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none">
                  <option value="ARS">ARS $</option>
                  <option value="USD">USD U$D</option>
                </select>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={row.amount}
                  onChange={e => updateRow(row.id, "amount", e.target.value)}
                  className="w-40 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none"
                />
                {row.currency !== orderCurrency && parseFloat(row.amount) > 0 && (
                  <span className="text-xs text-text-muted">
                    ≈ {sym} {(row.currency === "ARS"
                      ? parseFloat(row.amount) / fxRate
                      : parseFloat(row.amount) * fxRate
                    ).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </span>
                )}
                {paymentRows.length > 1 && (
                  <button onClick={() => removePaymentRow(row.id)} className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button onClick={addPaymentRow} className="flex items-center gap-1.5 text-xs text-violet-light hover:text-violet transition-colors mb-4">
            <Plus size={13} /> Agregar pago
          </button>

          {/* Resumen */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="rounded-lg bg-bg-secondary px-4 py-2 text-sm">
              <span className="text-text-muted text-xs">Cobrado: </span>
              <span className="font-bold text-green-400">{sym} {totalPaidNormalized.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
            </div>
            {Math.abs(remaining) > 0.01 && (
              <div className={`rounded-lg px-4 py-2 text-sm border ${remaining > 0 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <span className="text-xs text-text-muted">{remaining > 0 ? "Deuda a cobrar: " : "Saldo a favor del cliente: "}</span>
                <span className={`font-bold ${remaining > 0 ? "text-yellow-400" : "text-red-400"}`}>
                  {sym} {Math.abs(remaining).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                </span>
                {prevNet !== 0 && (
                  <span className="ml-2 text-xs text-text-muted">
                    {prevNet > 0 ? `(ya debía ${sym} ${prevNet.toLocaleString()} → neto ` : `(tenía crédito ${sym} ${Math.abs(prevNet).toLocaleString()} → neto `}
                    {(() => { const net = remaining + prevNet; return `${net >= 0 ? "" : "a favor "}${sym} ${Math.abs(net).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`; })()})
                  </span>
                )}
              </div>
            )}
            {Math.abs(remaining) <= 0.01 && totalPaidNormalized > 0 && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-2 text-sm text-green-400 font-bold">
                ✓ PAGO COMPLETO
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <label className="text-[10px] font-semibold tracking-wider text-text-muted whitespace-nowrap">FECHA DE COBRO</label>
            <input type="date" value={confirmedDate} onChange={e => setConfirmedDate(e.target.value)}
              className="rounded-xl border border-border bg-bg-card px-3 py-2 text-sm" />
            <span className="text-[10px] text-text-muted">Default: hoy. Cambiá si cobraste en otra fecha.</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={handleConfirm} disabled={acting} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-all">
              ✅ {acting ? "Confirmando..." : totalPaidNormalized <= 0 ? "Confirmar todo a deuda" : "Confirmar"}
            </button>
            <button onClick={() => setExchangeModal(true)} disabled={acting} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 transition-all" title="Confirmar como cambio/reposición sin cobro">
              🔄 Cambio
            </button>
            <button onClick={() => setCancelModal(true)} disabled={acting} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-all">
              ❌ Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className="rounded-xl border border-border bg-bg-card p-5 space-y-2">
          <h3 className="font-display text-sm font-bold text-text-muted">DATOS DEL PEDIDO</h3>
          <p className="text-sm">Estado: <Status s={order.status} /></p>
          <p className="text-sm">Tipo: <span className="font-semibold">{order.type === "wholesale" ? "Mayorista" : "Minorista"}</span></p>
          <p className="text-sm">Pago: {order.payment_method === "cash" ? "💵 Efectivo" : "🏦 Transferencia"}</p>
          <p className="text-sm">Fecha: {new Date(order.created_at).toLocaleString()}</p>
          {order.confirmed_at && <p className="text-sm text-green-400">Confirmado: {new Date(order.confirmed_at).toLocaleString()}</p>}
          {order.payment_status === "exchange" ? (
            <p className="text-sm">
              <span className="rounded-lg bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-400">🔄 CAMBIO / REPOSICIÓN</span>
              <span className="ml-2 text-text-muted text-xs">Sin cobro · pérdida a precio de costo</span>
            </p>
          ) : order.payment_status && order.payment_status !== "paid" && (
            <p className="text-sm text-yellow-400">Pago: {order.payment_status === "partial" ? "Parcial" : "Pendiente"}</p>
          )}
          {order.notes && <p className="text-sm text-text-muted">Notas: {order.notes}</p>}
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5 space-y-2">
          <h3 className="font-display text-sm font-bold text-text-muted">CLIENTE</h3>
          <p className="text-sm font-semibold">{order.customer_name}</p>
          <p className="text-sm text-text-muted">{order.customer_phone}</p>
          <p className="text-sm text-text-muted">{order.customer_address}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto mb-6">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border">{["SKU", "PRODUCTO", "CANT.", "COSTO UNIT.", "COSTO TOTAL", "PRECIO UNIT.", "SUBTOTAL"].map(c => <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>)}</tr></thead>
          <tbody>{items.map(i => (
            <tr key={i.id} className="border-b border-border">
              <td className="px-4 py-3 font-mono text-xs text-text-muted">{i.product_sku}</td>
              <td className="px-4 py-3 text-xs">{i.product_name}</td>
              <td className="px-4 py-3 text-xs text-center">{i.qty}</td>
              <td className="px-4 py-3 text-xs text-right text-orange-400">{i.unit_cost > 0 ? `U$D ${i.unit_cost.toLocaleString()}` : <span className="text-text-muted">—</span>}</td>
              <td className="px-4 py-3 text-xs text-right text-orange-400">{i.unit_cost > 0 ? `U$D ${(i.unit_cost * i.qty).toLocaleString()}` : <span className="text-text-muted">—</span>}</td>
              <td className="px-4 py-3 text-xs text-right">${i.unit_price.toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-right font-semibold">${i.subtotal.toLocaleString()}</td>
            </tr>
          ))}</tbody>
          <tfoot>
            {(() => {
              const totalCost = items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
              // Normalizar el total de la venta a USD para poder compararlo con el costo (siempre en USD)
              const totalUSD = order.type === "wholesale" ? order.total : order.total / fxRate;
              const margen = totalUSD - totalCost;
              const itemsSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
              const discount = order.discount_amount || 0;
              const surcharge = order.surcharge_amount || 0;
              const sym2 = order.type === "wholesale" ? "U$D" : "$";
              return (
                <>
                  {totalCost > 0 && (
                    <tr className="border-t border-border bg-bg-secondary/50">
                      <td colSpan={4} className="px-4 py-2 text-right text-xs text-text-muted">COSTO TOTAL</td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-orange-400">U$D {totalCost.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right text-xs text-text-muted">MARGEN BRUTO</td>
                      <td className={`px-4 py-2 text-right text-xs font-semibold ${margen >= 0 ? "text-green-400" : "text-red-400"}`}>
                        U$D {margen.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="ml-1 text-text-muted font-normal">({totalUSD > 0 ? ((margen / totalUSD) * 100).toFixed(0) : 0}%)</span>
                      </td>
                    </tr>
                  )}
                  {(discount > 0 || surcharge > 0) && (
                    <tr className="border-t border-border bg-bg-secondary/30">
                      <td colSpan={6} className="px-4 py-2 text-right text-xs text-text-muted">SUBTOTAL ITEMS</td>
                      <td className="px-4 py-2 text-right text-xs">{sym2} {itemsSubtotal.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {discount > 0 && (
                    <tr className="bg-bg-secondary/30">
                      <td colSpan={6} className="px-4 py-2 text-right text-xs text-green-400">
                        − DESCUENTO {order.discount_code ? `(${order.discount_code})` : ""}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-green-400">{sym2} {discount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {surcharge > 0 && (
                    <tr className="bg-bg-secondary/30">
                      <td colSpan={6} className="px-4 py-2 text-right text-xs text-yellow-400">
                        + RECARGO {order.surcharge_note ? `(${order.surcharge_note})` : ""}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-yellow-400">{sym2} {surcharge.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-border">
                    <td colSpan={6} className="px-4 py-3 text-right font-bold">TOTAL VENTA</td>
                    <td className="px-4 py-3 text-right font-display text-lg font-bold">${order.total.toLocaleString()}</td>
                  </tr>
                </>
              );
            })()}
          </tfoot>
        </table>
      </div>

      {/* Cancelar orden confirmada */}
      {order.status === "confirmed" && (
        <div className="mb-6 flex justify-end">
          <button onClick={() => setCancelModal(true)} disabled={acting} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-3 py-1.5 transition-colors">
            ❌ Cancelar venta
          </button>
        </div>
      )}

      {cancelModal && (
        <CancelModal
          onClose={() => setCancelModal(false)}
          onConfirm={handleCancel}
          hasPayments={payments.movements.length > 0}
        />
      )}

      {exchangeModal && (
        <ExchangeModal
          onClose={() => setExchangeModal(false)}
          onConfirm={handleExchange}
        />
      )}

      {/* Detalle de cobros — solo en órdenes confirmadas */}
      {order.status === "confirmed" && (payments.movements.length > 0 || payments.debts.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {payments.movements.length > 0 && (
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <p className="mb-3 text-[10px] font-semibold tracking-wider text-text-muted">COBROS REGISTRADOS</p>
              <div className="space-y-2">
                {payments.movements.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-bg-secondary px-4 py-3 text-sm">
                    <div>
                      <span className="font-semibold text-green-400">
                        {m.currency === "USD" ? "U$D" : "$"} {m.amount.toLocaleString()}
                      </span>
                      <span className="ml-2 text-xs text-text-muted">→ {m.caja}</span>
                    </div>
                    <span className="text-xs text-text-muted">{new Date(m.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {payments.debts.length > 0 && (
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <p className="mb-3 text-[10px] font-semibold tracking-wider text-text-muted">DEUDAS ASOCIADAS</p>
              <div className="space-y-2">
                {payments.debts.map(d => (
                  <div key={d.id} className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ${d.type === "receivable" ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-blue-500/10 border border-blue-500/20"}`}>
                    <div>
                      <span className={`text-xs font-bold uppercase ${d.type === "receivable" ? "text-yellow-400" : "text-blue-400"}`}>
                        {d.type === "receivable" ? "Nos debe" : "Saldo a favor"}
                      </span>
                      <p className={`font-semibold ${d.type === "receivable" ? "text-yellow-300" : "text-blue-300"}`}>
                        {d.currency === "USD" ? "U$D" : "$"} {(d.original_amount - d.paid_amount).toLocaleString()}
                        <span className="ml-1 text-xs font-normal text-text-muted">pendiente</span>
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${d.status === "paid" ? "bg-green-500/10 text-green-400" : d.status === "partial" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"}`}>
                      {d.status === "paid" ? "SALDADO" : d.status === "partial" ? "PARCIAL" : "PENDIENTE"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CancelModal({ onClose, onConfirm, hasPayments }: { onClose: () => void; onConfirm: (reverseCash: boolean) => void; hasPayments: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-2xl border border-border bg-bg-card p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="font-display text-lg font-bold mb-2">Cancelar venta</h3>
        <p className="text-sm text-text-muted mb-4">¿Estás seguro? Esta acción cancela el pedido y revierte el stock.</p>
        {hasPayments && (
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 mb-4 text-sm text-yellow-300">
            Este pedido tiene cobros registrados en caja. ¿También querés revertirlos?
          </div>
        )}
        <div className="flex flex-col gap-2">
          {hasPayments && (
            <button onClick={() => onConfirm(true)} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-all">
              Cancelar venta y revertir caja
            </button>
          )}
          <button onClick={() => onConfirm(false)} className="rounded-xl bg-red-600/80 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-all">
            {hasPayments ? "Cancelar venta sin revertir caja" : "Sí, cancelar venta"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all">
            No cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ExchangeModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-2xl border border-border bg-bg-card p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="font-display text-lg font-bold mb-2">Marcar como CAMBIO</h3>
        <p className="text-sm text-text-muted mb-4">
          Esto confirma la venta y descuenta stock, pero <span className="font-semibold text-orange-400">no registra cobro</span> ni genera deuda.
          El producto entregado se contabiliza como <span className="font-semibold text-red-400">pérdida a precio de costo</span> en P&L.
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onConfirm} className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 transition-all">
            🔄 Confirmar como cambio
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all">
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}

function Status({ s }: { s: string }) {
  const m: Record<string, string> = { pending: "bg-yellow-500/10 text-yellow-400", confirmed: "bg-green-500/10 text-green-400", cancelled: "bg-red-500/10 text-red-400" };
  return <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${m[s] || "text-text-muted"}`}>{s === "pending" ? "PENDIENTE" : s === "confirmed" ? "CONFIRMADO" : "CANCELADO"}</span>;
}
