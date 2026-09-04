import { NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { getProjectTypes, getTypeBreakdown } from "@/lib/api";

/**
 * GET /api/project-types — daftar jenis proyek beserta jumlah pemakaiannya.
 *
 * Tidak ada POST: keempat kode jenis terkunci di union `ProjectType` dan di
 * CHECK kolom `projects.type`, jadi menambah kode baru lewat API akan langsung
 * ditolak database sekaligus memutus pemetaan `Record<ProjectType, ...>` di UI.
 * Menjadikannya benar-benar dinamis perlu perubahan skema tersendiri.
 */
export async function GET() {
  const izin = await jagaRute("lihat-daftar");
  if (!izin.ok) return izin.response;

  const [types, breakdown] = await Promise.all([getProjectTypes(), getTypeBreakdown()]);

  return NextResponse.json({
    types: types.map((t) => ({
      ...t,
      // Dipakai UI supaya jenis yang masih terpakai tidak diperlakukan sama
      // dengan yang kosong.
      projects: breakdown.find((b) => b.type === t.code)?.total ?? 0,
    })),
    /** Kode jenis tidak bisa ditambah atau dihapus lewat API. */
    fixedCodes: true,
  });
}

export async function POST() {
  const izin = await jagaRute("kelola-jenis");
  if (!izin.ok) return izin.response;

  return NextResponse.json(
    {
      error:
        "Kode jenis proyek tetap dan tidak bisa ditambah. Yang bisa diubah hanya label, keterangan, dan urutannya lewat PUT /api/project-types/{code}.",
    },
    { status: 409 }
  );
}
