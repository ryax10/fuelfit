"use client";
import Link from "next/link";
import { ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useDB, getCart, updateCartQty, removeFromCart, clearCart } from "@/lib/local-db";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/local-db/types";

export default function CarritoPage() {
  const cart = useDB(useCallback(() => getCart(), []));
  const [products, setProducts] = useState<Product[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    createClient()
      .from("products")
      .select("*")
      .eq("visible", true)
      .then(({ data }) => setProducts((data || []) as Product[]));
  }, []);

  const cartItems = mounted ? cart.map(c => {
    const p = products.find(pr => pr.id === c.product_id);
    return p ? { ...c, product: p } : null;
  }).filter(Boolean) as { product_id: string; qty: number; unit_price_override?: number; product: Product }[] : [];

  const getUnitPrice = (item: { product: Product; unit_price_override?: number }) =>
    item.unit_price_override ?? item.product.price_min_ars;

  const total = cartItems.reduce((s, i) => s + getUnitPrice(i) * i.qty, 0);

  // Detectar items cuya cantidad supera el stock disponible
  const stockIssues = cartItems.filter(
    item => !item.product.unit_sale_options?.options?.length &&
      item.qty > item.product.stock_actual - item.product.stock_reservado
  );

  if (!mounted) return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Carrito</h1>
      <div className="mt-8 rounded-3xl border border-border bg-bg-card px-6 py-16 text-center">
        <p className="text-text-muted text-sm">Cargando...</p>
      </div>
    </div>
  );

  if (cartItems.length === 0) return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Carrito</h1>
      <div className="mt-8 flex flex-col items-center rounded-3xl border border-border bg-bg-card px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated"><ShoppingCart size={28} className="text-text-muted" /></div>
        <p className="mt-5 text-text-secondary">Tu carrito está vacío</p>
        <Link href="/productos" className="mt-6 rounded-xl bg-violet px-6 py-2.5 text-sm font-bold tracking-wider text-white hover:bg-violet-dark transition-all">VER CATÁLOGO</Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Carrito ({cartItems.reduce((s,i) => s+i.qty, 0)} items)</h1>
        <button onClick={() => clearCart()} className="text-xs text-text-muted hover:text-red-400 transition-colors">Vaciar carrito</button>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          {cartItems.map(item => (
            <div key={item.product_id} className="rounded-2xl border border-border bg-bg-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative h-14 w-14 shrink-0 rounded-xl bg-bg-secondary overflow-hidden">
                  {item.product.image ? (
                    <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-2xl">📦</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-violet/60">{item.product.brand.toUpperCase()}</p>
                  <h3 className="text-sm font-medium truncate">{item.product.model}</h3>
                  {item.product.flavor && <p className="text-xs text-text-muted truncate">{item.product.flavor}</p>}
                  <p className="text-xs text-text-muted">${getUnitPrice(item).toLocaleString()} c/u</p>
                </div>
                <button onClick={() => removeFromCart(item.product_id)} className="text-text-muted hover:text-red-400 transition-colors shrink-0 p-1"><Trash2 size={16} /></button>
              </div>
              <div className="flex items-center justify-between">
                {item.product.unit_sale_options?.options?.length ? (
                  <p className="text-[10px] text-text-muted">Cant: {item.qty}</p>
                ) : (
                  <div className="flex items-center rounded-lg border border-border">
                    <button onClick={() => updateCartQty(item.product_id, item.qty - 1)} disabled={item.qty <= 1} className="px-2.5 py-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                    <button onClick={() => updateCartQty(item.product_id, Math.min(item.qty + 1, item.product.stock_actual - item.product.stock_reservado))} disabled={item.qty >= item.product.stock_actual - item.product.stock_reservado} className="px-2.5 py-1.5 text-text-muted hover:text-text-primary disabled:opacity-30"><Plus size={14} /></button>
                  </div>
                )}
                <p className="font-display text-base font-bold">${(getUnitPrice(item) * item.qty).toLocaleString()}</p>
              </div>
              {!item.product.unit_sale_options?.options?.length && item.qty > item.product.stock_actual - item.product.stock_reservado && (
                <p className="mt-1 text-[10px] text-yellow-400">⚠️ Solo hay {item.product.stock_actual - item.product.stock_reservado} disponibles</p>
              )}
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 rounded-3xl border border-border bg-bg-card p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold">Resumen</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-text-secondary"><span>Subtotal</span><span>${total.toLocaleString()}</span></div>
            <div className="flex justify-between text-text-secondary"><span>Envío</span><span className="text-text-muted">A coordinar</span></div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span>${total.toLocaleString()}</span></div>
          </div>
          {stockIssues.length > 0 ? (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-red-400 mb-1">Stock insuficiente</p>
              <p className="text-[11px] text-red-400/80">
                {stockIssues.map(i => i.product.name).join(", ")} — ajustá las cantidades para continuar.
              </p>
            </div>
          ) : (
            <Link href="/checkout" className="mt-6 block w-full rounded-xl bg-violet py-3 text-center text-sm font-bold tracking-wider text-white hover:bg-violet-dark transition-all">CONTINUAR COMPRA</Link>
          )}
          <Link href="/productos" className="mt-3 block text-center text-xs text-violet-light hover:text-violet">← Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}
