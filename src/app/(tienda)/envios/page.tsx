import type { Metadata } from "next";
import { Truck, Zap, MapPin, Clock, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Información de Envíos",
  description:
    "Enviamos a todo el país. Coordinar envío por WhatsApp.",
  alternates: { canonical: "/envios" },
  openGraph: {
    title: "Envíos | FuelFit",
    description:
      "Envíos a todo el país. Coordinar envío por WhatsApp.",
  },
};

export default function EnviosPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center mb-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Envíos</h1>
        <p className="mt-2 text-text-secondary">
          Hacemos envíos a todo el país de forma rápida y segura
        </p>
      </div>

      {/* Métodos de envío */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Vía Cargo */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet/10">
              <Truck size={22} className="text-violet" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold">Vía Cargo</h3>
              <p className="text-xs text-violet-light font-medium">Todo el país</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-2.5">
              <span className="text-sm text-text-secondary">Tiempo estimado</span>
              <span className="text-sm font-semibold text-text-primary">1 a 5 días hábiles</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-2.5">
              <span className="text-sm text-text-secondary">Cobertura</span>
              <span className="text-sm font-semibold text-text-primary">Nacional</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-2.5">
              <span className="text-sm text-text-secondary">Seguimiento</span>
              <span className="text-sm font-semibold text-text-primary">Incluido</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-text-muted leading-relaxed">
            Enviamos a todas las provincias. El paquete llega a la sucursal más cercana a tu domicilio. Te pasamos el código de seguimiento por WhatsApp.
          </p>
        </div>

        {/* UberMoto Express */}
        <div className="rounded-2xl border border-border bg-bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet/10">
              <Zap size={22} className="text-violet" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold">UberMoto Express</h3>
              <p className="text-xs text-violet-light font-medium">CABA y GBA</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-2.5">
              <span className="text-sm text-text-secondary">Tiempo estimado</span>
              <span className="text-sm font-semibold text-text-primary">Mismo día</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-2.5">
              <span className="text-sm text-text-secondary">Cobertura</span>
              <span className="text-sm font-semibold text-text-primary">CABA / GBA</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-2.5">
              <span className="text-sm text-text-secondary">Pago del envío</span>
              <span className="text-sm font-semibold text-text-primary">Solo transferencia</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-text-muted leading-relaxed">
            Envío express en moto para CABA y GBA. El costo se calcula según la distancia desde nuestras oficinas.
          </p>
        </div>
      </div>

      {/* FAQ envíos */}
      <div className="mt-8 rounded-2xl border border-border bg-bg-card p-6">
        <h3 className="font-display text-lg font-bold mb-4">Preguntas frecuentes</h3>
        <div className="space-y-3">
          {[
            { q: "¿Cuánto tarda en llegar mi pedido?", a: "Por Vía Cargo, entre 1 y 5 días hábiles según la provincia. Por UberMoto, el mismo día dentro de CABA y GBA. Para retiro coordinamos horario por WhatsApp." },
            { q: "¿Cómo sé dónde está mi paquete?", a: "Una vez despachado te enviamos el número de tracking por WhatsApp para que puedas seguirlo en tiempo real desde el sitio de la empresa de correos." },
{ q: "¿Qué pasa si no estoy cuando llega el paquete?", a: "Con Vía Cargo el paquete queda en la sucursal más cercana durante 5 días hábiles. Por UberMoto coordinamos con vos el horario de entrega." },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl bg-bg-elevated p-4">
              <div className="flex items-start gap-3">
                <ChevronRight size={16} className="text-violet mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold mb-1">{q}</p>
                  <p className="text-xs text-text-muted leading-relaxed">{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Retiro */}
      <div className="mt-4 rounded-2xl border border-border bg-bg-card p-6">
        <div className="flex items-center gap-3">
          <MapPin size={18} className="text-violet" />
          <h3 className="font-display text-base font-bold">Retiro en el comercio</h3>
        </div>
        <p className="mt-3 text-sm text-text-muted leading-relaxed">
          También podés pasar a retirar tu pedido por nuestras oficinas. Coordinamos día y horario por WhatsApp.
          Si retirás, podés abonar con el medio de pago que prefieras.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Clock size={14} className="text-text-muted" />
          <span className="text-xs text-text-muted">Lunes a sábados de 10 a 18 hs</span>
        </div>
      </div>
    </div>
  );
}
