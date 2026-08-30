import Link from "next/link";
import Badge from "@/components/Badge";
import { getTypeBreakdown } from "@/lib/api";
import { formatDate, statusClass } from "@/lib/ui";
import { PROJECT_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kelola Jenis Proyek — Divisi Enterprise JSI",
  description: "Sebaran dan beban kerja tiap kategori proyek divisi Enterprise.",
};

export default async function JenisProyekPage() {
  const jenis = await getTypeBreakdown();
  const total = jenis.reduce((sum, j) => sum + j.total, 0);

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/proyek" className="text-sm text-muted hover:text-foreground">
            ← Kembali ke daftar proyek
          </Link>
          <h1 className="mt-2 text-headline-lg font-semibold">Kelola Jenis Proyek</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Empat kategori tetap divisi Enterprise: Penjualan, Jasa, Training, dan Riset. Jenis
            dipilih saat membuat atau mengedit proyek — halaman ini memantau sebaran dan beban
            kerjanya.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {jenis.map((j) => {
          const porsi = total === 0 ? 0 : Math.round((j.total / total) * 100);

          return (
            <article
              key={j.type}
              className="rounded-xl border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-headline-sm font-semibold">{j.type}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {j.total} proyek · {porsi}% dari total · {j.owners} anggota
                  </p>
                </div>
                <Link
                  href={`/proyek?type=${encodeURIComponent(j.type)}`}
                  className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
                >
                  Lihat proyek
                  <span className="sr-only"> jenis {j.type}</span>
                </Link>
              </div>

              {j.total === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  Belum ada proyek berjenis ini.
                </p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {PROJECT_STATUSES.map((s) => (
                      <Badge key={s} className={statusClass[s]}>
                        {s}: {j.byStatus[s]}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Rata-rata progres</span>
                      <span className="tabular-nums">{j.avgProgress}%</span>
                    </div>
                    <div
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border/70"
                      role="progressbar"
                      aria-valuenow={j.avgProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Rata-rata progres proyek ${j.type}`}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${j.avgProgress}%` }}
                      />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted">Prioritas tinggi</dt>
                      <dd className={j.highPriorityActive > 0 ? "font-medium text-high" : "font-medium"}>
                        {j.highPriorityActive}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Lewat tenggat</dt>
                      <dd className={j.overdue > 0 ? "font-medium text-high" : "font-medium"}>
                        {j.overdue}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Segera jatuh tempo</dt>
                      <dd className={j.dueSoon > 0 ? "font-medium text-med" : "font-medium"}>
                        {j.dueSoon}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Tenggat terdekat</dt>
                      <dd className="font-medium">
                        {j.nextDeadline ? formatDate(j.nextDeadline) : "—"}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
