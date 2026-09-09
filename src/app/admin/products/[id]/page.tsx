"use client";
import Link from "next/link";
import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, ImageIcon, Plus, Trash2 } from "lucide-react";
import { getProductsAction, updateProductAction, uploadProductImageAction, importImageFromUrlAction } from "@/app/admin/actions";
import { processProductImage } from "@/lib/image-utils";
import type { Product } from "@/lib/local-db/types";

type UnitTier = { qty: number; price: number };

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [form, setForm] = useState({
    sku: "", brand: "", model: "", flavor: "", category: "suplementos",
    price_min_ars: 0, price_may_x15: 0, price_may_x50: 0, price_may_x100: 0,
    cost_price: 0, units_per_pack: 1, stock_actual: 0, image: "", visible: true,
  });
  const [unitTiers, setUnitTiers] = useState<UnitTier[]>([
    { qty: 1, price: 0 }, { qty: 2, price: 0 }, { qty: 5, price: 0 },
  ]);

  useEffect(() => {
    getProductsAction().then(products => {
      const p = products.find(pr => pr.id === id);
      if (p) {
        setProduct(p);
        setForm({
          sku: p.sku, brand: p.brand, model: p.model, flavor: p.flavor,
          category: p.category, price_min_ars: p.price_min_ars,
          price_may_x15: p.price_may_x15, price_may_x50: p.price_may_x50,
          price_may_x100: p.price_may_x100, cost_price: p.cost_price ?? 0,
          units_per_pack: (p as any).units_per_pack ?? 1,
          stock_actual: p.stock_actual, image: p.image, visible: p.visible,
        });
        if (p.unit_sale_options?.options?.length) {
          setUnitTiers(p.unit_sale_options.options);
        }
      }
    });
  }, [id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const processed = await processProductImage(file);
      const fd = new FormData();
      fd.append("file", new File([processed], "product.webp", { type: "image/webp" }));
      const url = await uploadProductImageAction(fd);
      setForm(prev => ({ ...prev, image: url }));
    } catch (err) {
      alert(`Error al subir la imagen: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const name = [form.brand, form.model, form.flavor].filter(Boolean).join(" ");
      const validTiers = unitTiers.filter(t => t.qty > 0 && t.price > 0);
      const invalidTiers = unitTiers.filter(t => t.qty <= 0 || t.price <= 0);
      if (invalidTiers.length > 0 && form.units_per_pack > 1) {
        const ok = confirm(`${invalidTiers.length} opción(es) de cantidad tienen precio $0 y serán ignoradas. ¿Continuar?`);
        if (!ok) { setSaving(false); return; }
      }
      const unit_sale_options = form.units_per_pack > 1 ? { options: validTiers } : null;
      await updateProductAction(id, { ...form, name, unit_sale_options } as Partial<Product>);
      router.push("/admin/products");
    } catch (err) {
      alert(`Error al guardar: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setSaving(false);
    }
  };

  if (!product) return <div className="py-16 text-center text-text-muted text-sm">Cargando...</div>;

  const u = (k: string, v: string | number | boolean) => setForm(prev => ({ ...prev, [k]: v }));
  const cls = "w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none";

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Editar: {product.name}</h1>
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border bg-bg-card p-5 space-y-4">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">IDENTIFICACIÓN</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">SKU</label>
              <input value={form.sku} onChange={e => u("sku", e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">CATEGORÍA</label>
              <select value={form.category} onChange={e => u("category", e.target.value)} className={cls}>
                <option value="suplementos">Suplementos</option><option value="ropa">Ropa</option><option value="accesorios">Accesorios</option>
              </select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">MARCA</label><input value={form.brand} onChange={e => u("brand", e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">MODELO</label><input value={form.model} onChange={e => u("model", e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">SABOR</label><input value={form.flavor} onChange={e => u("flavor", e.target.value)} className={cls} /></div>
          </div>

          {/* IMAGEN */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary">IMAGEN DEL PRODUCTO</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-6 text-text-muted transition-all hover:border-violet hover:bg-violet/5 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet border-t-transparent" />
                  <span className="text-sm">Subiendo imagen...</span>
                </>
              ) : form.image ? (
                <>
                  <ImageIcon size={20} className="text-green-400" />
                  <span className="text-sm text-green-400">Imagen cargada. Clic para cambiar</span>
                </>
              ) : (
                <>
                  <Upload size={20} />
                  <span className="text-sm font-medium">Clic para subir imagen</span>
                  <span className="text-xs text-text-muted">JPG, PNG, WEBP — se optimiza automáticamente</span>
                </>
              )}
            </button>
            {form.image && (
              <div className="mt-3 flex items-start gap-3">
                <div className="relative">
                  <img src={form.image} alt="Preview" className="h-24 w-24 rounded-xl border border-border object-contain bg-white" />
                  <button
                    type="button"
                    onClick={() => u("image", "")}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                  >
                    <X size={10} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-green-400">Imagen cargada</p>
              </div>
            )}
            {!form.image && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-2">
                  <input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    className={`${cls} flex-1`}
                    placeholder="O pegá una URL de imagen..."
                    type="url"
                  />
                  <button
                    type="button"
                    disabled={importing || !urlInput}
                    onClick={async () => {
                      setImporting(true);
                      try {
                        const url = await importImageFromUrlAction(urlInput);
                        u("image", url);
                        setUrlInput("");
                      } catch (err) {
                        alert(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
                      } finally {
                        setImporting(false);
                      }
                    }}
                    className="rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-white hover:bg-violet-dark disabled:opacity-50 transition-all whitespace-nowrap"
                  >
                    {importing ? "Importando..." : "Subir"}
                  </button>
                </div>
                <p className="text-xs text-text-muted">La imagen se subirá a nuestro servidor para que cargue correctamente.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-5 space-y-4">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted">PRECIOS Y STOCK</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">X15 (USD)</label><input type="number" step="0.5" value={form.price_may_x15} onChange={e => u("price_may_x15", +e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">X50 (USD)</label><input type="number" step="0.5" value={form.price_may_x50} onChange={e => u("price_may_x50", +e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">X100 (USD)</label><input type="number" step="0.5" value={form.price_may_x100} onChange={e => u("price_may_x100", +e.target.value)} className={cls} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">PRECIO MINORISTA (ARS)</label><input type="number" value={form.price_min_ars} onChange={e => u("price_min_ars", +e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">PRECIO DE COSTO (USD, por envase)</label><input type="number" step="0.01" value={form.cost_price} onChange={e => u("cost_price", +e.target.value)} className={cls} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">STOCK ACTUAL (unidades)</label><input type="number" value={form.stock_actual} onChange={e => u("stock_actual", +e.target.value)} className={cls} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">UNIDADES POR ENVASE</label>
              <input type="number" min="1" step="1" value={form.units_per_pack} onChange={e => u("units_per_pack", Math.max(1, parseInt(e.target.value) || 1))} className={cls} />
              <p className="mt-1 text-xs text-text-muted">
                {form.units_per_pack > 1
                  ? `Costo por unidad vendida: U$D ${form.cost_price > 0 ? (form.cost_price / form.units_per_pack).toFixed(4) : "0"}`
                  : "Se vende tal como viene (1:1)"}
              </p>
            </div>
          </div>
        </div>

        {/* VENTA POR UNIDADES — solo si units_per_pack > 1 */}
        {form.units_per_pack > 1 && (
          <div className="rounded-xl border border-border bg-bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-text-muted">VENTA POR UNIDADES</p>
                <p className="text-xs text-text-muted mt-1">Costo por unidad: U$D {form.cost_price > 0 ? (form.cost_price / form.units_per_pack).toFixed(4) : "0"} · Precio = total por esa cantidad</p>
              </div>
              <button type="button" onClick={() => setUnitTiers(t => [...t, { qty: 1, price: 0 }])}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover transition-all">
                <Plus size={12} /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {unitTiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-text-muted">Cantidad</label>
                    <input type="number" min="1" step="1" value={tier.qty}
                      onChange={e => setUnitTiers(t => t.map((x, j) => j === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))}
                      className={cls} />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-text-muted">Precio total ($ARS)</label>
                    <input type="number" min="0" step="any" value={tier.price}
                      onChange={e => setUnitTiers(t => t.map((x, j) => j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x))}
                      className={cls} />
                  </div>
                  <div className="shrink-0 pt-5">
                    <p className="text-xs text-text-muted">${tier.qty > 0 && tier.price > 0 ? (tier.price / tier.qty).toFixed(0) : "0"}/u</p>
                  </div>
                  <button type="button" onClick={() => setUnitTiers(t => t.filter((_, j) => j !== i))}
                    disabled={unitTiers.length <= 1}
                    className="shrink-0 pt-5 text-text-muted hover:text-red-400 disabled:opacity-30 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={form.visible} onChange={e => u("visible", e.target.checked)} className="accent-violet" />
            <span className="text-sm">{form.visible ? "Visible en tienda" : "Oculto"}</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving || uploading} className="rounded-xl bg-violet px-6 py-3 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50 transition-all">
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
          <Link href="/admin/products" className="rounded-xl border border-border px-6 py-3 text-sm text-text-muted hover:bg-bg-hover transition-all">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
