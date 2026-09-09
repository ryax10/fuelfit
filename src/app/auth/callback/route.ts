import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Rutas permitidas para redirección post-login (evita open redirect y acceso a /admin)
const ALLOWED_NEXT_PREFIXES = ["/", "/productos", "/producto/", "/carrito", "/checkout", "/perfil", "/mis-compras", "/mayoristas", "/envios", "/contacto"];

function sanitizeNext(next: string | null): string {
  if (!next) return "/";
  // Solo rutas relativas (no URLs externas)
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  // Bloquear acceso a rutas admin desde el callback de auth de usuarios
  if (next.startsWith("/admin")) return "/";
  // Verificar que empiece con algún prefijo permitido
  const isAllowed = ALLOWED_NEXT_PREFIXES.some((prefix) => next === prefix || next.startsWith(prefix));
  return isAllowed ? next : "/";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
