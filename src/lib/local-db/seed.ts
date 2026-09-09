import type { Product, Customer } from "./types";

const base = { cost_price: 0, units_per_pack: 1, stock_reservado: 0, image: "", visible: true, created_at: new Date().toISOString() };

export const SEED_PRODUCTS: Product[] = [
  { ...base, id: "p1", sku: "FF-PROT-CHOC", brand: "FuelFit", model: "Whey Protein", flavor: "Chocolate", slug: "ff-whey-protein-chocolate", name: "Whey Protein Chocolate", category: "suplementos", price_min_ars: 25000, price_may_x15: 18, price_may_x50: 16, price_may_x100: 14, stock_actual: 50 },
  { ...base, id: "p2", sku: "FF-PROT-VAN", brand: "FuelFit", model: "Whey Protein", flavor: "Vainilla", slug: "ff-whey-protein-vainilla", name: "Whey Protein Vainilla", category: "suplementos", price_min_ars: 25000, price_may_x15: 18, price_may_x50: 16, price_may_x100: 14, stock_actual: 30 },
  { ...base, id: "p3", sku: "FF-CREAT-NAT", brand: "FuelFit", model: "Creatina Monohidrato", flavor: "Natural", slug: "ff-creatina-monohidrato", name: "Creatina Monohidrato 300g", category: "suplementos", price_min_ars: 18000, price_may_x15: 12, price_may_x50: 11, price_may_x100: 10, stock_actual: 80 },
  { ...base, id: "p4", sku: "FF-PRE-TROPIC", brand: "FuelFit", model: "Pre-Workout", flavor: "Tropical", slug: "ff-preworkout-tropical", name: "Pre-Workout Tropical", category: "suplementos", price_min_ars: 22000, price_may_x15: 15, price_may_x50: 13, price_may_x100: 12, stock_actual: 40 },
  { ...base, id: "p5", sku: "FF-ROPA-SHORT-M", brand: "FuelFit", model: "Short Dry-Fit", flavor: "M", slug: "ff-short-dry-fit-m", name: "Short Dry-Fit Talle M", category: "ropa", price_min_ars: 15000, price_may_x15: 10, price_may_x50: 9, price_may_x100: 8, stock_actual: 25 },
  { ...base, id: "p6", sku: "FF-ROPA-REMES-L", brand: "FuelFit", model: "Remera Entrenamiento", flavor: "L", slug: "ff-remera-entrenamiento-l", name: "Remera Entrenamiento Talle L", category: "ropa", price_min_ars: 12000, price_may_x15: 8, price_may_x50: 7, price_may_x100: 6, stock_actual: 35 },
  { ...base, id: "p7", sku: "FF-ACC-SHAKER", brand: "FuelFit", model: "Shaker 700ml", flavor: "", slug: "ff-shaker-700ml", name: "Shaker 700ml", category: "accesorios", price_min_ars: 8000, price_may_x15: 5, price_may_x50: 4.5, price_may_x100: 4, stock_actual: 100 },
  { ...base, id: "p8", sku: "FF-ACC-GUANTES", brand: "FuelFit", model: "Guantes Gym", flavor: "", slug: "ff-guantes-gym", name: "Guantes de Gym", category: "accesorios", price_min_ars: 10000, price_may_x15: 7, price_may_x50: 6, price_may_x100: 5.5, stock_actual: 60 },
];

export const SEED_CUSTOMERS: Customer[] = [];
