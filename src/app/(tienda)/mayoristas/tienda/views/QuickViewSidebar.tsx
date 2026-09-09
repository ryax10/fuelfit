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
}

function stockOf(p: Product) { return Math.max(0, p.stock_actual - p.stock_reservado); }

export function QuickViewSidebar({ products, qtyMap, setQty, handleAdd, addedId, fxRate, showARS }: Props) {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const getQty = (id: string) => qtyMap[id] || 1;
  const fmt = (usdt: number) => showARS && fxRate ? `$${Math.round(usdt * fxRate).toLocaleString("es-AR")}` : `USDT ${usdt}`;

  // Construir árbol
  const brandMap = new Map<string, Set<string>>();
  for (const p of products) {
    if (!brandMap.has(p.brand)) brandMap.set(p.brand, new Set());
    brandMap.get(p.brand)!.add(p.model);
  }

  const brands = Array.from(brandMap.keys());
  const activeBrand = selectedBrand || brands[0] || "";
  const models = activeBrand ? Array.from(brandMap.get(activeBrand) || []) : [];
  const activeModel = selectedModel || models[0] || "";

  const visibleProducts = products.filter(p => p.brand === activeBrand && p.model === activeModel);

  return (
    <div className="flex gap-0 rounded-xl border border-border overflow-hidden" style={{ minHeight: 400 }}>
      {/* Sidebar — marcas */}
      <div className="w-28 sm:w-36 shrink-0 border-r border-border bg-bg-secondary overflow-y-auto">
        <p className="px-3 py-2 text-[9px] font-bold tracking-wider text-text-muted uppercase border-b border-border">Marca</p>
        {brands.map(brand => (
          <button
            key={brand}
            onClick={() => { setSelectedBrand(brand); setSelectedModel(""); }}
            className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-all border-b border-border/30 ${brand === activeBrand ? "bg-violet/10 text-violet-light border-l-2 border-l-violet" : "text-text-muted hover:bg-bg-hover"}`}
          >
            {brand}
          </button>
        ))}
      </div>

      {/* Sidebar — modelos */}
      <div className="w-24 sm:w-32 shrink-0 border-r border-border bg-bg-card overflow-y-auto">
        <p className="px-3 py-2 text-[9px] font-bold tracking-wider text-text-muted uppercase border-b border-border">Modelo</p>
        {models.map(model => (
          <button
            key={model}
            onClick={() => setSelectedModel(model)}
            className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-all border-b border-border/30 ${model === activeModel ? "bg-violet/10 text-violet-light border-l-2 border-l-violet" : "text-text-muted hover:bg-bg-hover"}`}
          >
            {model}
          </button>
        ))}
      </div>

      {/* Panel principal — sabores */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 border-b border-border bg-bg-secondary flex items-center justify-between">
          <p className="text-xs font-bold text-text-primary uppercase tracking-wide">{activeBrand} — {activeModel}</p>
          <span className="text-[10px] text-text-muted">{visibleProducts.length} sabor{visibleProducts.length !== 1 ? "es" : ""}</span>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-text-muted">Seleccioná una marca y modelo</div>
        ) : (
          <div className="divide-y divide-border/30">
            {visibleProducts.map(p => {
              const stock = stockOf(p);
              const qty = getQty(p.id);
              const isAdded = addedId === p.id;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-text-secondary">{p.flavor || activeModel}</span>
                      {p.is_new && <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400 uppercase">Nuevo</span>}
                      {stock > 0 && stock < 5 && <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 uppercase">Stock bajo</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${stock > 0 ? "text-text-muted" : "text-red-400"}`}>{stock > 0 ? `${stock} u` : "Agotado"}</span>
                      {p.price_may_x15 > 0 && <span className="text-[10px] text-text-muted">×15 {fmt(p.price_may_x15)}</span>}
                      {p.price_may_x50 > 0 && <span className="text-[10px] text-text-muted">×50 {fmt(p.price_may_x50)}</span>}
                      {p.price_may_x100 > 0 && <span className="text-[10px] text-text-muted">×100 {fmt(p.price_may_x100)}</span>}
                    </div>
                  </div>
                  {p.image && (
                    <button onClick={() => setModalProduct(p)} className="shrink-0 p-1 text-text-muted hover:text-violet-light transition-colors">
                      <Eye size={13} />
                    </button>
                  )}
                  {stock > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalProduct && <ImageModal product={modalProduct} onClose={() => setModalProduct(null)} fxRate={fxRate} showARS={showARS} />}
    </div>
  );
}
