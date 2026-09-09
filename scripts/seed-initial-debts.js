const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://uwrgztccjobtiydvlkdu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cmd6dGNjam9idGl5ZHZsa2R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5MjU3MSwiZXhwIjoyMDg2NzY4NTcxfQ.Z_G5-Y6m-Ip6h_Qk4vR95E4yAYBEivaE6g4GssE6Ld8'
);

// Deudas a cobrar (clientes nos deben) — saldos previos al sistema
const RECEIVABLES = [
  { entity_name: 'Parley',               amount: 109.50 },
  { entity_name: 'Tomas Ponce',          amount: 34.50  },
  { entity_name: 'Kiosco Videla',        amount: 65.40  },
  { entity_name: 'Lu',                   amount: 263.10 },
  { entity_name: 'Pulvi Store',          amount: 4.35   },
  { entity_name: 'Mati Fuentes',         amount: 30.00  },
  { entity_name: 'Gaston Altamirano',    amount: 221.95 },
  { entity_name: 'Agustin Sparking Lanus', amount: 29.50 },
  { entity_name: 'Val',                  amount: 101.00 },
];

// Deudas a pagar (nosotros debemos) — proveedores/acreedores
const PAYABLES = [
  { entity_name: 'Martin BLOW', entity_type: 'supplier', amount: 1257.50 },
  { entity_name: 'Fran Balogh', entity_type: 'customer', amount: 5.00    },
];

async function main() {
  // Verificar que no existan ya estas deudas para evitar duplicados
  const { data: existing } = await sb.from('debts').select('entity_name,type').neq('status','paid');
  const existingKeys = new Set((existing || []).map(d => `${d.type}:${d.entity_name.toLowerCase()}`));

  const toInsert = [];

  for (const r of RECEIVABLES) {
    const key = `receivable:${r.entity_name.toLowerCase()}`;
    if (existingKeys.has(key)) {
      console.log(`⏭  SKIP receivable "${r.entity_name}" — ya existe`);
      continue;
    }
    toInsert.push({
      type: 'receivable',
      entity_name: r.entity_name,
      entity_type: 'customer',
      original_amount: r.amount,
      currency: 'USD',
      paid_amount: 0,
      status: 'pending',
      note: 'Saldo previo — deuda inicial cargada al sistema',
    });
  }

  for (const p of PAYABLES) {
    const key = `payable:${p.entity_name.toLowerCase()}`;
    if (existingKeys.has(key)) {
      console.log(`⏭  SKIP payable "${p.entity_name}" — ya existe`);
      continue;
    }
    toInsert.push({
      type: 'payable',
      entity_name: p.entity_name,
      entity_type: p.entity_type,
      original_amount: p.amount,
      currency: 'USD',
      paid_amount: 0,
      status: 'pending',
      note: 'Saldo previo — deuda inicial cargada al sistema',
    });
  }

  if (toInsert.length === 0) {
    console.log('\n✅ Nada que insertar — todas las deudas ya existen.');
    return;
  }

  const { error } = await sb.from('debts').insert(toInsert);
  if (error) { console.error('ERROR:', error.message); process.exit(1); }

  console.log(`\n✅ ${toInsert.length} deuda(s) insertada(s):`);
  for (const d of toInsert) {
    const sign = d.type === 'receivable' ? '←' : '→';
    console.log(`  ${sign} ${d.type.toUpperCase().padEnd(10)} ${d.entity_name.padEnd(25)} USD ${d.original_amount}`);
  }

  // Mostrar resumen final
  const { data: all } = await sb.from('debts').select('type,entity_name,original_amount,paid_amount,currency').neq('status','paid').order('type,entity_name');
  const receivables = (all || []).filter(d => d.type === 'receivable');
  const payables = (all || []).filter(d => d.type === 'payable');

  const sum = (arr) => arr.reduce((s, d) => s + (d.original_amount - d.paid_amount), 0);

  console.log('\n══ RESUMEN DEUDAS PENDIENTES ══');
  console.log(`\n📥 A COBRAR (${receivables.length}):`);
  receivables.forEach(d => console.log(`   ${d.entity_name.padEnd(28)} USD ${(d.original_amount - d.paid_amount).toFixed(2)}`));
  console.log(`   ${'TOTAL'.padEnd(28)} USD ${sum(receivables).toFixed(2)}`);

  console.log(`\n📤 A PAGAR (${payables.length}):`);
  payables.forEach(d => console.log(`   ${d.entity_name.padEnd(28)} USD ${(d.original_amount - d.paid_amount).toFixed(2)}`));
  console.log(`   ${'TOTAL'.padEnd(28)} USD ${sum(payables).toFixed(2)}`);
}

main().catch(e => console.error(e.message));
