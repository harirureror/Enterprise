import { type NextRequest, NextResponse } from "next/server";
import { addProgress, getCurrentUser, getProgressHistory, getProject } from "@/lib/api";
import { type ProgressDraft, validateProgress } from "@/lib/progress-form";

/**
 * Progres satu proyek: GET (riwayat) dan PATCH (catat pembaruan).
 *
 * PATCH, bukan PUT, karena yang diubah hanya persentase progres — kolom proyek
 * yang lain sengaja tidak tersentuh. Status juga tidak ikut berubah: menaikkan
 * progres ke 100% bukan berarti proyeknya otomatis selesai, itu keputusan
 * terpisah lewat PUT /api/projects/{id} atau kontrol status di halaman detail.
 */

async function bacaId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const angka = Number(id);
  return Number.isInteger(angka) && angka > 0 ? angka : null;
}

const idTidakValid = NextResponse.json(
  { error: "Id proyek harus bilangan bulat positif." },
  { status: 400 }
);

const tidakDitemukan = NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = await bacaId(params);
  if (id === null) return idTidakValid;

  const project = await getProject(id);
  if (!project) return tidakDitemukan;

  const history = await getProgressHistory(id);
  return NextResponse.json({ projectId: id, progressPct: project.progressPct, history });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = await bacaId(params);
  if (id === null) return idTidakValid;

  const project = await getProject(id);
  if (!project) return tidakDitemukan;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body harus berupa objek." }, { status: 400 });
  }

  const masuk = body as Record<string, unknown>;
  const draft: ProgressDraft = {
    progressPct:
      masuk.progressPct === undefined || masuk.progressPct === null
        ? ""
        : String(masuk.progressPct),
    note: masuk.note === undefined || masuk.note === null ? "" : String(masuk.note),
  };

  // Aturan yang sama dengan form di halaman detail, termasuk larangan mencatat
  // baris kosong saat persentasenya tidak berubah.
  const errors = validateProgress(draft, project.progressPct);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Catatan progres belum valid.", errors }, { status: 400 });
  }

  // ponytail: pencatat diambil dari sesi setelah fase autentikasi; sekarang
  // masih pengguna aktif bawaan.
  const user = await getCurrentUser();
  const entry = await addProgress({
    projectId: id,
    userId: user.id,
    progressPct: Number(draft.progressPct),
    note: draft.note.trim(),
  });

  if (!entry) return tidakDitemukan;

  return NextResponse.json(
    { entry, progressPct: Number(draft.progressPct) },
    { status: 201 }
  );
}
