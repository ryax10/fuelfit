"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingCart, Menu, X, List, Grid3X3 } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useDB, getCartCount, getCartMayCount } from "@/lib/local-db";
import { CartDrawer } from "@/components/tienda/CartDrawer";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/mayoristas/tienda", label: "Mayoristas", activePrefix: "/mayoristas" },
  { href: "/envios", label: "Envíos" },
  { href: "/contacto", label: "Contacto" },
];

const DRAWER_SHOWN_KEY = "ff_drawer_shown";
const LS_CURRENCY = "ff_may_currency";
const LS_VIEW = "ff_may_view";

const TICKER_ITEMS = [
  "🔥 ENVÍO GRATIS en compras +$50.000",
  "⚡ NUEVOS SUPLEMENTOS DISPONIBLES",
  "💳 PAGÁ EN CUOTAS SIN INTERÉS",
  "💪 PRECIO MAYORISTA DESDE 15 UNIDADES",
  "🚀 ENVÍOS EN 24–48HS A TODO EL PAÍS",
];

export function TiendaHeader() {
  const p = usePathname();
  const isMayorista = p.startsWith("/mayoristas/tienda") || p.startsWith("/mayoristas/carrito");
  const showCatalogControls = p.startsWith("/mayoristas/tienda") && !p.startsWith("/mayoristas/carrito");

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currency, setCurrencyState] = useState<"usdt" | "ars">("usdt");
  const [view, setViewState] = useState<"quick" | "images">("quick");

  const count = useDB(useCallback(() => getCartCount(), []));
  const countMay = useDB(useCallback(() => getCartMayCount(), []));

  useEffect(() => {
    setMounted(true);
    setCurrencyState((localStorage.getItem(LS_CURRENCY) as "usdt" | "ars") || "usdt");
    setViewState((localStorage.getItem(LS_VIEW) as "quick" | "images") || "quick");
  }, []);

  useEffect(() => {
    const sync = () => {
      setCurrencyState((localStorage.getItem(LS_CURRENCY) as "usdt" | "ars") || "usdt");
      setViewState((localStorage.getItem(LS_VIEW) as "quick" | "images") || "quick");
    };
    window.addEventListener("ff-prefs-change", sync);
    return () => window.removeEventListener("ff-prefs-change", sync);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!sessionStorage.getItem(DRAWER_SHOWN_KEY)) {
        sessionStorage.setItem(DRAWER_SHOWN_KEY, "1");
        setDrawerOpen(true);
      }
    };
    window.addEventListener("fuelfit-cart-add", handler);
    return () => window.removeEventListener("fuelfit-cart-add", handler);
  }, []);

  const setCurrency = (val: "usdt" | "ars") => {
    setCurrencyState(val);
    localStorage.setItem(LS_CURRENCY, val);
    window.dispatchEvent(new Event("ff-prefs-change"));
  };

  const setView = (val: "quick" | "images") => {
    setViewState(val);
    localStorage.setItem(LS_VIEW, val);
    window.dispatchEvent(new Event("ff-prefs-change"));
  };

  /* Duplicated items for seamless loop */
  const tickerContent = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <>
      {/* ── Announcement ticker ── */}
      <div className="overflow-hidden bg-violet py-2">
        <div className="animate-ticker inline-flex items-center gap-8 whitespace-nowrap">
          {tickerContent.map((item, i) => (
            <span key={i} className="flex items-center gap-8">
              <span className="text-[11px] font-bold tracking-wider text-black">{item}</span>
              <span className="text-black/30 font-bold">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Main header ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-violet/30 to-transparent" />
      <header className="sticky top-0 z-50 glass border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/favicon-logo.jpg" alt="FuelFit" width={36} height={36} className="rounded-xl" priority />
            <div className="flex flex-col leading-none">
              <span className="font-display text-[15px] font-extrabold tracking-wider text-text-primary">FUELFIT</span>
              <span className="text-[8px] font-bold tracking-[0.3em] text-violet">FITNESS STORE</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {NAV.map((n) => {
              const a = n.href === "/" ? p === "/" : p.startsWith((n as typeof NAV[number] & { activePrefix?: string }).activePrefix ?? n.href);
              return (
                <Link key={n.href} href={n.href} className={`relative py-1 text-[13px] font-medium transition-colors ${a ? "text-text-primary" : "text-text-muted hover:text-text-secondary"}`}>
                  {n.label}
                  {a && <span className="absolute -bottom-[2px] left-0 right-0 h-[2px] rounded-full bg-violet" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            {mounted && showCatalogControls && (
              <>
                <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
                  <button onClick={() => setCurrency("usdt")} title="Precios en USDT" className={`flex items-center px-2 py-1.5 transition-all ${currency === "usdt" ? "bg-violet/15" : "opacity-50 hover:opacity-80"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://flagcdn.com/w20/us.png" alt="USD" width={20} height={13} className="rounded-sm" />
                  </button>
                  <div className="w-px h-4 bg-border/60" />
                  <button onClick={() => setCurrency("ars")} title="Precios en ARS" className={`flex items-center px-2 py-1.5 transition-all ${currency === "ars" ? "bg-violet/15" : "opacity-50 hover:opacity-80"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://flagcdn.com/w20/ar.png" alt="ARS" width={20} height={13} className="rounded-sm" />
                  </button>
                </div>
                <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
                  <button onClick={() => setView("quick")} title="Vista rápida" className={`px-2.5 py-1.5 transition-all ${view === "quick" ? "bg-violet/15 text-violet-light" : "text-text-muted hover:text-text-secondary"}`}><List size={15} /></button>
                  <div className="w-px h-4 bg-border/60" />
                  <button onClick={() => setView("images")} title="Vista con imágenes" className={`px-2.5 py-1.5 transition-all ${view === "images" ? "bg-violet/15 text-violet-light" : "text-text-muted hover:text-text-secondary"}`}><Grid3X3 size={15} /></button>
                </div>
              </>
            )}

            <button onClick={() => setDrawerOpen(true)} className="relative flex items-center gap-2 rounded-xl px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all">
              <ShoppingCart size={18} />
              <span className="hidden text-[11px] font-semibold tracking-wider sm:inline uppercase">Carrito</span>
              {mounted && isMayorista && countMay > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-black">{countMay}</span>}
              {mounted && !isMayorista && count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-black">{count}</span>}
            </button>

            <button onClick={() => setOpen(!open)} className="ml-1 rounded-xl p-2 text-text-muted hover:bg-bg-hover lg:hidden">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-border bg-bg-card px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">{n.label}</Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} isMayorista={isMayorista} />
    </>
  );
}
