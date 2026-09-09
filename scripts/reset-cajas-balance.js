require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const cashSign = (type) =>
  ['sale_income', 'manual_income', 'ajuste_in'].includes(type) ? 1 : -1;

const TARGET = {
  'Santiago_ARS': 1806974.45,
  'Luciano_ARS':   560134.55,
  'Santiago_USD':  -3863.75,
  'Luciano_USD':   -2768.72,
  'Oficina_ARS':   219400,
  'Oficina_USD':   0,
};

async function run() {
  // 1. Eliminar ajustes anteriores de "saldo inicial" para no acumular
  const { error: delErr } = await sb.from('cash_movements')
    .delete()
    .eq('note', 'Ajuste saldo inicial');
  console.log('Limpieza ajustes previos:', delErr ? delErr.message : 'OK');

  // 2. Calcular saldos actuales
  const { data: movs } = await sb.from('cash_movements').select('caja, currency, amount, type');
  const current = {};
  for (const m of movs || []) {
    const caja = m.caja === 'Efectivo' ? 'Oficina' : m.caja;
    const key = caja + '_' + m.currency;
    if (!current[key]) current[key] = 0;
    current[key] += cashSign(m.type) * m.amount;
  }

  console.log('\nSaldos actuales:');
  Object.entries(current).sort().forEach(([k, v]) =>
    console.log(`  ${k}: ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
  );

  // 3. Renombrar Efectivo → Oficina si queda alguno
  await sb.from('cash_movements').update({ caja: 'Oficina' }).eq('caja', 'Efectivo');

  // 4. Insertar ajustes para llegar al target
  console.log('\nAplicando ajustes:');
  for (const [key, target] of Object.entries(TARGET)) {
    const [caja, currency] = key.split('_');
    const currentVal = current[key] || 0;
    const diff = Math.round((target - currentVal) * 100) / 100;

    if (Math.abs(diff) < 0.01) {
      console.log(`  ${key}: ya correcto (${target.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`);
      continue;
    }

    const type = diff > 0 ? 'ajuste_in' : 'ajuste_out';
    const amount = Math.abs(diff);

    const { error } = await sb.from('cash_movements').insert({
      type, amount, currency, caja,
      note: 'Ajuste saldo inicial',
      category: 'ajuste',
      created_at: '2026-03-01T00:00:00',
    });

    console.log(`  ${key}: ${currentVal.toFixed(2)} → ${target.toFixed(2)} (${type} ${amount.toFixed(2)}) | ${error ? error.message : 'OK'}`);
  }

  // 5. Verificación final
  const { data: movs2 } = await sb.from('cash_movements').select('caja, currency, amount, type');
  const final = {};
  for (const m of movs2 || []) {
    const key = m.caja + '_' + m.currency;
    if (!final[key]) final[key] = 0;
    final[key] += cashSign(m.type) * m.amount;
  }
  console.log('\nSaldos finales:');
  Object.entries(final).sort().forEach(([k, v]) =>
    console.log(`  ${k}: ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
  );
}

run().catch(console.error);
