import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import ProductoDetalleClient from "./ProductoDetalleClient";

type Props = { params: Promise<{ slug: string }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.fuelfit.com.ar";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function generateStaticParams() {
  const { data } = await getSupabase()
    .from("products")
    .select("slug")
    .eq("visible", true);
  return (data || []).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: p } = await getSupabase()
    .from("products")
    .select("name, flavor, brand, model, image, price_min_ars, price_may_x15")
    .eq("slug", slug)
    .eq("visible", true)
    .single();

  if (!p) return { title: "Producto no encontrado" };

  const displayName = p.flavor ? `${p.flavor} — ${p.brand} ${p.model}` : `${p.brand} ${p.model}`;
  const description = [
    `Comprá ${displayName} en FuelFit.`,
    p.price_min_ars > 0 ? `Precio: $${p.price_min_ars.toLocaleString("es-AR")} ARS.` : "",
    p.price_may_x15 > 0 ? `Mayorista desde USDT ${p.price_may_x15}.` : "",
    "Envíos a todo el país.",
  ].filter(Boolean).join(" ");

  return {
    title: displayName,
    description,
    alternates: {
      canonical: `/producto/${slug}`,
    },
    openGraph: {
      title: `${displayName} | FuelFit`,
      description,
      url: `${SITE_URL}/producto/${slug}`,
      images: p.image
        ? [{ url: p.image, alt: displayName }]
        : [{ url: "/logo.jpg", alt: "FuelFit" }],
    },
    twitter: {
      card: "summary_large_image",
      title: displayName,
      description,
      images: p.image ? [p.image] : ["/logo.jpg"],
    },
  };
}

export default async function ProductoDetallePage({ params }: Props) {
  const { slug } = await params;

  const { data: p } = await getSupabase()
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("visible", true)
    .single();

  const availableStock = p ? Math.max(0, p.stock_actual - p.stock_reservado) : 0;

  const displayName = p
    ? p.flavor ? `${p.flavor} — ${p.brand} ${p.model}` : `${p.brand} ${p.model}`
    : "";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Productos", item: `${SITE_URL}/productos` },
      ...(p ? [{ "@type": "ListItem", position: 3, name: displayName, item: `${SITE_URL}/producto/${slug}` }] : []),
    ],
  };

  const jsonLd = p
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: displayName,
        description: `Vaporizador ${p.brand} ${p.model}${p.flavor ? ` sabor ${p.flavor}` : ""}. Importación directa. Envíos a todo el país.`,
        image: p.image || `${SITE_URL}/logo.jpg`,
        brand: { "@type": "Brand", name: p.brand },
        category: p.category,
        offers: {
          "@type": "Offer",
          priceCurrency: "ARS",
          price: p.price_min_ars,
          availability:
            availableStock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/producto/${slug}`,
          seller: {
            "@type": "Organization",
            name: "FuelFit",
          },
        },
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {p ? <ProductoDetalleClient product={p as import("@/lib/local-db/types").Product} /> : (
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <p className="text-text-muted">Producto no encontrado</p>
          <a href="/productos" className="mt-4 inline-block text-violet-light hover:text-violet">← Volver al catálogo</a>
        </div>
      )}
    </>
  );
}
