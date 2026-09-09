"use client";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, ShoppingCart, Minus, Plus, CheckCircle, XCircle, Wind } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { addToCartMay } from "@/lib/local-db";
import type { Product } from "@/lib/local-db/types";

export default function MayoristaProductoClient({ slug, initialProduct }: { slug: string; initialProduct?: Product | null }) {
  const [product, setProduct] = useState<Product | null>(initialProduct ?? null);
  const [loading, setLoading] = useState(!initialProduct);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (initialProduct) return;
    createClient()
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("visible", true)
      .single()
      .then(({ data }) => { setProduct(data as Product | null); setLoading(false); });
  }, [slug, initialProduct]);

  if (loading) return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center text-text-muted text-sm">Cargando...</div>
  );

  if (!product) return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <p className="text-text-muted">Producto no encontrado</p>
      <Link href="/mayoristas/tienda" className="mt-4 inline-block text-violet-light hover:text-violet">← Volver a la tienda</Link>
    </div>
  );

  const availableUnits = Math.max(0, product.stock_actual - product.stock_reservado);
  const activeTier: "x100" | "x50" | "x15" =
    qty >= 100 && product.price_may_x100 > 0 ? "x100" :
    qty >= 50 && product.price_may_x50 > 0 ? "x50" : "x15";
  const activePrice =
    activeTier === "x100" ? product.price_may_x100 :
    activeTier === "x50" ? product.price_may_x50 :
    product.price_may_x15;

  const handleAdd = () => {
    if (activePrice === 0 || availableUnits <= 0) return;
    addToCartMay(product.id, Math.min(qty, availableUnits));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-8 flex items-center gap-1 text-sm text-text-muted">
        <Link href="/mayoristas/tienda" className="hover:text-violet-light transition-colors">Tienda Mayorista</Link>
        <ChevronRight size={14} />
        <span className="text-text-primary">{product.name}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square rounded-3xl bg-bg-card border border-border overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={`${product.brand} ${product.model}${product.flavor ? ` ${product.flavor}` : ""} — FuelFit`}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-bg-elevated opacity-20">
                <Wind size={40} className="text-violet/50" />
              </div>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-violet">{product.brand.toUpperCase()} — {product.model.toUpperCase()}</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold">{product.flavor || product.model}</h1>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className={`rounded-xl border p-3 text-center ${activeTier === "x15" ? "border-violet/20 bg-violet/5" : "border-border bg-bg-card"}`}>
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">x15</p>
              <p className={`mt-1 font-display text-xl font-bold ${product.price_may_x15 > 0 ? "text-green-400" : "text-text-muted"}`}>{product.price_may_x15 > 0 ? `USDT ${product.price_may_x15}` : "—"}</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${activeTier === "x50" ? "border-violet/20 bg-violet/5" : "border-border bg-bg-card"}`}>
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">x50</p>
              <p className={`mt-1 font-display text-xl font-bold ${product.price_may_x50 > 0 ? "text-green-400" : "text-text-muted"}`}>{product.price_may_x50 > 0 ? `USDT ${product.price_may_x50}` : "—"}</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${activeTier === "x100" ? "border-violet/20 bg-violet/5" : "border-border bg-bg-card"}`}>
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">x100+</p>
              <p className={`mt-1 font-display text-xl font-bold ${product.price_may_x100 > 0 ? "text-green-400" : "text-text-muted"}`}>{product.price_may_x100 > 0 ? `USDT ${product.price_may_x100}` : "—"}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-border bg-bg-card">
              <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} className="px-3.5 py-2.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"><Minus size={16} /></button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={availableUnits}
                value={qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isFinite(v) || v < 1) return setQty(1);
                  if (availableUnits > 0 && v > availableUnits) return setQty(availableUnits);
                  setQty(v);
                }}
                onFocus={(e) => e.currentTarget.select()}
                className="w-14 text-center text-sm font-semibold bg-transparent outline-none focus:bg-bg-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button onClick={() => setQty(Math.min(availableUnits, qty + 1))} disabled={qty >= availableUnits} className="px-3.5 py-2.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"><Plus size={16} /></button>
            </div>
            <button onClick={handleAdd} disabled={availableUnits <= 0 || activePrice === 0}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold tracking-wider text-white transition-all ${added ? "bg-green-600" : availableUnits > 0 && activePrice > 0 ? "bg-violet hover:bg-violet-dark hover:shadow-lg hover:shadow-violet/20" : "bg-gray-600 cursor-not-allowed"}`}>
              <ShoppingCart size={16} />{added ? "✓ AGREGADO" : activePrice === 0 ? "SIN PRECIO MAYORISTA" : "AGREGAR AL CARRITO"}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            {availableUnits > 0
              ? <><CheckCircle size={15} className="text-green-400" /><span className="text-green-400">{availableUnits} disponibles</span></>
              : <><XCircle size={15} className="text-red-400" /><span className="text-red-400">Sin stock</span></>
            }
          </div>
          {qty >= 50 && activeTier === "x15" && activePrice > 0 && (
            <p className="mt-2 text-xs text-text-muted">
              * No hay precio x{qty >= 100 ? "100" : "50"} configurado — se aplica precio x15: USDT {activePrice}
            </p>
          )}
          <div className="mt-6 rounded-xl border border-border bg-bg-card p-4 text-xs text-text-muted space-y-1">
            <p>📦 Envíos a todo el país por Vía Cargo — 1 a 5 días hábiles</p>
            <p>🛵 Mismo día en CABA/GBA a cargo del comprador</p>
            <p>📍 Retiro coordinado por WhatsApp — Lunes a Sábados de 10 a 18 hs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
