"use client";

import { useRef, useState } from "react";
import { ShoppingCart, Eye, Minus, Plus, ChevronDown } from "lucide-react";
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

export function QuickViewScroll({ products, qtyMap, setQty, handleAdd, addedId, fxRate, showARS }: Props) {
  const [collapsedModels, setCollapsedModels] = useState<Set<string>>(new Set());
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const brandRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const getQty = (id: string) => qtyMap[id] || 1;
  const fmt = (usdt: number) => showARS && fxRate ? `$${Math.round(usdt * fxRate).toLocaleString("es-AR")}` : `USDT ${usdt}`;

  const toggleModel = (key: string) => {
    setCollapsedModels(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Agrupar por marca → modelo
  const brandMap = new Map<string, Map<string, Product[]>>();
  for (const p of products) {
    if (!brandMap.has(p.brand)) brandMap.set(p.brand, new Map());
    const mm = brandMap.get(p.brand)!;
    if (!mm.has(p.model)) mm.set(p.model, []);
    mm.get(p.model)!.push(p);
  }

  return (
    <>
      {/* Jump links a marcas */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {Array.from(brandMap.keys()).map(brand => (
          <button
            key={brand}
            onClick={() => brandRefs.current[brand]?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg-hover hover:text-violet-light transition-all"
          >
            {brand}
          </button>
        ))}
      </div>

      <div className="space-y-0">
        {Array.from(brandMap.entries()).map(([brand, modelMap]) => (
          <div key={brand} ref={el => { brandRefs.current[brand] = el; }}>
            {/* Header de marca — sticky */}
            <div className="sticky top-16 z-10 flex items-center gap-3 px-4 py-2.5 bg-bg-elevated border border-border rounded-t-xl">
              <span className="font-display text-sm font-bold tracking-widest text-violet uppercase">{brand}</span>
              <div className="flex-1 h-px bg-violet/10" />
              <span className="text-[10px] text-text-muted">{Array.from(modelMap.values()).flat().length} productos</span>
            </div>

            <div className="border border-t-0 border-border rounded-b-xl overflow-hidden mb-3">
              {Array.from(modelMap.entries()).map(([model, flavors]) => {
                const modelKey = `${brand}|${model}`;
                const isCollapsed = collapsedModels.has(modelKey);
                return (
                  <div key={model} className="border-b border-border/50 last:border-0">
                    {/* Sub-header modelo */}
                    <button
                      onClick={() => toggleModel(modelKey)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-bg-secondary hover:bg-bg-hover transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary">{model}</span>
                        <span className="text-[10px] text-text-muted">{flavors.length} sabor{flavors.length !== 1 ? "es" : ""}</span>
                      </div>
                      <ChevronDown size={13} className={`text-text-muted transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-border/20">
                        {flavors.map(p => {
                          const stock = stockOf(p);
                          const qty = getQty(p.id);
                          const isAdded = addedId === p.id;
                          return (
                            <div key={p.id} className="flex items-center gap-2 px-5 py-2.5 hover:bg-bg-hover transition-all">
                              <div className="flex-1 flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="text-sm text-text-secondary">{p.flavor || model}</span>
                                {p.is_new && <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400 uppercase">Nuevo</span>}
                                {stock > 0 && stock < 5 && <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 uppercase">Stock bajo</span>}
                              </div>
                              <span className={`text-[10px] shrink-0 ${stock > 0 ? "text-text-muted" : "text-red-400"}`}>{stock > 0 ? `${stock} u` : "Agotado"}</span>
                              {p.price_may_x15 > 0 && <span className="text-[10px] text-text-muted shrink-0 hidden sm:block">×15 {fmt(p.price_may_x15)}</span>}
                              {p.price_may_x50 > 0 && <span className="text-[10px] text-text-muted shrink-0 hidden sm:block">×50 {fmt(p.price_may_x50)}</span>}
                              {p.price_may_x100 > 0 && <span className="text-[10px] text-text-muted shrink-0 hidden sm:block">×100 {fmt(p.price_may_x100)}</span>}
                              {p.image && (
                                <button onClick={() => setModalProduct(p)} className="shrink-0 p-1 text-text-muted hover:text-violet-light transition-colors">
                                  <Eye size={12} />
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
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {modalProduct && <ImageModal product={modalProduct} onClose={() => setModalProduct(null)} fxRate={fxRate} showARS={showARS} />}
    </>
  );
}
