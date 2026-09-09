"use client";
import { useState, useEffect } from "react";
import { Save, Plus, Trash2, Check, RefreshCw } from "lucide-react";
import { getConfigAction, setManyConfigAction, getCustomersAction, fetchLiveFxRatesAction } from "@/app/admin/actions";
import type { FxRatesResult } from "@/app/admin/actions";
import type { Customer } from "@/lib/local-db/types";

type ConfigData = Record<string, string>;

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingCustomers, setPendingCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<"negocio" | "tienda" | "cajas" | "mayoristas">("negocio");
  const [fxRates, setFxRates] = useState<FxRatesResult | null>(null);
  const [fetchingFx, setFetchingFx] = useState(false);

  useEffect(() => {
    Promise.all([getConfigAction(), getCustomersAction()]).then(([cfg, customers]) => {
      setConfig(cfg);
      setPendingCustomers(customers.filter(c => c.status === "pending"));
      setLoading(false);
    });
  }, []);

  const u = (key: string, value: string) => setConfig(prev => ({ ...prev, [key]: value }));

  const save = async (keys: string[]) => {
    setSaving(true);
    try {
      const pairs: Record<string, string> = {};
      keys.forEach(k => { if (config[k] !== undefined) pairs[k] = config[k]; });
      await setManyConfigAction(pairs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert("Error al guardar: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const CAJAS_DEFAULT = ["Luciano", "Santiago", "Oficina"];
  const cajasRaw = config["cajas"] || CAJAS_DEFAULT.join(",");
  const cajas = cajasRaw.split(",").map(c => c.trim()).filter(Boolean);

  const addCaja = () => {
    const name = prompt("Nombre de la nueva caja:");
    if (!name?.trim()) return;
    const trimmed = name.trim();
    if (trimmed.includes(",")) {
      alert("El nombre de una caja no puede contener comas.");
      return;
    }
    const exists = cajas.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert(`Ya existe una caja con el nombre "${trimmed}".`);
      return;
    }
    u("cajas", [...cajas, trimmed].join(","));
  };

  const removeCaja = (caja: string) => {
    u("cajas", cajas.filter(c => c !== caja).join(","));
  };

  const cls = "w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none";

  const SaveBtn = ({ keys }: { keys: string[] }) => (
    <button onClick={() => save(keys)} disabled={saving}
      className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2 text-sm font-bold text-white transition-all hover:bg-violet-dark disabled:opacity-50">
      {saved ? <><Check size={14} /> Guardado</> : saving ? "Guardando..." : <><Save size={14} /> Guardar</>}
    </button>
  );

  if (loading) return <div className="py-20 text-center text-text-muted">Cargando...</div>;

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Configuración</h1>

      {/* Tabs */}
      <div className="mb-5 flex gap-2 border-b border-border">
        {[
          ["negocio", "Negocio"],
          ["tienda", "Tienda"],
          ["cajas", "Cajas"],
          ["mayoristas", `Mayoristas${pendingCustomers.length > 0 ? ` (${pendingCustomers.length})` : ""}`],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v as any)}
            className={`pb-3 px-3 text-sm font-medium transition-all border-b-2 -mb-px ${activeTab === v ? "border-violet text-violet-light" : "border-transparent text-text-muted hover:text-text-secondary"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab: Negocio */}
      {activeTab === "negocio" && (
        <div className="space-y-5">
          <Section title="DATOS DEL NEGOCIO">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="NOMBRE DEL NEGOCIO" value={config["business_name"] || ""} onChange={v => u("business_name", v)} />
              <Field label="WHATSAPP" placeholder="+54 9 11 xxxx-xxxx" value={config["whatsapp"] || ""} onChange={v => u("whatsapp", v)} />
              <Field label="INSTAGRAM" placeholder="@usuario" value={config["instagram"] || ""} onChange={v => u("instagram", v)} />
              <Field label="HORARIO" placeholder="Lun a Sáb 13-18 hs" value={config["horario"] || ""} onChange={v => u("horario", v)} />
              <Field label="DIRECCIÓN" placeholder="Calle y número, ciudad" value={config["address"] || ""} onChange={v => u("address", v)} />
              <Field label="EMAIL" placeholder="contacto@fullvip.com" value={config["email"] || ""} onChange={v => u("email", v)} />
            </div>
            <div className="mt-4 flex justify-end">
              <SaveBtn keys={["business_name", "whatsapp", "instagram", "horario", "address", "email"]} />
            </div>
          </Section>
        </div>
      )}

      {/* Tab: Tienda */}
      {activeTab === "tienda" && (
        <div className="space-y-5">
          <Section title="ESTADO DE LA TIENDA">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Tienda pública</p>
                <p className="text-xs text-text-muted">Permite/bloquea el acceso de clientes a la tienda</p>
              </div>
              <Toggle
                value={config["tienda_enabled"] !== "false"}
                onChange={v => u("tienda_enabled", v ? "true" : "false")}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <SaveBtn keys={["tienda_enabled"]} />
            </div>
          </Section>

          <Section title="VENTAS MAYORISTAS">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-secondary">CANTIDAD MÍNIMA PARA PRECIO MAYOR</label>
                <input type="number" min={1} value={config["wholesale_min_qty"] || "15"}
                  onChange={e => u("wholesale_min_qty", e.target.value)} className={cls} />
                <p className="mt-1 text-xs text-text-muted">Pedidos con esta cantidad o más acceden a precios mayoristas</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <SaveBtn keys={["wholesale_min_qty"]} />
            </div>
          </Section>

          <Section title="TIPO DE CAMBIO FX">
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border bg-bg-secondary p-3">
                <p className="text-[10px] font-semibold text-text-muted mb-1">BINANCE P2P</p>
                <p className="font-display text-lg font-bold text-text-primary">
                  {fxRates?.binance ? `$${fxRates.binance.toLocaleString("es-AR")}` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg-secondary p-3">
                <p className="text-[10px] font-semibold text-text-muted mb-1">DOLAR HOY CRIPTO</p>
                <p className="font-display text-lg font-bold text-text-primary">
                  {fxRates?.dolarhoy ? `$${fxRates.dolarhoy.toLocaleString("es-AR")}` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-violet/20 bg-violet/5 p-3">
                <p className="text-[10px] font-semibold text-violet mb-1">PROMEDIO (FX)</p>
                <p className="font-display text-lg font-bold text-violet-light">
                  {fxRates?.average ? `$${fxRates.average.toLocaleString("es-AR")}` : "—"}
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-secondary">COTIZACIÓN USDT/ARS ACTIVA</label>
                <input type="number" min={1} step="1" value={config["fx_usdt_ars"] || "1000"}
                  onChange={e => u("fx_usdt_ars", e.target.value)} className={cls} />
                <p className="mt-1 text-xs text-text-muted">Se usa en reportes de ganancias y balance</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={async () => {
                  setFetchingFx(true);
                  try {
                    const rates = await fetchLiveFxRatesAction();
                    setFxRates(rates);
                    if (rates.average) u("fx_usdt_ars", String(rates.average));
                  } finally {
                    setFetchingFx(false);
                  }
                }}
                disabled={fetchingFx}
                className="flex items-center gap-2 rounded-xl border border-violet/20 bg-violet/5 px-4 py-2 text-sm font-semibold text-violet-light hover:bg-violet/10 disabled:opacity-50 transition-all"
              >
                <RefreshCw size={14} className={fetchingFx ? "animate-spin" : ""} />
                {fetchingFx ? "Consultando..." : "Actualizar desde Binance + DolarHoy"}
              </button>
              <SaveBtn keys={["fx_usdt_ars"]} />
            </div>
          </Section>
        </div>
      )}

      {/* Tab: Cajas */}
      {activeTab === "cajas" && (
        <div className="space-y-5">
          <Section title="CAJAS REGISTRADAS">
            <p className="mb-4 text-xs text-text-muted">
              Las cajas se usan para asociar movimientos de dinero a cada operador.
              El nombre de la caja no se puede editar para no romper el historial; solo se puede eliminar si no tiene movimientos.
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {cajas.map(caja => (
                <div key={caja} className="flex items-center gap-2 rounded-lg border border-violet/20 bg-violet/5 px-3 py-2">
                  <span className="text-sm font-medium text-violet-light">{caja}</span>
                  {!CAJAS_DEFAULT.includes(caja) && (
                    <button onClick={() => removeCaja(caja)} className="text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addCaja}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted hover:border-violet hover:text-violet-light transition-all">
                <Plus size={14} /> Agregar caja
              </button>
            </div>
            <div className="flex justify-end">
              <SaveBtn keys={["cajas"]} />
            </div>
          </Section>

          <Section title="CAJA POR DEFECTO">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">CAJA PREDETERMINADA PARA VENTAS</label>
              <select value={config["default_caja"] || "Oficina"} onChange={e => u("default_caja", e.target.value)} className={cls}>
                {cajas.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="mt-1 text-xs text-text-muted">Se asigna automáticamente al confirmar ventas si no se especifica otra</p>
            </div>
            <div className="mt-4 flex justify-end">
              <SaveBtn keys={["default_caja"]} />
            </div>
          </Section>
        </div>
      )}

      {/* Tab: Mayoristas pendientes */}
      {activeTab === "mayoristas" && (
        <div>
          {pendingCustomers.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg-card px-5 py-12 text-center text-text-muted">
              <p className="text-base font-medium">Sin solicitudes pendientes</p>
              <p className="mt-1 text-sm">Cuando un mayorista se registre desde la tienda aparecerá acá para aprobación.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["NOMBRE", "TELÉFONO", "ZONA", "REGISTRO", "ACCIONES"].map(c => (
                      <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingCustomers.map(c => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-text-muted">{c.phone}</td>
                      <td className="px-4 py-3 text-text-muted">{c.zone || "—"}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(c.created_at).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <ApproveBtn customerId={c.id} onDone={() => setPendingCustomers(prev => prev.filter(x => x.id !== c.id))} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApproveBtn({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    setLoading(true);
    const { updateCustomerStatusAction } = await import("@/app/admin/actions");
    await updateCustomerStatusAction(customerId, "active");
    onDone();
    setLoading(false);
  };

  const reject = async () => {
    setLoading(true);
    const { updateCustomerStatusAction } = await import("@/app/admin/actions");
    await updateCustomerStatusAction(customerId, "rejected");
    onDone();
    setLoading(false);
  };

  return (
    <>
      <button onClick={approve} disabled={loading}
        className="rounded-lg bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/25 transition-all disabled:opacity-50">
        Aprobar
      </button>
      <button onClick={reject} disabled={loading}
        className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-50">
        Rechazar
      </button>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <p className="mb-4 text-[10px] font-semibold tracking-wider text-text-muted">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, placeholder, value, onChange }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-text-secondary">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-violet focus:outline-none"
      />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${value ? "bg-green-500" : "bg-text-muted/30"}`}
    >
      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </div>
  );
}
