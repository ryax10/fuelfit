"use client";
import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { getProfitDataAction } from "@/app/admin/actions";

type ProfitData = Awaited<ReturnType<typeof getProfitDataAction>>;

const usd = (n: number) => `U$D ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

export default function ProfitPage() {
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    setData(await getProfitDataAction(period));
    setLoading(false);
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Reporte de Ganancias</h1>
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
        <div className="flex items-center justify-center py-20 text-text-muted text-sm">Calculando...</div>
      ) : !data ? null : (
        <>
          {/* Cards resumen */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="INGRESOS BRUTOS" value={usd(data.totalRevenueUsd)} sub={`${data.orderProfits.length} ventas · ${data.totalUnitsSold} unidades`} color="blue" />
            <SummaryCard label="COSTO MERCADERÍA" value={usd(data.totalCogsUsd)} sub={`${data.orderProfits.length} ventas · ${data.totalUnitsSold} unidades`} color="orange" negative />
            <SummaryCard label="GANANCIA BRUTA" value={usd(data.totalGrossProfitUsd)} sub={`Margen ${data.totalRevenueUsd > 0 ? ((data.totalGrossProfitUsd / data.totalRevenueUsd) * 100).toFixed(1) : 0}%`} color="green" />
            <SummaryCard label="GASTOS OPERATIVOS" value={usd(data.totalExpensesUsd)} sub={data.totalOtherIncomeUsd > 0 ? `+ otros ingresos ${usd(data.totalOtherIncomeUsd)}` : ""} color="red" negative />
          </div>

          {/* Ganancia neta — prominente */}
          <div className={`mb-6 rounded-xl border-2 p-6 flex items-center justify-between ${data.netProfitUsd >= 0 ? "border-violet bg-violet/5" : "border-red-500 bg-red-500/5"}`}>
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">GANANCIA NETA DEL PERÍODO</p>
              <p className={`mt-1 font-display text-4xl font-bold ${data.netProfitUsd >= 0 ? "text-violet-light" : "text-red-400"}`}>
                {usd(data.netProfitUsd)}
              </p>
            </div>
            <div className="text-right text-xs text-text-muted space-y-1">
              <p>Bruta: {usd(data.totalGrossProfitUsd)}</p>
              <p>− Gastos: {usd(data.totalExpensesUsd)}</p>
              {data.totalOtherIncomeUsd > 0 && <p>+ Otros ing.: {usd(data.totalOtherIncomeUsd)}</p>}
              <p className="text-[10px]">FX FullVIP venta: ${data.fxFullvip.toLocaleString()}</p>
            </div>
          </div>

          {/* Gastos operativos */}
          <section className="mb-5 rounded-xl border border-border bg-bg-card overflow-x-auto">
            <div className="border-b border-border px-5 py-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">GASTOS OPERATIVOS</p>
              <span className="text-xs font-bold text-red-400">{usd(data.totalExpensesUsd)}</span>
            </div>
            {/* Por categoría */}
            {Object.keys(data.expensesByCategory).length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border">
                {Object.entries(data.expensesByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => (
                    <div key={cat} className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs">
                      <span className="text-text-muted">{cat}: </span>
                      <span className="font-bold text-red-400">{usd(amt)}</span>
                    </div>
                  ))}
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  {["FECHA", "CATEGORÍA", "DESCRIPCIÓN", "MONTO ORIGINAL", "FX USADO", "EN USD"].map(c => (
                    <th key={c} className="px-4 py-2.5 text-[10px] font-semibold tracking-wider text-text-muted whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.expenseDetail.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">Sin gastos operativos en este período</td></tr>
                ) : data.expenseDetail.map((e, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">{fmt(e.date)}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{e.category}</td>
                    <td className="px-4 py-3 text-xs">{e.description}</td>
                    <td className="px-4 py-3 text-xs text-red-400">{e.currency === "USD" ? "U$D" : "$"} {e.amount.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{e.currency === "ARS" ? `$${e.fxUsed.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-red-400">{usd(e.amountUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Otros ingresos (si hay) */}
          {data.otherIncomeDetail.length > 0 && (
            <section className="mb-5 rounded-xl border border-border bg-bg-card overflow-x-auto">
              <div className="border-b border-border px-5 py-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-wider text-text-muted">OTROS INGRESOS</p>
                <span className="text-xs font-bold text-green-400">+ {usd(data.totalOtherIncomeUsd)}</span>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    {["FECHA", "CATEGORÍA", "DESCRIPCIÓN", "MONTO ORIGINAL", "EN USD"].map(c => (
                      <th key={c} className="px-4 py-2.5 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.otherIncomeDetail.map((e, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors">
                      <td className="px-4 py-3 text-text-muted">{fmt(e.date)}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{e.category}</td>
                      <td className="px-4 py-3 text-xs">{e.description}</td>
                      <td className="px-4 py-3 text-xs text-green-400">{e.currency === "USD" ? "U$D" : "$"} {e.amount.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-green-400">{usd(e.amountUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Info FX */}
          <div className="rounded-xl border border-border bg-bg-secondary px-5 py-4 text-xs text-text-muted">
            <p className="font-semibold mb-1">FX utilizado para conversiones ARS → USD</p>
            <p>Se aplicó <span className="font-semibold text-text-secondary">FX FullVIP venta = ${data.fxFullvip.toLocaleString()}</span> a todas las órdenes y movimientos en pesos del período.</p>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color, negative }: { label: string; value: string; sub: string; color: string; negative?: boolean }) {
  const borders: Record<string, string> = { blue: "border-t-blue-400", green: "border-t-green-500", red: "border-t-red-500", orange: "border-t-orange-400" };
  const texts: Record<string, string> = { blue: "text-blue-400", green: "text-green-400", red: "text-red-400", orange: "text-orange-400" };
  return (
    <div className={`rounded-xl border border-border bg-bg-card p-5 border-t-2 ${borders[color]}`}>
      <p className="text-[10px] font-semibold tracking-wider text-text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${texts[color]}`}>{negative ? "− " : ""}{value}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}
