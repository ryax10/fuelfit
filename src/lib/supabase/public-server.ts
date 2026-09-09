import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Cliente Supabase para Server Components públicos (sin cookies).
 * Al no usar cookies(), permite que Next.js cachee la página con ISR.
 * Solo para leer datos públicos (productos visibles, etc).
 */
export function createPublicServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}
