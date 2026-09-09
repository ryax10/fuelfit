import type { Metadata } from "next";
import { TiendaHeader } from "@/components/tienda/tienda-header";
import { TiendaFooter } from "@/components/tienda/tienda-footer";

export const metadata: Metadata = {
  title: {
    default: "FuelFit — Suplementos y Ropa Fitness",
    template: "%s | FuelFit",
  },
  description: "FuelFit: suplementos deportivos y ropa fitness premium. Venta mayorista y minorista. Envíos a todo el país.",
};

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <TiendaHeader />
      <main className="flex-1">{children}</main>
      <TiendaFooter />
    </div>
  );
}
