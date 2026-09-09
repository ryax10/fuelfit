-- ============================================================
-- FUELFIT — Schema de base de datos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL DEFAULT '',
  flavor text NOT NULL DEFAULT '',
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'suplementos' CHECK (category IN ('suplementos', 'ropa', 'accesorios')),
  price_min_ars numeric NOT NULL DEFAULT 0,
  price_may_x15 numeric NOT NULL DEFAULT 0,
  price_may_x50 numeric NOT NULL DEFAULT 0,
  price_may_x100 numeric NOT NULL DEFAULT 0,
  stock_actual integer NOT NULL DEFAULT 0,
  stock_reservado integer NOT NULL DEFAULT 0,
  image text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Migración: unidades por envase (para productos vendidos por pieza desde un frasco/pack)
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_pack integer NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_sale_options jsonb DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- Categoría correcta para bolsas de nicotina QIT
-- UPDATE products SET category = 'nicotina' WHERE brand ILIKE '%QIT%';

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL DEFAULT '',
  zone text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'retail' CHECK (type IN ('retail', 'wholesale')),
  code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected', 'blocked')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  last_purchase timestamptz,
  previous_purchase timestamptz,
  total_orders integer NOT NULL DEFAULT 0,
  has_duplicate_warning boolean NOT NULL DEFAULT false,
  duplicate_names text[] NOT NULL DEFAULT '{}',
  all_phones text[] NOT NULL DEFAULT '{}'
);

-- Secuencia para numeración de pedidos
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number integer NOT NULL DEFAULT nextval('order_number_seq'),
  type text NOT NULL DEFAULT 'retail' CHECK (type IN ('retail', 'wholesale')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  payment_method text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES customers(id),
  notes text NOT NULL DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  confirmed_at timestamptz
);

-- Tabla de ítems de pedido
CREATE TABLE IF NOT EXISTS order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  product_sku text NOT NULL,
  qty integer NOT NULL,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL
);

-- Tabla de movimientos de inventario
-- NOTA: purchase_id se agrega como FK después de crear la tabla purchases (ver ALTER TABLE más abajo)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id),
  product_sku text NOT NULL,
  type text NOT NULL CHECK (type IN ('ingreso', 'egreso', 'reserva', 'liberacion', 'ajuste_positivo', 'ajuste_negativo')),
  qty integer NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  order_id uuid REFERENCES orders(id),
  purchase_id uuid,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Tabla de movimientos de caja
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('sale_income', 'manual_income', 'manual_expense', 'purchase_expense', 'refund', 'ajuste_in', 'ajuste_out')),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  caja text NOT NULL,
  category text NOT NULL DEFAULT '',
  order_id uuid REFERENCES orders(id),
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Secuencia para numeración de compras
CREATE SEQUENCE IF NOT EXISTS purchase_number_seq START WITH 1001;

-- Tabla de compras a proveedores
CREATE TABLE IF NOT EXISTS purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number integer NOT NULL DEFAULT nextval('purchase_number_seq'),
  supplier text NOT NULL,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('ARS', 'USD')),
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'received', 'paid', 'cancelled')),
  paid_amount numeric NOT NULL DEFAULT 0,
  caja text NOT NULL DEFAULT 'Oficina',
  note text NOT NULL DEFAULT '',
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- FK diferida: inventory_movements → purchases (purchases se define después)
ALTER TABLE inventory_movements
  ADD CONSTRAINT IF NOT EXISTS inventory_movements_purchase_id_fkey
  FOREIGN KEY (purchase_id) REFERENCES purchases(id);

-- Items de compra (base del FIFO)
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_sku text NOT NULL,
  product_name text NOT NULL,
  qty integer NOT NULL,
  unit_cost numeric NOT NULL,
  subtotal numeric NOT NULL
);

-- Deudas (generadas automáticamente desde ventas y compras con pago parcial/pendiente)
CREATE TABLE IF NOT EXISTS debts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('receivable', 'payable')),
  entity_name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'customer',
  entity_id uuid,
  original_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ARS',
  paid_amount numeric NOT NULL DEFAULT 0,
  order_id uuid REFERENCES orders(id),
  purchase_id uuid REFERENCES purchases(id),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Pagos sobre deudas (impactan en caja)
CREATE TABLE IF NOT EXISTS debt_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id uuid NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  caja text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Snapshots de balance mensual (automáticos el 01 de cada mes)
CREATE TABLE IF NOT EXISTS balance_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period text NOT NULL UNIQUE,
  cash_ars numeric NOT NULL DEFAULT 0,
  cash_usd numeric NOT NULL DEFAULT 0,
  cash_usdt numeric NOT NULL DEFAULT 0,
  inventory_cost_usd numeric NOT NULL DEFAULT 0,
  inventory_value_ars numeric NOT NULL DEFAULT 0,
  total_sales_ars numeric NOT NULL DEFAULT 0,
  total_sales_usd numeric NOT NULL DEFAULT 0,
  total_expenses_ars numeric NOT NULL DEFAULT 0,
  total_expenses_usd numeric NOT NULL DEFAULT 0,
  total_purchases_usd numeric NOT NULL DEFAULT 0,
  receivable_ars numeric NOT NULL DEFAULT 0,
  receivable_usd numeric NOT NULL DEFAULT 0,
  payable_ars numeric NOT NULL DEFAULT 0,
  payable_usd numeric NOT NULL DEFAULT 0,
  active_products integer NOT NULL DEFAULT 0,
  total_stock integer NOT NULL DEFAULT 0,
  fx_usdt_ars numeric NOT NULL DEFAULT 1000,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- FX diario (tipo de cambio ARS/USD por día)
CREATE TABLE IF NOT EXISTS daily_fx (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date UNIQUE NOT NULL,
  buy_price numeric NOT NULL,
  sell_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Configuración del negocio (key-value)
CREATE TABLE IF NOT EXISTS config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Valores por defecto de configuración
INSERT INTO config (key, value) VALUES
  ('business_name', 'FuelFit'),
  ('whatsapp', ''),
  ('instagram', '@fuelfit'),
  ('horario', 'Lunes a Sábados 10 a 18 hs'),
  ('fx_usdt_ars', '1000'),
  ('stock_alert_threshold', '10'),
  ('tienda_enabled', 'true'),
  ('wholesale_min_qty', '15'),
  ('address', ''),
  ('email', '')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Products: anon puede leer productos visibles (para la tienda pública)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_visible_products" ON products
  FOR SELECT TO anon USING (visible = true);

-- El resto solo accesible por service_role (server actions admin)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
-- Migración: Balance General con patrimonio neto
ALTER TABLE balance_snapshots ADD COLUMN IF NOT EXISTS stock_value_usd NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE balance_snapshots ADD COLUMN IF NOT EXISTS in_transit_value_usd NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE balance_snapshots ADD COLUMN IF NOT EXISTS patrimonio_neto_usd NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE balance_snapshots ADD COLUMN IF NOT EXISTS snapshot_date TEXT NOT NULL DEFAULT '';

ALTER TABLE balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_fx ENABLE ROW LEVEL SECURITY;

-- NOTA: service_role bypasea RLS automáticamente.
-- Las server actions del admin usan service_role key.

-- ============================================================
-- STORAGE — Bucket para imágenes de productos
-- ============================================================
-- Ejecutar esto en el SQL Editor para crear el bucket:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
-- CREATE POLICY "anon_read_product_images" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'product-images');
-- CREATE POLICY "service_upload_product_images" ON storage.objects FOR INSERT TO authenticated USING (bucket_id = 'product-images');
-- O bien: ir a Storage > Create bucket > "product-images" > Public

-- ============================================================
-- MIGRACIONES ADICIONALES (ejecutar en Supabase Dashboard)
-- ============================================================

-- Migración: agregar tipos ajuste_in y ajuste_out a cash_movements
ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_type_check;
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_type_check
  CHECK (type IN ('sale_income', 'manual_income', 'manual_expense', 'purchase_expense', 'refund', 'ajuste_in', 'ajuste_out'));

-- Migración: costo unitario de producto (para COGS y balance de inventario)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;

-- Migración: fecha de recepción de mercadería en compras
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS received_at timestamptz;

-- Migración: sistema de división de productos en unidades
ALTER TABLE products ADD COLUMN IF NOT EXISTS divided boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_tiers jsonb DEFAULT NULL;
-- unit_tiers formato: [{"qty": 1, "price": 10000}, {"qty": 2, "price": 18000}, {"qty": 5, "price": 35000}]

-- Tabla de códigos de descuento (uso único, solo tienda mayorista)
CREATE TABLE IF NOT EXISTS discount_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('ARS', 'USD')),
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  used_by_order uuid REFERENCES orders(id),
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
-- Solo service_role puede leer/escribir (admin via server actions)

-- Alertas de stock por marca/modelo/sabor
CREATE TABLE IF NOT EXISTS stock_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand text,
  model text,
  flavor text,
  threshold int NOT NULL DEFAULT 3,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
-- Solo service_role puede leer/escribir

-- Stock inicial: Torch Sour Blue Razz (divided=true, 33 unidades individuales)
-- UPDATE products SET stock_actual = 33 WHERE brand ILIKE '%torch%' AND flavor ILIKE '%sour blue razz%';

-- ─── Audit log + edición de movimientos / pedidos / deudas ──────
-- Registro genérico de ediciones para no perder trazabilidad.
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL,           -- 'cash_movement' | 'order' | 'debt'
  target_id uuid NOT NULL,
  action text NOT NULL,                -- 'edit' | 'void' | 'payment' | ...
  before_json jsonb,
  after_json jsonb,
  reason text NOT NULL DEFAULT '',
  actor text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_target_idx
  ON audit_logs(target_type, target_id, created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Anulación + vínculo a debt_payment para revertir cobros automáticamente
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false;
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS voided_reason text;
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS debt_payment_id uuid REFERENCES debt_payments(id);

-- Descuento aplicado al pedido + recargo opcional (en moneda del pedido)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_currency text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharge_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharge_note text NOT NULL DEFAULT '';

-- Pago de deuda en moneda distinta (FX dual): el cash_movement guarda la moneda recibida
-- y el debt_payment guarda el monto convertido + el FX usado.
ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS payment_currency text;
ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS payment_amount numeric;
ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS fx_rate_used numeric;
