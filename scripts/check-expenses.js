require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

s.from('cash_movements')
  .select('id, caja, currency, amount, type, note, created_at')
  .in('type', ['manual_expense', 'purchase_expense'])
  .order('created_at')
  .then(({ data }) => {
    for (const m of (data || [])) {
      console.log(`[${m.id}] ${m.created_at?.slice(0,10)} | ${m.caja} | ${m.currency} ${m.amount} | ${m.note}`);
    }
  });
