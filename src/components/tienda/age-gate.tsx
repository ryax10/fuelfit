"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, ShieldX } from "lucide-react";

const STORAGE_KEY = "ff_age_verified";

export function AgeGate() {
  const [status, setStatus] = useState<"loading" | "pending" | "blocked" | "allowed">("loading");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setStatus(stored === "yes" ? "allowed" : "pending");
  }, []);

  const confirm = () => {
    localStorage.setItem(STORAGE_KEY, "yes");
    setStatus("allowed");
  };

  const deny = () => {
    setStatus("blocked");
  };

  if (status === "loading" || status === "allowed") return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-bg-card p-8 shadow-2xl shadow-black/60 text-center">

        {/* Logo */}
        <div className="flex justify-center mb-5">
          <Image src="/logo.jpg" alt="FuelFit" width={60} height={60} className="rounded-xl" />
        </div>

        {status === "pending" && (
          <>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet/30 bg-violet/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-violet-light uppercase">
              Verificación de edad
            </div>

            <h2 className="mt-4 font-display text-xl font-bold text-text-primary">
              ¿Sos mayor de 18 años?
            </h2>

            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              Este sitio cuenta con productos a la venta destinados exclusivamente a personas mayores de 18 años.
            </p>

            <p className="mt-2 text-xs text-text-muted leading-relaxed">
              Al ingresar, declarás bajo tu responsabilidad que sos mayor de edad.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-3">
              <button
                onClick={confirm}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3 text-sm font-bold text-white transition-all hover:bg-violet-dark hover:shadow-lg hover:shadow-violet/20"
              >
                <ShieldCheck size={16} />
                Sí, soy mayor de 18 años
              </button>
              <button
                onClick={deny}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated px-5 py-3 text-sm font-semibold text-text-secondary transition-all hover:border-border-light hover:text-text-primary"
              >
                <ShieldX size={16} />
                No, soy menor
              </button>
            </div>

          </>
        )}

        {status === "blocked" && (
          <>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-red-400 uppercase">
              Acceso restringido
            </div>

            <h2 className="mt-4 font-display text-xl font-bold text-text-primary">
              No podés ingresar
            </h2>

            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              El acceso a este sitio está reservado únicamente para mayores de 18 años.
            </p>

            <div className="mt-6 flex justify-center">
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-3 text-sm font-semibold text-red-400">
                <ShieldX size={16} />
                Acceso denegado
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
