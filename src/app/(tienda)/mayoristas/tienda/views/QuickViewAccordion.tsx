"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ShoppingCart, Eye, Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/local-db/types";
import { ImageModal } from "./ImageModal";
import { BrandLogo, getBrandScale, hasBrandLogo } from "@/components/tienda/BrandLogo";

interface Props {
  products: Product[];
  qtyMap: Record<string, number>;
  cartQtyMap: Record<string, number>;
  setQty: (id: string, qty: number, max: number) => void;
  handleAdd: (p: Product) => void;
  addedId: string | null;
  fxRate?: number | null;
  showARS?: boolean;
}

function stockOf(p: Product) { return Math.max(0, p.stock_actual - p.stock_reservado); }

export function QuickViewAccordion({ products, qtyMap, cartQtyMap, setQty, handleAdd, addedId, fxRate, showARS }: Props) {
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set());
  const [openModels, setOpenModels] = useState<Set<string>>(new Set());
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  const getQty = (id: string) => qtyMap[id] || 1;

  const brandMap = new Map<string, Map<string, Product[]>>();
  for (const p of products) {
    if (!brandMap.has(p.brand)) brandMap.set(p.brand, new Map());
    const modelMap = brandMap.get(p.brand)!;
    if (!modelMap.has(p.model)) modelMap.set(p.model, []);
    modelMap.get(p.model)!.push(p);
  }

  const toggleBrand = (brand: string) => setOpenBrands(prev => {
    const next = new Set(prev); next.has(brand) ? next.delete(brand) : next.add(brand); return next;
  });
  const toggleModel = (key: string) => setOpenModels(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const fmt = (usdt: number) =>
    showARS && fxRate ? `$${Math.round(usdt * fxRate).toLocaleString("es-AR")}` : `USDT ${usdt}`;

  return (
    <div className="space-y-1.5">
      {Array.from(brandMap.entries()).map(([brand, modelMap]) => {
        const isOpen = openBrands.has(brand);
        const allFlavors = Array.from(modelMap.values()).flat();
        const isAccessory = allFlavors.every(p => p.category === "accesorios");

        return (
          <div key={brand} className="rounded-xl border border-border overflow-hidden">
            {/* ── Header MARCA ── */}
            <button
              onClick={() => toggleBrand(brand)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-bg-card hover:bg-bg-hover transition-all"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  size={15}
                  className={`text-violet shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                />
                {hasBrandLogo(brand, isAccessory) && (
                  <span
                    className="shrink-0 mx-3"
                    style={{ transform: `scale(${getBrandScale(brand)})`, transformOrigin: "center" }}
                  >
                    <BrandLogo brand={brand} isAccessory={isAccessory} size={28} />
                  </span>
                )}
                <span className={`font-display text-base font-bold tracking-wider uppercase transition-colors duration-150 ${isOpen ? "text-violet-light" : "text-text-primary"}`}>
                  {brand}
                </span>
              </div>
              <ChevronDown
                size={15}
                className={`text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-border bg-bg-secondary">
                {Array.from(modelMap.entries()).map(([model, flavors]) => {
                  const modelKey = `${brand}|${model}`;
                  const isModelOpen = openModels.has(modelKey);
                  const ref = flavors[0]; // todos los sabores del modelo tienen el mismo precio

                  const modelIsNew = flavors.some(p => p.is_new);
                  const totalModelStock = flavors.reduce((sum, p) => sum + stockOf(p), 0);
                  const modelLowStock = totalModelStock > 0 && totalModelStock < 30;

                  return (
                    <div key={model} className="border-b border-border/50 last:border-0">
                      {/* ── Header MODELO ── */}
                      <button
                        onClick={() => toggleModel(modelKey)}
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-hover transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ChevronRight
                            size={13}
                            className={`shrink-0 transition-all duration-150 ${isModelOpen ? "rotate-90 text-violet" : "text-text-muted"}`}
                          />
                          <span className={`text-sm font-semibold transition-colors duration-150 ${isModelOpen ? "text-violet-light" : "text-text-primary"}`}>{model}</span>
                          {modelIsNew && (
                            <span className="shrink-0 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-bold text-green-400 uppercase">Nuevo</span>
                          )}
                          {modelLowStock && (
                            <span className="shrink-0 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400 uppercase">Stock bajo</span>
                          )}
                        </div>
                        {/* Precios: pills en desktop, tabla en mobile */}
                        <div className="hidden sm:flex items-center gap-1.5 shrink-0 ml-3">
                          {ref.price_may_x15 > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-bg-elevated px-2 py-0.5">
                              <span className="text-[10px] text-text-muted">×15</span>
                              <span className="text-[11px] font-bold text-green-400">{fmt(ref.price_may_x15)}</span>
                            </span>
                          )}
                          {ref.price_may_x50 > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-bg-elevated px-2 py-0.5">
                              <span className="text-[10px] text-text-muted">×50</span>
                              <span className="text-[11px] font-bold text-green-400">{fmt(ref.price_may_x50)}</span>
                            </span>
                          )}
                          {ref.price_may_x100 > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-bg-elevated px-2 py-0.5">
                              <span className="text-[10px] text-text-muted">×100</span>
                              <span className="text-[11px] font-bold text-green-400">{fmt(ref.price_may_x100)}</span>
                            </span>
                          )}
                        </div>
                      </button>

                      {/* ── Filas SABORES ── */}
                      {isModelOpen && (
                        <div className="px-4 pb-2 space-y-0.5">
                          {/* Tabla de precios x15/x50/x100 — solo mobile, con flash secuencial al desplegar */}
                          <div className="sm:hidden flex gap-2 pt-2 pb-1">
                            {ref.price_may_x15 > 0 && (
                              <div className="flex-1 text-center rounded-lg bg-bg-card border border-border/50 py-1.5">
                                <p className="text-[9px] text-text-muted opacity-70">×15</p>
                                <p className="text-xs font-semibold text-text-secondary" style={{ animation: "priceFlash 1s ease-in-out 0ms 1" }}>{fmt(ref.price_may_x15)}</p>
                              </div>
                            )}
                            {ref.price_may_x50 > 0 && (
                              <div className="flex-1 text-center rounded-lg bg-bg-card border border-border/50 py-1.5">
                                <p className="text-[9px] text-text-muted opacity-70">×50</p>
                                <p className="text-xs font-semibold text-text-secondary" style={{ animation: "priceFlash 1s ease-in-out 350ms 1" }}>{fmt(ref.price_may_x50)}</p>
                              </div>
                            )}
                            {ref.price_may_x100 > 0 && (
                              <div className="flex-1 text-center rounded-lg bg-bg-card border border-border/50 py-1.5">
                                <p className="text-[9px] text-text-muted opacity-70">×100</p>
                                <p className="text-xs font-semibold text-text-secondary" style={{ animation: "priceFlash 1s ease-in-out 700ms 1" }}>{fmt(ref.price_may_x100)}</p>
                              </div>
                            )}
                          </div>
                          {flavors.map(p => {
                            const totalStock = stockOf(p);
                            const inCart = cartQtyMap[p.id] ?? 0;
                            const remaining = Math.max(0, totalStock - inCart);
                            const qty = getQty(p.id);
                            const isAdded = addedId === p.id;
                            const isFullyAdded = remaining <= 0 && totalStock > 0;

                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-2.5 hover:bg-bg-card transition-all"
                              >
                                {/* Nombre del sabor */}
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => p.image && setModalProduct(p)}
                                    className={`text-sm text-text-primary font-medium truncate text-left w-full ${p.image ? "hover:text-violet-light transition-colors cursor-pointer" : "cursor-default"}`}
                                  >
                                    {p.flavor || model}
                                  </button>
                                </div>

                                {/* Stock disponible */}
                                <div className="text-right shrink-0 w-12 sm:w-16">
                                  {totalStock <= 0 ? (
                                    <span className="text-xs font-semibold text-red-400">Agot.</span>
                                  ) : isFullyAdded ? (
                                    <span className="text-xs text-violet-light font-semibold">✓ cart</span>
                                  ) : (
                                    <span className="text-xs text-text-muted">
                                      {remaining}
                                      {inCart > 0 && <span className="text-violet/70 hidden sm:inline"> ({inCart}✓)</span>}
                                    </span>
                                  )}
                                </div>

                                {/* Ojito */}
                                {p.image && (
                                  <button
                                    onClick={() => setModalProduct(p)}
                                    className="shrink-0 p-1 text-text-muted hover:text-violet-light transition-colors"
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}

                                {/* Cantidad + Agregar */}
                                {totalStock > 0 && !isFullyAdded && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Selector de cantidad */}
                                    <div className="flex items-center rounded-lg border border-border">
                                      <button
                                        onClick={() => setQty(p.id, qty - 1, remaining)}
                                        disabled={qty <= 1}
                                        className="px-1.5 py-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"
                                      >
                                        <Minus size={11} />
                                      </button>
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={remaining}
                                        value={Math.min(qty, remaining)}
                                        onChange={(e) => {
                                          const v = parseInt(e.target.value, 10);
                                          setQty(p.id, Number.isFinite(v) ? v : 1, remaining);
                                        }}
                                        onFocus={(e) => e.currentTarget.select()}
                                        className="w-10 sm:w-12 text-center text-xs font-bold bg-transparent outline-none focus:bg-bg-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <button
                                        onClick={() => setQty(p.id, qty + 1, remaining)}
                                        disabled={qty >= remaining}
                                        className="px-1.5 py-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </div>
                                    <button
                                      onClick={() => handleAdd(p)}
                                      disabled={isAdded}
                                      className={`flex items-center justify-center gap-1 rounded-lg sm:px-3 px-2.5 py-2 text-xs font-bold transition-all disabled:cursor-default ${
                                        isAdded
                                          ? "bg-green-500/20 text-green-400"
                                          : "bg-violet/10 text-violet-light hover:bg-violet/20"
                                      }`}
                                    >
                                      <ShoppingCart size={12} />
                                      <span>{isAdded ? "✓" : "+"}</span>
                                    </button>
                                  </div>
                                )}

                                {/* Estado cuando ya está todo agregado */}
                                {totalStock > 0 && isFullyAdded && (
                                  <span className="text-xs font-semibold text-violet/60 shrink-0">✓ Todo</span>
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
            )}
          </div>
        );
      })}

      {modalProduct && (
        <ImageModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          fxRate={fxRate}
          showARS={showARS}
        />
      )}
    </div>
  );
}
