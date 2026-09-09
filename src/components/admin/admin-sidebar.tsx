"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Users, Wallet,
  ArrowDownUp, TrendingUp, Scale, Settings, Store, LogOut, Star, Sparkles, Tag, FileText, Menu, X,
} from "lucide-react";
import { logoutAction } from "@/app/admin/login/actions";

const SECTIONS = [
  { title: "PRINCIPAL", items: [{ href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true }] },
  {
    title: "GESTIÓN", items: [
      { href: "/admin/products", icon: Package, label: "Productos" },
      { href: "/admin/sales", icon: ShoppingCart, label: "Ventas" },
      { href: "/admin/purchases", icon: Truck, label: "Compras" },
      { href: "/admin/customers", icon: Users, label: "Clientes" },
    ]
  },
  {
    title: "FINANZAS", items: [
      { href: "/admin/cash", icon: Wallet, label: "Caja" },
      { href: "/admin/debts", icon: ArrowDownUp, label: "Deudas" },
      { href: "/admin/profit", icon: TrendingUp, label: "Ganancias" },
      { href: "/admin/balance", icon: Scale, label: "Balance" },
    ]
  },
  {
    title: "TIENDA", items: [
      { href: "/admin/featured", icon: Star, label: "Destacados" },
      { href: "/admin/novedades", icon: Sparkles, label: "Novedades" },
      { href: "/admin/marcas", icon: Tag, label: "Marcas" },
      { href: "/admin/config", icon: Settings, label: "Configuración" },
      { href: "/", icon: Store, label: "Ver Tienda" },
    ]
  },
  {
    title: "CONTENIDO", items: [
      { href: "/admin/contenido", icon: FileText, label: "Contenido" },
    ]
  },
];

export function AdminSidebar({ userName }: { userName: string }) {
  const p = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Cerrar sidebar al cambiar de ruta en mobile
  useEffect(() => { setOpen(false); }, [p]);

  const handleLogout = async () => {
    await logoutAction();
    router.push("/admin/login");
  };

  const navContent = (
    <>
      <nav className="flex-1 space-y-5 px-3 py-4">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.15em] text-text-muted">{s.title}</p>
            {s.items.map((item) => {
              const exact = "exact" in item ? !!item.exact : false;
              const isActive = exact ? p === item.href : item.href === "/" ? false : p.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${isActive ? "border-l-2 border-violet bg-violet/10 text-violet-light" : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"}`}
                >
                  <item.icon size={16} />{item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-text-muted transition-colors hover:bg-bg-hover hover:text-red-400"
        >
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superior mobile */}
      <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logo.jpg" alt="Full Vip" width={26} height={26} className="rounded-lg" />
          <span className="font-display text-sm font-bold text-violet-light">FULL VIP</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-bg-hover"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-56 flex-col overflow-y-auto border-r border-border bg-bg-secondary transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        {/* Header del sidebar */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="Full Vip" width={28} height={28} className="rounded-lg" />
            <div className="leading-none">
              <p className="font-display text-sm font-bold text-violet-light">FULL VIP</p>
              <p className="text-[9px] text-text-muted capitalize">{userName}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-bg-hover lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {navContent}
      </aside>
    </>
  );
}
