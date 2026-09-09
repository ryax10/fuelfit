"use client";
import { FileText } from "lucide-react";

export default function ContenidoPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">Contenido</h1>
        <p className="mt-1 text-sm text-text-muted">Gestioná el contenido visible en tu tienda</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-bg-card py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet/10">
          <FileText size={26} className="text-violet-light" />
        </div>
        <p className="mt-4 font-display text-base font-semibold text-text-primary">Próximamente</p>
        <p className="mt-1 text-sm text-text-muted">Acá vas a poder editar el contenido de tu tienda</p>
      </div>
    </div>
  );
}
