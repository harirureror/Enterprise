import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { unauthorized } from "@/lib/auth-response";

/** GET /api/auth/me — profil pengguna yang sedang masuk (PRD bagian 7). */
export async function GET() {
  const sesi = await getSession();
  if (!sesi) return unauthorized();

  const { user } = sesi;
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    /** "dev-fallback" berarti identitasnya diasumsikan, bukan dibuktikan. */
    source: sesi.source,
  });
}
