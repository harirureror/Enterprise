import Link from "next/link";
import FocusList from "@/components/FocusList";
import ProjectList from "@/components/ProjectList";
import StatusSummary from "@/components/StatusSummary";
import { getFocusProjects, getProjects, getSummary } from "@/lib/api";

export default async function DashboardPage() {
  // Sumber angka sama dengan GET /api/projects/summary, tanpa lompat HTTP dari server.
  const [projects, summary, fokus] = await Promise.all([
    getProjects(),
    getSummary(),
    getFocusProjects(5),
  ]);

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-semibold">Dashboard Proyek</h1>
          <p className="mt-1 text-sm text-muted">
            Divisi Enterprise · Jaya Survei Indonesia
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
