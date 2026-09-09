require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Signo igual que el admin: sale_income, manual_income, ajuste_in = +1; resto = -1
const cashSign = (type) =>
  ['sale_income', 'manual_income', 'ajuste_in'].includes(type) ? 1 : -1;

// Saldos objetivo
const TARGET = {
  'Santiago_ARS': 1806974.45,
  'Luciano_ARS':   560134.55,
  'Santiago_USD':  -3863.75,
  'Luciano_USD':   -2768.72,
  'Oficina_ARS':   219400,
  'Oficina_USD':   0,
};

async function run() {
  console.log('=== AJUSTAR SALDOS DE CAJAS ===\n');

  // Calcular saldos actuales (incluyendo Efectivo → Oficina)
  const { data: movs } = await sb.from('cash_movements').select('caja, currency, amount, type');
  const current = {};
  for (const m of movs || []) {
    // Tratar "Efectivo" como "Oficina"
    const caja = m.caja === 'Efectivo' ? 'Oficina' : m.caja;
    const key = caja + '_' + m.currency;
    if (!current[key]) current[key] = 0;
    current[key] += cashSign(m.type) * m.amount;
  }

  console.log('Saldos actuales (Efectivo → Oficina):');
  Object.entries(current).sort().forEach(([k, v]) =>
    console.log(`  ${k}: ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
  );
  console.log('');

  // Renombrar todos los movimientos de "Efectivo" → "Oficina"
  const { error: renErr, count } = await sb.from('cash_movements')
    .update({ caja: 'Oficina' })
    .eq('caja', 'Efectivo');
  console.log(`Renombrar Efectivo → Oficina: ${renErr ? renErr.message : (count ?? '?') + ' filas'}`);

  // Calcular y aplicar ajustes
  const AT = '2026-03-01T00:00:00'; // Fecha de inicio (ajuste de apertura)
  let inserted = 0;

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
      type,
      amount,
      currency,
      caja,
      note: 'Ajuste saldo inicial',
      category: 'ajuste',
      created_at: AT,
    });

    console.log(
      `  ${key}: ${currentVal.toFixed(2)} → ${target.toFixed(2)} (${type} ${amount.toFixed(2)}) | ${error ? error.message : 'OK'}`
    );
    if (!error) inserted++;
  }

  console.log(`\n${inserted} ajustes insertados.`);

  // Verificación final
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
