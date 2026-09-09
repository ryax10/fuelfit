"use client";
import { useState, useEffect } from "react";
import { Sparkles, X, Plus, Wind } from "lucide-react";
import { getProductsAction, updateProductAction } from "@/app/admin/actions";
import type { Product } from "@/lib/local-db/types";

type ModelGroup = { brand: string; model: string; image: string; key: string };

function groupByModel(products: Product[]): ModelGroup[] {
  const map = new Map<string, ModelGroup>();
  for (const p of products) {
    const key = `${p.brand}|${p.model}`;
    if (!map.has(key)) map.set(key, { brand: p.brand, model: p.model, image: p.image, key });
  }
  return Array.from(map.values());
}

export default function NovedadesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { getProductsAction().then(setProducts); }, []);

  const newKeys = new Set(products.filter(p => p.is_new).map(p => `${p.brand}|${p.model}`));
  const allModels = groupByModel(products);
  const newModels = allModels.filter(m => newKeys.has(m.key));
  const addableModels = allModels.filter(m => !newKeys.has(m.key)).filter(m =>
    !search ||
    m.brand.toLowerCase().includes(search.toLowerCase()) ||
    m.model.toLowerCase().includes(search.toLowerCase())
  );

  const toggleModel = async (brand: string, model: string, val: boolean) => {
    const key = `${brand}|${model}`;
    setSaving(key);
    const targets = products.filter(p => p.brand === brand && p.model === model);
    await Promise.all(targets.map(p => updateProductAction(p.id, { is_new: val } as Partial<Product>)));
    setProducts(prev => prev.map(p => p.brand === brand && p.model === model ? { ...p, is_new: val } : p));
    setSaving(null);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Sparkles size={22} className="text-violet-light" /> Modelos Nuevos
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Los modelos marcados como "Nuevo" muestran el badge verde en el catálogo mayorista y en el inicio de la tienda.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-bg-card p-5">
        <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-4">MARCADOS COMO NUEVO ({newModels.length})</p>
        {newModels.length === 0 && (
          <p className="py-6 text-center text-sm text-text-muted">No hay modelos marcados. Agregalos desde la lista de abajo.</p>
        )}
        <div className="grid gap-2">
          {newModels.map(m => (
            <div key={m.key} className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
              {m.image
                ? <img src={m.image} alt={m.model} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-elevated"><Wind size={16} className="text-violet/40" /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.model}</p>
                <p className="text-xs text-text-muted">{m.brand}</p>
              </div>
              <button onClick={() => toggleModel(m.brand, m.model, false)} disabled={saving === m.key}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all disabled:opacity-40">
                {saving === m.key ? <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> : <X size={14} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-card p-5">
        <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-4">MARCAR MODELO COMO NUEVO</p>
        <input type="text" placeholder="Buscar por marca o modelo..." value={search} onChange={e => setSearch(e.target.value)}
          className="mb-4 w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none" />
        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {addableModels.map(m => (
            <div key={m.key} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-bg-hover transition-all">
              {m.image
                ? <img src={m.image} alt={m.model} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-elevated"><Wind size={16} className="text-violet/40" /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.model}</p>
                <p className="text-xs text-text-muted">{m.brand}</p>
              </div>
              <button onClick={() => toggleModel(m.brand, m.model, true)} disabled={saving === m.key}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20 transition-all disabled:opacity-30">
                {saving === m.key ? <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> : <Plus size={14} />}
              </button>
            </div>
          ))}
          {addableModels.length === 0 && <p className="py-6 text-center text-sm text-text-muted">No se encontraron modelos</p>}
        </div>
      </div>
    </div>
  );
}
