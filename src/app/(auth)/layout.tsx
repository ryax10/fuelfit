import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4">
      {/* BG glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.08),transparent_60%)]" />

      <div className="relative mb-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="Full Vip" width={40} height={40} className="rounded-xl" />
          <div className="leading-none">
            <span className="font-display text-base font-bold tracking-wider">FULL VIP</span>
            <span className="block text-[8px] font-semibold tracking-[0.3em] text-violet">IMPORTACIONES</span>
          </div>
        </Link>
      </div>

      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-bg-card p-7">
        {children}
      </div>
    </div>
  );
}
