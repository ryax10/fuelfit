"use client";
import Link from "next/link";

export default function NewCustomerPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Nuevo Mayorista</h1>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">NOMBRE Y APELLIDO *</label><input placeholder="Juan Perez" className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" /></div>
          <div><label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">TELEFONO</label><input placeholder="+54 9 11 1234-5678" className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">DIRECCION</label><input placeholder="Calle 123, Piso 4" className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" /></div>
          <div><label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">ZONA</label><input placeholder="CABA, Quilmes, La Plata..." className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">TIPO DE CLIENTE</label>
            <select className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm"><option>Mayorista</option></select>
          </div>
          <div><label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">CODIGO</label><p className="text-sm text-text-muted italic mt-2">Se generará automáticamente al crear</p></div>
        </div>
        <div><label className="text-[10px] font-semibold tracking-wider text-text-muted block mb-1.5">NOTAS</label><input placeholder="Notas internas..." className="w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm" /></div>
        <div className="flex gap-3">
          <button className="rounded-xl bg-violet px-6 py-3 text-sm font-bold text-white hover:bg-violet-dark transition-all">💾 Guardar</button>
          <Link href="/admin/customers" className="rounded-xl border border-border px-6 py-3 text-sm text-text-muted hover:bg-bg-hover transition-all">Cancelar</Link>
        </div>
      </div>
    </div>
  );
}
