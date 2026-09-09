"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMyOrdersAction } from "@/app/(tienda)/perfil/actions";
import type { Order, OrderItem } from "@/lib/local-db/types";
import { ShoppingBag } from "lucide-react";

type OrderWithItems = Order & { items: OrderItem[] };

export default function MisComprasPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      getMyOrdersAction().then((data) => { setOrders(data); setLoading(false); });
    });
  }, [router]);

  if (loading) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-text-muted text-sm">Cargando compras...</div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold mb-1">Mis Compras</h1>
      <p className="text-sm text-text-muted mb-8">Historial de pedidos confirmados.</p>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-border bg-bg-card px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
            <ShoppingBag size={28} className="text-text-muted" />
          </div>
          <p className="mt-5 text-text-secondary">Todavía no tenés compras confirmadas.</p>
          <Link href="/productos" className="mt-6 rounded-xl bg-violet px-6 py-2.5 text-sm font-bold tracking-wider text-white hover:bg-violet-dark transition-all">
            VER CATÁLOGO
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              {/* Header del pedido */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-bold">Pedido #{order.number}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {order.confirmed_at
                      ? new Date(order.confirmed_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
                      : new Date(order.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold tracking-wider text-green-400 bg-green-500/10 rounded-lg px-2 py-1">CONFIRMADO</span>
                  <p className="mt-1 font-display text-lg font-bold">${order.total.toLocaleString()}</p>
                </div>
              </div>

              {/* Items del pedido */}
              <div className="px-5 py-3 space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                      {item.product_name} <span className="text-text-muted">×{item.qty}</span>
                    </span>
                    <span className="font-medium">${item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              {(order.customer_address || order.payment_method) && (
                <div className="px-5 py-3 bg-bg-secondary/40 border-t border-border flex flex-wrap gap-4 text-xs text-text-muted">
                  {order.customer_address && !order.customer_address.includes("Retiro") && (
                    <span>📦 Envío: {order.customer_address}</span>
                  )}
                  {order.customer_address?.includes("Retiro") && <span>📍 Retiro en local</span>}
                  {order.payment_method && (
                    <span>{order.payment_method === "cash" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
