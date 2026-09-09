"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Shield } from "lucide-react";
import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginAction(username, password);
    if (result.success) {
      router.push("/admin");
    } else {
      setError(result.error || "Usuario o contraseña incorrectos.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.jpg" alt="FuelFit" width={56} height={56} className="rounded-xl mb-4" />
          <h1 className="font-display text-2xl font-bold">FULL VIP</h1>
          <p className="text-sm text-text-muted mt-1">Panel Administrativo</p>
        </div>

        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield size={16} className="text-violet-light" />
            <h2 className="font-display text-base font-bold">Acceso Restringido</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">USUARIO</label>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario"
                autoComplete="username"
                className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none"
              />
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
                className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet py-3 text-sm font-bold tracking-wider text-white hover:bg-violet-dark disabled:opacity-50 transition-all"
            >
              {loading ? "Verificando..." : "INGRESAR"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          Solo personal autorizado de FuelFit
        </p>
      </div>
    </div>
  );
}
