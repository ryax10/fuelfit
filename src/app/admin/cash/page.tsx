"use client";
import Link from "next/link";
import { Fragment, useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, Pencil, Ban, History } from "lucide-react";
import { getCashMovementsAction, editCashMovementAction, voidCashMovementAction, getAuditLogsAction } from "@/app/admin/actions";
import type { CashMovement, AuditLog } from "@/lib/local-db/types";

function movementSign(type: CashMovement["type"]) {
  if (type === "sale_income" || type === "manual_income" || type === "ajuste_in") return 1;
  if (type === "ajuste_out") return -1;
  return -1; // manual_expense, purchase_expense, refund
}

function computeBalance(movements: CashMovement[]) {
  let ars = 0, usd = 0;
  movements.forEach(m => {
    if (m.affects_cash === false) return;
    const sign = movementSign(m.type);
    if (m.currency === "ARS") ars += sign * m.amount;
    else usd += sign * m.amount;
  });
  return { ars, usd };
}

function computeByCaja(movements: CashMovement[]) {
  const result: Record<string, { ars: number; usd: number }> = {
    Luciano: { ars: 0, usd: 0 }, Santiago: { ars: 0, usd: 0 }, Oficina: { ars: 0, usd: 0 },
  };
  movements.forEach(m => {
    if (m.affects_cash === false) return;
    const sign = movementSign(m.type);
    if (!result[m.caja]) result[m.caja] = { ars: 0, usd: 0 };
    if (m.currency === "ARS") result[m.caja].ars += sign * m.amount;
    else result[m.caja].usd += sign * m.amount;
  });
  return result;
}

export default function CashPage() {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [cajaF, setCajaF] = useState("Todas");
  const [currF, setCurrF] = useState("Todas");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ amount: string; currency: "ARS" | "USD"; caja: string; category: string; note: string; reason: string }>({ amount: "", currency: "ARS", caja: "", category: "", note: "", reason: "" });
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [auditByMov, setAuditByMov] = useState<Record<string, AuditLog[]>>({});
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const data = await getCashMovementsAction();
    setMovements(data);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const loadAudit = async (movId: string) => {
    if (auditByMov[movId]) return;
    const logs = await getAuditLogsAction("cash_movement", movId);
    setAuditByMov(prev => ({ ...prev, [movId]: logs }));
  };

  const filtered = movements.filter(m => {
    if (cajaF !== "Todas" && m.caja !== cajaF) return false;
    if (currF !== "Todas" && m.currency !== currF) return false;
    if (dateFrom && m.created_at.slice(0, 10) < dateFrom) return false;
    if (dateTo && m.created_at.slice(0, 10) > dateTo) return false;
    if (!showVoided && m.voided) return false;
    return true;
  });

  // El balance siempre refleja el estado real del negocio (todos los movimientos)
  // Los filtros solo afectan la tabla de movimientos, no los totales
  const hasFilter = cajaF !== "Todas" || currF !== "Todas" || dateFrom !== "" || dateTo !== "";
  const balance = computeBalance(movements);
  const byCaja = computeByCaja(movements);

  const startEdit = (m: CashMovement) => {
    setEditingId(m.id);
    setEditForm({
      amount: String(m.amount),
      currency: m.currency,
      caja: m.caja,
      category: m.category,
      note: m.note,
      reason: "",
    });
    setVoidingId(null);
  };

  const submitEdit = async (m: CashMovement) => {
    if (!editForm.reason.trim()) { alert("El motivo de edición es obligatorio"); return; }
    setBusy(true);
    try {
      const amount = parseFloat(editForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error("Monto inválido");
      await editCashMovementAction(m.id, {
        amount,
        currency: editForm.currency,
        caja: editForm.caja,
        category: editForm.category,
        note: editForm.note,
      }, editForm.reason);
      setEditingId(null);
      setAuditByMov(prev => { const n = { ...prev }; delete n[m.id]; return n; });
      await reload();
    } catch (err) {
      alert("Error al editar: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setBusy(false);
    }
  };

  const startVoid = (m: CashMovement) => {
    setVoidingId(m.id);
    setVoidReason("");
    setEditingId(null);
  };

  const submitVoid = async (m: CashMovement) => {
    if (!voidReason.trim()) { alert("El motivo de anulación es obligatorio"); return; }
    setBusy(true);
    try {
      await voidCashMovementAction(m.id, voidReason);
      setVoidingId(null);
      setAuditByMov(prev => { const n = { ...prev }; delete n[m.id]; return n; });
      await reload();
    } catch (err) {
      alert("Error al anular: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-text-muted text-sm">Cargando caja...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Caja Multi-Moneda</h1>
        <Link href="/admin/cash/new" className="flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-dark transition-all"><Plus size={16} /> Nuevo Movimiento</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-xl border border-border bg-bg-card p-5 border-t-2 border-t-green-500">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">ARS</p>
          <p className={`mt-1 font-display text-3xl font-bold ${balance.ars >= 0 ? "text-green-400" : "text-red-400"}`}>${balance.ars.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5 border-t-2 border-t-violet">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">USD</p>
          <p className={`mt-1 font-display text-3xl font-bold ${balance.usd >= 0 ? "text-green-400" : "text-red-400"}`}>U$D {balance.usd.toLocaleString()}</p>
        </div>
      </div>

      <h3 className="font-display text-base font-bold mb-3">🗃️ Por Caja</h3>
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        {["Luciano", "Santiago", "Oficina"].map(name => {
          const c = byCaja[name] || { ars: 0, usd: 0 };
          return (
            <div key={name} className="rounded-xl border border-border bg-bg-card p-4">
              <p className={`font-bold text-sm ${name === "Luciano" ? "text-green-400" : name === "Santiago" ? "text-text-secondary" : "text-violet-light"}`}>{name}</p>
              <div className="flex justify-between mt-2 text-xs"><span className="text-text-muted">ARS</span><span className="text-green-400 font-semibold">${c.ars.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs"><span className="text-text-muted">USD</span><span className="text-green-400 font-semibold">U$D {c.usd.toLocaleString()}</span></div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={cajaF} onChange={e => setCajaF(e.target.value)} className="rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm">
          <option>Todas</option><option>Luciano</option><option>Santiago</option><option>Oficina</option>
        </select>
        <select value={currF} onChange={e => setCurrF(e.target.value)} className="rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm">
          <option>Todas</option><option>ARS</option><option>USD</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm" />
        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
          <input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} />
          Ver anulados
        </label>
        {hasFilter && (
          <button onClick={() => { setCajaF("Todas"); setCurrF("Todas"); setDateFrom(""); setDateTo(""); }} className="text-xs text-violet-light hover:text-violet">Limpiar filtros</button>
        )}
        <span className="ml-auto text-xs text-text-muted">{filtered.length} de {movements.length} movimientos{hasFilter ? " (filtrados)" : ""}</span>
      </div>

      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border">
            {["FECHA", "TIPO", "CAJA", "MONEDA", "MONTO", "CATEGORÍA", "NOTA", ""].map(c => <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>)}
          </tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={8} className="px-4 py-12 text-center text-text-muted">Sin movimientos</td></tr>
              : filtered.map(m => {
                const isVoided = !!m.voided;
                return (<Fragment key={m.id}>
                <tr className={`border-b border-border hover:bg-bg-hover transition-colors cursor-pointer ${m.affects_cash === false ? "opacity-60" : ""} ${isVoided ? "line-through" : ""}`}
                  onClick={() => { const next = expandedId === m.id ? null : m.id; setExpandedId(next); if (next) loadAudit(m.id); }}>
                  <td className="px-4 py-3 text-xs text-text-muted">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {m.type === "ajuste_in" || m.type === "ajuste_out"
                        ? <span className="text-[10px] font-bold text-yellow-400">AJUSTE {m.type === "ajuste_in" ? "↑" : "↓"}</span>
                        : <span className={`text-[10px] font-bold ${m.type.includes("income") ? "text-green-400" : "text-red-400"}`}>{m.type.includes("income") ? "INGRESO" : "EGRESO"}</span>
                      }
                      {isVoided && <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">ANULADO</span>}
                      {!isVoided && m.affects_cash === false && (
                        <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-400" title="No impacta el balance de caja, solo P&L">SOLO P&L</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{m.caja}</td>
                  <td className="px-4 py-3 text-xs">{m.currency}</td>
                  <td className={`px-4 py-3 text-xs font-semibold ${m.type === "ajuste_in" || m.type === "ajuste_out" ? "text-yellow-400" : ""}`}>
                    {movementSign(m.type) > 0 ? "+" : "-"}${m.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{m.category}</td>
                  <td className="px-4 py-3 text-xs text-text-muted truncate max-w-[150px]">{m.note}</td>
                  <td className="px-4 py-3">{expandedId === m.id ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}</td>
                </tr>
                {expandedId === m.id && (
                  <tr><td colSpan={8} className="px-4 py-3 bg-bg-secondary/50 text-xs space-y-3">
                    <div className="space-y-1">
                      <p><span className="text-text-muted">ID:</span> <span className="font-mono">{m.id}</span></p>
                      <p><span className="text-text-muted">Tipo:</span> {m.type}</p>
                      <p><span className="text-text-muted">Nota:</span> {m.note || "—"}</p>
                      {m.order_id && <p><span className="text-text-muted">Pedido:</span> <Link href={`/admin/sales/${m.order_id}`} className="text-violet-light">Ver pedido →</Link></p>}
                      {m.debt_payment_id && <p><span className="text-text-muted">Vinculado a pago de deuda</span></p>}
                      {isVoided && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 mt-2">
                          <p className="text-red-400"><span className="font-bold">Anulado:</span> {m.voided_at ? new Date(m.voided_at).toLocaleString() : ""}</p>
                          <p className="text-red-300">Motivo: {m.voided_reason || "—"}</p>
                        </div>
                      )}
                    </div>

                    {!isVoided && editingId !== m.id && voidingId !== m.id && (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => startEdit(m)} className="flex items-center gap-1.5 rounded-lg bg-violet/10 px-3 py-1.5 text-xs font-semibold text-violet-light hover:bg-violet/20 transition-all">
                          <Pencil size={12} /> Editar
                        </button>
                        <button onClick={() => startVoid(m)} className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all">
                          <Ban size={12} /> Anular
                        </button>
                      </div>
                    )}

                    {editingId === m.id && (
                      <div className="rounded-xl border border-violet/30 bg-violet/5 p-3 space-y-2">
                        <p className="text-[10px] font-semibold tracking-wider text-violet-light">EDITAR MOVIMIENTO</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <label className="text-[10px] text-text-muted block mb-1">MONTO</label>
                            <input type="number" min="0" step="0.01" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-card px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-text-muted block mb-1">MONEDA</label>
                            <select value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value as "ARS" | "USD" }))} className="w-full rounded-lg border border-border bg-bg-card px-2 py-1.5 text-xs">
                              <option>ARS</option><option>USD</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-text-muted block mb-1">CAJA</label>
                            <select value={editForm.caja} onChange={e => setEditForm(f => ({ ...f, caja: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-card px-2 py-1.5 text-xs">
                              <option>Oficina</option><option>Luciano</option><option>Santiago</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="text-[10px] text-text-muted block mb-1">CATEGORÍA</label>
                            <input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-card px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-text-muted block mb-1">NOTA</label>
                            <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} className="w-full rounded-lg border border-border bg-bg-card px-2 py-1.5 text-xs" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-text-muted block mb-1">MOTIVO DE EDICIÓN *</label>
                          <input value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ej: corregí moneda — era ARS no USD" className="w-full rounded-lg border border-border bg-bg-card px-2 py-1.5 text-xs" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => submitEdit(m)} disabled={busy || !editForm.reason.trim()} className="rounded-lg bg-violet px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-dark disabled:opacity-50">{busy ? "Guardando..." : "Guardar cambios"}</button>
                          <button onClick={() => setEditingId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover">Cancelar</button>
                        </div>
                      </div>
                    )}

                    {voidingId === m.id && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                        <p className="text-[10px] font-semibold tracking-wider text-red-400">ANULAR MOVIMIENTO</p>
                        <p className="text-xs text-text-muted">El movimiento queda registrado pero deja de impactar caja y ganancias. {m.debt_payment_id ? "Como provino de un pago de deuda, también se revierte la deuda." : ""}</p>
                        <div>
                          <label className="text-[10px] text-text-muted block mb-1">MOTIVO *</label>
                          <input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Ej: cargado por error" className="w-full rounded-lg border border-border bg-bg-card px-2 py-1.5 text-xs" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => submitVoid(m)} disabled={busy || !voidReason.trim()} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">{busy ? "Anulando..." : "Confirmar anulación"}</button>
                          <button onClick={() => setVoidingId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover">Cancelar</button>
                        </div>
                      </div>
                    )}

                    {auditByMov[m.id] && auditByMov[m.id].length > 0 && (
                      <div className="rounded-xl border border-border bg-bg-card p-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-text-muted mb-2"><History size={11} /> HISTORIAL DE EDICIONES</p>
                        <div className="space-y-1.5">
                          {auditByMov[m.id].map(log => (
                            <div key={log.id} className="text-xs">
                              <span className="text-text-muted">{new Date(log.created_at).toLocaleString()}</span>
                              <span className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${log.action === "void" ? "bg-red-500/15 text-red-400" : "bg-violet/15 text-violet-light"}`}>{log.action}</span>
                              {log.actor && <span className="ml-2 text-text-secondary">{log.actor}</span>}
                              <span className="ml-2 text-text-secondary">{log.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </td></tr>
                )}
              </Fragment>);
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
