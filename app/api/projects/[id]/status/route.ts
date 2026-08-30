import { type NextRequest, NextResponse } from "next/server";
import { getProject, updateProjectStatus } from "@/lib/api";
import { PROJECT_STATUSES, type ProjectStatus, isActiveStatus } from "@/lib/types";

/**
 * Status satu proyek: GET (baca) dan PATCH (ubah tahap pipeline).
 *
 * Dibuat sebagai sub-resource sendiri, sejajar dengan `/progress`, karena
 * mengubah tahap adalah keputusan tersendiri — bukan bagian dari menyunting
 * seluruh isi proyek lewat PUT /api/projects/{id}.
 *
 * Persentase progres sengaja tidak ikut berubah: menandai proyek "Selesai"
 * tidak otomatis membuat progresnya 100%, dan sebaliknya. Itu dicatat lewat
 * PATCH /api/projects/{id}/progress supaya jejak auditnya tetap jelas.
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

  return NextResponse.json({
    projectId: id,
    status: project.status,
    active: isActiveStatus(project.status),
    // Pilihan yang sah dikirim sekalian supaya klien tidak perlu menebak.
    allowed: PROJECT_STATUSES,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const diminta = (body as Record<string, unknown>).status;
  const status = diminta === undefined || diminta === null ? "" : String(diminta);

  if (!(PROJECT_STATUSES as string[]).includes(status)) {
    return NextResponse.json(
      {
        error: "Status proyek tidak dikenal.",
        errors: { status: `Pilih salah satu: ${PROJECT_STATUSES.join(", ")}.` },
      },
      { status: 400 }
    );
  }

  const project = await updateProjectStatus(id, status as ProjectStatus);
  if (!project) return tidakDitemukan;

  return NextResponse.json({
    project,
    // Prioritas ikut dihitung ulang karena tahap pipeline salah satu sinyalnya.
    priority: project.priority,
  });
}
