import type { Metadata } from "next";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import HomeClient from "./HomeClient";
import type { Product } from "@/lib/local-db/types";

export const revalidate = 30; // re-render cada 30s — el stock se mantiene fresco para evitar overselling

export const metadata: Metadata = {
  title: "FuelFit — Suplementos y Ropa Deportiva",
  description: "FuelFit: suplementos deportivos y ropa fitness premium. Venta mayorista y minorista. Envíos a todo el país.",
};

export default async function Home() {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("visible", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  return <HomeClient products={(data || []) as Product[]} />;
}
