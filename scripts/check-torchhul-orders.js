require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: items } = await sb.from('order_items')
    .select('id, order_id, product_sku, qty, unit_price, subtotal')
    .like('product_sku', 'TORCHHUL-%')
    .gte('qty', 20);

  const byOrder = {};
  for (const i of items || []) {
    if (!byOrder[i.order_id]) byOrder[i.order_id] = [];
    byOrder[i.order_id].push(i);
  }

  for (const [orderId, its] of Object.entries(byOrder)) {
    const { data: o } = await sb.from('orders').select('number, customer_name, confirmed_at').eq('id', orderId);
    console.log('Pedido #' + o[0].number, o[0].customer_name, o[0].confirmed_at.slice(0, 10));
    for (const i of its) console.log('  ', i.product_sku, 'qty:', i.qty, 'unit_price:', i.unit_price);
  }
}

check().catch(console.error);
