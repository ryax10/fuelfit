require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Montos correctos por número de pedido (ARS)
// null = no cobrado / pendiente → cambiar payment_status a 'pending'
const CORRECT = {
  2871: { customer: 'GABRIELA',           amount: 620000 },
  2872: { customer: 'VERONICA MALDONADO', amount: 29000 },
  2879: { customer: 'BELEN VELAZQUEZ',    amount: 29000 },
  2880: { customer: 'ABEL TROCHE',        amount: 18000 },
  2882: { customer: 'BRENDA',             amount: 29000 },
  2883: { customer: 'BRENDA',             amount: 58000 },
  2884: { customer: 'GIULI',              amount: 190000 },
  2887: { customer: 'MAXI AXION',         amount: 58000 },
  2888: { customer: 'YANI',              amount: 58000 },
  2889: { customer: 'ABEL TROCHE',        amount: 35000 },
  2890: { customer: 'BELLA',             amount: 29000 },
  2891: { customer: 'MORA',              amount: 55000 },
  2892: { customer: 'CATA',              amount: 29000 },
  2894: { customer: 'GUADALUPE',         amount: 27000 },
  2895: { customer: 'LU',               amount: 29000 },
  2896: { customer: 'SANTINO',           amount: 29000 },
  2897: { customer: 'CARLA',             amount: 29000 },
  2904: { customer: 'POLI BENITEZ',      amount: 31000 },
  2905: { customer: 'ALBERTO',           amount: 31000 },
  2908: { customer: 'SANTIAGO PEREYRA',  amount: 35000 },
  2909: { customer: 'SANTIAGO TESTA',    amount: 35000 },
  2910: { customer: 'JESICA DENCINGER',  amount: 29000 },
  2911: { customer: 'STEFANIA CHIARULLO',amount: 29000 },
  2914: { customer: 'BELLA',            amount: 70000 },
  2915: { customer: 'GUADALUPE',        amount: 29000 },
  2916: { customer: 'EMILIA',           amount: 29000 },
  2918: { customer: 'FRAN ANGLESE',     amount: 29000 },
  2919: { customer: 'TOBI VILA',        amount: 30000 },
  2920: { customer: 'JAZMIN',           amount: 58000 },
};

async function run() {
  console.log('=== CORREGIR TOTALES Y CASH MOVEMENTS RETAIL — Marzo 2026 ===\n');

  const { data: orders } = await sb.from('orders')
    .select('id, number, customer_name, total, payment_status, type')
    .eq('type', 'retail')
    .eq('status', 'confirmed')
    .gte('confirmed_at', '2026-03-01T00:00:00')
    .lte('confirmed_at', '2026-03-31T23:59:59')
    .order('number');

  for (const o of orders) {
    const correct = CORRECT[o.number];
    if (!correct) {
      console.log(`  #${o.number} ${o.customer_name} — sin datos correctos, skip`);
      continue;
    }

    const diff = Math.abs(o.total - correct.amount);
    if (diff < 1) {
      console.log(`  #${o.number} ${o.customer_name} — ✓ ya correcto (${o.total.toLocaleString()} ARS)`);
      continue;
    }

    // Actualizar order.total
    const { error: oErr } = await sb.from('orders').update({ total: correct.amount }).eq('id', o.id);

    // Actualizar cash_movement correspondiente
    const { data: cms } = await sb.from('cash_movements')
      .select('id, amount, currency')
      .eq('type', 'sale_income')
      .eq('currency', 'ARS')
      .ilike('note', `%#${o.number}%`);

    let cmStatus = 'sin movimiento';
    if (cms && cms.length > 0) {
      const { error: cmErr } = await sb.from('cash_movements').update({ amount: correct.amount }).eq('id', cms[0].id);
      cmStatus = cmErr ? cmErr.message : `cash_mov actualizado ${cms[0].amount} → ${correct.amount}`;
    }

    console.log(`  #${o.number} ${o.customer_name}: ${o.total.toLocaleString()} → ${correct.amount.toLocaleString()} ARS | ${oErr ? oErr.message : 'OK'} | ${cmStatus}`);
  }

  // Mostrar pedidos no incluidos en CORRECT (Fernando, Mel Barats, etc.)
  console.log('\n--- Pedidos retail no mapeados ---');
  for (const o of orders) {
    if (!CORRECT[o.number]) {
      console.log(`  #${o.number} ${o.customer_name} total=${o.total} status=${o.payment_status}`);
    }
  }
}

run().catch(console.error);
