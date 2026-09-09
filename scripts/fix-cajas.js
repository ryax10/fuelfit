require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Saldos objetivo
const TARGET = {
  luciano: { usd: -2381.72, ars: 470004.39 },
  santiago: { usd: -1538.75, ars: 1684374.45 },
  oficina: { usd: 0, ars: 111000.00 },
};

async function run() {
  // Calcular saldo actual por caja y moneda
  const { data: movements, error } = await supabase
    .from('cash_movements')
    .select('caja, currency, amount, type');

  if (error) { console.error(error.message); process.exit(1); }

  const balances = {};
  for (const m of (movements || [])) {
    const key = m.caja?.toLowerCase();
    if (!key) continue;
    if (!balances[key]) balances[key] = { usd: 0, ars: 0 };
    const curr = m.currency?.toLowerCase() === 'usd' ? 'usd' : 'ars';
    // ajuste_out y manual_expense y purchase_expense restan; el resto suma
    const outTypes = ['manual_expense', 'purchase_expense', 'ajuste_out'];
    if (outTypes.includes(m.type)) {
      balances[key][curr] -= m.amount;
    } else {
      balances[key][curr] += m.amount;
    }
  }

  console.log('Saldos actuales:');
  for (const [caja, bal] of Object.entries(balances)) {
    console.log(`  ${caja}: USD ${bal.usd.toFixed(2)} / ARS ${bal.ars.toFixed(2)}`);
  }

  // Calcular diferencias y generar ajustes
  const adjustments = [];
  for (const [caja, target] of Object.entries(TARGET)) {
    const current = balances[caja] || { usd: 0, ars: 0 };

    for (const curr of ['usd', 'ars']) {
      const diff = target[curr] - current[curr];
      if (Math.abs(diff) < 0.01) continue;

      const currency = curr.toUpperCase();
      const type = diff > 0 ? 'ajuste_in' : 'ajuste_out';
      const amount = Math.abs(diff);

      adjustments.push({
        caja,
        currency,
        type,
        amount,
        note: `Corrección de saldo ${currency} — ajuste manual`,
        created_at: '2026-03-10T12:00:00.000Z',
      });
      console.log(`  Ajuste ${caja} ${currency}: ${diff > 0 ? '+' : '-'}${amount.toFixed(2)} (${type})`);
    }
  }

  if (adjustments.length === 0) {
    console.log('No se necesitan ajustes.');
    return;
  }

  const { error: insertErr } = await supabase
    .from('cash_movements')
    .insert(adjustments);

  if (insertErr) {
    console.error('Error insertando ajustes:', insertErr.message);
    process.exit(1);
  }

  console.log(`\n✅ Insertados ${adjustments.length} ajustes de caja.`);
}

run().catch(console.error);
