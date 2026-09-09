import "server-only";

import { createClient as supabaseCreateClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Cliente Supabase con service_role key.
 *
 * ⚠️  SOLO PARA USO EN SERVIDOR (Server Actions, API Routes)
 * ⚠️  BYPASEA RLS — usar con extremo cuidado
 * ⚠️  NUNCA importar desde componentes client
 *
 * El import "server-only" garantiza un error de build si
 * alguien intenta importar este módulo desde el cliente.
 *
 * USO TÍPICO:
 *   - Operaciones administrativas que no tienen JWT de usuario
 *   - Webhooks
 *   - Scripts de mantenimiento
 *
 * PARA OPERACIONES NORMALES usar server.ts (con RLS).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return supabaseCreateClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
