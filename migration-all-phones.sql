-- Agregar columna all_phones a la tabla customers
-- Ejecutar en Supabase Dashboard > SQL Editor

ALTER TABLE customers ADD COLUMN IF NOT EXISTS all_phones text[] DEFAULT '{}';
