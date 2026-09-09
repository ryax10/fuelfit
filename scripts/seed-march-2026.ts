/**
 * seed-march-2026.ts
 * Carga histórica de datos de Marzo 2026 desde FULLVAPO.xlsx
 * Inserción directa (NO modifica stock_actual ni cajas existentes)
 * Ejecutar: npx ts-node --project tsconfig.json scripts/seed-march-2026.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FX_DEFAULT = 1472; // ARS/USD referencia marzo 2026

// ─── PRODUCTOS NECESARIOS (se crean si no existen en DB) ──────────────────────
// visible=false para no mostrarlos en la tienda hasta configurarlos manualmente

const PRODUCTS_TO_UPSERT: Record<string, {
  name: string; brand: string; model: string; flavor: string;
  category: string; cost_price: number; price_may_x15: number;
  divided?: boolean; units_per_pack?: number;
}> = {
  // ELFBAR ICE KING 40000
  "ELF40004": { name: "ELFBAR ICE KING 40000 - DRAGON STRAWBERRY NANA", brand: "ELFBAR", model: "ICE KING 40000", flavor: "DRAGON STRAWBERRY NANA", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40005": { name: "ELFBAR ICE KING 40000 - MIAMI MINT", brand: "ELFBAR", model: "ICE KING 40000", flavor: "MIAMI MINT", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40009": { name: "ELFBAR ICE KING 40000 - SOUR LUSH GUMMY", brand: "ELFBAR", model: "ICE KING 40000", flavor: "SOUR LUSH GUMMY", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40010": { name: "ELFBAR ICE KING 40000 - SOUR STRAWBERRY DRAGONFRUIT", brand: "ELFBAR", model: "ICE KING 40000", flavor: "SOUR STRAWBERRY DRAGONFRUIT", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40012": { name: "ELFBAR ICE KING 40000 - TIGERS BLOOD", brand: "ELFBAR", model: "ICE KING 40000", flavor: "TIGERS BLOOD", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40013": { name: "ELFBAR ICE KING 40000 - WATERMELON ICE", brand: "ELFBAR", model: "ICE KING 40000", flavor: "WATERMELON ICE", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40014": { name: "ELFBAR ICE KING 40000 - BLUERAZZ ICE", brand: "ELFBAR", model: "ICE KING 40000", flavor: "BLUERAZZ ICE", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40016": { name: "ELFBAR ICE KING 40000 - STRAWBERRY ICE", brand: "ELFBAR", model: "ICE KING 40000", flavor: "STRAWBERRY ICE", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40017": { name: "ELFBAR ICE KING 40000 - STRAWBERRY WATERMELON", brand: "ELFBAR", model: "ICE KING 40000", flavor: "STRAWBERRY WATERMELON", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  "ELF40018": { name: "ELFBAR ICE KING 40000 - GRAPE ICE", brand: "ELFBAR", model: "ICE KING 40000", flavor: "GRAPE ICE", category: "nicotina", cost_price: 9.20, price_may_x15: 13 },
  // ELFBAR GH 23000
  "ELF2313":  { name: "ELFBAR GH 23000 - BLUE RAZZ ICE", brand: "ELFBAR", model: "GH 23000", flavor: "BLUE RAZZ ICE", category: "nicotina", cost_price: 8.50, price_may_x15: 12 },
  // ELFBAR BC 45000
  "ELFBC45001": { name: "ELFBAR BC 45000 - BLUEBERRY STRAWBERRY COCONUT", brand: "ELFBAR", model: "BC 45000", flavor: "BLUEBERRY STRAWBERRY COCONUT", category: "nicotina", cost_price: 10.60, price_may_x15: 14.50 },
  "ELFBC45004": { name: "ELFBAR BC 45000 - STRAWBERRY ICE", brand: "ELFBAR", model: "BC 45000", flavor: "STRAWBERRY ICE", category: "nicotina", cost_price: 10.60, price_may_x15: 14.50 },
  "ELFBC45005": { name: "ELFBAR BC 45000 - STRAWBERRY KIWI", brand: "ELFBAR", model: "BC 45000", flavor: "STRAWBERRY KIWI", category: "nicotina", cost_price: 10.60, price_may_x15: 14.50 },
  "ELFBC45006": { name: "ELFBAR BC 45000 - WATERMELON ICE", brand: "ELFBAR", model: "BC 45000", flavor: "WATERMELON ICE", category: "nicotina", cost_price: 10.60, price_may_x15: 14.50 },
  "ELFBC45007": { name: "ELFBAR BC 45000 - GRAPE TWIST", brand: "ELFBAR", model: "BC 45000", flavor: "GRAPE TWIST", category: "nicotina", cost_price: 10.60, price_may_x15: 14.50 },
  "ELFBC45008": { name: "ELFBAR BC 45000 - KIWI PASSION FRUIT GUAVA", brand: "ELFBAR", model: "BC 45000", flavor: "KIWI PASSION FRUIT GUAVA", category: "nicotina", cost_price: 10.60, price_may_x15: 14.50 },
  "ELFBC45009": { name: "ELFBAR BC 45000 - COOL MENTHOL", brand: "ELFBAR", model: "BC 45000", flavor: "COOL MENTHOL", category: "nicotina", cost_price: 10.60, price_may_x15: 14.50 },
  // IGNITE V300 30000
  "IGN30001": { name: "IGNITE V300 30000 - BLUEBERRY ICE", brand: "IGNITE", model: "V300 30000", flavor: "BLUEBERRY ICE", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30002": { name: "IGNITE V300 30000 - GRAPE ICE", brand: "IGNITE", model: "V300 30000", flavor: "GRAPE ICE", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30003": { name: "IGNITE V300 30000 - STRAWBERRY BANANA", brand: "IGNITE", model: "V300 30000", flavor: "STRAWBERRY BANANA", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30004": { name: "IGNITE V300 30000 - STRAWBERRY ICE", brand: "IGNITE", model: "V300 30000", flavor: "STRAWBERRY ICE", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30005": { name: "IGNITE V300 30000 - STRAWBERRY KIWI", brand: "IGNITE", model: "V300 30000", flavor: "STRAWBERRY KIWI", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30007": { name: "IGNITE V300 30000 - WATERMELON ICE", brand: "IGNITE", model: "V300 30000", flavor: "WATERMELON ICE", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30014": { name: "IGNITE V300 30000 - PINEAPPLE ICE", brand: "IGNITE", model: "V300 30000", flavor: "PINEAPPLE ICE", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30015": { name: "IGNITE V300 30000 - MENTHOL", brand: "IGNITE", model: "V300 30000", flavor: "MENTHOL", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30016": { name: "IGNITE V300 30000 - BANANA ICE", brand: "IGNITE", model: "V300 30000", flavor: "BANANA ICE", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30017": { name: "IGNITE V300 30000 - PINEAPPLE KIWI DRAGON FRUIT", brand: "IGNITE", model: "V300 30000", flavor: "PINEAPPLE KIWI DRAGON FRUIT", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  "IGN30018": { name: "IGNITE V300 30000 - SWEET AND SOUR POMEGRANATE", brand: "IGNITE", model: "V300 30000", flavor: "SWEET AND SOUR POMEGRANATE", category: "nicotina", cost_price: 9.90, price_may_x15: 13.20 },
  // TORCH 6.0G SATIVA
  "TOR603": { name: "TORCH 6.0G SATIVA - PINK LEMONADE", brand: "TORCH", model: "6.0G SATIVA", flavor: "PINK LEMONADE", category: "thc", cost_price: 17, price_may_x15: 26 },
  "TOR606": { name: "TORCH 6.0G SATIVA - GUAVA GELATO", brand: "TORCH", model: "6.0G SATIVA", flavor: "GUAVA GELATO", category: "thc", cost_price: 17, price_may_x15: 26 },
  "TOR609": { name: "TORCH 6.0G SATIVA - CHERRY BOMB", brand: "TORCH", model: "6.0G SATIVA", flavor: "CHERRY BOMB", category: "thc", cost_price: 17, price_may_x15: 26 },
  "TOR610": { name: "TORCH 6.0G SATIVA - CRAZY LEMON", brand: "TORCH", model: "6.0G SATIVA", flavor: "CRAZY LEMON", category: "thc", cost_price: 17, price_may_x15: 26 },
  // PHENOM 6.0G MUSHROOM
  "PHE008": { name: "PHENOM 6.0G MUSHROOM - ICE CREAM CAKE", brand: "PHENOM", model: "6.0G MUSHROOM", flavor: "ICE CREAM CAKE", category: "thc", cost_price: 24, price_may_x15: 31 },
  "PHE011": { name: "PHENOM 6.0G MUSHROOM - VAINILLA", brand: "PHENOM", model: "6.0G MUSHROOM", flavor: "VAINILLA", category: "thc", cost_price: 24, price_may_x15: 31 },
  "PHE012": { name: "PHENOM 6.0G MUSHROOM - PINK LEMONADE", brand: "PHENOM", model: "6.0G MUSHROOM", flavor: "PINK LEMONADE", category: "thc", cost_price: 24, price_may_x15: 31 },
  "PHE013": { name: "PHENOM 6.0G MUSHROOM - ALIEN OG", brand: "PHENOM", model: "6.0G MUSHROOM", flavor: "ALIEN OG", category: "thc", cost_price: 24, price_may_x15: 31 },
  // TORCH HULK GUMMIES 20PCS (divided)
  "TORHG15001": { name: "TORCH HULK GUMMIES 20PCS - BERRY BLAST", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "BERRY BLAST", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15002": { name: "TORCH HULK GUMMIES 20PCS - STRAWBERRY", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "STRAWBERRY", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15003": { name: "TORCH HULK GUMMIES 20PCS - SOUR BLUE RAZZ", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "SOUR BLUE RAZZ", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15004": { name: "TORCH HULK GUMMIES 20PCS - ROCKET POP", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "ROCKET POP", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15005": { name: "TORCH HULK GUMMIES 20PCS - SOUR WATERMELON", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "SOUR WATERMELON", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15006": { name: "TORCH HULK GUMMIES 20PCS - SUPER LEMON CHERRY", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "SUPER LEMON CHERRY", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15007": { name: "TORCH HULK GUMMIES 20PCS - MANGO", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "MANGO", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15008": { name: "TORCH HULK GUMMIES 20PCS - CHERRY BOMB", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "CHERRY BOMB", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15009": { name: "TORCH HULK GUMMIES 20PCS - TROPICAL PUNCH", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "TROPICAL PUNCH", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  "TORHG15010": { name: "TORCH HULK GUMMIES 20PCS - WATERMELON LEMON", brand: "TORCH", model: "HULK GUMMIES 20PCS", flavor: "WATERMELON LEMON", category: "thc", cost_price: 50, price_may_x15: 80, divided: true, units_per_pack: 20 },
  // BLOW 3.5G
  "BLOW011": { name: "BLOW 3.5G - SUPER LEMON HAZE", brand: "BLOW", model: "3.5G", flavor: "SUPER LEMON HAZE", category: "thc", cost_price: 22.50, price_may_x15: 30 },
  "BLOW012": { name: "BLOW 3.5G - AMNESIA", brand: "BLOW", model: "3.5G", flavor: "AMNESIA", category: "thc", cost_price: 22.50, price_may_x15: 30 },
  "BLOW013": { name: "BLOW 3.5G - NORTHERN LIGHTS", brand: "BLOW", model: "3.5G", flavor: "NORTHERN LIGHTS", category: "thc", cost_price: 22.50, price_may_x15: 30 },
  "BLOW017": { name: "BLOW 3.5G - PAPAYA PUNCH/BANANA SHERBET/GRAPE ATOMPER", brand: "BLOW", model: "3.5G", flavor: "PAPAYA PUNCH", category: "thc", cost_price: 22.50, price_may_x15: 30 },
  "BLOW018": { name: "BLOW 3.5G - ORANGE COOKIES/BERRY GELATO/CHERRY PIE", brand: "BLOW", model: "3.5G", flavor: "ORANGE COOKIES", category: "thc", cost_price: 22.50, price_may_x15: 30 },
  // BLOW RECARGAS 3ML
  "BLOWREC001": { name: "BLOW RECARGA 3ML - BLUE DREAM", brand: "BLOW", model: "RECARGA 3ML", flavor: "BLUE DREAM", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  "BLOWREC002": { name: "BLOW RECARGA 3ML - MIMOSA", brand: "BLOW", model: "RECARGA 3ML", flavor: "MIMOSA", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  "BLOWREC004": { name: "BLOW RECARGA 3ML - GORILLA GLUE", brand: "BLOW", model: "RECARGA 3ML", flavor: "GORILLA GLUE", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  "BLOWREC005": { name: "BLOW RECARGA 3ML - FORBIDDEN FRUIT", brand: "BLOW", model: "RECARGA 3ML", flavor: "FORBIDDEN FRUIT", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  "BLOWREC006": { name: "BLOW RECARGA 3ML - OG KUSH", brand: "BLOW", model: "RECARGA 3ML", flavor: "OG KUSH", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  "BLOWREC009": { name: "BLOW RECARGA 3ML - CLEMENTINE", brand: "BLOW", model: "RECARGA 3ML", flavor: "CLEMENTINE", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  "BLOWREC012": { name: "BLOW RECARGA 3ML - DURBAN POISON", brand: "BLOW", model: "RECARGA 3ML", flavor: "DURBAN POISON", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  "BLOWREC013": { name: "BLOW RECARGA 3ML - AFGO", brand: "BLOW", model: "RECARGA 3ML", flavor: "AFGO", category: "thc", cost_price: 20.50, price_may_x15: 26 },
  // OTROS THC
  "HBG8401": { name: "HALF BAKED GUMMIES - WACKY WATERMELON", brand: "HALF BAKED", model: "GUMMIES", flavor: "WACKY WATERMELON", category: "thc", cost_price: 9, price_may_x15: 16 },
  "TOR-4002": { name: "TORCH 4.0G - BOUJEE BLUE DREAMS SATIVA", brand: "TORCH", model: "4.0G", flavor: "BOUJEE BLUE DREAMS", category: "thc", cost_price: 14, price_may_x15: 23 },
};

// ─── PEDIDOS DE COMPRA (PURCHASES) ────────────────────────────────────────────
const PURCHASES = [
  {
    number: 168,
    supplier: "WOV",
    ordered_at: "2026-02-25",
    received_at: "2026-03-02",
    currency: "USD" as const,
    payment_status: "paid" as const,
    paid_amount_usd: 0, // pagado en febrero, no hay registro de pago en marzo
    items: [
      { sku: "ELF40004", qty: 25, unit_cost: 9.20 },
      { sku: "ELF40005", qty: 5,  unit_cost: 9.20 },
      { sku: "ELF40013", qty: 10, unit_cost: 9.20 },
      { sku: "ELF40017", qty: 10, unit_cost: 9.20 },
      { sku: "IGN30003", qty: 30, unit_cost: 9.90 },
      { sku: "IGN30004", qty: 30, unit_cost: 9.90 },
      { sku: "IGN30005", qty: 30, unit_cost: 9.90 },
      { sku: "IGN30007", qty: 30, unit_cost: 9.90 },
      { sku: "IGN30016", qty: 10, unit_cost: 9.90 },
      { sku: "IGN30018", qty: 15, unit_cost: 9.90 },
      { sku: "IGN30022", qty: 5,  unit_cost: 9.90 },
    ],
  },
  {
    number: 169,
    supplier: "WOV",
    ordered_at: "2026-02-26",
    received_at: "2026-03-02",
    currency: "USD" as const,
    payment_status: "paid" as const,
    paid_amount_usd: 0,
    items: [
      { sku: "ELFBC45001", qty: 10, unit_cost: 10.60 },
      { sku: "ELFBC45004", qty: 10, unit_cost: 10.60 },
      { sku: "ELFBC45005", qty: 5,  unit_cost: 10.60 },
      { sku: "ELFBC45006", qty: 5,  unit_cost: 10.60 },
      { sku: "ELFBC45007", qty: 10, unit_cost: 10.60 },
      { sku: "ELFBC45008", qty: 5,  unit_cost: 10.60 },
      { sku: "ELFBC45009", qty: 5,  unit_cost: 10.60 },
    ],
  },
  {
    number: 170,
    supplier: "GIULIANO",
    ordered_at: "2026-03-06",
    received_at: "2026-03-06",
    currency: "USD" as const,
    payment_status: "paid" as const,
    paid_amount_usd: 1000,
    items: [
      { sku: "TORHG15001", qty: 20, unit_cost: 2.50 },
      { sku: "TORHG15002", qty: 60, unit_cost: 2.50 },
      { sku: "TORHG15003", qty: 20, unit_cost: 2.50 },
      { sku: "TORHG15004", qty: 40, unit_cost: 2.50 },
      { sku: "TORHG15005", qty: 60, unit_cost: 2.50 },
      { sku: "TORHG15006", qty: 40, unit_cost: 2.50 },
      { sku: "TORHG15007", qty: 40, unit_cost: 2.50 },
      { sku: "TORHG15008", qty: 40, unit_cost: 2.50 },
      { sku: "TORHG15009", qty: 40, unit_cost: 2.50 },
      { sku: "TORHG15010", qty: 40, unit_cost: 2.50 },
    ],
  },
  {
    number: 171,
    supplier: "WOV",
    ordered_at: "2026-03-06",
    received_at: null, // en camino
    currency: "USD" as const,
    payment_status: "partial" as const, // pagado $4,607.50 pero no recibido
    paid_amount_usd: 4607.50,
    items: [
      { sku: "IGNUS30001", qty: 0, unit_cost: 10.25 },
      { sku: "IGNUS30002", qty: 0, unit_cost: 10.25 },
      { sku: "IGNUS30003", qty: 0, unit_cost: 10.25 },
      { sku: "IGNUS30004", qty: 0, unit_cost: 10.25 },
      { sku: "IGNUS30005", qty: 0, unit_cost: 10.25 },
      { sku: "ELF2304", qty: 0, unit_cost: 8.40 },
      { sku: "ELF2305", qty: 0, unit_cost: 8.40 },
      { sku: "ELF2308", qty: 0, unit_cost: 8.40 },
      { sku: "ELF2313", qty: 0, unit_cost: 8.40 },
      { sku: "ELF40002", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40004", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40005", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40006", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40010", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40011", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40013", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40014", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40015", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40016", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40017", qty: 0, unit_cost: 9.15 },
      { sku: "ELF40018", qty: 0, unit_cost: 9.15 },
      { sku: "IGNVM40002", qty: 0, unit_cost: 10.75 },
      { sku: "IGNVM40003", qty: 0, unit_cost: 10.75 },
      { sku: "IGNVM40004", qty: 0, unit_cost: 10.75 },
      { sku: "IGNVM40005", qty: 0, unit_cost: 10.75 },
      { sku: "IGNVM40008", qty: 0, unit_cost: 10.75 },
      { sku: "IGNVM40011", qty: 0, unit_cost: 10.75 },
      { sku: "IGNVM40015", qty: 0, unit_cost: 10.75 },
      { sku: "LM30001", qty: 0, unit_cost: 8.40 },
      { sku: "LM30002", qty: 0, unit_cost: 8.40 },
      { sku: "LM30006", qty: 0, unit_cost: 8.40 },
      { sku: "LM30009", qty: 0, unit_cost: 8.40 },
      { sku: "LM30013", qty: 0, unit_cost: 8.40 },
      { sku: "LM30017", qty: 0, unit_cost: 8.40 },
    ],
  },
];

// ─── VENTAS (ORDERS) ──────────────────────────────────────────────────────────
// type: "retail" = pagado en ARS | "wholesale" = pagado en USD
// payment: lo que muestra el Flujo de Caja
// unit_price: precio de venta en USD (para wholesale) o ARS convertido (para retail)

type OrderItem = { sku: string; qty: number; unit_price_usd: number };
type OrderDef = {
  number: number; date: string; customer: string; phone?: string;
  type: "retail" | "wholesale";
  items: OrderItem[];
  payment_ars?: number; payment_usd?: number;
  caja_ars?: string; caja_usd?: string;
  note?: string;
  is_internal?: boolean; // pedidos propios sin cobro
};

const ORDERS: OrderDef[] = [
  {
    number: 2869, date: "2026-03-02", customer: "AGUS KAYA GROW", type: "wholesale",
    items: [
      { sku: "TOR603",   qty: 1, unit_price_usd: 26 },
      { sku: "TOR606",   qty: 1, unit_price_usd: 26 },
      { sku: "TOR610",   qty: 1, unit_price_usd: 26 },
      { sku: "PHE008",   qty: 1, unit_price_usd: 31 },
      { sku: "PHE011",   qty: 2, unit_price_usd: 31 },
      { sku: "PHE012",   qty: 1, unit_price_usd: 31 },
      { sku: "PHE013",   qty: 2, unit_price_usd: 31 },
      { sku: "ELF40013", qty: 1, unit_price_usd: 13 },
      { sku: "ELF40014", qty: 2, unit_price_usd: 13 },
      { sku: "ELF40016", qty: 1, unit_price_usd: 13 },
      { sku: "ELF40017", qty: 1, unit_price_usd: 13 },
      { sku: "ELF40018", qty: 1, unit_price_usd: 13 },
    ],
    payment_ars: 501714, caja_ars: "Santiago",
    note: "AGUS KAYA GROW",
  },
  {
    number: 2870, date: "2026-03-02", customer: "CAMI", type: "wholesale",
    items: [
      { sku: "ELF40004", qty: 6, unit_price_usd: 13 },
      { sku: "ELF40009", qty: 1, unit_price_usd: 13 },
      { sku: "ELF40010", qty: 2, unit_price_usd: 13 },
      { sku: "ELF40012", qty: 2, unit_price_usd: 13 },
      { sku: "ELF40013", qty: 2, unit_price_usd: 13 },
      { sku: "ELF40016", qty: 1, unit_price_usd: 13 },
      { sku: "ELF40017", qty: 1, unit_price_usd: 13 },
    ],
    payment_usd: 195, caja_usd: "Santiago",
  },
  {
    number: 2871, date: "2026-03-02", customer: "GABRIELA", type: "retail",
    items: [{ sku: "PHE011", qty: 1, unit_price_usd: 41.80 }],
    payment_ars: 62000, caja_ars: "Santiago",
  },
  {
    number: 2872, date: "2026-03-02", customer: "VERONICA MALDONADO", type: "retail",
    items: [{ sku: "ELF40016", qty: 1, unit_price_usd: 19.50 }],
    payment_ars: 29000, caja_ars: "Santiago",
  },
  {
    number: 2873, date: "2026-03-02", customer: "KIOSCO VIDELA", type: "wholesale",
    items: [
      { sku: "ELF40014", qty: 1, unit_price_usd: 13 },
      { sku: "ELF40016", qty: 1, unit_price_usd: 13 },
      { sku: "ELF40018", qty: 1, unit_price_usd: 13 },
      { sku: "IGN30002", qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30007", qty: 1, unit_price_usd: 13.20 },
    ],
    payment_usd: 65.4, caja_usd: "Santiago",
    note: "KIOSCO VIDELA",
  },
  {
    number: 2874, date: "2026-03-03", customer: "LUCAS LA BOMBA", type: "wholesale",
    items: [
      { sku: "ELF40005", qty: 3,  unit_price_usd: 13 },
      { sku: "ELF40014", qty: 1,  unit_price_usd: 13 },
      { sku: "ELF40017", qty: 1,  unit_price_usd: 13 },
      { sku: "ELF40013", qty: 5,  unit_price_usd: 13 },
      { sku: "ELF40016", qty: 5,  unit_price_usd: 13 },
      { sku: "ELF40018", qty: 5,  unit_price_usd: 13 },
    ],
    payment_ars: 382720, caja_ars: "Santiago",
  },
  {
    number: 2875, date: "2026-03-03", customer: "KIOSCO FRIENDS ROMAN", type: "wholesale",
    items: [
      { sku: "ELF40004", qty: 5,  unit_price_usd: 12 },
      { sku: "ELF40005", qty: 8,  unit_price_usd: 12 },
      { sku: "ELF40009", qty: 19, unit_price_usd: 12 },
      { sku: "ELF40010", qty: 8,  unit_price_usd: 12 },
      { sku: "ELF40012", qty: 7,  unit_price_usd: 12 },
      { sku: "ELF40013", qty: 10, unit_price_usd: 12 },
      { sku: "ELF40014", qty: 4,  unit_price_usd: 12 },
      { sku: "ELF40016", qty: 12, unit_price_usd: 12 },
      { sku: "ELF40017", qty: 2,  unit_price_usd: 12 },
      { sku: "ELF40018", qty: 5,  unit_price_usd: 12 },
      { sku: "IGN30001", qty: 5,  unit_price_usd: 12.20 },
      { sku: "IGN30003", qty: 5,  unit_price_usd: 12.20 },
      { sku: "IGN30004", qty: 5,  unit_price_usd: 12.20 },
      { sku: "IGN30007", qty: 5,  unit_price_usd: 12.20 },
    ],
    payment_usd: 1200, payment_ars: 6000, caja_usd: "Santiago", caja_ars: "Santiago",
  },
  {
    number: 2876, date: "2026-03-03", customer: "MEL BARATS GROW", type: "wholesale",
    items: [
      { sku: "ELF40004",  qty: 1, unit_price_usd: 13 },
      { sku: "ELF40005",  qty: 1, unit_price_usd: 13 },
      { sku: "ELF40012",  qty: 1, unit_price_usd: 13 },
      { sku: "ELF40013",  qty: 1, unit_price_usd: 13 },
      { sku: "ELF40014",  qty: 2, unit_price_usd: 13 },
      { sku: "ELF40016",  qty: 1, unit_price_usd: 13 },
      { sku: "ELF40017",  qty: 2, unit_price_usd: 13 },
      { sku: "ELF40018",  qty: 1, unit_price_usd: 13 },
      { sku: "IGN30001",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30002",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30003",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30004",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30005",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30007",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30014",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30015",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30017",  qty: 1, unit_price_usd: 13.20 },
      { sku: "IGN30018",  qty: 1, unit_price_usd: 13.20 },
    ],
    payment_ars: 383500, caja_ars: "Efectivo",
  },
  {
    number: 2877, date: "2026-03-03", customer: "LU", type: "wholesale",
    items: [
      { sku: "ELF40005",   qty: 1, unit_price_usd: 13 },
      { sku: "ELF40004",   qty: 1, unit_price_usd: 13 },
      { sku: "ELF40013",   qty: 2, unit_price_usd: 13 },
      { sku: "ELF40014",   qty: 1, unit_price_usd: 13 },
      { sku: "ELF40016",   qty: 2, unit_price_usd: 13 },
      { sku: "ELF40017",   qty: 3, unit_price_usd: 13 },
      { sku: "ELF40018",   qty: 2, unit_price_usd: 13 },
      { sku: "ELFBC45001", qty: 2, unit_price_usd: 15 },
      { sku: "ELFBC45004", qty: 2, unit_price_usd: 15 },
      { sku: "ELFBC45005", qty: 2, unit_price_usd: 15 },
      { sku: "ELFBC45006", qty: 2, unit_price_usd: 15 },
      { sku: "ELFBC45007", qty: 2, unit_price_usd: 15 },
      { sku: "ELFBC45009", qty: 2, unit_price_usd: 15 },
    ],
    payment_ars: 100000, caja_ars: "Santiago",
    note: "LU DEBE 289 USD",
  },
  {
    number: 2878, date: "2026-03-03", customer: "LUCAS LA BOMBA", type: "wholesale",
    items: [{ sku: "TORHG15008", qty: 20, unit_price_usd: 3.50 }], // $70 total = 1 pack
    payment_ars: 102620, caja_ars: "Santiago",
  },
  {
    number: 2879, date: "2026-03-03", customer: "BELEN VELAZQUEZ", type: "retail",
    items: [{ sku: "IGN30002", qty: 1, unit_price_usd: 19.70 }],
    payment_ars: 29000, caja_ars: "Luciano",
  },
  {
    number: 2880, date: "2026-03-03", customer: "ABEL TROCHE", type: "retail",
    items: [{ sku: "TORHG15003", qty: 2, unit_price_usd: 6.10 }],
    payment_ars: 18000, caja_ars: "Luciano",
  },
  {
    number: 2881, date: "2026-03-03", customer: "MANU", type: "wholesale",
    items: [
      { sku: "IGN30001", qty: 2, unit_price_usd: 13.20 },
      { sku: "IGN30002", qty: 4, unit_price_usd: 13.20 },
      { sku: "IGN30004", qty: 4, unit_price_usd: 13.20 },
      { sku: "IGN30007", qty: 3, unit_price_usd: 13.20 },
      { sku: "IGN30016", qty: 2, unit_price_usd: 13.20 },
    ],
    payment_ars: 291000, caja_ars: "Luciano",
  },
  {
    number: 2882, date: "2026-03-04", customer: "BRENDA", type: "retail",
    items: [{ sku: "ELF40017", qty: 1, unit_price_usd: 19.70 }],
    payment_ars: 29000, caja_ars: "Santiago",
  },
  {
    number: 2883, date: "2026-03-04", customer: "BRENDA", type: "retail",
    items: [
      { sku: "ELF40004", qty: 1, unit_price_usd: 19.70 },
      { sku: "ELF40017", qty: 1, unit_price_usd: 19.70 },
    ],
    payment_ars: 58000, caja_ars: "Santiago",
  },
  {
    number: 2884, date: "2026-03-04", customer: "GIULI", type: "retail",
    items: [
      { sku: "TORHG15008", qty: 20, unit_price_usd: 4.10 },
      { sku: "BLOW012",    qty: 1,  unit_price_usd: 47.60 },
    ],
    payment_ars: 190000, caja_ars: "Santiago",
  },
  {
    number: 2885, date: "2026-03-04", customer: "VEGA", type: "retail",
    is_internal: true,
    items: [
      { sku: "TOR603", qty: 1, unit_price_usd: 0 },
      { sku: "TOR606", qty: 1, unit_price_usd: 0 },
    ],
    note: "MUESTRA / DEVOLUCIÓN",
  },
  {
    number: 2886, date: "2026-03-05", customer: "FRAN BALOGH", type: "wholesale",
    items: [
      { sku: "ELF40004",  qty: 5,  unit_price_usd: 12.15 },
      { sku: "ELF40005",  qty: 1,  unit_price_usd: 12.15 },
      { sku: "ELF40013",  qty: 10, unit_price_usd: 12.15 },
      { sku: "ELF40014",  qty: 11, unit_price_usd: 12.15 },
      { sku: "ELF40016",  qty: 1,  unit_price_usd: 12.15 },
      { sku: "ELF40017",  qty: 10, unit_price_usd: 12.15 },
      { sku: "ELF40018",  qty: 12, unit_price_usd: 12.15 },
      { sku: "IGN30001",  qty: 10, unit_price_usd: 12.35 },
      { sku: "IGN30002",  qty: 7,  unit_price_usd: 12.35 },
      { sku: "IGN30003",  qty: 10, unit_price_usd: 12.35 },
      { sku: "IGN30004",  qty: 5,  unit_price_usd: 12.35 },
      { sku: "IGN30005",  qty: 5,  unit_price_usd: 12.35 },
      { sku: "IGN30007",  qty: 10, unit_price_usd: 12.35 },
      { sku: "IGN30014",  qty: 3,  unit_price_usd: 12.35 },
    ],
    payment_usd: 1230, caja_usd: "Santiago",
    note: "FRAN BALOGH TIENE 5 USD A FAVOR",
  },
  {
    number: 2887, date: "2026-03-05", customer: "MAXI AXION", type: "retail",
    items: [
      { sku: "IGN30001", qty: 1, unit_price_usd: 19.70 },
      { sku: "IGN30016", qty: 1, unit_price_usd: 19.70 },
    ],
    payment_ars: 58000, caja_ars: "Luciano",
  },
  {
    number: 2888, date: "2026-03-05", customer: "YANI", type: "retail",
    items: [
      { sku: "IGN30001", qty: 1, unit_price_usd: 19.70 },
      { sku: "IGN30014", qty: 1, unit_price_usd: 19.70 },
    ],
    payment_ars: 58000, caja_ars: "Luciano",
  },
  {
    number: 2889, date: "2026-03-05", customer: "ABEL TROCHE", type: "retail",
    items: [{ sku: "TORHG15003", qty: 5, unit_price_usd: 4.75 }],
    payment_ars: 35000, caja_ars: "Luciano",
  },
  {
    number: 2890, date: "2026-03-05", customer: "BELLA", type: "retail",
    items: [{ sku: "HBG8401", qty: 1, unit_price_usd: 19.70 }],
    payment_ars: 29000, caja_ars: "Santiago",
  },
  {
    number: 2891, date: "2026-03-05", customer: "MORA", type: "retail",
    items: [{ sku: "TOR-4002", qty: 1, unit_price_usd: 37.30 }],
    payment_ars: 55000, caja_ars: "Efectivo",
  },
  {
    number: 2892, date: "2026-03-05", customer: "CATA", type: "retail",
    items: [{ sku: "ELF40005", qty: 1, unit_price_usd: 19.70 }],
    payment_ars: 29000, caja_ars: "Efectivo", // 30000 efectivo - 1000 corrección santy
  },
  {
    number: 2893, date: "2026-03-06", customer: "MEL BARATS GROW", type: "wholesale",
    items: [
      { sku: "PHE008", qty: 2, unit_price_usd: 33 },
      { sku: "PHE011", qty: 2, unit_price_usd: 33 },
      { sku: "PHE012", qty: 2, unit_price_usd: 33 },
      { sku: "PHE013", qty: 2, unit_price_usd: 33 },
    ],
    payment_ars: 389000, caja_ars: "Santiago",
  },
  {
    number: 2894, date: "2026-03-06", customer: "GUADALUPE", type: "retail",
    items: [{ sku: "ELF2313", qty: 1, unit_price_usd: 18.30 }],
    payment_ars: 27000, caja_ars: "Efectivo",
  },
  {
    number: 2895, date: "2026-03-06", customer: "LU", type: "retail",
    items: [{ sku: "IGN30017", qty: 1, unit_price_usd: 19.70 }],
    payment_ars: 29000, caja_ars: "Santiago",
  },
  {
    number: 2896, date: "2026-03-06", customer: "SANTINO", type: "retail",
    items: [{ sku: "ELF40014", qty: 1, unit_price_usd: 19.70 }],
    payment_ars: 29000, caja_ars: "Efectivo",
  },
  {
    number: 2897, date: "2026-03-06", customer: "CARLA", type: "retail",
    items: [{ sku: "ELF40017", qty: 1, unit_price_usd: 19.70 }],
    payment_ars: 29000, caja_ars: "Luciano",
  },
  {
    number: 2898, date: "2026-03-07", customer: "NICO NVDRINKS", type: "wholesale",
    items: [{ sku: "TORHG15002", qty: 20, unit_price_usd: 3.50 }], // 1 pack $70 total
    payment_ars: 102830, caja_ars: "Santiago",
  },
  {
    number: 2899, date: "2026-03-07", customer: "BRIAN MONTEGRANDE", type: "wholesale",
    items: [
      { sku: "IGN30003", qty: 2, unit_price_usd: 13.20 },
      { sku: "IGN30005", qty: 2, unit_price_usd: 13.20 },
      { sku: "IGN30007", qty: 2, unit_price_usd: 13.20 },
      { sku: "IGN30015", qty: 3, unit_price_usd: 13.20 },
      { sku: "IGN30016", qty: 1, unit_price_usd: 13.20 },
    ],
    payment_ars: 193512, caja_ars: "Santiago",
  },
  {
    number: 2900, date: "2026-03-07", customer: "LUCAS LA BOMBA", type: "wholesale",
    items: [
      { sku: "TOR603", qty: 2, unit_price_usd: 26 },
      { sku: "TOR606", qty: 2, unit_price_usd: 26 },
      { sku: "TOR609", qty: 2, unit_price_usd: 26 },
      { sku: "TOR610", qty: 4, unit_price_usd: 26 },
    ],
    payment_ars: 382200, caja_ars: "Santiago",
  },
  {
    number: 2901, date: "2026-03-09", customer: "MAXI RDF", type: "wholesale",
    items: [
      { sku: "BLOWREC001", qty: 2,  unit_price_usd: 26 },
      { sku: "BLOWREC002", qty: 1,  unit_price_usd: 26 },
      { sku: "BLOWREC004", qty: 1,  unit_price_usd: 26 },
      { sku: "BLOWREC005", qty: 1,  unit_price_usd: 26 },
      { sku: "BLOWREC006", qty: 1,  unit_price_usd: 26 },
      { sku: "BLOWREC009", qty: 1,  unit_price_usd: 26 },
      { sku: "BLOWREC012", qty: 1,  unit_price_usd: 26 },
      { sku: "BLOWREC013", qty: 2,  unit_price_usd: 26 },
      { sku: "ELF40014",   qty: 17, unit_price_usd: 13 },
    ],
    payment_usd: 481, caja_usd: "Santiago",
  },
  {
    number: 2902, date: "2026-03-07", customer: "LUCIANO CONTI", type: "retail",
    is_internal: true,
    items: [{ sku: "BLOWREC002", qty: 1, unit_price_usd: 0 }],
    note: "LUCHO PRUEBA DESCARTABLE",
  },
  {
    number: 2903, date: "2026-03-09", customer: "MAXI RDF", type: "wholesale",
    items: [
      { sku: "BLOW011", qty: 2, unit_price_usd: 28 },
      { sku: "BLOW012", qty: 3, unit_price_usd: 28 },
      { sku: "BLOW017", qty: 2, unit_price_usd: 28 },
      { sku: "BLOW018", qty: 2, unit_price_usd: 28 },
    ],
    payment_usd: 252, caja_usd: "Santiago",
  },
  {
    number: 2904, date: "2026-03-09", customer: "POLI BENITEZ", type: "retail",
    items: [{ sku: "ELFBC45001", qty: 1, unit_price_usd: 21 }],
    payment_ars: 31000, caja_ars: "Efectivo",
  },
  {
    number: 2905, date: "2026-03-09", customer: "ALBERTO", type: "retail",
    items: [{ sku: "ELFBC45004", qty: 1, unit_price_usd: 21 }],
    payment_ars: 31000, caja_ars: "Santiago",
  },
  {
    number: 2906, date: "2026-03-09", customer: "SANTIAGO MARINO", type: "retail",
    is_internal: true,
    items: [{ sku: "BLOW013", qty: 1, unit_price_usd: 0 }],
    note: "SANTY USO PERSONAL",
  },
  {
    number: 2907, date: "2026-03-09", customer: "DIEGO IL LUPO", type: "wholesale",
    items: [
      { sku: "BLOW017",  qty: 1, unit_price_usd: 30 },
      { sku: "BLOW013",  qty: 1, unit_price_usd: 30 },
      { sku: "IGN30003", qty: 1, unit_price_usd: 13.35 },
      { sku: "IGN30007", qty: 1, unit_price_usd: 13.35 },
    ],
    payment_usd: 99.30, caja_usd: "Santiago",
    note: "DIEGO IL LUPO",
  },
];

// ─── MOVIMIENTOS DE CAJA EXTRA (gastos, cambios, etc.) ────────────────────────
type CashMovDef = {
  date: string; type: string; amount: number; currency: "ARS" | "USD";
  caja: string; note: string; category?: string;
};
const EXTRA_CASH_MOVEMENTS: CashMovDef[] = [
  // Salarios febrero (pagados el 2/3)
  { date: "2026-03-02", type: "manual_expense", amount: 3000000, currency: "ARS", caja: "Santiago", note: "Salario Luciano - Febrero 2026", category: "salarios" },
  { date: "2026-03-02", type: "manual_expense", amount: 3000000, currency: "ARS", caja: "Luciano",  note: "Salario Santiago - Febrero 2026", category: "salarios" },
  // Seña cartel
  { date: "2026-03-02", type: "manual_expense", amount: 50000, currency: "ARS", caja: "Santiago", note: "Seña cartel local", category: "marketing" },
  // Pago placas
  { date: "2026-03-03", type: "manual_expense", amount: 270300, currency: "ARS", caja: "Efectivo", note: "Pago placas", category: "marketing" },
  // Compra pegamento
  { date: "2026-03-05", type: "manual_expense", amount: 6800, currency: "ARS", caja: "Santiago", note: "Compra pegamento", category: "insumos" },
  // Otros egresos USD
  { date: "2026-03-05", type: "manual_expense", amount: 222, currency: "USD", caja: "Santiago", note: "Otros egresos USD 05/03", category: "varios" },
  { date: "2026-03-04", type: "manual_expense", amount: 3.4, currency: "USD", caja: "Santiago", note: "Otros egresos USD 04/03", category: "varios" },
  // Moto equivocación Giuliana
  { date: "2026-03-04", type: "manual_expense", amount: 5000, currency: "ARS", caja: "Efectivo", note: "Moto equivocación Giuliana", category: "logistica" },
  // Pagos pedidos (compras)
  { date: "2026-03-06", type: "purchase_expense", amount: 1000,   currency: "USD", caja: "Santiago", note: "Pago Pedido #170 - GIULIANO (gummies)", category: "compras" },
  { date: "2026-03-06", type: "purchase_expense", amount: 4607.5, currency: "USD", caja: "Luciano",  note: "Pago Pedido #171 - WOV (en camino)", category: "compras" },
  // Cambios ARS→USD (03/03)
  { date: "2026-03-02", type: "ajuste_out", amount: 300000, currency: "ARS", caja: "Santiago", note: "Cambio ARS→USD 02/03", category: "cambio" },
  { date: "2026-03-02", type: "ajuste_in",  amount: 206,    currency: "USD", caja: "Santiago", note: "Cambio ARS→USD 02/03", category: "cambio" },
  // Cambio ARS→USD 06/03
  { date: "2026-03-06", type: "ajuste_out", amount: 916500, currency: "ARS", caja: "Santiago", note: "Cambio ARS→USD 06/03 (650 USD)", category: "cambio" },
  { date: "2026-03-06", type: "ajuste_in",  amount: 650,    currency: "USD", caja: "Santiago", note: "Cambio ARS→USD 06/03 (650 USD)", category: "cambio" },
];

// ─── DEUDAS (A COBRAR / A PAGAR) ──────────────────────────────────────────────
const DEBTS = [
  { entity_name: "LU", type: "receivable" as const, currency: "USD" as const, original_amount: 289, note: "LU DEBE 289 USD - Pedido #2877", date: "2026-03-03" },
  { entity_name: "BLAS", type: "receivable" as const, currency: "USD" as const, original_amount: 376.5, note: "BLAS DEBE 376.50 USD", date: "2026-03-03" },
  { entity_name: "FRAN BALOGH", type: "payable" as const, currency: "USD" as const, original_amount: 5, note: "FRAN BALOGH TIENE 5 USD A FAVOR - Pedido #2886", date: "2026-03-04" },
];

// ─── LÓGICA PRINCIPAL ──────────────────────────────────────────────────────────

async function run() {
  console.log("=== CARGA MARZO 2026 ===\n");

  // 1. Obtener todos los productos existentes por SKU
  console.log("1. Verificando productos en DB...");
  const { data: existingProds, error: prodErr } = await supabase.from("products").select("id, sku, name");
  if (prodErr) { console.error("ERROR al leer products:", prodErr); process.exit(1); }

  const skuToId: Record<string, string> = {};
  for (const p of existingProds || []) {
    if (p.sku) skuToId[p.sku.toUpperCase()] = p.id;
  }
  console.log(`   → ${Object.keys(skuToId).length} productos existentes en DB`);

  // 2. Crear productos faltantes
  console.log("\n2. Verificando productos faltantes...");
  const allSkusNeeded = new Set<string>();

  for (const o of ORDERS) for (const i of o.items) allSkusNeeded.add(i.sku.toUpperCase());
  for (const p of PURCHASES) for (const i of p.items) allSkusNeeded.add(i.sku.toUpperCase());

  const missingSkus = [...allSkusNeeded].filter(s => !skuToId[s]);
  const missingWithData = missingSkus.filter(s => PRODUCTS_TO_UPSERT[s]);
  const missingUnknown = missingSkus.filter(s => !PRODUCTS_TO_UPSERT[s]);

  if (missingUnknown.length > 0) {
    console.log(`   ⚠️  SKUs sin datos definidos (se omitirán): ${missingUnknown.join(", ")}`);
  }

  let createdCount = 0;
  for (const sku of missingWithData) {
    const pd = PRODUCTS_TO_UPSERT[sku];
    const slug = sku.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const { data: newProd, error: createErr } = await supabase.from("products").insert({
      sku,
      slug,
      name: pd.name,
      brand: pd.brand,
      model: pd.model,
      flavor: pd.flavor,
      category: pd.category,
      cost_price: pd.cost_price,
      price_min_ars: 0,
      price_may_x15: pd.price_may_x15,
      price_may_x50: 0,
      price_may_x100: 0,
      stock_actual: 0,
      stock_reservado: 0,
      visible: false,
      divided: pd.divided || false,
      units_per_pack: pd.units_per_pack || 1,
    }).select("id").single();

    if (createErr) {
      console.log(`   ✗ Error creando ${sku}: ${createErr.message}`);
    } else if (newProd) {
      skuToId[sku] = newProd.id;
      createdCount++;
      console.log(`   + Creado: ${sku} → ${pd.name}`);
    }
  }
  console.log(`   → ${createdCount} productos creados`);

  // 3. Insertar Compras
  console.log("\n3. Insertando compras...");
  for (const pur of PURCHASES) {
    const total = pur.items.reduce((s, i) => s + (i.qty * i.unit_cost), 0);

    const { data: purData, error: purErr } = await supabase.from("purchases").insert({
      number: pur.number,
      supplier: pur.supplier,
      currency: pur.currency,
      total,
      paid_amount: pur.paid_amount_usd,
      payment_status: pur.payment_status,
      status: pur.received_at ? "received" : "ordered",
      created_at: new Date(`${pur.ordered_at}T12:00:00`).toISOString(),
      notes: `Pedido ${pur.number} - ${pur.supplier}`,
    }).select("id").single();

    if (purErr) {
      console.log(`   ✗ Error compra #${pur.number}: ${purErr.message}`);
      continue;
    }

    // Items de la compra
    const itemsToInsert = pur.items
      .filter(i => skuToId[i.sku.toUpperCase()])
      .map(i => ({
        purchase_id: purData!.id,
        product_id: skuToId[i.sku.toUpperCase()],
        product_sku: i.sku.toUpperCase(),
        qty: i.qty,
        unit_cost: i.unit_cost,
        subtotal: i.qty * i.unit_cost,
      }));

    if (itemsToInsert.length > 0) {
      const { error: itemsErr } = await supabase.from("purchase_items").insert(itemsToInsert);
      if (itemsErr) console.log(`   ✗ Error items compra #${pur.number}: ${itemsErr.message}`);
    }

    console.log(`   ✓ Compra #${pur.number} (${pur.supplier}) — $${total.toFixed(2)} USD — status: ${pur.payment_status}`);
  }

  // 4. Insertar Pedidos (órdenes de venta)
  console.log("\n4. Insertando pedidos de venta...");
  let ordersOk = 0;
  let totalSaleUsd = 0;

  for (const ord of ORDERS) {
    // Calcular total
    const totalUsd = ord.items.reduce((s, i) => s + i.qty * i.unit_price_usd, 0);
    // Para retail: convertir a ARS usando el pago real o FX por defecto
    let orderTotal: number;
    if (ord.type === "wholesale") {
      orderTotal = totalUsd; // USD
    } else {
      orderTotal = ord.payment_ars || Math.round(totalUsd * FX_DEFAULT);
    }

    const confirmedAt = new Date(`${ord.date}T14:00:00`).toISOString();

    const { data: orderData, error: orderErr } = await supabase.from("orders").insert({
      number: ord.number,
      type: ord.type,
      customer_name: ord.customer,
      customer_phone: "",
      customer_address: "",
      notes: ord.note || "",
      total: orderTotal,
      status: "confirmed",
      payment_status: ord.is_internal ? "paid" : "paid",
      payment_method: ord.payment_usd ? "usdt" : "efectivo",
      confirmed_at: confirmedAt,
      created_at: confirmedAt,
    }).select("id").single();

    if (orderErr) {
      console.log(`   ✗ Error pedido #${ord.number}: ${orderErr.message}`);
      continue;
    }

    // Items del pedido
    const itemsToInsert = ord.items
      .filter(i => skuToId[i.sku.toUpperCase()])
      .map(i => {
        const unitPrice = ord.type === "wholesale"
          ? i.unit_price_usd
          : (ord.payment_ars && totalUsd > 0 ? (ord.payment_ars / totalUsd) * i.unit_price_usd : i.unit_price_usd * FX_DEFAULT);
        return {
          order_id: orderData!.id,
          product_id: skuToId[i.sku.toUpperCase()],
          product_name: (existingProds?.find(p => p.sku?.toUpperCase() === i.sku.toUpperCase()) || PRODUCTS_TO_UPSERT[i.sku.toUpperCase()])
            ? (existingProds?.find(p => p.sku?.toUpperCase() === i.sku.toUpperCase())?.name || PRODUCTS_TO_UPSERT[i.sku.toUpperCase()]?.name || i.sku)
            : i.sku,
          product_sku: i.sku.toUpperCase(),
          qty: i.qty,
          unit_price: unitPrice,
          subtotal: i.qty * unitPrice,
        };
      });

    if (itemsToInsert.length > 0) {
      const { error: itmErr } = await supabase.from("order_items").insert(itemsToInsert);
      if (itmErr) console.log(`   ✗ Error items pedido #${ord.number}: ${itmErr.message}`);
    }

    // Movimiento de caja (sale_income) — solo si no es interno
    if (!ord.is_internal) {
      if (ord.payment_ars && ord.caja_ars) {
        const { error: cmErr } = await supabase.from("cash_movements").insert({
          type: "sale_income",
          amount: ord.payment_ars,
          currency: "ARS",
          caja: ord.caja_ars,
          note: `Pedido #${ord.number} - ${ord.customer}`,
          category: "ventas",
          created_at: confirmedAt,
        });
        if (cmErr) console.log(`   ✗ Error cash_movement ARS #${ord.number}: ${cmErr.message}`);
      }
      if (ord.payment_usd && ord.caja_usd) {
        const { error: cmErr } = await supabase.from("cash_movements").insert({
          type: "sale_income",
          amount: ord.payment_usd,
          currency: "USD",
          caja: ord.caja_usd,
          note: `Pedido #${ord.number} - ${ord.customer}`,
          category: "ventas",
          created_at: confirmedAt,
        });
        if (cmErr) console.log(`   ✗ Error cash_movement USD #${ord.number}: ${cmErr.message}`);
      }
    }

    totalSaleUsd += totalUsd;
    ordersOk++;
    const payStr = ord.payment_ars
      ? `$${(ord.payment_ars / 1000).toFixed(0)}K ARS`
      : `$${ord.payment_usd} USD`;
    console.log(`   ✓ #${ord.number} ${ord.customer.padEnd(22)} ${ord.type === "wholesale" ? "MAY" : "MIN"} $${totalUsd.toFixed(0)} USD → ${payStr}`);
  }
  console.log(`\n   → ${ordersOk} pedidos cargados (total ventas: $${totalSaleUsd.toFixed(2)} USD)`);

  // 5. Movimientos de caja extra (gastos, cambios)
  console.log("\n5. Insertando movimientos de caja extra...");
  for (const cm of EXTRA_CASH_MOVEMENTS) {
    const { error } = await supabase.from("cash_movements").insert({
      type: cm.type,
      amount: cm.amount,
      currency: cm.currency,
      caja: cm.caja,
      note: cm.note,
      category: cm.category || "varios",
      created_at: new Date(`${cm.date}T10:00:00`).toISOString(),
    });
    if (error) console.log(`   ✗ Error: ${cm.note}: ${error.message}`);
    else console.log(`   ✓ ${cm.type === "manual_expense" || cm.type === "purchase_expense" ? "↓" : "↑"} ${cm.note} → ${cm.currency} ${cm.amount.toLocaleString()}`);
  }

  // 6. Deudas
  console.log("\n6. Insertando deudas...");
  for (const d of DEBTS) {
    const { error } = await supabase.from("debts").insert({
      entity_name: d.entity_name,
      type: d.type,
      currency: d.currency,
      original_amount: d.original_amount,
      paid_amount: 0,
      status: "pending",
      note: d.note,
      created_at: new Date(`${d.date}T12:00:00`).toISOString(),
    });
    if (error) console.log(`   ✗ Error deuda ${d.entity_name}: ${error.message}`);
    else console.log(`   ✓ ${d.type === "receivable" ? "A COBRAR" : "A PAGAR"}: ${d.entity_name} $${d.original_amount} ${d.currency}`);
  }

  console.log("\n=== CARGA COMPLETA ===");
}

run().catch(console.error);
