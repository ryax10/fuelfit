import { createPublicServerClient } from "@/lib/supabase/public-server";
import MayoristaTiendaClient from "./MayoristaTiendaClient";
import type { Product } from "@/lib/local-db/types";

export const revalidate = 30;

export default async function MayoristaTiendaPage() {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("visible", true)
    .gt("price_may_x15", 0)
    .order("created_at");

  return <MayoristaTiendaClient initialProducts={(data || []) as Product[]} />;
}
