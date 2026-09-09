"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction } from "./actions";

export default function PerfilPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const meta = data.user.user_metadata;
      const nombre = meta?.nombre || meta?.full_name?.split(" ")[0] || "";
      const apellido = meta?.apellido || meta?.full_name?.split(" ").slice(1).join(" ") || "";
      setDisplayName(`${nombre} ${apellido}`.trim());
      setPhone(meta?.phone || "");
      setLoading(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const result = await updateProfileAction(phone);
    if (!result.success) {
      setError(result.error || "Error al guardar.");
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-text-muted text-sm">Cargando...</div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold mb-1">Mi Perfil</h1>
      <p className="text-sm text-text-muted mb-8">Actualizá tu número de WhatsApp.</p>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-bg-card p-6 space-y-5">

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">NOMBRE</label>
          <div className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-sm text-text-muted">
            {displayName || "—"}
          </div>
          <p className="mt-1 text-[10px] text-text-muted">Para cambiar tu nombre, contactate con nosotros.</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">WHATSAPP</label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+54 9 11 1234-5678"
            className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:ring-1 focus:ring-violet/30 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-text-muted">Si cambiás el número, guardamos el historial en tu ficha de cliente.</p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">✓ Datos actualizados correctamente.</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-violet py-3 text-sm font-bold tracking-wider text-white hover:bg-violet-dark disabled:opacity-50 transition-all"
        >
          {saving ? "Guardando..." : "GUARDAR CAMBIOS"}
        </button>
      </form>
    </div>
  );
}
