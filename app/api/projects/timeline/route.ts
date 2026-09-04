import { type NextRequest, NextResponse } from "next/server";
import { jagaRute, saringDaftar } from "@/lib/api-guard";
import { getTimeline } from "@/lib/api";
import { parseProjectFilter } from "@/lib/filters";

/**
 * GET /api/projects/timeline?status=&priority=&type=&ownerId=&q=
 * Filternya sama dengan GET /api/projects; bentrok jadwal dihitung ulang
 * mengikuti hasil saringan.
 */
export async function GET(request: NextRequest) {
  const izin = await jagaRute("lihat-daftar");
  if (!izin.ok) return izin.response;

  const { filter, invalid } = parseProjectFilter(request.nextUrl.searchParams);

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Nilai filter tidak dikenal: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const timeline = await getTimeline(filter);
  return NextResponse.json({
    ...timeline,
    projects: saringDaftar(timeline.projects, izin.bolehKeuangan),
    filter,
  });
}
