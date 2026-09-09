import type { LocalDB } from "./types";
import { SEED_PRODUCTS, SEED_CUSTOMERS } from "./seed";

const DB_KEY = "fullvip_db";
const DB_VERSION = 4;

function defaultDB(): LocalDB {
  return {
    products: SEED_PRODUCTS,
    customers: SEED_CUSTOMERS,
    orders: [],
    order_items: [],
    inventory_movements: [],
    cash_movements: [],
    cart: [],
    cart_mayorista: [],
    order_counter: 1000,
  };
}

function load(): LocalDB {
  if (typeof window === "undefined") return defaultDB();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return init();
    const parsed = JSON.parse(raw);
    if (parsed._v !== DB_VERSION) return init();
    return parsed.data as LocalDB;
  } catch {
    return init();
  }
}

function init(): LocalDB {
  const db = defaultDB();
  save(db);
  return db;
}

function save(db: LocalDB) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DB_KEY, JSON.stringify({ _v: DB_VERSION, data: db }));
  window.dispatchEvent(new Event("fullvip-db-change"));
}

export function getDB(): LocalDB {
  return load();
}

export function updateDB(fn: (db: LocalDB) => void): LocalDB {
  const db = load();
  fn(db);
  save(db);
  return db;
}

export function resetDB(): LocalDB {
  const db = defaultDB();
  save(db);
  return db;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function nextOrderNumber(): number {
  const db = load();
  db.order_counter++;
  save(db);
  return db.order_counter;
}
