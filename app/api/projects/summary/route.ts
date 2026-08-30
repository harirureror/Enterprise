import { NextResponse } from "next/server";
import { getSummary } from "@/lib/api";

export async function GET() {
  return NextResponse.json(await getSummary());
}
