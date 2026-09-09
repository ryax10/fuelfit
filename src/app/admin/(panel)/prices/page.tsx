"use client";
import { useState } from "react";

export default function PricesPage() {
  const [rows, setRows] = useState([{ brand: "", model: "", currency: "USD", x15: 0, x50: 0, x100: 0, plus: 0 }]);
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Lista de Precios por Cantidad</h1>
        <button className="rounded-xl bg-violet px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-dark transition-all">📋 Reporte WhatsApp</button>
      </div>
      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {["MARCA","MODELO","MONEDA","X15","X50","X100","100+"].map((c) => (
                <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-2 py-2"><input placeholder="Marca" className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" value={r.brand} onChange={(e) => { const n = [...rows]; n[i].brand = e.target.value; setRows(n); }} /></td>
                <td className="px-2 py-2"><input placeholder="Modelo" className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" value={r.model} onChange={(e) => { const n = [...rows]; n[i].model = e.target.value; setRows(n); }} /></td>
                <td className="px-2 py-2">
                  <select className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" value={r.currency} onChange={(e) => { const n = [...rows]; n[i].currency = e.target.value; setRows(n); }}>
                    <option>USD</option><option>ARS</option>
                  </select>
                </td>
                {(["x15","x50","x100","plus"] as const).map((k) => (
                  <td key={k} className="px-2 py-2"><input type="number" className="w-20 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" value={r[k]} onChange={(e) => { const n = [...rows]; (n[i] as any)[k] = +e.target.value; setRows(n); }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setRows([...rows, { brand: "", model: "", currency: "USD", x15: 0, x50: 0, x100: 0, plus: 0 }])}
        className="mt-4 rounded-xl bg-violet px-6 py-3 text-sm font-bold text-white hover:bg-violet-dark transition-all">💾 Guardar Todo</button>
    </div>
  );
}
