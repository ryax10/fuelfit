"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Crown, ShoppingCart, Zap, Minus, Plus, Layers, Shirt, Package, Search, X } from "lucide-react";
import { addToCartMay, useDB, getCartMay } from "@/lib/local-db";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/local-db/types";
import Link from "next/link";
import { QuickViewAccordion } from "./views/QuickViewAccordion";

const CATEGORIES = [
  { id: "todos", label: "Todos", icon: Layers },
  { id: "suplementos", label: "Suplementos", icon: Zap },
  { id: "ropa", label: "Ropa", icon: Shirt },
  { id: "accesorios", label: "Accesorios", icon: Package },
];

const PAGE_SIZE = 12;
const LS_CURRENCY = "ff_may_currency";
const LS_VIEW = "ff_may_view";

function stockOf(p: Product) { return Math.max(0, p.stock_actual - p.stock_reservado); }

// Normaliza texto eliminando espacios, guiones y acentos para comparación tolerante
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[\s\-_]+/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function MayoristaTiendaClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [addedId, setAddedId] = useState<string | null>(null);
  const [category, setCategory] = useState("todos");
  const [brand, setBrand] = useState("Todas");
  const [modelFilter, setModelFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [view, setView] = useState<"quick" | "images">("quick");
  const [currency, setCurrency] = useState<"usdt" | "ars">("usdt");
  const [fxRate, setFxRate] = useState<number | null>(null);
  const mayCart = useDB(useCallback(() => getCartMay(), []));

  // Leer preferencias de localStorage al montar
  useEffect(() => {
    setCurrency((localStorage.getItem(LS_CURRENCY) as "usdt" | "ars") || "usdt");
    setView((localStorage.getItem(LS_VIEW) as "quick" | "images") || "quick");
    fetch("/api/fx").then(r => r.json()).then(j => { if (j?.rate) setFxRate(j.rate); }).catch(() => {});
  }, []);

  // Refrescar stock cada 30s + al volver el foco. Evita que un cliente vea stock viejo
  // mientras otro pidió las mismas unidades en otra pestaña.
  useEffect(() => {
    let stop = false;
    const refresh = async () => {
      try {
        const { data } = await createClient()
          .from("products")
          .select("id, stock_actual, stock_reservado, visible")
          .eq("visible", true);
        if (stop || !data) return;
        const m = new Map<string, { stock_actual: number; stock_reservado: number }>();
        for (const r of data as { id: string; stock_actual: number; stock_reservado: number }[]) {
          m.set(r.id, { stock_actual: r.stock_actual, stock_reservado: r.stock_reservado });
        }
        setProducts(prev => prev.map(p => {
          const fresh = m.get(p.id);
          if (!fresh) return p;
          if (fresh.stock_actual === p.stock_actual && fresh.stock_reservado === p.stock_reservado) return p;
          return { ...p, stock_actual: fresh.stock_actual, stock_reservado: fresh.stock_reservado };
        }));
      } catch { /* tolerante a errores de red */ }
    };
    const interval = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { stop = true; clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, []);

  // Escuchar cambios de preferencias desde el header
  useEffect(() => {
    const sync = () => {
      setCurrency((localStorage.getItem(LS_CURRENCY) as "usdt" | "ars") || "usdt");
      setView((localStorage.getItem(LS_VIEW) as "quick" | "images") || "quick");
    };
    window.addEventListener("ff-prefs-change", sync);
    return () => window.removeEventListener("ff-prefs-change", sync);
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [category, brand, modelFilter, searchQuery]);

  const getQty = (id: string) => qtyMap[id] || 1;
  const priceForQty = (p: Product, qty: number) => {
    if (qty >= 100 && p.price_may_x100 > 0) return p.price_may_x100;
    if (qty >= 50 && p.price_may_x50 > 0) return p.price_may_x50;
    return p.price_may_x15;
  };
  const setQty = (id: string, qty: number, max: number) =>
    setQtyMap(q => ({ ...q, [id]: max <= 0 ? 1 : Math.max(1, Math.min(qty, max)) }));

  // Mapa de cantidades ya en el carrito: { product_id → qty }
  // Definido antes de handleAdd para que sea accesible en el closure
  const cartQtyMap: Record<string, number> = {};
  for (const item of mayCart) cartQtyMap[item.product_id] = item.qty;

  const handleAdd = (p: Product) => {
    const stock = stockOf(p);
    const inCart = cartQtyMap[p.id] ?? 0;
    const remaining = stock - inCart;
    if (remaining <= 0) return;
    const toAdd = Math.min(getQty(p.id), remaining);
    if (toAdd <= 0) return;
    addToCartMay(p.id, toAdd);
    setQtyMap(q => ({ ...q, [p.id]: 1 }));
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  const brandsSource = category === "todos" ? products : products.filter(p => p.category === category);
  const brands = brand !== "Todas"
    ? ["Todas", brand]
    : ["Todas", ...Array.from(new Set(brandsSource.map(p => p.brand)))];
  const availableModels = brand !== "Todas"
    ? [...new Set(brandsSource.filter(p => p.brand === brand).map(p => p.model))]
    : [];
  const CATEGORY_ORDER: Record<string, number> = { suplementos: 0, ropa: 1, accesorios: 2 };

  const filtered = products
    .filter(p => {
      if (category !== "todos" && p.category !== category) return false;
      if (brand !== "Todas" && p.brand !== brand) return false;
      if (modelFilter && p.model !== modelFilter) return false;
      if (searchQuery) {
        const qNorm = normalize(searchQuery);
        const qLower = searchQuery.toLowerCase();
        const matchesNormal =
          p.brand.toLowerCase().includes(qLower) ||
          p.model.toLowerCase().includes(qLower) ||
          (p.flavor || "").toLowerCase().includes(qLower) ||
          (p.name || "").toLowerCase().includes(qLower);
        const matchesNormalized =
          normalize(p.brand).includes(qNorm) ||
          normalize(p.model).includes(qNorm) ||
          normalize(p.flavor || "").includes(qNorm) ||
          normalize(p.name || "").includes(qNorm);
        return matchesNormal || matchesNormalized;
      }
      return true;
    })
    .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99));

  const hasActive = category !== "todos" || brand !== "Todas" || modelFilter !== "" || searchQuery !== "";
  const showARS = currency === "ars" && fxRate !== null;

  const formatPrice = (usdt: number) => {
    if (showARS && fxRate) return `$${Math.round(usdt * fxRate).toLocaleString("es-AR")}`;
    return `USDT ${usdt}`;
  };

  const quickViewProps = { products: filtered, qtyMap, setQty, handleAdd, addedId, fxRate, showARS, cartQtyMap };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Título */}
      <div className="flex items-center gap-3 mb-4">
        <Crown size={20} className="text-violet-light" />
        <div>
          <h1 className="font-display text-xl font-bold">Tienda Mayorista</h1>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Escape" && setSearchQuery("")}
          placeholder="Buscar marca, modelo, sabor..."
          className="w-full rounded-xl border border-border bg-bg-card pl-9 pr-8 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/20 outline-none transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Info precio por cantidad */}
      <div className="mb-4 rounded-xl border border-violet/10 bg-violet/5 p-3 text-xs text-violet-light">
        💡 El precio cambia según el total de unidades: ×15 | ×50 | ×100+
      </div>

      {/* Filtros — solo en vista con imágenes */}
      {view === "images" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => { const Icon = cat.icon; return (
              <button key={cat.id} onClick={() => { setCategory(cat.id); setBrand("Todas"); setModelFilter(""); }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${category === cat.id ? "bg-violet/10 text-violet-light border border-violet/20" : "border border-border text-text-muted hover:bg-bg-hover hover:text-text-secondary"}`}>
                <Icon size={13} />{cat.label}
              </button>); })}
          </div>
          <div className="mb-5 rounded-2xl border border-border bg-bg-card p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-2 block">Marca</label>
                <div className="flex flex-wrap gap-1.5">{brands.map((b) => (
                  <button key={b} onClick={() => { setBrand(b); setModelFilter(""); }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${brand === b ? "bg-violet/10 text-violet-light border border-violet/20" : "border border-border text-text-muted hover:bg-bg-hover"}`}>{b}</button>
                ))}</div>
              </div>
              {availableModels.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-text-secondary mb-2 block">Modelo ({brand})</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setModelFilter("")} className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${modelFilter === "" ? "bg-violet/10 text-violet-light border border-violet/20" : "border border-border text-text-muted hover:bg-bg-hover"}`}>Todos</button>
                    {availableModels.map((m) => (
                      <button key={m} onClick={() => setModelFilter(m)} className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${modelFilter === m ? "bg-violet/10 text-violet-light border border-violet/20" : "border border-border text-text-muted hover:bg-bg-hover"}`}>{m}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {hasActive && (
              <button onClick={() => { setCategory("todos"); setBrand("Todas"); setModelFilter(""); setSearchQuery(""); }} className="mt-3 text-xs font-medium text-violet-light hover:text-violet transition-colors">✕ Limpiar filtros</button>
            )}
          </div>
        </>
      )}


      {/* VISTAS */}
      {view === "quick" ? (
        <QuickViewAccordion {...quickViewProps} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {filtered.slice(0, visibleCount).map((p, i) => (
              <div key={p.id} className="group relative flex flex-col rounded-2xl border border-border bg-bg-card hover:border-violet/30 transition-all overflow-hidden">
                <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                  {p.is_new && <span className="rounded-md bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase shadow">Nuevo</span>}
                  {stockOf(p) > 0 && stockOf(p) < 5 && <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase shadow">Stock bajo</span>}
                </div>
                <Link href={`/mayoristas/tienda/${p.slug}`}>
                  <div className="relative aspect-square bg-bg-secondary overflow-hidden">
                    {p.image ? (
                      <Image src={p.image} alt={`${p.brand} ${p.model}${p.flavor ? ` ${p.flavor}` : ""} — FuelFit`} fill unoptimized
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        priority={i < 4} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Package size={32} className="text-violet/20" /></div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-bg-card/90 to-transparent p-2 group-hover:translate-y-0 transition-transform duration-300 z-10">
                      <span className="block rounded-lg bg-violet py-1.5 text-center text-[10px] font-bold tracking-wider text-white">VER PRODUCTO</span>
                    </div>
                  </div>
                </Link>
                <div className="flex flex-col flex-1 p-2.5 sm:p-3">
                  <div className="flex-1 mb-3">
                    <h3 className="text-sm font-bold tracking-wide text-violet leading-snug line-clamp-2">{p.brand.toUpperCase()} - {p.model.toUpperCase()}</h3>
                    {p.flavor && <p className="mt-0.5 text-sm text-text-primary">{p.flavor}</p>}
                    <p className="mt-1 text-sm font-medium text-text-muted">{stockOf(p)} disponibles</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                    <div className="rounded-lg bg-bg-secondary p-2">
                      <p className="text-[9px] text-text-muted">×15</p>
                      <p className={`font-display text-xs font-bold ${p.price_may_x15 > 0 ? "text-green-400" : "text-text-muted"}`}>{p.price_may_x15 > 0 ? formatPrice(p.price_may_x15) : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-bg-secondary p-2">
                      <p className="text-[9px] text-text-muted">×50</p>
                      <p className={`font-display text-xs font-bold ${p.price_may_x50 > 0 ? "text-green-400" : "text-text-muted"}`}>{p.price_may_x50 > 0 ? formatPrice(p.price_may_x50) : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-bg-secondary p-2">
                      <p className="text-[9px] text-text-muted">×100+</p>
                      <p className={`font-display text-xs font-bold ${p.price_may_x100 > 0 ? "text-green-400" : "text-text-muted"}`}>{p.price_may_x100 > 0 ? formatPrice(p.price_may_x100) : "—"}</p>
                    </div>
                  </div>
                  {stockOf(p) <= 0 ? (
                    <p className="text-center text-xs font-semibold text-red-400">Sin stock</p>
                  ) : priceForQty(p, getQty(p.id)) === 0 ? (
                    <p className="text-center text-xs font-semibold text-text-muted">Sin precio mayorista</p>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center rounded-lg border border-border">
                        <button onClick={() => setQty(p.id, getQty(p.id) - 1, stockOf(p))} disabled={getQty(p.id) <= 1} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={10} /></button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={stockOf(p)}
                          value={getQty(p.id)}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setQty(p.id, Number.isFinite(v) ? v : 1, stockOf(p));
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-10 text-center text-xs font-semibold bg-transparent outline-none focus:bg-bg-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button onClick={() => setQty(p.id, getQty(p.id) + 1, stockOf(p))} disabled={getQty(p.id) >= stockOf(p)} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={10} /></button>
                      </div>
                      <button onClick={() => handleAdd(p)} className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-bold transition-all ${addedId === p.id ? "bg-green-500/20 text-green-400" : "bg-violet/10 text-violet-light hover:bg-violet/20"}`}>
                        <ShoppingCart size={11} />{addedId === p.id ? "✓ Agregado" : <><span className="hidden sm:inline">Agregar al carrito</span><span className="sm:hidden">Agregar</span></>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="mt-6 flex justify-center">
              <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                className="rounded-xl border border-violet/20 bg-violet/5 px-8 py-3 text-sm font-semibold text-violet-light hover:bg-violet/10 hover:border-violet/40 transition-all">
                Cargar más ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
