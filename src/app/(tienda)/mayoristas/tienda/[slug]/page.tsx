import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import MayoristaProductoClient from "./MayoristaProductoClient";
import type { Product } from "@/lib/local-db/types";

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
    .select("name, flavor, brand, model, image, price_may_x15")
    .eq("slug", slug)
    .eq("visible", true)
    .single();

  if (!p) return { title: "Producto no encontrado" };

  const displayName = p.flavor ? `${p.flavor} — ${p.brand} ${p.model}` : `${p.brand} ${p.model}`;
  const description = [
    `Precio mayorista ${displayName}.`,
    p.price_may_x15 > 0 ? `Desde USDT ${p.price_may_x15} la unidad.` : "",
    "FuelFit — Argentina.",
  ].filter(Boolean).join(" ");

  return {
    title: `${displayName} — Mayorista`,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE_URL}/mayoristas/tienda/${slug}` },
    openGraph: {
      title: `${displayName} | FuelFit Mayoristas`,
      description,
      url: `${SITE_URL}/mayoristas/tienda/${slug}`,
      images: p.image
        ? [{ url: p.image, alt: `${p.brand} ${p.model}${p.flavor ? ` sabor ${p.flavor}` : ""}` }]
        : [{ url: "/logo.jpg", alt: "FuelFit" }],
    },
  };
}

export default async function MayoristaProductoDetallePage({ params }: Props) {
  const { slug } = await params;

  const { data: p } = await getSupabase()
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("visible", true)
    .single();

  const displayName = p
    ? p.flavor ? `${p.flavor} — ${p.brand} ${p.model}` : `${p.brand} ${p.model}`
    : "";

  const availableUnits = p ? Math.max(0, p.stock_actual - p.stock_reservado) : 0;

  const productJsonLd = p ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayName,
    description: `${p.brand} ${p.model}${p.flavor ? ` sabor ${p.flavor}` : ""}. Precio mayorista desde USDT ${p.price_may_x15}. Importación directa. FuelFit.`,
    image: p.image || `${SITE_URL}/logo.jpg`,
    brand: { "@type": "Brand", name: p.brand },
    category: p.category,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: p.price_may_x15,
      availability: availableUnits > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/mayoristas/tienda/${slug}`,
      seller: { "@type": "Organization", name: "FuelFit" },
    },
  } : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Mayoristas", item: `${SITE_URL}/mayoristas` },
      { "@type": "ListItem", position: 2, name: "Tienda Mayorista", item: `${SITE_URL}/mayoristas/tienda` },
      ...(p ? [{ "@type": "ListItem", position: 3, name: displayName, item: `${SITE_URL}/mayoristas/tienda/${slug}` }] : []),
    ],
  };

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <MayoristaProductoClient slug={slug} initialProduct={p as Product | null} />
    </>
  );
}
