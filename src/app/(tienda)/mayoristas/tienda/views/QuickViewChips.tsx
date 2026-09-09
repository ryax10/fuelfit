"use client";

import { useState } from "react";
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

export function QuickViewChips({ products, qtyMap, setQty, handleAdd, addedId, fxRate, showARS }: Props) {
  const [activeBrand, setActiveBrand] = useState<string>("");
  const [openModels, setOpenModels] = useState<Set<string>>(new Set());
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const getQty = (id: string) => qtyMap[id] || 1;
  const fmt = (usdt: number) => showARS && fxRate ? `$${Math.round(usdt * fxRate).toLocaleString("es-AR")}` : `USDT ${usdt}`;

  // Construir árbol marca → modelo → sabores
  const brandMap = new Map<string, Map<string, Product[]>>();
  for (const p of products) {
    if (!brandMap.has(p.brand)) brandMap.set(p.brand, new Map());
    const mm = brandMap.get(p.brand)!;
    if (!mm.has(p.model)) mm.set(p.model, []);
    mm.get(p.model)!.push(p);
  }

  const brands = Array.from(brandMap.keys());
  const currentBrand = activeBrand || brands[0] || "";
  const modelMap: Map<string, Product[]> = brandMap.get(currentBrand) || new Map<string, Product[]>();

  const toggleModel = (key: string) => {
    setOpenModels(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <>
      {/* Pills de marca */}
      <div className="flex flex-wrap gap-2 mb-5">
        {brands.map(brand => (
          <button
            key={brand}
            onClick={() => { setActiveBrand(brand); setOpenModels(new Set()); }}
            className={`rounded-xl border px-4 py-2 text-sm font-bold tracking-wide transition-all ${brand === currentBrand ? "border-violet bg-violet/10 text-violet-light" : "border-border text-text-muted hover:border-violet/30 hover:bg-bg-hover"}`}
          >
            {brand}
            <span className="ml-2 text-[10px] font-normal opacity-60">
              {(Array.from(brandMap.get(brand)!.values()) as Product[][]).flat().length}
            </span>
          </button>
        ))}
      </div>

      {/* Acordeón de modelos del brand activo */}
      <div className="space-y-1">
        {Array.from(modelMap.entries()).map(([model, flavors]) => {
          const modelKey = `${currentBrand}|${model}`;
          const isOpen = openModels.has(modelKey);
          const modelStock = flavors.reduce((s, p) => s + stockOf(p), 0);
          const ref = flavors[0];

          return (
            <div key={model} className="rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => toggleModel(modelKey)}
                className="w-full flex items-center justify-between px-4 py-3 bg-bg-card hover:bg-bg-hover transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-text-primary">{model}</span>
                  <span className="text-[10px] text-text-muted">{flavors.length} sabor{flavors.length !== 1 ? "es" : ""} · {modelStock} u.</span>
                </div>
                <div className="flex items-center gap-3">
                  {ref.price_may_x15 > 0 && (
                    <span className="text-[10px] text-text-muted hidden sm:block">desde {fmt(ref.price_may_x15)}</span>
                  )}
                  <ChevronDown size={14} className={`text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border bg-bg-secondary divide-y divide-border/30">
                  {flavors.map(p => {
                    const stock = stockOf(p);
                    const qty = getQty(p.id);
                    const isAdded = addedId === p.id;
                    return (
                      <div key={p.id} className="flex items-center gap-2 px-5 py-2.5 hover:bg-bg-hover transition-all">
                        <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="text-sm text-text-secondary">{p.flavor || model}</span>
                          {p.is_new && <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400 uppercase">Nuevo</span>}
                          {stock > 0 && stock < 5 && <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 uppercase">Stock bajo</span>}
                        </div>
                        <span className={`text-[10px] shrink-0 ${stock > 0 ? "text-text-muted" : "text-red-400"}`}>{stock > 0 ? `${stock} u` : "Agotado"}</span>
                        {p.price_may_x15 > 0 && <span className="text-[10px] text-text-muted hidden sm:block shrink-0">×15 {fmt(p.price_may_x15)}</span>}
                        {p.price_may_x50 > 0 && <span className="text-[10px] text-text-muted hidden sm:block shrink-0">×50 {fmt(p.price_may_x50)}</span>}
                        {p.price_may_x100 > 0 && <span className="text-[10px] text-text-muted hidden sm:block shrink-0">×100 {fmt(p.price_may_x100)}</span>}
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
          );
        })}
      </div>

      {modalProduct && <ImageModal product={modalProduct} onClose={() => setModalProduct(null)} fxRate={fxRate} showARS={showARS} />}
    </>
  );
}
