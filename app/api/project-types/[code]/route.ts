import { type NextRequest, NextResponse } from "next/server";
import { getProjectType, updateProjectType } from "@/lib/api";
import { type TypeDraft, validateTypeDraft } from "@/lib/type-form";

/**
 * Satu jenis proyek: GET (baca) dan PUT (ubah label/keterangan/urutan).
 * DELETE sengaja ditolak — lihat penjelasan di route induknya.
 */

const tidakDitemukan = NextResponse.json({ error: "Jenis proyek tidak dikenal." }, { status: 404 });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const jenis = await getProjectType(decodeURIComponent(code));
  return jenis ? NextResponse.json({ type: jenis }) : tidakDitemukan;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const kode = decodeURIComponent(code);

  if (!(await getProjectType(kode))) return tidakDitemukan;

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

  // Mengirim `code` yang berbeda hampir pasti salah paham, jadi ditolak terang-terangan
  // ketimbang diabaikan diam-diam.
  if (masuk.code !== undefined && String(masuk.code) !== kode) {
    return NextResponse.json(
      { error: "Kode jenis tidak bisa diubah." },
      { status: 409 }
    );
  }

  const draft: TypeDraft = {
    label: masuk.label === undefined || masuk.label === null ? "" : String(masuk.label),
    description:
      masuk.description === undefined || masuk.description === null
        ? ""
        : String(masuk.description),
    sortOrder:
      masuk.sortOrder === undefined || masuk.sortOrder === null ? "" : String(masuk.sortOrder),
  };

  const errors = validateTypeDraft(draft);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Data jenis belum valid.", errors }, { status: 400 });
  }

  const jenis = await updateProjectType(kode, {
    label: draft.label.trim(),
    description: draft.description.trim(),
    sortOrder: Number(draft.sortOrder),
  });

  return jenis ? NextResponse.json({ type: jenis }) : tidakDitemukan;
}

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Jenis proyek tidak bisa dihapus: kodenya dipakai kolom projects.type dan dijaga CHECK di skema.",
    },
    { status: 409 }
  );
}
