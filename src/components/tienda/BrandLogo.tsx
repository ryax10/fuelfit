"use client";

import { Cable } from "lucide-react";

// Logos locales en /public/brands/ — fondo transparente, listos para usar
const LOCAL_LOGOS: Record<string, string> = {
  "ELF BAR":      "/brands/elfbar-vip.png",
  "ELFBAR":       "/brands/elfbar-vip.png",
  "IGNITE":       "/brands/ignite-vip.png",
  "QIT":          "/brands/qit-vip.png",
  "BLOW":         "/brands/blow-vip.png",
  "ONLY BLOW":    "/brands/blow-vip.png",
  "BURN HEMP":    "/brands/burn_hemp-vip.png",
  "TORCH":        "/brands/torch-vip.png",
  "HEAVY HITTERS":"/brands/heavy_hitters-vip.png",
};

// Escala visual por marca (se aplica con transform:scale en el acordeón)
const BRAND_SCALE: Record<string, number> = {
  "HEAVY HITTERS": 3.0,
  "TORCH":         1.2,
  "BLOW":          1.2,
  "ONLY BLOW":     1.2,
  "QIT":           1.4,
  "IGNITE":        1.4,
};
const DEFAULT_SCALE = 1.7;

export function getBrandScale(brand: string): number {
  return BRAND_SCALE[brand.toUpperCase()] ?? DEFAULT_SCALE;
}

// Solo muestra logo si hay un archivo local procesado para la marca.
// Cualquier otra marca (FUME, SMOK, PHENOM, BLAYZD, etc.) queda sin mini logo.
export function hasBrandLogo(brand: string, isAccessory: boolean): boolean {
  if (isAccessory) return true;
  return !!LOCAL_LOGOS[brand.toUpperCase()];
}

interface BrandLogoProps {
  brand: string;
  isAccessory?: boolean;
  size?: number;
}

export function BrandLogo({ brand, isAccessory = false, size = 22 }: BrandLogoProps) {
  // Accesorios: ícono flotante sin fondo, en violeta
  if (isAccessory) {
    return <Cable size={size * 0.6} className="shrink-0 text-violet-light" />;
  }

  const localSrc = LOCAL_LOGOS[brand.toUpperCase()];
  if (!localSrc) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={localSrc}
      alt={brand}
      width={size}
      height={size}
      className="shrink-0 object-contain drop-shadow-sm"
      style={{ width: size, height: size }}
    />
  );
}
