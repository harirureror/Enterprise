import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/api";

/** GET /api/projects/filters — pilihan yang sah untuk dropdown filter. */
export async function GET() {
  return NextResponse.json(await getFilterOptions());
}
