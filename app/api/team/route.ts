import { NextResponse } from "next/server";
import { getTeam } from "@/lib/api";
import { unauthorized } from "@/lib/auth-response";
import { requireSession } from "@/lib/auth";

/**
 * GET /api/team — beban kerja seluruh anggota.
 *
 * Data kolaborasi memperlihatkan siapa mengerjakan apa dan nilai kontrak yang
 * ditangani, jadi aksesnya butuh identitas (NF1 di PRD). Selama login belum
 * ada, di luar produksi identitasnya jatuh ke pengguna bawaan — lihat lib/auth.ts.
 */
export async function GET() {
  const sesi = await requireSession();
  if (!sesi) return unauthorized();

  const members = await getTeam();

  return NextResponse.json({
    members,
    count: members.length,
    /** Supaya klien tahu identitasnya diasumsikan, bukan dibuktikan. */
    viewer: { id: sesi.user.id, name: sesi.user.name, source: sesi.source },
  });
}
