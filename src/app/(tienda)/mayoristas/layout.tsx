import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mayoristas" };

export default function MayoristasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
