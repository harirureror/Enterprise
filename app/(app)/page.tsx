import Link from "next/link";
import FocusList from "@/components/FocusList";
import ProjectList from "@/components/ProjectList";
import StatusSummary from "@/components/StatusSummary";
import { getFocusProjects, getProjects, getSummary } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { deadlineLabel, sortByPriority } from "@/lib/ui";
import Badge from "@/components/Badge";
import { priorityClass, statusClass } from "@/lib/ui";

export default async function DashboardPage() {
  const pengguna = await requireAbility("lihat-overview");

  // Sumber angka sama dengan GET /api/projects/summary, tanpa lompat HTTP dari server.
  const [projects, summary, fokus] = await Promise.all([
    getProjects(),
    getSummary(),
    getFocusProjects(5),
  ]);

  /* Anggota melihat seluruh daftar sama seperti yang lain, tapi yang paling
     dia butuhkan adalah miliknya sendiri — jadi itu yang naik ke atas.
     Manager dan Admin mengurus semua proyek, jadi blok ini tidak berguna
     buat mereka dan hanya akan menambah gulir. */
  const proyekSaya = can(pengguna.accessLevel, "ubah-semua-proyek")
    ? []
    : sortByPriority(projects.filter((p) => p.ownerId === pengguna.id));

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-semibold">Dashboard Proyek</h1>
          <p className="mt-1 text-sm text-muted">
            {pengguna.name} · {pengguna.accessLevel} · Divisi Enterprise
          </p>
        </div>
        <Link
          href="/timeline"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
        >
          Lihat Timeline
        </Link>
      </header>

      <div className="mt-6">
        <StatusSummary summary={summary} />
      </div>

      {proyekSaya.length > 0 && (
        <section aria-labelledby="saya-heading" className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="saya-heading" className="text-headline-sm font-semibold">
              Proyek Saya
            </h2>
            <span className="text-sm text-muted">
              {proyekSaya.length} proyek yang Anda pegang
            </span>
          </div>
          <ul className="mt-4 grid gap-3">
            {proyekSaya.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug">
                      <Link href={`/proyek/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {p.clientOrg || "Tanpa instansi"} · {deadlineLabel(p.deadline)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className={statusClass[p.status]}>{p.status}</Badge>
                    <Badge className={priorityClass[p.priority]}>{p.priority}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-border/70"
                    role="progressbar"
                    aria-valuenow={p.progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progres ${p.name}`}
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {p.progressPct}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="fokus-heading" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="fokus-heading" className="text-headline-sm font-semibold">
            Fokus Hari Ini
          </h2>
          <span className="text-sm text-muted">
            Diurutkan otomatis dari enam parameter prioritas berbobot
          </span>
        </div>
        <div className="mt-4">
          <FocusList items={fokus} />
        </div>
      </section>

      <div className="mt-10">
        <ProjectList projects={projects} />
      </div>
    </div>
  );
}
