/**
 * load-march-data.js
 * Script INCREMENTAL — no borra datos existentes.
 * Agrega lo que falta de Marzo 2026:
 *   FASE 1 → Compras #168-172 + purchase_items + inventory_movements (ingreso)
 *   FASE 2 → inventory_movements (egreso) para pedidos Excel #2869-#2921
 *   FASE 3 → Pedidos nuevos #2931-#2955 sin contraparte en sistema
 *   FASE 4 → stock_actual actualizado desde inventario XLSX
 *
 * Uso: node scripts/load-march-data.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── MAPA SKU XLSX → SKU DB ───────────────────────────────────────────────────
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

// ─── STOCK ACTUAL DESDE INVENTARIO XLSX (extraído 25/03/2026) ────────────────
// Incluye TODOS los productos con stock > 0; el resto se pondrá en 0.
const STOCK_MAP_XLSX = {
  // Excel SKU → stock_actual
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

// ─── COMPRAS MARZO 2026 ───────────────────────────────────────────────────────
const PURCHASES = [
  {
    number:168, supplier:'WOV', currency:'USD', payment_status:'paid',
    ordered_at:'2026-02-25T12:00:00.000Z', received_at:'2026-03-02T10:00:00.000Z',
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
    ordered_at:'2026-02-26T12:00:00.000Z', received_at:'2026-03-02T10:00:00.000Z',
    items:[
      {sku:'ELFBC45001',qty:10,unit_cost:10.60},{sku:'ELFBC45004',qty:10,unit_cost:10.60},
      {sku:'ELFBC45005',qty:5,unit_cost:10.60},{sku:'ELFBC45006',qty:5,unit_cost:10.60},
      {sku:'ELFBC45007',qty:10,unit_cost:10.60},{sku:'ELFBC45008',qty:5,unit_cost:10.60},
      {sku:'ELFBC45009',qty:5,unit_cost:10.60},
    ],
  },
  {
    number:170, supplier:'GIULIANO', currency:'USD', payment_status:'received',
    ordered_at:'2026-03-06T12:00:00.000Z', received_at:'2026-03-06T12:00:00.000Z',
    paid_amount:1000,
    items:[
      {sku:'TORHG15001',qty:20,unit_cost:2.50},{sku:'TORHG15002',qty:60,unit_cost:2.50},
      {sku:'TORHG15003',qty:20,unit_cost:2.50},{sku:'TORHG15004',qty:40,unit_cost:2.50},
      {sku:'TORHG15005',qty:60,unit_cost:2.50},{sku:'TORHG15006',qty:40,unit_cost:2.50},
      {sku:'TORHG15007',qty:40,unit_cost:2.50},{sku:'TORHG15008',qty:40,unit_cost:2.50},
      {sku:'TORHG15009',qty:40,unit_cost:2.50},{sku:'TORHG15010',qty:40,unit_cost:2.50},
    ],
  },
  {
    number:171, supplier:'WOV', currency:'USD', payment_status:'received',
    ordered_at:'2026-03-06T12:00:00.000Z', received_at:'2026-03-11T10:00:00.000Z',
    paid_amount:4607.50,
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
    ordered_at:'2026-03-10T12:00:00.000Z', received_at:'2026-03-10T12:00:00.000Z',
    paid_amount:2500,
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

// ─── PEDIDOS NUEVOS (sin contraparte en sistema live) ─────────────────────────
// Pedidos del Excel que NO están cubiertos por órdenes #1037-#1066
const NEW_ORDERS = [
  { number:2931, date:'2026-03-17', customer:'FACU TIENDA 420 GESSEL', type:'wholesale',
    items:[{sku:'TORHG15008',qty:20,usd:3.50},{sku:'BLOW013',qty:1,usd:30},{sku:'TOR016',qty:1,usd:26},{sku:'TOR607',qty:1,usd:28}],
    payment_status:'paid' },
  { number:2932, date:'2026-03-14', customer:'MAXI AXION', type:'retail',
    items:[{sku:'IGNUS30001',qty:1,usd:20.30}], payment_status:'paid' },
  { number:2933, date:'2026-03-14', customer:'VERO', type:'retail',
    items:[{sku:'ELF40016',qty:1,usd:19.60}], payment_status:'paid' },
  { number:2934, date:'2026-03-14', customer:'ALEJANDRO', type:'retail',
    items:[{sku:'IGN30004',qty:1,usd:19.60}], payment_status:'paid' },
  { number:2935, date:'2026-03-14', customer:'AXEL', type:'retail',
    items:[{sku:'TOR606',qty:1,usd:33.90}], payment_status:'paid' },
  { number:2936, date:'2026-03-18', customer:'NATALIA', type:'retail',
    items:[{sku:'IGN30017',qty:1,usd:19.60}], payment_status:'paid' },
  { number:2938, date:'2026-03-12', customer:'TOMAS PRADO', type:'retail',
    items:[{sku:'IGN30003',qty:1,usd:19.60}], payment_status:'paid' },
  { number:2939, date:'2026-03-19', customer:'ANABELA ZUNGRI', type:'retail',
    items:[{sku:'IGNVM40002',qty:1,usd:21}], payment_status:'paid' },
  { number:2951, date:'2026-03-21', customer:'MALE PERCIVALE', type:'retail',
    items:[{sku:'LM30001',qty:1,usd:18.20}], payment_status:'paid' },
  { number:2952, date:'2026-03-21', customer:'BELEN VELAZQUEZ', type:'retail',
    items:[{sku:'IGNUS30001',qty:1,usd:20.20}], payment_status:'paid' },
  { number:2953, date:'2026-03-21', customer:'MAXI AXION', type:'retail',
    items:[{sku:'ELF40015',qty:1,usd:19.60},{sku:'ELFBC45007',qty:1,usd:20.90}],
    payment_status:'paid' },
  // Internos / pérdida (sin precio)
  { number:2954, date:'2026-03-21', customer:'LUCHO', type:'retail',
    items:[{sku:'IGNUS30005',qty:1,usd:0}],
    payment_status:'paid', note:'Uso interno / pérdida' },
  { number:2955, date:'2026-03-21', customer:'MATI FUENTES', type:'retail',
    items:[{sku:'BLOW012',qty:1,usd:0}],
    payment_status:'paid', note:'Uso interno / pérdida' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function dbSku(xlsSku) {
  return (SKU_MAP[xlsSku.toUpperCase()] || xlsSku).toUpperCase();
}

async function buildSkuMaps() {
  const { data: prods, error } = await supabase.from('products').select('id,sku,name');
  if (error) throw new Error('No se pudo cargar productos: ' + error.message);
  const skuToId = {}, skuToName = {};
  for (const p of prods) {
    if (p.sku) {
      skuToId[p.sku.toUpperCase()] = p.id;
      skuToName[p.sku.toUpperCase()] = p.name;
    }
  }
  return { skuToId, skuToName };
}

function resolveProduct(xlsSku, skuToId, skuToName) {
  const mapped = dbSku(xlsSku);
  return { id: skuToId[mapped] || null, name: skuToName[mapped] || xlsSku, dbSku: mapped };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('=== CARGA INCREMENTAL MARZO 2026 ===\n');

  // Cargar mapa de productos
  const { skuToId, skuToName } = await buildSkuMaps();
  console.log(`Productos en DB: ${Object.keys(skuToId).length}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 1: COMPRAS #168-#172
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('FASE 1: Cargando compras #168-#172...');

  for (const pur of PURCHASES) {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('purchases').select('id').eq('number', pur.number).maybeSingle();

    if (existing) {
      console.log(`  ⚠️  Compra #${pur.number} ya existe (id: ${existing.id}) — saltando`);
      continue;
    }

    const total = pur.items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
    const paidAmt = pur.paid_amount ?? total;

    const { data: purRec, error: purErr } = await supabase.from('purchases').insert({
      number: pur.number,
      supplier: pur.supplier,
      currency: pur.currency,
      total: parseFloat(total.toFixed(2)),
      paid_amount: paidAmt,
      payment_status: pur.payment_status,
      note: `Pedido #${pur.number} - ${pur.supplier}`,
      created_at: pur.ordered_at,
    }).select('id').single();

    if (purErr) { console.log(`  ✗ Compra #${pur.number}: ${purErr.message}`); continue; }

    // Purchase items
    const itemRows = pur.items.map(i => {
      const { id, name, dbSku: sk } = resolveProduct(i.sku, skuToId, skuToName);
      return { purchase_id: purRec.id, product_id: id, product_sku: sk,
               product_name: name, qty: i.qty, unit_cost: i.unit_cost,
               subtotal: parseFloat((i.qty * i.unit_cost).toFixed(2)) };
    });
    const validItems = itemRows.filter(i => i.product_id);
    const skippedSkus = pur.items.filter(i => !resolveProduct(i.sku, skuToId, skuToName).id).map(i => i.sku);

    if (validItems.length > 0) {
      const { error: iErr } = await supabase.from('purchase_items').insert(validItems);
      if (iErr) { console.log(`  ✗ Items #${pur.number}: ${iErr.message}`); continue; }
    }

    // Inventory movements (ingreso) — solo si fue recibida
    if (pur.received_at && validItems.length > 0) {
      const ingresos = validItems.map(i => ({
        product_id: i.product_id,
        product_sku: i.product_sku,
        type: 'ingreso',
        qty: i.qty,
        unit_cost: i.unit_cost,
        purchase_id: purRec.id,
        note: `Compra #${pur.number} - ${pur.supplier}`,
        created_at: pur.received_at,
      }));
      const { error: imErr } = await supabase.from('inventory_movements').insert(ingresos);
      if (imErr) console.log(`  ✗ Movimientos ingreso #${pur.number}: ${imErr.message}`);
    }

    const icon = skippedSkus.length ? '⚠️' : '✓';
    console.log(`  ${icon} Compra #${pur.number} (${pur.supplier}) $${total.toFixed(2)} USD | ${validItems.length} items | ingreso: ${pur.received_at ? '✓' : 'pendiente'}`);
    if (skippedSkus.length) console.log(`      SKUs sin mapeo: ${skippedSkus.join(', ')}`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 2: EGRESO MOVEMENTS PARA PEDIDOS EXCEL #2869-#2921
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('FASE 2: Agregando movimientos de egreso a pedidos Excel existentes...');

  // Traer pedidos #2869-#2921 de la DB
  const { data: excelOrders } = await supabase.from('orders')
    .select('id, number').gte('number', 2869).lte('number', 2921).order('number');

  let egresoOk = 0, egresoSkip = 0;

  for (const order of (excelOrders || [])) {
    // Verificar si ya tiene movimientos egreso
    const { data: existingIm } = await supabase.from('inventory_movements')
      .select('id').eq('order_id', order.id).eq('type', 'egreso').limit(1);

    if (existingIm && existingIm.length > 0) {
      egresoSkip++;
      continue;
    }

    // Traer items del pedido
    const { data: items } = await supabase.from('order_items')
      .select('product_id, product_sku, qty').eq('order_id', order.id);

    if (!items || items.length === 0) continue;

    // Traer fecha de la orden
    const { data: orderData } = await supabase.from('orders')
      .select('confirmed_at, created_at').eq('id', order.id).single();
    const fechaEgreso = orderData?.confirmed_at || orderData?.created_at;

    const egressos = items.map(i => ({
      product_id: i.product_id,
      product_sku: i.product_sku,
      type: 'egreso',
      qty: i.qty,
      unit_cost: 0,
      order_id: order.id,
      note: `Venta #${order.number}`,
      created_at: fechaEgreso,
    }));

    const { error: imErr } = await supabase.from('inventory_movements').insert(egressos);
    if (imErr) {
      console.log(`  ✗ Egreso pedido #${order.number}: ${imErr.message}`);
    } else {
      egresoOk++;
    }
  }

  console.log(`  → ${egresoOk} pedidos con egresos nuevos | ${egresoSkip} ya tenían movimientos\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 3: PEDIDOS NUEVOS (#2931-#2955 sin contraparte en sistema)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('FASE 3: Insertando pedidos nuevos del Excel...');
  let newOk = 0;

  for (const ord of NEW_ORDERS) {
    // Verificar si ya existe
    const { data: existing } = await supabase.from('orders')
      .select('id').eq('number', ord.number).maybeSingle();

    if (existing) {
      console.log(`  ⚠️  Pedido #${ord.number} ya existe — saltando`);
      continue;
    }

    const totalUsd = ord.items.reduce((s, i) => s + i.qty * i.usd, 0);
    const confirmedAt = `${ord.date}T14:00:00.000Z`;

    const { data: orderRec, error: oErr } = await supabase.from('orders').insert({
      number: ord.number,
      type: ord.type,
      customer_name: ord.customer,
      customer_phone: '', customer_address: '',
      notes: ord.note || '',
      total: parseFloat(totalUsd.toFixed(2)),
      status: 'confirmed',
      payment_status: ord.payment_status,
      payment_method: ord.usd ? 'usdt' : 'efectivo',
      confirmed_at: confirmedAt,
      created_at: confirmedAt,
    }).select('id').single();

    if (oErr) { console.log(`  ✗ Pedido #${ord.number}: ${oErr.message}`); continue; }

    // Order items
    const itmRows = ord.items.map(i => {
      const { id, name, dbSku: sk } = resolveProduct(i.sku, skuToId, skuToName);
      return { order_id: orderRec.id, product_id: id, product_name: name,
               product_sku: sk, qty: i.qty, unit_price: i.usd,
               subtotal: parseFloat((i.qty * i.usd).toFixed(2)) };
    }).filter(i => i.product_id);

    if (itmRows.length > 0) {
      const { error: iErr } = await supabase.from('order_items').insert(itmRows);
      if (iErr) { console.log(`  ✗ Items #${ord.number}: ${iErr.message}`); continue; }
    }

    // Egreso inventory movements
    const egressos = itmRows.map(i => ({
      product_id: i.product_id, product_sku: i.product_sku,
      type: 'egreso', qty: i.qty, unit_cost: 0,
      order_id: orderRec.id, note: `Venta #${ord.number}`,
      created_at: confirmedAt,
    }));
    if (egressos.length > 0) {
      const { error: imErr } = await supabase.from('inventory_movements').insert(egressos);
      if (imErr) console.log(`  ✗ Egresos #${ord.number}: ${imErr.message}`);
    }

    const skipped = ord.items.filter(i => !resolveProduct(i.sku, skuToId, skuToName).id).map(i => i.sku);
    console.log(`  ✓ #${ord.number} ${ord.customer.padEnd(25)} $${totalUsd.toFixed(2)} USD${skipped.length ? ' ⚠️ sin mapeo: '+skipped.join(',') : ''}`);
    newOk++;
  }
  console.log(`  → ${newOk}/${NEW_ORDERS.length} pedidos nuevos insertados\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 4: ACTUALIZAR STOCK_ACTUAL DESDE XLSX
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('FASE 4: Actualizando stock_actual desde inventario XLSX...');

  // Primero poner todos los productos en 0
  const { error: resetErr } = await supabase.from('products')
    .update({ stock_actual: 0 }).gte('stock_actual', 0);
  if (resetErr) console.log('  ✗ Reset stock:', resetErr.message);
  else console.log('  ✓ Stock reseteado a 0 para todos los productos');

  // Luego actualizar los que tienen stock > 0
  let stockOk = 0, stockErr = 0, stockSkip = 0;

  for (const [xlsSku, qty] of Object.entries(STOCK_MAP_XLSX)) {
    const mapped = dbSku(xlsSku);
    const prodId = skuToId[mapped];

    if (!prodId) {
      console.log(`  ⚠️  SKU sin producto en DB: ${xlsSku} → ${mapped}`);
      stockSkip++;
      continue;
    }

    const { error: updErr } = await supabase.from('products')
      .update({ stock_actual: qty }).eq('id', prodId);

    if (updErr) {
      console.log(`  ✗ ${mapped}: ${updErr.message}`);
      stockErr++;
    } else {
      console.log(`  ✓ ${mapped.padEnd(28)} → ${qty}`);
      stockOk++;
    }
  }

  console.log(`\n  → ${stockOk} productos actualizados | ${stockSkip} SKUs no encontrados | ${stockErr} errores`);

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== RESUMEN FINAL ===');
  const { data: totalPurchases } = await supabase.from('purchases').select('id', { count:'exact', head:true }).gte('created_at','2026-02-24').lte('created_at','2026-04-01');
  const { count: totalOrders } = await supabase.from('orders').select('*', { count:'exact', head:true }).gte('created_at','2026-03-01').lte('created_at','2026-03-31T23:59:59');
  const { count: totalIm } = await supabase.from('inventory_movements').select('*', { count:'exact', head:true }).gte('created_at','2026-02-24').lte('created_at','2026-04-01');
  const { count: totalCm } = await supabase.from('cash_movements').select('*', { count:'exact', head:true }).gte('created_at','2026-03-01').lte('created_at','2026-03-31T23:59:59');

  console.log(`  Compras en DB:               ${totalPurchases?.length ?? '?'}`);
  console.log(`  Pedidos en marzo:             ${totalOrders ?? '?'}`);
  console.log(`  Movimientos de inventario:    ${totalIm ?? '?'}`);
  console.log(`  Movimientos de caja:          ${totalCm ?? '?'}`);
  console.log('\n✅ Carga incremental completada.');
}

run().catch(err => { console.error('ERROR FATAL:', err); process.exit(1); });
