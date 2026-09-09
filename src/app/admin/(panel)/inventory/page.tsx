"use client";
import { useEffect, useState } from "react";
import { getProductsAction, getConfigAction } from "@/app/admin/actions";
import type { Product } from "@/lib/local-db/types";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProductsAction(), getConfigAction()]).then(([data, cfg]) => {
      setProducts(data);
      setThreshold(parseInt(cfg["stock_alert_threshold"] || "10", 10) || 10);
      setLoading(false);
    });
  }, []);

  const total = products.reduce((s, p) => s + p.stock_actual, 0);
  const reserved = products.reduce((s, p) => s + p.stock_reservado, 0);
  const lowStock = products.filter(p => p.visible && p.stock_actual <= threshold);

  if (loading) return <div className="py-16 text-center text-text-muted text-sm">Cargando inventario...</div>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Inventario</h1>
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-border bg-bg-card p-5 border-t-2 border-t-violet"><p className="text-[10px] font-semibold tracking-wider text-text-muted">STOCK TOTAL</p><p className="mt-1 font-display text-2xl font-bold text-violet-light">{total}</p></div>
        <div className="rounded-xl border border-border bg-bg-card p-5 border-t-2 border-t-yellow-500"><p className="text-[10px] font-semibold tracking-wider text-text-muted">RESERVADO</p><p className="mt-1 font-display text-2xl font-bold text-yellow-400">{reserved}</p></div>
        <div className="rounded-xl border border-border bg-bg-card p-5 border-t-2 border-t-green-500"><p className="text-[10px] font-semibold tracking-wider text-text-muted">DISPONIBLE</p><p className="mt-1 font-display text-2xl font-bold text-green-400">{total - reserved}</p></div>
      </div>
      {lowStock.length > 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <h3 className="text-sm font-bold text-yellow-400 mb-2">⚠️ Stock Bajo (≤{threshold} unidades)</h3>
          <div className="space-y-1">{lowStock.map(p => <p key={p.id} className="text-xs text-text-muted">{p.sku} · {p.name} — <span className="text-yellow-400 font-bold">{p.stock_actual}</span> unidades</p>)}</div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border">
            {["SKU", "PRODUCTO", "MARCA", "ACTUAL", "RESERV.", "DISPONIBLE", "ESTADO"].map(c => <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>)}
          </tr></thead>
          <tbody>
            {products.map(p => {
              const avail = p.stock_actual - p.stock_reservado;
              return (
                <tr key={p.id} className="border-b border-border hover:bg-bg-hover">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{p.sku}</td>
                  <td className="px-4 py-3 text-xs">{p.name}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{p.brand}</td>
                  <td className="px-4 py-3 text-xs font-semibold">{p.stock_actual}</td>
                  <td className="px-4 py-3 text-xs text-yellow-400">{p.stock_reservado}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-green-400">{avail}</td>
                  <td className="px-4 py-3">{p.stock_actual <= threshold ? <span className="text-[10px] font-bold text-yellow-400">⚠️ BAJO</span> : <span className="text-[10px] text-green-400">OK</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
