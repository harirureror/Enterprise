import { type NextRequest, NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { addProgress, getProgressHistory, getProject } from "@/lib/api";
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
  const izin = await jagaRute("lihat-detail");
  if (!izin.ok) return izin.response;

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
  const izin = await jagaRute("ubah-semua-proyek");
  if (!izin.ok) return izin.response;

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
    note: masuk.note === undefined || masuk.note === null ? "" : String(masuk.note),
  };

  /* `progressPct` yang dikirim SENGAJA DIABAIKAN, bukan ditolak: progres kini
     sepenuhnya diturunkan dari checklist aktivitas, dan satu panggilan REST
     yang boleh menimpanya akan diam-diam membatalkan seluruh perhitungan itu.
     Menolaknya dengan galat akan mematahkan pemanggil lama tanpa perlu; yang
     tercatat tetap angka yang berlaku. */
  const errors = validateProgress(draft);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Catatan progres belum valid.", errors }, { status: 400 });
  }

  // ponytail: pencatat diambil dari sesi setelah fase autentikasi; sekarang
  // masih pengguna aktif bawaan.
  // Pencatatnya pengguna sesi. getCurrentUser() mengembalikan pengguna
  // pertama, jadi seluruh catatan akan diatasnamakan orang yang sama.
  const user = izin.user;
  const entry = await addProgress({
    projectId: id,
    userId: user.id,
    progressPct: project.progressPct,
    note: draft.note.trim(),
  });

  if (!entry) return tidakDitemukan;

  return NextResponse.json({ entry, progressPct: project.progressPct }, { status: 201 });
}
