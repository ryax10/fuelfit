"use client";

import { useState } from "react";
import { ShoppingCart, Eye, Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/local-db/types";
import { ImageModal } from "./ImageModal";

interface Props {
  products: Product[];
  qtyMap: Record<string, number>;
  setQty: (id: string, qty: number, max: number) => void;
  handleAdd: (p: Product) => void;
  addedId: string | null;
  fxRate?: number | null;
  showARS?: boolean;
  searchQuery: string;
}

function stockOf(p: Product) { return Math.max(0, p.stock_actual - p.stock_reservado); }

export function QuickViewTable({ products, qtyMap, setQty, handleAdd, addedId, fxRate, showARS, searchQuery }: Props) {
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const getQty = (id: string) => qtyMap[id] || 1;
  const fmt = (usdt: number) => showARS && fxRate ? `$${Math.round(usdt * fxRate).toLocaleString("es-AR")}` : `U ${usdt}`;

  // Agrupar por marca → modelo para los separadores
  type Group = { brand: string; model: string; items: Product[] };
  const groups: Group[] = [];
  for (const p of products) {
    const last = groups[groups.length - 1];
    if (last && last.brand === p.brand && last.model === p.model) {
      last.items.push(p);
    } else {
      groups.push({ brand: p.brand, model: p.model, items: [p] });
    }
  }

  if (products.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-text-muted">
        {searchQuery ? `Sin resultados para "${searchQuery}"` : "No hay productos disponibles"}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header de tabla */}
        <div className="hidden sm:grid grid-cols-[2fr_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 bg-bg-secondary text-[10px] font-semibold tracking-wider text-text-muted uppercase border-b border-border">
          <span>Producto</span>
          <span className="text-right">Stock</span>
          <span className="text-right">×15</span>
          <span className="text-right">×50</span>
          <span className="text-right">×100</span>
          <span className="text-right">Agregar</span>
        </div>

        {groups.map(({ brand, model, items }) => (
          <div key={`${brand}|${model}`}>
            {/* Separador de modelo */}
            <div className="px-4 py-1.5 bg-violet/5 border-b border-border/50">
              <span className="text-[10px] font-bold tracking-wider text-violet/70 uppercase">{brand} — {model}</span>
            </div>
            {items.map(p => {
              const stock = stockOf(p);
              const qty = getQty(p.id);
              const isAdded = addedId === p.id;
              return (
                <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto_auto_auto_auto] gap-2 sm:gap-3 items-center px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-bg-hover transition-all">
                  {/* Nombre */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">{p.flavor || model}</span>
                    {p.is_new && <span className="rounded-md bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400 uppercase">Nuevo</span>}
                    {stock > 0 && stock < 5 && <span className="rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 uppercase">Bajo</span>}
                    {p.image && (
                      <button onClick={() => setModalProduct(p)} className="text-text-muted hover:text-violet-light transition-colors">
                        <Eye size={12} />
                      </button>
                    )}
                  </div>
                  {/* Stock */}
                  <div className="sm:text-right">
                    <span className={`text-xs font-semibold ${stock > 0 ? "text-text-secondary" : "text-red-400"}`}>
                      {stock > 0 ? `${stock} u` : "Agotado"}
                    </span>
                  </div>
                  {/* Precios */}
                  <span className="text-xs text-text-muted sm:text-right hidden sm:block">{p.price_may_x15 > 0 ? fmt(p.price_may_x15) : "—"}</span>
                  <span className="text-xs text-text-muted sm:text-right hidden sm:block">{p.price_may_x50 > 0 ? fmt(p.price_may_x50) : "—"}</span>
                  <span className="text-xs text-text-muted sm:text-right hidden sm:block">{p.price_may_x100 > 0 ? fmt(p.price_may_x100) : "—"}</span>
                  {/* Controles */}
                  {stock > 0 ? (
                    <div className="flex items-center gap-1 sm:justify-end">
                      <div className="flex items-center rounded-lg border border-border">
                        <button onClick={() => setQty(p.id, qty - 1, stock)} disabled={qty <= 1} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={10} /></button>
                        <span className="w-6 text-center text-xs font-semibold">{qty}</span>
                        <button onClick={() => setQty(p.id, qty + 1, stock)} disabled={qty >= stock} className="px-1.5 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={10} /></button>
                      </div>
                      <button
                        onClick={() => handleAdd(p)}
                        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all ${isAdded ? "bg-green-500/20 text-green-400" : "bg-violet/10 text-violet-light hover:bg-violet/20"}`}
                      >
                        <ShoppingCart size={11} /> {isAdded ? "✓" : "+"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-red-400 sm:text-right">—</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {modalProduct && <ImageModal product={modalProduct} onClose={() => setModalProduct(null)} fxRate={fxRate} showARS={showARS} />}
    </>
  );
}
