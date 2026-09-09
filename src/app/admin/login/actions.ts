"use server";

import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

// Rate limiting en memoria: máx 5 intentos por IP en 15 minutos
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

function resetRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

function getAdminUsers() {
  return [
    {
      username: process.env.ADMIN_1_USERNAME || "",
      display: process.env.ADMIN_1_DISPLAY || "",
      // Soporta tanto hash bcrypt ($2b$...) como contraseña plana (legacy)
      password: process.env.ADMIN_1_PASSWORD || "",
    },
    {
      username: process.env.ADMIN_2_USERNAME || "",
      display: process.env.ADMIN_2_DISPLAY || "",
      password: process.env.ADMIN_2_PASSWORD || "",
    },
  ];
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Si el stored es un hash bcrypt, comparar con bcrypt
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  // Fallback para contraseñas en texto plano (legacy): timing-safe comparison
  try {
    const a = Buffer.from(plain);
    const b = Buffer.from(stored);
    if (a.length !== b.length) {
      // Hacer la comparación de todas formas para evitar timing leak por longitud
      timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function createToken(username: string): string {
  const secret = process.env.ADMIN_SECRET!;
  const sig = createHmac("sha256", secret).update(username).digest("hex");
  return `${username}:${sig}`;
}

export async function loginAction(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "unknown";

  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return { success: false, error: "Demasiados intentos. Esperá 15 minutos." };
  }

  const users = getAdminUsers();

  // Buscar usuario por nombre (timing-safe para el username también)
  const user = users.find((u) => {
    try {
      const a = Buffer.from(u.username);
      const b = Buffer.from(username);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });

  // Siempre verificar password (aunque el usuario no exista) para evitar timing leak
  const passwordToCheck = user?.password || "dummy-password-that-wont-match";
  const passwordValid = await verifyPassword(password, passwordToCheck);

  if (!user || !passwordValid) {
    return { success: false, error: "Usuario o contraseña incorrectos." };
  }

  // Login exitoso: limpiar rate limit
  resetRateLimit(ip);

  const cookieStore = await cookies();
  cookieStore.set("admin_session", createToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 días (antes era 30)
    path: "/",
  });

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
}
