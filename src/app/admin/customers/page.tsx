"use client";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Check, Pencil, X } from "lucide-react";
import { getCustomersAction, resolveDuplicateAction, getOrdersByCustomerPhoneAction, getOrderItemsAction, updateCustomerAction } from "@/app/admin/actions";
import type { Customer, Order, OrderItem } from "@/lib/local-db/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"todos" | "retail" | "wholesale">("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const load = () => {
    getCustomersAction().then(data => { setCustomers(data); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const filtered = tab === "todos" ? customers : customers.filter(c => c.type === tab);
  const duplicates = customers.filter(c => c.has_duplicate_warning);

  const handleResolve = async (id: string) => {
    if (resolvingId) return;
    setResolvingId(id);
    try {
      await resolveDuplicateAction(id);
      load();
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) return <div className="py-16 text-center text-text-muted text-sm">Cargando clientes...</div>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-2">Clientes</h1>
      <p className="text-xs text-text-muted mb-6">Los clientes se registran automáticamente cuando finalizan una compra.</p>

      {duplicates.length > 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <h3 className="text-sm font-bold text-yellow-400 flex items-center gap-2 mb-3"><AlertTriangle size={16} /> Posibles duplicados ({duplicates.length})</h3>
          {duplicates.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-yellow-500/10 last:border-0">
              <div className="text-sm">
                <span className="font-semibold">{c.name}</span> <span className="text-text-muted">({c.phone})</span>
                <span className="ml-2 text-xs text-yellow-400">También: {c.duplicate_names?.join(", ")}</span>
              </div>
              <button onClick={() => handleResolve(c.id)} disabled={resolvingId === c.id} className="flex items-center gap-1 rounded-lg bg-green-600/10 px-3 py-1 text-xs text-green-400 hover:bg-green-600/20 disabled:opacity-50">
                <Check size={12} /> {resolvingId === c.id ? "..." : "Resolver"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(["todos", "retail", "wholesale"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${tab === t ? "bg-violet/10 text-violet-light border border-violet/20" : "border border-border text-text-muted hover:bg-bg-hover"}`}>
            {t === "todos" ? "Todos" : t === "retail" ? "Minoristas" : "Mayoristas"} ({(t === "todos" ? customers : customers.filter(c => c.type === t)).length})
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border">
            {["NOMBRE / APODO", "TELÉFONO", "TIPO", "ZONA", "COMPRAS", "ÚLTIMA COMPRA", "ANTERIOR", ""].map(c => <th key={c} className="px-4 py-3 text-[10px] font-semibold tracking-wider text-text-muted">{c}</th>)}
          </tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={8} className="px-4 py-12 text-center text-text-muted">Sin clientes registrados.</td></tr>
              : filtered.map(c => (
                <>
                  <tr key={c.id} className="border-b border-border hover:bg-bg-hover transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        {c.has_duplicate_warning && <AlertTriangle size={12} className="text-yellow-400 shrink-0" />}
                        <div>
                          <span>{c.name}</span>
                          {c.nickname && <span className="ml-1.5 text-[10px] text-violet-light/70 font-normal">({c.nickname})</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-text-muted">{c.phone}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold ${c.type === "wholesale" ? "text-violet-light" : "text-text-secondary"}`}>{c.type === "wholesale" ? "MAYORISTA" : "MINORISTA"}</span></td>
                    <td className="px-4 py-3 text-xs text-text-muted">{c.zone || c.address?.split(",").pop()?.trim() || "—"}</td>
                    <td className="px-4 py-3 text-xs text-center">{c.total_orders || 0}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{c.previous_purchase ? new Date(c.previous_purchase).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditingCustomer(c)} className="text-text-muted hover:text-violet-light transition-colors p-1" title="Editar cliente">
                          <Pencil size={13} />
                        </button>
                        {expandedId === c.id ? <ChevronUp size={14} className="text-text-muted" onClick={() => setExpandedId(null)} /> : <ChevronDown size={14} className="text-text-muted" onClick={() => setExpandedId(c.id)} />}
                      </div>
                    </td>
                  </tr>
                  {expandedId === c.id && <CustomerDetail key={`det-${c.id}`} customer={c} />}
                </>
              ))}
          </tbody>
        </table>
      </div>

      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={() => { setEditingCustomer(null); load(); }}
        />
      )}
    </div>
  );
}

function EditCustomerModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: customer.name || "",
    phone: customer.phone || "",
    address: customer.address || "",
    zone: customer.zone || "",
    notes: customer.notes || "",
    nickname: customer.nickname || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCustomerAction(customer.id, form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="rounded-2xl border border-border bg-bg-card p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-lg font-bold">Editar cliente</h3>
            <span className={`text-[10px] font-bold ${customer.type === "wholesale" ? "text-violet-light" : "text-text-muted"}`}>
              {customer.type === "wholesale" ? "MAYORISTA" : "MINORISTA"}
            </span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1">Nombre</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1">Apodo</label>
              <input value={form.nickname} onChange={e => set("nickname", e.target.value)} placeholder="Opcional" className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Teléfono</label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Dirección</label>
            <input value={form.address} onChange={e => set("address", e.target.value)} className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Zona</label>
            <input value={form.zone} onChange={e => set("zone", e.target.value)} className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-violet focus:outline-none resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-violet py-2.5 text-sm font-bold text-white hover:bg-violet-dark disabled:opacity-50 transition-all">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-hover transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    getOrdersByCustomerPhoneAction(customer.phone).then(setOrders);
  }, [customer.phone]);

  return (
    <tr><td colSpan={8} className="px-4 py-4 bg-bg-secondary/50">
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-text-muted">Dirección:</span> <span>{customer.address || "—"}</span></div>
          <div><span className="text-text-muted">Código:</span> <span className="font-mono">{customer.code}</span></div>
          <div><span className="text-text-muted">Registrado:</span> <span>{new Date(customer.created_at).toLocaleDateString("es-AR")}</span></div>
          <div><span className="text-text-muted">Total compras:</span> <span className="font-bold">{customer.total_orders || 0}</span></div>
          {customer.notes && <div className="col-span-2"><span className="text-text-muted">Notas:</span> <span>{customer.notes}</span></div>}
        </div>
        {orders.length > 0 && (
          <div>
            <p className="text-xs font-bold text-text-secondary mb-2">Historial de Compras</p>
            {orders.map(o => (
              <div key={o.id} className="mb-2">
                <button onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                  className="w-full flex items-center justify-between rounded-lg bg-bg-card p-3 text-xs hover:bg-bg-hover transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono">#{o.number}</span>
                    <span className="text-text-muted">{new Date(o.created_at).toLocaleDateString("es-AR")}</span>
                    <span className="text-text-muted opacity-70">{new Date(o.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${o.status === "confirmed" ? "bg-green-500/10 text-green-400" : o.status === "pending" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"}`}>
                      {o.status === "confirmed" ? "CONF" : o.status === "pending" ? "PEND" : "CANC"}
                    </span>
                  </div>
                  <span className="font-semibold">${o.total.toLocaleString()}</span>
                </button>
                {expandedOrder === o.id && <OrderItemsInline orderId={o.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </td></tr>
  );
}

function OrderItemsInline({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  useEffect(() => { getOrderItemsAction(orderId).then(setItems); }, [orderId]);
  return (
    <div className="ml-4 mt-1 rounded-lg bg-bg-card p-3 text-xs space-y-1">
      {items.map(i => (
        <div key={i.id} className="flex justify-between text-text-muted">
          <span>{i.product_name} x{i.qty}</span>
          <span>${i.subtotal.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
