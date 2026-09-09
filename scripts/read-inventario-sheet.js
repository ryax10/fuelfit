/**
 * read-inventario-sheet.js
 * Lee la hoja INVENTARIO del XLSX y muestra su estructura.
 * Uso: node scripts/read-inventario-sheet.js
 */
require('dotenv').config({ path: '.env.local' });
const XLSX = require('xlsx');

const XLSX_PATH = 'c:/Users/Luch1/Downloads/FULLVAPO.xlsx';

const wb = XLSX.readFile(XLSX_PATH);
console.log('Hojas disponibles:', wb.SheetNames.join(', '));
console.log('');

// Intentar leer hoja INVENTARIO (o similar)
const possible = wb.SheetNames.filter(n =>
  n.toUpperCase().includes('INVENT') || n.toUpperCase().includes('STOCK')
);
console.log('Hojas con INVENT/STOCK:', possible);

for (const name of possible) {
  const ws = wb.Sheets[name];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n── Hoja: "${name}" (${raw.length} filas) ──`);
  // Mostrar primeras 10 filas con contenido
  raw.slice(0, 15).forEach((row, i) => {
    const hasContent = row.some(c => c !== null && c !== '');
    if (hasContent) console.log(`  Fila ${i + 1}:`, JSON.stringify(row.slice(0, 8)));
  });
}
