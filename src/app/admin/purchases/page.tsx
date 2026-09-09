"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { getPurchasesAction } from "@/app/admin/actions";
import type { Purchase } from "@/app/admin/actions";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pendiente",   cls: "bg-amber-500/15 text-amber-400" },
  partial:   { label: "En camino",   cls: "bg-blue-500/15 text-blue-400" },
  received:  { label: "Confirmada",  cls: "bg-green-500/15 text-green-400" },
  paid:      { label: "Confirmada",  cls: "bg-green-500/15 text-green-400" },
  cancelled: { label: "Cancelada",   cls: "bg-red-500/15 text-red-400" },
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPurchasesAction().then(p => { setPurchases(p); setLoading(false); });
  }, []);

  const fmt = (d: string) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Compras</h1>
        <Link href="/admin/purchases/new" className="flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-dark">
          <Plus size={16} /> Nueva Compra
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {["#", "COMPRA", "RECEPCIÓN", "PROVEEDOR", "MONEDA", "TOTAL", "PAGADO", "ESTADO", ""].map(c => (
                <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-text-muted">Cargando...</td></tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-text-muted">
                  Sin compras registradas.{" "}
                  <Link href="/admin/purchases/new" className="text-violet-light hover:text-violet">Registrar una compra →</Link>
                </td>
              </tr>
            ) : purchases.map(p => {
              const s = STATUS_LABEL[p.payment_status] || STATUS_LABEL.pending;
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-text-muted">
                    <Link href={`/admin/purchases/${p.id}`} className="hover:text-violet-light">#{p.number}</Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{fmt(p.created_at)}</td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{p.received_at ? fmt(p.received_at) : <span className="text-text-muted opacity-40">—</span>}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/purchases/${p.id}`} className="hover:text-violet-light">{p.supplier}</Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{p.currency}</td>
                  <td className="px-4 py-3 font-semibold">{p.currency} {p.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-green-400">{p.currency} {(p.paid_amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/purchases/${p.id}`} className={`text-xs font-semibold hover:underline ${p.payment_status === "pending" || p.payment_status === "partial" ? "text-green-400 hover:text-green-300" : "text-violet-light hover:text-violet"}`}>
                      {p.payment_status === "pending" || p.payment_status === "partial" ? "Confirmar/Cancelar" : "Ver →"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
