"use client";
import Image from "next/image";
import Link from "next/link";
import { Crown, Truck, Shield, Wind, ArrowRight, Headphones, ShoppingCart, Minus, Plus, DollarSign, Package, Sparkles } from "lucide-react";
import { useState } from "react";
import { addToCart } from "@/lib/local-db";
import type { Product } from "@/lib/local-db/types";

export default function HomeClient({ products }: { products: Product[] }) {
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [addedId, setAddedId] = useState<string | null>(null);

  // 1 producto representativo por modelo (el primero con stock, o el primero)
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
  const featured = featuredList.length > 0 ? featuredList.slice(0, 4) : pickOnePerModel(products).slice(0, 4);
  const newProducts = pickOnePerModel(products.filter(p => p.is_new)).slice(0, 4);
  const stockOf = (p: Product) => Math.max(0, p.stock_actual - p.stock_reservado);
  const getQty = (id: string) => qtyMap[id] || 1;
  const setQty = (id: string, qty: number, max: number) =>
    setQtyMap(q => ({ ...q, [id]: Math.max(1, Math.min(qty, max)) }));

  const handleAdd = (p: Product) => {
    const stock = stockOf(p);
    if (stock <= 0) return;
    addToCart(p.id, Math.min(getQty(p.id), stock));
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1200);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(168,85,247,0.08),transparent)] pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-4 sm:gap-6 mb-8">
              <Image src="/logo.jpg" alt="FuelFit" width={130} height={130} className="w-20 h-20 sm:w-[130px] sm:h-[130px] rounded-2xl shadow-xl shadow-violet/10" priority />
              <div className="text-left">
                <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl leading-none">FUELFIT</h1>
                <p className="text-xl sm:text-3xl font-bold tracking-[0.2em] text-violet mt-2">FITNESS STORE</p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
              Suplementos deportivos y ropa fitness premium. Ventas por menor y por mayor.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <a href="/productos" className="flex items-center gap-2 rounded-xl bg-violet px-6 py-3 text-sm font-bold tracking-wider text-white hover:bg-violet-dark hover:shadow-lg hover:shadow-violet/20 transition-all">
                Ver todo el catálogo
              </a>
              <a href="https://api.whatsapp.com/send/?phone=5491100000000&text&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-text-secondary hover:bg-bg-hover hover:border-green-500/30 hover:text-green-400 transition-all">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Consultar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-border bg-bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted"><Truck size={16} className="text-violet/60" /> Envíos a todo el país</div>
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted"><Shield size={16} className="text-violet/60" /> Garantía en productos</div>
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted"><Crown size={16} className="text-violet/60" /> Precios mayoristas</div>
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted"><Headphones size={16} className="text-violet/60" /> Atención personalizada</div>
          </div>
        </div>
      </section>

      {/* Productos destacados */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between mb-2">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Productos destacados</h2>
            <p className="mt-1 text-sm text-text-muted">Lo más vendido de nuestro catálogo</p>
          </div>
          <Link href="/productos" className="text-sm font-semibold text-violet-light hover:text-violet transition-colors flex items-center gap-1">VER TODO <ArrowRight size={14} /></Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          {featured.map((p, i) => (
            <div key={p.id} className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-card hover:border-violet/30 transition-all duration-300 opacity-0 animate-fade-up stagger-${Math.min(i + 1, 8)}`}>
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
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated opacity-30">
                        <Wind size={24} className="text-violet/50" />
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
                ) : (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex items-center rounded-lg border border-border">
                      <button onClick={() => setQty(p.id, getQty(p.id) - 1, stockOf(p))} disabled={getQty(p.id) <= 1} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={10} /></button>
                      <span className="w-5 text-center text-xs font-semibold">{getQty(p.id)}</span>
                      <button onClick={() => setQty(p.id, getQty(p.id) + 1, stockOf(p))} disabled={getQty(p.id) >= stockOf(p)} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={10} /></button>
                    </div>
                    <button onClick={() => handleAdd(p)} className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition-all ${addedId === p.id ? "bg-green-500/20 text-green-400" : "bg-violet/10 text-violet-light hover:bg-violet/20"}`}>
                      <ShoppingCart size={11} />{addedId === p.id ? "✓ Agregado" : <><span className="hidden sm:inline">Agregar al carrito</span><span className="sm:hidden">Agregar</span></>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {featured.length === 0 && (
            <div className="col-span-4 py-12 text-center text-text-muted text-sm">No hay productos disponibles.</div>
          )}
        </div>
      </section>

      {/* Zona Mayorista */}
      <section className="border-t border-border bg-bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet/20 bg-violet/5 px-4 py-1.5 mb-4">
              <Crown size={13} className="text-violet-light" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-violet-light">ZONA MAYORISTA</span>
            </div>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Precios por cantidad</h2>
            <p className="mt-3 text-text-secondary max-w-md mx-auto text-sm">Comprá al por mayor en USDT directo del importador. Precios escalonados según volumen.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            {[
              { units: "15+", label: "unidades", desc: "Precio base mayorista" },
              { units: "50+", label: "unidades", desc: "Mejor precio por volumen", hl: true },
              { units: "100+", label: "unidades", desc: "Precio más bajo disponible" },
            ].map((t) => (
              <div key={t.units} className={`rounded-2xl border p-6 text-center transition-all ${t.hl ? "border-violet/30 bg-violet/5 scale-[1.02] shadow-lg shadow-violet/5" : "border-border bg-bg-card"}`}>
                <p className="font-display text-4xl font-bold">{t.units}</p>
                <p className="text-xs text-text-muted mt-0.5">{t.label}</p>
                <p className="mt-3 text-xs text-text-secondary">{t.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mb-10">
            {[
              { icon: DollarSign, title: "Precios en USDT", desc: "Cotización competitiva directo de importación" },
              { icon: Package, title: "Mínimo USDT 130", desc: "Monto mínimo por pedido mayorista" },
              { icon: Truck, title: "Envíos flexibles", desc: "Coordinamos el envío que te convenga" },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-bg-card p-5">
                <b.icon size={20} className="text-violet" />
                <h3 className="mt-3 font-display text-sm font-bold">{b.title}</h3>
                <p className="mt-1 text-xs text-text-muted">{b.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/mayoristas/tienda" className="inline-flex items-center gap-2 rounded-xl bg-violet px-8 py-3.5 text-sm font-bold tracking-wider text-white hover:bg-violet-dark hover:shadow-xl hover:shadow-violet/20 transition-all">
              <Crown size={15} /> VER CATÁLOGO MAYORISTA
            </Link>
          </div>
        </div>
      </section>

      {/* Novedades */}
      {newProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={15} className="text-green-400" />
                <span className="text-[11px] font-bold tracking-[0.15em] text-green-400 uppercase">Recién llegado</span>
              </div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Novedades</h2>
            </div>
            <Link href="/productos" className="text-sm font-semibold text-violet-light hover:text-violet transition-colors flex items-center gap-1">VER TODO <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {newProducts.map((p, i) => (
              <div key={p.id} className={`group relative flex flex-col overflow-hidden rounded-2xl border border-green-500/20 bg-bg-card hover:border-green-500/40 transition-all duration-300 opacity-0 animate-fade-up stagger-${Math.min(i + 1, 8)}`}>
                <Link href={`/producto/${p.slug}`}>
                  <div className="relative aspect-square bg-bg-secondary overflow-hidden">
                    <span className="absolute left-2 top-2 z-10 rounded-md bg-green-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white shadow">NUEVO</span>
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={`${p.brand} ${p.model}${p.flavor ? ` ${p.flavor}` : ""} — FuelFit`}
                        fill unoptimized
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        priority={i < 2}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated opacity-30"><Wind size={24} className="text-violet/50" /></div>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-bg-card/90 to-transparent p-2 group-hover:translate-y-0 transition-transform duration-300 z-10">
                      <span className="block rounded-lg bg-green-600 py-1.5 text-center text-[10px] font-bold tracking-wider text-white">VER PRODUCTO</span>
                    </div>
                  </div>
                </Link>
                <div className="flex flex-col flex-1 p-2.5 sm:p-3">
                  <div className="flex-1">
                    <Link href={`/producto/${p.slug}`}>
                      {p.flavor && <h3 className="text-sm font-bold tracking-wide text-text-primary group-hover:text-white transition-colors line-clamp-2 leading-snug">{p.flavor}</h3>}
                      <p className="mt-0.5 text-xs text-green-400/70 truncate">{p.brand.toUpperCase()} - {p.model.toUpperCase()}</p>
                    </Link>
                  </div>
                  <p className="mt-1.5 font-display text-sm font-bold">${p.price_min_ars.toLocaleString()}<span className="ml-0.5 text-[8px] font-normal text-text-muted">ARS</span></p>
                  {stockOf(p) <= 0 ? (
                    <p className="mt-2 text-center text-[10px] font-semibold text-red-400">Sin stock</p>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex items-center rounded-lg border border-border">
                        <button onClick={() => setQty(p.id, getQty(p.id) - 1, stockOf(p))} disabled={getQty(p.id) <= 1} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={10} /></button>
                        <span className="w-5 text-center text-xs font-semibold">{getQty(p.id)}</span>
                        <button onClick={() => setQty(p.id, getQty(p.id) + 1, stockOf(p))} disabled={getQty(p.id) >= stockOf(p)} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={10} /></button>
                      </div>
                      <button onClick={() => handleAdd(p)} className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold transition-all ${addedId === p.id ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                        <ShoppingCart size={11} />{addedId === p.id ? "✓ Agregado" : <><span className="hidden sm:inline">Agregar al carrito</span><span className="sm:hidden">Agregar</span></>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
