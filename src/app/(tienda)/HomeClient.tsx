"use client";
import Image from "next/image";
import Link from "next/link";
import {
  Crown, Truck, Shield, ArrowRight, Headphones, ShoppingCart,
  Minus, Plus, DollarSign, Package, Zap, Shirt,
  Flame, BadgeCheck, ChevronRight, Sparkles, Timer,
} from "lucide-react";
import { useState, useEffect } from "react";
import { addToCart } from "@/lib/local-db";
import type { Product } from "@/lib/local-db/types";

const WA = "5491100000000";

function useCountdown() {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 0);
      if (end.getTime() < now.getTime()) end.setDate(end.getDate() + 1);
      const d = Math.max(0, end.getTime() - now.getTime());
      setT({ h: Math.floor(d / 3600000), m: Math.floor((d % 3600000) / 60000), s: Math.floor((d % 60000) / 1000) });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function TimeBlock({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated border border-border text-base font-bold tabular-nums font-display">
        {pad(n)}
      </span>
      <span className="text-[8px] text-text-muted font-medium tracking-wider">{label}</span>
    </span>
  );
}

const WA_ICON = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const CATS = [
  { slug: "suplementos", label: "Suplementos", sub: "Proteínas · Creatina · Pre-workout · Aminoácidos", Icon: Zap, color: "text-violet", border: "border-violet/20 hover:border-violet/50", bg: "hover:bg-violet/5" },
  { slug: "ropa", label: "Ropa Deportiva", sub: "Shorts · Remeras · Camperas · Calzas", Icon: Shirt, color: "text-sky-400", border: "border-sky-500/20 hover:border-sky-400/50", bg: "hover:bg-sky-500/5" },
  { slug: "accesorios", label: "Accesorios", sub: "Shakers · Guantes · Cinturones · Bolsos", Icon: Package, color: "text-orange-400", border: "border-orange-500/20 hover:border-orange-400/50", bg: "hover:bg-orange-500/5" },
];

const STATS = [
  { n: "500+", label: "Clientes satisfechos" },
  { n: "50+", label: "Productos disponibles" },
  { n: "24hs", label: "Tiempo de despacho" },
  { n: "100%", label: "Calidad garantizada" },
];

export default function HomeClient({ products }: { products: Product[] }) {
  const countdown = useCountdown();
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [addedId, setAddedId] = useState<string | null>(null);

  const pickOnePerModel = (list: Product[]) => {
    const map = new Map<string, Product>();
    for (const p of list) {
      const key = `${p.brand}|${p.model}`;
      if (!map.has(key)) map.set(key, p);
      else if (Math.max(0, p.stock_actual - p.stock_reservado) > 0 && Math.max(0, map.get(key)!.stock_actual - map.get(key)!.stock_reservado) === 0)
        map.set(key, p);
    }
    return Array.from(map.values());
  };

  const featuredList = pickOnePerModel(products.filter(p => p.featured));
  const featured = (featuredList.length > 0 ? featuredList : pickOnePerModel(products)).slice(0, 4);
  const newProducts = pickOnePerModel(products.filter(p => p.is_new)).slice(0, 4);

  const stockOf = (p: Product) => Math.max(0, p.stock_actual - p.stock_reservado);
  const getQty = (id: string) => qtyMap[id] || 1;
  const setQty = (id: string, qty: number, max: number) => setQtyMap(q => ({ ...q, [id]: Math.max(1, Math.min(qty, max)) }));
  const handleAdd = (p: Product) => {
    if (stockOf(p) <= 0) return;
    addToCart(p.id, Math.min(getQty(p.id), stockOf(p)));
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1200);
  };

  return (
    <div>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-5%,rgba(34,197,94,0.12),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_85%_60%,rgba(34,197,94,0.05),transparent)] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="flex flex-col items-center text-center">

            {/* Eyebrow badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet/25 bg-violet/8 px-4 py-1.5">
              <Zap size={11} className="text-violet" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-violet uppercase">Suplementos &amp; Ropa Fitness Premium</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl font-extrabold leading-[0.88] tracking-tight sm:text-7xl">
              ALIMENTÁ TU
              <br />
              <span className="text-gradient-green">RENDIMIENTO</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-text-secondary sm:text-lg">
              Suplementos deportivos certificados y ropa fitness de calidad premium.
              <br className="hidden sm:inline" />
              Envíos a todo el país — mayorista y minorista.
            </p>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link href="/productos" className="flex items-center gap-2 rounded-xl bg-violet px-7 py-3.5 text-sm font-bold tracking-wider text-black hover:opacity-90 hover:shadow-2xl hover:shadow-violet/25 transition-all active:scale-[0.98]">
                <Zap size={15} /> Ver todo el catálogo
              </Link>
              <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-border bg-bg-card px-7 py-3.5 text-sm font-medium text-text-secondary hover:border-green-500/30 hover:text-green-400 hover:bg-bg-elevated transition-all">
                {WA_ICON} Consultar por WhatsApp
              </a>
            </div>

            {/* Trust pills */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-muted">
              <span className="flex items-center gap-1.5"><BadgeCheck size={13} className="text-violet" /> Productos certificados</span>
              <span className="h-3 w-px bg-border hidden sm:block" />
              <span className="flex items-center gap-1.5"><Truck size={13} className="text-violet" /> Envío a todo el país</span>
              <span className="h-3 w-px bg-border hidden sm:block" />
              <span className="flex items-center gap-1.5"><Shield size={13} className="text-violet" /> Compra protegida</span>
              <span className="h-3 w-px bg-border hidden sm:block" />
              <span className="flex items-center gap-1.5"><Headphones size={13} className="text-violet" /> Atención personalizada</span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CATEGORÍAS
      ════════════════════════════════════════════ */}
      <section className="border-b border-border bg-bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <p className="mb-4 text-[11px] font-bold tracking-[0.2em] text-text-muted uppercase">Explorá por categoría</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {CATS.map(({ slug, label, sub, Icon, color, border, bg }) => (
              <Link key={slug} href="/productos" className={`group flex items-center gap-4 rounded-2xl border ${border} ${bg} bg-bg-card p-5 transition-all duration-300`}>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${border} bg-bg-elevated transition-all duration-300 group-hover:scale-110`}>
                  <Icon size={20} className={color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-text-primary">{label}</p>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">{sub}</p>
                </div>
                <ChevronRight size={15} className="shrink-0 text-text-muted/30 group-hover:text-text-muted transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          OFERTA DEL DÍA — COUNTDOWN
      ════════════════════════════════════════════ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet/20 bg-gradient-to-r from-violet/8 to-violet/3 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet/15">
                <Flame size={18} className="text-violet" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-violet uppercase">Oferta del día</p>
                <p className="text-sm font-semibold text-text-primary leading-snug">Los mejores precios, hoy solamente</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Timer size={13} className="text-text-muted" />
                <span className="text-xs text-text-muted">Termina en</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TimeBlock n={countdown.h} label="hs" />
                <span className="text-text-muted/50 font-bold text-lg -mt-4">:</span>
                <TimeBlock n={countdown.m} label="min" />
                <span className="text-text-muted/50 font-bold text-lg -mt-4">:</span>
                <TimeBlock n={countdown.s} label="seg" />
              </div>
              <Link href="/productos" className="rounded-xl bg-violet px-5 py-2 text-xs font-bold text-black hover:opacity-90 transition-all whitespace-nowrap">
                Ver ofertas →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          PRODUCTOS DESTACADOS
      ════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block h-0.5 w-6 rounded-full bg-violet" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-violet uppercase">Más vendidos</span>
            </div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Productos destacados</h2>
          </div>
          <Link href="/productos" className="flex items-center gap-1 text-sm font-semibold text-violet hover:opacity-80 transition-opacity">
            VER TODO <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          {featured.map((p, i) => {
            const stock = stockOf(p);
            return (
              <div key={p.id} className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-card hover:border-violet/30 hover:shadow-xl hover:shadow-violet/5 transition-all duration-300 opacity-0 animate-fade-up stagger-${Math.min(i + 1, 8)}`}>
                {/* Badges */}
                {p.featured && (
                  <span className="absolute left-2 top-2 z-10 rounded-md bg-violet px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-black">TOP</span>
                )}
                {stock > 0 && stock <= 5 && (
                  <span className="absolute right-2 top-2 z-10 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">ÚLTIMOS</span>
                )}

                <Link href={`/producto/${p.slug}`}>
                  <div className="relative aspect-square bg-bg-secondary overflow-hidden">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={`${p.brand} ${p.model}${p.flavor ? ` ${p.flavor}` : ""} — FuelFit`}
                        fill unoptimized
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        priority={i < 4}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated opacity-20 group-hover:opacity-40 transition-opacity">
                          <Package size={26} className="text-violet" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-bg-card/95 to-transparent p-2 group-hover:translate-y-0 transition-transform duration-300 z-10">
                      <span className="block rounded-lg bg-violet py-1.5 text-center text-[10px] font-bold tracking-wider text-black">VER PRODUCTO</span>
                    </div>
                  </div>
                </Link>

                <div className="flex flex-col flex-1 p-2.5 sm:p-3">
                  <div className="flex-1">
                    <Link href={`/producto/${p.slug}`}>
                      {p.flavor && <h3 className="text-sm font-bold text-text-primary group-hover:text-white transition-colors line-clamp-2 leading-snug">{p.flavor}</h3>}
                      <p className="mt-0.5 text-[11px] text-violet/70 font-medium truncate">{p.brand.toUpperCase()} · {p.model.toUpperCase()}</p>
                    </Link>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="font-display text-base font-bold">${p.price_min_ars.toLocaleString()}</span>
                    <span className="text-[8px] text-text-muted">ARS</span>
                  </div>
                  {stock <= 0 ? (
                    <p className="mt-2 text-center text-[10px] font-semibold text-red-400">Sin stock</p>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex items-center rounded-lg border border-border">
                        <button onClick={() => setQty(p.id, getQty(p.id) - 1, stock)} disabled={getQty(p.id) <= 1} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={10} /></button>
                        <span className="w-5 text-center text-xs font-semibold">{getQty(p.id)}</span>
                        <button onClick={() => setQty(p.id, getQty(p.id) + 1, stock)} disabled={getQty(p.id) >= stock} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={10} /></button>
                      </div>
                      <button onClick={() => handleAdd(p)} className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition-all ${addedId === p.id ? "bg-violet/20 text-violet" : "bg-violet/10 text-violet hover:bg-violet/20"}`}>
                        <ShoppingCart size={11} />
                        {addedId === p.id ? "✓ Agregado" : <><span className="hidden sm:inline">Agregar</span><span className="sm:hidden">+</span></>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {featured.length === 0 && (
            <div className="col-span-4 rounded-2xl border border-border bg-bg-card py-16 text-center">
              <Package size={36} className="mx-auto text-text-muted/20 mb-4" />
              <p className="text-sm font-medium text-text-muted">Cargando catálogo…</p>
              <p className="text-xs text-text-muted/60 mt-1">Próximamente productos disponibles</p>
              <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-violet hover:opacity-80 transition-opacity">
                Consultá por WhatsApp <ArrowRight size={13} />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          STATS / SOCIAL PROOF
      ════════════════════════════════════════════ */}
      <section className="border-y border-border bg-bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 text-center">
            {STATS.map(({ n, label }) => (
              <div key={label}>
                <p className="font-display text-3xl font-extrabold text-violet sm:text-4xl">{n}</p>
                <p className="mt-1.5 text-xs text-text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          NOVEDADES
      ════════════════════════════════════════════ */}
      {newProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={13} className="text-green-400" />
                <span className="text-[10px] font-bold tracking-[0.25em] text-green-400 uppercase">Recién llegado</span>
              </div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Novedades</h2>
            </div>
            <Link href="/productos" className="flex items-center gap-1 text-sm font-semibold text-green-400 hover:opacity-80 transition-opacity">
              VER TODO <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {newProducts.map((p, i) => {
              const stock = stockOf(p);
              return (
                <div key={p.id} className={`group relative flex flex-col overflow-hidden rounded-2xl border border-green-500/15 bg-bg-card hover:border-green-500/40 hover:shadow-xl hover:shadow-green-500/5 transition-all duration-300 opacity-0 animate-fade-up stagger-${Math.min(i + 1, 8)}`}>
                  <Link href={`/producto/${p.slug}`}>
                    <div className="relative aspect-square bg-bg-secondary overflow-hidden">
                      <span className="absolute left-2 top-2 z-10 rounded-md bg-green-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-black shadow">NUEVO</span>
                      {p.image ? (
                        <Image src={p.image} alt={`${p.brand} ${p.model}${p.flavor ? ` ${p.flavor}` : ""} — FuelFit`} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" className="object-cover group-hover:scale-105 transition-transform duration-500" priority={i < 2} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated opacity-20 group-hover:opacity-40 transition-opacity">
                            <Package size={26} className="text-green-400" />
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-bg-card/95 to-transparent p-2 group-hover:translate-y-0 transition-transform duration-300 z-10">
                        <span className="block rounded-lg bg-green-600 py-1.5 text-center text-[10px] font-bold tracking-wider text-white">VER PRODUCTO</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-col flex-1 p-2.5 sm:p-3">
                    <div className="flex-1">
                      <Link href={`/producto/${p.slug}`}>
                        {p.flavor && <h3 className="text-sm font-bold text-text-primary group-hover:text-white transition-colors line-clamp-2 leading-snug">{p.flavor}</h3>}
                        <p className="mt-0.5 text-[11px] text-green-400/60 font-medium truncate">{p.brand.toUpperCase()} · {p.model.toUpperCase()}</p>
                      </Link>
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="font-display text-base font-bold">${p.price_min_ars.toLocaleString()}</span>
                      <span className="text-[8px] text-text-muted">ARS</span>
                    </div>
                    {stock <= 0 ? (
                      <p className="mt-2 text-center text-[10px] font-semibold text-red-400">Sin stock</p>
                    ) : (
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="flex items-center rounded-lg border border-border">
                          <button onClick={() => setQty(p.id, getQty(p.id) - 1, stock)} disabled={getQty(p.id) <= 1} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={10} /></button>
                          <span className="w-5 text-center text-xs font-semibold">{getQty(p.id)}</span>
                          <button onClick={() => setQty(p.id, getQty(p.id) + 1, stock)} disabled={getQty(p.id) >= stock} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={10} /></button>
                        </div>
                        <button onClick={() => handleAdd(p)} className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition-all ${addedId === p.id ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                          <ShoppingCart size={11} />
                          {addedId === p.id ? "✓ Agregado" : <><span className="hidden sm:inline">Agregar</span><span className="sm:hidden">+</span></>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          ZONA MAYORISTA
      ════════════════════════════════════════════ */}
      <section className="border-t border-border bg-bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet/20 bg-violet/5 px-4 py-1.5 mb-4">
              <Crown size={12} className="text-violet" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-violet uppercase">Zona Mayorista</span>
            </div>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Precios por volumen</h2>
            <p className="mt-3 text-sm text-text-secondary max-w-md mx-auto">
              Comprá al por mayor directo del importador. Precios escalonados en USDT según cantidad.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            {[
              { units: "15+", label: "unidades", desc: "Precio base mayorista" },
              { units: "50+", label: "unidades", desc: "Mejor precio por volumen", hl: true },
              { units: "100+", label: "unidades", desc: "Precio más bajo disponible" },
            ].map((t) => (
              <div key={t.units} className={`rounded-2xl border p-6 text-center transition-all ${t.hl ? "border-violet/35 bg-violet/8 scale-[1.02] shadow-lg shadow-violet/10" : "border-border bg-bg-card"}`}>
                <p className={`font-display text-4xl font-extrabold ${t.hl ? "text-violet" : "text-text-primary"}`}>{t.units}</p>
                <p className="text-xs text-text-muted mt-0.5">{t.label}</p>
                <p className="mt-3 text-xs text-text-secondary">{t.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-10">
            {[
              { Icon: DollarSign, title: "Precios en USDT", desc: "Cotización competitiva directo de importación" },
              { Icon: Package, title: "Mínimo USDT 130", desc: "Monto mínimo por pedido mayorista" },
              { Icon: Truck, title: "Envíos flexibles", desc: "Coordinamos el envío que más te convenga" },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-bg-card p-5 hover:border-violet/20 transition-colors">
                <b.Icon size={20} className="text-violet" />
                <h3 className="mt-3 font-display text-sm font-bold">{b.title}</h3>
                <p className="mt-1 text-xs text-text-muted">{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/mayoristas/tienda" className="inline-flex items-center gap-2 rounded-xl bg-violet px-8 py-3.5 text-sm font-bold tracking-wider text-black hover:opacity-90 hover:shadow-2xl hover:shadow-violet/20 transition-all">
              <Crown size={14} /> VER CATÁLOGO MAYORISTA
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
