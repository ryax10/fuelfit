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
  // 1. Buscar los duplicados en gastos operativos
  const { data: expenses } = await s
    .from('cash_movements')
    .select('id, caja, currency, amount, type, note, created_at')
    .in('type', ['manual_expense', 'purchase_expense'])
    .order('note').order('created_at');

  // Agrupar por nota y quedarse con los duplicados (todos menos el primero de cada nota)
  const seen = {};
  const toDelete = [];
  for (const m of (expenses || [])) {
    const key = m.note?.trim().toLowerCase();
    if (!key) continue;
    if (seen[key]) {
      toDelete.push({ id: m.id, note: m.note, amount: m.amount });
    } else {
      seen[key] = m.id;
    }
  }

  if (toDelete.length > 0) {
    console.log(`🗑️  Duplicados encontrados (${toDelete.length}):`);
    for (const d of toDelete) console.log(`   "${d.note}" — ${d.amount}`);
    const { error } = await s.from('cash_movements').delete().in('id', toDelete.map(d => d.id));
    if (error) { console.error('Error eliminando duplicados:', error.message); process.exit(1); }
    console.log(`✅ Eliminados ${toDelete.length} duplicados.\n`);
  } else {
    console.log('Sin duplicados encontrados.\n');
  }

  // 2. Eliminar ajustes correctivos previos
  const { data: prevAdj } = await s.from('cash_movements').select('id')
    .ilike('note', 'Ajuste saldo%');
  if (prevAdj && prevAdj.length > 0) {
    await s.from('cash_movements').delete().in('id', prevAdj.map(r => r.id));
    console.log(`🗑️  Eliminados ${prevAdj.length} ajustes anteriores.`);
  }

  // 3. Calcular saldos actuales
  const { data: all } = await s.from('cash_movements').select('caja, currency, amount, type');
  const b = {};
  for (const m of (all || [])) {
    if (!b[m.caja]) b[m.caja] = { usd: 0, ars: 0 };
    const c = m.currency === 'USD' ? 'usd' : 'ars';
    b[m.caja][c] += OUT.includes(m.type) ? -m.amount : m.amount;
  }
  console.log('Saldos actuales:');
  for (const k of ['Luciano','Santiago','Oficina']) {
    const v = b[k] || { usd: 0, ars: 0 };
    console.log(`  ${k}: USD ${v.usd.toFixed(2)} / ARS ${v.ars.toFixed(2)}`);
  }

  // 4. Insertar nuevos ajustes
  const adjustments = [];
  for (const [caja, target] of Object.entries(TARGET)) {
    const current = b[caja] || { usd: 0, ars: 0 };
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

  if (adjustments.length > 0) {
    const { error } = await s.from('cash_movements').insert(adjustments);
    if (error) { console.error('Error insertando ajustes:', error.message); process.exit(1); }
    console.log(`\n✅ Insertados ${adjustments.length} ajustes de caja.`);
  }

  // 5. Verificar
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
