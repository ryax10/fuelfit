/**
 * add-standalone-debts-march.js
 * Agrega deudas standalone de Marzo 2026 que vienen de las entradas
 * A COBRAR USD / A PAGAR USD del FLUJO (sin pedido asociado).
 *
 * Uso: node scripts/add-standalone-debts-march.js
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const XLSX_PATH = 'c:/Users/Luch1/Downloads/FULLVAPO.xlsx';

function excelToTs(serial) {
  if (!serial || typeof serial !== 'number') return '2026-03-15T14:00:00.000Z';
  return new Date((serial - 25569) * 86400 * 1000).toISOString().slice(0, 10) + 'T14:00:00.000Z';
}

async function run() {
  const wb = XLSX.readFile(XLSX_PATH);
  const wsFlujo = wb.Sheets['FLUJO DE CAJA'];
  const raw = XLSX.utils.sheet_to_json(wsFlujo, { header: 1, defval: null });
  const flujoMarzo = raw.slice(14).filter(r =>
    r[0] != null && r[0] !== '' && r[2] === 'Marzo' && r[3] === '2026'
  );

  // Filas con A COBRAR USD o A PAGAR USD
  const aCobraOrPaga = flujoMarzo.filter(r => {
    const op = String(r[0]).trim().toUpperCase();
    return op === 'A COBRAR USD' || op === 'A PAGAR USD';
  });

  console.log(`Encontradas ${aCobraOrPaga.length} entradas A COBRAR/A PAGAR en Marzo:`);
  aCobraOrPaga.forEach(r => console.log('  ', JSON.stringify({ op: r[0], usd: r[4], nota: r[7] })));
  console.log('');

  const debtRows = [];

  for (const r of aCobraOrPaga) {
    const op = String(r[0]).trim().toUpperCase();
    const usd = Math.abs(Number(r[4]) || 0);
    if (usd === 0) {
      console.log(`  Saltando entrada con monto=0: "${r[7] || r[0]}"`);
      continue;
    }

    const nota = String(r[7] || r[0]).trim();
    // Extraer nombre de entidad limpiando la descripción
    const entityName = nota
      .replace(/\s+DEBE\s+[\d.]+\s*USD.*/i, '')
      .replace(/\s+TIENE\s+[\d.]+.*A\s*FAVOR.*/i, '')
      .replace(/\s+A\s+FAVOR.*/i, '')
      .trim() || nota;

    const ts = excelToTs(r[1]);

    if (op === 'A COBRAR USD') {
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
      console.log(`  → Receivable standalone: "${entityName}" $${usd} USD`);
    } else {
      // A PAGAR USD
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
      console.log(`  → Payable standalone: "${entityName}" $${usd} USD`);
    }
  }

  if (debtRows.length > 0) {
    const { error } = await supabase.from('debts').insert(debtRows);
    if (error) console.log(`✗ Error: ${error.message}`);
    else console.log(`\n✅ ${debtRows.length} deudas standalone creadas.`);
  } else {
    console.log('(sin deudas standalone para agregar)');
  }
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
