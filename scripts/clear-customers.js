require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { count } = await s.from('customers').select('*', { count: 'exact', head: true });
  console.log(`Clientes actuales: ${count}`);

  // Desvincular customer_id de orders antes de eliminar
  const { error: unlinkErr } = await s.from('orders').update({ customer_id: null }).not('customer_id', 'is', null);
  if (unlinkErr) { console.error('Error desvinculando orders:', unlinkErr.message); process.exit(1); }

  const { error } = await s.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) { console.error('Error eliminando clientes:', error.message); process.exit(1); }

  const { count: after } = await s.from('customers').select('*', { count: 'exact', head: true });
  console.log(`✅ Clientes eliminados. Quedan: ${after}`);
}

run().catch(console.error);
