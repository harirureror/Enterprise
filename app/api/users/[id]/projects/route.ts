import { type NextRequest, NextResponse } from "next/server";
import { getMemberProfile, getProjects } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { unauthorized } from "@/lib/auth-response";
import { parseProjectFilter } from "@/lib/filters";
import { isActiveStatus } from "@/lib/types";
import { type SortKey, SORT_KEYS, sortProjects } from "@/lib/ui";

/**
 * GET /api/users/{id}/projects?status=&priority=&type=&q=&sort=
 *
 * Proyek satu anggota, bisa disaring dan diurutkan. `ownerId` di query sengaja
 * diabaikan: pemiliknya sudah ditentukan path, dan menerima keduanya hanya
 * membuka peluang jawaban yang tidak sesuai URL-nya.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesi = await requireSession();
  if (!sesi) return unauthorized();

  const { id } = await params;
  const angka = Number(id);
  if (!Number.isInteger(angka) || angka <= 0) {
    return NextResponse.json(
      { error: "Id anggota harus bilangan bulat positif." },
      { status: 400 }
    );
  }

  const profil = await getMemberProfile(angka);
  if (!profil) return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });

  const { filter, invalid } = parseProjectFilter(request.nextUrl.searchParams);

  const sortRaw = request.nextUrl.searchParams.get("sort")?.trim() ?? "";
  if (sortRaw !== "" && !(SORT_KEYS as string[]).includes(sortRaw)) invalid.push("sort");

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Nilai filter tidak dikenal: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  // Pemiliknya ditetapkan dari path, bukan dari query.
  const milik = await getProjects({ ...filter, ownerId: angka });
  const projects = sortProjects(milik, (sortRaw || "prioritas") as SortKey);

  return NextResponse.json({
    user: {
      id: profil.member.user.id,
      name: profil.member.user.name,
      role: profil.member.user.role,
    },
    projects,
    count: projects.length,
    /** Jumlah proyek anggota ini sebelum disaring. */
    total: profil.member.projects.length,
    active: projects.filter((p) => isActiveStatus(p.status)).length,
    sort: sortRaw || "prioritas",
    filter,
  });
}
