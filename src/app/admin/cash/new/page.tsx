"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addCashMovementAction } from "@/app/admin/actions";

type MainType = "manual_income" | "manual_expense" | "ajuste";

export default function NewCashMovePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [mainType, setMainType] = useState<MainType>("manual_income");
  const [ajusteDir, setAjusteDir] = useState<"ajuste_in" | "ajuste_out">("ajuste_in");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [caja, setCaja] = useState("Oficina");
  const [entity, setEntity] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const resolvedType = mainType === "ajuste" ? ajusteDir : mainType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    try {
      await addCashMovementAction({
        type: resolvedType,
        amount: parseFloat(amount),
        currency,
        caja,
        category: entity || (mainType === "manual_income" ? "Ingreso" : mainType === "manual_expense" ? "Egreso" : "Ajuste"),
        note,
        ...(date ? { created_at: `${date}T12:00:00.000Z` } : {}),
      });
      router.push("/admin/cash");
    } catch (err) {
      alert("Error al registrar movimiento: " + (err instanceof Error ? err.message : "Error desconocido"));
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Nuevo Movimiento de Caja</h1>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">

        {/* Tipo */}
        <div>
          <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-2">TIPO *</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMainType("manual_income")}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${mainType === "manual_income" ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-border text-text-muted hover:bg-bg-hover"}`}>
              ➕ Ingreso
            </button>
            <button type="button" onClick={() => setMainType("manual_expense")}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${mainType === "manual_expense" ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border text-text-muted hover:bg-bg-hover"}`}>
              ➖ Egreso
            </button>
            <button type="button" onClick={() => setMainType("ajuste")}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${mainType === "ajuste" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" : "border-border text-text-muted hover:bg-bg-hover"}`}>
              ↔ Ajuste
            </button>
          </div>
        </div>

        {/* Sub-dirección para ajuste */}
        {mainType === "ajuste" && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
            <p className="text-[10px] font-semibold tracking-wider text-yellow-500/70">
              Los ajustes NO afectan las ganancias. Usalos para transferencias entre cajas o cambios de moneda.
            </p>
            <div>
              <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-2">DIRECCIÓN EN ESTA CAJA *</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAjusteDir("ajuste_in")}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${ajusteDir === "ajuste_in" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" : "border-border text-text-muted hover:bg-bg-hover"}`}>
                  ↑ Entra a la caja
                </button>
                <button type="button" onClick={() => setAjusteDir("ajuste_out")}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${ajusteDir === "ajuste_out" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" : "border-border text-text-muted hover:bg-bg-hover"}`}>
                  ↓ Sale de la caja
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">MONTO *</label>
            <input type="number" required min={0} step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">MONEDA</label>
            <select value={currency} onChange={e => setCurrency(e.target.value as "ARS" | "USD")}
              className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm">
              <option>ARS</option><option>USD</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">CAJA *</label>
            <select value={caja} onChange={e => setCaja(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm">
              <option>Oficina</option><option>Luciano</option><option>Santiago</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">CLIENTE / PROVEEDOR</label>
          <input value={entity} onChange={e => setEntity(e.target.value)}
            placeholder="Ej: Juan García, DHL, Banco..."
            className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" />
        </div>

        <div>
          <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">NOTA</label>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Descripción del movimiento..."
            className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" />
        </div>

        <div>
          <label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">FECHA</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" />
          <p className="text-[10px] text-text-muted mt-1">Por defecto: hoy. Modificá si estás cargando un movimiento de otro día.</p>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving || !amount}
            className="rounded-xl bg-violet px-6 py-3 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50 transition-all">
            {saving ? "Guardando..." : "💾 Registrar"}
          </button>
          <Link href="/admin/cash" className="rounded-xl border border-border px-6 py-3 text-sm text-text-muted hover:bg-bg-hover transition-all">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
