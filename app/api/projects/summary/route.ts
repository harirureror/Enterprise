import { NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { getSummary } from "@/lib/api";

export async function GET() {
  const izin = await jagaRute("lihat-daftar");
  if (!izin.ok) return izin.response;

  const summary = await getSummary();
  if (izin.bolehKeuangan) return NextResponse.json(summary);

  // Angka pipeline dan nilai selesai adalah data keuangan juga, jadi ikut
  // dibuang — bukan hanya kolom per proyek.
  const { pipelineValue, completedValue, valueMissing, ...tanpaUang } = summary;
  void pipelineValue;
  void completedValue;
  void valueMissing;
  return NextResponse.json(tanpaUang);
}
