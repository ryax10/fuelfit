"use client";
import React from "react";
import Link from "next/link";
import { Search, Plus, Eye, EyeOff, ClipboardCopy, Check, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getProductsAction, toggleProductVisibilityAction, deleteProductAction, bulkSetVisibilityAction } from "@/app/admin/actions";
import type { Product } from "@/lib/local-db/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [brandF, setBrandF] = useState("all");
  const [modelF, setModelF] = useState("all");
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; costPrice: number; stockActual: number } | null>(null);

  const load = () => {
    getProductsAction().then(data => { setProducts(data); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const brands = ["all", ...Array.from(new Set(products.map(p => p.brand)))];
  const models = ["all", ...Array.from(new Set(products.filter(p => brandF === "all" || p.brand === brandF).map(p => p.model).filter(Boolean)))];

  const filtered = products
    .filter(p => {
      if (brandF !== "all" && p.brand !== brandF) return false;
      if (modelF !== "all" && p.model !== modelF) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const aStock = a.stock_actual - a.stock_reservado;
      const bStock = b.stock_actual - b.stock_reservado;
      if (aStock > 0 && bStock <= 0) return -1;
      if (aStock <= 0 && bStock > 0) return 1;
      return 0;
    });

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(p => next.delete(p.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(p => next.add(p.id)); return next; });
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleCopyStock = () => {
    const withStock = products
      .filter(p => p.stock_actual > 0)
      .sort((a, b) => {
        if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
        if (a.model !== b.model) return (a.model || "").localeCompare(b.model || "");
        return (a.flavor || "").localeCompare(b.flavor || "");
      });

    const groups: { key: string; label: string; items: typeof withStock }[] = [];
    for (const p of withStock) {
      const key = `${p.brand}|${p.model || ""}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.items.push(p);
      } else {
        groups.push({ key, label: [p.brand, p.model].filter(Boolean).join(" ").toUpperCase(), items: [p] });
      }
    }

    const text = groups
      .map(g => {
        const header = `*${g.label}*`;
        const rows = g.items.map(p => `${stockLabel(p)} ${p.flavor || p.name}`);
        return [header, ...rows].join("\n");
      })
      .join("\n\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleToggle = async (id: string) => {
    await toggleProductVisibilityAction(id);
    load();
  };

  const handleDeleteConfirm = async (mode: "plain" | "loss", units?: number) => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteProductAction(deleteTarget.id, mode, units);
    setDeleteTarget(null);
    setDeleting(false);
    load();
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`¿Eliminar ${selected.size} producto${selected.size > 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    await Promise.all([...selected].map(id => deleteProductAction(id)));
    setSelected(new Set());
    setDeleting(false);
    load();
  };

  const handleBulkVisibility = async (visible: boolean) => {
    setBulkLoading(true);
    await bulkSetVisibilityAction([...selected], visible);
    setSelected(new Set());
    setBulkLoading(false);
    load();
  };

  const stockLabel = (p: Product) => {
    const upack = (p.units_per_pack ?? 1) || 1;
    if (upack > 1) {
      const frascos = Math.floor(p.stock_actual / upack);
      const sueltas = p.stock_actual % upack;
      return sueltas > 0 ? `${frascos} (+${sueltas})` : `${frascos}`;
    }
    return `${p.stock_actual}`;
  };
  const isLowStock = (p: Product) => {
    const upack = (p.units_per_pack ?? 1) || 1;
    return Math.floor(p.stock_actual / upack) <= 2;
  };
  const totalCostOf = (p: Product) => p.cost_price * Math.floor(p.stock_actual / ((p.units_per_pack ?? 1) || 1));
  const totalSaleOf = (p: Product) => p.price_may_x15 * Math.floor(p.stock_actual / ((p.units_per_pack ?? 1) || 1));

  if (loading) return <div className="py-16 text-center text-text-muted text-sm">Cargando productos...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Productos</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyStock} className="flex items-center gap-2 rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm font-semibold hover:bg-bg-hover transition-all">
            {copied ? <><Check size={16} className="text-green-400" /> Copiado</> : <><ClipboardCopy size={16} /> Copiar stock</>}
          </button>
          <Link href="/admin/products/new" className="flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-dark transition-all"><Plus size={16} /> Nuevo Producto</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={brandF} onChange={e => { setBrandF(e.target.value); setModelF("all"); }} className="rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm">
          {brands.map(b => <option key={b} value={b}>{b === "all" ? "Todas las marcas" : b}</option>)}
        </select>
        <select value={modelF} onChange={e => setModelF(e.target.value)} className="rounded-xl border border-border bg-bg-card px-4 py-2.5 text-sm">
          {models.map(m => <option key={m} value={m}>{m === "all" ? "Todos los modelos" : m}</option>)}
        </select>
        <div className="relative">
          <input type="text" placeholder="Buscar SKU o nombre..." value={search} onChange={e => setSearch(e.target.value)} className="rounded-xl border border-border bg-bg-card pl-4 pr-10 py-2.5 text-sm w-52" />
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>
        <span className="ml-auto text-xs text-text-muted">{filtered.length} productos</span>
      </div>

      {/* Barra de acciones cuando hay seleccionados */}
      {someSelected && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-card px-4 py-2.5">
          <span className="text-sm font-semibold text-text-primary">{selected.size} seleccionado{selected.size > 1 ? "s" : ""}</span>
          <button
            onClick={() => handleBulkVisibility(true)}
            disabled={bulkLoading || deleting}
            className="flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-bold text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-all"
          >
            <Eye size={12} /> Hacer visibles
          </button>
          <button
            onClick={() => handleBulkVisibility(false)}
            disabled={bulkLoading || deleting}
            className="flex items-center gap-1.5 rounded-lg bg-text-muted/10 px-3 py-1.5 text-xs font-bold text-text-muted hover:bg-text-muted/20 disabled:opacity-50 transition-all"
          >
            <EyeOff size={12} /> Ocultar
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={deleting || bulkLoading}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-all"
          >
            <Trash2 size={12} /> {deleting ? "Eliminando..." : "Eliminar"}
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-text-muted hover:text-text-secondary transition-colors">
            Cancelar
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border">
            <th className="px-3 py-3">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                className="accent-violet cursor-pointer"
              />
            </th>
            {["IMG", "SKU", "MARCA", "MODELO", "SABOR", "STOCK", "COSTO", "COSTO TOTAL", "X15", "X50", "X100", "MINORISTA ARS", "VENTA TOTAL", "TIENDA", "EDITAR", "ELIMINAR"].map(c => (
              <th key={c} className="px-3 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={17} className="px-4 py-16 text-center text-text-muted">No hay productos. <Link href="/admin/products/new" className="text-violet-light hover:text-violet">Crear uno →</Link></td></tr>
            ) : filtered.map((p, i) => {
              const prevStock = i > 0 ? (filtered[i-1].stock_actual - filtered[i-1].stock_reservado) : 1;
              const curStock = p.stock_actual - p.stock_reservado;
              const showDivider = i > 0 && prevStock > 0 && curStock <= 0;
              const isSelected = selected.has(p.id);
              return <React.Fragment key={p.id}>
                {showDivider && (
                  <tr><td colSpan={17} className="px-3 py-1 text-[10px] font-semibold tracking-wider text-text-muted bg-bg-secondary">SIN STOCK</td></tr>
                )}
                <tr className={`border-b border-border transition-colors ${isSelected ? "bg-violet/5" : "hover:bg-bg-hover"}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOne(p.id)} className="accent-violet cursor-pointer" />
                  </td>
                  <td className="px-3 py-2.5">{p.image ? <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-bg-secondary" />}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-text-muted">{p.sku}</td>
                  <td className="px-3 py-2.5 text-xs">{p.brand}</td>
                  <td className="px-3 py-2.5 text-xs">{p.model}</td>
                  <td className="px-3 py-2.5 text-xs text-text-muted">{p.flavor || "—"}</td>
                  <td className="px-3 py-2.5 text-xs"><span className={isLowStock(p) ? "text-warning font-bold" : ""}>{stockLabel(p)}</span>{p.stock_reservado > 0 && <span className="text-text-muted ml-1">({p.stock_reservado} res)</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{p.cost_price > 0 ? <span className="text-orange-400">U$D {p.cost_price}</span> : <span className="text-text-muted/40">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{p.cost_price > 0 ? <span className="text-orange-300">U$D {totalCostOf(p).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span> : <span className="text-text-muted/40">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-green-400">U$D {p.price_may_x15}</td>
                  <td className="px-3 py-2.5 text-xs text-green-400">U$D {p.price_may_x50}</td>
                  <td className="px-3 py-2.5 text-xs text-green-400">U$D {p.price_may_x100}</td>
                  <td className="px-3 py-2.5 text-xs">${p.price_min_ars.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-cyan-400">U$D {totalSaleOf(p).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => handleToggle(p.id)} className={`text-xs ${p.visible ? "text-green-400" : "text-red-400"}`}>
                      {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/products/${p.id}`} className="text-xs text-violet-light hover:text-violet">Editar</Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setDeleteTarget({ id: p.id, name: p.name, costPrice: p.cost_price ?? 0, stockActual: p.stock_actual })} className="text-red-400 hover:text-red-300 transition-colors"><Trash2 size={13} /></button>
                  </td>
                </tr>
              </React.Fragment>;
            })}
          </tbody>
          {filtered.length > 0 && (() => {
            const totalVenta = filtered.reduce((acc, p) => acc + totalSaleOf(p), 0);
            const totalCosto = filtered.reduce((acc, p) => acc + totalCostOf(p), 0);
            const totalStock = filtered.reduce((acc, p) => acc + Math.floor(p.stock_actual / ((p.units_per_pack ?? 1) || 1)), 0);
            return (
              <tfoot>
                <tr className="border-t-2 border-border bg-bg-secondary">
                  <td colSpan={6} className="px-3 py-3 text-[10px] font-semibold tracking-wider text-text-muted">TOTALES ({filtered.length} productos)</td>
                  <td className="px-3 py-3 text-xs font-bold text-text-primary">{totalStock.toLocaleString()}</td>
                  <td className="px-3 py-3 text-xs text-text-muted">—</td>
                  <td className="px-3 py-3 text-xs font-bold text-orange-300">U$D {totalCosto.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                  <td colSpan={4} />
                  <td className="px-3 py-3 text-xs font-bold text-cyan-400">U$D {totalVenta.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          acting={deleting}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function DeleteModal({ product, acting, onConfirm, onClose }: {
  product: { name: string; costPrice: number; stockActual: number };
  acting: boolean;
  onConfirm: (mode: "plain" | "loss", units?: number) => void;
  onClose: () => void;
}) {
  const [units, setUnits] = useState(product.stockActual);
  const hasStock = product.stockActual > 0 && product.costPrice > 0;
  const lossAmount = product.costPrice * units;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-2xl border border-border bg-bg-card p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="font-display text-lg font-bold mb-1">Eliminar producto</h3>
        <p className="text-sm text-text-muted mb-4"><span className="font-semibold text-text-primary">{product.name}</span></p>

        {hasStock && (
          <div className="mb-4 space-y-3">
            <div className="rounded-xl bg-bg-secondary p-3">
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">Unidades a dar de baja</label>
              <input
                type="number" min={1} max={product.stockActual} value={units}
                onChange={e => setUnits(Math.min(product.stockActual, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm focus:border-violet focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">{product.stockActual} en stock · pérdida: <span className="text-red-400 font-semibold">U$D {lossAmount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {hasStock && (
            <button
              onClick={() => onConfirm("loss", units)}
              disabled={acting}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 transition-all"
            >
              📉 {acting ? "Procesando..." : `A pérdida — registrar U$D ${lossAmount.toLocaleString("es-AR", { maximumFractionDigits: 2 })} en caja`}
            </button>
          )}
          <button
            onClick={() => onConfirm("plain")}
            disabled={acting}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            🗑 {acting ? "Eliminando..." : "Eliminar sin impacto contable"}
          </button>
          <button onClick={onClose} disabled={acting} className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
