"use client";
import React from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TrendingUp, ArrowDownUp, Wallet, Clock, Scale, ClipboardCopy, Check, Zap, Shirt, Package, Tag, Ticket, X, Eye, EyeOff, Bell, BellOff } from "lucide-react";
import { getDashboardDataAction, getBinanceP2PAction, getDolarCriptoAction, getCurrentBalanceAction, getBalanceSnapshotsAction, generateDiscountCodeAction, getPendingOrdersCountAction } from "@/app/admin/actions";
import type { LiveBalance, BalanceSnapshot, Debt } from "@/app/admin/actions";

type DashData = Awaited<ReturnType<typeof getDashboardDataAction>>;

export default function AdminDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [p2p, setP2p] = useState<{ buy: number | null; sell: number | null } | null>(null);
  const [cripto, setCripto] = useState<{ compra: number | null; venta: number | null } | null>(null);
  const [loadingP2p, setLoadingP2p] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [liveBalance, setLiveBalance] = useState<LiveBalance | null>(null);
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);
  const [discountModal, setDiscountModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountCurrency, setDiscountCurrency] = useState<"ARS" | "USD">("USD");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [valuesHidden, setValuesHidden] = useState(false);
  const [muted, setMuted] = useState(false);
  const pendingBaseline = useRef<{ count: number; latestId: string | null } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Reemplaza dígitos por • cuando el modo privacidad está activo. Mantiene
  // letras (USDT, U$D, ARS) y formato (puntos, comas) para que la UI no salte.
  const m = (s: string) => valuesHidden ? s.replace(/\d/g, "•") : s;

  // Beep corto generado con Web Audio (sin archivos). Dos pulsos para que llame la atención.
  const playBeep = () => {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      [0, 0.18].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch {
      // Fallo silencioso (autoplay blocked, etc.)
    }
  };

  useEffect(() => {
    // Restaurar preferencia de mute desde sesión
    if (typeof window !== "undefined") {
      setMuted(localStorage.getItem("admin_mute_orders") === "1");
    }
    getDashboardDataAction().then(setData).catch(() => setLoadError(true));
    getCurrentBalanceAction().then(setLiveBalance).catch(() => {});
    getBalanceSnapshotsAction().then(setSnapshots).catch(() => {});
    fetchP2p();
    getDolarCriptoAction().then(setCripto).catch(() => {});
  }, []);

  // Polling cada 15s para detectar pedidos nuevos. Beep si cambia el contador o el último id.
  // mutedRef permite leer el flag actual sin re-crear el interval.
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => {
    const check = async () => {
      try {
        const snap = await getPendingOrdersCountAction();
        const prev = pendingBaseline.current;
        if (prev) {
          const cameInNew = snap.count > prev.count || (snap.count > 0 && snap.latestId !== prev.latestId);
          if (cameInNew && !mutedRef.current) playBeep();
          // También actualizamos el dashboard si entró algo nuevo
          if (cameInNew) getDashboardDataAction().then(setData).catch(() => {});
        }
        pendingBaseline.current = snap;
      } catch {
        // Si la sesión cae o hay error de red, no rompemos el dashboard
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      if (typeof window !== "undefined") localStorage.setItem("admin_mute_orders", next ? "1" : "0");
      return next;
    });
  };

  const fetchP2p = async () => {
    if (loadingP2p) return;
    setSpinKey(k => k + 1);
    setLoadingP2p(true);
    try {
      const [p2pResult, criptoResult] = await Promise.all([getBinanceP2PAction(), getDolarCriptoAction()]);
      setP2p(p2pResult);
      setCripto(criptoResult);
    } catch {
      // fallo silencioso — el usuario puede reintentar con el botón
    } finally {
      setLoadingP2p(false);
    }
  };

  const buildStockText = (products: NonNullable<DashData>["products"]) => {
    const withStock = products
      .filter(p => p.stock_actual > 0)
      .sort((a, b) => {
        if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
        if (a.model !== b.model) return (a.model || "").localeCompare(b.model || "");
        return (a.flavor || "").localeCompare(b.flavor || "");
      });
    const groups: { key: string; label: string; items: typeof withStock }[] = [];
    for (const p of withStock) {
      const key = `${p.brand}|${p.model || ""}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(p);
      else groups.push({ key, label: [p.brand, p.model].filter(Boolean).join(" ").toUpperCase(), items: [p] });
    }
    const stockLabel = (p: (typeof withStock)[number]) => `${p.stock_actual}`;
    return groups.map(g => [`*${g.label}*`, ...g.items.map(p => `${stockLabel(p)} ${p.flavor || p.name}`)].join("\n")).join("\n\n");
  };

  const doCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleGenerateCode = async () => {
    const amt = parseFloat(discountAmount);
    if (!amt || amt <= 0) return;
    setGeneratingCode(true);
    const code = await generateDiscountCodeAction(amt, discountCurrency);
    setGeneratedCode(code);
    setGeneratingCode(false);
  };

  const handleCopyStock    = () => data && doCopy("all",  buildStockText(data.products));
  const handleCopySupl     = () => data && doCopy("supl", buildStockText(data.products.filter(p => p.category === "suplementos")));
  const handleCopyRopa     = () => data && doCopy("ropa", buildStockText(data.products.filter(p => p.category === "ropa")));
  const handleCopyAcc      = () => data && doCopy("acc",  buildStockText(data.products.filter(p => p.category === "accesorios")));

  const handleCopyPrices = () => {
    if (!data) return;
    const CAT_LABELS: Record<string, string> = { suplementos: "💪💪💪 SUPLEMENTOS", ropa: "👕👕👕 ROPA", accesorios: "📦📦📦 ACCESORIOS" };
    const byCategory = ["suplementos", "ropa", "accesorios"].map(cat => {
      const products = data.products
        .filter(p => p.category === cat && p.visible)
        .sort((a, b) => {
          if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
          if (a.model !== b.model) return (a.model || "").localeCompare(b.model || "");
          return (a.flavor || "").localeCompare(b.flavor || "");
        });
      if (products.length === 0) return null;
      const groups: { key: string; label: string; items: typeof products }[] = [];
      for (const p of products) {
        const key = `${p.brand}|${p.model || ""}`;
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.items.push(p);
        else groups.push({ key, label: [p.brand, p.model].filter(Boolean).join(" ").toUpperCase(), items: [p] });
      }
      const body = groups.map(g => {
        const ref = g.items[0];
        const p15  = ref.price_may_x15  > 0 ? `×15 → U$D ${ref.price_may_x15}`  : null;
        const p50  = ref.price_may_x50  > 0 ? `×50 → U$D ${ref.price_may_x50}`  : null;
        const p100 = ref.price_may_x100 > 0 ? `×100 → U$D ${ref.price_may_x100}` : null;
        const prices = [p15, p50, p100].filter(Boolean).join("\n");
        const flavors = g.items.map(p => `${p.stock_actual > 0 ? p.stock_actual : "—"} ${p.flavor || p.name}`).join("\n");
        return [g.label, prices, flavors].filter(Boolean).join("\n");
      }).join("\n\n");
      return `${CAT_LABELS[cat]}\n\n${body}`;
    }).filter(Boolean);

    const text = `💪 *FUELFIT — PRECIOS MAYORISTA*\n\n${byCategory.join("\n\n─────────────\n\n")}`;
    doCopy("prices", text);
  };

  if (loadError) {
    return <div className="py-16 text-center text-red-400 text-sm">Error al cargar el dashboard. Recargá la página.</div>;
  }

  if (!data) {
    return <div className="py-16 text-center text-text-muted text-sm">Cargando dashboard...</div>;
  }

  const { cash, byCaja, pendingOrdersList } = data;
  const cashTotalUSD = cash.usd;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <button
            onClick={() => setValuesHidden(v => !v)}
            title={valuesHidden ? "Mostrar números" : "Ocultar números"}
            className={`flex items-center justify-center rounded-xl border px-2.5 py-2 transition-all ${valuesHidden ? "border-violet/40 bg-violet/10 text-violet-light" : "border-border bg-bg-card text-text-muted hover:bg-bg-hover"}`}
          >
            {valuesHidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            onClick={toggleMute}
            title={muted ? "Activar sonido de pedidos nuevos" : "Silenciar pedidos nuevos"}
            className={`flex items-center justify-center rounded-xl border px-2.5 py-2 transition-all ${muted ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border bg-bg-card text-text-muted hover:bg-bg-hover"}`}
          >
            {muted ? <BellOff size={15} /> : <Bell size={15} />}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Precio mayorista — botón especial */}
          <button onClick={handleCopyPrices} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${copied === "prices" ? "border-violet bg-violet/10 text-violet-light" : "border-violet/40 bg-violet/5 text-violet-light hover:bg-violet/10"}`}>
            {copied === "prices" ? <Check size={13} /> : <Tag size={13} />}
            {copied === "prices" ? "¡Copiado!" : "Precios"}
          </button>

          {/* Separador visual */}
          <div className="w-px h-5 bg-border" />

          {/* Stock completo */}
          <button onClick={handleCopyStock} className={`flex items-center gap-1.5 rounded-xl border border-border bg-bg-card px-3 py-2 text-xs font-semibold transition-all ${copied === "all" ? "text-green-400" : "text-text-muted hover:bg-bg-hover"}`}>
            {copied === "all" ? <Check size={13} /> : <ClipboardCopy size={13} />}
            {copied === "all" ? "¡Copiado!" : "Todo"}
          </button>

          {/* Por categoría */}
          <button onClick={handleCopySupl} className={`flex items-center gap-1.5 rounded-xl border border-border bg-bg-card px-3 py-2 text-xs font-semibold transition-all ${copied === "supl" ? "border-sky-500/40 text-sky-400" : "text-text-muted hover:bg-bg-hover"}`}>
            {copied === "supl" ? <Check size={13} /> : <Zap size={13} />}
            {copied === "supl" ? "¡Copiado!" : "Suplementos"}
          </button>
          <button onClick={handleCopyRopa} className={`flex items-center gap-1.5 rounded-xl border border-border bg-bg-card px-3 py-2 text-xs font-semibold transition-all ${copied === "ropa" ? "border-green-500/40 text-green-400" : "text-text-muted hover:bg-bg-hover"}`}>
            {copied === "ropa" ? <Check size={13} /> : <Shirt size={13} />}
            {copied === "ropa" ? "¡Copiado!" : "Ropa"}
          </button>
          <button onClick={handleCopyAcc} className={`flex items-center gap-1.5 rounded-xl border border-border bg-bg-card px-3 py-2 text-xs font-semibold transition-all ${copied === "acc" ? "border-orange-500/40 text-orange-400" : "text-text-muted hover:bg-bg-hover"}`}>
            {copied === "acc" ? <Check size={13} /> : <Package size={13} />}
            {copied === "acc" ? "¡Copiado!" : "Accesorios"}
          </button>

          {/* Separador */}
          <div className="w-px h-5 bg-border" />

          {/* Código de descuento */}
          <button onClick={() => { setDiscountModal(true); setGeneratedCode(null); setDiscountAmount(""); }} className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition-all">
            <Ticket size={13} /> Código descuento
          </button>
        </div>
      </div>

      {/* Modal generador de código de descuento */}
      {discountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold flex items-center gap-2"><Ticket size={18} className="text-amber-400" /> Generar Descuento</h2>
              <button onClick={() => setDiscountModal(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            </div>
            {!generatedCode ? (
              <div className="space-y-4">
                <p className="text-xs text-text-muted">El código generado es de un solo uso y aplicable en la tienda minorista y mayorista.</p>
                <div>
                  <label className="text-xs font-semibold text-text-secondary block mb-1.5">MONEDA</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDiscountCurrency("USD")} className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${discountCurrency === "USD" ? "border-violet bg-violet/10 text-violet-light" : "border-border text-text-muted"}`}>U$D</button>
                    <button type="button" onClick={() => setDiscountCurrency("ARS")} className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${discountCurrency === "ARS" ? "border-violet bg-violet/10 text-violet-light" : "border-border text-text-muted"}`}>ARS</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary block mb-1.5">MONTO A DESCONTAR</label>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    placeholder={discountCurrency === "USD" ? "Ej: 10" : "Ej: 5000"}
                    className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleGenerateCode}
                  disabled={generatingCode || !discountAmount || parseFloat(discountAmount) <= 0}
                  className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-all"
                >
                  {generatingCode ? "Generando..." : "Generar código"}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-xs text-text-muted">Código generado — uso único, válido en minorista y mayorista</p>
                <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="font-display text-2xl font-bold tracking-widest text-amber-400">{generatedCode}</p>
                  <p className="mt-1 text-sm text-text-muted">Descuento: {discountCurrency === "USD" ? "U$D" : "$"} {parseFloat(discountAmount).toLocaleString()}</p>
                </div>
                <p className="text-xs text-text-muted">Aplicable en minorista y mayorista. Uso único.</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(generatedCode); doCopy("discount_code", generatedCode); }}
                  className={`w-full rounded-xl border py-2.5 text-sm font-bold transition-all ${copied === "discount_code" ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-border text-text-secondary hover:bg-bg-hover"}`}
                >
                  {copied === "discount_code" ? "✓ ¡Copiado!" : "Copiar código"}
                </button>
                <button onClick={() => { setGeneratedCode(null); setDiscountAmount(""); }} className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors">
                  Generar otro
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Métricas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard
          label="STOCK"
          value={m(`${data.totalStock.toLocaleString("es-AR")} unidades`)}
          sub={m(`U$D ${data.stockValueUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })} · ARS ${data.stockValueARS.toLocaleString("es-AR")}`)}
          color="green"
        />
        <MetricCard
          label="PATRIMONIO NETO"
          value={liveBalance ? m(`U$D ${liveBalance.patrimonioNeto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`) : "—"}
          sub={liveBalance ? m(`ARS ${(liveBalance.patrimonioNeto * liveBalance.fxRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`) : "Calculando..."}
          color="amber"
          negative={!!liveBalance && liveBalance.patrimonioNeto < 0}
        />
        <MetricCard
          label="VENTAS HOY"
          value={m(`USDT ${data.salesTodayUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}
          sub={m(`${data.salesTodayCount} pedidos · ${data.salesTodayUnits} uds · Ganancia U$D ${data.salesTodayProfitUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}
          color="green"
        />
        <MetricCard
          label="VENTAS DEL MES"
          value={m(`USDT ${data.salesMonthUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}
          sub={m(`${data.salesMonthCount} pedidos · ${data.salesMonthUnits} uds · Ganancia U$D ${data.monthGrossProfitUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}
          color="violet"
        />
      </div>

      {/* Pedidos Pendientes */}
      <div className={`rounded-xl border bg-bg-card p-5 mb-6 transition-all ${data.pendingOrdersCount > 0 ? "border-red-500/40 ring-1 ring-red-500/20" : "border-border"}`}>
        <h3 className="font-display text-base font-bold flex items-center gap-2">
          <Clock size={16} className={data.pendingOrdersCount > 0 ? "text-red-400" : "text-yellow-400"} />
          Pedidos Pendientes
          {data.pendingOrdersCount > 0 && (
            <span className="relative flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
              <span className="relative">{m(String(data.pendingOrdersCount))}</span>
            </span>
          )}
        </h3>
        {pendingOrdersList.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted text-center py-4">Sin pedidos pendientes</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pendingOrdersList.map(o => (
              <Link key={o.id} href={`/admin/sales/${o.id}`} className="flex items-center justify-between rounded-lg bg-bg-secondary p-3 hover:bg-bg-hover transition-colors">
                <div><span className="text-sm font-medium">#{o.number}</span><span className="ml-2 text-xs text-text-muted">{o.customer_name}</span></div>
                <span className="text-sm font-semibold">{m(`$${o.total.toLocaleString()}`)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Resultado del Mes Actual + Binance P2P */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <h3 className="font-display text-base font-bold flex items-center gap-2 mb-4"><TrendingUp size={16} className="text-green-400" /> Resultado del Mes Actual</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">INGRESOS BRUTOS</p>
              <p className="mt-1 font-display text-base font-bold text-green-400">{m(`U$D ${data.monthIncomeUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">COSTO MERCADERÍA</p>
              <p className="mt-1 font-display text-base font-bold text-orange-400">{m(`U$D ${data.monthCogsUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">GANANCIA BRUTA</p>
              <p className={`mt-1 font-display text-base font-bold ${data.monthGrossProfitUSD >= 0 ? "text-green-400" : "text-red-400"}`}>{m(`U$D ${data.monthGrossProfitUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-3 text-center">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">GASTOS OPERATIVOS</p>
              <p className="mt-1 font-display text-base font-bold text-red-400">{m(`U$D ${data.monthExpensesOpUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-violet bg-violet/5 p-3 text-center">
            <p className="text-[10px] font-semibold tracking-wider text-text-muted">GANANCIA NETA</p>
            <p className={`mt-1 font-display text-xl font-bold ${data.monthProfitUSD >= 0 ? "text-violet-light" : "text-red-400"}`}>{m(`U$D ${data.monthProfitUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>
          </div>
        </div>

        {/* Cotizaciones cripto */}
        {(() => {
          const nuestraCompra = p2p?.buy != null && cripto?.compra != null ? (p2p.buy + cripto.compra) / 2 : null;
          const nuestraVenta  = p2p?.sell != null && cripto?.venta != null  ? (p2p.sell + cripto.venta) / 2  : null;
          return (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">

              {/* Fila Binance */}
              <RateRow
                logo={
                  <button onClick={fetchP2p} disabled={loadingP2p} title="Actualizar" className={`shrink-0 transition-opacity ${loadingP2p ? "opacity-50 cursor-not-allowed" : "hover:opacity-75 cursor-pointer"}`}>
                    <svg key={spinKey} width="48" height="48" viewBox="0 0 511.97 511.97" xmlns="http://www.w3.org/2000/svg"
                      style={spinKey > 0 ? { animation: "spin 0.6s cubic-bezier(0.4,0,0.2,1)" } : {}}>
                      <path fill="#F3BA2F" d="M156.56,215.14,256,115.71l99.47,99.47,57.86-57.85L256,0,98.71,157.28l57.85,57.85M0,256l57.86-57.87L115.71,256,57.85,313.83Zm156.56,40.85L256,396.27l99.47-99.47,57.89,57.82,0,0L256,512,98.71,354.7l-.08-.09,57.93-57.77M396.27,256l57.85-57.85L512,256l-57.85,57.85Z"/>
                      <path fill="#F3BA2F" d="M314.66,256h0L256,197.25,212.6,240.63h0l-5,5L197.33,255.9l-.08.08.08.08L256,314.72l58.7-58.7,0,0-.05,0"/>
                    </svg>
                  </button>
                }
                label="BINANCE P2P · USDT/ARS"
                compra={p2p?.buy ?? null}
                venta={p2p?.sell ?? null}
                loading={loadingP2p}
              />

              <div className="border-t border-yellow-500/10" />

              {/* Fila DolarHoy */}
              <RateRow
                logo={
                  <div className="shrink-0 w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#06b6d4" fontFamily="serif">$</text>
                    </svg>
                  </div>
                }
                label="DOLAR HOY · CRIPTO"
                compra={cripto?.compra ?? null}
                venta={cripto?.venta ?? null}
                loading={loadingP2p}
              />

              <div className="border-t border-yellow-500/10" />

              {/* Fila FullVIP — promedio */}
              <RateRow
                logo={
                  <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-bg-card" style={{ isolation: "isolate" }}>
                    <img src="/logo.jpg" alt="FullVIP" className="w-full h-full object-contain" style={{ mixBlendMode: "screen" }} />
                  </div>
                }
                label="FULL VIP · PROMEDIO"
                compra={nuestraCompra}
                venta={nuestraVenta}
                loading={loadingP2p}
                highlight
              />
            </div>
          );
        })()}
      </div>

      {/* Flujo de Caja */}
      <div className="rounded-xl border border-border bg-bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-bold flex items-center gap-2"><Wallet size={16} className="text-violet-light" /> Flujo de Caja</h3>
          <Link href="/admin/cash" className="text-xs text-violet-light hover:text-violet">Ver todo →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {["Luciano", "Santiago", "Oficina"].map(name => {
            const c = byCaja[name] || { ars: 0, usd: 0 };
            return (
              <div key={name} className="rounded-xl border border-border bg-bg-secondary p-5">
                <p className="font-display font-bold text-lg mb-4 text-text-primary">{name}</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">ARS</p>
                    <p className="font-display text-xl font-bold text-green-400">{m(`$${c.ars.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">USD</p>
                    <p className="font-display text-xl font-bold text-green-400">{m(`U$D ${c.usd.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deudas */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <DebtList title="Deudas a Cobrar" debts={data.debtsReceivable} color="green" mask={m} />
        <DebtList title="Deudas a Pagar" debts={data.debtsPayable} color="red" mask={m} />
      </div>

      {/* Balance General */}
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-bold flex items-center gap-2"><Scale size={16} className="text-violet-light" /> Balance General</h3>
          <Link href="/admin/balance" className="text-xs text-violet-light hover:text-violet">Ver detalle →</Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {snapshots[1] ? (
            <div className="rounded-xl border border-border bg-bg-secondary p-4">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">CIERRE ANTERIOR</p>
              <p className="text-xs text-text-muted mb-3">{snapshots[1].snapshot_date || snapshots[1].period}</p>
              <p className={`font-display text-xl font-bold ${snapshots[1].patrimonio_neto_usd >= 0 ? "text-green-400" : "text-red-400"}`}>
                {m(`U$D ${snapshots[1].patrimonio_neto_usd.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}
              </p>
              <p className="text-[10px] text-text-muted mt-1">PATRIMONIO NETO</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-bg-secondary p-4 flex items-center justify-center">
              <p className="text-xs text-text-muted text-center">Sin cierre anterior</p>
            </div>
          )}
          {snapshots[0] ? (
            <div className="rounded-xl border border-border bg-bg-secondary p-4">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">ÚLTIMO CIERRE</p>
              <p className="text-xs text-text-muted mb-3">{snapshots[0].snapshot_date || snapshots[0].period}</p>
              <p className={`font-display text-xl font-bold ${snapshots[0].patrimonio_neto_usd >= 0 ? "text-green-400" : "text-red-400"}`}>
                {m(`U$D ${snapshots[0].patrimonio_neto_usd.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}
              </p>
              <p className="text-[10px] text-text-muted mt-1">PATRIMONIO NETO</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-bg-secondary p-4 flex items-center justify-center">
              <p className="text-xs text-text-muted text-center">Sin cierres aún</p>
            </div>
          )}
          {liveBalance ? (
            <div className="rounded-xl border border-violet/30 bg-bg-secondary p-4">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1">BALANCE ACTUAL</p>
              <p className="text-xs text-text-muted mb-3">Hoy — en tiempo real</p>
              <p className={`font-display text-xl font-bold ${liveBalance.patrimonioNeto >= 0 ? "text-green-400" : "text-red-400"}`}>
                {m(`U$D ${liveBalance.patrimonioNeto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}
              </p>
              <p className="text-[10px] text-text-muted mt-1">PATRIMONIO NETO</p>
              {snapshots[0] && (
                <p className={`text-xs mt-2 ${(liveBalance.patrimonioNeto - snapshots[0].patrimonio_neto_usd) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(liveBalance.patrimonioNeto - snapshots[0].patrimonio_neto_usd) >= 0 ? "+" : ""}
                  {m(`U$D ${(liveBalance.patrimonioNeto - snapshots[0].patrimonio_neto_usd).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)} desde último cierre
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-violet/30 bg-bg-secondary p-4 flex items-center justify-center">
              <p className="text-xs text-text-muted">Calculando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RateRow({ logo, label, compra, venta, loading, highlight }: {
  logo: React.ReactNode;
  label: string;
  compra: number | null;
  venta: number | null;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      {logo}
      <div className="flex-1">
        <p className={`text-[10px] font-semibold tracking-widest mb-2 ${highlight ? "text-violet-light" : "text-yellow-500/70"}`}>{label}</p>
        {loading ? (
          <div className="flex gap-6 animate-pulse">
            <div className="h-6 w-20 rounded bg-yellow-500/10" />
            <div className="h-6 w-20 rounded bg-yellow-500/10" />
          </div>
        ) : compra != null ? (
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-text-muted">COMPRA</p>
              <p className={`font-display text-xl font-bold ${highlight ? "text-violet-light" : "text-green-400"}`}>${compra.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <p className="text-[10px] text-text-muted">VENTA</p>
              <p className={`font-display text-xl font-bold ${highlight ? "text-violet-light" : "text-red-400"}`}>${venta?.toLocaleString("es-AR", { maximumFractionDigits: 2 }) ?? "—"}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Sin conexión</p>
        )}
      </div>
    </div>
  );
}

function DebtList({ title, debts, color, mask }: { title: string; debts: Debt[]; color: "green" | "red"; mask: (s: string) => string }) {
  const iconColor = color === "green" ? "text-green-400" : "text-red-400";
  const totalUSD = debts.filter(d => d.currency === "USD").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  const totalARS = debts.filter(d => d.currency === "ARS").reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base font-bold flex items-center gap-2">
          <ArrowDownUp size={16} className={iconColor} /> {title}
        </h3>
        {debts.length > 0 && (
          <div className="text-right text-xs text-text-muted">
            {totalUSD > 0 && <p className={`font-semibold ${iconColor}`}>{mask(`U$D ${totalUSD.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`)}</p>}
            {totalARS > 0 && <p className={`font-semibold ${iconColor}`}>{mask(`$ ${totalARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`)}</p>}
          </div>
        )}
      </div>
      {debts.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-4">Sin deudas pendientes</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {debts.map(d => {
            const pending = d.original_amount - d.paid_amount;
            return (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-bg-secondary px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.entity_name}</p>
                  {d.note && <p className="text-[10px] text-text-muted truncate">{d.note}</p>}
                </div>
                <p className={`text-sm font-bold shrink-0 ml-2 ${iconColor}`}>
                  {mask(`${d.currency === "USD" ? "U$D" : "$"} ${pending.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color, negative }: { label: string; value: string; sub: string; color: string; negative?: boolean }) {
  const borders: Record<string, string> = {
    violet: "border-t-violet",
    green: "border-t-green-500",
    amber: "border-t-amber-400",
  };
  const texts: Record<string, string> = {
    violet: "text-violet-light",
    green: "text-green-400",
    amber: "text-amber-400",
  };
  const valueColor = negative ? "text-red-400" : (texts[color] || "text-text-primary");
  const borderColor = borders[color] || "border-t-border";
  return (
    <div className={`rounded-xl border border-border bg-bg-card p-5 border-t-2 ${borderColor}`}>
      <p className="text-[10px] font-semibold tracking-wider text-text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-text-muted">{sub}</p>
    </div>
  );
}
