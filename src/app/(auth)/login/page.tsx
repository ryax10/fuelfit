"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { nameToEmail } from "@/lib/auth/phone-utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromMayoristas = searchParams.get("from") === "mayoristas";
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: nameToEmail(nombre, apellido),
      password,
    });
    if (authError) {
      setError("Nombre, apellido o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    router.push(fromMayoristas ? "/mayoristas/tienda" : "/");
    router.refresh();
  };

  return (
    <>
      <h1 className="font-display text-xl font-bold">Ingresá a tu cuenta</h1>
      <p className="mt-1 text-sm text-text-muted">O comprá como invitado directo desde el carrito.</p>

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
              autoComplete="given-name"
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
              autoComplete="family-name"
              className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">CONTRASEÑA</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-violet py-3 text-sm font-bold tracking-wider text-white hover:bg-violet-dark disabled:opacity-50 transition-all"
        >
          {loading ? "Ingresando..." : "INGRESAR"}
        </button>
      </form>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-text-muted">o</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <Link
        href={fromMayoristas ? "/mayoristas/tienda" : "/productos"}
        className="mt-4 block w-full rounded-xl border border-border py-3 text-center text-sm font-medium text-text-secondary hover:bg-bg-hover transition-all"
      >
        Comprar como invitado
      </Link>

      <p className="mt-5 text-center text-sm text-text-muted">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-semibold text-violet-light hover:text-violet transition-colors">
          Registrate
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
