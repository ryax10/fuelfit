require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Ver todos los pedidos de marzo con su tipo
  const { data: orders } = await s.from('orders')
    .select('id, number, type, customer_name, total, payment_method')
    .gte('number', 2869).lte('number', 2907)
    .order('number');

  console.log('Pedidos marzo 2026:');
  for (const o of (orders || [])) {
    console.log(`  #${o.number} [${o.type.toUpperCase()}] ${o.customer_name} — total: ${o.total}`);
  }

  // Ver movimientos USD sin order_id
  const { data: noLink } = await s.from('cash_movements')
    .select('id, caja, currency, amount, type, note, order_id')
    .eq('type', 'sale_income')
    .eq('currency', 'USD')
    .is('order_id', null);

  console.log('\nMovimientos USD sin order_id:');
  for (const m of (noLink || [])) {
    console.log(`  [${m.id}] ${m.caja} USD ${m.amount} — ${m.note}`);
  }
}
run().catch(console.error);
