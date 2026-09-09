/**
 * Procesa una imagen de producto:
 * 1. Detecta bounding box del contenido (recorta whitespace/transparencia)
 * 2. Agrega padding uniforme del 10%
 * 3. Centra en canvas 1200x1200 fondo blanco (contain)
 * 4. Exporta como WebP reduciendo calidad hasta quedar bajo 2MB
 */
export async function processProductImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();

    img.onload = () => {
      // Canvas temporal para leer píxeles
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return reject(new Error("No se pudo crear el contexto de canvas"));
      tempCtx.drawImage(img, 0, 0);

      const { width, height } = tempCanvas;
      const imageData = tempCtx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Detectar bounding box del contenido (ignorar blanco y transparente)
      const WHITE_THRESHOLD = 238;
      const ALPHA_THRESHOLD = 15;
      let minX = width, minY = height, maxX = 0, maxY = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
          if (a < ALPHA_THRESHOLD) continue;
          if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      // Si no se encontró contenido no-blanco, usar imagen completa
      if (minX > maxX || minY > maxY) {
        minX = 0; minY = 0; maxX = width - 1; maxY = height - 1;
      }

      // Padding del 10% del lado mayor del contenido
      const contentW = maxX - minX + 1;
      const contentH = maxY - minY + 1;
      const pad = Math.round(Math.max(contentW, contentH) * 0.10);

      const srcX = Math.max(0, minX - pad);
      const srcY = Math.max(0, minY - pad);
      const srcW = Math.min(width - srcX, contentW + pad * 2);
      const srcH = Math.min(height - srcY, contentH + pad * 2);

      // Canvas de salida 1200x1200 con fondo blanco
      const OUT = 1200;
      const outCanvas = document.createElement("canvas");
      outCanvas.width = OUT;
      outCanvas.height = OUT;
      const ctx = outCanvas.getContext("2d");
      if (!ctx) return reject(new Error("No se pudo crear el contexto de salida"));

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const scale = Math.min(OUT / srcW, OUT / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const drawX = (OUT - drawW) / 2;
      const drawY = (OUT - drawH) / 2;

      ctx.drawImage(tempCanvas, srcX, srcY, srcW, srcH, drawX, drawY, drawW, drawH);
      URL.revokeObjectURL(img.src);

      // Exportar como WebP reduciendo calidad hasta quedar bajo 2MB
      const tryExport = (quality: number) => {
        outCanvas.toBlob((blob) => {
          if (!blob) return reject(new Error("No se pudo exportar la imagen"));
          if (blob.size > 2_000_000 && quality > 0.45) {
            tryExport(Math.round((quality - 0.05) * 100) / 100);
          } else {
            resolve(blob);
          }
        }, "image/webp", quality);
      };

      tryExport(0.95);
    };

    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = URL.createObjectURL(file);
  });
}
