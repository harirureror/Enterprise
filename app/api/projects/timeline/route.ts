import { type NextRequest, NextResponse } from "next/server";
import { getTimeline } from "@/lib/api";
import { parseProjectFilter } from "@/lib/filters";

/**
 * GET /api/projects/timeline?status=&priority=&type=&ownerId=&q=
 * Filternya sama dengan GET /api/projects; bentrok jadwal dihitung ulang
 * mengikuti hasil saringan.
 */
export async function GET(request: NextRequest) {
  const { filter, invalid } = parseProjectFilter(request.nextUrl.searchParams);

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Nilai filter tidak dikenal: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ...(await getTimeline(filter)), filter });
}
