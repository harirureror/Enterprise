import { NextResponse } from "next/server";
import { getTeam } from "@/lib/api";
import { jagaRute } from "@/lib/api-guard";

/**
 * GET /api/users — direktori anggota beserta jumlah proyeknya (PRD bagian 7).
 *
 * Sengaja ringan: hanya identitas dan hitungan, tanpa daftar proyek lengkap.
 * Yang butuh beban kerja rinci memakai GET /api/team; ini untuk mengisi
 * dropdown, pemilih PIC, dan sejenisnya tanpa menyeret data proyek.
 */
export async function GET() {
  const izin = await jagaRute("lihat-tim");
  if (!izin.ok) return izin.response;

  const team = await getTeam();

  const users = team
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.user.role,
      avatarUrl: m.user.avatarUrl,
      projects: {
        total: m.projects.length,
        active: m.activeCount,
        done: m.doneCount,
        overdue: m.overdue,
      },
    }))
    // Direktori diurutkan menurut nama supaya stabil dan mudah dicari;
    // urutan "paling padat" adalah urusan /api/team.
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  return NextResponse.json({
    users,
    count: users.length,
    /** Jumlah anggota yang sedang tidak memegang proyek aktif. */
    idle: users.filter((u) => u.projects.active === 0).length,
  });
}
