import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function fetchBinanceAvg(): Promise<number | null> {
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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [binance, dolarhoy] = await Promise.all([fetchBinanceAvg(), fetchDolarHoy()]);
  const values = [binance, dolarhoy].filter((v): v is number => v !== null);

  if (values.length === 0) {
    return NextResponse.json({ error: "No se pudo obtener precios" }, { status: 502 });
  }

  const average = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;

  const argDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await supabase
    .from("daily_fx")
    .upsert({ date: argDate, buy_price: binance ?? average, sell_price: dolarhoy ?? average }, { onConflict: "date" });

  await supabase.from("config").upsert(
    { key: "fx_usdt_ars", value: String(average) },
    { onConflict: "key" }
  );

  return NextResponse.json({ success: true, date: argDate, binance, dolarhoy, average });
}
