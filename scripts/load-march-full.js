/**
 * load-march-full.js
 * Carga COMPLETA de Marzo 2026 desde FULLVAPO.xlsx.
 *
 * BORRAR y RECARGAR:
 *   - Órdenes XLSX #2869-#2966 + sus items, egresos, cash_movements, deudas
 *   - Compras #168-#172 + sus items e ingresos de inventario
 *   - Cash movements en Marzo que no sean ajustes iniciales ni pagos de tienda online
 *
 * PRESERVAR:
 *   - Órdenes de tienda online (#1037-#1071) y sus cash_movements
 *   - Ajustes de saldo inicial (note = 'Ajuste saldo inicial')
 *
 * Uso: node scripts/load-march-full.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const XLSX_PATH = 'c:/Users/Luch1/Downloads/FULLVAPO.xlsx';
const TC_MARZO = 1450; // ARS por USD, promedio Marzo 2026

// ── CAJAS MAP ─────────────────────────────────────────────────────────────────
function toCaja(quien) {
  if (!quien) return 'Santiago';
  const q = String(quien).trim().toUpperCase();
  if (q === 'SANTY') return 'Santiago';
  if (q === 'LUCHO') return 'Luciano';
  if (q === 'EFECTIVO') return 'Oficina';
  return 'Santiago';
}

// ── SKU MAP XLSX → DB ─────────────────────────────────────────────────────────
const SKU_MAP = {
  'ELF40001':'ELF40001','ELF40002':'ELF40002','ELF40003':'ELF40003',
  'ELF40004':'ELF40004','ELF40005':'ELF40005','ELF40006':'ELF40006',
  'ELF40007':'ELF40007','ELF40008':'ELF40008','ELF40009':'ELF40009',
  'ELF40010':'ELF40010','ELF40011':'ELF40011','ELF40012':'ELF40012',
  'ELF40013':'ELF40013','ELF40014':'ELF40014','ELF40015':'ELF40015',
  'ELF40016':'ELF40016','ELF40017':'ELF40017','ELF40018':'ELF40018',
  'ELF40019':'ELF40019','ELF40020':'ELF40020',
  'ELFBC45001':'ELFBABC4-001','ELFBC45002':'ELFBABC4-002','ELFBC45003':'ELFBABC4-003',
  'ELFBC45004':'ELFBABC4-004','ELFBC45005':'ELFBABC4-005','ELFBC45006':'ELFBABC4-006',
  'ELFBC45007':'ELFBABC4-007','ELFBC45008':'ELFBABC4-008','ELFBC45009':'ELFBABC4-009',
  'ELF2301':'ELFBAGH2-001','ELF2302':'ELFBAGH2-002','ELF2303':'ELFBAGH2-003',
  'ELF2304':'ELFBAGH2-004','ELF2305':'ELFBAGH2-005','ELF2306':'ELFBAGH2-006',
  'ELF2307':'ELFBAGH2-007','ELF2308':'ELFBAGH2-008','ELF2309':'ELFBAGH2-009',
  'ELF2310':'ELFBAGH2-010','ELF2311':'ELFBAGH2-011','ELF2312':'ELFBAGH2-012',
  'ELF2313':'ELFBAGH2-013','ELF2314':'ELFBAGH2-014','ELF2315':'ELFBAGH2-015',
  'ELF2316':'ELFBAGH2-016',
  'IGN30001':'IGNITV30-001','IGN30002':'IGNITV30-002','IGN30003':'IGNITV30-003',
  'IGN30004':'IGNITV30-004','IGN30005':'IGNITV30-005','IGN30006':'IGNITV30-006',
  'IGN30007':'IGNITV30-007','IGN30008':'IGNITV30-008','IGN30009':'IGNITV30-009',
  'IGN30010':'IGNITV30-010','IGN30011':'IGNITV30-011','IGN30012':'IGNITV30-012',
  'IGN30013':'IGNITV30-013','IGN30014':'IGNITV30-014','IGN30015':'IGNITV30-015',
  'IGN30016':'IGNITV30-016','IGN30017':'IGNITV30-017','IGN30018':'IGNITV30-018',
  'IGN30019':'IGNITV30-019','IGN30020':'IGNITV30-020','IGN30021':'IGNITV30-021',
  'IGN30022':'IGNITV30-022',
  'IGNUS30001':'IGN-V300-US-BLACK001','IGNUS30002':'IGN-V300-US-BLACK002',
  'IGNUS30003':'IGN-V300-US-BLACK003','IGNUS30004':'IGN-V300-US-BLACK004',
  'IGNUS30005':'IGN-V300-US-BLACK005',
  'IGNVM40001':'IGNITV40-001','IGNVM40002':'IGNITV40-002','IGNVM40003':'IGNITV40-003',
  'IGNVM40004':'IGNITV40-004','IGNVM40005':'IGNITV40-005','IGNVM40006':'IGNITV40-006',
  'IGNVM40007':'IGNITV40-007','IGNVM40008':'IGNITV40-008','IGNVM40009':'IGNITV40-009',
  'IGNVM40010':'IGNITV40-010','IGNVM40011':'IGNITV40-011','IGNVM40012':'IGNITV40-012',
  'IGNVM40013':'IGNITV40-013','IGNVM40014':'IGNITV40-014','IGNVM40015':'IGNITV40-015',
  'IGNVM40016':'IGNITV40-016',
  'BLOWREC001':'BLOWREC-001','BLOWREC002':'BLOWREC-002','BLOWREC003':'BLOWREC-003',
  'BLOWREC004':'BLOWREC-004','BLOWREC005':'BLOWREC-005','BLOWREC006':'BLOWREC-006',
  'BLOWREC007':'BLOWREC-007','BLOWREC008':'BLOWREC-008','BLOWREC009':'BLOWREC-009',
  'BLOWREC010':'BLOWREC-010','BLOWREC011':'BLOWREC-011','BLOWREC012':'BLOWREC-012',
  'BLOWREC013':'BLOWREC-013',
  'BLOW001':'BLOW35G-001','BLOW002':'BLOW35G-002','BLOW003':'BLOW35G-003',
  'BLOW004':'BLOW35G-004','BLOW005':'BLOW35G-005','BLOW006':'BLOW35G-006',
  'BLOW007':'BLOW35G-007','BLOW008':'BLOW35G-008','BLOW009':'BLOW35G-009',
  'BLOW010':'BLOW35G-010','BLOW011':'BLOW35G-011','BLOW012':'BLOW35G-012',
  'BLOW013':'BLOW35G-013','BLOW014':'BLOW35G-014','BLOW015':'BLOW35G-015',
  'BLOW016':'BLOW35G-016','BLOW017':'BLOW35G-017','BLOW018':'BLOW35G-018',
  'BLOWPEN001':'BLOWPEN-001',
  'TORHG15001':'TORCHHUL-001','TORHG15002':'TORCHHUL-002','TORHG15003':'TORCHHUL-003',
  'TORHG15004':'TORCHHUL-004','TORHG15005':'TORCHHUL-005','TORHG15006':'TORCHHUL-006',
  'TORHG15007':'TORCHHUL-007','TORHG15008':'TORCHHUL-008','TORHG15009':'TORCHHUL-009',
  'TORHG15010':'TORCHHUL-010',
  'TOR601':'TORCH60G-011','TOR602':'TORCH60G-012','TOR603':'TORCH60G-013',
  'TOR604':'TORCH60G-014','TOR605':'TORCH60G-018','TOR606':'TORCH60G-016',
  'TOR607':'TORCH60G-023','TOR608':'TORCH60G-018','TOR609':'TORCH60G-019',
  'TOR610':'TORCH60G-022',
  'TOR010':'TORCH50G-010','TOR011':'TORCH50G-011','TOR012':'TORCH50G-012',
  'TOR013':'TORCH50G-013','TOR014':'TORCH50G-014','TOR015':'TORCH50G-015',
  'TOR016':'TORCH50G-016','TOR017':'TORCH50G-017','TOR036':'TORCH50G-036',
  'TOR50038':'TORCH50G-038',
  'TOR750G001':'TORCH75G-001','TOR750G002':'TORCH75G-002','TOR750G003':'TORCH75G-003',
  'TOR-4001':'TORCH40G-001','TOR-4002':'TORCH40G-004','TOR-4003':'TORCH40G-003',
  'TOR-4004':'TORCH40G-005',
  'PHE008':'PHENO60G-019','PHE009':'PHENO60G-020','PHE010':'PHENO60G-018',
  'PHE011':'PHENO60G-022','PHE012':'PHENO60G-023','PHE013':'PHENO60G-024',
  'PHE014':'PHENO60G-025',
  'HBG8401':'HALFBGUM-001','HBG8402':'HALFBGUM-002','HBG8403':'HALFBGUM-003',
  'HBG8404':'HALFBGUM-004',
  'BHG5001':'BURNHGUM-001',
  'HHG601':'HEAVYGUM-001','HHG602':'HEAVYGUM-002','HHG603':'HEAVYGUM-003',
  'HHG604':'HEAVYGUM-004','HHG605':'HEAVYGUM-005','HHG606':'HEAVYGUM-006',
  'HHG607':'HEAVYGUM-007','HHG608':'HEAVYGUM-008',
  'LM30001':'LM30001','LM30002':'LM30002','LM30003':'LM30003','LM30004':'LM30004',
  'LM30005':'LM30005','LM30006':'LM30006','LM30009':'LM30003','LM30013':'LM30005',
  'LM30017':'LM30006',
  'QIT301':'QITBOL-001','QIT302':'QITBOL-002','QIT305':'QITBOL-005','QIT306':'QITBOL-006',
  'QIT307':'QITBOL-007','QIT601':'QITBOL-008','QIT602':'QITBOL-009','QIT603':'QITBOL-010',
  'QIT604':'QITBOL-011','QIT605':'QITBOL-012','QIT606':'QITBOL-013',
  'QIT1501':'QITBOL-015','QIT1502':'QITBOL-016','QIT1503':'QITBOL-017','QIT1504':'QITBOL-018',
  'ACC002':'ACC002','ACC007':'ACC007','ACC008':'ACC008',
};

// ── STOCK FINAL MARZO 2026 (desde INVENTARIO XLSX) ───────────────────────────
const STOCK_MAP_XLSX = {
  'BHG5001':4,
  'HHG601':3,'HHG602':2,'HHG603':2,'HHG604':3,'HHG605':1,'HHG606':3,'HHG607':3,'HHG608':4,
  'TORHG15002':20,'TORHG15003':21,'TORHG15004':20,'TORHG15006':20,'TORHG15008':60,
  'TOR-4002':4,
  'TOR010':5,'TOR011':5,'TOR012':5,'TOR013':5,'TOR014':5,'TOR015':5,'TOR016':4,'TOR017':5,
  'TOR036':5,'TOR50038':5,
  'TOR602':4,'TOR603':3,'TOR606':4,'TOR607':7,'TOR608':9,'TOR609':9,'TOR610':4,
  'BLOWPEN001':12,
  'BLOW005':17,'BLOW011':8,'BLOW012':2,'BLOW013':11,'BLOW014':4,'BLOW016':2,'BLOW017':8,
  'ELF2304':2,'ELF2305':6,'ELF2308':1,'ELF2313':7,
  'ELF40002':1,'ELF40004':47,'ELF40005':11,'ELF40006':14,'ELF40010':17,'ELF40011':10,
  'ELF40013':26,'ELF40014':17,'ELF40016':24,'ELF40017':23,'ELF40018':46,
  'ELFBC45001':1,'ELFBC45004':4,'ELFBC45006':1,'ELFBC45007':1,'ELFBC45008':2,
  'IGN30003':3,'IGN30004':2,'IGN30005':16,'IGN30018':17,'IGN30022':4,
  'IGNUS30001':19,'IGNUS30002':10,'IGNUS30003':16,'IGNUS30004':6,'IGNUS30005':2,
  'IGNVM40002':3,'IGNVM40003':4,'IGNVM40004':3,'IGNVM40005':2,'IGNVM40011':2,'IGNVM40015':2,
  'LM30001':2,'LM30002':3,'LM30006':3,'LM30009':3,'LM30013':3,'LM30017':3,
  'QIT301':15,'QIT302':10,'QIT305':11,'QIT306':1,'QIT307':4,
  'QIT601':9,'QIT602':11,'QIT603':5,'QIT604':7,'QIT605':17,'QIT606':1,
  'QIT1501':2,'QIT1502':8,'QIT1503':17,'QIT1504':6,
  'ACC002':2,'ACC007':54,'ACC008':11,
};

// ── COMPRAS MARZO 2026 ────────────────────────────────────────────────────────
const PURCHASES = [
  {
    number:168, supplier:'WOV', currency:'USD', payment_status:'paid',
    created_at:'2026-02-25T12:00:00.000Z', received_at:'2026-03-02T10:00:00.000Z',
    paid_caja:'Luciano',
    items:[
      {sku:'ELF40004',qty:25,unit_cost:9.20},{sku:'ELF40005',qty:5,unit_cost:9.20},
      {sku:'ELF40013',qty:10,unit_cost:9.20},{sku:'ELF40017',qty:10,unit_cost:9.20},
      {sku:'IGN30003',qty:30,unit_cost:9.90},{sku:'IGN30004',qty:30,unit_cost:9.90},
      {sku:'IGN30005',qty:30,unit_cost:9.90},{sku:'IGN30007',qty:30,unit_cost:9.90},
      {sku:'IGN30016',qty:10,unit_cost:9.90},{sku:'IGN30018',qty:15,unit_cost:9.90},
      {sku:'IGN30022',qty:5,unit_cost:9.90},
    ],
  },
  {
    number:169, supplier:'WOV', currency:'USD', payment_status:'paid',
    created_at:'2026-02-26T12:00:00.000Z', received_at:'2026-03-02T10:00:00.000Z',
    paid_caja:'Luciano',
    items:[
      {sku:'ELFBC45001',qty:10,unit_cost:10.60},{sku:'ELFBC45004',qty:10,unit_cost:10.60},
      {sku:'ELFBC45005',qty:5,unit_cost:10.60},{sku:'ELFBC45006',qty:5,unit_cost:10.60},
      {sku:'ELFBC45007',qty:10,unit_cost:10.60},{sku:'ELFBC45008',qty:5,unit_cost:10.60},
      {sku:'ELFBC45009',qty:5,unit_cost:10.60},
    ],
  },
  {
    number:170, supplier:'GIULIANO', currency:'USD', payment_status:'paid',
    created_at:'2026-03-06T12:00:00.000Z', received_at:'2026-03-06T12:00:00.000Z',
    paid_caja:'Santiago',
    items:[
      {sku:'TORHG15001',qty:20,unit_cost:2.50},{sku:'TORHG15002',qty:60,unit_cost:2.50},
      {sku:'TORHG15003',qty:20,unit_cost:2.50},{sku:'TORHG15004',qty:40,unit_cost:2.50},
      {sku:'TORHG15005',qty:60,unit_cost:2.50},{sku:'TORHG15006',qty:40,unit_cost:2.50},
      {sku:'TORHG15007',qty:40,unit_cost:2.50},{sku:'TORHG15008',qty:40,unit_cost:2.50},
      {sku:'TORHG15009',qty:40,unit_cost:2.50},{sku:'TORHG15010',qty:40,unit_cost:2.50},
    ],
  },
  {
    number:171, supplier:'WOV', currency:'USD', payment_status:'paid',
    created_at:'2026-03-06T12:00:00.000Z', received_at:'2026-03-11T10:00:00.000Z',
    paid_caja:'Luciano',
    items:[
      {sku:'IGNUS30001',qty:30,unit_cost:10.25},{sku:'IGNUS30002',qty:10,unit_cost:10.25},
      {sku:'IGNUS30003',qty:20,unit_cost:10.25},{sku:'IGNUS30004',qty:10,unit_cost:10.25},
      {sku:'IGNUS30005',qty:10,unit_cost:10.25},
      {sku:'ELF2304',qty:5,unit_cost:8.40},{sku:'ELF2305',qty:10,unit_cost:8.40},
      {sku:'ELF2308',qty:5,unit_cost:8.40},{sku:'ELF2313',qty:10,unit_cost:8.40},
      {sku:'ELF40002',qty:10,unit_cost:9.15},{sku:'ELF40004',qty:35,unit_cost:9.15},
      {sku:'ELF40005',qty:20,unit_cost:9.15},{sku:'ELF40006',qty:20,unit_cost:9.15},
      {sku:'ELF40010',qty:25,unit_cost:9.15},{sku:'ELF40011',qty:10,unit_cost:9.15},
      {sku:'ELF40013',qty:30,unit_cost:9.15},{sku:'ELF40014',qty:25,unit_cost:9.15},
      {sku:'ELF40015',qty:15,unit_cost:9.15},{sku:'ELF40016',qty:30,unit_cost:9.15},
      {sku:'ELF40017',qty:20,unit_cost:9.15},{sku:'ELF40018',qty:60,unit_cost:9.15},
      {sku:'IGNVM40002',qty:10,unit_cost:10.75},{sku:'IGNVM40003',qty:10,unit_cost:10.75},
      {sku:'IGNVM40004',qty:10,unit_cost:10.75},{sku:'IGNVM40005',qty:5,unit_cost:10.75},
      {sku:'IGNVM40008',qty:5,unit_cost:10.75},{sku:'IGNVM40011',qty:5,unit_cost:10.75},
      {sku:'IGNVM40015',qty:5,unit_cost:10.75},
      {sku:'LM30001',qty:5,unit_cost:8.40},{sku:'LM30002',qty:5,unit_cost:8.40},
      {sku:'LM30006',qty:5,unit_cost:8.40},{sku:'LM30009',qty:5,unit_cost:8.40},
      {sku:'LM30013',qty:5,unit_cost:8.40},{sku:'LM30017',qty:5,unit_cost:8.40},
    ],
  },
  {
    number:172, supplier:'GIULIANO', currency:'USD', payment_status:'paid',
    created_at:'2026-03-10T12:00:00.000Z', received_at:'2026-03-10T12:00:00.000Z',
    paid_caja:'Santiago',
    items:[
      {sku:'TORHG15001',qty:20,unit_cost:2.50},{sku:'TORHG15003',qty:20,unit_cost:2.50},
      {sku:'TORHG15004',qty:20,unit_cost:2.50},{sku:'TORHG15006',qty:20,unit_cost:2.50},
      {sku:'TORHG15008',qty:60,unit_cost:2.50},
      {sku:'TOR010',qty:5,unit_cost:21},{sku:'TOR011',qty:5,unit_cost:21},
      {sku:'TOR012',qty:5,unit_cost:21},{sku:'TOR013',qty:5,unit_cost:21},
      {sku:'TOR014',qty:5,unit_cost:21},{sku:'TOR015',qty:5,unit_cost:21},
      {sku:'TOR016',qty:5,unit_cost:21},{sku:'TOR017',qty:5,unit_cost:21},
      {sku:'TOR036',qty:5,unit_cost:21},{sku:'TOR50038',qty:5,unit_cost:21},
      {sku:'TOR602',qty:5,unit_cost:22},{sku:'TOR603',qty:5,unit_cost:22},
      {sku:'TOR606',qty:5,unit_cost:22},{sku:'TOR607',qty:10,unit_cost:22},
      {sku:'TOR608',qty:10,unit_cost:22},{sku:'TOR609',qty:10,unit_cost:22},
      {sku:'TOR610',qty:5,unit_cost:22},
    ],
  },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function dbSku(xlsSku) {
  if (!xlsSku) return null;
  const up = String(xlsSku).trim().toUpperCase();
  return (SKU_MAP[up] || up);
}

function excelToTs(serial, time = 'T14:00:00.000Z') {
  if (!serial || typeof serial !== 'number') return null;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().slice(0, 10) + time;
}

function normName(s) {
  return (s || '')
    .toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('════════════════════════════════════════════════');
  console.log('  CARGA COMPLETA MARZO 2026 — FULLVAPO.xlsx');
  console.log('════════════════════════════════════════════════\n');

  const wb = XLSX.readFile(XLSX_PATH);

  // ── LEER INVENTARIO DINÁMICAMENTE ─────────────────────────────────────────
  // Hoja INVENTARIO: Fila 11 = header, Col A = SKU, Col G = STOCK actual
  const wsInv = wb.Sheets['INVENTARIO'];
  const rawInv = XLSX.utils.sheet_to_json(wsInv, { header: 1, defval: null });
  const dynamicStockMap = {};
  for (const r of rawInv.slice(11)) { // skip headers
    const sku = r[0];
    const stock = r[6];
    if (sku && typeof sku === 'string' && sku.trim() && typeof stock === 'number') {
      dynamicStockMap[sku.trim().toUpperCase()] = Math.max(0, stock);
    }
  }
  const stockMapToUse = Object.keys(dynamicStockMap).length > 0 ? dynamicStockMap : STOCK_MAP_XLSX;
  console.log(`INVENTARIO XLSX: ${Object.keys(stockMapToUse).length} SKUs con stock leídos ${Object.keys(dynamicStockMap).length > 0 ? '(dinámico)' : '(fallback hardcoded)'}\n`);

  // ── LEER XLSX ──────────────────────────────────────────────────────────────
  // SALIDAS DE STOCK — Marzo 2026
  const wsSal = wb.Sheets['SALIDAS DE STOCK'];
  const rawSal = XLSX.utils.sheet_to_json(wsSal, { header: 1, defval: null });
  const salidas = rawSal.slice(11).filter(r => r[0] && String(r[2]) === '2026' && r[3] === 'Marzo');

  // Agrupar por pedido
  const pedidosMap = {};
  for (const r of salidas) {
    const nro = String(r[0]); // '#2869'
    if (!pedidosMap[nro]) {
      pedidosMap[nro] = {
        nro,
        num: parseInt(nro.replace('#', '')),
        fecha: r[1], // Excel serial
        cliente: (r[8] || 'DESCONOCIDO').trim(),
        items: [],
      };
    }
    pedidosMap[nro].items.push({
      sku: r[5],
      desc: r[6],
      qty: Number(r[7]) || 0,
      unit_price: Number(r[11]) || 0,
      subtotal: Number(r[12]) || 0,
    });
  }
  const pedidos = Object.values(pedidosMap).sort((a, b) => a.num - b.num);
  console.log(`XLSX → ${pedidos.length} pedidos en Marzo 2026 (${salidas.length} líneas)\n`);

  // FLUJO DE CAJA — Marzo 2026
  const wsFlujo = wb.Sheets['FLUJO DE CAJA'];
  const rawFlujo = XLSX.utils.sheet_to_json(wsFlujo, { header: 1, defval: null });
  const flujoMarzo = rawFlujo.slice(14).filter(r => r[0] != null && r[0] !== '' && r[2] === 'Marzo' && r[3] === '2026');

  // Mapa pedido → pagos REALES (quien != null significa que hay una caja real)
  // quien=null = nota de deuda / anotación interna, NO es un pago real de caja
  const flujoPorPedido = {};
  const flujoDeudaNotas = {}; // quien=null con monto → nota de deuda pendiente

  for (const r of flujoMarzo) {
    const op = String(r[0]).trim();
    if (!op.startsWith('#')) continue;

    if (r[6] != null) {
      // Pago real (SANTY/LUCHO/EFECTIVO) → agregar a pagos reales
      if (!flujoPorPedido[op]) flujoPorPedido[op] = [];
      flujoPorPedido[op].push({ fecha: r[1], usd: Number(r[4]) || 0, ars: Number(r[5]) || 0, quien: r[6] });
    } else {
      // quien=null con monto → anotación de deuda (registrar pero no como pago)
      const usdAmt = Number(r[4]) || 0;
      const arsAmt = Number(r[5]) || 0;
      if (usdAmt !== 0 || arsAmt !== 0) {
        if (!flujoDeudaNotas[op]) flujoDeudaNotas[op] = [];
        flujoDeudaNotas[op].push({ fecha: r[1], usd: usdAmt, ars: arsAmt, nota: r[7] || r[0] });
      }
    }
  }

  // Movimientos no-pedido (gastos, cambios, etc.)
  const flujoOtros = flujoMarzo.filter(r => {
    const op = String(r[0]).trim();
    return !op.startsWith('#');
  });

  // ── CARGAR PRODUCTOS ───────────────────────────────────────────────────────
  const { data: prods } = await supabase.from('products').select('id,sku,name');
  const skuToId = {}, skuToName = {};
  for (const p of prods) {
    skuToId[p.sku.toUpperCase()] = p.id;
    skuToName[p.sku.toUpperCase()] = p.name;
  }
  console.log(`Productos en DB: ${prods.length}\n`);

  // ── FASE 0: BORRAR DATOS XLSX MARZO ───────────────────────────────────────
  console.log('FASE 0: Borrando datos XLSX de Marzo...');

  // Obtener UUIDs de órdenes XLSX (#2869-#2966)
  const { data: xlsxOrders } = await supabase
    .from('orders').select('id,number')
    .gte('number', 2869).lte('number', 2966);
  const xlsxOrderIds = (xlsxOrders || []).map(o => o.id);
  console.log(`  → ${xlsxOrderIds.length} órdenes XLSX a borrar`);

  if (xlsxOrderIds.length > 0) {
    // Borrar deudas de esas órdenes
    const { count: dC } = await supabase.from('debts').delete().in('order_id', xlsxOrderIds).select('id', { count: 'exact', head: true });
    // Borrar inventory_movements de esas órdenes
    await supabase.from('inventory_movements').delete().in('order_id', xlsxOrderIds);
    // Borrar cash_movements de esas órdenes
    await supabase.from('cash_movements').delete().in('order_id', xlsxOrderIds);
    // Borrar órdenes (cascade borra order_items)
    await supabase.from('orders').delete().in('id', xlsxOrderIds);
    console.log('  ✓ Órdenes XLSX y sus datos eliminados');
  }

  // Borrar cash_movements de Marzo sin order_id (gastos, cambios) excepto ajustes iniciales
  const { data: cmToDel } = await supabase
    .from('cash_movements')
    .select('id')
    .gte('created_at', '2026-03-01T00:00:01Z')
    .lt('created_at', '2026-04-01T00:00:00Z')
    .is('order_id', null)
    .neq('note', 'Ajuste saldo inicial');
  if (cmToDel?.length > 0) {
    await supabase.from('cash_movements').delete().in('id', cmToDel.map(c => c.id));
    console.log(`  ✓ ${cmToDel.length} cash_movements sin orden eliminados`);
  }

  // Borrar deudas de Marzo sin order_id (stale de sesiones anteriores)
  const { data: staleDebts } = await supabase
    .from('debts')
    .select('id')
    .gte('created_at', '2026-03-01T00:00:00Z')
    .lt('created_at', '2026-04-01T00:00:00Z')
    .is('order_id', null);
  if (staleDebts?.length > 0) {
    await supabase.from('debts').delete().in('id', staleDebts.map(d => d.id));
    console.log(`  ✓ ${staleDebts.length} deudas stale eliminadas`);
  }

  // Borrar compras #168-#172
  const { data: purs } = await supabase.from('purchases').select('id').in('number', [168,169,170,171,172]);
  if (purs?.length > 0) {
    const purIds = purs.map(p => p.id);
    await supabase.from('inventory_movements').delete().in('purchase_id', purIds);
    await supabase.from('purchases').delete().in('id', purIds); // cascade purchase_items
    console.log(`  ✓ ${purIds.length} compras eliminadas`);
  }

  console.log('  ✓ Limpieza completada\n');

  // ── FASE 1: COMPRAS #168-#172 ──────────────────────────────────────────────
  console.log('FASE 1: Insertando compras #168-#172...');
  const purchaseIdMap = {}; // number → uuid

  for (const pur of PURCHASES) {
    const total = parseFloat(pur.items.reduce((s, i) => s + i.qty * i.unit_cost, 0).toFixed(2));
    const { data: purRec, error: purErr } = await supabase.from('purchases').insert({
      number: pur.number,
      supplier: pur.supplier,
      currency: pur.currency,
      total,
      paid_amount: total,
      payment_status: pur.payment_status,
      note: `Compra #${pur.number} - ${pur.supplier}`,
      created_at: pur.created_at,
    }).select('id').single();

    if (purErr) { console.log(`  ✗ Compra #${pur.number}: ${purErr.message}`); continue; }
    purchaseIdMap[pur.number] = purRec.id;

    // Purchase items
    const itemRows = pur.items.map(i => {
      const sk = dbSku(i.sku);
      return {
        purchase_id: purRec.id,
        product_id: skuToId[sk] || null,
        product_sku: sk,
        product_name: skuToName[sk] || i.sku,
        qty: i.qty,
        unit_cost: i.unit_cost,
        subtotal: parseFloat((i.qty * i.unit_cost).toFixed(2)),
      };
    }).filter(i => i.product_id);

    if (itemRows.length > 0) {
      const { error: iErr } = await supabase.from('purchase_items').insert(itemRows);
      if (iErr) console.log(`  ✗ Items compra #${pur.number}: ${iErr.message}`);
    }

    // Inventory ingresos
    const ingresos = itemRows.map(i => ({
      product_id: i.product_id,
      product_sku: i.product_sku,
      type: 'ingreso',
      qty: i.qty,
      unit_cost: i.unit_cost,
      purchase_id: purRec.id,
      note: `Compra #${pur.number} - ${pur.supplier}`,
      created_at: pur.received_at,
    }));
    if (ingresos.length > 0) {
      const { error: imErr } = await supabase.from('inventory_movements').insert(ingresos);
      if (imErr) console.log(`  ✗ Ingresos #${pur.number}: ${imErr.message}`);
    }

    console.log(`  ✓ Compra #${pur.number} | ${pur.supplier} | $${total.toFixed(2)} USD | ${itemRows.length} productos`);
  }
  console.log('');

  // ── FASE 2: CLIENTES ───────────────────────────────────────────────────────
  console.log('FASE 2: Sincronizando clientes...');
  const { data: existingCustomers } = await supabase.from('customers').select('id,name,type');
  const custNormMap = {}; // normName → {id, type}
  for (const c of existingCustomers || []) {
    custNormMap[normName(c.name)] = { id: c.id, type: c.type };
  }

  // Clientes únicos del XLSX
  const clientesXlsx = [...new Set(pedidos.map(p => p.cliente))];
  const clienteToId = {};
  const clienteToType = {};
  let nuevosClientes = 0;

  for (const nombre of clientesXlsx) {
    const norm = normName(nombre);
    if (custNormMap[norm]) {
      clienteToId[nombre] = custNormMap[norm].id;
      clienteToType[nombre] = custNormMap[norm].type;
    } else {
      // Buscar match parcial (primera palabra)
      const firstWord = norm.split(' ')[0];
      const partial = Object.entries(custNormMap).find(([k]) => k.startsWith(firstWord) && k.length < norm.length + 5);
      if (partial) {
        clienteToId[nombre] = partial[1].id;
        clienteToType[nombre] = partial[1].type;
      } else {
        // Crear nuevo cliente
        const totalPed = pedidos.filter(p => p.cliente === nombre)
          .reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.subtotal, 0), 0);
        const tipo = totalPed >= 150 ? 'wholesale' : 'retail';
        const { data: newCust, error: cErr } = await supabase.from('customers').insert({
          name: nombre,
          phone: '',
          address: '',
          type: tipo,
          status: 'active',
          code: '',
          notes: 'Importado desde XLSX Marzo 2026',
        }).select('id').single();
        if (cErr) {
          console.log(`  ✗ Cliente ${nombre}: ${cErr.message}`);
          clienteToType[nombre] = 'retail';
        } else {
          clienteToId[nombre] = newCust.id;
          clienteToType[nombre] = tipo;
          nuevosClientes++;
        }
      }
    }
  }
  console.log(`  ✓ ${clientesXlsx.length} clientes XLSX | ${nuevosClientes} nuevos creados\n`);

  // ── FASE 3: ÓRDENES ────────────────────────────────────────────────────────
  console.log('FASE 3: Insertando 98 pedidos...');
  const orderIdMap = {}; // num → uuid
  let ordOk = 0, ordErr = 0;
  const skuWarnings = new Set();

  for (const ped of pedidos) {
    const totalUsd = parseFloat(ped.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const ts = excelToTs(ped.fecha);

    // Determinar payment_status y payment_method desde FLUJO
    // Solo pagos REALES (quien != null) cuentan como pago
    const flujoPayments = flujoPorPedido[ped.nro] || [];
    const totalUsd0 = totalUsd === 0;
    let payStatus = 'unpaid';
    if (totalUsd0) {
      payStatus = 'paid'; // pedido sin costo = regalo/interno
    } else if (flujoPayments.length > 0) {
      // Calcular si cubrió el total
      const paidUsd = flujoPayments.reduce((s, p) => s + Math.abs(p.usd) + Math.abs(p.ars) / TC_MARZO, 0);
      if (paidUsd >= totalUsd - 3) payStatus = 'paid';
      else payStatus = 'partial';
    }

    // Determinar método de pago
    let payMethod = 'efectivo';
    if (flujoPayments.some(p => p.usd !== 0)) payMethod = 'usdt';
    else if (flujoPayments.some(p => p.quien && p.quien !== 'EFECTIVO')) payMethod = 'digital';

    // Tipo de orden
    const tipo = clienteToType[ped.cliente] || (totalUsd >= 150 ? 'wholesale' : 'retail');

    const { data: ordRec, error: oErr } = await supabase.from('orders').insert({
      number: ped.num,
      type: tipo,
      status: 'confirmed',
      payment_status: payStatus,
      payment_method: payMethod,
      customer_name: ped.cliente,
      customer_phone: '',
      customer_address: '',
      customer_id: clienteToId[ped.cliente] || null,
      notes: '',
      total: totalUsd,
      created_at: ts,
      confirmed_at: ts,
    }).select('id').single();

    if (oErr) {
      console.log(`  ✗ #${ped.num} ${ped.cliente}: ${oErr.message}`);
      ordErr++;
      continue;
    }
    orderIdMap[ped.num] = ordRec.id;

    // Order items
    const itmRows = ped.items
      .filter(i => i.qty > 0)
      .map(i => {
        const sk = dbSku(i.sku);
        const pid = skuToId[sk] || null;
        if (!pid) skuWarnings.add(i.sku);
        return {
          order_id: ordRec.id,
          product_id: pid,
          product_name: skuToName[sk] || i.desc || i.sku,
          product_sku: sk,
          qty: i.qty,
          unit_price: i.unit_price,
          subtotal: i.subtotal,
        };
      })
      .filter(i => i.product_id);

    if (itmRows.length > 0) {
      const { error: iErr } = await supabase.from('order_items').insert(itmRows);
      if (iErr) console.log(`  ✗ Items #${ped.num}: ${iErr.message}`);
    }

    ordOk++;
  }

  console.log(`  → ${ordOk} pedidos insertados | ${ordErr} errores`);
  if (skuWarnings.size > 0) console.log(`  ⚠ SKUs sin mapeo: ${[...skuWarnings].join(', ')}`);
  console.log('');

  // ── FASE 4: EGRESOS DE INVENTARIO ─────────────────────────────────────────
  console.log('FASE 4: Creando egresos de inventario...');
  let egOk = 0;

  for (const ped of pedidos) {
    const ordId = orderIdMap[ped.num];
    if (!ordId) continue;
    const ts = excelToTs(ped.fecha);

    const egressos = ped.items
      .filter(i => i.qty > 0)
      .map(i => {
        const sk = dbSku(i.sku);
        return {
          product_id: skuToId[sk] || null,
          product_sku: sk,
          type: 'egreso',
          qty: i.qty,
          unit_cost: 0,
          order_id: ordId,
          note: `Venta #${ped.num}`,
          created_at: ts,
        };
      })
      .filter(i => i.product_id);

    if (egressos.length > 0) {
      const { error } = await supabase.from('inventory_movements').insert(egressos);
      if (!error) egOk++;
      else console.log(`  ✗ Egreso #${ped.num}: ${error.message}`);
    }
  }
  console.log(`  → ${egOk} pedidos con egresos creados\n`);

  // ── FASE 5: MOVIMIENTOS DE CAJA ────────────────────────────────────────────
  console.log('FASE 5: Insertando movimientos de caja...');
  const cashRows = [];

  // 5a. Cobros de pedidos (sale_income)
  for (const [nroStr, payments] of Object.entries(flujoPorPedido)) {
    const num = parseInt(nroStr.replace('#', ''));
    const ordId = orderIdMap[num] || null;
    const ped = pedidosMap[nroStr];

    for (const p of payments) {
      const ts = excelToTs(p.fecha);
      if (p.ars !== 0) {
        cashRows.push({
          type: 'sale_income',
          amount: Math.abs(p.ars),
          currency: 'ARS',
          caja: toCaja(p.quien),
          category: 'ventas',
          order_id: ordId,
          note: `Pedido ${nroStr} - ${ped?.cliente || ''}`,
          created_at: ts,
        });
      }
      if (p.usd !== 0) {
        cashRows.push({
          type: 'sale_income',
          amount: Math.abs(p.usd),
          currency: 'USD',
          caja: toCaja(p.quien),
          category: 'ventas',
          order_id: ordId,
          note: `Pedido ${nroStr} - ${ped?.cliente || ''}`,
          created_at: ts,
        });
      }
    }
  }

  // Movimientos a SKIP
  const SKIP_OPS = [
    'A COBRAR USD', 'A PAGAR USD',
    'PAGO SALARIO LUCHO FEBRERO', 'PAGO SALARIO SANTY FEBRERO',
  ];

  // 5b. Otros movimientos (gastos, cambios, compras)
  for (const r of flujoOtros) {
    const op = String(r[0]).trim().toUpperCase();
    if (SKIP_OPS.some(s => op.includes(s.toUpperCase()))) continue;

    const fecha = r[1];
    const usdRaw = Number(r[4]) || 0;
    const arsRaw = Number(r[5]) || 0;
    const quien = r[6];
    const ts = excelToTs(fecha);

    // CAMBIO (transferencia entre cajas o cambio de moneda)
    if (op.startsWith('CAMBIO')) {
      if (arsRaw !== 0) {
        cashRows.push({
          type: arsRaw < 0 ? 'ajuste_out' : 'ajuste_in',
          amount: Math.abs(arsRaw),
          currency: 'ARS',
          caja: toCaja(quien),
          category: 'cambio',
          order_id: null,
          note: `${r[0]}`,
          created_at: ts,
        });
      }
      if (usdRaw !== 0) {
        cashRows.push({
          type: usdRaw < 0 ? 'ajuste_out' : 'ajuste_in',
          amount: Math.abs(usdRaw),
          currency: 'USD',
          caja: toCaja(quien),
          category: 'cambio',
          order_id: null,
          note: `${r[0]}`,
          created_at: ts,
        });
      }
      continue;
    }

    // PAGO PEDIDO (compras a proveedor) — purchase_expense
    const pagoPedidoMatch = String(r[0]).match(/PAGO PEDIDO #(\d+)/i);
    if (pagoPedidoMatch) {
      if (usdRaw !== 0) {
        cashRows.push({
          type: 'purchase_expense',
          amount: Math.abs(usdRaw),
          currency: 'USD',
          caja: toCaja(quien),
          category: 'compras',
          order_id: null,
          note: `${r[0]}`,
          created_at: ts,
        });
      }
      if (arsRaw !== 0) {
        cashRows.push({
          type: 'purchase_expense',
          amount: Math.abs(arsRaw),
          currency: 'ARS',
          caja: toCaja(quien),
          category: 'compras',
          order_id: null,
          note: `${r[0]}`,
          created_at: ts,
        });
      }
      continue;
    }

    // CORRECCION EFECTIVO — ajuste_in
    if (op.startsWith('CORRECCION')) {
      if (arsRaw !== 0) {
        cashRows.push({
          type: arsRaw > 0 ? 'ajuste_in' : 'ajuste_out',
          amount: Math.abs(arsRaw),
          currency: 'ARS',
          caja: toCaja(quien),
          category: 'ajuste',
          order_id: null,
          note: `${r[0]}`,
          created_at: ts,
        });
      }
      continue;
    }

    // Todo lo demás → manual_expense (gastos)
    if (usdRaw !== 0) {
      cashRows.push({
        type: 'manual_expense',
        amount: Math.abs(usdRaw),
        currency: 'USD',
        caja: toCaja(quien),
        category: 'gastos',
        order_id: null,
        note: `${r[0]}`,
        created_at: ts,
      });
    }
    if (arsRaw !== 0) {
      cashRows.push({
        type: arsRaw < 0 ? 'manual_expense' : 'manual_income',
        amount: Math.abs(arsRaw),
        currency: 'ARS',
        caja: toCaja(quien),
        category: 'gastos',
        order_id: null,
        note: `${r[0]}`,
        created_at: ts,
      });
    }
  }

  // Insertar en lotes
  const BATCH = 100;
  let cmOk = 0;
  for (let i = 0; i < cashRows.length; i += BATCH) {
    const batch = cashRows.slice(i, i + BATCH);
    const { error } = await supabase.from('cash_movements').insert(batch);
    if (error) console.log(`  ✗ Lote ${i}-${i+BATCH}: ${error.message}`);
    else cmOk += batch.length;
  }
  console.log(`  → ${cmOk} movimientos de caja insertados (de ${cashRows.length})\n`);

  // ── FASE 6: DEUDAS (pedidos con pago parcial o sin pago) ──────────────────
  console.log('FASE 6: Calculando deudas...');
  const debtRows = [];
  const GAP_THRESHOLD = 3; // USD mínimo para registrar diferencia como deuda

  for (const ped of pedidos) {
    const ordId = orderIdMap[ped.num];
    if (!ordId) continue;
    const totalUsd = parseFloat(ped.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    if (totalUsd === 0) continue; // pedidos internos/regalos

    // Pagos REALES (quien != null)
    const realPayments = flujoPorPedido[ped.nro] || [];
    const paidUsd = parseFloat(realPayments.reduce((s, p) => {
      return s + Math.abs(p.usd) + Math.abs(p.ars) / TC_MARZO;
    }, 0).toFixed(2));

    // Notas de deuda explícitas en FLUJO (quien=null con monto)
    const debtNotas = flujoDeudaNotas[ped.nro] || [];

    const ts = excelToTs(ped.fecha);
    const custName = ped.cliente;
    const custId = clienteToId[ped.cliente] || null;

    if (debtNotas.length > 0) {
      // Hay nota explícita de deuda → usar el monto de la nota como deuda
      for (const nota of debtNotas) {
        const debtUsd = Math.abs(nota.usd) + Math.abs(nota.ars) / TC_MARZO;
        if (debtUsd < GAP_THRESHOLD) continue;
        debtRows.push({
          type: 'receivable',
          entity_name: custName,
          entity_type: 'customer',
          entity_id: custId,
          original_amount: parseFloat(debtUsd.toFixed(2)),
          currency: 'USD',
          paid_amount: 0,
          order_id: ordId,
          note: `Pedido ${ped.nro} - ${custName} - ${nota.nota || 'debe según FLUJO'}`,
          status: 'pending',
          created_at: ts,
        });
        console.log(`  → Deuda nota #${ped.num} ${custName}: $${debtUsd.toFixed(2)} USD (${nota.nota || ''})`);
      }
    } else if (realPayments.length === 0) {
      // Sin pago real en FLUJO y sin nota de deuda → deuda por el total
      debtRows.push({
        type: 'receivable',
        entity_name: custName,
        entity_type: 'customer',
        entity_id: custId,
        original_amount: totalUsd,
        currency: 'USD',
        paid_amount: 0,
        order_id: ordId,
        note: `Pedido ${ped.nro} - ${custName} - sin cobro registrado`,
        status: 'pending',
        created_at: ts,
      });
      console.log(`  → Deuda sin pago #${ped.num} ${custName}: $${totalUsd} USD`);
    } else {
      // Tiene pagos reales → verificar si hay diferencia (pago parcial)
      const gap = parseFloat((totalUsd - paidUsd).toFixed(2));
      if (gap > GAP_THRESHOLD) {
        debtRows.push({
          type: 'receivable',
          entity_name: custName,
          entity_type: 'customer',
          entity_id: custId,
          original_amount: totalUsd,
          currency: 'USD',
          paid_amount: paidUsd,
          order_id: ordId,
          note: `Pedido ${ped.nro} - ${custName} - total $${totalUsd} / pagado $${paidUsd}`,
          status: 'partial',
          created_at: ts,
        });
        console.log(`  → Deuda parcial #${ped.num} ${custName}: debe $${gap.toFixed(2)} USD (pagó $${paidUsd} de $${totalUsd})`);
      }
    }
  }

  if (debtRows.length > 0) {
    const { error: dErr } = await supabase.from('debts').insert(debtRows);
    if (dErr) console.log(`  ✗ Deudas: ${dErr.message}`);
    else console.log(`  ✓ ${debtRows.length} deudas creadas`);
  } else {
    console.log('  ✓ Todos los pedidos tienen pago completo');
  }
  console.log('');

  // ── FASE 7: STOCK ACTUAL ───────────────────────────────────────────────────
  console.log('FASE 7: Actualizando stock_actual desde INVENTARIO XLSX...');

  // Reset a 0
  await supabase.from('products').update({ stock_actual: 0 }).gte('stock_actual', 0);
  console.log('  ✓ Stock reseteado a 0');

  let stOk = 0, stSkip = 0;
  for (const [xlsSku, qty] of Object.entries(stockMapToUse)) {
    const sk = dbSku(xlsSku);
    const pid = skuToId[sk];
    if (!pid) { stSkip++; continue; }
    const { error } = await supabase.from('products').update({ stock_actual: qty }).eq('id', pid);
    if (!error) stOk++;
    else console.log(`  ✗ ${sk}: ${error.message}`);
  }
  console.log(`  → ${stOk} productos actualizados | ${stSkip} SKUs sin match\n`);

  // ── RESUMEN FINAL ─────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════');
  console.log('  RESUMEN FINAL');
  console.log('════════════════════════════════════════════════');

  const { count: totalOrd } = await supabase
    .from('orders').select('*', { count:'exact', head:true })
    .gte('created_at','2026-03-01').lt('created_at','2026-04-01');
  const { count: xlsxOrd } = await supabase
    .from('orders').select('*', { count:'exact', head:true })
    .gte('number', 2869).lte('number', 2966);
  const { count: purCount } = await supabase.from('purchases').select('*', { count:'exact', head:true });
  const { count: imCount } = await supabase
    .from('inventory_movements').select('*', { count:'exact', head:true })
    .gte('created_at','2026-03-01').lt('created_at','2026-04-01');
  const { count: cmCount } = await supabase
    .from('cash_movements').select('*', { count:'exact', head:true })
    .gte('created_at','2026-03-01').lt('created_at','2026-04-01');
  const { count: debtCount } = await supabase
    .from('debts').select('*', { count:'exact', head:true })
    .gte('created_at','2026-03-01').lt('created_at','2026-04-01');

  console.log(`  Órdenes en Marzo (total):     ${totalOrd}`);
  console.log(`    → XLSX (#2869-#2966):        ${xlsxOrd}`);
  console.log(`    → Tienda online:             ${(totalOrd || 0) - (xlsxOrd || 0)}`);
  console.log(`  Compras cargadas:              ${purCount}`);
  console.log(`  Mov. inventario Marzo:         ${imCount}`);
  console.log(`  Mov. caja Marzo:               ${cmCount}`);
  console.log(`  Deudas Marzo:                  ${debtCount}`);

  // Totales de ventas Marzo (verificación)
  const { data: ordData } = await supabase
    .from('orders').select('total')
    .gte('number', 2869).lte('number', 2973);
  const totalVentasUsd = (ordData || []).reduce((s, o) => s + Number(o.total), 0);
  console.log(`\n  Ventas XLSX Marzo (USD):      $${totalVentasUsd.toFixed(2)}`);
  console.log('  (XLSX P&L muestra:            $17,325.60)');

  const diff = Math.abs(totalVentasUsd - 17325.60);
  const pct = (diff / 17325.60 * 100).toFixed(1);
  console.log(`  Diferencia:                   $${diff.toFixed(2)} (${pct}%)`);

  console.log('\n✅ Carga completa finalizada.');
  console.log('\n⚠  NOTA: Ajustar secuencia de pedidos en Supabase SQL:');
  console.log('   SELECT setval(\'order_number_seq\', 3000);');
}

run().catch(err => {
  console.error('\n❌ ERROR FATAL:', err.message);
  process.exit(1);
});
