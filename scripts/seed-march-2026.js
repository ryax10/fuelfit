/**
 * seed-march-2026.js
 * Carga histórica de datos de Marzo 2026
 * Traduce SKUs del Excel a SKUs de la DB y carga:
 *   - 4 compras (#168-#171)
 *   - 37 pedidos de venta (#2869-#2907)
 *   - Movimientos de caja extra (gastos, cambios)
 *   - 3 deudas (A Cobrar / A Pagar)
 * NO modifica stock_actual ni cajas existentes
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FX = 1472; // ARS/USD referencia marzo 2026

// ─── MAPA DE TRADUCCIÓN: SKU Excel → SKU en DB ────────────────────────────────
const SKU_MAP = {
  // ELFBAR ICE KING 40000 → coincide exacto
  'ELF40001':'ELF40001','ELF40002':'ELF40002','ELF40003':'ELF40003',
  'ELF40004':'ELF40004','ELF40005':'ELF40005','ELF40006':'ELF40006',
  'ELF40007':'ELF40007','ELF40008':'ELF40008','ELF40009':'ELF40009',
  'ELF40010':'ELF40010','ELF40011':'ELF40011','ELF40012':'ELF40012',
  'ELF40013':'ELF40013','ELF40014':'ELF40014','ELF40015':'ELF40015',
  'ELF40016':'ELF40016','ELF40017':'ELF40017','ELF40018':'ELF40018',
  'ELF40019':'ELF40019','ELF40020':'ELF40020',
  // ELFBAR BC 45000 (ELFBC45XXX → ELFBABC4-XXX)
  'ELFBC45001':'ELFBABC4-001','ELFBC45002':'ELFBABC4-002','ELFBC45003':'ELFBABC4-003',
  'ELFBC45004':'ELFBABC4-004','ELFBC45005':'ELFBABC4-005','ELFBC45006':'ELFBABC4-006',
  'ELFBC45007':'ELFBABC4-007','ELFBC45008':'ELFBABC4-008','ELFBC45009':'ELFBABC4-009',
  // ELFBAR GH 23000 (ELF23XX → ELFBAGH2-XXX)
  'ELF2301':'ELFBAGH2-001','ELF2302':'ELFBAGH2-002','ELF2303':'ELFBAGH2-003',
  'ELF2304':'ELFBAGH2-004','ELF2305':'ELFBAGH2-005','ELF2306':'ELFBAGH2-006',
  'ELF2307':'ELFBAGH2-007','ELF2308':'ELFBAGH2-008','ELF2309':'ELFBAGH2-009',
  'ELF2310':'ELFBAGH2-010','ELF2311':'ELFBAGH2-011','ELF2312':'ELFBAGH2-012',
  'ELF2313':'ELFBAGH2-013','ELF2314':'ELFBAGH2-014','ELF2315':'ELFBAGH2-015',
  'ELF2316':'ELFBAGH2-016',
  // IGNITE V300 30000 BLACK (IGN30XXX → IGNITV30-0XX)
  'IGN30001':'IGNITV30-001','IGN30002':'IGNITV30-002','IGN30003':'IGNITV30-003',
  'IGN30004':'IGNITV30-004','IGN30005':'IGNITV30-005','IGN30006':'IGNITV30-006',
  'IGN30007':'IGNITV30-007','IGN30008':'IGNITV30-008','IGN30009':'IGNITV30-009',
  'IGN30010':'IGNITV30-010','IGN30011':'IGNITV30-011','IGN30012':'IGNITV30-012',
  'IGN30013':'IGNITV30-013','IGN30014':'IGNITV30-014','IGN30015':'IGNITV30-015',
  'IGN30016':'IGNITV30-016','IGN30017':'IGNITV30-017','IGN30018':'IGNITV30-018',
  'IGN30019':'IGNITV30-019','IGN30020':'IGNITV30-020','IGN30021':'IGNITV30-021',
  'IGN30022':'IGNITV30-022',
  // IGNITE V300 ULTRA SLIM (IGNUS30XXX → IGN-V300-US-BLACKXXX)
  'IGNUS30001':'IGN-V300-US-BLACK001','IGNUS30002':'IGN-V300-US-BLACK002',
  'IGNUS30003':'IGN-V300-US-BLACK003','IGNUS30004':'IGN-V300-US-BLACK004',
  'IGNUS30005':'IGN-V300-US-BLACK005',
  // IGNITE V400 MIX (IGNVM40XXX → IGNITV40-0XX)
  'IGNVM40001':'IGNITV40-001','IGNVM40002':'IGNITV40-002','IGNVM40003':'IGNITV40-003',
  'IGNVM40004':'IGNITV40-004','IGNVM40005':'IGNITV40-005','IGNVM40006':'IGNITV40-006',
  'IGNVM40007':'IGNITV40-007','IGNVM40008':'IGNITV40-008','IGNVM40009':'IGNITV40-009',
  'IGNVM40010':'IGNITV40-010','IGNVM40011':'IGNITV40-011','IGNVM40012':'IGNITV40-012',
  'IGNVM40013':'IGNITV40-013','IGNVM40014':'IGNITV40-014','IGNVM40015':'IGNITV40-015',
  'IGNVM40016':'IGNITV40-016',
  // BLOW RECARGAS 3ML (BLOWRECXXX → BLOWREC-XXX con dash)
  'BLOWREC001':'BLOWREC-001','BLOWREC002':'BLOWREC-002','BLOWREC003':'BLOWREC-003',
  'BLOWREC004':'BLOWREC-004','BLOWREC005':'BLOWREC-005','BLOWREC006':'BLOWREC-006',
  'BLOWREC007':'BLOWREC-007','BLOWREC008':'BLOWREC-008','BLOWREC009':'BLOWREC-009',
  'BLOWREC010':'BLOWREC-010','BLOWREC011':'BLOWREC-011','BLOWREC012':'BLOWREC-012',
  'BLOWREC013':'BLOWREC-013',
  // BLOW 3.5G (BLOW0XX → BLOW35G-0XX)
  'BLOW001':'BLOW35G-001','BLOW002':'BLOW35G-002','BLOW003':'BLOW35G-003',
  'BLOW004':'BLOW35G-004','BLOW005':'BLOW35G-005','BLOW006':'BLOW35G-006',
  'BLOW007':'BLOW35G-007','BLOW008':'BLOW35G-008','BLOW009':'BLOW35G-009',
  'BLOW010':'BLOW35G-010','BLOW011':'BLOW35G-011','BLOW012':'BLOW35G-012',
  'BLOW013':'BLOW35G-013','BLOW014':'BLOW35G-014','BLOW015':'BLOW35G-015',
  'BLOW016':'BLOW35G-016','BLOW017':'BLOW35G-017','BLOW018':'BLOW35G-018',
  // TORCH HULK GUMMIES (TORHG15XXX → TORCHHUL-00X)
  'TORHG15001':'TORCHHUL-001','TORHG15002':'TORCHHUL-002','TORHG15003':'TORCHHUL-003',
  'TORHG15004':'TORCHHUL-004','TORHG15005':'TORCHHUL-005','TORHG15006':'TORCHHUL-006',
  'TORHG15007':'TORCHHUL-007','TORHG15008':'TORCHHUL-008','TORHG15009':'TORCHHUL-009',
  // TORCH 6.0G SATIVA (TOR6XX → TORCH60G-0XX) — mapeo por número de sabor
  'TOR601':'TORCH60G-011','TOR602':'TORCH60G-012','TOR603':'TORCH60G-013',
  'TOR604':'TORCH60G-014','TOR605':'TORCH60G-018','TOR606':'TORCH60G-016',
  'TOR607':'TORCH60G-005','TOR608':'TORCH60G-021','TOR609':'TORCH60G-019',
  'TOR610':'TORCH60G-022',
  // PHENOM 6.0G MUSHROOM (PHE0XX → PHENO60G-0XX) — mapeo por sabor
  'PHE008':'PHENO60G-019','PHE009':'PHENO60G-020','PHE010':'PHENO60G-018',
  'PHE011':'PHENO60G-022','PHE012':'PHENO60G-023','PHE013':'PHENO60G-024',
  'PHE014':'PHENO60G-025',
  // TORCH 4.0G (TOR-40XX → TORCH40G-0XX)
  'TOR-4001':'TORCH40G-001','TOR-4002':'TORCH40G-004','TOR-4003':'TORCH40G-003',
  'TOR-4004':'TORCH40G-005',
  // HALF BAKED GUMMIES (HBG84XX → HALFBGUM-00X)
  'HBG8401':'HALFBGUM-001','HBG8402':'HALFBGUM-002','HBG8403':'HALFBGUM-003',
  'HBG8404':'HALFBGUM-004',
  // LOST MARY MIXER 30000 (coincide exacto)
  'LM30001':'LM30001','LM30002':'LM30002','LM30003':'LM30003','LM30004':'LM30004',
  'LM30005':'LM30005','LM30006':'LM30006','LM30009':'LM30003','LM30013':'LM30005',
  'LM30017':'LM30006',
};

// ─── COMPRAS (#168, #169, #170 recibidas; #171 en camino) ─────────────────────
const PURCHASES = [
  {
    number: 168, supplier: 'WOV', currency: 'USD', payment_status: 'paid',
    ordered_at: '2026-02-25T12:00:00', received_at: '2026-03-02T10:00:00',
    items: [
      {sku:'ELF40004',qty:25,unit_cost:9.20},{sku:'ELF40005',qty:5,unit_cost:9.20},
      {sku:'ELF40013',qty:10,unit_cost:9.20},{sku:'ELF40017',qty:10,unit_cost:9.20},
      {sku:'IGN30003',qty:30,unit_cost:9.90},{sku:'IGN30004',qty:30,unit_cost:9.90},
      {sku:'IGN30005',qty:30,unit_cost:9.90},{sku:'IGN30007',qty:30,unit_cost:9.90},
      {sku:'IGN30016',qty:10,unit_cost:9.90},{sku:'IGN30018',qty:15,unit_cost:9.90},
      {sku:'IGN30022',qty:5,unit_cost:9.90},
    ],
  },
  {
    number: 169, supplier: 'WOV', currency: 'USD', payment_status: 'paid',
    ordered_at: '2026-02-26T12:00:00', received_at: '2026-03-02T10:00:00',
    items: [
      {sku:'ELFBC45001',qty:10,unit_cost:10.60},{sku:'ELFBC45004',qty:10,unit_cost:10.60},
      {sku:'ELFBC45005',qty:5,unit_cost:10.60},{sku:'ELFBC45006',qty:5,unit_cost:10.60},
      {sku:'ELFBC45007',qty:10,unit_cost:10.60},{sku:'ELFBC45008',qty:5,unit_cost:10.60},
      {sku:'ELFBC45009',qty:5,unit_cost:10.60},
    ],
  },
  {
    number: 170, supplier: 'GIULIANO', currency: 'USD', payment_status: 'paid',
    ordered_at: '2026-03-06T12:00:00', received_at: '2026-03-06T12:00:00',
    items: [
      {sku:'TORHG15001',qty:20,unit_cost:2.50},{sku:'TORHG15002',qty:60,unit_cost:2.50},
      {sku:'TORHG15003',qty:20,unit_cost:2.50},{sku:'TORHG15004',qty:40,unit_cost:2.50},
      {sku:'TORHG15005',qty:60,unit_cost:2.50},{sku:'TORHG15006',qty:40,unit_cost:2.50},
      {sku:'TORHG15007',qty:40,unit_cost:2.50},{sku:'TORHG15008',qty:40,unit_cost:2.50},
      {sku:'TORHG15009',qty:40,unit_cost:2.50},
    ],
  },
  {
    number: 171, supplier: 'WOV', currency: 'USD', payment_status: 'partial',
    ordered_at: '2026-03-06T12:00:00', received_at: null,
    items: [
      {sku:'IGNUS30001',qty:0,unit_cost:10.25},{sku:'IGNUS30002',qty:0,unit_cost:10.25},
      {sku:'IGNUS30003',qty:0,unit_cost:10.25},{sku:'IGNUS30004',qty:0,unit_cost:10.25},
      {sku:'IGNUS30005',qty:0,unit_cost:10.25},
      {sku:'ELF2304',qty:0,unit_cost:8.40},{sku:'ELF2305',qty:0,unit_cost:8.40},
      {sku:'ELF2308',qty:0,unit_cost:8.40},{sku:'ELF2313',qty:0,unit_cost:8.40},
      {sku:'ELF40002',qty:0,unit_cost:9.15},{sku:'ELF40004',qty:0,unit_cost:9.15},
      {sku:'ELF40005',qty:0,unit_cost:9.15},{sku:'ELF40006',qty:0,unit_cost:9.15},
      {sku:'ELF40010',qty:0,unit_cost:9.15},{sku:'ELF40011',qty:0,unit_cost:9.15},
      {sku:'ELF40013',qty:0,unit_cost:9.15},{sku:'ELF40014',qty:0,unit_cost:9.15},
      {sku:'ELF40015',qty:0,unit_cost:9.15},{sku:'ELF40016',qty:0,unit_cost:9.15},
      {sku:'ELF40017',qty:0,unit_cost:9.15},{sku:'ELF40018',qty:0,unit_cost:9.15},
      {sku:'IGNVM40002',qty:0,unit_cost:10.75},{sku:'IGNVM40003',qty:0,unit_cost:10.75},
      {sku:'IGNVM40004',qty:0,unit_cost:10.75},{sku:'IGNVM40005',qty:0,unit_cost:10.75},
      {sku:'IGNVM40008',qty:0,unit_cost:10.75},{sku:'IGNVM40011',qty:0,unit_cost:10.75},
      {sku:'IGNVM40015',qty:0,unit_cost:10.75},
      {sku:'LM30001',qty:0,unit_cost:8.40},{sku:'LM30002',qty:0,unit_cost:8.40},
      {sku:'LM30006',qty:0,unit_cost:8.40},{sku:'LM30009',qty:0,unit_cost:8.40},
      {sku:'LM30013',qty:0,unit_cost:8.40},{sku:'LM30017',qty:0,unit_cost:8.40},
    ],
  },
];

// ─── PEDIDOS DE VENTA ─────────────────────────────────────────────────────────
const ORDERS = [
  { number:2869, date:'2026-03-02', customer:'AGUS KAYA GROW', type:'wholesale',
    items:[
      {sku:'TOR603',qty:1,usd:26},{sku:'TOR606',qty:1,usd:26},{sku:'TOR610',qty:1,usd:26},
      {sku:'PHE008',qty:1,usd:31},{sku:'PHE011',qty:2,usd:31},{sku:'PHE012',qty:1,usd:31},
      {sku:'PHE013',qty:2,usd:31},{sku:'ELF40013',qty:1,usd:13},{sku:'ELF40014',qty:2,usd:13},
      {sku:'ELF40016',qty:1,usd:13},{sku:'ELF40017',qty:1,usd:13},{sku:'ELF40018',qty:1,usd:13},
    ], payment_ars:501714, caja_ars:'Santiago' },
  { number:2870, date:'2026-03-02', customer:'CAMI', type:'wholesale',
    items:[
      {sku:'ELF40004',qty:6,usd:13},{sku:'ELF40009',qty:1,usd:13},{sku:'ELF40010',qty:2,usd:13},
      {sku:'ELF40012',qty:2,usd:13},{sku:'ELF40013',qty:2,usd:13},{sku:'ELF40016',qty:1,usd:13},
      {sku:'ELF40017',qty:1,usd:13},
    ], payment_usd:195, caja_usd:'Santiago' },
  { number:2871, date:'2026-03-02', customer:'GABRIELA', type:'retail',
    items:[{sku:'PHE011',qty:1,usd:41.80}], payment_ars:62000, caja_ars:'Santiago' },
  { number:2872, date:'2026-03-02', customer:'VERONICA MALDONADO', type:'retail',
    items:[{sku:'ELF40016',qty:1,usd:19.50}], payment_ars:29000, caja_ars:'Santiago' },
  { number:2873, date:'2026-03-02', customer:'KIOSCO VIDELA', type:'wholesale',
    items:[
      {sku:'ELF40014',qty:1,usd:13},{sku:'ELF40016',qty:1,usd:13},{sku:'ELF40018',qty:1,usd:13},
      {sku:'IGN30002',qty:1,usd:13.20},{sku:'IGN30007',qty:1,usd:13.20},
    ], payment_usd:65.4, caja_usd:'Santiago' },
  { number:2874, date:'2026-03-03', customer:'LUCAS LA BOMBA', type:'wholesale',
    items:[
      {sku:'ELF40005',qty:3,usd:13},{sku:'ELF40014',qty:1,usd:13},{sku:'ELF40017',qty:1,usd:13},
      {sku:'ELF40013',qty:5,usd:13},{sku:'ELF40016',qty:5,usd:13},{sku:'ELF40018',qty:5,usd:13},
    ], payment_ars:382720, caja_ars:'Santiago' },
  { number:2875, date:'2026-03-03', customer:'KIOSCO FRIENDS ROMAN', type:'wholesale',
    items:[
      {sku:'ELF40004',qty:5,usd:12},{sku:'ELF40005',qty:8,usd:12},{sku:'ELF40009',qty:19,usd:12},
      {sku:'ELF40010',qty:8,usd:12},{sku:'ELF40012',qty:7,usd:12},{sku:'ELF40013',qty:10,usd:12},
      {sku:'ELF40014',qty:4,usd:12},{sku:'ELF40016',qty:12,usd:12},{sku:'ELF40017',qty:2,usd:12},
      {sku:'ELF40018',qty:5,usd:12},{sku:'IGN30001',qty:5,usd:12.20},{sku:'IGN30003',qty:5,usd:12.20},
      {sku:'IGN30004',qty:5,usd:12.20},{sku:'IGN30007',qty:5,usd:12.20},
    ], payment_usd:1200, caja_usd:'Santiago', payment_ars:6000, caja_ars:'Santiago' },
  { number:2876, date:'2026-03-03', customer:'MEL BARATS GROW', type:'wholesale',
    items:[
      {sku:'ELF40004',qty:1,usd:13},{sku:'ELF40005',qty:1,usd:13},{sku:'ELF40012',qty:1,usd:13},
      {sku:'ELF40013',qty:1,usd:13},{sku:'ELF40014',qty:2,usd:13},{sku:'ELF40016',qty:1,usd:13},
      {sku:'ELF40017',qty:2,usd:13},{sku:'ELF40018',qty:1,usd:13},
      {sku:'IGN30001',qty:1,usd:13.20},{sku:'IGN30002',qty:1,usd:13.20},{sku:'IGN30003',qty:1,usd:13.20},
      {sku:'IGN30004',qty:1,usd:13.20},{sku:'IGN30005',qty:1,usd:13.20},{sku:'IGN30007',qty:1,usd:13.20},
      {sku:'IGN30014',qty:1,usd:13.20},{sku:'IGN30015',qty:1,usd:13.20},{sku:'IGN30017',qty:1,usd:13.20},
      {sku:'IGN30018',qty:1,usd:13.20},
    ], payment_ars:383500, caja_ars:'Efectivo' },
  { number:2877, date:'2026-03-03', customer:'LU', type:'wholesale',
    items:[
      {sku:'ELF40005',qty:1,usd:13},{sku:'ELF40004',qty:1,usd:13},{sku:'ELF40013',qty:2,usd:13},
      {sku:'ELF40014',qty:1,usd:13},{sku:'ELF40016',qty:2,usd:13},{sku:'ELF40017',qty:3,usd:13},
      {sku:'ELF40018',qty:2,usd:13},{sku:'ELFBC45001',qty:2,usd:15},{sku:'ELFBC45004',qty:2,usd:15},
      {sku:'ELFBC45005',qty:2,usd:15},{sku:'ELFBC45006',qty:2,usd:15},{sku:'ELFBC45007',qty:2,usd:15},
      {sku:'ELFBC45009',qty:2,usd:15},
    ], payment_ars:100000, caja_ars:'Santiago', note:'LU DEBE 289 USD' },
  { number:2878, date:'2026-03-03', customer:'LUCAS LA BOMBA', type:'wholesale',
    items:[{sku:'TORHG15008',qty:20,usd:3.50}],
    payment_ars:102620, caja_ars:'Santiago' },
  { number:2879, date:'2026-03-03', customer:'BELEN VELAZQUEZ', type:'retail',
    items:[{sku:'IGN30002',qty:1,usd:19.70}], payment_ars:29000, caja_ars:'Luciano' },
  { number:2880, date:'2026-03-03', customer:'ABEL TROCHE', type:'retail',
    items:[{sku:'TORHG15003',qty:2,usd:6.10}], payment_ars:18000, caja_ars:'Luciano' },
  { number:2881, date:'2026-03-03', customer:'MANU', type:'wholesale',
    items:[
      {sku:'IGN30001',qty:2,usd:13.20},{sku:'IGN30002',qty:4,usd:13.20},
      {sku:'IGN30004',qty:4,usd:13.20},{sku:'IGN30007',qty:3,usd:13.20},
      {sku:'IGN30016',qty:2,usd:13.20},
    ], payment_ars:291000, caja_ars:'Luciano' },
  { number:2882, date:'2026-03-04', customer:'BRENDA', type:'retail',
    items:[{sku:'ELF40017',qty:1,usd:19.70}], payment_ars:29000, caja_ars:'Santiago' },
  { number:2883, date:'2026-03-04', customer:'BRENDA', type:'retail',
    items:[{sku:'ELF40004',qty:1,usd:19.70},{sku:'ELF40017',qty:1,usd:19.70}],
    payment_ars:58000, caja_ars:'Santiago' },
  { number:2884, date:'2026-03-04', customer:'GIULI', type:'retail',
    items:[{sku:'TORHG15008',qty:20,usd:4.10},{sku:'BLOW012',qty:1,usd:47.60}],
    payment_ars:190000, caja_ars:'Santiago' },
  { number:2885, date:'2026-03-04', customer:'VEGA', type:'retail', is_internal:true,
    items:[{sku:'TOR603',qty:1,usd:0},{sku:'TOR606',qty:1,usd:0}],
    note:'MUESTRA/DEVOLUCIÓN' },
  { number:2886, date:'2026-03-05', customer:'FRAN BALOGH', type:'wholesale',
    items:[
      {sku:'ELF40004',qty:5,usd:12.15},{sku:'ELF40005',qty:1,usd:12.15},{sku:'ELF40013',qty:10,usd:12.15},
      {sku:'ELF40014',qty:11,usd:12.15},{sku:'ELF40016',qty:1,usd:12.15},{sku:'ELF40017',qty:10,usd:12.15},
      {sku:'ELF40018',qty:12,usd:12.15},{sku:'IGN30001',qty:10,usd:12.35},{sku:'IGN30002',qty:7,usd:12.35},
      {sku:'IGN30003',qty:10,usd:12.35},{sku:'IGN30004',qty:5,usd:12.35},{sku:'IGN30005',qty:5,usd:12.35},
      {sku:'IGN30007',qty:10,usd:12.35},{sku:'IGN30014',qty:3,usd:12.35},
    ], payment_usd:1230, caja_usd:'Santiago', note:'FRAN BALOGH TIENE 5 USD A FAVOR' },
  { number:2887, date:'2026-03-05', customer:'MAXI AXION', type:'retail',
    items:[{sku:'IGN30001',qty:1,usd:19.70},{sku:'IGN30016',qty:1,usd:19.70}],
    payment_ars:58000, caja_ars:'Luciano' },
  { number:2888, date:'2026-03-05', customer:'YANI', type:'retail',
    items:[{sku:'IGN30001',qty:1,usd:19.70},{sku:'IGN30014',qty:1,usd:19.70}],
    payment_ars:58000, caja_ars:'Luciano' },
  { number:2889, date:'2026-03-05', customer:'ABEL TROCHE', type:'retail',
    items:[{sku:'TORHG15003',qty:5,usd:4.75}], payment_ars:35000, caja_ars:'Luciano' },
  { number:2890, date:'2026-03-05', customer:'BELLA', type:'retail',
    items:[{sku:'HBG8401',qty:1,usd:19.70}], payment_ars:29000, caja_ars:'Santiago' },
  { number:2891, date:'2026-03-05', customer:'MORA', type:'retail',
    items:[{sku:'TOR-4002',qty:1,usd:37.30}], payment_ars:55000, caja_ars:'Efectivo' },
  { number:2892, date:'2026-03-05', customer:'CATA', type:'retail',
    items:[{sku:'ELF40005',qty:1,usd:19.70}], payment_ars:29000, caja_ars:'Efectivo' },
  { number:2893, date:'2026-03-06', customer:'MEL BARATS GROW', type:'wholesale',
    items:[
      {sku:'PHE008',qty:2,usd:33},{sku:'PHE011',qty:2,usd:33},
      {sku:'PHE012',qty:2,usd:33},{sku:'PHE013',qty:2,usd:33},
    ], payment_ars:389000, caja_ars:'Santiago' },
  { number:2894, date:'2026-03-06', customer:'GUADALUPE', type:'retail',
    items:[{sku:'ELF2313',qty:1,usd:18.30}], payment_ars:27000, caja_ars:'Efectivo' },
  { number:2895, date:'2026-03-06', customer:'LU', type:'retail',
    items:[{sku:'IGN30017',qty:1,usd:19.70}], payment_ars:29000, caja_ars:'Santiago' },
  { number:2896, date:'2026-03-06', customer:'SANTINO', type:'retail',
    items:[{sku:'ELF40014',qty:1,usd:19.70}], payment_ars:29000, caja_ars:'Efectivo' },
  { number:2897, date:'2026-03-06', customer:'CARLA', type:'retail',
    items:[{sku:'ELF40017',qty:1,usd:19.70}], payment_ars:29000, caja_ars:'Luciano' },
  { number:2898, date:'2026-03-07', customer:'NICO NVDRINKS', type:'wholesale',
    items:[{sku:'TORHG15002',qty:20,usd:3.50}],
    payment_ars:102830, caja_ars:'Santiago' },
  { number:2899, date:'2026-03-07', customer:'BRIAN MONTEGRANDE', type:'wholesale',
    items:[
      {sku:'IGN30003',qty:2,usd:13.20},{sku:'IGN30005',qty:2,usd:13.20},
      {sku:'IGN30007',qty:2,usd:13.20},{sku:'IGN30015',qty:3,usd:13.20},
      {sku:'IGN30016',qty:1,usd:13.20},
    ], payment_ars:193512, caja_ars:'Santiago' },
  { number:2900, date:'2026-03-07', customer:'LUCAS LA BOMBA', type:'wholesale',
    items:[
      {sku:'TOR603',qty:2,usd:26},{sku:'TOR606',qty:2,usd:26},
      {sku:'TOR609',qty:2,usd:26},{sku:'TOR610',qty:4,usd:26},
    ], payment_ars:382200, caja_ars:'Santiago' },
  { number:2901, date:'2026-03-09', customer:'MAXI RDF', type:'wholesale',
    items:[
      {sku:'BLOWREC001',qty:2,usd:26},{sku:'BLOWREC002',qty:1,usd:26},{sku:'BLOWREC004',qty:1,usd:26},
      {sku:'BLOWREC005',qty:1,usd:26},{sku:'BLOWREC006',qty:1,usd:26},{sku:'BLOWREC009',qty:1,usd:26},
      {sku:'BLOWREC012',qty:1,usd:26},{sku:'BLOWREC013',qty:2,usd:26},{sku:'ELF40014',qty:17,usd:13},
    ], payment_usd:481, caja_usd:'Santiago' },
  { number:2902, date:'2026-03-07', customer:'LUCIANO CONTI', type:'retail', is_internal:true,
    items:[{sku:'BLOWREC002',qty:1,usd:0}], note:'LUCHO PRUEBA DESCARTABLE' },
  { number:2903, date:'2026-03-09', customer:'MAXI RDF', type:'wholesale',
    items:[
      {sku:'BLOW011',qty:2,usd:28},{sku:'BLOW012',qty:3,usd:28},
      {sku:'BLOW017',qty:2,usd:28},{sku:'BLOW018',qty:2,usd:28},
    ], payment_usd:252, caja_usd:'Santiago' },
  { number:2904, date:'2026-03-09', customer:'POLI BENITEZ', type:'retail',
    items:[{sku:'ELFBC45001',qty:1,usd:21}], payment_ars:31000, caja_ars:'Efectivo' },
  { number:2905, date:'2026-03-09', customer:'ALBERTO', type:'retail',
    items:[{sku:'ELFBC45004',qty:1,usd:21}], payment_ars:31000, caja_ars:'Santiago' },
  { number:2906, date:'2026-03-09', customer:'SANTIAGO MARINO', type:'retail', is_internal:true,
    items:[{sku:'BLOW013',qty:1,usd:0}], note:'SANTY USO PERSONAL' },
  { number:2907, date:'2026-03-09', customer:'DIEGO IL LUPO', type:'wholesale',
    items:[
      {sku:'BLOW017',qty:1,usd:30},{sku:'BLOW013',qty:1,usd:30},
      {sku:'IGN30003',qty:1,usd:13.35},{sku:'IGN30007',qty:1,usd:13.35},
    ], payment_usd:99.30, caja_usd:'Santiago' },
];

// ─── GASTOS Y MOVIMIENTOS EXTRA ───────────────────────────────────────────────
const EXTRA_CASH = [
  { date:'2026-03-02', type:'manual_expense', amount:3000000, currency:'ARS', caja:'Santiago', note:'Salario Luciano - Febrero 2026', category:'salarios' },
  { date:'2026-03-02', type:'manual_expense', amount:3000000, currency:'ARS', caja:'Luciano',  note:'Salario Santiago - Febrero 2026', category:'salarios' },
  { date:'2026-03-02', type:'manual_expense', amount:50000,   currency:'ARS', caja:'Santiago', note:'Seña cartel local', category:'marketing' },
  { date:'2026-03-03', type:'manual_expense', amount:270300,  currency:'ARS', caja:'Efectivo', note:'Pago placas', category:'marketing' },
  { date:'2026-03-05', type:'manual_expense', amount:6800,    currency:'ARS', caja:'Santiago', note:'Compra pegamento', category:'insumos' },
  { date:'2026-03-05', type:'manual_expense', amount:222,     currency:'USD', caja:'Santiago', note:'Otros egresos USD 05/03', category:'varios' },
  { date:'2026-03-04', type:'manual_expense', amount:3.40,    currency:'USD', caja:'Santiago', note:'Otros egresos USD 04/03', category:'varios' },
  { date:'2026-03-04', type:'manual_expense', amount:5000,    currency:'ARS', caja:'Efectivo', note:'Moto equivocación Giuliana', category:'logistica' },
  { date:'2026-03-06', type:'purchase_expense', amount:1000,    currency:'USD', caja:'Santiago', note:'Pago Pedido #170 - GIULIANO (gummies)', category:'compras' },
  { date:'2026-03-06', type:'purchase_expense', amount:4607.50, currency:'USD', caja:'Luciano',  note:'Pago Pedido #171 - WOV (en camino)', category:'compras' },
  // Cambios de moneda (ajuste_in/out)
  { date:'2026-03-02', type:'ajuste_out', amount:300000,  currency:'ARS', caja:'Santiago', note:'Cambio ARS→USD 02/03 (206 USD)', category:'cambio' },
  { date:'2026-03-02', type:'ajuste_in',  amount:206,     currency:'USD', caja:'Santiago', note:'Cambio ARS→USD 02/03 (206 USD)', category:'cambio' },
  { date:'2026-03-06', type:'ajuste_out', amount:916500,  currency:'ARS', caja:'Santiago', note:'Cambio ARS→USD 06/03 (650 USD)', category:'cambio' },
  { date:'2026-03-06', type:'ajuste_in',  amount:650,     currency:'USD', caja:'Santiago', note:'Cambio ARS→USD 06/03 (650 USD)', category:'cambio' },
  { date:'2026-03-06', type:'ajuste_out', amount:146632.57, currency:'ARS', caja:'Luciano', note:'Cambio ARS→USD 06/03 (100 USD)', category:'cambio' },
  { date:'2026-03-06', type:'ajuste_in',  amount:100,     currency:'USD', caja:'Luciano',  note:'Cambio ARS→USD 06/03 (100 USD)', category:'cambio' },
];

// ─── DEUDAS ───────────────────────────────────────────────────────────────────
const DEBTS = [
  { entity_name:'LU', type:'receivable', currency:'USD', original_amount:289, note:'LU DEBE 289 USD - Pedido #2877', date:'2026-03-03' },
  { entity_name:'BLAS', type:'receivable', currency:'USD', original_amount:376.5, note:'BLAS DEBE 376.50 USD', date:'2026-03-03' },
  { entity_name:'FRAN BALOGH', type:'payable', currency:'USD', original_amount:5, note:'FRAN BALOGH TIENE 5 USD A FAVOR - Pedido #2886', date:'2026-03-04' },
];

// ─── LÓGICA PRINCIPAL ──────────────────────────────────────────────────────────
async function run() {
  console.log('=== CARGA MARZO 2026 ===\n');

  // 1. Cargar productos de la DB
  console.log('1. Cargando mapa de productos desde DB...');
  const { data: prods, error: prodErr } = await supabase.from('products').select('id, sku, name');
  if (prodErr) { console.error('ERROR:', prodErr); process.exit(1); }

  const skuToId = {};
  const skuToName = {};
  for (const p of prods) {
    if (p.sku) {
      skuToId[p.sku.toUpperCase()] = p.id;
      skuToName[p.sku.toUpperCase()] = p.name;
    }
  }

  // Función: dado un SKU del Excel, devolver el ID en la DB
  function resolveId(excelSku) {
    const mapped = SKU_MAP[excelSku.toUpperCase()] || excelSku.toUpperCase();
    return skuToId[mapped] || null;
  }
  function resolveName(excelSku) {
    const mapped = SKU_MAP[excelSku.toUpperCase()] || excelSku.toUpperCase();
    return skuToName[mapped] || excelSku;
  }

  console.log(`   → ${Object.keys(skuToId).length} productos en DB`);

  // 2. Insertar Compras
  console.log('\n2. Insertando compras...');
  for (const pur of PURCHASES) {
    const total = pur.items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
    const paidAmt = pur.number === 170 ? 1000 : pur.number === 171 ? 4607.50 : total;

    const { data: purRec, error: purErr } = await supabase.from('purchases').insert({
      number: pur.number,
      supplier: pur.supplier,
      currency: pur.currency,
      total,
      paid_amount: paidAmt,
      payment_status: pur.payment_status,
      status: pur.received_at ? 'received' : 'ordered',
      notes: `Pedido #${pur.number} - ${pur.supplier}`,
      created_at: pur.ordered_at,
    }).select('id').single();

    if (purErr) { console.log(`   ✗ Compra #${pur.number}: ${purErr.message}`); continue; }

    const items = pur.items
      .filter(i => resolveId(i.sku))
      .map(i => ({
        purchase_id: purRec.id,
        product_id: resolveId(i.sku),
        product_sku: i.sku.toUpperCase(),
        qty: i.qty,
        unit_cost: i.unit_cost,
        subtotal: i.qty * i.unit_cost,
      }));

    if (items.length > 0) {
      const { error: iErr } = await supabase.from('purchase_items').insert(items);
      if (iErr) console.log(`   ✗ Items compra #${pur.number}: ${iErr.message}`);
    }
    const skipped = pur.items.filter(i => !resolveId(i.sku)).map(i => i.sku);
    if (skipped.length) console.log(`   ⚠️  #${pur.number} SKUs sin mapeo: ${skipped.join(', ')}`);
    console.log(`   ✓ Compra #${pur.number} (${pur.supplier}) $${total.toFixed(2)} USD [${pur.payment_status}]`);
  }

  // 3. Insertar Pedidos de Venta
  console.log('\n3. Insertando pedidos de venta...');
  let ordOk = 0, totalUsdVentas = 0;

  for (const ord of ORDERS) {
    const totalUsd = ord.items.reduce((s, i) => s + i.qty * i.usd, 0);
    const orderTotal = ord.type === 'wholesale' ? totalUsd : (ord.payment_ars || Math.round(totalUsd * FX));
    const confirmedAt = `${ord.date}T14:00:00.000Z`;

    const { data: orderRec, error: oErr } = await supabase.from('orders').insert({
      number: ord.number,
      type: ord.type,
      customer_name: ord.customer,
      customer_phone: '',
      customer_address: '',
      notes: ord.note || '',
      total: orderTotal,
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: ord.payment_usd ? 'usdt' : 'efectivo',
      confirmed_at: confirmedAt,
      created_at: confirmedAt,
    }).select('id').single();

    if (oErr) { console.log(`   ✗ Pedido #${ord.number}: ${oErr.message}`); continue; }

    // Items
    const itmRows = ord.items
      .filter(i => resolveId(i.sku))
      .map(i => {
        const up = ord.type === 'wholesale'
          ? i.usd
          : (ord.payment_ars && totalUsd > 0 ? (ord.payment_ars / totalUsd) * i.usd : i.usd * FX);
        return {
          order_id: orderRec.id,
          product_id: resolveId(i.sku),
          product_name: resolveName(i.sku),
          product_sku: (SKU_MAP[i.sku.toUpperCase()] || i.sku).toUpperCase(),
          qty: i.qty,
          unit_price: up,
          subtotal: i.qty * up,
        };
      });

    if (itmRows.length > 0) {
      const { error: iErr } = await supabase.from('order_items').insert(itmRows);
      if (iErr) console.log(`   ✗ Items #${ord.number}: ${iErr.message}`);
    }

    // Cash movements (no interno)
    if (!ord.is_internal) {
      if (ord.payment_ars && ord.caja_ars) {
        await supabase.from('cash_movements').insert({
          type: 'sale_income', amount: ord.payment_ars, currency: 'ARS',
          caja: ord.caja_ars, note: `Pedido #${ord.number} - ${ord.customer}`,
          category: 'ventas', created_at: confirmedAt,
        });
      }
      if (ord.payment_usd && ord.caja_usd) {
        await supabase.from('cash_movements').insert({
          type: 'sale_income', amount: ord.payment_usd, currency: 'USD',
          caja: ord.caja_usd, note: `Pedido #${ord.number} - ${ord.customer}`,
          category: 'ventas', created_at: confirmedAt,
        });
      }
    }

    const skipped = ord.items.filter(i => !resolveId(i.sku)).map(i => i.sku);
    if (skipped.length) console.log(`   ⚠️  #${ord.number} SKUs sin mapeo: ${skipped.join(', ')}`);

    const pagoStr = ord.payment_ars ? `$${(ord.payment_ars/1000).toFixed(0)}K ARS` : `$${ord.payment_usd} USD`;
    console.log(`   ✓ #${ord.number} ${ord.customer.substring(0,20).padEnd(20)} ${ord.type==='wholesale'?'MAY':'MIN'} $${totalUsd.toFixed(0)}USD → ${pagoStr}`);
    ordOk++; totalUsdVentas += totalUsd;
  }
  console.log(`\n   → ${ordOk} pedidos OK | $${totalUsdVentas.toFixed(2)} USD total ventas`);

  // 4. Movimientos de caja extra
  console.log('\n4. Insertando movimientos de caja extra...');
  for (const cm of EXTRA_CASH) {
    const { error } = await supabase.from('cash_movements').insert({
      type: cm.type, amount: cm.amount, currency: cm.currency,
      caja: cm.caja, note: cm.note, category: cm.category,
      created_at: `${cm.date}T10:00:00.000Z`,
    });
    const icon = (cm.type === 'manual_expense' || cm.type === 'purchase_expense') ? '↓' : '↑';
    if (error) console.log(`   ✗ ${cm.note}: ${error.message}`);
    else console.log(`   ${icon} ${cm.caja.padEnd(10)} ${cm.currency} ${cm.amount.toLocaleString().padStart(12)} | ${cm.note.substring(0,40)}`);
  }

  // 5. Deudas
  console.log('\n5. Insertando deudas...');
  for (const d of DEBTS) {
    const { error } = await supabase.from('debts').insert({
      entity_name: d.entity_name, type: d.type, currency: d.currency,
      original_amount: d.original_amount, paid_amount: 0, status: 'pending',
      note: d.note, created_at: `${d.date}T12:00:00.000Z`,
    });
    if (error) console.log(`   ✗ ${d.entity_name}: ${error.message}`);
    else console.log(`   ✓ ${d.type === 'receivable' ? 'A COBRAR' : 'A PAGAR'} ${d.entity_name} $${d.original_amount} ${d.currency}`);
  }

  console.log('\n=== CARGA COMPLETA ===');
}

run().catch(console.error);
