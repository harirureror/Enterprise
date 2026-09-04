import { type NextRequest, NextResponse } from "next/server";
import { jagaRute, saringKeuangan } from "@/lib/api-guard";
import { deleteProject, getProjectDetail, getUsers, updateProject } from "@/lib/api";
import { type ProjectDraft, draftToProject, emptyDraft, validateDraft } from "@/lib/project-form";

/**
 * Satu proyek: GET (detail), PUT (ubah), DELETE (hapus).
 * Aturan validasinya sama persis dengan form di browser dan POST /api/projects —
 * semuanya lewat `validateDraft`, jadi tidak ada pintu belakang yang lebih longgar.
 */

/** Id dari path; NaN untuk "abc" sehingga ikut jatuh ke 400. */
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
  const izin = await jagaRute("lihat-daftar");
  if (!izin.ok) return izin.response;

  const id = await bacaId(params);
  if (id === null) return idTidakValid;

  const detail = await getProjectDetail(id);
  if (!detail) return tidakDitemukan;

  // Bentuknya sama dengan yang dipakai halaman detail, termasuk skor prioritas.
  return NextResponse.json({ ...detail, project: saringKeuangan(detail.project, izin.bolehKeuangan) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const izin = await jagaRute("ubah-semua-proyek");
  if (!izin.ok) return izin.response;

  const id = await bacaId(params);
  if (id === null) return idTidakValid;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body harus berupa objek." }, { status: 400 });
  }

  // Semua kolom dibaca sebagai string, sama seperti yang dikirim form.
  const masuk = body as Record<string, unknown>;
  const draft = Object.fromEntries(
    (Object.keys(emptyDraft()) as (keyof ProjectDraft)[]).map((k) => [
      k,
      masuk[k] === undefined || masuk[k] === null ? "" : String(masuk[k]),
    ])
  ) as ProjectDraft;

  const users = await getUsers();
  const errors = validateDraft(
    draft,
    users.map((u) => u.id)
  );

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Data proyek belum valid.", errors }, { status: 400 });
  }

  const project = await updateProject(id, draftToProject(draft));
  if (!project) return tidakDitemukan;

  return NextResponse.json({ project });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const izin = await jagaRute("hapus-proyek");
  if (!izin.ok) return izin.response;

  const id = await bacaId(params);
  if (id === null) return idTidakValid;

  // Menghapus proyek ikut menghapus riwayat progresnya (CASCADE di skema).
  const terhapus = await deleteProject(id);
  if (!terhapus) return tidakDitemukan;

  return NextResponse.json({ deleted: id });
}
