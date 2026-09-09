import type { Metadata } from "next";
import { MessageCircle, Clock, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contactá a FuelFit por WhatsApp o Instagram. Atención de lunes a sábados de 10 a 18 hs.",
  alternates: { canonical: "/contacto" },
  openGraph: {
    title: "Contacto | FuelFit",
    description:
      "Escribinos por WhatsApp para consultas sobre productos, precios mayoristas y envíos.",
  },
};

function WaIcon({size=32}:{size?:number}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>; }
function IgIcon({size=32}:{size?:number}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>; }

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center mb-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Contacto</h1>
        <p className="mt-2 text-text-secondary">Escribinos por cualquier consulta. Respondemos rápido.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <a href="https://wa.me/5491100000000?text=Hola!%20Quiero%20consultar%20por%20productos" target="_blank" rel="noopener noreferrer"
          className="group flex flex-col items-center rounded-2xl border border-green-500/20 bg-green-500/5 p-8 text-center hover:bg-green-500/10 hover:border-green-500/30 transition-all">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 text-green-400 group-hover:scale-110 transition-transform"><WaIcon /></div>
          <h3 className="mt-5 font-display text-lg font-bold text-green-300">WhatsApp</h3>
          <p className="mt-2 text-sm text-text-muted">Escribinos directo. Es la forma más rápida de contactarnos.</p>
          <span className="mt-4 rounded-xl bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400 group-hover:bg-green-500/20 transition-colors">Abrir chat →</span>
        </a>
        <a href="https://www.instagram.com/fuelfit" target="_blank" rel="noopener noreferrer"
          className="group flex flex-col items-center rounded-2xl border border-violet/20 bg-violet/5 p-8 text-center hover:bg-violet/10 hover:border-violet/30 transition-all">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet/10 text-violet-light group-hover:scale-110 transition-transform"><IgIcon /></div>
          <h3 className="mt-5 font-display text-lg font-bold text-violet-light">Instagram</h3>
          <p className="mt-2 text-sm text-text-muted">Seguinos para ver novedades, productos nuevos y ofertas.</p>
          <span className="mt-4 rounded-xl bg-violet/10 px-4 py-2 text-sm font-semibold text-violet-light group-hover:bg-violet/20 transition-colors">@fuelfit →</span>
        </a>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center gap-3"><Clock size={18} className="text-violet" /><h3 className="font-display text-base font-bold">Horario de atención</h3></div>
          <p className="mt-3 text-sm text-text-muted leading-relaxed">Lunes a Sábados de 10:00 a 18:00 hs.</p>
        </div>
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center gap-3"><MapPin size={18} className="text-violet" /><h3 className="font-display text-base font-bold">Punto de retiro</h3></div>
          <p className="mt-3 text-sm text-text-muted leading-relaxed">Argentina.<br />Coordinar retiro por WhatsApp.</p>
        </div>
      </div>
      <div className="mt-8 rounded-2xl border border-border bg-bg-card p-6">
        <h3 className="font-display text-base font-bold flex items-center gap-2"><MessageCircle size={18} className="text-violet" />Preguntas frecuentes</h3>
        <div className="mt-4 space-y-3">
          {[
            { q: "¿Hacen envíos al interior?", a: "Sí, enviamos a todo el país por Vía Cargo (1 a 5 días hábiles)." },
            { q: "¿Tienen precios mayoristas?", a: "Sí, ingresá a la sección Mayoristas para ver precios por cantidad en USD." },
            { q: "¿Cuánto tarda en llegar mi pedido?", a: "CABA/GBA: mismo día por UberMoto. Interior: 1-5 días por Vía Cargo." },
            { q: "¿Qué medios de pago aceptan?", a: "MercadoPago (transferencia o tarjeta) y efectivo en retiros." },
          ].map((item) => (
            <details key={item.q} className="group rounded-xl border border-border bg-bg-elevated">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text-primary hover:text-violet-light transition-colors">{item.q}</summary>
              <p className="px-4 pb-3 text-sm text-text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
