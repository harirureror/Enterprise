import { NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { getFilterOptions } from "@/lib/api";

/** GET /api/projects/filters — pilihan yang sah untuk dropdown filter. */
export async function GET() {
  const izin = await jagaRute("lihat-daftar");
  if (!izin.ok) return izin.response;

  return NextResponse.json(await getFilterOptions());
}
