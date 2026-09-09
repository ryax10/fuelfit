"use client";

import { X } from "lucide-react";
import Image from "next/image";
import type { Product } from "@/lib/local-db/types";

interface Props {
  product: Product;
  onClose: () => void;
  fxRate?: number | null;
  showARS?: boolean;
}

function stockOf(p: Product) { return Math.max(0, p.stock_actual - p.stock_reservado); }

export function ImageModal({ product: p, onClose, fxRate, showARS }: Props) {
  const fmt = (usdt: number) => showARS && fxRate
    ? `$${Math.round(usdt * fxRate).toLocaleString("es-AR")} ARS`
    : `USDT ${usdt}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-bg-card overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-bg-secondary text-text-muted hover:text-text-primary transition-colors">
          <X size={16} />
        </button>

        {p.image && (
          <div className="relative aspect-square w-full bg-bg-secondary">
            <Image src={p.image} alt={`${p.brand} ${p.model}${p.flavor ? ` ${p.flavor}` : ""} — FuelFit`} fill unoptimized className="object-cover" sizes="400px" />
          </div>
        )}

        <div className="p-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-violet/60 uppercase">{p.brand}</p>
            <h3 className="font-display text-base font-bold text-text-primary">{p.model}</h3>
            {p.flavor && <p className="text-sm text-text-secondary mt-0.5">{p.flavor}</p>}
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${stockOf(p) > 0 ? "text-green-400" : "text-red-400"}`}>
              {stockOf(p) > 0 ? `${stockOf(p)} disponibles` : "Sin stock"}
            </span>
            {p.is_new && <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400 uppercase">Nuevo</span>}
            {stockOf(p) > 0 && stockOf(p) < 5 && <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400 uppercase">Stock bajo</span>}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {p.price_may_x15 > 0 && (
              <div className="rounded-lg bg-bg-secondary p-2">
                <p className="text-[9px] text-text-muted mb-0.5">×15</p>
                <p className="text-xs font-bold text-green-400">{fmt(p.price_may_x15)}</p>
              </div>
            )}
            {p.price_may_x50 > 0 && (
              <div className="rounded-lg bg-bg-secondary p-2">
                <p className="text-[9px] text-text-muted mb-0.5">×50</p>
                <p className="text-xs font-bold text-green-400">{fmt(p.price_may_x50)}</p>
              </div>
            )}
            {p.price_may_x100 > 0 && (
              <div className="rounded-lg bg-bg-secondary p-2">
                <p className="text-[9px] text-text-muted mb-0.5">×100</p>
                <p className="text-xs font-bold text-green-400">{fmt(p.price_may_x100)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
