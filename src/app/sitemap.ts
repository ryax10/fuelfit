import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.fuelfit.com.ar";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/productos`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/mayoristas`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/contacto`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/envios`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: products, error } = await supabase
      .from("products")
      .select("slug, created_at, price_min_ars, price_may_x15, image")
      .eq("visible", true);

    if (error || !products) return staticRoutes;

    const retailRoutes: MetadataRoute.Sitemap = products
      .filter(p => (p.price_min_ars ?? 0) > 0)
      .map(p => ({
        url: `${SITE_URL}/producto/${p.slug}`,
        lastModified: p.created_at ? new Date(p.created_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
        images: p.image ? [p.image] : [],
      }));

    const wholesaleRoutes: MetadataRoute.Sitemap = products
      .filter(p => (p.price_may_x15 ?? 0) > 0)
      .map(p => ({
        url: `${SITE_URL}/mayoristas/tienda/${p.slug}`,
        lastModified: p.created_at ? new Date(p.created_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
        images: p.image ? [p.image] : [],
      }));

    return [...staticRoutes, ...retailRoutes, ...wholesaleRoutes];
  } catch {
    return staticRoutes;
  }
}
