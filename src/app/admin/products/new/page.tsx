"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, ImageIcon } from "lucide-react";
import { createProductAction, uploadProductImageAction, importImageFromUrlAction } from "@/app/admin/actions";
import { processProductImage } from "@/lib/image-utils";

type Category = "suplementos" | "ropa" | "accesorios";
type FormState = {
  sku: string; brand: string; model: string; flavor: string; category: Category;
  x15: number; x50: number; x100: number; minArs: number; stock: number; visible: boolean; image: string;
  costPrice: number; unitsPerPack: number;
};

export default function NewProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imageMode, setImageMode] = useState<"url" | "file">("file");
  const [urlInput, setUrlInput] = useState("");
  const [form, setForm] = useState<FormState>({
    sku: "", brand: "", model: "", flavor: "", category: "suplementos",
    x15: 0, x50: 0, x100: 0, minArs: 0, stock: 0, visible: true, image: "",
    costPrice: 0, unitsPerPack: 1,
  });

  const u = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const processed = await processProductImage(file);
      const fd = new FormData();
      fd.append("file", new File([processed], "product.webp", { type: "image/webp" }));
      const url = await uploadProductImageAction(fd);
      u("image", url);
    } catch (err) {
      alert(`Error al subir la imagen: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.brand) return;
    setSaving(true);
    try {
      const name = [form.brand, form.model, form.flavor].filter(Boolean).join(" ");
      const slug = [form.brand, form.model, form.flavor]
        .filter(Boolean).join("-").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await createProductAction({
        sku: form.sku, brand: form.brand, model: form.model, flavor: form.flavor,
        slug, name, category: form.category,
        price_min_ars: form.minArs, price_may_x15: form.x15,
        price_may_x50: form.x50, price_may_x100: form.x100,
        cost_price: form.costPrice, units_per_pack: form.unitsPerPack,
        stock_actual: form.stock, image: form.image, visible: form.visible,
      } as any);
      router.push("/admin/products");
    } catch (err) {
      alert(`Error al crear producto: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/products" className="text-text-muted hover:text-text-secondary">
          ← Productos
        </Link>
        <span className="text-text-muted">/</span>
        <h1 className="font-display text-2xl font-bold">Nuevo Producto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* IDENTIFICACIÓN */}
        <Section title="IDENTIFICACIÓN">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU *" placeholder="EJ: ELF-BC5000-MAN" value={form.sku} onChange={v => u("sku", v)} />
            <Field label="CATEGORÍA" select value={form.category} onChange={v => u("category", v as Category)}
              options={[{ v: "suplementos", l: "Suplementos" }, { v: "ropa", l: "Ropa" }, { v: "accesorios", l: "Accesorios" }]} />
          </div>
        </Section>

        {/* MARCA / MODELO / SABOR */}
        <Section title="MARCA / MODELO / SABOR">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="MARCA *" placeholder="Elf Bar, Lost Mary..." value={form.brand} onChange={v => u("brand", v)} />
            <Field label="MODELO" placeholder="BC5000, BM600..." value={form.model} onChange={v => u("model", v)} />
            <Field label="SABOR / VARIANTE" placeholder="Mango Ice, Blue Razz..." value={form.flavor} onChange={v => u("flavor", v)} />
          </div>
          {(form.brand || form.model || form.flavor) && (
            <p className="mt-2 text-[11px] text-text-muted">
              Nombre generado: <span className="text-text-secondary font-medium">{[form.brand, form.model, form.flavor].filter(Boolean).join(" ") || "—"}</span>
            </p>
          )}
        </Section>

        {/* IMAGEN */}
        <Section title="IMAGEN DEL PRODUCTO">
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setImageMode("file")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${imageMode === "file" ? "bg-violet text-white" : "border border-border text-text-muted hover:bg-bg-hover"}`}>
              📁 Desde dispositivo
            </button>
            <button type="button" onClick={() => setImageMode("url")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${imageMode === "url" ? "bg-violet text-white" : "border border-border text-text-muted hover:bg-bg-hover"}`}>
              🔗 Por URL
            </button>
          </div>

          {imageMode === "file" ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-text-muted transition-all hover:border-violet hover:bg-violet/5 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" />
                    <span className="text-sm">Subiendo imagen...</span>
                  </>
                ) : form.image ? (
                  <>
                    <ImageIcon size={24} className="text-green-400" />
                    <span className="text-sm text-green-400">Imagen cargada. Clic para cambiar</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} />
                    <span className="text-sm font-medium">Clic para seleccionar imagen</span>
                    <span className="text-xs text-text-muted">JPG, PNG, WEBP — se optimiza automáticamente</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://ejemplo.com/foto.jpg"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none"
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
                  {importing ? "Importando..." : "Subir al servidor"}
                </button>
              </div>
              <p className="text-xs text-text-muted">La imagen se descargará y subirá a nuestro servidor para que cargue correctamente en la tienda.</p>
            </div>
          )}

          {form.image && (
            <div className="mt-3 flex items-start gap-3">
              <div className="relative">
                <img src={form.image} alt="Preview" className="h-24 w-24 rounded-xl border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => u("image", "")}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                >
                  <X size={10} />
                </button>
              </div>
              <p className="mt-1 text-xs text-green-400">Vista previa de la imagen</p>
            </div>
          )}
        </Section>

        {/* PRECIOS */}
        <Section title="PRECIOS MAYORISTA (USD)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="X15 UNIDADES" type="number" value={form.x15} onChange={v => u("x15", Number(v) || 0)} />
            <Field label="X50 UNIDADES" type="number" value={form.x50} onChange={v => u("x50", Number(v) || 0)} />
            <Field label="X100 UNIDADES" type="number" value={form.x100} onChange={v => u("x100", Number(v) || 0)} />
          </div>
        </Section>

        <Section title="COSTO + STOCK">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="PRECIO MINORISTA (ARS)" type="number" value={form.minArs} onChange={v => u("minArs", Number(v) || 0)} />
            <Field label="COSTO (USD)" type="number" value={form.costPrice} onChange={v => u("costPrice", Number(v) || 0)} />
            <Field label="STOCK INICIAL (unidades)" type="number" value={form.stock} onChange={v => u("stock", Number(v) || 0)} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Field label="UNIDADES POR ENVASE" type="number" value={form.unitsPerPack} onChange={v => u("unitsPerPack", Math.max(1, parseInt(v) || 1))} />
              <p className="mt-1 text-xs text-text-muted">
                {form.unitsPerPack > 1
                  ? `Costo por unidad: U$D ${form.costPrice > 0 ? (form.costPrice / form.unitsPerPack).toFixed(4) : "0"} (frasco de ${form.unitsPerPack} pcs a U$D ${form.costPrice})`
                  : "Se vende tal como viene (1 unidad = 1 unidad de compra)"}
              </p>
            </div>
          </div>
        </Section>


        {/* VISIBILIDAD */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-card px-5 py-4">
          <label className="flex cursor-pointer items-center gap-3">
            <div className={`relative h-6 w-11 rounded-full transition-colors ${form.visible ? "bg-green-500" : "bg-text-muted/30"}`}
              onClick={() => u("visible", !form.visible)}>
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.visible ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium">{form.visible ? "Visible en tienda" : "Oculto en tienda"}</span>
          </label>
        </div>

        {/* BOTONES */}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving || uploading}
            className="rounded-xl bg-violet px-6 py-3 text-sm font-bold text-white transition-all hover:bg-violet-dark disabled:opacity-50">
            {saving ? "Guardando..." : "💾 Guardar Producto"}
          </button>
          <Link href="/admin/products" className="rounded-xl border border-border px-6 py-3 text-sm text-text-muted transition-all hover:bg-bg-hover">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <p className="mb-4 text-[10px] font-semibold tracking-wider text-text-muted">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type, select, options = [] }: {
  label: string; placeholder?: string; value: string | number; onChange: (v: string) => void;
  type?: string; select?: boolean; options?: { v: string; l: string }[];
}) {
  const cls = "w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none";
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{label}</label>
      {select ? (
        <select value={String(value)} onChange={e => onChange(e.target.value)} className={cls}>
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input type={type || "text"} step={type === "number" ? "any" : undefined} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}
