/**
 * RESET Y CARGA ABRIL 2026 — FULL VIP
 * =====================================
 * Borra toda la data transaccional y carga:
 *   1. Compra inicial (stock actual con costos FIFO)
 *   2. Clientes reales de abril
 *   3. Órdenes del 1 al 6 de abril 2026
 *   4. Movimientos de caja de abril
 *   5. Saldos iniciales (cierre marzo)
 *
 * REVISAR ANTES DE CORRER.
 * Ejecutar: node scripts/seed-april-2026.js
 */

const { createClient } = require('@supabase/supabase-js');

const SB_URL = 'https://uwrgztccjobtiydvlkdu.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cmd6dGNjam9idGl5ZHZsa2R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5MjU3MSwiZXhwIjoyMDg2NzY4NTcxfQ.Z_G5-Y6m-Ip6h_Qk4vR95E4yAYBEivaE6g4GssE6Ld8';
const sb = createClient(SB_URL, SB_KEY);

const FX = 1461.79; // ARS/USD al momento de las ventas de abril

// ─── MAPEO XLSX SKU → { id, sku, name } del sistema ───────────────────────────
// IDs tomados de la query a Supabase. Claves = SKU del XLSX.
const PRODUCT_MAP = {
  // Productos NUEVOS (no existen en sistema - se crean en el script)
  'PHE8001': null, // PHENOM 8G - orange drop cookie → se asigna después de crear
  'PHE8002': null,
  'PHE8003': null,

  // ELF BAR ICE KING 40000
  'ELF40004': { id: 'b64bb259-408c-4ab4-91e1-28885e1ebd9c', sku: 'ELF40004', name: 'ELF BAR ICE KING 40000 - DRAGON STRAWNANA' },
  'ELF40005': { id: '56c38e69-2c3b-4c3f-8664-a06cde9d5456', sku: 'ELF40005', name: 'ELF BAR ICE KING 40000 - MIAMI MINT' },
  'ELF40006': { id: '73f8a1e0-1c95-4e19-bb24-3d6ae9f57b30', sku: 'ELF40006', name: 'ELF BAR ICE KING 40000 - PEACH+' },
  'ELF40008': { id: 'f741fb96-c811-4631-b3f9-9eb2608d9367', sku: 'ELF40008', name: 'ELF BAR ICE KING 40000 - SOUR APPLE ICE' },
  'ELF40010': { id: '1c80383c-164e-44a6-8353-755b57b130c7', sku: 'ELF40010', name: 'ELF BAR ICE KING 40000 - SOUR STRAWBERRY DRAGONFRUIT' },
  'ELF40011': { id: 'fde5ce05-4726-4bbc-98a2-d5c3703bfa76', sku: 'ELF40011', name: 'ELF BAR ICE KING 40000 - SUMMER SPLASH' },
  'ELF40013': { id: '2448a33d-5263-4401-9a77-77cdb924e8f0', sku: 'ELF40013', name: 'ELF BAR ICE KING 40000 - WATERMELON ICE' },
  'ELF40014': { id: 'f990c439-f93d-4930-9287-a8622379b042', sku: 'ELF40014', name: 'ELF BAR ICE KING 40000 - BLUERAZZ ICE' },
  'ELF40016': { id: 'f1ae645e-1fe7-4444-99d7-699e12a141bc', sku: 'ELF40016', name: 'ELF BAR ICE KING 40000 - STRAWBERRY ICE' },
  'ELF40017': { id: 'bab0f1a0-dc47-4bdc-be01-e68f3ad081b3', sku: 'ELF40017', name: 'ELF BAR ICE KING 40000 - STRAWBERRY WATERMELON' },
  'ELF40018': { id: 'ffc622fd-4778-4bed-a941-6bc84601da08', sku: 'ELF40018', name: 'ELF BAR ICE KING 40000 - GRAPE ICE' },
  'ELF40020': { id: '1a4dffce-09a7-4d78-8371-d005ced1f581', sku: 'ELF40020', name: 'ELF BAR ICE KING 40000 - GREEN APPLE ICE' },

  // ELF BAR BC PRO 45000
  'ELFBC45004': { id: '0ec0f17a-0834-40a3-9592-28f0ae804637', sku: 'ELFBABC4-004', name: 'ELF BAR BC PRO 45000 - STRAWBERRY ICE' },
  'ELFBC45007': { id: '2a0a4d95-c201-4654-882c-c584a630561d', sku: 'ELFBABC4-007', name: 'ELF BAR BC PRO 45000 - GRAPE TWIST' },
  'ELFBC45008': { id: 'e568f216-d2cb-42ea-9f3a-6a67903f3cd6', sku: 'ELFBABC4-008', name: 'ELF BAR BC PRO 45000 - KIWI PASSION FRUIT GUAVA' },

  // ELF BAR GH 23000
  'ELF2301': { id: '44474a53-66ee-4527-92eb-afd605608a65', sku: 'ELFBAGH2-001', name: 'ELF BAR GH 23000 - GRAPE ICE' },
  'ELF2304': { id: '02e4dbd0-d75b-45e3-b5b8-2c2048acaad3', sku: 'ELFBAGH2-004', name: 'ELF BAR GH 23000 - MIAMI MINT' },
  'ELF2305': { id: '39d34c1e-8f5c-49d9-9577-c0fd0a57a259', sku: 'ELFBAGH2-005', name: 'ELF BAR GH 23000 - SAKURA GRAPE' },
  'ELF2308': { id: '2aa8e48f-167c-4569-9326-985404e67dfe', sku: 'ELFBAGH2-008', name: 'ELF BAR GH 23000 - GREEN APPLE ICE' },
  'ELF2312': { id: '6400f433-15fb-4b45-b138-3d8b606dedd3', sku: 'ELFBAGH2-012', name: 'ELF BAR GH 23000 - BLUEBERRY PEAR' },
  'ELF2313': { id: 'eb38fa75-3e6d-4fc5-9f8b-ed80fb5ccb05', sku: 'ELFBAGH2-013', name: 'ELF BAR GH 23000 - BLUE RAZZ ICE' },

  // PHENOM MUSHROOM 6G
  'PHE011': { id: 'f1c0d022-9ca4-4456-b235-0c67ed6422cd', sku: 'PHENO60G-022', name: 'PHENOM MUSHROOM 6G - VAINILLA (SATIVA)' },
  'PHE013': { id: '3f9023f9-ebeb-4678-937b-88b2eb7594f1', sku: 'PHENO60G-024', name: 'PHENOM MUSHROOM 6G - ALIEN OG (SATIVA)' },

  // TORCH 5G
  'TOR010': { id: 'e85a1c4f-2ae5-44a8-b0c8-63ae0c78dab0', sku: 'TORCH50G-010', name: 'TORCH 5G - HONOLULU HAZE (SATIVA)' },
  'TOR011': { id: 'e5741c3b-ea2d-41d1-b59e-5ac46b9156f0', sku: 'TORCH50G-011', name: 'TORCH 5G - SUPER LEMON COOKIES' },
  'TOR012': { id: '482eb050-a018-4aef-97ae-6648f926418b', sku: 'TORCH50G-012', name: 'TORCH 5G - MANGO MERINGUE (SATIVA)' },
  'TOR013': { id: 'd95505ff-5da0-4e4d-928b-86046537dec4', sku: 'TORCH50G-013', name: 'TORCH 5G - GRAPEFRUIT DURBAN (SATIVA)' },
  'TOR014': { id: '27d85c65-350e-4812-9bcb-e4a1f40f2ca8', sku: 'TORCH50G-014', name: 'TORCH 5G - TROPICAL CHERRY GAS' },
  'TOR015': { id: '3df0fb83-fec7-4ff6-b689-a52f26e3b1fd', sku: 'TORCH50G-015', name: 'TORCH 5G - RASPBERRY LEMONADE' },
  'TOR016': { id: '1f6a22bb-cb04-4cec-b14a-b3325e14cdde', sku: 'TORCH50G-016', name: 'TORCH 5G - COTTON CANDY RUNTZ (INDICA)' },
  'TOR017': { id: 'a3ae2c9b-d56c-441d-9e04-d25f0ce27a1f', sku: 'TORCH50G-017', name: 'TORCH 5G - BANANA BERRY CAKE (INDICA)' },
  'TOR036': { id: 'e5a4880b-23bc-4f23-9961-f560535a14b6', sku: 'TORCH50G-036', name: 'TORCH 5G - SKYWALKER OG (HYBRID)' },
  'TOR50038': { id: 'fe237aa3-d46d-44c1-ab78-e3066a9b6707', sku: 'TORCH50G-038', name: 'TORCH 5G - FORBIDDEN ROMULAN (INDICA)' },

  // TORCH 4G
  'TOR-4002': { id: 'a483d032-d293-43d0-851a-73a15be099ab', sku: 'TORCH40G-004', name: 'TORCH 4G - BOUJEE BLUE DREAMS (SATIVA)' },

  // BLOW
  'BLOWPEN001': { id: '89ce9386-74ca-49aa-92ba-6d1b546ed74b', sku: 'BLOWPEN-001', name: 'BLOW PEN - BLANCO' },
  'BLOW005':    { id: 'da03b6bb-585c-40a7-9b33-91ed70ebf0e5', sku: 'BLOW35G-005', name: 'BLOW 3.5G - BLUE RAZZ' },
  'BLOW013':    { id: '97384aac-b099-4b56-a7bd-22787a239eaa', sku: 'BLOW35G-013', name: 'BLOW 3.5G - NORTHERN LIGHTS' },
  'BLOW017':    { id: '63dfbe21-3692-4125-90f1-dd200a4691c5', sku: 'BLOW35G-017', name: 'BLOW 3.5G - PAPAYA PUNCH / BANANA SHERBET / GRAPE ATOMPER' },
  'BLOWCAP009': { id: 'd3d6757c-3be0-4447-a4cb-70b10b02dcb0', sku: 'BLOWCAP-009', name: 'BLOW CAPSULA 1.2G - CHEMDAWG' },
  'BLOWCAP010': { id: 'db5d97b2-4e1f-4642-a67f-8ca37cd77584', sku: 'BLOWCAP-010', name: 'BLOW CAPSULA 1.2G - TROPICAL BURST' },
  'BLOWCAP011': { id: 'e20c2170-b799-49d5-92cc-8986ff893095', sku: 'BLOWCAP-011', name: 'BLOW CAPSULA 1.2G - SOUR DIESEL' },
  'BLOWCAP012': { id: 'c03d4507-fcc6-4e71-ad76-098f29242cc6', sku: 'BLOWCAP-012', name: 'BLOW CAPSULA 1.2G - HAWAIIAN SNOWCONE' },
  'BLOWCAP013': { id: '02fe7e1f-9391-4bfa-8ce3-50e0c0bbf6e1', sku: 'BLOWCAP-013', name: 'BLOW CAPSULA 1.2G - GORILLA GLUE' },
  'BLOWCAP014': { id: '45ecb69d-2489-415d-861d-2baeee38743b', sku: 'BLOWCAP-014', name: 'BLOW CAPSULA 1.2G - MANGO KUSH' },
  'BLOWCAP015': { id: '04c7d8f2-b1e0-4967-8b2d-af36186e6ef9', sku: 'BLOWCAP-015', name: 'BLOW CAPSULA 1.2G - WIFI OG' },

  // BLAYZD
  'BLAYZDSAT001': { id: '31aa0965-142f-450f-9ce0-c5cbe44478bf', sku: 'BLAYZDSAT001', name: 'BLAYZD 1G - SATIVA' },
  // BLAYZDSAT002 = BLAYZD HYBRID → se crea como producto nuevo

  // HEAVY HITTERS GUMMIES
  'HHG601': { id: 'edcd3c3b-0af0-4e83-a117-b900db8b2c63', sku: 'HEAVYGUM-001', name: 'HEAVY HITTERS GUMMIES 6PCS - PINEAPPLE' },
  'HHG602': { id: 'a8bb0391-f6f8-404e-a996-8eb9928ea439', sku: 'HEAVYGUM-002', name: 'HEAVY HITTERS GUMMIES 6PCS - GRAPE' },
  'HHG603': { id: 'e49621ab-6f8b-4130-8105-9df968fe9c2a', sku: 'HEAVYGUM-003', name: 'HEAVY HITTERS GUMMIES 6PCS - ORANGE' },
  'HHG604': { id: '122e8432-f6bb-4a8a-abdf-af726e2284ad', sku: 'HEAVYGUM-004', name: 'HEAVY HITTERS GUMMIES 6PCS - LYCHEE' },
  'HHG607': { id: '94997f19-2060-42ed-9215-8af722a9b6ec', sku: 'HEAVYGUM-007', name: 'HEAVY HITTERS GUMMIES 6PCS - BLUEBERRIES' },
  'HHG608': { id: '9945c042-2736-43cb-99e1-05df95036365', sku: 'HEAVYGUM-008', name: 'HEAVY HITTERS GUMMIES 6PCS - WATERMELON' },

  // BURN HEMP GUMMIES
  'BHG5001': { id: '5ecc6ead-f581-4923-b814-84cfc70520b1', sku: 'BURNHGUM-001', name: 'BURN HEMP GUMMIES 2PCS 500MG - ASSORTED' },

  // IGNITE V300 BLACK
  'IGN30003': { id: '09b11823-b71b-4684-9a09-0508fa7e3089', sku: 'IGNITV30-003', name: 'IGNITE V300 BLACK 30000 - STRAWBERRY BANANA' },
  'IGN30004': { id: '9acac406-c246-46c8-a213-834b9975e03a', sku: 'IGNITV30-004', name: 'IGNITE V300 BLACK 30000 - STRAWBERRY ICE' },
  'IGN30005': { id: '62ad9791-50dd-4214-8677-15644f45af68', sku: 'IGNITV30-005', name: 'IGNITE V300 BLACK 30000 - STRAWBERRY KIWI' },
  'IGN30018': { id: '5919d741-2f1b-4390-b5dd-41b52ea3a858', sku: 'IGNITV30-018', name: 'IGNITE V300 BLACK 30000 - SWEET AND SOUR POMEGRANATE' },
  'IGN30022': { id: 'f05014a7-7f5f-41e5-8342-0d408ad7f59c', sku: 'IGNITV30-022', name: 'IGNITE V300 BLACK 30000 - GREEN APPLE' },

  // IGNITE V300 ULTRA SLIM
  'IGNUS30001': { id: 'd65b02e9-0a27-438a-a42f-b0645afffd30', sku: 'IGN-V300-US-BLACK001', name: 'IGNITE V300 ULTRA SLIM 30000 - GRAPE ICE' },
  'IGNUS30002': { id: '39c5dc7c-3bbc-4597-bc87-2484e35f3cdf', sku: 'IGN-V300-US-BLACK002', name: 'IGNITE V300 ULTRA SLIM 30000 - STRAWBERRY BANANA' },
  'IGNUS30003': { id: '0f75b5f4-3f04-40dd-93c6-6598b71da67b', sku: 'IGN-V300-US-BLACK004', name: 'IGNITE V300 ULTRA SLIM 30000 - STRAWBERRY ICE' },
  'IGNUS30004': { id: '96af5fd4-a97a-494f-8766-09a09a0bbb1f', sku: 'IGN-V300-US-BLACK003', name: 'IGNITE V300 ULTRA SLIM 30000 - STRAWBERRY KIWI' },
  'IGNUS30006': { id: '8c5b6fc4-3148-4823-9dbb-46d4c9881d72', sku: 'IGN-V300-US-BLACK006', name: 'IGNITE V300 ULTRA SLIM 30000 - BLUEBERRY STRAWBERRY COCONUT' },
  'IGNUS30011': { id: 'ee643367-646f-4f2a-b7b5-8aaf80786320', sku: 'IGN-V300-US-BLACK007', name: 'IGNITE V300 ULTRA SLIM 30000 - WATERMELON MIX' },
  'IGNUS30012': { id: 'd540c993-0d71-4f77-8792-03d3981afc21', sku: 'IGN-V300-US-BLACK008', name: 'IGNITE V300 ULTRA SLIM 30000 - PINEAPPLE KIWI DRAGON FRUIT' },
  'IGNUS30013': { id: '105cf927-f5d5-4ed5-ab1f-6986a5a99cc6', sku: 'IGN-V300-US-BLACK009', name: 'IGNITE V300 ULTRA SLIM 30000 - ALOE GRAPE ICE' },
  'IGNUS30014': { id: '421d3fe0-5216-4a31-adab-963ae3fc0c75', sku: 'IGN-V300-US-BLACK010', name: 'IGNITE V300 ULTRA SLIM 30000 - BANANA ICE' },

  // IGNITE V400 MIX
  'IGNVM40002': { id: '68a56365-a6e3-465b-9787-6365bbc60a8d', sku: 'IGNITV40-002', name: 'IGNITE V400 MIX 40000 - BLUEBERRY ICE / RASPBERRY BLACKBERRY' },
  'IGNVM40003': { id: '7a11fbb6-699d-4109-ba1c-eb484ab127f3', sku: 'IGNITV40-003', name: 'IGNITE V400 MIX 40000 - GRAPE ICE / STRAWBERRY ICE' },
  'IGNVM40004': { id: '5a3d9e7e-d78c-4d50-9cf8-0c6e9ebb95c2', sku: 'IGNITV40-004', name: 'IGNITE V400 MIX 40000 - WATERMELON ICE / GRAPE ICE' },
  'IGNVM40005': { id: '6d995f7b-ca36-4f18-9609-eea1dbdc5a44', sku: 'IGNITV40-005', name: 'IGNITE V400 MIX 40000 - ORANGE ICE / STRAWBERRY ICE' },
  'IGNVM40011': { id: '03d615e6-f7d9-4060-8e7c-24d3b42a5fd7', sku: 'IGNITV40-011', name: 'IGNITE V400 MIX 40000 - GRAPE POP / PEACH ICE' },

  // LOST MARY MIXER
  'LM30001': { id: 'f5ea8398-ff81-4bc7-aa10-6a61509ac33c', sku: 'LM30001', name: 'LOST MARY MIXER 30000 - APPLE GRAPE' },
  'LM30002': { id: '682799f3-17ed-49b7-9c38-98493e2ffaa9', sku: 'LM30002', name: 'LOST MARY MIXER 30000 - WATERMELON ICE' },
  'LM30009': { id: '579d44e2-3d34-467d-b0f2-f71458e6c86d', sku: 'LM30004', name: 'LOST MARY MIXER 30000 - ORANGE STRAWBERRY' },

  // QIT BOLSAS DE NICOTINA
  'QIT301':  { id: '4fef3dcc-f9b1-4649-9cf9-3f6a5b6576f2', sku: 'QITBOL-001', name: 'QIT NICOTINA - PEPPERMINT 3MG' },
  'QIT302':  { id: '283b2c35-7c7c-4f81-aee5-928379e05357', sku: 'QITBOL-002', name: 'QIT NICOTINA - SPEARMINT 3MG' },
  'QIT305':  { id: '7a7be2a4-4ba1-47c4-9ec9-4a3a773292ba', sku: 'QITBOL-005', name: 'QIT NICOTINA - SUMMER MANGO 3MG' },
  'QIT306':  { id: '584ab18f-f4dd-4f72-9411-abe021c20563', sku: 'QITBOL-006', name: 'QIT NICOTINA - LUSH ICE 3MG' },
  'QIT307':  { id: '76e031d5-9c37-4b90-b8ea-27c84acf1e64', sku: 'QITBOL-007', name: 'QIT NICOTINA - LEMON MINT 3MG' },
  'QIT601':  { id: '7f07eb92-c5b3-4a49-994b-07f350ab4726', sku: 'QITBOL-008', name: 'QIT NICOTINA - PEPPERMINT 6MG' },
  'QIT602':  { id: 'dd391e55-069d-4ec5-a520-b134ee3a39ff', sku: 'QITBOL-009', name: 'QIT NICOTINA - SPEARMINT 6MG' },
  'QIT603':  { id: '6325bab6-9a5b-44ad-87a7-b65948dcd81a', sku: 'QITBOL-010', name: 'QIT NICOTINA - LUSH ICE 6MG' },
  'QIT604':  { id: '2d9983b7-e581-4cd3-bac3-3bd5b664a860', sku: 'QITBOL-011', name: 'QIT NICOTINA - SUMMER MANGO 6MG' },
  'QIT605':  { id: '07678557-6f43-4b3d-9e16-1cf29eeec2a6', sku: 'QITBOL-012', name: 'QIT NICOTINA - COFFEE 6MG' },
  'QIT606':  { id: '91627dd4-e624-433e-9ea8-9ca33b45077c', sku: 'QITBOL-013', name: 'QIT NICOTINA - LEMON MINT 6MG' },
  'QIT1501': { id: 'de930a24-b075-4899-832f-9e211b33cf47', sku: 'QITBOL-015', name: 'QIT NICOTINA - PEPPERMINT 15MG' },
  'QIT1502': { id: '59020e28-8b37-4adb-bc3f-16b0d04f088b', sku: 'QITBOL-016', name: 'QIT NICOTINA - WINTERGREEN 15MG' },
  'QIT1503': { id: '8f567ae4-c1ca-4bde-80a6-e74a7d6d6947', sku: 'QITBOL-017', name: 'QIT NICOTINA - COFFEE 15MG' },
  'QIT1504': { id: '793f769b-eed4-4abf-b983-a30aaf89ab15', sku: 'QITBOL-018', name: 'QIT NICOTINA - BUBBLEGUM 15MG' },

  // ACCESORIOS
  'ACC002': { id: '0e06b47f-7007-4cff-827f-064195346607', sku: 'ACC002', name: 'PARLANTE JBL GO3' },
  'ACC007': { id: '8dc8ead6-a626-425e-88c0-7b8ea5812c1d', sku: 'ACC007', name: 'CABLE USB-C 1M' },
  'ACC008': { id: 'c23685a7-df01-4bec-82a3-eba63205eb86', sku: 'ACC008', name: 'CARGADOR USB-C 20W' },
};

// ─── STOCK INICIAL XLSX (productos con stock > 0, como está HOY) ───────────────
// Clave = XLSX SKU, valor = { currentStock, cost }
const XLSX_STOCK = [
  { sku: 'BHG5001',    currentStock: 4,  cost: 11 },
  { sku: 'HHG601',     currentStock: 1,  cost: 15 },
  { sku: 'HHG602',     currentStock: 1,  cost: 15 },
  { sku: 'HHG603',     currentStock: 1,  cost: 15 },
  { sku: 'HHG604',     currentStock: 1,  cost: 15 },
  { sku: 'HHG607',     currentStock: 2,  cost: 15 },
  { sku: 'HHG608',     currentStock: 2,  cost: 15 },
  { sku: 'TOR-4002',   currentStock: 4,  cost: 14 },
  { sku: 'TOR010',     currentStock: 2,  cost: 21 },
  { sku: 'TOR011',     currentStock: 1,  cost: 21 },
  { sku: 'TOR012',     currentStock: 4,  cost: 21 },
  { sku: 'TOR013',     currentStock: 4,  cost: 21 },
  { sku: 'TOR014',     currentStock: 4,  cost: 21 },
  { sku: 'TOR015',     currentStock: 3,  cost: 21 },
  { sku: 'TOR016',     currentStock: 3,  cost: 21 },
  { sku: 'TOR017',     currentStock: 5,  cost: 21 },
  { sku: 'TOR036',     currentStock: 3,  cost: 21 },
  { sku: 'TOR50038',   currentStock: 5,  cost: 21 },
  { sku: 'PHE011',     currentStock: 6,  cost: 24.5 },
  { sku: 'PHE013',     currentStock: 2,  cost: 24.5 },
  { sku: 'BLOWPEN001', currentStock: 11, cost: 10 },
  { sku: 'BLOW005',    currentStock: 12, cost: 22.5 },
  { sku: 'BLOW013',    currentStock: 1,  cost: 22.5 },
  { sku: 'BLOW017',    currentStock: 3,  cost: 22.5 },
  { sku: 'BLOWCAP009', currentStock: 6,  cost: 23.5 },
  { sku: 'BLOWCAP010', currentStock: 3,  cost: 23.5 },
  { sku: 'BLOWCAP011', currentStock: 4,  cost: 23.5 },
  { sku: 'BLOWCAP012', currentStock: 4,  cost: 23.5 },
  { sku: 'BLOWCAP013', currentStock: 4,  cost: 23.5 },
  { sku: 'BLOWCAP014', currentStock: 2,  cost: 23.5 },
  { sku: 'BLOWCAP015', currentStock: 5,  cost: 23.5 },
  { sku: 'BLAYZDSAT001', currentStock: 10, cost: 10 },
  // BLAYZDSAT002 (hybrid) = nuevo producto → ver sección productos nuevos
  { sku: 'ELF2301',    currentStock: 10, cost: 8.5 },
  { sku: 'ELF2304',    currentStock: 11, cost: 8.5 },
  { sku: 'ELF2305',    currentStock: 6,  cost: 8.5 },
  { sku: 'ELF2308',    currentStock: 1,  cost: 8.5 },
  { sku: 'ELF2312',    currentStock: 10, cost: 8.5 },
  { sku: 'ELF2313',    currentStock: 6,  cost: 8.5 },
  { sku: 'ELF40004',   currentStock: 38, cost: 9.15 },
  { sku: 'ELF40005',   currentStock: 18, cost: 9.15 },
  { sku: 'ELF40006',   currentStock: 6,  cost: 9.15 },
  { sku: 'ELF40008',   currentStock: 5,  cost: 9.15 },
  { sku: 'ELF40010',   currentStock: 2,  cost: 9.15 },
  { sku: 'ELF40011',   currentStock: 7,  cost: 9.15 },
  { sku: 'ELF40013',   currentStock: 20, cost: 9.15 },
  { sku: 'ELF40017',   currentStock: 7,  cost: 9.15 },
  { sku: 'ELF40018',   currentStock: 40, cost: 9.15 },
  { sku: 'ELF40020',   currentStock: 5,  cost: 9.15 },
  { sku: 'ELFBC45004', currentStock: 1,  cost: 10.6 },
  { sku: 'ELFBC45007', currentStock: 1,  cost: 10.6 },
  { sku: 'ELFBC45008', currentStock: 1,  cost: 10.6 },
  { sku: 'IGN30003',   currentStock: 3,  cost: 9.9 },
  { sku: 'IGN30004',   currentStock: 1,  cost: 9.9 },
  { sku: 'IGN30005',   currentStock: 9,  cost: 9.9 },
  { sku: 'IGN30018',   currentStock: 17, cost: 9.9 },
  { sku: 'IGN30022',   currentStock: 2,  cost: 9.9 },
  { sku: 'IGNUS30001', currentStock: 5,  cost: 10.25 },
  { sku: 'IGNUS30002', currentStock: 10, cost: 10.25 },
  { sku: 'IGNUS30003', currentStock: 9,  cost: 10.25 },
  { sku: 'IGNUS30004', currentStock: 4,  cost: 10.25 },
  { sku: 'IGNUS30006', currentStock: 5,  cost: 10.25 },
  { sku: 'IGNUS30011', currentStock: 5,  cost: 10.25 },
  { sku: 'IGNUS30012', currentStock: 5,  cost: 10.25 },
  { sku: 'IGNUS30013', currentStock: 20, cost: 10.25 },
  { sku: 'IGNUS30014', currentStock: 9,  cost: 10.25 },
  { sku: 'IGNVM40002', currentStock: 5,  cost: 10.75 },
  { sku: 'IGNVM40003', currentStock: 6,  cost: 10.75 },
  { sku: 'IGNVM40004', currentStock: 5,  cost: 10.75 },
  { sku: 'IGNVM40005', currentStock: 8,  cost: 10.75 },
  { sku: 'IGNVM40011', currentStock: 8,  cost: 10.75 },
  { sku: 'QIT301',     currentStock: 15, cost: 6.5 },
  { sku: 'QIT302',     currentStock: 10, cost: 6.5 },
  { sku: 'QIT305',     currentStock: 11, cost: 6.5 },
  { sku: 'QIT306',     currentStock: 1,  cost: 6.5 },
  { sku: 'QIT307',     currentStock: 4,  cost: 6.5 },
  { sku: 'QIT601',     currentStock: 9,  cost: 6.5 },
  { sku: 'QIT602',     currentStock: 11, cost: 6.5 },
  { sku: 'QIT603',     currentStock: 5,  cost: 6.5 },
  { sku: 'QIT604',     currentStock: 7,  cost: 6.5 },
  { sku: 'QIT605',     currentStock: 17, cost: 6.5 },
  { sku: 'QIT606',     currentStock: 1,  cost: 6.5 },
  { sku: 'QIT1501',    currentStock: 2,  cost: 6.5 },
  { sku: 'QIT1502',    currentStock: 8,  cost: 6.5 },
  { sku: 'QIT1503',    currentStock: 17, cost: 6.5 },
  { sku: 'QIT1504',    currentStock: 6,  cost: 6.5 },
  { sku: 'ACC002',     currentStock: 2,  cost: 6 },   // total cost 12 / 2 units
  { sku: 'ACC007',     currentStock: 54, cost: 0.85 }, // total cost 45.9 / 54
  { sku: 'ACC008',     currentStock: 10, cost: 1.55 }, // total cost 15.5 / 10
];

// ─── VENTAS ABRIL 2026 ─────────────────────────────────────────────────────────
// type: 'retail' (ARS) o 'wholesale' (USD)
// payment: null = PENDIENTE
const APRIL_ORDERS = [
  {
    num: '#2998', date: '2026-04-01', customer: 'MARCO',
    type: 'wholesale',
    payment: [
      { amount: 600,    currency: 'USD', caja: 'Luciano' },
      { amount: 109500, currency: 'ARS', caja: 'Santiago' },
      { amount: 340.09, currency: 'USD', caja: 'Luciano' },
    ],
    items: [
      { xlsxSku: 'PHE8001', qty: 7,  saleUnit: 29,   costUnit: 26 },
      { xlsxSku: 'PHE8002', qty: 22, saleUnit: 29,   costUnit: 26 },
      { xlsxSku: 'PHE8003', qty: 6,  saleUnit: 29,   costUnit: 26 },
    ],
  },
  {
    num: '#2999', date: '2026-04-01', customer: 'POLI BENITEZ',
    type: 'retail',
    payment: [{ amount: 29000, currency: 'ARS', caja: 'Luciano' }],
    items: [
      { xlsxSku: 'ELF40006', qty: 1, saleUnit: 19.6, costUnit: 9.15 },
    ],
  },
  {
    num: '#3000', date: '2026-04-01', customer: 'STEFANIA CHIARULLO',
    type: 'retail',
    payment: [{ amount: 31000, currency: 'ARS', caja: 'Luciano' }],
    items: [
      { xlsxSku: 'ELFBC45004', qty: 1, saleUnit: 20.9, costUnit: 10.25 },
    ],
  },
  {
    num: '#3001', date: '2026-04-01', customer: 'NAZARENO SALUM',
    type: 'retail',
    payment: [{ amount: 62000, currency: 'ARS', caja: 'Luciano' }],
    items: [
      { xlsxSku: 'PHE011', qty: 1, saleUnit: 42.3, costUnit: 24.5 },
    ],
  },
  {
    num: '#3002', date: '2026-04-02', customer: 'AGUS KAYA GROW',
    type: 'wholesale',
    payment: [
      { amount: 460000, currency: 'ARS', caja: 'Oficina' },
      { amount: 43000,  currency: 'ARS', caja: 'Luciano' },
    ],
    items: [
      { xlsxSku: 'TOR011',    qty: 1, saleUnit: 27,   costUnit: 21 },
      { xlsxSku: 'TOR012',    qty: 1, saleUnit: 27,   costUnit: 21 },
      { xlsxSku: 'TOR013',    qty: 1, saleUnit: 27,   costUnit: 21 },
      { xlsxSku: 'TOR014',    qty: 1, saleUnit: 27,   costUnit: 21 },
      { xlsxSku: 'PHE011',    qty: 1, saleUnit: 31,   costUnit: 24.5 },
      { xlsxSku: 'PHE013',    qty: 1, saleUnit: 31,   costUnit: 24.5 },
      { xlsxSku: 'BLOW013',   qty: 1, saleUnit: 30,   costUnit: 22.5 },
      { xlsxSku: 'ELF40004',  qty: 2, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40005',  qty: 2, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40006',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40010',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40011',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40013',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40014',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40018',  qty: 2, saleUnit: 13,   costUnit: 9.2 },
    ],
  },
  {
    num: '#3003', date: '2026-04-02', customer: 'MARIANO',
    type: 'retail',
    payment: [{ amount: 62000, currency: 'ARS', caja: 'Luciano' }],
    items: [
      { xlsxSku: 'PHE011', qty: 1, saleUnit: 42.4, costUnit: 24.5 },
    ],
  },
  {
    num: '#3004', date: '2026-04-04', customer: 'TOBI VILA',
    type: 'retail',
    payment: [{ amount: 29000, currency: 'ARS', caja: 'Santiago' }],
    items: [
      { xlsxSku: 'ELF40013', qty: 1, saleUnit: 19.6, costUnit: 9.15 },
    ],
  },
  {
    num: '#3005', date: '2026-04-04', customer: 'LISANDRO ANGLESE',
    type: 'wholesale',
    payment: [
      { amount: 146200, currency: 'ARS', caja: 'Luciano' },
      { amount: 28.99,  currency: 'USD', caja: 'Luciano' },
    ],
    items: [
      { xlsxSku: 'ELF40004',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40010',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40011',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40017',  qty: 1, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELFBC45004',qty: 1, saleUnit: 14.5, costUnit: 9.2 },
      { xlsxSku: 'ELFBC45008',qty: 1, saleUnit: 14.5, costUnit: 9.2 },
      { xlsxSku: 'LM30001',   qty: 2, saleUnit: 12,   costUnit: 9.2 },
      { xlsxSku: 'LM30002',   qty: 1, saleUnit: 12,   costUnit: 9.2 },
      { xlsxSku: 'LM30009',   qty: 1, saleUnit: 12,   costUnit: 9.2 },
    ],
  },
  {
    num: '#3006', date: '2026-04-04', customer: 'MARTINA',
    type: 'retail',
    payment: [{ amount: 70000, currency: 'ARS', caja: 'Santiago' }],
    items: [
      { xlsxSku: 'BLOW013', qty: 1, saleUnit: 22.5, costUnit: 22.5 },
    ],
  },
  {
    num: '#3007', date: '2026-04-04', customer: 'MAXI AXION',
    type: 'retail',
    payment: [{ amount: 58000, currency: 'ARS', caja: 'Santiago' }],
    items: [
      { xlsxSku: 'ELF40006', qty: 1, saleUnit: 19.6, costUnit: 9.2 },
      { xlsxSku: 'ELF40018', qty: 1, saleUnit: 19.6, costUnit: 9.2 },
    ],
  },
  {
    num: '#3008', date: '2026-04-04', customer: 'BICHURRI',
    type: 'retail',
    payment: [{ amount: 58000, currency: 'ARS', caja: 'Santiago' }],
    items: [
      { xlsxSku: 'ELF40014', qty: 2, saleUnit: 19.6, costUnit: 9.2 },
    ],
  },
  {
    num: '#3009', date: '2026-04-04', customer: 'MARTINA',
    type: 'retail',
    payment: [{ amount: 40000, currency: 'ARS', caja: 'Santiago' }],
    items: [
      { xlsxSku: 'HHG604', qty: 1, saleUnit: 27.1, costUnit: 15 },
    ],
  },
  // ── PENDIENTES DE PAGO (April 6) ──
  {
    num: '#3010', date: '2026-04-06', customer: 'DYLA',
    type: 'wholesale', payment: null,
    items: [
      { xlsxSku: 'ELF40013',  qty: 3, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40017',  qty: 2, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'ELF40018',  qty: 5, saleUnit: 13,   costUnit: 9.2 },
      { xlsxSku: 'IGNVM40002',qty: 4, saleUnit: 14.5, costUnit: 10.75 },
      { xlsxSku: 'IGNVM40003',qty: 3, saleUnit: 14.5, costUnit: 10.75 },
      { xlsxSku: 'IGNVM40004',qty: 3, saleUnit: 14.5, costUnit: 10.75 },
    ],
  },
  {
    num: '#3011', date: '2026-04-06', customer: 'GABRIELA KIOSCO YRIGOYEN',
    type: 'wholesale', payment: null,
    items: [
      { xlsxSku: 'IGNVM40002', qty: 2, saleUnit: 14.5, costUnit: 10.75 },
      { xlsxSku: 'IGNVM40003', qty: 2, saleUnit: 14.5, costUnit: 10.75 },
      { xlsxSku: 'IGNVM40004', qty: 2, saleUnit: 14.5, costUnit: 10.75 },
      { xlsxSku: 'IGNVM40005', qty: 2, saleUnit: 14.5, costUnit: 10.75 },
      { xlsxSku: 'IGNVM40011', qty: 2, saleUnit: 14.5, costUnit: 10.75 },
    ],
  },
  {
    num: '#3012', date: '2026-04-06', customer: 'JESICA DENCINGER',
    type: 'retail',
    payment: [{ amount: 29000, currency: 'ARS', caja: 'Luciano' }],
    items: [
      { xlsxSku: 'ELF40018', qty: 1, saleUnit: 19.6, costUnit: 9.2 },
    ],
  },
  {
    num: '#3013', date: '2026-04-06', customer: 'YANINA CHAVEZ',
    type: 'retail',
    payment: [{ amount: 30000, currency: 'ARS', caja: 'Luciano' }],
    items: [
      { xlsxSku: 'IGNUS30014', qty: 1, saleUnit: 20.52, costUnit: 10.25 },
    ],
  },
  {
    num: '#3014', date: '2026-04-06', customer: 'BELEN VELAZQUEZ',
    type: 'retail',
    payment: [{ amount: 29000, currency: 'ARS', caja: 'Luciano' }],
    items: [
      { xlsxSku: 'ELF40016', qty: 1, saleUnit: 19.84, costUnit: 9.15 },
    ],
  },
];

// ─── VENTAS QUE SE DESCUENTAN DEL STOCK INICIAL ───────────────────────────────
// Para cada producto vendido en abril: initialStock = currentStock + totalSoldInApril
function calcAprilSoldByXlskuSku() {
  const sold = {};
  for (const o of APRIL_ORDERS) {
    for (const item of o.items) {
      sold[item.xlsxSku] = (sold[item.xlsxSku] || 0) + item.qty;
    }
  }
  return sold;
}

// ─── UTILS ─────────────────────────────────────────────────────────────────────
function r2(n) { return Math.round(n * 100) / 100; }

async function check(label, { error, data }) {
  if (error) {
    console.error(`❌ ERROR en ${label}:`, error.message);
    process.exit(1);
  }
  return data;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n======================================');
  console.log('  RESET + SEED ABRIL 2026 — FULL VIP');
  console.log('======================================\n');

  // ── PASO 0: Leer secuencia actual de orders ──────────────────────────────────
  console.log('ℹ️  FX rate:', FX, 'ARS/USD\n');

  // ── PASO 1: BORRAR DATA TRANSACCIONAL ───────────────────────────────────────
  console.log('🗑️  Borrando data transaccional...');

  await check('balance_snapshots', await sb.from('balance_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('debt_payments', await sb.from('debt_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('debts', await sb.from('debts').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('cash_movements', await sb.from('cash_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('inventory_movements', await sb.from('inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('order_items', await sb.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('orders', await sb.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('purchase_items', await sb.from('purchase_items').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('purchases', await sb.from('purchases').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  await check('customers', await sb.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000'));

  console.log('✅ Data transaccional eliminada\n');

  // ── PASO 2: RESETEAR STOCK DE TODOS LOS PRODUCTOS A 0 ───────────────────────
  console.log('🔄 Reseteando stock de productos a 0...');
  await check('reset stock', await sb.from('products').update({ stock_actual: 0, stock_reservado: 0 }).neq('id', '00000000-0000-0000-0000-000000000000'));
  console.log('✅ Stock reseteado\n');

  // ── PASO 3: CREAR PRODUCTOS NUEVOS ──────────────────────────────────────────
  console.log('➕ Creando productos nuevos...');

  // Eliminar productos nuevos si ya existen de una corrida anterior
  const newSkus = ['PHE8001', 'PHE8002', 'PHE8003', 'BLAYZDSAT002'];
  await sb.from('products').delete().in('sku', newSkus);

  // PHENOM 8G - 3 productos
  const newProds = [
    { brand: 'PHENOM', model: '8G', flavor: 'ORANGE DROP COOKIE (SATIVA)', sku: 'PHE8001', slug: 'phenom-8g-orange-drop-cookie', category: 'thc', price_min_ars: Math.round(29 * FX), cost_price: 26, visible: false, stock_actual: 0, stock_reservado: 0, name: 'PHENOM 8G - ORANGE DROP COOKIE' },
    { brand: 'PHENOM', model: '8G', flavor: '24K GOLD (SATIVA)',            sku: 'PHE8002', slug: 'phenom-8g-24k-gold', category: 'thc', price_min_ars: Math.round(29 * FX), cost_price: 26, visible: false, stock_actual: 0, stock_reservado: 0, name: 'PHENOM 8G - 24K GOLD' },
    { brand: 'PHENOM', model: '8G', flavor: 'LEMON HAZE (SATIVA)',          sku: 'PHE8003', slug: 'phenom-8g-lemon-haze', category: 'thc', price_min_ars: Math.round(29 * FX), cost_price: 26, visible: false, stock_actual: 0, stock_reservado: 0, name: 'PHENOM 8G - LEMON HAZE' },
    { brand: 'BLAYZD', model: '1 GRAM', flavor: 'HYBRID',                  sku: 'BLAYZDSAT002', slug: 'blayzd-1g-hybrid', category: 'thc', price_min_ars: Math.round(10 * FX), cost_price: 10, visible: false, stock_actual: 0, stock_reservado: 0, name: 'BLAYZD 1G - HYBRID' },
  ];

  const createdProds = await check('crear productos nuevos', await sb.from('products').insert(newProds).select('id,sku'));

  // Registrar IDs en el mapa
  for (const p of createdProds) {
    const found = newProds.find(n => n.sku === p.sku);
    PRODUCT_MAP[p.sku] = { id: p.id, sku: p.sku, name: found?.name || p.sku };
  }
  console.log('✅ Productos nuevos creados:', createdProds.map(p => p.sku).join(', '), '\n');

  // ── PASO 4: COMPRA INICIAL (FIFO) ───────────────────────────────────────────
  console.log('📦 Creando compra inicial (FIFO)...');

  const aprilSold = calcAprilSoldByXlskuSku();

  // Construir lista de items para la compra inicial
  // initialQty = currentStock + soldInApril (para que después de las ventas quede currentStock)
  const purchaseItemsData = [];
  const stockUpdates = []; // { id, initialQty }

  // Items del XLSX stock (con stock > 0 hoy)
  for (const item of XLSX_STOCK) {
    const prod = PRODUCT_MAP[item.sku];
    if (!prod) {
      console.warn(`⚠️  Sin mapping para XLSX SKU ${item.sku} - omitido`);
      continue;
    }
    const soldInApril = aprilSold[item.sku] || 0;
    const initialQty = item.currentStock + soldInApril;
    if (initialQty <= 0) continue;

    purchaseItemsData.push({
      xlsxSku: item.sku,
      productId: prod.id,
      systemSku: prod.sku,
      name: prod.name,
      qty: initialQty,
      cost: item.cost,
    });
    stockUpdates.push({ id: prod.id, initialQty });
  }

  // Items vendidos en abril que NO están en XLSX_STOCK (stock final = 0)
  for (const [xlsxSku, soldQty] of Object.entries(aprilSold)) {
    const alreadyInStock = XLSX_STOCK.some(s => s.sku === xlsxSku);
    if (alreadyInStock) continue;

    const prod = PRODUCT_MAP[xlsxSku];
    if (!prod) {
      console.warn(`⚠️  Sin mapping para SKU de venta ${xlsxSku} - omitido`);
      continue;
    }

    // Buscar el costo del primer item de venta con ese sku
    let cost = 0;
    for (const o of APRIL_ORDERS) {
      const found = o.items.find(i => i.xlsxSku === xlsxSku);
      if (found) { cost = found.costUnit || 0; break; }
    }

    purchaseItemsData.push({
      xlsxSku,
      productId: prod.id,
      systemSku: prod.sku,
      name: prod.name,
      qty: soldQty,
      cost,
    });
    stockUpdates.push({ id: prod.id, initialQty: soldQty });
  }

  const totalPurchaseUsd = r2(purchaseItemsData.reduce((s, i) => s + i.qty * i.cost, 0));

  // Crear la compra
  const purchase = await check('crear compra inicial', await sb.from('purchases').insert({
    supplier: 'Stock Inicial Abril 2026',
    currency: 'USD',
    total: totalPurchaseUsd,
    payment_status: 'paid',
    paid_amount: totalPurchaseUsd,
    note: 'Compra inicial - inventario al inicio de abril 2026 para FIFO',
    created_at: '2026-04-01T00:00:00Z',
  }).select('id').single());

  const purchaseId = purchase.id;

  // Crear purchase_items
  const piRows = purchaseItemsData.map(i => ({
    purchase_id: purchaseId,
    product_id: i.productId,
    product_sku: i.systemSku,
    product_name: i.name,
    qty: i.qty,
    unit_cost: i.cost,
    subtotal: r2(i.qty * i.cost),
  }));

  await check('purchase_items', await sb.from('purchase_items').insert(piRows));

  // Crear inventory_movements (ingreso) para cada producto
  const imRows = purchaseItemsData.map(i => ({
    product_id: i.productId,
    product_sku: i.systemSku,
    type: 'ingreso',
    qty: i.qty,
    unit_cost: i.cost,
    purchase_id: purchaseId,
    note: 'Stock inicial abril 2026',
    created_at: '2026-04-01T00:00:00Z',
  }));

  await check('inventory_movements ingreso', await sb.from('inventory_movements').insert(imRows));

  // Actualizar stock_actual de cada producto al valor inicial
  for (const upd of stockUpdates) {
    await sb.from('products').update({ stock_actual: upd.initialQty }).eq('id', upd.id);
  }

  console.log(`✅ Compra inicial creada: ${purchaseItemsData.length} productos, USD ${totalPurchaseUsd}\n`);

  // ── PASO 5: CREAR CLIENTES ───────────────────────────────────────────────────
  console.log('👥 Creando clientes...');

  const customerNames = [...new Set(APRIL_ORDERS.map(o => o.customer))];
  const customerMap = {}; // name → id

  for (const name of customerNames) {
    const c = await check(`cliente ${name}`, await sb.from('customers').insert({
      name,
      phone: '',
      address: '',
      notes: 'Importado desde XLSX - Abril 2026',
    }).select('id').single());
    customerMap[name] = c.id;
  }

  console.log(`✅ ${customerNames.length} clientes creados\n`);

  // ── PASO 6: CREAR ÓRDENES ────────────────────────────────────────────────────
  console.log('🛒 Creando órdenes abril 2026...');

  for (const o of APRIL_ORDERS) {
    const isWholesale = o.type === 'wholesale';
    const orderCurrency = isWholesale ? 'USD' : 'ARS';
    const isPaid = o.payment !== null;

    // Calcular total de la orden
    // Para retail pagadas: el total real ES el importe pagado (precio en ARS acordado)
    // Para retail sin pagar o wholesale: calcular desde los items
    let totalOrder = 0;
    if (isPaid && !isWholesale) {
      // Usar importe real pagado como total
      for (const p of o.payment) {
        totalOrder += p.amount;
      }
    } else {
      for (const item of o.items) {
        if (isWholesale) {
          totalOrder += item.qty * item.saleUnit;
        } else {
          totalOrder += item.qty * item.saleUnit * FX;
        }
      }
    }
    totalOrder = r2(totalOrder);

    // Calcular total pagado normalizado a la moneda de la orden
    let totalPaid = 0;
    if (isPaid) {
      for (const p of o.payment) {
        if (p.currency === orderCurrency) {
          totalPaid += p.amount;
        } else if (orderCurrency === 'ARS') {
          totalPaid += p.amount * FX; // USD → ARS
        } else {
          totalPaid += p.amount / FX; // ARS → USD
        }
      }
      totalPaid = r2(totalPaid);
    }

    const paymentStatus = !isPaid ? 'unpaid' : (totalPaid >= totalOrder - 0.01 ? 'paid' : 'partial');

    // Crear orden
    const order = await check(`orden ${o.num}`, await sb.from('orders').insert({
      type: o.type,
      status: 'confirmed',
      payment_status: paymentStatus,
      payment_method: isPaid ? (o.payment.some(p => p.currency === 'USD') ? 'efectivo_usd' : 'efectivo') : null,
      customer_name: o.customer,
      customer_phone: '',
      customer_address: '',
      customer_id: customerMap[o.customer],
      notes: `Importado XLSX - ${o.num}`,
      total: totalOrder,
      created_at: `${o.date}T12:00:00Z`,
      confirmed_at: `${o.date}T12:00:00Z`,
    }).select('id,number').single());

    const orderId = order.id;

    // Crear order_items + egreso movements + actualizar stock
    for (const item of o.items) {
      const prod = PRODUCT_MAP[item.xlsxSku];
      if (!prod) {
        console.warn(`  ⚠️  Sin mapping para ${item.xlsxSku} en orden ${o.num}`);
        continue;
      }

      const unitPriceInOrderCurrency = isWholesale ? item.saleUnit : r2(item.saleUnit * FX);
      const subtotal = r2(item.qty * unitPriceInOrderCurrency);

      // order_item
      await check(`order_item ${o.num}-${item.xlsxSku}`, await sb.from('order_items').insert({
        order_id: orderId,
        product_id: prod.id,
        product_name: prod.name,
        product_sku: prod.sku,
        qty: item.qty,
        unit_price: unitPriceInOrderCurrency,
        subtotal,
      }));

      // inventory_movement (egreso)
      await check(`inv_mov egreso ${o.num}-${item.xlsxSku}`, await sb.from('inventory_movements').insert({
        product_id: prod.id,
        product_sku: prod.sku,
        type: 'egreso',
        qty: item.qty,
        unit_cost: item.costUnit || 0,
        order_id: orderId,
        note: `Venta ${o.num} - ${o.customer}`,
        created_at: `${o.date}T12:00:00Z`,
      }));

      // Actualizar stock_actual
      const { data: currentProd } = await sb.from('products').select('stock_actual').eq('id', prod.id).single();
      if (currentProd) {
        await sb.from('products').update({
          stock_actual: Math.max(0, currentProd.stock_actual - item.qty),
        }).eq('id', prod.id);
      }
    }

    // Crear cash_movements por cada pago
    if (isPaid) {
      for (const p of o.payment) {
        await check(`cash_movement ${o.num}`, await sb.from('cash_movements').insert({
          type: 'sale_income',
          amount: p.amount,
          currency: p.currency,
          caja: p.caja,
          category: 'venta',
          order_id: orderId,
          note: `Venta ${o.num} - ${o.customer}`,
          created_at: `${o.date}T12:00:00Z`,
        }));
      }
    }

    // Crear deuda si hay saldo pendiente (partial o unpaid)
    if (paymentStatus === 'partial' || paymentStatus === 'unpaid') {
      const remaining = paymentStatus === 'unpaid' ? totalOrder : r2(totalOrder - totalPaid);
      await check(`deuda ${o.num}`, await sb.from('debts').insert({
        type: 'receivable',
        entity_name: o.customer,
        entity_type: 'customer',
        entity_id: customerMap[o.customer],
        original_amount: remaining,
        paid_amount: 0,
        currency: orderCurrency,
        status: 'pending',
        order_id: orderId,
        note: `Saldo pendiente orden ${o.num}`,
        created_at: `${o.date}T12:00:00Z`,
      }));
      console.log(`  💰 Deuda creada para ${o.customer}: ${remaining} ${orderCurrency}`);
    }

    const statusIcon = paymentStatus === 'paid' ? '✅' : paymentStatus === 'partial' ? '⚡' : '⏳';
    console.log(`  ${statusIcon} Orden ${o.num} - ${o.customer} | ${totalOrder} ${orderCurrency} | ${paymentStatus}`);
  }

  console.log('\n');

  // ── PASO 7: MOVIMIENTOS DE CAJA NO-VENTA ────────────────────────────────────
  console.log('💵 Creando movimientos de caja no-venta...');

  const otherMovements = [
    // CAMBIO DE DIVISAS (April 1): Luciano vendió ARS 333,811.63 y recibió USD 227.92
    {
      type: 'ajuste_out',
      amount: 333811.63,
      currency: 'ARS',
      caja: 'Luciano',
      note: 'Cambio USD/ARS - venta de pesos (recibió USD 227.92)',
      created_at: '2026-04-01T14:00:00Z',
    },
    {
      type: 'ajuste_in',
      amount: 227.92,
      currency: 'USD',
      caja: 'Luciano',
      note: 'Cambio USD/ARS - compra de dólares (vendió ARS 333,811.63)',
      created_at: '2026-04-01T14:00:00Z',
    },
    // RESETEO EFECTIVO (April 6): Pérdida/diferencia de caja en Oficina
    {
      type: 'ajuste_out',
      amount: 16700,
      currency: 'ARS',
      caja: 'Oficina',
      category: 'diferencia_de_caja',
      note: 'Diferencia de caja - pérdida efectivo Oficina',
      created_at: '2026-04-06T18:00:00Z',
    },
    // PAGO SALARIO MARZO (April 6): Retiro de socios
    {
      type: 'ajuste_out',
      amount: 2500000,
      currency: 'ARS',
      caja: 'Santiago',
      category: 'retiro_socios',
      note: 'Retiro socios - pago salario marzo Santiago',
      created_at: '2026-04-06T19:00:00Z',
    },
    {
      type: 'ajuste_out',
      amount: 2500000,
      currency: 'ARS',
      caja: 'Luciano',
      category: 'retiro_socios',
      note: 'Retiro socios - pago salario marzo Luciano',
      created_at: '2026-04-06T19:00:00Z',
    },
  ];

  for (const m of otherMovements) {
    await check(`mov ${m.note.slice(0,30)}`, await sb.from('cash_movements').insert(m));
  }
  console.log('✅ Movimientos no-venta creados\n');

  // ── PASO 8: SALDOS INICIALES (CIERRE MARZO) ──────────────────────────────────
  console.log('🏦 Cargando saldos iniciales (cierre marzo 31)...');

  // Cálculo:
  // Santiago ARS: 435,687.45 (saldo final) + 2,500,000 (retiro) + 109,500 (venta MARCO) - 109,000 (ventas retail Santiago) - 2,500 (retiro) = 2,610,187.45
  //   ventas retail Santiago: TOBI 29,000 + MAXI 58,000 + BICHURRI 58,000 + MARTINA#3006 31,000 + MARTINA#3009 40,000 + MARCO 109,500 = 325,500
  //   saldo_inicial = 435,687.45 + 2,500,000 + 16,700 (reseteo Oficina) + ...
  //   → ajustado para que saldo final = 435,687.45
  // Luciano ARS: 338,440.93 (saldo final) + 2,500,000 (retiro) + 333,811.63 (cambio) - 213,000 (ventas retail Luciano: Poli+Stef+Naz+Mariano+Jesica) = 2,959,252.56
  //   → ajustado para que saldo final = 338,440.93
  // Oficina ARS: 460,000 (saldo final) - 460,000 (ingreso venta AGUS) + 16,700 (reseteo) = 16,700
  // Santiago USD: 831.98 (sin movimientos USD en abril para Santiago)
  // Luciano USD:  -2,057.30 (saldo final) - 600 (USD venta MARCO) - 227.92 (USD cambio) = -2,885.22

  const saldosIniciales = [
    { type: 'ajuste_in',  amount: 2571187.45, currency: 'ARS', caja: 'Santiago', note: 'Saldo inicial - cierre Marzo 31, 2026' },
    { type: 'ajuste_in',  amount: 2711052.56, currency: 'ARS', caja: 'Luciano',  note: 'Saldo inicial - cierre Marzo 31, 2026' },
    { type: 'ajuste_in',  amount: 16700,      currency: 'ARS', caja: 'Oficina',  note: 'Saldo inicial - cierre Marzo 31, 2026' },
    { type: 'ajuste_in',  amount: 831.98,     currency: 'USD', caja: 'Santiago', note: 'Saldo inicial USD - cierre Marzo 31, 2026' },
    { type: 'ajuste_out', amount: 3254.30,    currency: 'USD', caja: 'Luciano',  note: 'Saldo inicial USD negativo (inversión Luciano) - cierre Marzo 31, 2026' },
  ];

  for (const s of saldosIniciales) {
    await check(`saldo ${s.caja} ${s.currency}`, await sb.from('cash_movements').insert({
      ...s,
      category: 'saldo_inicial',
      created_at: '2026-04-01T00:00:00Z',
    }));
  }
  console.log('✅ Saldos iniciales cargados\n');

  // ── PASO 9: CONFIGURAR CAJAS ─────────────────────────────────────────────────
  console.log('⚙️  Configurando cajas...');
  await sb.from('config').upsert({ key: 'cajas', value: 'Santiago,Luciano,Oficina' });
  await sb.from('config').upsert({ key: 'default_caja', value: 'Oficina' });
  console.log('✅ Cajas configuradas: Santiago, Luciano, Oficina\n');

  // ── VERIFICACIÓN FINAL ───────────────────────────────────────────────────────
  console.log('🔍 Verificando saldos finales...');
  const { data: allMovs } = await sb.from('cash_movements').select('type, amount, currency, caja');

  const balances = {};
  const signs = { sale_income: 1, manual_income: 1, ajuste_in: 1, manual_expense: -1, purchase_expense: -1, refund: -1, ajuste_out: -1 };

  for (const m of allMovs) {
    const key = `${m.caja}-${m.currency}`;
    const sign = signs[m.type] || 0;
    balances[key] = (balances[key] || 0) + sign * m.amount;
  }

  console.log('\n📊 SALDOS CALCULADOS vs ESPERADOS:');
  const expected = {
    'Santiago-ARS': 435687.45,
    'Luciano-ARS': 338440.93,
    'Oficina-ARS': 460000,
    'Santiago-USD': 831.98,
    'Luciano-USD': -2057.30,
  };
  let ok = true;
  for (const [key, exp] of Object.entries(expected)) {
    const calc = r2(balances[key] || 0);
    const diff = r2(calc - exp);
    const status = Math.abs(diff) < 1 ? '✅' : '⚠️ ';
    console.log(`  ${status} ${key}: calculado=${calc} | esperado=${exp} | diff=${diff}`);
    if (Math.abs(diff) >= 1) ok = false;
  }

  console.log('\n📦 STOCK FINAL (muestra):');
  const { data: stockCheck } = await sb.from('products').select('sku,stock_actual').in('sku', ['ELF40018','TORCH50G-012','ELF40006','BLOWPEN-001']).order('sku');
  for (const p of stockCheck) {
    console.log(`  ${p.sku}: ${p.stock_actual} unidades`);
  }

  if (ok) {
    console.log('\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
  } else {
    console.log('\n⚠️  MIGRACIÓN COMPLETADA CON DIFERENCIAS MENORES EN SALDOS (revisar arriba)');
  }

  console.log('\nÓrdenes cargadas:', APRIL_ORDERS.length);
  console.log('Clientes creados:', customerNames.length);
  console.log('Stock inicial cargado:', purchaseItemsData.length, 'productos');
  console.log('FX usado:', FX, 'ARS/USD\n');
}

main().catch(err => {
  console.error('\n💥 ERROR CRÍTICO:', err.message);
  process.exit(1);
});
