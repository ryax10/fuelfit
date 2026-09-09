require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Pedidos a corregir: qty=20 gummies → qty=1 frasco
// Para mayoristas: unit_price * 20 (de $/gummy a $/frasco)
// Para minoristas: unit_price * 20 (de ARS/gummy a ARS/frasco)
const FIXES = [
  { number: 2878, sku: 'TORCHHUL-008' }, // LUCAS LA BOMBA - mayorista
  { number: 2898, sku: 'TORCHHUL-002' }, // NICO NVDRINKS - mayorista
  { number: 2884, sku: 'TORCHHUL-008' }, // GIULI - minorista
];

async function run() {
  for (const fix of FIXES) {
    const { data: orders } = await sb.from('orders').select('id, number, type, customer_name').eq('number', fix.number);
    const order = orders[0];

    const { data: items } = await sb.from('order_items')
      .select('id, qty, unit_price, subtotal')
      .eq('order_id', order.id)
      .eq('product_sku', fix.sku);

    const item = items[0];
    const newUnitPrice = Math.round(item.unit_price * 20 * 100) / 100;
    const newSubtotal = newUnitPrice; // qty=1

    const { error } = await sb.from('order_items').update({
      qty: 1,
      unit_price: newUnitPrice,
      subtotal: newSubtotal,
    }).eq('id', item.id);

    console.log(
      '#' + order.number, order.customer_name, '(' + order.type + ')',
      fix.sku,
      '| qty: 20 -> 1',
      '| unit_price:', item.unit_price, '->', newUnitPrice,
      '|', error ? error.message : 'OK'
    );
  }
}

run().catch(console.error);
