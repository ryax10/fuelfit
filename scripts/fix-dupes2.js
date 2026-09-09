require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const OUT = ['manual_expense','purchase_expense','ajuste_out','refund'];

const TARGET = {
  'Luciano': { usd: -2381.72, ars: 470004.39 },
  'Santiago': { usd: -1538.75, ars: 1684374.45 },
  'Oficina':  { usd: 0,        ars: 111000.00  },
};

async function run() {
  // Eliminar los 2 duplicados restantes
  const ids = [
    '7ad501bf-8a82-499a-8272-0c738cc38f25', // "Seña cartel local" — duplicado de "Seña cartel"
    '98bbe1ce-e029-4a70-8858-7e094e894b93',  // "Moto - equivocación Giuliana" — duplicado
  ];
  const { error } = await s.from('cash_movements').delete().in('id', ids);
  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.log('🗑️  Eliminados 2 duplicados restantes.');

  // Eliminar ajustes previos y recalcular
  const { data: prevAdj } = await s.from('cash_movements').select('id').ilike('note', 'Ajuste saldo%');
  if (prevAdj?.length) {
    await s.from('cash_movements').delete().in('id', prevAdj.map(r => r.id));
    console.log(`🗑️  Eliminados ${prevAdj.length} ajustes anteriores.`);
  }

  const { data: all } = await s.from('cash_movements').select('caja, currency, amount, type');
  const b = {};
  for (const m of (all || [])) {
    if (!b[m.caja]) b[m.caja] = { usd: 0, ars: 0 };
    const c = m.currency === 'USD' ? 'usd' : 'ars';
    b[m.caja][c] += OUT.includes(m.type) ? -m.amount : m.amount;
  }

  const adjustments = [];
  for (const [caja, target] of Object.entries(TARGET)) {
    const current = b[caja] || { usd: 0, ars: 0 };
    for (const curr of ['usd', 'ars']) {
      const diff = target[curr] - current[curr];
      if (Math.abs(diff) < 0.01) continue;
      adjustments.push({
        caja, currency: curr.toUpperCase(),
        type: diff > 0 ? 'ajuste_in' : 'ajuste_out',
        amount: Math.abs(diff),
        note: `Ajuste saldo ${curr.toUpperCase()} — corrección inicial`,
        created_at: '2026-03-10T12:00:00.000Z',
      });
    }
  }

  if (adjustments.length) {
    const { error: e2 } = await s.from('cash_movements').insert(adjustments);
    if (e2) { console.error(e2.message); process.exit(1); }
  }

  // Verificar
  const { data: final } = await s.from('cash_movements').select('caja, currency, amount, type');
  const fb = {};
  for (const m of (final || [])) {
    if (!fb[m.caja]) fb[m.caja] = { usd: 0, ars: 0 };
    const c = m.currency === 'USD' ? 'usd' : 'ars';
    fb[m.caja][c] += OUT.includes(m.type) ? -m.amount : m.amount;
  }
  console.log('\nSaldos finales:');
  for (const k of ['Luciano','Santiago','Oficina']) {
    const v = fb[k] || { usd: 0, ars: 0 };
    console.log(`  ${k}: USD ${v.usd.toFixed(2)} / ARS ${v.ars.toFixed(2)}`);
  }
}

run().catch(console.error);
