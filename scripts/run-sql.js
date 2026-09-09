const { createClient } = require('../node_modules/@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://uwrgztccjobtiydvlkdu.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cmd6dGNjam9idGl5ZHZsa2R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE5MjU3MSwiZXhwIjoyMDg2NzY4NTcxfQ.Z_G5-Y6m-Ip6h_Qk4vR95E4yAYBEivaE6g4GssE6Ld8';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const file = process.argv[2];
if (!file) { console.error('Uso: node run-sql.js <archivo.sql>'); process.exit(1); }

const sql = fs.readFileSync(file, 'utf8');

// Separar en statements individuales para el seed (INSERT)
// Para el schema usamos rpc si está disponible, sino statement por statement
async function run() {
  console.log(`Ejecutando ${file}...`);

  // Intentar via REST API directa (pg)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log('✅ Ejecutado con éxito');
    return;
  }

  // Si no existe exec_sql, usar el endpoint directo de postgres
  const res2 = await fetch(`${SUPABASE_URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  console.log('Status pg:', res2.status, await res2.text());
}

run().catch(console.error);
