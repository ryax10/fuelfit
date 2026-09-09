require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data: orders } = await sb.from('orders').select('id, number, total').eq('number', 2921);
  const order = orders?.[0];
  if (!order) { console.log('No encontrado'); return; }
  console.log('Pedido:', JSON.stringify(order));

  const { error: oErr } = await sb.from('orders').update({ total: 80000 }).eq('id', order.id);
  console.log('Update order:', oErr ? oErr.message : 'OK');

  const { data: items } = await sb.from('order_items').select('id, qty').eq('order_id', order.id);
  for (const item of items || []) {
    const unitPrice = Math.round(80000 / item.qty * 100) / 100;
    const { error: iErr } = await sb.from('order_items').update({ unit_price: unitPrice, subtotal: 80000 }).eq('id', item.id);
    console.log('Update item:', iErr ? iErr.message : 'OK unit_price=' + unitPrice);
  }

  const { error: cmErr } = await sb.from('cash_movements').insert({
    type: 'sale_income', amount: 80000, currency: 'ARS',
    caja: 'Luciano', note: 'Pedido #2921 - BICHURRI',
    category: 'ventas', created_at: '2026-03-11T12:00:00'
  });
  console.log('Cash movement:', cmErr ? cmErr.message : 'OK');
}

fix().catch(console.error);
