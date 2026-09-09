/**
 * create-torch-5g.js
 * Crea los 10 productos TORCH 5.0G, sube sus imágenes y actualiza stock
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const IMG_DIR = 'C:/Users/Luch1/Downloads/images/TORCH 5G';

const PRODUCTS = [
  { sku: 'TORCH50G-010', flavor: 'HONOLULU HAZE (SATIVA)',       img: 'honolulu haze.png',       stock: 5 },
  { sku: 'TORCH50G-011', flavor: 'SUPER LEMON COOKIES',           img: 'super lemon cookies.png', stock: 5 },
  { sku: 'TORCH50G-012', flavor: 'MANGO MERINGUE (SATIVA)',       img: 'mango meringue.png',      stock: 5 },
  { sku: 'TORCH50G-013', flavor: 'GRAPEFRUIT DURBAN (SATIVA)',    img: 'grapefruit durban.png',   stock: 5 },
  { sku: 'TORCH50G-014', flavor: 'TROPICAL CHERRY GAS',           img: 'tropical cherry gas.png', stock: 5 },
  { sku: 'TORCH50G-015', flavor: 'RASPBERRY LEMONADE',            img: 'raspberry lemonade.png',  stock: 5 },
  { sku: 'TORCH50G-016', flavor: 'COTTON CANDY RUNTZ (INDICA)',   img: 'cotton candy runtz.png',  stock: 5 },
  { sku: 'TORCH50G-017', flavor: 'BANANA BERRY CAKE (INDICA)',    img: 'banana berry cake.png',   stock: 5 },
  { sku: 'TORCH50G-036', flavor: 'SKYWALKER OG (HYBRID)',         img: 'skywalker og.png',        stock: 5 },
  { sku: 'TORCH50G-038', flavor: 'FORBIDDEN ROMULAN',             img: 'forbidden romulan.png',   stock: 5 },
];

function toSlug(text) {
  return text.toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
    .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-');
}

async function uploadImage(imgFile, sku) {
  const imgPath = path.join(IMG_DIR, imgFile);
  const fileBuffer = fs.readFileSync(imgPath);
  const fileName = `product-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, fileBuffer, { contentType: 'image/png', upsert: false });

  if (error) {
    console.log(`  ✗ Upload ${sku}: ${error.message}`);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return publicUrl;
}

async function run() {
  console.log('=== CREAR TORCH 5.0G ===\n');

  for (const p of PRODUCTS) {
    const name = `TORCH 5G ${p.flavor}`;
    const slug = toSlug(`torch-5-0g-${p.flavor}`) + '-' + Math.floor(Math.random() * 900 + 100);

    // Subir imagen
    process.stdout.write(`  Subiendo imagen ${p.img}... `);
    const imageUrl = await uploadImage(p.img, p.sku);
    console.log(imageUrl ? '✓' : '✗ sin imagen');

    // Crear producto
    const { error } = await supabase.from('products').insert({
      sku: p.sku,
      brand: 'TORCH',
      model: '5G',
      flavor: p.flavor,
      slug,
      name,
      category: 'thc',
      cost_price: 21,
      price_min_ars: 65000,
      price_may_x15: 27,
      price_may_x50: 25,
      price_may_x100: 23,
      stock_actual: p.stock,
      stock_reservado: 0,
      image: imageUrl || '',
      visible: true,
      featured: false,
      units_per_pack: 1,
      unit_sale_options: null,
    });

    if (error) console.log(`  ✗ ${p.sku}: ${error.message}`);
    else console.log(`  ✓ ${p.sku} | ${name} | stock ${p.stock}`);
  }

  console.log('\n=== LISTO — 10 productos TORCH 5.0G creados ===');
}

run().catch(console.error);
