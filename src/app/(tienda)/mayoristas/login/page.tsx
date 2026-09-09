"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function MayoristasLoginRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/mayoristas/tienda"); }, [router]);
  return <div className="min-h-[60vh] flex items-center justify-center"><p className="text-text-muted">Redirigiendo a tienda mayorista...</p></div>;
}
