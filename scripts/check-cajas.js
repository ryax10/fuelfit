require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('cash_movements').select('caja, currency, amount, type').then(({ data }) => {
  const b = {};
  for (const m of (data || [])) {
    const k = m.caja ? m.caja.toLowerCase() : null;
    if (!k) continue;
    if (!b[k]) b[k] = { usd: 0, ars: 0 };
    const c = m.currency && m.currency.toLowerCase() === 'usd' ? 'usd' : 'ars';
    const out = ['manual_expense','purchase_expense','ajuste_out'].includes(m.type);
    b[k][c] += out ? -m.amount : m.amount;
  }
  for (const [caja, bal] of Object.entries(b)) {
    console.log(caja + ': USD ' + bal.usd.toFixed(2) + ' / ARS ' + bal.ars.toFixed(2));
  }
});
