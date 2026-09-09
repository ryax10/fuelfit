const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://uwrgztccjobtiydvlkdu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cmd6dGNjam9idGl5ZHZsa2R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5MjU3MSwiZXhwIjoyMDg2NzY4NTcxfQ.Z_G5-Y6m-Ip6h_Qk4vR95E4yAYBEivaE6g4GssE6Ld8'
);

// Stock esperado según XLSX (currentStock al 7/4/2026)
const XLSX_STOCK = [
  { sku: 'BHG5001',      sysSku: 'BURNHGUM-001',        expected: 4  },
  { sku: 'HHG601',       sysSku: 'HEAVYGUM-001',         expected: 1  },
  { sku: 'HHG602',       sysSku: 'HEAVYGUM-002',         expected: 1  },
  { sku: 'HHG603',       sysSku: 'HEAVYGUM-003',         expected: 1  },
  { sku: 'HHG604',       sysSku: 'HEAVYGUM-004',         expected: 1  },
  { sku: 'HHG607',       sysSku: 'HEAVYGUM-007',         expected: 2  },
  { sku: 'HHG608',       sysSku: 'HEAVYGUM-008',         expected: 2  },
  { sku: 'TOR-4002',     sysSku: 'TORCH40G-004',         expected: 4  },
  { sku: 'TOR010',       sysSku: 'TORCH50G-010',         expected: 2  },
  { sku: 'TOR011',       sysSku: 'TORCH50G-011',         expected: 1  },
  { sku: 'TOR012',       sysSku: 'TORCH50G-012',         expected: 4  },
  { sku: 'TOR013',       sysSku: 'TORCH50G-013',         expected: 4  },
  { sku: 'TOR014',       sysSku: 'TORCH50G-014',         expected: 4  },
  { sku: 'TOR015',       sysSku: 'TORCH50G-015',         expected: 3  },
  { sku: 'TOR016',       sysSku: 'TORCH50G-016',         expected: 3  },
  { sku: 'TOR017',       sysSku: 'TORCH50G-017',         expected: 5  },
  { sku: 'TOR036',       sysSku: 'TORCH50G-036',         expected: 3  },
  { sku: 'TOR50038',     sysSku: 'TORCH50G-038',         expected: 5  },
  { sku: 'PHE011',       sysSku: 'PHENO60G-022',         expected: 6  },
  { sku: 'PHE013',       sysSku: 'PHENO60G-024',         expected: 2  },
  { sku: 'BLOWPEN001',   sysSku: 'BLOWPEN-001',          expected: 11 },
  { sku: 'BLOW005',      sysSku: 'BLOW35G-005',          expected: 12 },
  { sku: 'BLOW013',      sysSku: 'BLOW35G-013',          expected: 1  },
  { sku: 'BLOW017',      sysSku: 'BLOW35G-017',          expected: 3  },
  { sku: 'BLOWCAP009',   sysSku: 'BLOWCAP-009',          expected: 6  },
  { sku: 'BLOWCAP010',   sysSku: 'BLOWCAP-010',          expected: 3  },
  { sku: 'BLOWCAP011',   sysSku: 'BLOWCAP-011',          expected: 4  },
  { sku: 'BLOWCAP012',   sysSku: 'BLOWCAP-012',          expected: 4  },
  { sku: 'BLOWCAP013',   sysSku: 'BLOWCAP-013',          expected: 4  },
  { sku: 'BLOWCAP014',   sysSku: 'BLOWCAP-014',          expected: 2  },
  { sku: 'BLOWCAP015',   sysSku: 'BLOWCAP-015',          expected: 5  },
  { sku: 'BLAYZDSAT001', sysSku: 'BLAYZDSAT001',         expected: 10 },
  { sku: 'ELF2301',      sysSku: 'ELFBAGH2-001',         expected: 10 },
  { sku: 'ELF2304',      sysSku: 'ELFBAGH2-004',         expected: 11 },
  { sku: 'ELF2305',      sysSku: 'ELFBAGH2-005',         expected: 6  },
  { sku: 'ELF2308',      sysSku: 'ELFBAGH2-008',         expected: 1  },
  { sku: 'ELF2312',      sysSku: 'ELFBAGH2-012',         expected: 10 },
  { sku: 'ELF2313',      sysSku: 'ELFBAGH2-013',         expected: 6  },
  { sku: 'ELF40004',     sysSku: 'ELF40004',             expected: 38 },
  { sku: 'ELF40005',     sysSku: 'ELF40005',             expected: 18 },
  { sku: 'ELF40006',     sysSku: 'ELF40006',             expected: 6  },
  { sku: 'ELF40008',     sysSku: 'ELF40008',             expected: 5  },
  { sku: 'ELF40010',     sysSku: 'ELF40010',             expected: 2  },
  { sku: 'ELF40011',     sysSku: 'ELF40011',             expected: 7  },
  { sku: 'ELF40013',     sysSku: 'ELF40013',             expected: 20 },
  { sku: 'ELF40014',     sysSku: 'ELF40014',             expected: 1  },
  { sku: 'ELF40016',     sysSku: 'ELF40016',             expected: 1  },
  { sku: 'ELF40017',     sysSku: 'ELF40017',             expected: 7  },
  { sku: 'ELF40018',     sysSku: 'ELF40018',             expected: 40 },
  { sku: 'ELF40020',     sysSku: 'ELF40020',             expected: 5  },
  { sku: 'ELFBC45004',   sysSku: 'ELFBABC4-004',         expected: 1  },
  { sku: 'ELFBC45007',   sysSku: 'ELFBABC4-007',         expected: 1  },
  { sku: 'ELFBC45008',   sysSku: 'ELFBABC4-008',         expected: 1  },
  { sku: 'IGN30003',     sysSku: 'IGNITV30-003',         expected: 3  },
  { sku: 'IGN30004',     sysSku: 'IGNITV30-004',         expected: 1  },
  { sku: 'IGN30005',     sysSku: 'IGNITV30-005',         expected: 9  },
  { sku: 'IGN30018',     sysSku: 'IGNITV30-018',         expected: 17 },
  { sku: 'IGN30022',     sysSku: 'IGNITV30-022',         expected: 2  },
  { sku: 'IGNUS30001',   sysSku: 'IGN-V300-US-BLACK001', expected: 5  },
  { sku: 'IGNUS30002',   sysSku: 'IGN-V300-US-BLACK002', expected: 10 },
  { sku: 'IGNUS30003',   sysSku: 'IGN-V300-US-BLACK004', expected: 9  },
  { sku: 'IGNUS30004',   sysSku: 'IGN-V300-US-BLACK003', expected: 4  },
  { sku: 'IGNUS30006',   sysSku: 'IGN-V300-US-BLACK006', expected: 5  },
  { sku: 'IGNUS30011',   sysSku: 'IGN-V300-US-BLACK007', expected: 5  },
  { sku: 'IGNUS30012',   sysSku: 'IGN-V300-US-BLACK008', expected: 5  },
  { sku: 'IGNUS30013',   sysSku: 'IGN-V300-US-BLACK009', expected: 20 },
  { sku: 'IGNUS30014',   sysSku: 'IGN-V300-US-BLACK010', expected: 9  },
  { sku: 'IGNVM40002',   sysSku: 'IGNITV40-002',         expected: 5  },
  { sku: 'IGNVM40003',   sysSku: 'IGNITV40-003',         expected: 6  },
  { sku: 'IGNVM40004',   sysSku: 'IGNITV40-004',         expected: 5  },
  { sku: 'IGNVM40005',   sysSku: 'IGNITV40-005',         expected: 8  },
  { sku: 'IGNVM40011',   sysSku: 'IGNITV40-011',         expected: 8  },
  { sku: 'QIT301',       sysSku: 'QITBOL-001',           expected: 15 },
  { sku: 'QIT302',       sysSku: 'QITBOL-002',           expected: 10 },
  { sku: 'QIT305',       sysSku: 'QITBOL-005',           expected: 11 },
  { sku: 'QIT306',       sysSku: 'QITBOL-006',           expected: 1  },
  { sku: 'QIT307',       sysSku: 'QITBOL-007',           expected: 4  },
  { sku: 'QIT601',       sysSku: 'QITBOL-008',           expected: 9  },
  { sku: 'QIT602',       sysSku: 'QITBOL-009',           expected: 11 },
  { sku: 'QIT603',       sysSku: 'QITBOL-010',           expected: 5  },
  { sku: 'QIT604',       sysSku: 'QITBOL-011',           expected: 7  },
  { sku: 'QIT605',       sysSku: 'QITBOL-012',           expected: 17 },
  { sku: 'QIT606',       sysSku: 'QITBOL-013',           expected: 1  },
  { sku: 'QIT1501',      sysSku: 'QITBOL-015',           expected: 2  },
  { sku: 'QIT1502',      sysSku: 'QITBOL-016',           expected: 8  },
  { sku: 'QIT1503',      sysSku: 'QITBOL-017',           expected: 17 },
  { sku: 'QIT1504',      sysSku: 'QITBOL-018',           expected: 6  },
  { sku: 'ACC002',       sysSku: 'ACC002',               expected: 2  },
  { sku: 'ACC007',       sysSku: 'ACC007',               expected: 54 },
  { sku: 'ACC008',       sysSku: 'ACC008',               expected: 10 },
  // vendidos en abril, stock final 0
  { sku: 'LM30001',      sysSku: 'LM30001',              expected: 0  },
  { sku: 'LM30002',      sysSku: 'LM30002',              expected: 0  },
  { sku: 'LM30009',      sysSku: 'LM30004',              expected: 0  },
  { sku: 'PHE8001',      sysSku: 'PHE8001',              expected: 0  },
  { sku: 'PHE8002',      sysSku: 'PHE8002',              expected: 0  },
  { sku: 'PHE8003',      sysSku: 'PHE8003',              expected: 0  },
];

async function main() {
  const { data: prods } = await sb.from('products').select('sku,name,stock_actual,stock_reservado');
  const bySku = {};
  for (const p of prods) bySku[p.sku] = p;

  let ok = 0;
  const diffs = [];
  const missing = [];

  for (const row of XLSX_STOCK) {
    const p = bySku[row.sysSku];
    if (!p) { missing.push(row); continue; }
    const actual = p.stock_actual;
    if (actual !== row.expected) {
      diffs.push({ xlsxSku: row.sku, sysSku: row.sysSku, name: p.name, expected: row.expected, actual, diff: actual - row.expected });
    } else {
      ok++;
    }
  }

  // Productos en sistema con stock > 0 que NO están en XLSX
  const xlsxSysSkus = new Set(XLSX_STOCK.map(r => r.sysSku));
  const extras = prods.filter(p => p.stock_actual > 0 && !xlsxSysSkus.has(p.sku));

  console.log('\n=== INVENTARIO: SISTEMA vs XLSX ===');
  console.log('Verificados:', XLSX_STOCK.length, '| OK:', ok, '| Diferencias:', diffs.length);

  if (missing.length) {
    console.log('\n❌ NO ENCONTRADOS en sistema:');
    missing.forEach(m => console.log('  ', m.sku, '->', m.sysSku));
  }

  if (diffs.length) {
    console.log('\n⚠️  DIFERENCIAS (xlsx_sku | nombre | esperado | sistema | diff):');
    diffs.forEach(d => {
      const sign = d.diff > 0 ? '+' : '';
      console.log(`  ${d.xlsxSku.padEnd(14)} | ${d.name.slice(0,35).padEnd(35)} | esp:${String(d.expected).padStart(3)} | sis:${String(d.actual).padStart(3)} | ${sign}${d.diff}`);
    });
  } else {
    console.log('\n✅ Todo el stock coincide exactamente con el XLSX');
  }

  if (extras.length) {
    console.log('\n📦 PRODUCTOS CON STOCK en sistema NO listados en XLSX:');
    extras.forEach(p => console.log(`  ${p.sku.padEnd(25)} | ${p.name.slice(0,40)} | stock: ${p.stock_actual}`));
  }
}

main().catch(e => console.error(e.message));
