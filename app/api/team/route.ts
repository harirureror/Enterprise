import { NextResponse } from "next/server";
import { getTeam } from "@/lib/api";
import { jagaRute } from "@/lib/api-guard";

/**
 * GET /api/team — beban kerja seluruh anggota.
 *
 * Data kolaborasi memperlihatkan siapa mengerjakan apa dan nilai kontrak yang
 * ditangani, jadi aksesnya butuh identitas (NF1 di PRD). Selama login belum
 * ada, di luar produksi identitasnya jatuh ke pengguna bawaan — lihat lib/auth.ts.
 */
export async function GET() {
  const izin = await jagaRute("lihat-tim");
  if (!izin.ok) return izin.response;
  const sesi = { user: izin.user, source: "cookie" as const };

  const members = await getTeam();

  return NextResponse.json({
    members,
    count: members.length,
    /** Supaya klien tahu identitasnya diasumsikan, bukan dibuktikan. */
    viewer: { id: sesi.user.id, name: sesi.user.name, source: sesi.source },
  });
}
