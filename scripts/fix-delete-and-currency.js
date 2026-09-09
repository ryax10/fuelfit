require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const IDS_TO_DELETE = [
  '42816178-3a76-42f8-82ba-e017559afc46', // Salario Febrero - Santiago
  'fa704064-7a77-41cc-9f61-7cc516e18fb4', // Salario Febrero - Luciano
  'f6d0832d-1075-4dbc-9a08-ca19ed2d2ea5', // Salario Santiago - Febrero 2026
  'bfcf123c-f051-4776-9193-bd6e4201d1ba', // Salario Luciano - Febrero 2026
  '6cc0a2c9-5cd3-4a27-83b3-dbea80f54d57', // Otros egresos USD 04/03
  '1a1f605c-8f00-48d1-926a-2c2cfdd1926f', // Otros egresos USD 05/03
];

async function run() {
  // 1. Eliminar los 6 registros
  const { error: delErr } = await s.from('cash_movements').delete().in('id', IDS_TO_DELETE);
  if (delErr) { console.error('Error eliminando:', delErr.message); process.exit(1); }
  console.log(`🗑️  Eliminados ${IDS_TO_DELETE.length} movimientos.`);

  // 2. Buscar movimientos de tipo sale_income en USD que corresponden a órdenes retail
  const { data: usdSales } = await s
    .from('cash_movements')
    .select('id, caja, amount, note, order_id, currency, type')
    .eq('type', 'sale_income')
    .eq('currency', 'USD');

  console.log(`\nMovimientos sale_income en USD: ${usdSales?.length || 0}`);

  // 3. Para cada uno, ver si la orden asociada es retail
  const toFix = [];
  for (const m of (usdSales || [])) {
    if (!m.order_id) { console.log(`  Sin order_id: ${m.note}`); continue; }
    const { data: order } = await s.from('orders').select('id, type, number, customer_name').eq('id', m.order_id).single();
    if (!order) continue;
    if (order.type === 'retail') {
      toFix.push({ id: m.id, amount: m.amount, note: m.note, customer: order.customer_name, orderNum: order.number });
    } else {
      console.log(`  ✓ Mayorista OK: #${order.number} ${order.customer_name} USD ${m.amount}`);
    }
  }

  if (toFix.length === 0) { console.log('\nNo hay minoristas con USD.'); return; }

  console.log(`\nMinoristas con cobro en USD (a corregir a ARS):`);
  for (const m of toFix) console.log(`  [${m.id}] Pedido #${m.orderNum} ${m.customer} USD ${m.amount}`);

  // 4. Actualizar currency a ARS
  const ids = toFix.map(m => m.id);
  const { error: updErr } = await s.from('cash_movements').update({ currency: 'ARS' }).in('id', ids);
  if (updErr) { console.error('Error actualizando:', updErr.message); process.exit(1); }
  console.log(`\n✅ Corregidos ${ids.length} movimientos de USD → ARS.`);
}

run().catch(console.error);
