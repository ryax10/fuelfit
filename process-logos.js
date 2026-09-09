const sharp = require("sharp");
const path  = require("path");

// #c084fc — violet-light de la página
const TR = 192, TG = 132, TB = 252;

/**
 * bg: "dark"  → fondo negro/oscuro (ELF BAR, IGNITE)
 *              pixels oscuros = transparente, claros = opaco
 * bg: "light" → fondo blanco/claro (QIT)
 *              pixels muy blancos/grises = transparente, coloreados = opaco
 */
async function processLogo(input, output, { bg = "dark", blur = 0 } = {}) {
  let pipeline = sharp(path.resolve(input));
  if (blur > 0) pipeline = pipeline.blur(blur);

  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];

    let alpha;

    if (bg === "dark") {
      // Luminancia: negro = transparente, blanco = opaco
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if      (lum < 0.12)  alpha = 0;
      else if (lum < 0.35)  alpha = Math.round(((lum - 0.12) / 0.23) * 255);
      else                  alpha = 255;
    } else {
      // Fondo claro: detectar "colorfulness" (diferencia entre canales)
      // Pixel blanco: max-min ≈ 0 → transparente
      // Pixel colorido: max-min grande → opaco
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const colorfulness = (maxC - minC) / 255;      // 0 = gris, 1 = muy saturado
      const whiteness    = (r + g + b) / (3 * 255);  // 1 = blanco puro

      // Pixel blanco o casi blanco → transparente
      if      (whiteness > 0.92)              alpha = 0;
      // Antialiasing: pixels entre blanco y el color real
      else if (whiteness > 0.78)              alpha = Math.round(((0.92 - whiteness) / 0.14) * 255);
      // Pixel con color → opaco
      else                                    alpha = 255;
    }

    out[i * 4 + 0] = TR;
    out[i * 4 + 1] = TG;
    out[i * 4 + 2] = TB;
    out[i * 4 + 3] = alpha;
  }

  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(path.resolve(output));
  console.log("OK:", output);
}

Promise.all([
  processLogo("public/brands/elfbar.png",        "public/brands/elfbar-vip.png",        { bg: "dark",  blur: 1.8 }),
  processLogo("public/brands/ignite.png",        "public/brands/ignite-vip.png",        { bg: "dark",  blur: 0   }),
  processLogo("public/brands/qit.png",           "public/brands/qit-vip.png",           { bg: "dark",  blur: 0   }),
  processLogo("public/brands/blow.png",          "public/brands/blow-vip.png",          { bg: "dark",  blur: 0   }),
  processLogo("public/brands/burn_hemp.png",     "public/brands/burn_hemp-vip.png",     { bg: "light", blur: 0   }),
  processLogo("public/brands/torch.png",         "public/brands/torch-vip.png",         { bg: "dark",  blur: 0   }),
  processLogo("public/brands/heavy_hitters.png", "public/brands/heavy_hitters-vip.png", { bg: "dark",  blur: 0   }),
]).catch(e => { console.error(e.message); process.exit(1); });
