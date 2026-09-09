import type { Metadata } from "next";

export const metadata: Metadata = { title: "Productos" };

export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
