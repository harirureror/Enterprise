import { type NextRequest, NextResponse } from "next/server";
import { createProject, getProjects, getUsers } from "@/lib/api";
import { parseProjectFilter } from "@/lib/filters";
import { type ProjectDraft, draftToProject, emptyDraft, validateDraft } from "@/lib/project-form";

/**
 * GET /api/projects?status=&priority=&type=&ownerId=&q=
 * Semua parameter opsional; kosong berarti tidak menyaring.
 */
export async function GET(request: NextRequest) {
  const { filter, invalid } = parseProjectFilter(request.nextUrl.searchParams);

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Nilai filter tidak dikenal: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const projects = await getProjects(filter);
  // `total` dipakai UI untuk menulis "menampilkan X dari Y proyek".
  const total = (await getProjects()).length;

  return NextResponse.json({ projects, count: projects.length, total, filter });
}

/**
 * POST /api/projects — tambah proyek baru.
 * Validasinya memakai aturan yang sama dengan form di browser, jadi kiriman
 * yang melewati form (atau langsung ke API) diperiksa dengan ukuran yang sama.
 */
export async function POST(request: NextRequest) {
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
  const errors = validateDraft(draft, users.map((u) => u.id));

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Data proyek belum valid.", errors }, { status: 400 });
  }

  const project = await createProject(draftToProject(draft));
  return NextResponse.json({ project }, { status: 201 });
}
