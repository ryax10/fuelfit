"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { getOrdersWithCostAction, getOrderItemsAction, getFxFullvipVentaAction } from "@/app/admin/actions";
import type { Order, OrderItem } from "@/lib/local-db/types";

type OrderWithCost = Awaited<ReturnType<typeof getOrdersWithCostAction>>[number];

function buildWhatsApp(order: Order, items: OrderItem[]): string {
  const lines = [`🛒 *Pedido #${order.number}*`, `📋 ${order.type === "wholesale" ? "Mayorista" : "Minorista"}`, ""];
  items.forEach(i => lines.push(`• ${i.product_name} x${i.qty} — $${i.subtotal.toLocaleString()}`));
  lines.push("", `💰 *Total: $${order.total.toLocaleString()}*`);
  if (order.customer_address && !order.customer_address.includes("Retiro")) lines.push(`📦 Envío: ${order.customer_address}`);
  else lines.push("📍 Retiro coordinado por WhatsApp");
  lines.push("", `👤 ${order.customer_name}`, `📱 ${order.customer_phone}`);
  return lines.join("\n");
}

const usd = (n: number) => `U$D ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ars = (n: number) => `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FILTERS = ["todos", "pending", "confirmed", "cancelled"];
const LABELS: Record<string, string> = { todos: "Todos", pending: "Pendientes", confirmed: "Confirmados", cancelled: "Cancelados" };

export default function SalesPage() {
  const [orders, setOrders] = useState<OrderWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fx, setFx] = useState<number>(1);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const [data, fxValue] = await Promise.all([
        getOrdersWithCostAction(period),
        getFxFullvipVentaAction(),
      ]);
      setOrders(data);
      setFx(Math.max(1, fxValue));
    } finally {
      setLoading(false);
    }
  };

  // Meses disponibles (últimos 12)
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  const filtered = filter === "todos" ? orders : orders.filter(o => o.status === filter);

  const handleCopy = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const items = await getOrderItemsAction(orderId);
    navigator.clipboard.writeText(buildWhatsApp(order, items));
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Convierte total a USD según tipo (retail usa FX). Exchange (cambio sin cobro) = 0.
  const toUSD = (o: OrderWithCost) => {
    if (o.payment_status === "exchange") return 0;
    return o.type === "wholesale" ? o.total : o.total / fx;
  };

  // Totales: incluir pending + confirmed (excluir cancelled) — mismo criterio que /admin/profit
  const countable = orders.filter(o => o.status === "pending" || o.status === "confirmed");
  const totalVentaUSD = countable.reduce((s, o) => s + toUSD(o), 0);
  const totalCosto = countable.reduce((s, o) => s + o.total_cost, 0);
  const totalMargen = totalVentaUSD - totalCosto;
  const totalUnits = countable.reduce((s, o) => s + (o.total_units ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Ventas / Pedidos</h1>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm focus:border-violet focus:outline-none">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button onClick={load} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-muted text-sm">Cargando ventas...</div>
      ) : (
        <>
          {/* Totales resumen — incluye pending + confirmed (no cancelled), exchange con revenue=0 */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-bg-card p-4 border-t-2 border-t-blue-400">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">INGRESOS BRUTOS</p>
              <p className="mt-1 font-display text-xl font-bold text-blue-400">{usd(totalVentaUSD)}</p>
              <p className="text-xs text-text-muted">{countable.length} ventas · {totalUnits} unidades</p>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-4 border-t-2 border-t-orange-400">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">COSTO MERCADERÍA</p>
              <p className="mt-1 font-display text-xl font-bold text-orange-400">− {usd(totalCosto)}</p>
              <p className="text-xs text-text-muted">{countable.length} ventas · {totalUnits} unidades</p>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-4 border-t-2 border-t-green-500">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">GANANCIA BRUTA</p>
              <p className={`mt-1 font-display text-xl font-bold ${totalMargen >= 0 ? "text-green-400" : "text-red-400"}`}>{usd(totalMargen)}</p>
              <p className="text-xs text-text-muted">Margen {totalVentaUSD > 0 ? ((totalMargen / totalVentaUSD) * 100).toFixed(1) : 0}% · FX ${fx.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${filter === f ? "bg-violet/10 text-violet-light border border-violet/20" : "border border-border text-text-muted hover:bg-bg-hover"}`}>
                {LABELS[f]} {f !== "todos" && `(${orders.filter(o => o.status === f).length})`}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-border">
                {["#", "FECHA", "TIPO", "CLIENTE", "UNID.", "VENTA", "COSTO", "MARGEN", "PAGO", "ESTADO", "acciones", "detalle"].map(c => <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted whitespace-nowrap">{c === "acciones" || c === "detalle" ? "" : c}</th>)}
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-16 text-center text-text-muted">Sin pedidos {filter !== "todos" ? LABELS[filter].toLowerCase() : "en este mes"}</td></tr>
                ) : filtered.map(o => {
                  const totalUSD = toUSD(o);
                  const margen = totalUSD - o.total_cost;
                  const margenPct = totalUSD > 0 ? ((margen / totalUSD) * 100).toFixed(0) : "0";
                  return (
                    <tr key={o.id} className="border-b border-border hover:bg-bg-hover transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">#{o.number}</td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        <span className="block">{new Date(o.created_at).toLocaleDateString("es-AR")}</span>
                        <span className="block text-[10px] opacity-60">{new Date(o.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-bold ${o.type === "wholesale" ? "text-violet-light" : "text-text-secondary"}`}>{o.type === "wholesale" ? "MAY" : "MIN"}</span></td>
                      <td className="px-4 py-3 text-xs">{o.customer_name}<span className="block text-text-muted">{o.customer_phone}</span></td>
                      <td className="px-4 py-3 text-xs text-center font-semibold text-text-secondary">{o.total_units ?? 0}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-blue-400 whitespace-nowrap">
                        {o.payment_status === "exchange"
                          ? <span className="text-orange-400">CAMBIO</span>
                          : o.type === "retail"
                            ? <><span className="block">{ars(o.total)}</span><span className="block text-blue-300/70 text-[10px]">{usd(totalUSD)}</span></>
                            : usd(o.total)
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-orange-400 whitespace-nowrap">{o.total_cost > 0 ? `− ${usd(o.total_cost)}` : <span className="text-text-muted">—</span>}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {o.total_cost > 0
                          ? <span className={margen >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>{usd(margen)} <span className="text-text-muted font-normal">({margenPct}%)</span></span>
                          : <span className="text-text-muted">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-[10px] text-text-muted">{o.payment_method === "cash" ? "💵 Efect." : "🏦 Transf."}</td>
                      <td className="px-4 py-3">
                        <Status s={o.status} />
                        {o.payment_status === "exchange" && (
                          <span className="ml-1 rounded-lg bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold text-orange-400">CAMBIO</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleCopy(o.id)} className="text-text-muted hover:text-violet-light transition-colors" title="Copiar para WhatsApp">
                          {copiedId === o.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/sales/${o.id}`} className={`text-xs font-semibold hover:underline ${o.status === "pending" ? "text-green-400 hover:text-green-300" : "text-violet-light hover:text-violet"}`}>
                          {o.status === "pending" ? "Confirmar/Cancelar" : "Ver →"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {countable.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-bg-secondary">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold text-text-muted">TOTALES (pendientes + confirmados)</td>
                    <td className="px-4 py-3 text-xs font-bold text-text-secondary text-center">{totalUnits}</td>
                    <td className="px-4 py-3 text-xs font-bold text-blue-400 whitespace-nowrap">{usd(totalVentaUSD)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-orange-400 whitespace-nowrap">− {usd(totalCosto)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-green-400 whitespace-nowrap">{usd(totalMargen)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Status({ s }: { s: string }) {
  const m: Record<string, string> = { pending: "bg-yellow-500/10 text-yellow-400", confirmed: "bg-green-500/10 text-green-400", cancelled: "bg-red-500/10 text-red-400" };
  return <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${m[s] || "text-text-muted"}`}>{s === "pending" ? "PENDIENTE" : s === "confirmed" ? "CONFIRMADO" : "CANCELADO"}</span>;
}
