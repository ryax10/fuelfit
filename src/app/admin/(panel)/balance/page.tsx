"use client";
import { useState, useEffect } from "react";
import { Scale, TrendingUp, TrendingDown, RefreshCw, Lock } from "lucide-react";
import { getCurrentBalanceAction, closeMonthAction, getBalanceSnapshotsAction } from "@/app/admin/actions";
import type { LiveBalance, BalanceSnapshot } from "@/app/admin/actions";

const usd = (n: number) => `U$D ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt0 = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function periodLabel(period: string) {
  const [year, month] = period.split("-");
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
}

export default function BalancePage() {
  const [live, setLive] = useState<LiveBalance | null>(null);
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<BalanceSnapshot | null>(null);

  const load = async () => {
    setLoading(true);
    const [liveData, snaps] = await Promise.all([
      getCurrentBalanceAction(),
      getBalanceSnapshotsAction(),
    ]);
    setLive(liveData);
    setSnapshots(snaps);
    if (snaps.length > 0 && !selected) setSelected(snaps[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleClose = async () => {
    setCloseConfirm(false);
    setClosing(true);
    try {
      const { period } = await closeMonthAction();
      setCloseSuccess(periodLabel(period));
      await load();
    } catch (err) {
      alert("Error al cerrar el mes: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-text-muted text-sm">Calculando balance...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Balance General</h1>
          <p className="mt-1 text-xs text-text-muted">Patrimonio Neto = Activos − Pasivos</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all">
            <RefreshCw size={14} /> Actualizar
          </button>
          {!closeConfirm ? (
            <button onClick={() => setCloseConfirm(true)} disabled={closing}
              className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50 transition-all">
              <Lock size={14} /> {closing ? "Cerrando..." : "Cerrar mes"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">¿Confirmar cierre?</span>
              <button onClick={handleClose} className="rounded-xl bg-violet px-3 py-2 text-sm font-bold text-white hover:bg-violet-dark">Sí</button>
              <button onClick={() => setCloseConfirm(false)} className="rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-bg-hover">No</button>
            </div>
          )}
        </div>
      </div>

      {closeSuccess && (
        <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-3 text-sm text-green-400">
          ✅ Balance de <strong>{closeSuccess}</strong> cerrado y guardado correctamente.
        </div>
      )}

      {/* Balance actual (live) */}
      {live && (
        <div className="mb-6 rounded-xl border-2 border-violet bg-violet/5 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Scale size={20} className="text-violet-light" />
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-text-muted">BALANCE ACTUAL (EN TIEMPO REAL)</p>
                <p className="text-xs text-text-muted mt-0.5">
                  FX caja/stock: 1 USDT = ${fmt0(live.fxRate)} ARS · FX deudas: 1 USDT = ${fmt0(live.fxRateDebts)} ARS
                  <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${live.fxRateDebtsSource === "fullvip" ? "bg-violet/15 text-violet-light" : "bg-yellow-500/15 text-yellow-400"}`}>
                    {live.fxRateDebtsSource === "fullvip" ? "PROMEDIO FULLVIP" : "FALLBACK CONFIG"}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">PATRIMONIO NETO</p>
              <p className={`font-display text-4xl font-bold ${live.patrimonioNeto >= 0 ? "text-green-400" : "text-red-400"}`}>
                {usd(live.patrimonioNeto)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Activos */}
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-green-400 mb-3 flex items-center gap-1.5"><TrendingUp size={12} /> ACTIVOS</p>
              <div className="space-y-2">
                <BalanceRow label="Stock mercadería (precio venta x15)" value={usd(live.stockValueUSD)} color="green" />
                {/* Desglose de caja por persona */}
                {Object.entries(live.cajaBreakdown).sort(([a],[b]) => a.localeCompare(b)).map(([caja, bal]) => (
                  <div key={caja} className="pl-2 border-l border-green-500/20 space-y-0.5">
                    {bal.usd !== 0 && (
                      <BalanceRow label={`Caja ${caja} (USD)`} value={usd(bal.usd)} color={bal.usd >= 0 ? "green" : "red"} />
                    )}
                    {bal.ars !== 0 && (
                      <BalanceRow label={`Caja ${caja} (${fmt0(bal.ars)} ARS ÷ ${fmt0(live.fxRate)})`} value={usd(bal.ars / live.fxRate)} color={bal.ars >= 0 ? "green" : "red"} />
                    )}
                  </div>
                ))}
                {live.inTransitValueUSD > 0 && (
                  <BalanceRow label="Mercadería en camino (al costo)" value={usd(live.inTransitValueUSD)} color="green" />
                )}
                {live.receivableUSD > 0 && (
                  <BalanceRow label="Deudas a cobrar (USD)" value={usd(live.receivableUSD)} color="green" />
                )}
                {live.receivableARS > 0 && (
                  <BalanceRow label={`Deudas a cobrar ARS (÷ ${fmt0(live.fxRateDebts)})`} value={usd(live.receivableARS / live.fxRateDebts)} color="green" />
                )}
                <div className="border-t border-green-500/20 pt-2 flex justify-between">
                  <span className="text-sm font-bold text-green-400">TOTAL ACTIVOS</span>
                  <span className="font-display text-base font-bold text-green-400">{usd(live.totalAssetsUSD)}</span>
                </div>
              </div>
            </div>

            {/* Pasivos */}
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-red-400 mb-3 flex items-center gap-1.5"><TrendingDown size={12} /> PASIVOS</p>
              <div className="space-y-2">
                {live.payableUSD > 0 ? (
                  <BalanceRow label="Deudas a pagar (USD)" value={usd(live.payableUSD)} color="red" />
                ) : null}
                {live.payableARS > 0 ? (
                  <BalanceRow label={`Deudas a pagar ARS (÷ ${fmt0(live.fxRateDebts)})`} value={usd(live.payableARS / live.fxRateDebts)} color="red" />
                ) : null}
                {live.payableUSD === 0 && live.payableARS === 0 && (
                  <p className="text-sm text-text-muted py-2">Sin deudas a pagar</p>
                )}
                <div className="border-t border-red-500/20 pt-2 flex justify-between">
                  <span className="text-sm font-bold text-red-400">TOTAL PASIVOS</span>
                  <span className="font-display text-base font-bold text-red-400">{usd(live.totalLiabilitiesUSD)}</span>
                </div>
              </div>

              {/* Ecuación final */}
              <div className="mt-6 rounded-xl border border-violet/30 bg-bg-secondary p-4">
                <div className="flex justify-between text-sm mb-1"><span className="text-text-muted">Activos</span><span className="text-green-400">{usd(live.totalAssetsUSD)}</span></div>
                <div className="flex justify-between text-sm mb-2"><span className="text-text-muted">− Pasivos</span><span className="text-red-400">{usd(live.totalLiabilitiesUSD)}</span></div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-bold text-sm">= Patrimonio Neto</span>
                  <span className={`font-display text-lg font-bold ${live.patrimonioNeto >= 0 ? "text-green-400" : "text-red-400"}`}>{usd(live.patrimonioNeto)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial de cierres */}
      <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">HISTORIAL DE CIERRES MENSUALES</p>
          <p className="text-xs text-text-muted">{snapshots.length} cierre{snapshots.length !== 1 ? "s" : ""}</p>
        </div>

        {snapshots.length === 0 ? (
          <div className="px-5 py-12 text-center text-text-muted">
            <p className="font-medium">Sin cierres registrados</p>
            <p className="text-sm mt-1">Usá el botón <strong>"Cerrar mes"</strong> para guardar el balance actual.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[200px_1fr]">
            {/* Lista */}
            <div className="border-r border-border overflow-y-auto max-h-[500px]">
              {snapshots.map(s => (
                <button key={s.id} onClick={() => setSelected(s)}
                  className={`flex w-full flex-col px-4 py-3 text-left text-sm transition-colors hover:bg-bg-hover border-b border-border last:border-0 ${selected?.id === s.id ? "border-l-2 border-violet bg-violet/10" : ""}`}>
                  <span className={`font-semibold ${selected?.id === s.id ? "text-violet-light" : "text-text-primary"}`}>{periodLabel(s.period)}</span>
                  <span className={`text-xs mt-0.5 font-bold ${s.patrimonio_neto_usd >= 0 ? "text-green-400" : "text-red-400"}`}>{usd(s.patrimonio_neto_usd)}</span>
                </button>
              ))}
            </div>

            {/* Detalle */}
            {selected && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-display text-lg font-bold">{periodLabel(selected.period)}</h3>
                  <div className="text-right">
                    {selected.snapshot_date && <p className="text-xs text-text-muted">Cerrado el {selected.snapshot_date}</p>}
                    <p className={`font-display text-2xl font-bold ${selected.patrimonio_neto_usd >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {usd(selected.patrimonio_neto_usd)}
                    </p>
                    <p className="text-[10px] text-text-muted">PATRIMONIO NETO</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-green-400 mb-2">ACTIVOS</p>
                    <div className="space-y-1.5">
                      <BalanceRow label="Stock (precio venta x15)" value={usd(selected.stock_value_usd || selected.inventory_cost_usd)} color="green" small />
                      <BalanceRow label="Caja USD" value={usd(selected.cash_usd)} color="green" small />
                      <BalanceRow label={`Caja ARS (÷ ${fmt0(selected.fx_usdt_ars)})`} value={usd(selected.cash_ars / selected.fx_usdt_ars)} color="green" small />
                      {(selected.in_transit_value_usd || 0) > 0 && (
                        <BalanceRow label="En camino" value={usd(selected.in_transit_value_usd)} color="green" small />
                      )}
                      {selected.receivable_usd > 0 && <BalanceRow label="Cuentas por cobrar USD" value={usd(selected.receivable_usd)} color="green" small />}
                      {(selected.receivable_ars || 0) > 0 && <BalanceRow label={`Cuentas por cobrar ARS (÷ ${fmt0(selected.fx_usdt_ars)})`} value={usd(selected.receivable_ars / selected.fx_usdt_ars)} color="green" small />}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-red-400 mb-2">PASIVOS</p>
                    <div className="space-y-1.5">
                      {selected.payable_usd > 0 ? <BalanceRow label="Deudas a pagar USD" value={usd(selected.payable_usd)} color="red" small /> : null}
                      {selected.payable_ars > 0 ? <BalanceRow label={`Deudas a pagar ARS (÷ ${fmt0(selected.fx_usdt_ars)})`} value={usd(selected.payable_ars / selected.fx_usdt_ars)} color="red" small /> : null}
                      {selected.payable_usd === 0 && selected.payable_ars === 0 && <p className="text-sm text-text-muted">Sin pasivos</p>}
                    </div>
                    <div className="mt-3 rounded-lg bg-bg-secondary p-3">
                      <p className="text-[10px] text-text-muted mb-1">FX al cierre: 1 USDT = ${fmt0(selected.fx_usdt_ars)} ARS</p>
                      {selected.notes && <p className="text-xs text-text-muted">{selected.notes}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceRow({ label, value, color, small }: { label: string; value: string; color: "green" | "red"; small?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-text-muted ${small ? "text-xs" : "text-sm"}`}>{label}</span>
      <span className={`font-semibold shrink-0 ${small ? "text-xs" : "text-sm"} ${color === "green" ? "text-green-400" : "text-red-400"}`}>{value}</span>
    </div>
  );
}
