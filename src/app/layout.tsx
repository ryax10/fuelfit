import type { Metadata } from "next";
import { Outfit, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.fuelfit.com.ar";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FuelFit — Suplementos y Ropa Deportiva Mayorista y Minorista",
    template: "%s | FuelFit",
  },
  description: "FuelFit: suplementos deportivos y ropa fitness premium. Venta mayorista y minorista. Envíos a todo el país.",
  keywords: ["suplementos deportivos", "proteina", "creatina", "pre-workout", "ropa fitness", "indumentaria deportiva", "FuelFit", "mayorista suplementos"],
  authors: [{ name: "FuelFit" }],
  creator: "FuelFit",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "FuelFit",
    title: "FuelFit — Suplementos y Ropa Deportiva",
    description: "Suplementos deportivos y ropa fitness premium. Venta mayorista y minorista. Envíos a todo el país.",
    images: [{ url: `${SITE_URL}/logo.jpg`, width: 1200, height: 630, alt: "FuelFit" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FuelFit — Suplementos y Ropa Deportiva",
    description: "Suplementos deportivos y ropa fitness. Venta mayorista y minorista.",
    images: [`${SITE_URL}/logo.jpg`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: "/favicon-logo.jpg",
    apple: "/favicon-logo.jpg",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "FuelFit",
  description:
    "Suplementos deportivos y ropa fitness. Ventas mayoristas y minoristas. Envíos a todo el país.",
  url: SITE_URL,
  telephone: "+5491100000000",
  image: `${SITE_URL}/logo.jpg`,
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Argentina",
    addressRegion: "Argentina",
    addressCountry: "AR",
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "10:00",
    closes: "18:00",
  },
  sameAs: ["https://www.instagram.com/fuelfit"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark ${outfit.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
