import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

function verifyAdminToken(token: string): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !token) return null;
  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return null;
  const username = token.slice(0, colonIdx);
  const sig = token.slice(colonIdx + 1);
  if (!username || !sig) return null;
  try {
    const expected = createHmac("sha256", secret).update(username).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
    return username;
  } catch {
    return null;
  }
}

function getDisplayName(username: string): string {
  const users = [
    { username: process.env.ADMIN_1_USERNAME, display: process.env.ADMIN_1_DISPLAY },
    { username: process.env.ADMIN_2_USERNAME, display: process.env.ADMIN_2_DISPLAY },
  ];
  const match = users.find((u) => u.username === username);
  return match?.display || username;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value || "";

  const username = verifyAdminToken(session);

  // Sin sesión válida = renderizar sin sidebar (el middleware ya redirige)
  if (!username) {
    return <>{children}</>;
  }

  const userName = getDisplayName(username);

  return (
    <div className="min-h-screen bg-bg-primary">
      <AdminSidebar userName={userName} />
      <main className="min-h-screen p-4 pt-20 lg:ml-56 lg:p-6">{children}</main>
    </div>
  );
}
