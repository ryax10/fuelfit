require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await s.from('cash_movements').select('id, caja, currency, amount, type, note').order('created_at', { ascending: false }).limit(20);
  console.log('Últimos 20 movimientos:');
  for (const m of (data || [])) {
    console.log(`  [${m.caja}] ${m.currency} ${m.type} ${m.amount} — ${m.note}`);
  }

  // Saldos por caja (tal como lo hace el panel — case sensitive)
  const { data: all } = await s.from('cash_movements').select('caja, currency, amount, type');
  const b = {};
  const OUT = ['manual_expense','purchase_expense','ajuste_out','refund'];
  for (const m of (all || [])) {
    if (!b[m.caja]) b[m.caja] = { usd: 0, ars: 0 };
    const c = m.currency === 'USD' ? 'usd' : 'ars';
    b[m.caja][c] += OUT.includes(m.type) ? -m.amount : m.amount;
  }
  console.log('\nSaldos por caja (case-sensitive como el panel):');
  for (const [k, v] of Object.entries(b)) {
    console.log(`  "${k}": USD ${v.usd.toFixed(2)} / ARS ${v.ars.toFixed(2)}`);
  }
}
run().catch(console.error);
