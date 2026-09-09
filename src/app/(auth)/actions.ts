"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { nameToEmail } from "@/lib/auth/phone-utils";

export async function registerClientAction(
  nombre: string,
  apellido: string,
  whatsapp: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const email = nameToEmail(nombre, apellido);

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      full_name: `${nombre} ${apellido}`,
      nombre,
      apellido,
      phone: whatsapp,
    },
    email_confirm: true,
  });

  if (error) {
    if (error.code === "email_exists" || error.message.toLowerCase().includes("already")) {
      return { success: false, error: "Ya existe una cuenta con ese nombre y apellido." };
    }
    return { success: false, error: "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  // Crear ficha de cliente en la tabla customers
  if (created?.user) {
    const digits = whatsapp.replace(/\D/g, "");
    const code = `MIN-${digits.slice(-4)}`;
    await supabase.from("customers").insert({
      name: `${nombre} ${apellido}`.trim(),
      phone: whatsapp,
      address: "",
      type: "retail",
      code,
      status: "active",
      total_orders: 0,
      all_phones: [whatsapp],
    });
  }

  return { success: true };
}
