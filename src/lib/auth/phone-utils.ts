/** Convierte un número de WhatsApp a email sintético para Supabase Auth */
export function whatsappToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("54") ? digits : `54${digits}`;
  return `${normalized}@clientes.fullvip`;
}

/** Convierte nombre + apellido a email sintético para Supabase Auth */
export function nameToEmail(nombre: string, apellido: string): string {
  const normalize = (s: string) =>
    s.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return `${normalize(nombre)}.${normalize(apellido)}@clientes.fullvip`;
}
