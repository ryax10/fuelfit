require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET = {
  luciano: { usd: -2381.72, ars: 470004.39 },
  santiago: { usd: -1538.75, ars: 1684374.45 },
  oficina:  { usd: 0,        ars: 111000.00  },
};

async function run() {
  // 1. Eliminar los 5 ajustes previos
  const { data: toDelete } = await supabase
    .from('cash_movements')
    .select('id, note')
    .ilike('note', 'Corrección de saldo%');

  if (toDelete && toDelete.length > 0) {
    const ids = toDelete.map(r => r.id);
    const { error: delErr } = await supabase
      .from('cash_movements')
      .delete()
      .in('id', ids);
    if (delErr) { console.error('Error eliminando:', delErr.message); process.exit(1); }
    console.log(`🗑️  Eliminados ${ids.length} movimientos previos.`);
  }

  // 2. Calcular saldos actuales (sin los ajustes eliminados)
  const { data: movements } = await supabase
    .from('cash_movements')
    .select('caja, currency, amount, type');

  const balances = {};
  for (const m of (movements || [])) {
    const k = m.caja ? m.caja.toLowerCase() : null;
    if (!k) continue;
    if (!balances[k]) balances[k] = { usd: 0, ars: 0 };
    const c = m.currency && m.currency.toLowerCase() === 'usd' ? 'usd' : 'ars';
    const out = ['manual_expense','purchase_expense','ajuste_out'].includes(m.type);
    balances[k][c] += out ? -m.amount : m.amount;
  }
  console.log('Saldos actuales (sin ajustes previos):');
  for (const [k, v] of Object.entries(balances)) {
    console.log(`  ${k}: USD ${v.usd.toFixed(2)} / ARS ${v.ars.toFixed(2)}`);
  }

  // 3. Insertar nuevos ajustes
  const adjustments = [];
  for (const [caja, target] of Object.entries(TARGET)) {
    const current = balances[caja] || { usd: 0, ars: 0 };
    for (const curr of ['usd', 'ars']) {
      const diff = target[curr] - current[curr];
      if (Math.abs(diff) < 0.01) continue;
      adjustments.push({
        caja,
        currency: curr.toUpperCase(),
        type: diff > 0 ? 'ajuste_in' : 'ajuste_out',
        amount: Math.abs(diff),
        note: `Ajuste saldo ${curr.toUpperCase()} — corrección inicial`,
        created_at: '2026-03-10T12:00:00.000Z',
      });
    }
  }

  if (adjustments.length === 0) {
    console.log('No se necesitan ajustes.');
    return;
  }

  const { error: insertErr } = await supabase.from('cash_movements').insert(adjustments);
  if (insertErr) { console.error('Error insertando:', insertErr.message); process.exit(1); }

  console.log(`\n✅ Insertados ${adjustments.length} ajustes correctivos.`);

  // 4. Verificar resultado final
  const { data: final } = await supabase.from('cash_movements').select('caja, currency, amount, type');
  const fb = {};
  for (const m of (final || [])) {
    const k = m.caja ? m.caja.toLowerCase() : null;
    if (!k) continue;
    if (!fb[k]) fb[k] = { usd: 0, ars: 0 };
    const c = m.currency && m.currency.toLowerCase() === 'usd' ? 'usd' : 'ars';
    const out = ['manual_expense','purchase_expense','ajuste_out'].includes(m.type);
    fb[k][c] += out ? -m.amount : m.amount;
  }
  console.log('\nSaldos finales:');
  for (const [k, v] of Object.entries(fb)) {
    console.log(`  ${k}: USD ${v.usd.toFixed(2)} / ARS ${v.ars.toFixed(2)}`);
  }
}

run().catch(console.error);
