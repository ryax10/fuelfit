/**
 * fix-torchhul-units.js
 * TORCH HULK GUMMIES:
 *   - Todos los sabores EXCEPTO SOUR BLUE RAZZ:
 *       units_per_pack=1, stock=floor(stock/20), unit_sale_options=null
 *       (venta por frasco entero)
 *   - SOUR BLUE RAZZ (TORCHHUL-003):
 *       units_per_pack=20, stock queda en gummies, unit_sale_options x1/x2/x5
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SOUR_BLUE_RAZZ_SKU = 'TORCHHUL-003';

// Precios SOUR BLUE RAZZ por gummy individual
const SOUR_BLUE_OPTIONS = {
  options: [
    { qty: 1, price: 10000 },
    { qty: 2, price: 18000 },
    { qty: 5, price: 35000 },
  ]
};

async function run() {
  console.log('=== FIX TORCH HULK GUMMIES — unidades por frasco ===\n');

  const { data: products, error } = await sb
    .from('products')
    .select('id, sku, flavor, stock_actual, units_per_pack, unit_sale_options')
    .like('sku', 'TORCHHUL-%')
    .order('sku');

  if (error) { console.error(error.message); return; }

  for (const p of products) {
    const isSourBlue = p.sku === SOUR_BLUE_RAZZ_SKU;

    if (isSourBlue) {
      // Mantener units_per_pack=20, stock en gummies, agregar unit_sale_options
      const { error: uErr } = await sb.from('products').update({
        units_per_pack: 20,
        unit_sale_options: SOUR_BLUE_OPTIONS,
      }).eq('id', p.id);

      console.log(`  ${p.sku} ${p.flavor}: ${uErr ? '✗ ' + uErr.message : '✓ unidades x gummy, x1/x2/x5 configurado (stock=${p.stock_actual} gummies)'}`);
    } else {
      // Convertir: stock en frascos = floor(stock_actual / 20)
      const stockJars = Math.floor(p.stock_actual / 20);
      const { error: uErr } = await sb.from('products').update({
        units_per_pack: 1,
        stock_actual: stockJars,
        unit_sale_options: null,
      }).eq('id', p.id);

      const note = p.stock_actual % 20 > 0 ? ` (descartados ${p.stock_actual % 20} gummies sueltos)` : '';
      console.log(`  ${p.sku} ${p.flavor}: ${uErr ? '✗ ' + uErr.message : `✓ ${p.stock_actual} gummies → ${stockJars} frascos${note}`}`);
    }
  }

  console.log('\n=== LISTO ===');
}

run().catch(console.error);
