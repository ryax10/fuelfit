"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { getPurchaseByIdAction, getPurchaseItemsAction, confirmPurchaseAction, cancelPurchaseAction, deletePurchaseAction } from "@/app/admin/actions";
import type { Purchase, PurchaseItem } from "@/app/admin/actions";

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [caja, setCaja] = useState("Oficina");
  const [currency, setCurrency] = useState<"ARS" | "USD">("USD");
  const [amountPaid, setAmountPaid] = useState("");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    const [p, its] = await Promise.all([getPurchaseByIdAction(id), getPurchaseItemsAction(id)]);
    setPurchase(p);
    setItems(its);
    if (p) {
      setCurrency(p.currency);
      setAmountPaid(String(Math.max(0, p.total - (p.paid_amount || 0))));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="py-16 text-center text-text-muted text-sm">Cargando...</div>;
  if (!purchase) return <div className="py-16 text-center text-text-muted">Compra no encontrada <Link href="/admin/purchases" className="text-violet-light">← Volver</Link></div>;

  const handleConfirm = async (type: "partial" | "received") => {
    const paid = parseFloat(amountPaid) || 0;
    setActing(true);
    try {
      const recDate = type === "received" ? `${receivedDate}T12:00:00+00:00` : undefined;
      await confirmPurchaseAction(id, type, caja, paid, currency, recDate);
      await load();
    } catch (err) {
      alert("Error al confirmar compra: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    const isReceived = purchase?.payment_status === "received";
    const msg = isReceived
      ? "¿Cancelar esta compra? Esto REVERTIRÁ el stock ingresado. Esta acción no se puede deshacer."
      : "¿Cancelar esta compra? Se revertirán los pagos registrados.";
    if (!confirm(msg)) return;
    setActing(true);
    try {
      await cancelPurchaseAction(id);
      await load();
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    setActing(true);
    try {
      await deletePurchaseAction(id);
      router.push("/admin/purchases");
    } finally {
      setActing(false);
    }
  };

  const paid = parseFloat(amountPaid) || 0;
  const alreadyPaid = purchase.paid_amount || 0;
  const pendingPayment = purchase.total - alreadyPaid;
  const remainingAfter = pendingPayment - paid;

  const isPending   = purchase.payment_status === "pending";
  const isPartial   = purchase.payment_status === "partial";
  const isReceived  = purchase.payment_status === "received";
  const isDone      = purchase.payment_status === "paid";
  const isCancelled = purchase.payment_status === "cancelled";

  const canAct = isPending || isPartial || isReceived;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/admin/purchases" className="text-xs text-violet-light hover:text-violet">← Volver a compras</Link>
          <h1 className="font-display text-2xl font-bold mt-1">Compra #{purchase.number}</h1>
        </div>
        <PurchaseStatusBadge s={purchase.payment_status} />
      </div>

      {/* Panel de confirmación */}
      {canAct && (
        <div className="mb-6 rounded-xl border border-border bg-bg-card p-5">
          <p className="mb-4 text-[10px] font-semibold tracking-wider text-text-muted">
            {isReceived ? "REGISTRAR PAGO PENDIENTE" : isPartial ? "CONFIRMAR RECEPCIÓN DE MERCADERÍA" : "CONFIRMAR COMPRA"}
          </p>

          {isReceived && (
            <div className="mb-4 rounded-xl bg-violet/10 border border-violet/20 px-4 py-3 text-sm text-violet-light">
              El stock ya fue actualizado. Aquí podés registrar el pago pendiente de <span className="font-bold">{purchase.currency} {pendingPayment.toFixed(2)}</span>.
            </div>
          )}

          {isPartial && (
            <div className="mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-300">
              Pago ya procesado: <span className="font-bold">{purchase.currency} {alreadyPaid.toFixed(2)}</span> de {purchase.currency} {purchase.total.toFixed(2)}.
              {pendingPayment > 0 && <> Queda pendiente: <span className="font-bold">{purchase.currency} {pendingPayment.toFixed(2)}</span>.</>}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">Fecha de recepción</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                className="rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">Caja</label>
              <select value={caja} onChange={e => setCaja(e.target.value)} className="rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none">
                <option>Oficina</option>
                <option>Luciano</option>
                <option>Santiago</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">Moneda pagada</label>
              <select value={currency} onChange={e => { setCurrency(e.target.value as "ARS" | "USD"); setAmountPaid("0"); }} className="rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none">
                <option value="USD">USD U$D</option>
                <option value="ARS">ARS $</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">
                Monto a pagar <span className="text-text-muted">(total: {purchase.currency} {purchase.total.toFixed(2)})</span>
              </label>
              <input
                type="number" min="0" step="0.01"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                className="w-44 rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none"
              />
            </div>

            {currency !== purchase.currency && paid > 0 && (
              <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 text-sm">
                <span className="text-orange-400 font-semibold">
                  Moneda diferente a la compra ({purchase.currency}). El saldo pendiente se calculará en {purchase.currency}.
                </span>
              </div>
            )}
            {currency === purchase.currency && remainingAfter > 0.01 && paid >= 0 && (
              <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-2.5 text-sm">
                <span className="text-yellow-400 font-semibold">
                  DEUDA A PAGAR: {currency === "USD" ? "U$D" : "$"} {remainingAfter.toFixed(2)}
                </span>
              </div>
            )}
            {currency === purchase.currency && remainingAfter < -0.01 && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5 text-sm">
                <span className="text-blue-400 font-semibold">
                  DEUDA A COBRAR: {currency === "USD" ? "U$D" : "$"} {Math.abs(remainingAfter).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex gap-2 ml-auto flex-wrap">
              {isPending && (
                <button
                  onClick={() => handleConfirm("partial")}
                  disabled={acting || paid <= 0}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  💳 {acting ? "Procesando..." : "Pago adelantado (en camino)"}
                </button>
              )}
              <button
                onClick={() => handleConfirm("received")}
                disabled={acting || (isReceived && paid <= 0)}
                className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                ✅ {acting ? "Procesando..." : isReceived ? "Registrar pago" : isPartial ? "Recibí mercadería" : "Confirmar recepción"}
              </button>
              {(isPending || isPartial || isReceived) && (
                <button
                  onClick={handleCancel}
                  disabled={acting}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-all"
                >
                  ❌ Cancelar
                </button>
              )}
            </div>
          </div>

          {isPending && (
            <p className="mt-3 text-xs text-text-muted">
              <span className="text-blue-400 font-semibold">Pago adelantado (en camino)</span> — registra el pago en caja, la compra queda en estado "En camino" hasta recibir la mercadería.<br />
              <span className="text-green-400 font-semibold">Confirmar recepción</span> — llegó la mercadería, actualiza el stock (también podés pagar acá si no hiciste pago adelantado).
            </p>
          )}
          {isReceived && (
            <p className="mt-3 text-xs text-text-muted">
              El stock ya fue sumado. Ingresá el monto a pagar y hacé clic en <span className="text-green-400 font-semibold">Registrar pago</span> para impactar en caja y saldar la deuda.
            </p>
          )}
        </div>
      )}

      {isDone && (
        <div className="mb-6 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-300">
          ✅ Compra confirmada — stock actualizado y pago procesado.
        </div>
      )}
      {isCancelled && (
        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          ❌ Compra cancelada.
        </div>
      )}

      <div className="rounded-xl border border-border bg-bg-card p-5 space-y-2 mb-6">
        <h3 className="font-display text-sm font-bold text-text-muted">DATOS DE LA COMPRA</h3>
        <p className="text-sm">Proveedor: <span className="font-semibold">{purchase.supplier}</span></p>
        <p className="text-sm">Moneda: <span className="font-semibold">{purchase.currency}</span></p>
        <p className="text-sm">
          Pago: <span className="font-semibold text-green-400">{purchase.currency} {alreadyPaid.toFixed(2)}</span>
          {" "}de <span className="font-semibold">{purchase.currency} {purchase.total.toFixed(2)}</span>
          {pendingPayment > 0.01 && <span className="ml-2 text-yellow-400 text-xs font-semibold">(pendiente: {purchase.currency} {pendingPayment.toFixed(2)})</span>}
        </p>
        <p className="text-sm">Fecha de compra: {new Date(purchase.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
        {purchase.received_at && (
          <p className="text-sm">Fecha de recepción: <span className="text-green-400 font-semibold">{new Date(purchase.received_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span></p>
        )}
        {purchase.note && <p className="text-sm text-text-muted">Nota: {purchase.note}</p>}
      </div>

      {/* Botón eliminar */}
      {!confirmDelete ? (
        <div className="mb-6 flex justify-end">
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:text-red-300 transition-colors border border-red-500/20 rounded-lg px-3 py-1.5">
            🗑 Eliminar compra
          </button>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-300 mb-3 font-semibold">⚠ ¿Eliminar esta compra? Se revertirán movimientos de caja, inventario y deudas asociadas. Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={acting} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {acting ? "Eliminando..." : "Sí, eliminar"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-hover">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {["SKU", "PRODUCTO", "CANT.", "COSTO UNIT.", "SUBTOTAL"].map(c => (
                <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-b border-border">
                <td className="px-4 py-3 font-mono text-xs text-text-muted">{i.product_sku}</td>
                <td className="px-4 py-3 text-xs">{i.product_name}</td>
                <td className="px-4 py-3 text-xs text-center">{i.qty}</td>
                <td className="px-4 py-3 text-xs text-right">{purchase.currency} {i.unit_cost.toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-right font-semibold">{purchase.currency} {i.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={4} className="px-4 py-3 text-right font-bold">TOTAL</td>
              <td className="px-4 py-3 text-right font-display text-lg font-bold">{purchase.currency} {purchase.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PurchaseStatusBadge({ s }: { s: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: "PENDIENTE",  cls: "bg-amber-500/10 text-amber-400" },
    partial:   { label: "EN CAMINO",  cls: "bg-blue-500/10 text-blue-400" },
    received:  { label: "CONFIRMADA", cls: "bg-green-500/10 text-green-400" },
    paid:      { label: "CONFIRMADA", cls: "bg-green-500/10 text-green-400" },
    cancelled: { label: "CANCELADA",  cls: "bg-red-500/10 text-red-400" },
  };
  const { label, cls } = map[s] || { label: s.toUpperCase(), cls: "text-text-muted" };
  return <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}
