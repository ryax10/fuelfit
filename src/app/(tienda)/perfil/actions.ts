"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { whatsappToEmail } from "@/lib/auth/phone-utils";
import type { Order, OrderItem } from "@/lib/local-db/types";

export async function updateProfileAction(
  newPhone: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const oldPhone: string = user.user_metadata?.phone || "";
  const admin = createAdminClient();

  // 1. Actualizar Auth: nuevo email sintético + metadata (mantiene nombre/apellido)
  await admin.auth.admin.updateUserById(user.id, {
    email: whatsappToEmail(newPhone),
    user_metadata: {
      ...user.user_metadata,
      phone: newPhone,
    },
  });

  // 2. Buscar cliente en la tabla customers por teléfono actual
  const normalizedOld = oldPhone.replace(/\D/g, "").slice(-10);
  const { data: customer } = await admin
    .from("customers")
    .select("id, phone")
    .ilike("phone", `%${normalizedOld}`)
    .maybeSingle();

  if (customer) {
    await admin.from("customers").update({
      phone: newPhone,
    }).eq("id", customer.id);
  }

  return { success: true };
}

export async function getMyOrdersAction(): Promise<
  Array<Order & { items: OrderItem[] }>
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const phone: string = user.user_metadata?.phone || "";
  const normalized = phone.replace(/\D/g, "").slice(-10);
  if (!normalized) return [];

  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("orders")
    .select("*")
    .ilike("customer_phone", `%${normalized}`)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false });

  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);

  return orders.map((o) => ({
    ...(o as Order),
    items: ((items || []) as OrderItem[]).filter((i) => i.order_id === o.id),
  }));
}
