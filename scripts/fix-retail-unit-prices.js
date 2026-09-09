/**
 * fix-retail-unit-prices.js
 * Los order_items de pedidos RETAIL de Marzo 2026 tienen unit_price en USD.
 * getProfitDataAction espera ARS para retail (divide por fxDay).
 * Fix: multiplicar unit_price * FX para todos los items de pedidos retail de Marzo 2026.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FX = 1459.98;

async function run() {
  console.log('=== FIX RETAIL UNIT PRICES — Marzo 2026 ===\n');

  // Obtener todos los pedidos retail de Marzo 2026
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, number, customer_name, total')
    .eq('type', 'retail')
    .eq('status', 'confirmed')
    .gte('confirmed_at', '2026-03-01T00:00:00')
    .lte('confirmed_at', '2026-03-31T23:59:59');

  if (oErr) { console.error('Error:', oErr.message); return; }
  console.log(`Pedidos retail encontrados: ${orders.length}`);

  let totalFixed = 0;

  for (const order of orders) {
    // Obtener items de este pedido
    const { data: items, error: iErr } = await supabase
      .from('order_items')
      .select('id, qty, unit_price, subtotal, product_name')
      .eq('order_id', order.id);

    if (iErr) { console.log(`  ✗ Items #${order.number}: ${iErr.message}`); continue; }
    if (!items || items.length === 0) continue;

    // Verificar si ya están en ARS (si unit_price > 1000, probablemente ya son ARS)
    const maxPrice = Math.max(...items.map(i => i.unit_price));
    if (maxPrice > 1000) {
      console.log(`  ⚠ #${order.number} ${order.customer_name} — ya en ARS (max=${maxPrice.toFixed(0)}), skip`);
      continue;
    }

    // Convertir: unit_price_ars = unit_price_usd * FX
    process.stdout.write(`  #${order.number} ${order.customer_name}: `);
    let ok = true;
    for (const item of items) {
      const newPrice = Math.round(item.unit_price * FX * 100) / 100;
      const newSubtotal = Math.round(newPrice * item.qty * 100) / 100;
      const { error: uErr } = await supabase
        .from('order_items')
        .update({ unit_price: newPrice, subtotal: newSubtotal })
        .eq('id', item.id);
      if (uErr) { console.log(`\n    ✗ item ${item.id}: ${uErr.message}`); ok = false; }
    }

    if (ok) {
      // También actualizar order.total a ARS (para retail, total debe ser en ARS)
      const newTotal = items.reduce((s, i) => s + Math.round(i.unit_price * FX * 100) / 100 * i.qty, 0);
      await supabase.from('orders').update({ total: Math.round(newTotal) }).eq('id', order.id);
      console.log(`✓ (${items.length} items, total=${Math.round(newTotal).toLocaleString()} ARS)`);
      totalFixed++;
    }
  }

  console.log(`\n=== LISTO — ${totalFixed}/${orders.length} pedidos actualizados ===`);

  // Verificar totales finales
  console.log('\n--- Verificación revenue esperado ---');
  const { data: allOrders } = await supabase
    .from('orders')
    .select('id, number, type, total, customer_name, order_items(qty, unit_price)')
    .eq('status', 'confirmed')
    .gte('confirmed_at', '2026-03-01T00:00:00')
    .lte('confirmed_at', '2026-03-31T23:59:59');

  let retailRevUSD = 0, wholesaleRevUSD = 0;
  for (const o of allOrders || []) {
    const items = o.order_items || [];
    if (o.type === 'retail') {
      // unit_price ahora en ARS → dividir por FX
      const rev = items.reduce((s, i) => s + i.unit_price * i.qty, 0) / FX;
      retailRevUSD += rev;
    } else {
      // unit_price en USD → directo
      const rev = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
      wholesaleRevUSD += rev;
    }
  }
  console.log(`  Retail revenue USD:    $${retailRevUSD.toFixed(2)}`);
  console.log(`  Wholesale revenue USD: $${wholesaleRevUSD.toFixed(2)}`);
  console.log(`  TOTAL revenue USD:     $${(retailRevUSD + wholesaleRevUSD).toFixed(2)}`);
  console.log(`  (xlsx esperado:        $8,503.90)`);
}

run().catch(console.error);
