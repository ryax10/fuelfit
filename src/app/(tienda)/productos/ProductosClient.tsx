"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Search, Layers, Zap, Shirt, Package, ShoppingCart, Minus, Plus } from "lucide-react";
import { addToCart } from "@/lib/local-db";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/local-db/types";

const CATEGORIES = [
  { id: "todos", label: "Todos", icon: Layers },
  { id: "suplementos", label: "Suplementos", icon: Zap },
  { id: "ropa", label: "Ropa", icon: Shirt },
  { id: "accesorios", label: "Accesorios", icon: Package },
];

export default function ProductosClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [category, setCategory] = useState("todos");

  // Refrescar stock en vivo cada 30s + cuando vuelve el foco a la pestaña.
  // Mantiene el catálogo sincronizado con compras de otros clientes.
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
  const [brand, setBrand] = useState("Todas");
  const [modelFilter, setModelFilter] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [selectedOpts, setSelectedOpts] = useState<Record<string, { qty: number; price: number } | null>>({});
  const [visibleCount, setVisibleCount] = useState(12);

  const stockOf = (p: Product) => Math.max(0, p.stock_actual - p.stock_reservado);
  const stockUnits = (p: Product) => {
    const upack = Math.max(1, p.units_per_pack ?? 1);
    return Math.floor(stockOf(p) / upack);
  };
  const getQty = (id: string) => qtyMap[id] || 1;
  const setQty = (id: string, qty: number, max: number) =>
    setQtyMap(q => ({ ...q, [id]: Math.max(1, Math.min(qty, max)) }));

  const brandsSource = category === "todos" ? products : products.filter(p => p.category === category);
  useEffect(() => { setVisibleCount(12); }, [category, brand, modelFilter]);

  const brands = brand !== "Todas"
    ? ["Todas", brand]
    : ["Todas", ...Array.from(new Set(brandsSource.map(p => p.brand)))];
  const CATEGORY_ORDER: Record<string, number> = { suplementos: 0, ropa: 1, accesorios: 2 };
  const filtered = products
    .filter((p) => {
      if (category !== "todos" && p.category !== category) return false;
      if (brand !== "Todas" && p.brand !== brand) return false;
      if (modelFilter && p.model !== modelFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const ca = CATEGORY_ORDER[a.category] ?? 99;
      const cb = CATEGORY_ORDER[b.category] ?? 99;
      return ca - cb;
    });
  const availableModels = brand !== "Todas"
    ? [...new Set(products.filter(p => p.brand === brand).map(p => p.model))]
    : [];
  const hasActive = category !== "todos" || brand !== "Todas" || modelFilter !== "";

  const handleAdd = (p: Product) => {
    const stock = stockOf(p);
    if (stock <= 0) return;
    addToCart(p.id, Math.min(getQty(p.id), stock));
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1200);
  };

  const handleAddWithOpt = (p: Product, opt: { qty: number; price: number }) => {
    addToCart(p.id, opt.qty, opt.price / opt.qty);
    setAddedId(p.id);
    setTimeout(() => { setAddedId(null); setSelectedOpts(s => ({ ...s, [p.id]: null })); }, 1200);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Productos</h1>
        <p className="mt-1 text-sm text-text-muted">Todo nuestro catálogo de importación directa</p>
      </div>

      {/* Categorías */}
      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => { const Icon = cat.icon; return (
          <button key={cat.id} onClick={() => { setCategory(cat.id); setBrand("Todas"); setModelFilter(""); }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${category === cat.id ? "bg-violet/10 text-violet-light border border-violet/20" : "border border-border text-text-muted hover:bg-bg-hover hover:text-text-secondary"}`}>
            <Icon size={13} />{cat.label}
          </button>); })}
      </div>

      {/* Filtros */}
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
          <button onClick={() => { setCategory("todos"); setBrand("Todas"); setModelFilter(""); }} className="mt-3 text-xs font-medium text-violet-light hover:text-violet transition-colors">✕ Limpiar filtros</button>
        )}
      </div>

      <p className="mb-3 text-xs text-text-muted">{filtered.length} producto{filtered.length !== 1 ? "s" : ""}</p>

      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {filtered.slice(0, visibleCount).map((p, i) => (
              <div key={p.id} className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-card hover:border-violet/30 transition-all duration-300 opacity-0 animate-fade-up stagger-${Math.min(i+1,8)}`}>
                {stockUnits(p) <= 2 && stockUnits(p) > 0 && (
                  <span className="absolute left-2 top-2 z-10 rounded-md bg-violet px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">ÚLTIMOS</span>
                )}
                <Link href={`/producto/${p.slug}`}>
                  <div className="relative aspect-square bg-bg-secondary overflow-hidden">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={`${p.brand} ${p.model}${p.flavor ? ` ${p.flavor}` : ""} — FuelFit`}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        priority={i < 4}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated opacity-30 group-hover:scale-110 transition-all duration-500">
                          <Package size={24} className="text-violet/50" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-bg-card/90 to-transparent p-2 group-hover:translate-y-0 transition-transform duration-300 z-10">
                      <span className="block rounded-lg bg-violet py-1.5 text-center text-[10px] font-bold tracking-wider text-white">VER PRODUCTO</span>
                    </div>
                  </div>
                </Link>
                <div className="flex flex-col flex-1 p-2.5 sm:p-3">
                  <div className="flex-1">
                    <Link href={`/producto/${p.slug}`}>
                      {p.flavor && <h3 className="text-sm font-bold tracking-wide text-text-primary group-hover:text-white transition-colors line-clamp-2 leading-snug">{p.flavor}</h3>}
                      <p className="mt-0.5 text-xs text-violet truncate">{p.brand.toUpperCase()} - {p.model.toUpperCase()}</p>
                    </Link>
                  </div>
                  <p className="mt-1.5 font-display text-sm font-bold">${p.price_min_ars.toLocaleString()}<span className="ml-0.5 text-[8px] font-normal text-text-muted">ARS</span></p>
                  {stockOf(p) <= 0 ? (
                    <p className="mt-2 text-center text-[10px] font-semibold text-red-400">Sin stock</p>
                  ) : p.unit_sale_options?.options?.some((t: {qty:number;price:number}) => t.qty > 0 && t.price > 0) ? (() => {
                    const opts = (p.unit_sale_options.options as {qty:number;price:number;label?:string}[]).filter(t => t.qty > 0 && t.price > 0 && stockOf(p) >= t.qty);
                    const autoSel = opts.length === 1 ? opts[0] : null;
                    const sel = selectedOpts[p.id] !== undefined ? selectedOpts[p.id] : autoSel;
                    return (
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex gap-1">
                          {opts.map((opt) => (
                            <button key={opt.qty} onClick={() => opts.length > 1 && setSelectedOpts(s => ({ ...s, [p.id]: sel?.qty === opt.qty ? null : opt }))}
                              className={`flex-1 rounded-lg py-1 text-[9px] font-bold transition-all ${sel?.qty === opt.qty ? "bg-violet text-white" : "border border-border text-text-muted hover:bg-bg-hover"} ${opts.length === 1 ? "cursor-default" : ""}`}>
                              {opt.label ?? `x${opt.qty}`}<br/>${opt.price.toLocaleString()}
                            </button>
                          ))}
                        </div>
                        {sel ? (
                          <button onClick={() => handleAddWithOpt(p, sel)}
                            className={`flex items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition-all ${addedId === p.id ? "bg-green-500/20 text-green-400" : "bg-violet/10 text-violet-light hover:bg-violet/20"}`}>
                            <ShoppingCart size={11} />{addedId === p.id ? "✓ Agregado" : "Agregar al carrito"}
                          </button>
                        ) : (
                          <p className="text-center text-[9px] text-text-muted">Elegí una opción</p>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex items-center rounded-lg border border-border">
                        <button onClick={() => setQty(p.id, getQty(p.id) - 1, stockOf(p))} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30" disabled={getQty(p.id) <= 1}><Minus size={10} /></button>
                        <span className="w-5 text-center text-xs font-semibold">{getQty(p.id)}</span>
                        <button onClick={() => setQty(p.id, getQty(p.id) + 1, stockOf(p))} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30" disabled={getQty(p.id) >= stockOf(p)}><Plus size={10} /></button>
                      </div>
                      <button onClick={() => handleAdd(p)} className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition-all ${addedId === p.id ? "bg-green-500/20 text-green-400" : "bg-violet/10 text-violet-light hover:bg-violet/20"}`}>
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
              <button
                onClick={() => setVisibleCount(v => v + 12)}
                className="rounded-xl border border-violet/20 bg-violet/5 px-8 py-3 text-sm font-semibold text-violet-light hover:bg-violet/10 hover:border-violet/40 transition-all"
              >
                Cargar más ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card px-6 py-16 text-center">
          <Search size={32} className="mx-auto text-text-muted/30" />
          <p className="mt-4 text-text-secondary">No se encontraron productos</p>
          <button onClick={() => { setCategory("todos"); setBrand("Todas"); setModelFilter(""); }} className="mt-4 text-sm font-medium text-violet-light hover:text-violet transition-colors">Limpiar filtros</button>
        </div>
      )}
    </div>
  );
}
