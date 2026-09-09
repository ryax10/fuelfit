require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: orders } = await supabase.from('orders').select('id,number,created_at,total').gte('created_at','2026-03-01').lt('created_at','2026-04-01');
  console.log('Orders in March 2026:', orders?.length);
  if (orders?.length) console.log(' Numbers:', orders.map(o => o.number).join(', '));
  
  const { data: cm } = await supabase.from('cash_movements').select('id,type,amount,currency,note').gte('created_at','2026-03-01').lt('created_at','2026-04-01');
  console.log('Cash movements in March 2026:', cm?.length);
  cm?.forEach(m => console.log(' ', m.type, m.amount, m.currency, m.note));
  
  const { data: im } = await supabase.from('inventory_movements').select('id,type,qty').gte('created_at','2026-03-01').lt('created_at','2026-04-01');
  console.log('Inventory movements in March 2026:', im?.length);
  
  const { data: cfg } = await supabase.from('config').select('key,value').in('key',['fx_usdt_ars','cajas']);
  console.log('Config:', cfg);
}
check().catch(console.error);
