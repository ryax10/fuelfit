"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerClientAction } from "../actions";
import { nameToEmail } from "@/lib/auth/phone-utils";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);

    // 1. Crear usuario en Supabase Auth
    const result = await registerClientAction(nombre, apellido, whatsapp, password);
    if (!result.success) {
      setError(result.error || "Error al registrarse.");
      setLoading(false);
      return;
    }

    // 2. Login automático
    const supabase = createClient();
    await supabase.auth.signInWithPassword({
      email: nameToEmail(nombre, apellido),
      password,
    });

    router.push("/");
    router.refresh();
  };

  return (
    <>
      <h1 className="font-display text-xl font-bold">Crear cuenta</h1>
      <p className="mt-1 text-sm text-text-muted">Guardamos tus datos para que tus próximas compras sean más rápidas.</p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">NOMBRE</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan"
              className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">APELLIDO</label>
            <input
              required
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Pérez"
              className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">WHATSAPP</label>
          <input
            required
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+54 9 11 1234-5678"
            autoComplete="username"
            className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-text-muted">Usamos este número para coordinar tu pedido.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">CONTRASEÑA</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-violet py-3 text-sm font-bold tracking-wider text-white hover:bg-violet-dark disabled:opacity-50 transition-all"
        >
          {loading ? "Creando cuenta..." : "CREAR CUENTA"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-violet-light hover:text-violet transition-colors">
          Iniciá sesión
        </Link>
      </p>
    </>
  );
}
