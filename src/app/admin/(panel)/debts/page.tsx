"use client";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CreditCard, Phone, Trash2, DollarSign, Plus, X, XCircle, Archive } from "lucide-react";
import { getCustomerAccountsAction, getDebtPaymentsAction, payCustomerAccountAction, payDebtAction, payDebtFxAction, deleteDebtAction, cancelDebtAction, archiveDebtAction, createManualDebtAction, getConfigAction } from "@/app/admin/actions";
import type { CustomerAccount, DebtPayment, Debt } from "@/app/admin/actions";

const CAJAS = ["Luciano", "Santiago", "Oficina"];

export default function DebtsPage() {
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [debtPayments, setDebtPayments] = useState<Record<string, DebtPayment[]>>({});

  // Formulario de pago por cuenta de cliente (con FX dual)
  const [payForms, setPayForms] = useState<Record<string, { amount: string; currency: "ARS" | "USD"; caja: string; note: string; fxRate: string }>>({});
  const [paying, setPaying] = useState<string | null>(null);

  // Formulario nueva deuda manual
  const [showNewDebt, setShowNewDebt] = useState(false);
  const [newDebt, setNewDebt] = useState({ direction: "payable" as "payable" | "receivable", amount: "", currency: "ARS" as "ARS" | "USD", entity: "", note: "" });
  const [savingDebt, setSavingDebt] = useState(false);

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebt.amount || !newDebt.entity) return;
    setSavingDebt(true);
    try {
      const entityType = newDebt.direction === "receivable" ? "customer" : "supplier";
      await createManualDebtAction(newDebt.direction, newDebt.entity, entityType, parseFloat(newDebt.amount), newDebt.currency, newDebt.note);
      setShowNewDebt(false);
      setNewDebt({ direction: "payable", amount: "", currency: "ARS", entity: "", note: "" });
      await load();
    } catch (err) {
      alert("Error al crear deuda: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setSavingDebt(false);
    }
  };

  // Formulario de pago por deuda individual (FX dual)
  const [debtForms, setDebtForms] = useState<Record<string, { amount: string; payCurrency: "ARS" | "USD"; caja: string; note: string; fxRate: string }>>({});
  const [payingDebtInline, setPayingDebtInline] = useState<string | null>(null);
  const [openDebtForm, setOpenDebtForm] = useState<string | null>(null);
  const [deletingDebt, setDeletingDebt] = useState<string | null>(null);
  const [defaultFx, setDefaultFx] = useState<number>(1000);
  const [showSaldados, setShowSaldados] = useState(false);


  useEffect(() => { load(); }, []);

  const load = async () => {
    const [accs, cfg] = await Promise.all([getCustomerAccountsAction(), getConfigAction()]);
    setAccounts(accs);
    const fx = parseFloat(cfg["fx_usdt_ars"] || "1000");
    if (fx > 0) setDefaultFx(fx);
    setLoading(false);
  };

  const toggleAccount = async (key: string, acc: CustomerAccount) => {
    if (expanded === key) { setExpanded(null); return; }
    setExpanded(key);
    // Pre-cargar pagos de cada deuda de la cuenta
    for (const debt of acc.debts) {
      if (!debtPayments[debt.id]) {
        const p = await getDebtPaymentsAction(debt.id);
        setDebtPayments(prev => ({ ...prev, [debt.id]: p }));
      }
    }
    if (!payForms[key]) {
      const preferCurrency = acc.balanceARS.net !== 0 ? "ARS" : "USD";
      setPayForms(prev => ({ ...prev, [key]: { amount: "", currency: preferCurrency, caja: "Oficina", note: "", fxRate: String(defaultFx) } }));
    }
  };

  const handlePayAccount = async (acc: CustomerAccount) => {
    const form = payForms[acc.key];
    const amount = parseFloat(form?.amount);
    if (!amount || amount <= 0) return;
    setPaying(acc.key);
    try {
      // Habilitamos FX dual siempre que el cliente tenga deudas en moneda distinta a la del pago
      const hasDebtInOtherCurrency = acc.debts.some(d => (d.status === "pending" || d.status === "partial") && d.type === "receivable" && d.currency !== form.currency);
      const fx = hasDebtInOtherCurrency ? (parseFloat(form.fxRate) || defaultFx) : undefined;
      await payCustomerAccountAction(acc.entityId, acc.entityName, amount, form.currency, form.caja, form.note, fx);
      await load();
      // Limpiar y recargar pagos frescos de las deudas de este cliente
      setDebtPayments(prev => {
        const next = { ...prev };
        for (const debt of acc.debts) delete next[debt.id];
        return next;
      });
      for (const debt of acc.debts) {
        const p = await getDebtPaymentsAction(debt.id);
        setDebtPayments(prev => ({ ...prev, [debt.id]: p }));
      }
      setPayForms(prev => ({ ...prev, [acc.key]: { amount: "", currency: form.currency, caja: form.caja, note: "", fxRate: form.fxRate || String(defaultFx) } }));
    } catch (err) {
      alert("Error al registrar cobro: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setPaying(null);
    }
  };

  const handlePayDebtInline = async (debt: Debt) => {
    const form = debtForms[debt.id];
    const amount = parseFloat(form?.amount);
    if (!amount || amount <= 0) return;
    setPayingDebtInline(debt.id);
    try {
      const payCurrency = form.payCurrency || debt.currency;
      const fx = parseFloat(form.fxRate) || defaultFx;
      if (payCurrency === debt.currency) {
        // Mismo régimen anterior — no romper compatibilidad
        await payDebtAction(debt.id, amount, form.caja, form.note);
      } else {
        await payDebtFxAction(debt.id, amount, payCurrency, form.caja, fx, form.note);
      }
      await load();
      const p = await getDebtPaymentsAction(debt.id);
      setDebtPayments(prev => ({ ...prev, [debt.id]: p }));
      setOpenDebtForm(null);
    } catch (err) {
      alert("Error al registrar pago: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setPayingDebtInline(null);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm("¿Eliminar esta deuda? Esta acción no se puede deshacer.")) return;
    setDeletingDebt(debtId);
    try {
      await deleteDebtAction(debtId);
      await load();
    } finally {
      setDeletingDebt(null);
    }
  };

  const handleCancelDebt = async (debt: Debt) => {
    const reason = prompt(`Cancelar deuda de "${debt.entity_name}".\n\nLa deuda queda como cancelada y NO impacta en caja ni en ganancias.\n\nMotivo (opcional):`, "");
    if (reason === null) return;
    setDeletingDebt(debt.id);
    try {
      await cancelDebtAction(debt.id, reason);
      await load();
    } finally {
      setDeletingDebt(null);
    }
  };

  const handleArchiveDebt = async (debt: Debt) => {
    const remaining = debt.original_amount - debt.paid_amount;
    const cur = debt.currency === "USD" ? "U$D" : "$";
    const isReceivable = debt.type === "receivable";
    const msg = isReceivable
      ? `Archivar deuda de "${debt.entity_name}" por ${cur} ${remaining.toLocaleString()}.\n\nSe registra como PÉRDIDA en ganancias (castigo deuda incobrable). NO toca caja física.\n\nMotivo (opcional):`
      : `Archivar deuda a "${debt.entity_name}" por ${cur} ${remaining.toLocaleString()}.\n\nSe registra como GANANCIA (perdón de deuda recibido). NO toca caja física.\n\nMotivo (opcional):`;
    const reason = prompt(msg, "");
    if (reason === null) return;
    setDeletingDebt(debt.id);
    try {
      await archiveDebtAction(debt.id, reason);
      await load();
    } finally {
      setDeletingDebt(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const fmtAmt = (n: number, cur: string) => `${cur === "USD" ? "U$D" : "$"} ${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // Totales generales — todas las entidades unificadas
  const totalRecARS = accounts.reduce((s, a) => s + Math.max(0, a.balanceARS.net), 0);
  const totalRecUSD = accounts.reduce((s, a) => s + Math.max(0, a.balanceUSD.net), 0);
  const totalPayARS = accounts.reduce((s, a) => s + Math.max(0, -a.balanceARS.net), 0);
  const totalPayUSD = accounts.reduce((s, a) => s + Math.max(0, -a.balanceUSD.net), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Deudas</h1>
        <button onClick={() => setShowNewDebt(v => !v)}
          className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-dark transition-all">
          {showNewDebt ? <><X size={15} /> Cancelar</> : <><Plus size={15} /> Agregar Deuda</>}
        </button>
      </div>

      {/* Formulario nueva deuda */}
      {showNewDebt && (
        <form onSubmit={handleCreateDebt} className="mb-6 rounded-xl border border-border bg-bg-card p-5 space-y-4">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">NUEVA DEUDA</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setNewDebt(d => ({ ...d, direction: "payable" }))}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${newDebt.direction === "payable" ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border text-text-muted hover:bg-bg-hover"}`}>
              💸 A Pagar
            </button>
            <button type="button" onClick={() => setNewDebt(d => ({ ...d, direction: "receivable" }))}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${newDebt.direction === "receivable" ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-border text-text-muted hover:bg-bg-hover"}`}>
              💰 A Cobrar
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">MONTO *</label>
              <input type="number" required min={0} step="0.01" value={newDebt.amount}
                onChange={e => setNewDebt(d => ({ ...d, amount: e.target.value }))}
                className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-sm focus:border-violet focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">MONEDA</label>
              <select value={newDebt.currency} onChange={e => setNewDebt(d => ({ ...d, currency: e.target.value as "ARS" | "USD" }))}
                className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-sm focus:border-violet focus:outline-none">
                <option>ARS</option><option>USD</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">
                {newDebt.direction === "payable" ? "ACREEDOR (a quién le debemos)" : "DEUDOR (quién nos debe)"}
              </label>
              <input required value={newDebt.entity} onChange={e => setNewDebt(d => ({ ...d, entity: e.target.value }))}
                placeholder="Nombre, empresa..."
                className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-sm focus:border-violet focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">NOTA</label>
              <input value={newDebt.note} onChange={e => setNewDebt(d => ({ ...d, note: e.target.value }))}
                placeholder="Descripción..."
                className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-sm focus:border-violet focus:outline-none" />
            </div>
          </div>
          <button type="submit" disabled={savingDebt || !newDebt.amount || !newDebt.entity}
            className="rounded-xl bg-violet px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50 transition-all">
            {savingDebt ? "Guardando..." : "Registrar Deuda"}
          </button>
        </form>
      )}

      {/* Resumen */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg-card p-5 border-t-2 border-t-green-500">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">DEUDAS A COBRAR</p>
          <div className="mt-1 font-display text-lg font-bold text-green-400">
            {totalRecARS > 0 && <p>{fmtAmt(totalRecARS, "ARS")}</p>}
            {totalRecUSD > 0 && <p>{fmtAmt(totalRecUSD, "USD")}</p>}
            {totalRecARS === 0 && totalRecUSD === 0 && <p className="text-text-muted text-base">$0</p>}
          </div>
          <p className="mt-1 text-xs text-text-muted">{accounts.filter(a => a.balanceARS.net > 0 || a.balanceUSD.net > 0).length} cuentas</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-5 border-t-2 border-t-red-500">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">DEUDAS A PAGAR</p>
          <div className="mt-1 font-display text-lg font-bold text-red-400">
            {totalPayARS > 0 && <p>{fmtAmt(totalPayARS, "ARS")}</p>}
            {totalPayUSD > 0 && <p>{fmtAmt(totalPayUSD, "USD")}</p>}
            {totalPayARS === 0 && totalPayUSD === 0 && <p className="text-text-muted text-base">$0</p>}
          </div>
          <p className="mt-1 text-xs text-text-muted">{accounts.filter(a => a.balanceARS.net < 0 || a.balanceUSD.net < 0).length} cuentas</p>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-text-muted">Cargando...</p>
      ) : (
        <div className="space-y-8">

          {/* Cuentas con saldo pendiente */}
          {(() => {
            const activeAccounts = accounts.filter(a => a.balanceARS.net !== 0 || a.balanceUSD.net !== 0);
            const settledAccounts = accounts.filter(a => a.balanceARS.net === 0 && a.balanceUSD.net === 0);
            return (
              <>
          <div>
            <h2 className="mb-3 font-display text-base font-bold">Deudas Pendientes</h2>
            {activeAccounts.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg-card px-4 py-12 text-center text-text-muted">Sin deudas pendientes</div>
            ) : (
              <div className="space-y-2">
                {activeAccounts.map(acc => {
                  const isOpen = expanded === acc.key;
                  const form = payForms[acc.key] || { amount: "", currency: "ARS" as const, caja: "Oficina", note: "" };
                  const netARS = acc.balanceARS.net;
                  const netUSD = acc.balanceUSD.net;
                  const hasDebt = netARS > 0 || netUSD > 0;
                  const hasCredit = netARS < 0 || netUSD < 0;

                  return (
                    <div key={acc.key} className="rounded-xl border border-border bg-bg-card overflow-hidden">
                      <button onClick={() => toggleAccount(acc.key, acc)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-bg-hover transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${hasCredit ? "bg-blue-400" : hasDebt ? "bg-yellow-400" : "bg-green-400"}`} />
                          <div>
                            <p className="font-semibold">{acc.entityName}</p>
                            <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                              {acc.phone
                                ? <span className="flex items-center gap-1 text-violet-light font-medium"><Phone size={10} />{acc.phone}</span>
                                : <span className="flex items-center gap-1 italic opacity-50"><Phone size={10} />Sin teléfono</span>
                              }
                              <span>{acc.debts.length} movimiento{acc.debts.length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right space-y-0.5">
                            {netARS !== 0 && (
                              <p className={`font-display text-sm font-bold ${netARS > 0 ? "text-yellow-400" : "text-blue-400"}`}>
                                {netARS > 0 ? "Debe" : "A favor"} {fmtAmt(Math.abs(netARS), "ARS")}
                              </p>
                            )}
                            {netUSD !== 0 && (
                              <p className={`font-display text-sm font-bold ${netUSD > 0 ? "text-yellow-400" : "text-blue-400"}`}>
                                {netUSD > 0 ? "Debe" : "A favor"} {fmtAmt(Math.abs(netUSD), "USD")}
                              </p>
                            )}
                            {netARS === 0 && netUSD === 0 && <p className="text-xs text-green-400 font-semibold">Saldado ✓</p>}
                          </div>
                          {isOpen ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border px-5 py-4 space-y-4">
                          {/* Detalle de deudas individuales */}
                          <div>
                            <p className="mb-2 text-[10px] font-semibold tracking-wider text-text-muted">DETALLE DE MOVIMIENTOS</p>
                            <div className="space-y-1.5">
                              {acc.debts.map(d => {
                                const rem = d.original_amount - d.paid_amount;
                                const dPayments = debtPayments[d.id] || [];
                                const isFormOpen = openDebtForm === d.id;
                                const form = debtForms[d.id] || { amount: String(rem > 0 ? rem : d.original_amount), payCurrency: d.currency as "ARS" | "USD", caja: "Oficina", note: "", fxRate: String(defaultFx) };
                                const isInactive = d.status === "paid" || d.status === "cancelled" || d.status === "archived";
                                const containerClass = isInactive
                                  ? "opacity-50 bg-bg-secondary"
                                  : d.type === "receivable"
                                    ? "bg-yellow-500/5 border border-yellow-500/15"
                                    : "bg-blue-500/5 border border-blue-500/15";
                                return (
                                  <div key={d.id} className={`rounded-lg text-sm ${containerClass}`}>
                                    <div className="flex items-center justify-between px-4 py-3">
                                      <div>
                                        <span className={`text-[10px] font-bold uppercase mr-2 ${d.type === "receivable" ? "text-yellow-400" : "text-blue-400"}`}>
                                          {d.type === "receivable" ? "Debe" : "Saldo a favor"}
                                        </span>
                                        {d.status === "cancelled" && (
                                          <span className="rounded-md bg-gray-500/15 px-1.5 py-0.5 text-[9px] font-bold text-gray-400 mr-1.5">CANCELADA</span>
                                        )}
                                        {d.status === "archived" && (
                                          <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-400 mr-1.5">ARCHIVADA</span>
                                        )}
                                        <span className="text-text-muted text-xs">{fmt(d.created_at)} · {d.note}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-right">
                                          <span className={`font-semibold ${isInactive ? "text-green-400 line-through" : d.type === "receivable" ? "text-yellow-300" : "text-blue-300"}`}>
                                            {fmtAmt(d.original_amount, d.currency)}
                                          </span>
                                          {rem > 0 && rem < d.original_amount && d.status !== "cancelled" && d.status !== "archived" && (
                                            <p className="text-xs text-text-muted">Pendiente: {fmtAmt(rem, d.currency)}</p>
                                          )}
                                        </div>
                                        {!isInactive && (
                                          <>
                                            <button onClick={() => {
                                              setOpenDebtForm(isFormOpen ? null : d.id);
                                              if (!debtForms[d.id]) setDebtForms(prev => ({ ...prev, [d.id]: { amount: String(rem), payCurrency: d.currency as "ARS" | "USD", caja: "Oficina", note: "", fxRate: String(defaultFx) } }));
                                            }} className="rounded-lg bg-violet/10 p-1.5 text-violet-light hover:bg-violet/20 transition-all" title="Saldar deuda">
                                              <DollarSign size={13} />
                                            </button>
                                            <button onClick={() => handleCancelDebt(d)} disabled={deletingDebt === d.id} className="rounded-lg bg-gray-500/10 p-1.5 text-gray-400 hover:bg-gray-500/20 transition-all disabled:opacity-50" title="Cancelar deuda (no impacta en nada)">
                                              <XCircle size={13} />
                                            </button>
                                            <button onClick={() => handleArchiveDebt(d)} disabled={deletingDebt === d.id} className="rounded-lg bg-purple-500/10 p-1.5 text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-50" title="Archivar (cuenta como pérdida/ganancia en P&L)">
                                              <Archive size={13} />
                                            </button>
                                          </>
                                        )}
                                        <button onClick={() => handleDeleteDebt(d.id)} disabled={deletingDebt === d.id} className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50" title="Eliminar registro (irreversible)">
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                    {dPayments.length > 0 && (
                                      <div className="px-4 pb-2 space-y-1 border-t border-border/50 pt-2">
                                        {dPayments.map(p => (
                                          <p key={p.id} className="text-xs text-text-muted">{fmt(p.created_at)} — Pagó {fmtAmt(p.amount, d.currency)} ({p.caja})</p>
                                        ))}
                                      </div>
                                    )}
                                    {isFormOpen && (() => {
                                      const payAmt = parseFloat(form.amount) || 0;
                                      const fxNum = parseFloat(form.fxRate) || defaultFx;
                                      let amountInDebtCurrency = payAmt;
                                      if (form.payCurrency !== d.currency && fxNum > 0) {
                                        amountInDebtCurrency = d.currency === "ARS" ? payAmt * fxNum : payAmt / fxNum;
                                      }
                                      const debtSym = d.currency === "USD" ? "U$D" : "$";
                                      const showConversion = form.payCurrency !== d.currency && payAmt > 0 && fxNum > 0;
                                      return (
                                      <div className="border-t border-border/50 px-4 py-3 bg-bg-secondary/50">
                                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-text-muted">REGISTRAR {d.type === "receivable" ? "COBRO" : "PAGO"} (deuda en {d.currency})</p>
                                        <div className="flex flex-wrap items-end gap-2">
                                          <div>
                                            <label className="mb-1 block text-xs text-text-secondary">Moneda recibida</label>
                                            <select value={form.payCurrency} onChange={e => setDebtForms(prev => ({ ...prev, [d.id]: { ...form, payCurrency: e.target.value as "ARS" | "USD" } }))}
                                              className="rounded-xl border border-border bg-bg-card px-3 py-2 text-sm focus:border-violet focus:outline-none">
                                              <option value="ARS">ARS $</option>
                                              <option value="USD">USD U$D</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-text-secondary">Monto ({form.payCurrency})</label>
                                            <input type="number" min={0} step="0.01" value={form.amount}
                                              onChange={e => setDebtForms(prev => ({ ...prev, [d.id]: { ...form, amount: e.target.value } }))}
                                              className="w-32 rounded-xl border border-border bg-bg-card px-3 py-2 text-sm focus:border-violet focus:outline-none" />
                                          </div>
                                          {form.payCurrency !== d.currency && (
                                            <div>
                                              <label className="mb-1 block text-xs text-text-secondary">FX (USDT/ARS)</label>
                                              <input type="number" min={0} step="0.01" value={form.fxRate}
                                                onChange={e => setDebtForms(prev => ({ ...prev, [d.id]: { ...form, fxRate: e.target.value } }))}
                                                className="w-28 rounded-xl border border-border bg-bg-card px-3 py-2 text-sm focus:border-violet focus:outline-none" />
                                            </div>
                                          )}
                                          <div>
                                            <label className="mb-1 block text-xs text-text-secondary">Caja</label>
                                            <select value={form.caja} onChange={e => setDebtForms(prev => ({ ...prev, [d.id]: { ...form, caja: e.target.value } }))}
                                              className="rounded-xl border border-border bg-bg-card px-3 py-2 text-sm focus:border-violet focus:outline-none">
                                              {CAJAS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-text-secondary">Nota</label>
                                            <input value={form.note} onChange={e => setDebtForms(prev => ({ ...prev, [d.id]: { ...form, note: e.target.value } }))}
                                              placeholder="Opcional"
                                              className="w-32 rounded-xl border border-border bg-bg-card px-3 py-2 text-sm focus:border-violet focus:outline-none" />
                                          </div>
                                          <button onClick={() => handlePayDebtInline(d)} disabled={payingDebtInline === d.id || !form.amount}
                                            className="flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50 transition-all">
                                            <CreditCard size={13} />
                                            {payingDebtInline === d.id ? "Procesando..." : "Confirmar"}
                                          </button>
                                          <button onClick={() => setOpenDebtForm(null)} className="rounded-xl border border-border px-3 py-2 text-xs text-text-muted hover:bg-bg-hover transition-all">
                                            Cancelar
                                          </button>
                                        </div>
                                        {showConversion && (
                                          <p className="mt-2 text-xs text-violet-light">
                                            ≈ {debtSym} {amountInDebtCurrency.toLocaleString("es-AR", { maximumFractionDigits: 2 })} aplicado a la deuda · resta {debtSym} {Math.max(0, rem - amountInDebtCurrency).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                                            {amountInDebtCurrency > rem && <span className="ml-1 text-blue-400">· excedente {debtSym} {(amountInDebtCurrency - rem).toLocaleString("es-AR", { maximumFractionDigits: 2 })} → saldo a favor</span>}
                                          </p>
                                        )}
                                      </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Formulario de cobro (solo si tiene saldo a cobrar) */}
                          {(acc.balanceARS.receivable > 0 || acc.balanceUSD.receivable > 0) && (() => {
                            const formFx = parseFloat(form.fxRate) || defaultFx;
                            const recARS = acc.balanceARS.receivable;
                            const recUSD = acc.balanceUSD.receivable;
                            // Total a cobrar expresado en la moneda del PAGO
                            const totalToCollectInPayCurrency = form.currency === "ARS"
                              ? recARS + (recUSD > 0 && formFx > 0 ? recUSD * formFx : 0)
                              : recUSD + (recARS > 0 && formFx > 0 ? recARS / formFx : 0);
                            const payAmt = parseFloat(form.amount) || 0;
                            const sym = form.currency === "USD" ? "U$D" : "$";
                            const showFxField = (form.currency === "ARS" && recUSD > 0) || (form.currency === "USD" && recARS > 0);
                            return (
                            <div>
                              <p className="mb-2 text-[10px] font-semibold tracking-wider text-text-muted">REGISTRAR COBRO</p>
                              <div className="flex flex-wrap items-end gap-3">
                                <div>
                                  <label className="mb-1 block text-xs text-text-secondary">Moneda recibida</label>
                                  <select value={form.currency} onChange={e => setPayForms(p => ({ ...p, [acc.key]: { ...form, currency: e.target.value as "ARS" | "USD" } }))}
                                    className="rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none">
                                    <option value="ARS">ARS $</option>
                                    <option value="USD">USD U$D</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-text-secondary">
                                    Monto ({form.currency})
                                    {form.currency === "ARS" && recARS > 0 && <span className="ml-1 text-text-muted">(debe ARS {fmtAmt(recARS, "ARS")})</span>}
                                    {form.currency === "USD" && recUSD > 0 && <span className="ml-1 text-text-muted">(debe USD {fmtAmt(recUSD, "USD")})</span>}
                                  </label>
                                  <input type="number" min={0} step="0.01" value={form.amount}
                                    onChange={e => setPayForms(p => ({ ...p, [acc.key]: { ...form, amount: e.target.value } }))}
                                    className="w-36 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
                                </div>
                                {showFxField && (
                                  <div>
                                    <label className="mb-1 block text-xs text-text-secondary">FX (USDT/ARS)</label>
                                    <input type="number" min={0} step="0.01" value={form.fxRate}
                                      onChange={e => setPayForms(p => ({ ...p, [acc.key]: { ...form, fxRate: e.target.value } }))}
                                      className="w-28 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
                                  </div>
                                )}
                                <div>
                                  <label className="mb-1 block text-xs text-text-secondary">Caja</label>
                                  <select value={form.caja} onChange={e => setPayForms(p => ({ ...p, [acc.key]: { ...form, caja: e.target.value } }))}
                                    className="rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none">
                                    {CAJAS.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-text-secondary">Nota</label>
                                  <input value={form.note} onChange={e => setPayForms(p => ({ ...p, [acc.key]: { ...form, note: e.target.value } }))}
                                    placeholder="Opcional"
                                    className="w-36 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
                                </div>
                                <button onClick={() => {
                                  // "Saldar todo": setear el monto necesario en la moneda del pago para cubrir TODAS las receivables
                                  setPayForms(p => ({ ...p, [acc.key]: { ...form, amount: String(Math.round(totalToCollectInPayCurrency * 100) / 100) } }));
                                }} className="rounded-xl border border-border px-3 py-2 text-xs text-text-muted hover:bg-bg-hover transition-all">
                                  Saldar todo
                                </button>
                                <button onClick={() => handlePayAccount(acc)} disabled={paying === acc.key || !form.amount}
                                  className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50 transition-all">
                                  <CreditCard size={14} />
                                  {paying === acc.key ? "Procesando..." : "Registrar Cobro"}
                                </button>
                              </div>
                              {showFxField && payAmt > 0 && formFx > 0 && (
                                <p className="mt-2 text-xs text-violet-light">
                                  Se aplicará a las deudas pendientes (FIFO) usando FX {formFx}. Total a saldar ≈ {sym} {totalToCollectInPayCurrency.toLocaleString("es-AR", { maximumFractionDigits: 2 })}.
                                </p>
                              )}
                              {payAmt > totalToCollectInPayCurrency && payAmt > 0 && totalToCollectInPayCurrency > 0 && (
                                <p className="mt-1 text-xs text-blue-400">
                                  El excedente de {fmtAmt(payAmt - totalToCollectInPayCurrency, form.currency)} quedará como saldo a favor del cliente en {form.currency}.
                                </p>
                              )}
                            </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historial de saldados */}
          {settledAccounts.length > 0 && (
            <div>
              <button
                onClick={() => setShowSaldados(v => !v)}
                className="flex items-center gap-2 mb-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                {showSaldados ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="font-semibold">Historial Saldados</span>
                <span className="rounded-full bg-bg-card border border-border px-2 py-0.5 text-xs">{settledAccounts.length}</span>
              </button>
              {showSaldados && (
                <div className="space-y-2 opacity-70">
                  {settledAccounts.map(acc => {
                    const isOpen = expanded === acc.key;
                    return (
                      <div key={acc.key} className="rounded-xl border border-border bg-bg-card overflow-hidden">
                        <button onClick={() => toggleAccount(acc.key, acc)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-bg-hover transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <div>
                              <p className="font-semibold">{acc.entityName}</p>
                              <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                                <span>{acc.debts.length} movimiento{acc.debts.length !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-xs text-green-400 font-semibold">Saldado ✓</p>
                            {isOpen ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-border px-5 py-4 space-y-4">
                            <p className="mb-2 text-[10px] font-semibold tracking-wider text-text-muted">DETALLE DE MOVIMIENTOS</p>
                            <div className="space-y-1.5">
                              {acc.debts.map(d => {
                                const dPayments = debtPayments[d.id] || [];
                                return (
                                  <div key={d.id} className="rounded-lg text-sm opacity-60 bg-bg-secondary">
                                    <div className="flex items-center justify-between px-4 py-3">
                                      <div>
                                        <span className={`text-[10px] font-bold uppercase mr-2 ${d.type === "receivable" ? "text-yellow-400" : "text-blue-400"}`}>
                                          {d.type === "receivable" ? "Debe" : "Saldo a favor"}
                                        </span>
                                        {d.status === "cancelled" && <span className="rounded-md bg-gray-500/15 px-1.5 py-0.5 text-[9px] font-bold text-gray-400 mr-1.5">CANCELADA</span>}
                                        {d.status === "archived" && <span className="rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-400 mr-1.5">ARCHIVADA</span>}
                                        <span className="text-text-muted text-xs">{fmt(d.created_at)} · {d.note}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-green-400 line-through">{fmtAmt(d.original_amount, d.currency)}</span>
                                        <button onClick={() => handleDeleteDebt(d.id)} disabled={deletingDebt === d.id} className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50" title="Eliminar registro">
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                    {dPayments.length > 0 && (
                                      <div className="px-4 pb-2 space-y-1 border-t border-border/50 pt-2">
                                        {dPayments.map(p => (
                                          <p key={p.id} className="text-xs text-text-muted">{fmt(p.created_at)} — Pagó {fmtAmt(p.amount, d.currency)} ({p.caja})</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

              </>
            );
          })()}

        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { pending: "bg-amber-500/15 text-amber-400", partial: "bg-blue-500/15 text-blue-400", paid: "bg-green-500/15 text-green-400" };
  const label: Record<string, string> = { pending: "Pendiente", partial: "Parcial", paid: "Saldada" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] || map.pending}`}>{label[status] || status}</span>;
}
