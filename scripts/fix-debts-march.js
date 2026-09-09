/**
 * fix-debts-march.js
 * Recalcula y reemplaza las deudas de Marzo 2026 correctamente:
 *   - Órdenes sin pago: deuda = total completo
 *   - Órdenes con pago parcial: deuda = diferencia (gap > $3 USD)
 *   - Entradas A COBRAR USD en FLUJO → receivable sin orden
 *   - Entradas A PAGAR USD en FLUJO → payable sin orden
 *
 * Uso: node scripts/fix-debts-march.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const XLSX_PATH = 'c:/Users/Luch1/Downloads/FULLVAPO.xlsx';
const TC_MARZO = 1450; // ARS por USD
const GAP_THRESHOLD = 3; // USD mínimo para registrar deuda de diferencia

function excelToTs(serial, time = 'T14:00:00.000Z') {
  if (!serial || typeof serial !== 'number') return '2026-03-01T14:00:00.000Z';
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().slice(0, 10) + time;
}

function normName(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function run() {
  console.log('════════════════════════════════════════════════');
  console.log('  FIX DEUDAS MARZO 2026');
  console.log('════════════════════════════════════════════════\n');

  // ── LEER XLSX ──────────────────────────────────────────────────────────────
  const wb = XLSX.readFile(XLSX_PATH);

  // SALIDAS DE STOCK — agrupar pedidos
  const wsSal = wb.Sheets['SALIDAS DE STOCK'];
  const rawSal = XLSX.utils.sheet_to_json(wsSal, { header: 1, defval: null });
  const salidas = rawSal.slice(11).filter(r => r[0] && String(r[2]) === '2026' && r[3] === 'Marzo');

  const pedidosMap = {};
  for (const r of salidas) {
    const nro = String(r[0]);
    if (!pedidosMap[nro]) {
      pedidosMap[nro] = {
        nro, num: parseInt(nro.replace('#', '')),
        fecha: r[1],
        cliente: (r[8] || 'DESCONOCIDO').trim(),
        total: 0,
      };
    }
    pedidosMap[nro].total += Number(r[12]) || 0;
  }

  // Redondear totales
  for (const p of Object.values(pedidosMap)) {
    p.total = parseFloat(p.total.toFixed(2));
  }

  const pedidos = Object.values(pedidosMap).sort((a, b) => a.num - b.num);
  console.log(`XLSX → ${pedidos.length} pedidos Marzo 2026\n`);

  // FLUJO DE CAJA — pagos por pedido
  const wsFlujo = wb.Sheets['FLUJO DE CAJA'];
  const rawFlujo = XLSX.utils.sheet_to_json(wsFlujo, { header: 1, defval: null });
  const flujoMarzo = rawFlujo.slice(14).filter(r =>
    r[0] != null && r[0] !== '' && r[2] === 'Marzo' && r[3] === '2026'
  );

  // Pagos REALES por pedido (#XXXX) — solo cuando quien (r[6]) != null
  // quien=null = nota de deuda / anotación interna, NO es pago de caja
  const flujoPorPedido = {};
  const flujoDeudaNotas = {}; // quien=null con monto → nota de deuda explícita

  for (const r of flujoMarzo) {
    const op = String(r[0]).trim();
    if (!op.startsWith('#')) continue;

    if (r[6] != null) {
      // Pago real (SANTY/LUCHO/EFECTIVO)
      if (!flujoPorPedido[op]) flujoPorPedido[op] = [];
      flujoPorPedido[op].push({
        fecha: r[1],
        usd: Number(r[4]) || 0,
        ars: Number(r[5]) || 0,
        quien: r[6],
      });
    } else {
      // quien=null con monto → anotación de deuda
      const usdAmt = Number(r[4]) || 0;
      const arsAmt = Number(r[5]) || 0;
      if (usdAmt !== 0 || arsAmt !== 0) {
        if (!flujoDeudaNotas[op]) flujoDeudaNotas[op] = [];
        flujoDeudaNotas[op].push({ fecha: r[1], usd: usdAmt, ars: arsAmt, nota: r[7] || r[0] });
      }
    }
  }

  // Movimientos no-pedido (A COBRAR / A PAGAR)
  const flujoOtros = flujoMarzo.filter(r => !String(r[0]).trim().startsWith('#'));

  // ── CARGAR ÓRDENES XLSX DESDE DB ───────────────────────────────────────────
  const { data: xlsxOrders } = await supabase
    .from('orders').select('id,number,customer_name,customer_id')
    .gte('number', 2869).lte('number', 2966);

  const orderIdMap = {};
  const orderCustIdMap = {};
  const orderCustNameMap = {};
  for (const o of xlsxOrders || []) {
    orderIdMap[o.number] = o.id;
    orderCustIdMap[o.number] = o.customer_id;
    orderCustNameMap[o.number] = o.customer_name;
  }

  console.log(`DB → ${xlsxOrders?.length || 0} órdenes XLSX encontradas\n`);

  // ── BORRAR DEUDAS DE MARZO ─────────────────────────────────────────────────
  console.log('Borrando deudas de Marzo existentes...');
  const xlsxOrderIds = Object.values(orderIdMap);

  // Deudas con order_id de órdenes XLSX
  if (xlsxOrderIds.length > 0) {
    const { count: d1 } = await supabase.from('debts')
      .delete({ count: 'exact' }).in('order_id', xlsxOrderIds);
    console.log(`  ✓ ${d1 || 0} deudas con orden eliminadas`);
  }

  // Deudas de Marzo sin order_id (A COBRAR/A PAGAR standalone)
  const { data: standaloneDebts } = await supabase.from('debts')
    .select('id')
    .gte('created_at', '2026-03-01T00:00:00Z')
    .lt('created_at', '2026-04-01T00:00:00Z')
    .is('order_id', null);
  if (standaloneDebts?.length > 0) {
    await supabase.from('debts').delete().in('id', standaloneDebts.map(d => d.id));
    console.log(`  ✓ ${standaloneDebts.length} deudas standalone eliminadas`);
  }

  console.log('');

  // ── CALCULAR NUEVAS DEUDAS ─────────────────────────────────────────────────
  const debtRows = [];

  // 1. Deudas de órdenes con pago parcial o sin pago
  console.log('Calculando deudas por pedido...');
  let debtsByOrder = 0;

  for (const ped of pedidos) {
    if (ped.total <= 0) continue; // regalo / interno
    const ordId = orderIdMap[ped.num];
    if (!ordId) continue; // no está en DB

    const payments = flujoPorPedido[ped.nro] || [];
    const paidUsd = parseFloat(payments.reduce((s, p) => {
      return s + Math.abs(p.usd) + Math.abs(p.ars) / TC_MARZO;
    }, 0).toFixed(2));

    const gap = parseFloat((ped.total - paidUsd).toFixed(2));

    if (Math.abs(gap) < GAP_THRESHOLD) continue; // diferencia menor al umbral

    const ts = excelToTs(ped.fecha);
    const custName = orderCustNameMap[ped.num] || ped.cliente;
    const custId = orderCustIdMap[ped.num] || null;

    if (gap > 0) {
      // Cliente nos debe (receivable)
      debtRows.push({
        type: 'receivable',
        entity_name: custName,
        entity_type: 'customer',
        entity_id: custId,
        original_amount: gap,
        currency: 'USD',
        paid_amount: 0,
        order_id: ordId,
        note: `Pedido ${ped.nro} - ${custName} - total $${ped.total} / pagado $${paidUsd}`,
        status: 'pending',
        created_at: ts,
      });
      console.log(`  → Receivable #${ped.num} ${custName}: $${gap} USD (total $${ped.total} - pagado $${paidUsd})`);
      debtsByOrder++;
    } else if (gap < -GAP_THRESHOLD) {
      // Nosotros debemos al cliente (overpaid → payable)
      debtRows.push({
        type: 'payable',
        entity_name: custName,
        entity_type: 'customer',
        entity_id: custId,
        original_amount: Math.abs(gap),
        currency: 'USD',
        paid_amount: 0,
        order_id: ordId,
        note: `Pedido ${ped.nro} - ${custName} - sobrepagó $${Math.abs(gap)} USD`,
        status: 'pending',
        created_at: ts,
      });
      console.log(`  → Payable #${ped.num} ${custName}: $${Math.abs(gap)} USD (overpaid)`);
      debtsByOrder++;
    }
  }
  console.log(`  → ${debtsByOrder} deudas de pedidos\n`);

  // 2. Entradas A COBRAR / A PAGAR en FLUJO (sin orden asociada)
  console.log('Procesando entradas A COBRAR / A PAGAR del FLUJO...');
  let debtsFlujo = 0;

  for (const r of flujoOtros) {
    const op = String(r[0]).trim().toUpperCase();

    // A COBRAR USD → nosotros cobramos → receivable
    if (op.includes('A COBRAR USD')) {
      const usd = Math.abs(Number(r[4]) || 0);
      if (usd === 0) continue; // entrada sin monto (ej: "LU DEBE 469 USD" informativa, ya cubierta por gap de orden)
      const ts = excelToTs(r[1]);
      const nota = String(r[7] || r[0]).trim(); // r[7] tiene el nombre real (ej: "BLAS DEBE 196.5 USD")
      const entityName = nota.replace(/\s+DEBE.*$/i, '').trim() || nota;

      debtRows.push({
        type: 'receivable',
        entity_name: entityName,
        entity_type: 'customer',
        entity_id: null,
        original_amount: usd,
        currency: 'USD',
        paid_amount: 0,
        order_id: null,
        note: nota,
        status: 'pending',
        created_at: ts,
      });
      console.log(`  → Receivable standalone: "${entityName}" $${usd} USD (${nota})`);
      debtsFlujo++;
      continue;
    }

    // A PAGAR USD → nosotros pagamos → payable
    if (op.includes('A PAGAR USD')) {
      const usd = Math.abs(Number(r[4]) || 0);
      if (usd === 0) continue;
      const ts = excelToTs(r[1]);
      const nota = String(r[7] || r[0]).trim();
      // Extraer nombre antes de "TIENE" o "A FAVOR"
      const entityName = nota.replace(/\s+(TIENE|A FAVOR|A\s*PAGAR).*$/i, '').trim() || nota;

      debtRows.push({
        type: 'payable',
        entity_name: entityName,
        entity_type: 'customer',
        entity_id: null,
        original_amount: usd,
        currency: 'USD',
        paid_amount: 0,
        order_id: null,
        note: nota,
        status: 'pending',
        created_at: ts,
      });
      console.log(`  → Payable standalone: "${entityName}" $${usd} USD (${nota})`);
      debtsFlujo++;
      continue;
    }
  }
  console.log(`  → ${debtsFlujo} deudas del FLUJO\n`);

  // ── INSERTAR DEUDAS ────────────────────────────────────────────────────────
  console.log(`Insertando ${debtRows.length} deudas...`);

  if (debtRows.length > 0) {
    const { error: dErr } = await supabase.from('debts').insert(debtRows);
    if (dErr) {
      console.log(`  ✗ Error: ${dErr.message}`);
    } else {
      console.log(`  ✓ ${debtRows.length} deudas creadas`);
    }
  } else {
    console.log('  (sin deudas a crear)');
  }

  // ── RESUMEN ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log('  RESUMEN');
  console.log('════════════════════════════════════════════════');

  const { data: allDebts } = await supabase.from('debts')
    .select('*')
    .gte('created_at', '2026-03-01T00:00:00Z')
    .lt('created_at', '2026-04-01T00:00:00Z');

  const receivables = (allDebts || []).filter(d => d.type === 'receivable');
  const payables = (allDebts || []).filter(d => d.type === 'payable');

  const totalReceivable = receivables.reduce((s, d) => s + Number(d.original_amount), 0);
  const totalPayable = payables.reduce((s, d) => s + Number(d.original_amount), 0);

  console.log(`\n  Deudas Receivable (nos deben):`);
  for (const d of receivables) {
    console.log(`    ${d.entity_name.padEnd(35)} $${Number(d.original_amount).toFixed(2)} USD  ${d.note ? '| ' + d.note.slice(0,60) : ''}`);
  }
  console.log(`    TOTAL: $${totalReceivable.toFixed(2)} USD\n`);

  console.log(`  Deudas Payable (les debemos):`);
  for (const d of payables) {
    console.log(`    ${d.entity_name.padEnd(35)} $${Number(d.original_amount).toFixed(2)} USD  ${d.note ? '| ' + d.note.slice(0,60) : ''}`);
  }
  console.log(`    TOTAL: $${totalPayable.toFixed(2)} USD\n`);

  console.log(`  NET RECEIVABLE: $${(totalReceivable - totalPayable).toFixed(2)} USD`);
  console.log('\n✅ Deudas actualizadas.');
}

run().catch(err => {
  console.error('\n❌ ERROR FATAL:', err.message);
  process.exit(1);
});
