"use client";
import { useState, useEffect, useRef } from "react";
import { CheckCircle, AlertCircle, Upload, Tag, Loader2 } from "lucide-react";
import { getProductsAction, getBrandLogosMapAction, uploadBrandLogoAction } from "@/app/admin/actions";

// Marcas con logo local estático (hardcoded en BrandLogo.tsx)
const STATIC_LOGOS = new Set([
  "ELF BAR","ELFBAR","IGNITE","QIT","BLOW","ONLY BLOW",
  "BURN HEMP","TORCH","HEAVY HITTERS",
]);

export default function MarcasPage() {
  const [brands, setBrands] = useState<string[]>([]);
  const [dynamicLogos, setDynamicLogos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    Promise.all([getProductsAction(), getBrandLogosMapAction()]).then(([products, logos]) => {
      const unique = [...new Set(products.map(p => p.brand.toUpperCase()))].sort();
      setBrands(unique);
      setDynamicLogos(logos);
    });
  }, []);

  const hasLogo = (brand: string) =>
    STATIC_LOGOS.has(brand) || !!dynamicLogos[brand];

  const logoUrl = (brand: string): string | null =>
    dynamicLogos[brand] || null;

  const handleUpload = async (brand: string, file: File) => {
    setUploading(brand);
    // Preview local
    const preview = URL.createObjectURL(file);
    setPreviewMap(p => ({ ...p, [brand]: preview }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = await uploadBrandLogoAction(brand, fd);
      setDynamicLogos(prev => ({ ...prev, [brand]: url }));
      setPreviewMap(p => { const n = { ...p }; delete n[brand]; return n; });
    } catch (e) {
      alert(`Error al subir logo: ${e instanceof Error ? e.message : "Error desconocido"}`);
      setPreviewMap(p => { const n = { ...p }; delete n[brand]; return n; });
    } finally {
      setUploading(null);
    }
  };

  const withLogo = brands.filter(b => hasLogo(b));
  const withoutLogo = brands.filter(b => !hasLogo(b));

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Tag size={22} className="text-violet-light" />
        <div>
          <h1 className="font-display text-2xl font-bold">Marcas</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {withLogo.length} con logo · <span className="text-orange-400 font-semibold">{withoutLogo.length} sin logo</span>
          </p>
        </div>
      </div>

      {/* Sin logo — atención */}
      {withoutLogo.length > 0 && (
        <div className="mb-6 rounded-xl border border-orange-500/20 bg-bg-card p-5">
          <p className="text-[10px] font-semibold tracking-wider text-orange-400 mb-4 flex items-center gap-1.5">
            <AlertCircle size={12} /> NECESITAN LOGO ({withoutLogo.length})
          </p>
          <div className="space-y-2">
            {withoutLogo.map(brand => (
              <BrandRow
                key={brand}
                brand={brand}
                hasLogo={false}
                logoUrl={previewMap[brand] || null}
                uploading={uploading === brand}
                fileRef={el => { fileRefs.current[brand] = el; }}
                onUpload={handleUpload}
              />
            ))}
          </div>
        </div>
      )}

      {/* Con logo — OK */}
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <p className="text-[10px] font-semibold tracking-wider text-green-400 mb-4 flex items-center gap-1.5">
          <CheckCircle size={12} /> CON LOGO ({withLogo.length})
        </p>
        <div className="space-y-2">
          {withLogo.map(brand => (
            <BrandRow
              key={brand}
              brand={brand}
              hasLogo
              logoUrl={previewMap[brand] || logoUrl(brand)}
              uploading={uploading === brand}
              fileRef={el => { fileRefs.current[brand] = el; }}
              onUpload={handleUpload}
              isStatic={STATIC_LOGOS.has(brand)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandRow({
  brand, hasLogo, logoUrl, uploading, onUpload, isStatic,
}: {
  brand: string;
  hasLogo: boolean;
  logoUrl: string | null;
  uploading: boolean;
  fileRef: (el: HTMLInputElement | null) => void;
  onUpload: (brand: string, file: File) => void;
  isStatic?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
      {/* Logo preview */}
      <div className="h-9 w-9 shrink-0 rounded-lg bg-bg-elevated flex items-center justify-center overflow-hidden">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brand} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-[10px] font-bold text-text-muted">{brand.slice(0, 2)}</span>
        )}
      </div>

      {/* Nombre + badge */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{brand}</p>
        {isStatic && <p className="text-[10px] text-text-muted">Logo estático (archivo local)</p>}
      </div>

      {/* Estado */}
      {hasLogo ? (
        <CheckCircle size={15} className="text-green-400 shrink-0" />
      ) : (
        <AlertCircle size={15} className="text-orange-400 shrink-0" />
      )}

      {/* Botón upload */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onUpload(brand, file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
          hasLogo
            ? "border-border text-text-muted hover:bg-bg-hover"
            : "border-orange-500/30 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10"
        }`}
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {hasLogo ? "Cambiar" : "Subir"}
      </button>
    </div>
  );
}
