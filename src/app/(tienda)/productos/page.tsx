import type { Metadata } from "next";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import ProductosClient from "./ProductosClient";
import type { Product } from "@/lib/local-db/types";

export const revalidate = 30; // re-render cada 30s — el stock se mantiene fresco para evitar overselling

export const metadata: Metadata = {
  title: "Catálogo de Productos",
  description: "Todo nuestro catálogo de suplementos deportivos y ropa fitness. Precios mayoristas y minoristas. Envíos a todo el país.",
  openGraph: {
    title: "Catálogo | FuelFit",
    description: "Suplementos deportivos y ropa fitness. Todos nuestros productos con precios actualizados.",
  },
  alternates: {
    canonical: "/productos",
  },
};

export default async function ProductosPage() {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("visible", true)
    .gt("price_min_ars", 0)
    .order("created_at");

  return <ProductosClient initialProducts={(data || []) as Product[]} />;
}
