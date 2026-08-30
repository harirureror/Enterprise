import { type NextRequest, NextResponse } from "next/server";
import { getOverlapStats } from "@/lib/api";
import { parseProjectFilter } from "@/lib/filters";

/**
 * GET /api/projects/overlap?status=&priority=&type=&ownerId=&q=
 * Statistik tumpang tindih jadwal untuk saringan yang diminta — angka saja,
 * tanpa daftar proyeknya (pakai /api/projects/timeline kalau butuh datanya).
 */
export async function GET(request: NextRequest) {
  const { filter, invalid } = parseProjectFilter(request.nextUrl.searchParams);

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Nilai filter tidak dikenal: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ...(await getOverlapStats(filter)), filter });
}
