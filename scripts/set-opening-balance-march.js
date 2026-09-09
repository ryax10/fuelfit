/**
 * set-opening-balance-march.js
 *
 * Calcula el saldo acumulado de cada caja ANTES de Marzo 2026 leyendo
 * todas las entradas del FLUJO DE CAJA que sean anteriores a Marzo 2026.
 *
 * Luego borra los ajustes de apertura existentes y crea nuevos movimientos
 * de tipo ajuste_in/ajuste_out con nota "Saldo inicial Marzo 2026".
 *
 * Uso: node scripts/set-opening-balance-march.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const XLSX_PATH = 'c:/Users/Luch1/Downloads/FULLVAPO.xlsx';

// Mapeo de quien → caja del sistema
function toCaja(quien) {
  if (!quien) return null; // sin caja → ignorar
  const q = String(quien).trim().toUpperCase();
  if (q === 'SANTY') return 'Santiago';
  if (q === 'LUCHO') return 'Luciano';
  if (q === 'EFECTIVO') return 'Oficina';
  return null;
}

const MONTH_ORDER = {
  'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
  'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12,
};

function isBeforeMarzo2026(r) {
  const month = String(r[2] || '').toUpperCase().trim();
  const year = Number(r[3]);
  if (!month || !year) return false;
  if (year < 2026) return true;
  if (year === 2026) {
    const monthNum = MONTH_ORDER[month] || 0;
    return monthNum < 3; // Enero(1) o Febrero(2)
  }
  return false;
}

async function run() {
  console.log('════════════════════════════════════════════════');
  console.log('  SALDO INICIAL MARZO 2026');
  console.log('════════════════════════════════════════════════\n');

  const wb = XLSX.readFile(XLSX_PATH);
  const wsFlujo = wb.Sheets['FLUJO DE CAJA'];
  const raw = XLSX.utils.sheet_to_json(wsFlujo, { header: 1, defval: null });

  // Leer todos los registros del FLUJO (skip header hasta fila 15)
  const allRows = raw.slice(14).filter(r => r[0] != null && r[0] !== '');

  // Filtrar solo las filas PRE-Marzo 2026
  const preMarzoRows = allRows.filter(r => isBeforeMarzo2026(r));
  console.log(`FLUJO: ${allRows.length} filas totales, ${preMarzoRows.length} pre-Marzo 2026\n`);

  // Acumular saldos por caja y moneda
  // Para pagos de pedidos (#XXX) y otros movimientos, seguir la misma lógica que el script principal:
  //   - quien != null → movimiento real de caja
  //   - quien = null → ignorar (nota de deuda)
  // Para tipo: si la columna tiene USD positivo → ingreso a la caja, negativo → egreso
  // Para sale_income: el valor va a la caja del quien
  // Para gastos: sale de la caja

  const balances = {}; // key = `${caja}:${currency}` → balance acumulado

  function addBalance(caja, currency, amount) {
    if (!caja || !currency || !isFinite(amount) || amount === 0) return;
    const key = `${caja}:${currency}`;
    balances[key] = (balances[key] || 0) + amount;
  }

  let rowsProcessed = 0;
  let rowsSkipped = 0;

  for (const r of preMarzoRows) {
    const op = String(r[0]).trim();
    const usd = Number(r[4]) || 0;
    const ars = Number(r[5]) || 0;
    const quien = r[6];

    // Ignorar entradas con quien=null que tengan montos (son notas de deuda, no movimientos de caja)
    if (quien == null && (usd !== 0 || ars !== 0)) {
      rowsSkipped++;
      continue;
    }

    // Solo procesar si hay quien asignado
    const caja = toCaja(quien);
    if (!caja) {
      rowsSkipped++;
      continue;
    }

    // El monto positivo = ingresa a la caja, negativo = sale
    if (usd !== 0) addBalance(caja, 'USD', usd);
    if (ars !== 0) addBalance(caja, 'ARS', ars);
    rowsProcessed++;
  }

  console.log(`Procesadas: ${rowsProcessed} filas | Ignoradas: ${rowsSkipped} (sin caja o notas de deuda)\n`);

  console.log('Saldos pre-Marzo calculados:');
  const sortedKeys = Object.keys(balances).sort();
  for (const key of sortedKeys) {
    const [caja, currency] = key.split(':');
    console.log(`  ${caja.padEnd(12)} ${currency}: ${balances[key].toFixed(2)}`);
  }
  console.log('');

  // ── BORRAR AJUSTES ANTERIORES ─────────────────────────────────────────────
  console.log('Borrando ajustes de apertura anteriores...');
  const { data: oldAjustes } = await supabase.from('cash_movements')
    .select('id')
    .like('note', 'Saldo inicial Marzo 2026%');
  if (oldAjustes?.length > 0) {
    await supabase.from('cash_movements').delete().in('id', oldAjustes.map(a => a.id));
    console.log(`  ✓ ${oldAjustes.length} ajustes anteriores eliminados`);
  } else {
    console.log('  (no había ajustes previos)');
  }
  console.log('');

  // ── CREAR NUEVOS AJUSTES DE APERTURA ─────────────────────────────────────
  console.log('Creando ajustes de apertura...');
  const OPENING_DATE = '2026-03-01T00:00:00.000Z';
  const adjustments = [];

  for (const key of sortedKeys) {
    const [caja, currency] = key.split(':');
    const balance = balances[key];
    if (Math.abs(balance) < 0.01) continue; // ignorar saldos insignificantes

    adjustments.push({
      type: balance >= 0 ? 'ajuste_in' : 'ajuste_out',
      amount: Math.abs(parseFloat(balance.toFixed(2))),
      currency,
      caja,
      category: 'apertura',
      order_id: null,
      note: `Saldo inicial Marzo 2026 — ${caja} ${currency}`,
      created_at: OPENING_DATE,
    });
    console.log(`  ${balance >= 0 ? '▲' : '▼'} ${caja} ${currency}: ${balance >= 0 ? '+' : ''}${balance.toFixed(2)}`);
  }

  if (adjustments.length > 0) {
    const { error } = await supabase.from('cash_movements').insert(adjustments);
    if (error) {
      console.log(`  ✗ Error: ${error.message}`);
    } else {
      console.log(`\n  ✓ ${adjustments.length} ajustes de apertura creados`);
    }
  }

  // ── VERIFICACIÓN ─────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log('  SALDOS ACTUALES EN LA DB (incluyendo apertura + Marzo)');
  console.log('════════════════════════════════════════════════');

  const { data: allMovs } = await supabase.from('cash_movements')
    .select('type, amount, currency, caja');

  const dbBals = {};
  for (const m of allMovs || []) {
    const sign = ['sale_income', 'manual_income', 'ajuste_in'].includes(m.type) ? 1 : -1;
    const key = `${m.caja}:${m.currency}`;
    dbBals[key] = (dbBals[key] || 0) + sign * m.amount;
  }

  for (const key of Object.keys(dbBals).sort()) {
    const [caja, currency] = key.split(':');
    const val = dbBals[key];
    console.log(`  ${caja.padEnd(12)} ${currency}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}`);
  }

  console.log('\n✅ Saldos de apertura configurados.');
}

run().catch(err => {
  console.error('\n❌ ERROR FATAL:', err.message);
  process.exit(1);
});
