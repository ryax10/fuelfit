"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { X, Minus, Plus, Trash2, ShoppingCart, Crown, ChevronRight, Zap, TrendingUp } from "lucide-react";
import {
  useDB, getCart, getCartMay, getCartMayItemPrices,
  updateCartQty, removeFromCart, clearCart,
  updateCartMayQty, removeFromCartMay, clearCartMay,
} from "@/lib/local-db";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/local-db/types";

const TIER_THRESHOLDS = { x50: 50, x100: 100 };
const TIER_WARN_WITHIN = 30;

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isMayorista: boolean;
}

function TierProgress({ totalUnits, products, cartProductIds }: {
  totalUnits: number;
  products: Product[];
  cartProductIds: Set<string>;
}) {
  const nextTier = totalUnits < TIER_THRESHOLDS.x50 ? TIER_THRESHOLDS.x50 : totalUnits < TIER_THRESHOLDS.x100 ? TIER_THRESHOLDS.x100 : null;
  if (!nextTier) return null;

  const remaining = nextTier - totalUnits;
  if (remaining > TIER_WARN_WITHIN) return null;

  const pct = Math.round((totalUnits / nextTier) * 100);
  const tierLabel = nextTier === TIER_THRESHOLDS.x50 ? "precio x50" : "precio x100";

  const suggestion = products.find(p =>
    !cartProductIds.has(p.id) &&
    p.visible &&
    (p.stock_actual - p.stock_reservado) >= remaining &&
    p.price_may_x15 > 0
  ) || products.find(p =>
    !cartProductIds.has(p.id) &&
    p.visible &&
    p.stock_actual > p.stock_reservado &&
    p.price_may_x15 > 0
  );

  return (
    <div className="mx-4 mb-3 rounded-xl border border-violet/20 bg-violet/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={13} className="text-violet-light shrink-0" />
        <p className="text-xs font-semibold text-violet-light">
          Te faltan <span className="text-white font-bold">{remaining}</span> unidades para {tierLabel}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-violet/10 mb-2">
        <div
          className="h-full rounded-full bg-violet transition-all duration-500"
          style={{ width: `${Math.min(pct, 99)}%` }}
        />
      </div>
      {suggestion && (
        <p className="text-[10px] text-text-muted">
          <span className="text-violet-light font-semibold">Sugerencia:</span>{" "}
          agregá {remaining} <span className="font-medium">{suggestion.brand} {suggestion.model}{suggestion.flavor ? ` ${suggestion.flavor}` : ""}</span>
        </p>
      )}
    </div>
  );
}

export function CartDrawer({ isOpen, onClose, isMayorista }: CartDrawerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const retailCart = useDB(useCallback(() => getCart(), []));
  const mayCart = useDB(useCallback(() => getCartMay(), []));
  const cart = isMayorista ? mayCart : retailCart;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen || products.length > 0) return;
    const supabase = createClient();
    supabase.from("products").select("*").eq("visible", true)
      .then(({ data }) => setProducts((data || []) as Product[]));
    fetch("/api/fx").then(r => r.json()).then(j => { if (j?.rate) setFxRate(j.rate); }).catch(() => {});
  }, [isOpen, products.length]);

  const priceMap = isMayorista ? getCartMayItemPrices(mayCart, products) : new Map<string, number>();

  const cartItems = cart.map(c => {
    const p = products.find(pr => pr.id === c.product_id);
    if (!p) return null;
    const unitPrice = isMayorista
      ? (priceMap.get(c.product_id) ?? p.price_may_x15)
      : (c.unit_price_override ?? p.price_min_ars);
    return { ...c, product: p, unitPrice };
  }).filter(Boolean) as { product_id: string; qty: number; product: Product; unitPrice: number }[];

  const totalUnits = isMayorista ? cartItems.reduce((s, i) => s + i.qty, 0) : 0;
  const total = cartItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const cartProductIds = new Set(cart.map(c => c.product_id));

  if (!mounted) return null;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Panel desktop (derecha) */}
      <div
        className={`fixed right-0 top-0 z-[61] hidden sm:flex h-full w-96 flex-col bg-bg-card border-l border-border shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <DrawerContent
          isMayorista={isMayorista}
          cartItems={cartItems}
          totalUnits={totalUnits}
          total={total}
          fxRate={fxRate}
          products={products}
          cartProductIds={cartProductIds}
          onClose={onClose}
        />
      </div>

      {/* Panel mobile (abajo) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[61] flex sm:hidden max-h-[85vh] flex-col rounded-t-2xl bg-bg-card border-t border-border shadow-2xl transition-transform duration-300 ${isOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        <DrawerContent
          isMayorista={isMayorista}
          cartItems={cartItems}
          totalUnits={totalUnits}
          total={total}
          fxRate={fxRate}
          products={products}
          cartProductIds={cartProductIds}
          onClose={onClose}
        />
      </div>
    </>
  );
}

function DrawerContent({
  isMayorista, cartItems, totalUnits, total, fxRate, products, cartProductIds, onClose,
}: {
  isMayorista: boolean;
  cartItems: { product_id: string; qty: number; product: Product; unitPrice: number }[];
  totalUnits: number;
  total: number;
  fxRate: number | null;
  products: Product[];
  cartProductIds: Set<string>;
  onClose: () => void;
}) {
  const isEmpty = cartItems.length === 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {isMayorista ? <Crown size={16} className="text-violet-light" /> : <ShoppingCart size={16} className="text-text-secondary" />}
          <span className="font-display font-bold text-sm">
            {isMayorista ? "Carrito Mayorista" : "Mi Carrito"}
          </span>
          {cartItems.length > 0 && (
            <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[10px] font-bold text-violet-light">
              {isMayorista ? `${totalUnits} u` : `${cartItems.length} ítem${cartItems.length !== 1 ? "s" : ""}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {cartItems.length > 0 && (
            <button
              onClick={() => isMayorista ? clearCartMay() : clearCart()}
              className="rounded-lg px-2 py-1 text-[10px] font-semibold text-text-muted hover:text-red-400 hover:bg-red-500/5 transition-all"
            >
              Vaciar
            </button>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-all">
            <X size={18} />
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
            <ShoppingCart size={28} className="text-text-muted" />
          </div>
          <p className="text-sm text-text-muted">Tu carrito está vacío</p>
          <button
            onClick={onClose}
            className="mt-1 rounded-xl bg-violet/10 px-5 py-2 text-xs font-bold text-violet-light hover:bg-violet/20 transition-all"
          >
            Seguir comprando
          </button>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 px-4 min-h-0">
            {cartItems.map(item => (
              <div key={item.product_id} className="rounded-xl border border-border bg-bg-secondary p-3">
                <div className="flex items-start gap-2.5">
                  <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-bg-elevated">
                    {item.product.image
                      ? <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" loading="lazy" />
                      : <div className="flex h-full w-full items-center justify-center text-xl">📦</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold tracking-wider text-violet/70 uppercase">{item.product.brand}</p>
                    <p className="text-xs font-medium text-text-primary leading-snug">{item.product.model}{item.product.flavor ? ` — ${item.product.flavor}` : ""}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {isMayorista ? `USDT ${item.unitPrice.toFixed(2)}/u` : `$${item.unitPrice.toLocaleString("es-AR")}/u`}
                    </p>
                  </div>
                  <button
                    onClick={() => isMayorista ? removeFromCartMay(item.product_id) : removeFromCart(item.product_id)}
                    className="text-text-muted hover:text-red-400 transition-colors p-0.5 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center rounded-lg border border-border">
                    <button
                      onClick={() => isMayorista ? updateCartMayQty(item.product_id, item.qty - 1) : updateCartQty(item.product_id, item.qty - 1)}
                      disabled={item.qty <= 1}
                      className="px-2 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-8 text-center text-xs font-bold">{item.qty}</span>
                    <button
                      onClick={() => isMayorista ? updateCartMayQty(item.product_id, item.qty + 1) : updateCartQty(item.product_id, item.qty + 1)}
                      disabled={item.qty >= Math.max(1, item.product.stock_actual - item.product.stock_reservado)}
                      className="px-2 py-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-green-400">
                    {isMayorista
                      ? `USDT ${(item.unitPrice * item.qty).toFixed(2)}`
                      : `$${(item.unitPrice * item.qty).toLocaleString("es-AR")}`
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tier progress (mayorista) */}
          {isMayorista && (
            <TierProgress totalUnits={totalUnits} products={products} cartProductIds={cartProductIds} />
          )}

          {/* Total + CTA */}
          <div className="px-4 pb-4 pt-2 border-t border-border shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Total</span>
              <div className="text-right">
                <span className="font-display text-lg font-bold text-green-400">
                  {isMayorista ? `USDT ${total.toFixed(2)}` : `$${total.toLocaleString("es-AR")}`}
                </span>
                {isMayorista && fxRate && (
                  <p className="text-[10px] text-text-muted mt-0.5">
                    ≈ ${(total * fxRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                  </p>
                )}
              </div>
            </div>

            <Link
              href={isMayorista ? "/mayoristas/carrito" : "/carrito"}
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3 text-sm font-bold tracking-wider text-white hover:bg-violet-dark transition-all"
            >
              Finalizar compra <ChevronRight size={15} />
            </Link>

            {isMayorista && (
              <div className="flex items-center gap-1.5 rounded-lg bg-bg-secondary px-3 py-2">
                <Zap size={11} className="text-violet shrink-0" />
                <p className="text-[10px] text-text-muted">
                  Mínimo USDT 130 por pedido mayorista
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
