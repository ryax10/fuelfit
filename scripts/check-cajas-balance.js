require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: movs } = await sb.from('cash_movements').select('caja, currency, amount, type');
  const balances = {};
  for (const m of movs || []) {
    const key = m.caja + '_' + m.currency;
    if (!balances[key]) balances[key] = 0;
    const isOut = m.type === 'manual_expense' || m.type === 'purchase_expense' || m.type === 'ajuste_out';
    balances[key] += isOut ? -m.amount : m.amount;
  }
  console.log('Saldos actuales:');
  Object.entries(balances).sort().forEach(([k, v]) =>
    console.log(' ', k, '=', v.toLocaleString('es-AR', { minimumFractionDigits: 2 }))
  );
}
run().catch(console.error);
