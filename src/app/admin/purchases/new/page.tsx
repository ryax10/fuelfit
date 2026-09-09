"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { getProductsAction, createPurchaseAction, confirmPurchaseAction, getConfigAction } from "@/app/admin/actions";
import type { Product } from "@/lib/local-db/types";

type CartItem = {
  product: Product;
  qty: number;
  unit_cost: number;
};

export default function NewPurchasePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [filterBrand, setFilterBrand] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterFlavor, setFilterFlavor] = useState("");

  // Item actual
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState(0);

  // Carrito de compra
  const [cart, setCart] = useState<CartItem[]>([]);

  // Cabecera de compra
  const [supplier, setSupplier] = useState("");
  const [currency, setCurrency] = useState<"USD" | "ARS">("USD");
  const [note, setNote] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Recepción inmediata
  const [receiveNow, setReceiveNow] = useState(false);
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiveCaja, setReceiveCaja] = useState("Oficina");
  const [receiveCurrency, setReceiveCurrency] = useState<"ARS" | "USD">("USD");
  const [receivePaid, setReceivePaid] = useState("0");
  const [cajas, setCajas] = useState(["Luciano", "Santiago", "Oficina"]);

  useEffect(() => {
    getProductsAction().then(p => { setProducts(p); setLoading(false); });
    getConfigAction().then(cfg => {
      const raw = cfg["cajas"] || "Luciano,Santiago,Oficina";
      const defaultCaja = cfg["default_caja"] || "Oficina";
      const list = raw.split(",").map((c: string) => c.trim()).filter(Boolean);
      setCajas(list);
      setReceiveCaja(defaultCaja);
      setReceiveCurrency((cfg["default_currency"] as "ARS" | "USD") || "USD");
    });
  }, []);

  const brands = [...new Set(products.map(p => p.brand))].sort();
  const models = filterBrand
    ? [...new Set(products.filter(p => p.brand === filterBrand).map(p => p.model))].filter(Boolean).sort()
    : [];
  const flavors = filterBrand && filterModel
    ? [...new Set(products.filter(p => p.brand === filterBrand && p.model === filterModel).map(p => p.flavor))].filter(Boolean).sort()
    : [];
  const filteredProducts = products.filter(p => {
    if (filterBrand && p.brand !== filterBrand) return false;
    if (filterModel && p.model !== filterModel) return false;
    if (filterFlavor && p.flavor !== filterFlavor) return false;
    return true;
  });

  const handleAddToCart = () => {
    if (!selectedProduct || qty <= 0) return;
    const existing = cart.findIndex(c => c.product.id === selectedProduct.id);
    if (existing >= 0) {
      setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + qty, unit_cost: unitCost } : c));
    } else {
      setCart(prev => [...prev, { product: selectedProduct, qty, unit_cost: unitCost }]);
    }
    setSelectedProduct(null);
    setQty(1);
    setUnitCost(0);
    setFilterBrand("");
    setFilterModel("");
    setFilterFlavor("");
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product.id !== productId));
  const total = cart.reduce((s, c) => s + c.qty * c.unit_cost, 0);

  const handleSubmit = async () => {
    if (!supplier || cart.length === 0) return;
    setSaving(true);
    try {
      const { purchaseId } = await createPurchaseAction(
        { supplier, currency, note, purchase_date: purchaseDate ? `${purchaseDate}T12:00:00+00:00` : undefined },
        cart.map(c => ({
          product_id: c.product.id,
          product_sku: c.product.sku,
          product_name: c.product.name,
          qty: c.qty,
          unit_cost: c.unit_cost,
        }))
      );
      if (receiveNow) {
        const paid = parseFloat(receivePaid) || 0;
        const recDate = `${receivedDate}T12:00:00+00:00`;
        await confirmPurchaseAction(purchaseId, "received", receiveCaja, paid, receiveCurrency, recDate);
      }
      router.push(`/admin/purchases/${purchaseId}`);
    } catch (e: any) {
      alert("Error: " + e.message);
      setSaving(false);
    }
  };

  const cls = "w-full rounded-xl border border-border bg-bg-card px-4 py-3 text-sm focus:border-violet focus:outline-none";

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/purchases" className="text-text-muted hover:text-text-secondary">← Compras</Link>
        <span className="text-text-muted">/</span>
        <h1 className="font-display text-2xl font-bold">Nueva Compra</h1>
      </div>

      <div className="space-y-5">

        {/* Cabecera */}
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="mb-4 text-[10px] font-semibold tracking-wider text-text-muted">DATOS DE LA COMPRA</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">PROVEEDOR *</label>
              <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nombre del proveedor" className={cls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">FECHA DE COMPRA</label>
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className={cls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">MONEDA</label>
              <select value={currency} onChange={e => setCurrency(e.target.value as "USD" | "ARS")} className={cls}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">NOTA</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota opcional" className={cls} />
            </div>
          </div>
        </div>

        {/* Filtros + selector de producto */}
        <div className="rounded-xl border border-border bg-bg-card p-5">
          <p className="mb-4 text-[10px] font-semibold tracking-wider text-text-muted">AGREGAR PRODUCTO</p>

          {loading ? (
            <p className="text-sm text-text-muted">Cargando productos...</p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">MARCA</label>
                  <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterModel(""); setFilterFlavor(""); setSelectedProduct(null); }} className={cls}>
                    <option value="">— Todas las marcas —</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">MODELO</label>
                  <select value={filterModel} onChange={e => { setFilterModel(e.target.value); setFilterFlavor(""); setSelectedProduct(null); }} disabled={!filterBrand} className={cls + (!filterBrand ? " opacity-50" : "")}>
                    <option value="">— Todos los modelos —</option>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-secondary">SABOR / VARIANTE</label>
                  <select value={filterFlavor} onChange={e => { setFilterFlavor(e.target.value); setSelectedProduct(null); }} disabled={!filterModel} className={cls + (!filterModel ? " opacity-50" : "")}>
                    <option value="">— Todos los sabores —</option>
                    {flavors.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              {filteredProducts.length > 0 && (
                <div className="mb-4 max-h-48 overflow-y-auto rounded-xl border border-border">
                  {filteredProducts.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { setSelectedProduct(p); const inCart = cart.find(c => c.product.id === p.id); setUnitCost(inCart ? inCart.unit_cost : p.price_may_x15); }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-all hover:bg-bg-hover ${selectedProduct?.id === p.id ? "bg-violet/10 text-violet-light" : ""}`}
                    >
                      <span>
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-text-muted">{p.sku}</span>
                      </span>
                      <span className="text-xs text-text-muted">Stock: {p.stock_actual}</span>
                    </button>
                  ))}
                </div>
              )}
              {filterBrand && filteredProducts.length === 0 && (
                <p className="mb-4 text-sm text-text-muted">Sin productos para los filtros seleccionados.</p>
              )}

              {selectedProduct && (
                <div className="rounded-xl border border-violet/30 bg-violet/5 p-4">
                  <p className="mb-3 text-sm font-semibold text-violet-light">Seleccionado: {selectedProduct.name}</p>
                  <div className="grid gap-3 sm:grid-cols-[120px_160px_auto]">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-text-secondary">CANTIDAD</label>
                      <input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
                        className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-text-secondary">COSTO UNITARIO ({currency})</label>
                      <input type="number" min={0} step="0.01" value={unitCost} onChange={e => setUnitCost(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none" />
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={handleAddToCart}
                        className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-dark">
                        <Plus size={14} /> Agregar — {currency} {(qty * unitCost).toFixed(2)}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Tabla de ítems */}
        {cart.length > 0 && (
          <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["PRODUCTO", "SKU", "CANT.", "COSTO UNIT.", "SUBTOTAL", ""].map(c => (
                    <th key={c} className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider text-text-muted last:w-10">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.product.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{item.product.name}</td>
                    <td className="px-4 py-3 text-text-muted">{item.product.sku}</td>
                    <td className="px-4 py-3">
                      <input type="number" min={1} value={item.qty}
                        onChange={e => setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, qty: parseInt(e.target.value) || 1 } : c))}
                        className="w-20 rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-sm focus:border-violet focus:outline-none" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min={0} step="0.01" value={item.unit_cost}
                        onChange={e => setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, unit_cost: parseFloat(e.target.value) || 0 } : c))}
                        className="w-24 rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-sm focus:border-violet focus:outline-none" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-violet-light">{currency} {(item.qty * item.unit_cost).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeFromCart(item.product.id)} className="text-text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border px-4 py-3 text-right">
              <span className="font-display text-xl font-bold text-violet-light">Total: {currency} {total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Recepción inmediata */}
        {cart.length > 0 && (
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={receiveNow}
                onChange={e => setReceiveNow(e.target.checked)}
                className="h-4 w-4 rounded accent-violet"
              />
              <span className="text-sm font-semibold">Ya recibí la mercadería — actualizar stock ahora</span>
            </label>

            {receiveNow && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-text-secondary">Fecha de recepción</label>
                    <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                      className="rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-text-secondary">Caja</label>
                    <select value={receiveCaja} onChange={e => setReceiveCaja(e.target.value)}
                      className="rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none">
                      {cajas.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-text-secondary">Moneda del pago</label>
                    <select value={receiveCurrency} onChange={e => setReceiveCurrency(e.target.value as "ARS" | "USD")}
                      className="rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none">
                      <option value="USD">USD U$D</option>
                      <option value="ARS">ARS $</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-text-secondary">
                      Monto pagado <span className="text-text-muted">(0 = queda como deuda)</span>
                    </label>
                    <input
                      type="number" min="0" step="0.01"
                      value={receivePaid}
                      onChange={e => setReceivePaid(e.target.value)}
                      className="w-44 rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm focus:border-violet focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  El stock se sumará inmediatamente. Si el monto es 0, la compra queda en estado <span className="text-violet-light font-semibold">Stock Recibido</span> con deuda pendiente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button type="button" onClick={handleSubmit} disabled={saving || !supplier || cart.length === 0}
            className="rounded-xl bg-violet px-6 py-3 text-sm font-bold text-white transition-all hover:bg-violet-dark disabled:opacity-50">
            {saving ? "Registrando..." : receiveNow ? "✅ Registrar y confirmar recepción" : "💾 Registrar Compra"}
          </button>
          <Link href="/admin/purchases" className="rounded-xl border border-border px-6 py-3 text-sm text-text-muted transition-all hover:bg-bg-hover">
            Cancelar
          </Link>
        </div>

      </div>
    </div>
  );
}
