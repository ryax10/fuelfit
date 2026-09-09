require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: orders } = await s
    .from('orders')
    .select('id, number, type, total, customer_name, created_at')
    .gte('number', 2869).lte('number', 2907)
    .order('number').order('created_at');

  // Agrupar por número
  const byNumber = {};
  for (const o of (orders || [])) {
    if (!byNumber[o.number]) byNumber[o.number] = [];
    byNumber[o.number].push(o);
  }

  const toDelete = [];

  for (const [num, group] of Object.entries(byNumber)) {
    if (group.length === 1) continue;

    const retail = group.filter(o => o.type === 'retail');
    const wholesale = group.filter(o => o.type === 'wholesale');

    if (retail.length > 0 && wholesale.length > 0) {
      // Hay versión retail (ARS) y wholesale (USD) del mismo pedido
      // Determinar cuál es el correcto:
      // - Si hay retail con total alto (ARS), ese es el correcto
      // - Si hay retail con total bajo (USD ≈ <500), ese es incorrecto
      const retailArs = retail.filter(o => o.total > 500);
      const wholesaleUsd = wholesale;
      const retailUsd = retail.filter(o => o.total <= 500);

      // Eliminar wholesale (USD incorrecto para clientes minoristas)
      for (const o of wholesaleUsd) {
        toDelete.push({ id: o.id, num, reason: `WHOLESALE USD duplicado de RETAIL ARS (${o.customer_name})` });
      }
      // Eliminar retail con total en USD (incorrecto)
      for (const o of retailUsd) {
        toDelete.push({ id: o.id, num, reason: `RETAIL USD incorrecto (${o.customer_name} total: ${o.total})` });
      }
    } else if (wholesale.length > 1) {
      // Duplicados puros de wholesale — eliminar el segundo
      const sorted = wholesale.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      for (const o of sorted.slice(1)) {
        toDelete.push({ id: o.id, num, reason: `WHOLESALE duplicado puro (${o.customer_name})` });
      }
    } else if (retail.length > 1) {
      // Duplicados puros de retail — eliminar el que tenga total en USD (bajo)
      const sorted = retail.sort((a, b) => b.total - a.total); // el mayor (ARS) primero
      for (const o of sorted.slice(1)) {
        toDelete.push({ id: o.id, num, reason: `RETAIL duplicado (${o.customer_name} total: ${o.total})` });
      }
    }
  }

  console.log(`\n📋 Órdenes a eliminar (${toDelete.length}):`);
  for (const d of toDelete) console.log(`  #${d.num} [${d.id.slice(0,8)}] — ${d.reason}`);

  if (toDelete.length === 0) { console.log('Nada que eliminar.'); return; }

  const ids = toDelete.map(d => d.id);

  // Obtener cash_movements vinculados para eliminarlos
  const { data: linkedCash } = await s.from('cash_movements').select('id').in('order_id', ids);
  if (linkedCash && linkedCash.length > 0) {
    const { error } = await s.from('cash_movements').delete().in('order_id', ids);
    if (error) console.error('Error eliminando cash_movements:', error.message);
    else console.log(`\n🗑️  Eliminados ${linkedCash.length} cash_movements vinculados.`);
  }

  // Eliminar debts vinculadas
  const { error: debtsErr } = await s.from('debts').delete().in('order_id', ids);
  if (debtsErr) console.error('Error eliminando debts:', debtsErr.message);

  // Eliminar inventory_movements vinculados
  const { error: invErr } = await s.from('inventory_movements').delete().in('order_id', ids);
  if (invErr) console.error('Error eliminando inventory_movements:', invErr.message);

  // Eliminar order_items
  const { error: itemsErr } = await s.from('order_items').delete().in('order_id', ids);
  if (itemsErr) console.error('Error eliminando order_items:', itemsErr.message);

  // Eliminar las órdenes
  const { error: ordersErr } = await s.from('orders').delete().in('id', ids);
  if (ordersErr) { console.error('Error eliminando orders:', ordersErr.message); process.exit(1); }

  console.log(`✅ Eliminadas ${ids.length} órdenes duplicadas.`);

  // También limpiar cash_movements "sin order_id" que sean duplicados por nota
  // (los que tienen notas iguales a movimientos ya existentes con order_id)
  const { data: noLinkUsd } = await s.from('cash_movements')
    .select('id, note, amount, currency, type')
    .eq('type', 'sale_income')
    .is('order_id', null);

  const { data: withLinkUsd } = await s.from('cash_movements')
    .select('id, note, amount, currency, type')
    .eq('type', 'sale_income')
    .not('order_id', 'is', null);

  const linkedNotes = new Set((withLinkUsd || []).map(m => m.note));
  const dupCashIds = (noLinkUsd || []).filter(m => linkedNotes.has(m.note)).map(m => m.id);

  if (dupCashIds.length > 0) {
    await s.from('cash_movements').delete().in('id', dupCashIds);
    console.log(`🗑️  Eliminados ${dupCashIds.length} cash_movements duplicados (sin order_id).`);
  }

  // Verificación final
  const { data: remaining } = await s.from('orders')
    .select('number, type, total, customer_name')
    .gte('number', 2869).lte('number', 2907)
    .order('number');

  console.log('\n✅ Pedidos finales:');
  for (const o of (remaining || [])) {
    console.log(`  #${o.number} [${o.type.toUpperCase()}] ${o.customer_name} — ${o.total}`);
  }
}

run().catch(console.error);
