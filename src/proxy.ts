import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";

// Web Crypto API — disponible en Edge Runtime (no usa módulo 'crypto' de Node.js)
async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  // Token format: "{username}:{hmac(username)}"
  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return false;
  const username = token.slice(0, colonIdx);
  const sig = token.slice(colonIdx + 1);
  if (!username || !sig) return false;
  const expected = await hmacSha256(secret, username);
  return sig === expected;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteger /admin/* excepto la página de login
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = request.cookies.get("admin_session")?.value;
    if (!(await verifyAdminSession(session))) {
      const loginRedirect = NextResponse.redirect(new URL("/admin/login", request.url));
      loginRedirect.cookies.delete("admin_session");
      return loginRedirect;
    }
  }

  let response = NextResponse.next({ request });

  // Mantener sesión Supabase activa para el resto de la app
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: object }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login", "/registro", "/checkout"],
};
