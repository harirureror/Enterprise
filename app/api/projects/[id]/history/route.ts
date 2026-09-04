import { type NextRequest, NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { getProgressHistoryView, getProject } from "@/lib/api";

/**
 * GET /api/projects/{id}/history — riwayat progres lengkap, terbaru dulu.
 *
 * Bedanya dengan GET /api/projects/{id}/progress: endpoint itu memberi angka
 * progres saat ini beserta catatan mentahnya, sedangkan yang ini melengkapi
 * tiap baris dengan nama pencatat dan selisih dari catatan sebelumnya —
 * bentuk yang sama dengan yang dipakai halaman detail.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const izin = await jagaRute("lihat-detail");
  if (!izin.ok) return izin.response;

  const { id } = await params;
  const angka = Number(id);

  if (!Number.isInteger(angka) || angka <= 0) {
    return NextResponse.json(
      { error: "Id proyek harus bilangan bulat positif." },
      { status: 400 }
    );
  }

  const project = await getProject(angka);
  if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

  const history = await getProgressHistoryView(angka);

  return NextResponse.json({
    projectId: angka,
    progressPct: project.progressPct,
    count: history.length,
    /** Kenaikan total dari catatan paling awal sampai terbaru. */
    totalGain:
      history.length === 0
        ? 0
        : history[0].progressPct - history[history.length - 1].progressPct,
    history,
  });
}
