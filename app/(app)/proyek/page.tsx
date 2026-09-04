import Link from "next/link";
import ProjectTable from "@/components/ProjectTable";
import { getFilterOptions, getProjects, getSummary } from "@/lib/api";
import { SEMUA } from "@/lib/filters";
import { PROJECT_TYPES, type ProjectType } from "@/lib/types";
import { requireAbility } from "@/lib/auth";
import { can } from "@/lib/permissions";

// Daftar harus dirender ulang tiap kunjungan, supaya proyek yang baru
// ditambahkan lewat form langsung terlihat.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daftar Proyek — Divisi Enterprise JSI",
  description: "Kelola seluruh proyek divisi: saring, cari, dan urutkan sesuai kebutuhan.",
};

export default async function ProyekPage({ searchParams }: PageProps<"/proyek">) {
  const pengguna = await requireAbility("lihat-daftar");

  // Sumber data sama dengan GET /api/projects, tanpa lompat HTTP dari server.
  const [projects, options, summary, params] = await Promise.all([
    getProjects(),
    getFilterOptions(),
    getSummary(),
    searchParams,
  ]);

  // ?type= dipakai tautan dari halaman kelola jenis; nilai asing diabaikan.
  const dariUrl = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType = PROJECT_TYPES.includes(dariUrl as ProjectType)
    ? (dariUrl as ProjectType)
    : SEMUA;

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-semibold">Daftar Proyek</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {summary.total} proyek tercatat · {summary.byStatus.Berjalan} sedang berjalan
            {summary.overdue > 0 && ` · ${summary.overdue} lewat tenggat`}
            {summary.dueSoon > 0 && ` · ${summary.dueSoon} jatuh tempo ${summary.dueSoonDays} hari ke depan`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {can(pengguna.accessLevel, "kelola-jenis") && (
            <Link
              href="/proyek/jenis"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface"
            >
              Kelola Jenis
            </Link>
          )}
          {can(pengguna.accessLevel, "buat-proyek") && (
            <Link
              href="/proyek/baru"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
            >
              Tambah Proyek
            </Link>
          )}
        </div>
      </header>

      <div className="mt-6">
        <ProjectTable
          projects={projects}
          options={options}
          initialType={initialType}
          viewer={{ id: pengguna.id, accessLevel: pengguna.accessLevel }}
        />
      </div>
    </div>
  );
}
