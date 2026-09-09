import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Cliente Supabase para componentes CLIENT ('use client').
 * Usa la anon key (pública) con localStorage, SIN cookies.
 * Esto garantiza compatibilidad con ad blockers, antivirus y navegadores
 * con restricciones de cookies de terceros (Safari ITP, etc).
 */
export function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
