/**
 * reprocess-torch-5g-images.js
 * Reprocesa las imágenes de TORCH 5G:
 *   - Recorta whitespace/transparencia
 *   - Agrega 10% padding
 *   - Centra en canvas 1200x1200 fondo blanco
 *   - Exporta como WebP
 *   - Sube a Supabase Storage y actualiza el producto
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const IMG_DIR = 'C:/Users/Luch1/Downloads/images/TORCH 5G';

const PRODUCTS = [
  { sku: 'TORCH50G-010', img: 'honolulu haze.png' },
  { sku: 'TORCH50G-011', img: 'super lemon cookies.png' },
  { sku: 'TORCH50G-012', img: 'mango meringue.png' },
  { sku: 'TORCH50G-013', img: 'grapefruit durban.png' },
  { sku: 'TORCH50G-014', img: 'tropical cherry gas.png' },
  { sku: 'TORCH50G-015', img: 'raspberry lemonade.png' },
  { sku: 'TORCH50G-016', img: 'cotton candy runtz.png' },
  { sku: 'TORCH50G-017', img: 'banana berry cake.png' },
  { sku: 'TORCH50G-036', img: 'skywalker og.png' },
  { sku: 'TORCH50G-038', img: 'forbidden romulan.png' },
];

async function processImage(imgPath) {
  const OUT = 1200;
  const WHITE_THRESHOLD = 238;

  // Cargar imagen original con canal alpha
  const raw = sharp(imgPath).ensureAlpha();
  const { data, info } = await raw.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Detectar bounding box del contenido (ignorar blanco y transparente)
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      if (a < 15) continue;
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Fallback si no hay contenido no-blanco
  if (minX > maxX || minY > maxY) {
    minX = 0; minY = 0; maxX = width - 1; maxY = height - 1;
  }

  // Padding 10% del lado mayor del contenido
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const pad = Math.round(Math.max(contentW, contentH) * 0.10);

  const srcX = Math.max(0, minX - pad);
  const srcY = Math.max(0, minY - pad);
  const srcW = Math.min(width - srcX, contentW + pad * 2);
  const srcH = Math.min(height - srcY, contentH + pad * 2);

  // Recortar la región de contenido
  const cropped = await sharp(imgPath)
    .ensureAlpha()
    .extract({ left: srcX, top: srcY, width: srcW, height: srcH })
    .toBuffer();

  // Calcular dimensiones para contain en 1200x1200
  const scale = Math.min(OUT / srcW, OUT / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);

  // Redimensionar el contenido recortado
  const resized = await sharp(cropped)
    .resize(drawW, drawH, { fit: 'fill' })
    .toBuffer();

  // Componer sobre fondo blanco 1200x1200
  const result = await sharp({
    create: { width: OUT, height: OUT, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .composite([{
      input: resized,
      left: Math.round((OUT - drawW) / 2),
      top: Math.round((OUT - drawH) / 2),
    }])
    .webp({ quality: 90 })
    .toBuffer();

  return result;
}

async function run() {
  console.log('=== REPROCESAR IMÁGENES TORCH 5G ===\n');

  for (const p of PRODUCTS) {
    const imgPath = path.join(IMG_DIR, p.img);
    process.stdout.write(`  ${p.sku} | ${p.img}... `);

    // Procesar imagen
    let webpBuffer;
    try {
      webpBuffer = await processImage(imgPath);
    } catch (err) {
      console.log(`✗ Error al procesar: ${err.message}`);
      continue;
    }

    // Subir a Supabase Storage
    const fileName = `product-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    const { error: upErr } = await supabase.storage
      .from('product-images')
      .upload(fileName, webpBuffer, { contentType: 'image/webp', upsert: false });

    if (upErr) { console.log(`✗ Upload: ${upErr.message}`); continue; }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    // Actualizar producto en DB
    const { error: updErr } = await supabase.from('products')
      .update({ image: publicUrl })
      .eq('sku', p.sku);

    if (updErr) { console.log(`✗ DB update: ${updErr.message}`); continue; }

    console.log(`✓ (${Math.round(webpBuffer.length / 1024)}KB)`);
  }

  console.log('\n=== LISTO ===');
}

run().catch(console.error);
