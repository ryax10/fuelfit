require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SKU_NAME = {
  'ELF40004': 'ELF BAR 4000 - Flavor 4',
  'ELF40005': 'ELF BAR 4000 - Flavor 5',
  'ELF40013': 'ELF BAR 4000 - Flavor 13',
  'ELF40017': 'ELF BAR 4000 - Flavor 17',
  'IGNITV30-003': 'IGNIT V30 - Flavor 3',
  'IGNITV30-004': 'IGNIT V30 - Flavor 4',
  'IGNITV30-005': 'IGNIT V30 - Flavor 5',
  'IGNITV30-007': 'IGNIT V30 - Flavor 7',
  'IGNITV30-016': 'IGNIT V30 - Flavor 16',
  'IGNITV30-018': 'IGNIT V30 - Flavor 18',
  'IGNITV30-022': 'IGNIT V30 - Flavor 22',
  'ELFBABC4-001': 'ELF BAR BC4000 - Flavor 1',
  'ELFBABC4-004': 'ELF BAR BC4000 - Flavor 4',
  'ELFBABC4-005': 'ELF BAR BC4000 - Flavor 5',
  'ELFBABC4-006': 'ELF BAR BC4000 - Flavor 6',
  'ELFBABC4-007': 'ELF BAR BC4000 - Flavor 7',
  'ELFBABC4-008': 'ELF BAR BC4000 - Flavor 8',
  'ELFBABC4-009': 'ELF BAR BC4000 - Flavor 9',
  'TORCHHUL-001': 'TORCH HULK - Flavor 1',
  'TORCHHUL-002': 'TORCH HULK - Flavor 2',
  'TORCHHUL-003': 'TORCH HULK - Flavor 3',
  'TORCHHUL-004': 'TORCH HULK - Flavor 4',
  'TORCHHUL-005': 'TORCH HULK - Flavor 5',
  'TORCHHUL-006': 'TORCH HULK - Flavor 6',
  'TORCHHUL-007': 'TORCH HULK - Flavor 7',
  'TORCHHUL-008': 'TORCH HULK - Flavor 8',
  'TORCHHUL-009': 'TORCH HULK - Flavor 9',
};

async function run() {
  // Get purchase IDs by number
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, number')
    .in('number', [168, 169, 170]);

  if (!purchases || purchases.length === 0) {
    console.error('No purchases found');
    process.exit(1);
  }

  const byNumber = {};
  for (const p of purchases) byNumber[p.number] = p.id;
  console.log('Purchase IDs:', byNumber);

  // Get all product IDs by SKU
  const allSkus = Object.keys(SKU_NAME);
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, sku')
    .in('sku', allSkus);

  if (prodErr) { console.error('Error fetching products:', prodErr.message); process.exit(1); }

  const skuToId = {};
  for (const p of (products || [])) skuToId[p.sku] = p.id;
  console.log('SKU→ID map:', skuToId);

  // Check if items already exist
  for (const num of [168, 169, 170]) {
    const pid = byNumber[num];
    if (!pid) { console.log(`Purchase #${num} not found, skipping`); continue; }

    const { data: existing } = await supabase
      .from('purchase_items')
      .select('id')
      .eq('purchase_id', pid);

    if (existing && existing.length > 0) {
      console.log(`Purchase #${num} already has ${existing.length} items, skipping`);
      continue;
    }

    let items = [];

    if (num === 168) {
      const skus = [
        { sku: 'ELF40004', qty: 25, unit_cost: 9.20 },
        { sku: 'ELF40005', qty: 5, unit_cost: 9.20 },
        { sku: 'ELF40013', qty: 10, unit_cost: 9.20 },
        { sku: 'ELF40017', qty: 10, unit_cost: 9.20 },
        { sku: 'IGNITV30-003', qty: 30, unit_cost: 9.90 },
        { sku: 'IGNITV30-004', qty: 30, unit_cost: 9.90 },
        { sku: 'IGNITV30-005', qty: 30, unit_cost: 9.90 },
        { sku: 'IGNITV30-007', qty: 30, unit_cost: 9.90 },
        { sku: 'IGNITV30-016', qty: 10, unit_cost: 9.90 },
        { sku: 'IGNITV30-018', qty: 15, unit_cost: 9.90 },
        { sku: 'IGNITV30-022', qty: 5, unit_cost: 9.90 },
      ];
      items = skus.map(i => ({
        purchase_id: pid,
        product_id: skuToId[i.sku] || null,
        product_sku: i.sku,
        product_name: SKU_NAME[i.sku] || i.sku,
        qty: i.qty,
        unit_cost: i.unit_cost,
        subtotal: i.qty * i.unit_cost,
      }));
    }

    if (num === 169) {
      const skus = [
        { sku: 'ELFBABC4-001', qty: 10 },
        { sku: 'ELFBABC4-004', qty: 10 },
        { sku: 'ELFBABC4-005', qty: 5 },
        { sku: 'ELFBABC4-006', qty: 5 },
        { sku: 'ELFBABC4-007', qty: 10 },
        { sku: 'ELFBABC4-008', qty: 5 },
        { sku: 'ELFBABC4-009', qty: 5 },
      ];
      items = skus.map(i => ({
        purchase_id: pid,
        product_id: skuToId[i.sku] || null,
        product_sku: i.sku,
        product_name: SKU_NAME[i.sku] || i.sku,
        qty: i.qty,
        unit_cost: 10.60,
        subtotal: i.qty * 10.60,
      }));
    }

    if (num === 170) {
      const skus = [
        { sku: 'TORCHHUL-001', qty: 20 },
        { sku: 'TORCHHUL-002', qty: 60 },
        { sku: 'TORCHHUL-003', qty: 20 },
        { sku: 'TORCHHUL-004', qty: 40 },
        { sku: 'TORCHHUL-005', qty: 60 },
        { sku: 'TORCHHUL-006', qty: 40 },
        { sku: 'TORCHHUL-007', qty: 40 },
        { sku: 'TORCHHUL-008', qty: 40 },
        { sku: 'TORCHHUL-009', qty: 40 },
      ];
      items = skus.map(i => ({
        purchase_id: pid,
        product_id: skuToId[i.sku] || null,
        product_sku: i.sku,
        product_name: SKU_NAME[i.sku] || i.sku,
        qty: i.qty,
        unit_cost: 2.50,
        subtotal: i.qty * 2.50,
      }));
    }

    if (items.length === 0) continue;

    const { error } = await supabase.from('purchase_items').insert(items);
    if (error) {
      console.error(`Error inserting items for purchase #${num}:`, error.message);
    } else {
      console.log(`✅ Inserted ${items.length} items for purchase #${num}`);
    }
  }

  console.log('Done.');
}

run().catch(console.error);
