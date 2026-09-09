import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const STALE_MINUTES = 30;

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function fetchBinance(): Promise<number | null> {
  try {
    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset: "USDT", fiat: "ARS", tradeType: "BUY",
        page: 1, rows: 3, payTypes: [], publisherType: null, merchantCheck: false,
      }),
    });
    const json = await res.json();
    const prices: number[] = (json?.data || [])
      .slice(0, 3)
      .map((d: { adv?: { price?: string } }) => parseFloat(d?.adv?.price || "0"))
      .filter((n: number) => n > 0);
    if (prices.length === 0) return null;
    return Math.round((prices.reduce((a: number, b: number) => a + b, 0) / prices.length) * 100) / 100;
  } catch {
    return null;
  }
}

async function fetchDolarHoy(): Promise<number | null> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/cripto", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.venta ? Math.round(parseFloat(json.venta) * 100) / 100 : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = makeClient();

  // Leer valor actual y cuándo fue actualizado
  const { data: row } = await supabase
    .from("config")
    .select("value, updated_at")
    .eq("key", "fx_usdt_ars")
    .maybeSingle();

  const cachedValue = row?.value ? parseFloat(row.value) : null;
  const updatedAt = row?.updated_at ? new Date(row.updated_at) : null;
  const ageMinutes = updatedAt ? (Date.now() - updatedAt.getTime()) / 60000 : Infinity;

  // Si el dato es fresco, devolver sin consultar APIs externas
  if (cachedValue && ageMinutes < STALE_MINUTES) {
    return NextResponse.json({ rate: cachedValue, source: "cache", age_minutes: Math.round(ageMinutes) });
  }

  // Refrescar
  const [binance, dolarhoy] = await Promise.all([fetchBinance(), fetchDolarHoy()]);
  const values = [binance, dolarhoy].filter((v): v is number => v !== null);

  if (values.length === 0) {
    // Si fallan las APIs externas, devolver el caché aunque esté vencido
    if (cachedValue) {
      return NextResponse.json({ rate: cachedValue, source: "cache_stale", age_minutes: Math.round(ageMinutes) });
    }
    return NextResponse.json({ error: "No se pudo obtener cotización" }, { status: 502 });
  }

  const average = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;

  await supabase.from("config").upsert(
    { key: "fx_usdt_ars", value: String(average) },
    { onConflict: "key" }
  );

  return NextResponse.json({ rate: average, source: "live", binance, dolarhoy });
}
