"use client";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, ShoppingCart, Minus, Plus, XCircle, CheckCircle, Wind } from "lucide-react";
import { useState } from "react";
import { addToCart } from "@/lib/local-db";
import type { Product } from "@/lib/local-db/types";

export default function ProductoDetalleClient({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const [selectedTier, setSelectedTier] = useState<{ qty: number; price: number } | null>(null);
  const [added, setAdded] = useState(false);

  const availableUnits = Math.max(0, product.stock_actual - product.stock_reservado);
  const upack = (product.units_per_pack ?? 1) || 1;
  const tiers = product.unit_sale_options?.options?.filter((t: { qty: number; price: number }) => t.qty > 0 && t.price > 0) ?? [];
  const hasUnitSaleConfig = (product.unit_sale_options?.options?.length ?? 0) > 0;
  const hasUnitSale = tiers.length > 0;
  const stockJars = Math.floor(availableUnits / upack);
  const stockSueltas = availableUnits % upack;

  const handleAdd = () => {
    if (availableUnits <= 0) return;
    if (hasUnitSale) {
      if (!selectedTier) return;
      const unitPrice = selectedTier.price / selectedTier.qty;
      addToCart(product.id, Math.min(selectedTier.qty, availableUnits), unitPrice);
    } else {
      addToCart(product.id, Math.min(qty, availableUnits));
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-8 flex items-center gap-1 text-sm text-text-muted">
        <Link href="/" className="hover:text-violet-light transition-colors">Inicio</Link>
        <ChevronRight size={14} />
        <Link href="/productos" className="hover:text-violet-light transition-colors">Productos</Link>
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

          {hasUnitSaleConfig && !hasUnitSale ? (
            <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
              <p className="text-sm text-yellow-400">Este producto no tiene opciones de compra disponibles por el momento.</p>
            </div>
          ) : hasUnitSale ? (
            <div className="mt-6">
              <p className="text-xs font-semibold text-text-muted mb-3">ELEGÍ TU CANTIDAD</p>
              <div className="grid grid-cols-3 gap-2">
                {tiers.map((tier: { qty: number; price: number }) => (
                  <button
                    key={tier.qty}
                    onClick={() => setSelectedTier(tier)}
                    disabled={availableUnits < tier.qty}
                    className={`rounded-xl border p-3 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedTier?.qty === tier.qty
                        ? "border-violet bg-violet/10"
                        : "border-border bg-bg-card hover:border-violet/40"
                    }`}
                  >
                    <p className="text-[10px] font-semibold text-text-muted">x{tier.qty} unid.</p>
                    <p className="mt-1 font-display text-lg font-bold text-text-primary">${tier.price.toLocaleString()}</p>
                    <p className="text-[10px] text-text-muted">${(tier.price / tier.qty).toFixed(0)}/u</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold">${product.price_min_ars.toLocaleString()}</span>
              <span className="text-sm text-text-muted">ARS</span>
            </div>
          )}

          {product.price_may_x15 > 0 && (
            <p className="mt-2 text-sm text-violet/70">Precio mayorista desde USDT {product.price_may_x15}</p>
          )}

          <div className="mt-6 flex items-center gap-3">
            {!hasUnitSale && (
              <div className="flex items-center rounded-xl border border-border bg-bg-card">
                <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} className="px-3.5 py-2.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"><Minus size={16} /></button>
                <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => setQty(Math.min(availableUnits, qty + 1))} disabled={qty >= availableUnits} className="px-3.5 py-2.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"><Plus size={16} /></button>
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={availableUnits <= 0 || (hasUnitSale && !selectedTier)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold tracking-wider text-white transition-all ${
                added ? "bg-green-600"
                : availableUnits > 0 && (!hasUnitSale || selectedTier) ? "bg-violet hover:bg-violet-dark hover:shadow-lg hover:shadow-violet/20"
                : "bg-gray-600 cursor-not-allowed"
              }`}
            >
              <ShoppingCart size={16} />
              {added ? "✓ AGREGADO" : hasUnitSale && !selectedTier ? "ELEGÍ UNA OPCIÓN" : "AGREGAR AL CARRITO"}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            {availableUnits > 0
              ? <><CheckCircle size={15} className="text-green-400" /><span className="text-green-400">
                  {upack > 1
                    ? stockSueltas > 0
                      ? `${stockJars} frasco${stockJars !== 1 ? "s" : ""} (+${stockSueltas} sueltas)`
                      : `${stockJars} frasco${stockJars !== 1 ? "s" : ""} disponible${stockJars !== 1 ? "s" : ""}`
                    : `${availableUnits} unidades disponibles`
                  }
                </span></>
              : <><XCircle size={15} className="text-red-400" /><span className="text-red-400">Sin stock</span></>
            }
          </div>

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
