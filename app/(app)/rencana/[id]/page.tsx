import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/Badge";
import CommentThread from "@/components/CommentThread";
import PlanProjectPicker from "@/components/PlanProjectPicker";
import PlanProspects from "@/components/PlanProspects";
import PlanSteps from "@/components/PlanSteps";
import { getPlanDetail, getUsers } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { kirimKomentarRencana } from "@/lib/plan-actions";
import { can } from "@/lib/permissions";
import { formatDate, priorityClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const detail = await getPlanDetail(Number((await params).id));
  return { title: detail ? `${detail.plan.title} — Rencana Strategis` : "Rencana tidak ditemukan" };
}

export default async function DetailRencanaPage({ params }: Params) {
  const pengguna = await requireAbility("lihat-rencana");

  const { id } = await params;
  // Id non-angka ("abc") ikut jatuh ke notFound lewat NaN.
  const detail = await getPlanDetail(Number(id));
  if (!detail) notFound();

  const { plan, steps, prospects, projects, projectCandidates, comments } = detail;
  const anggota = await getUsers({ activeOnly: true });

  const bolehUbah = can(pengguna.accessLevel, "kelola-rencana");
  const bolehKolaborasi = can(pengguna.accessLevel, "kolaborasi");
  // Tanggal acuan ditentukan server supaya penanda telat tidak beda zona waktu.
  const hariIni = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full">
      <nav aria-label="Jejak halaman" className="text-sm text-muted">
        <Link href="/rencana" className="hover:underline">
          Rencana Strategis
        </Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{plan.title}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-headline-lg font-semibold">{plan.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {plan.kind} → {plan.goal} · {plan.segment}
            {plan.region && ` · ${plan.region}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge className="text-muted ring-1 ring-border">{plan.status}</Badge>
          <Badge className={priorityClass[plan.priority]}>{plan.priority}</Badge>
          {bolehUbah && (
            <Link
              href={`/rencana/${plan.id}/ubah`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface"
            >
              Ubah Rencana
            </Link>
          )}
        </div>
      </header>

      {plan.perluPerhatian && (
        <p className="mt-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high">
          {plan.progress.telat > 0
            ? `${plan.progress.telat} langkah sudah lewat tenggat.`
            : "Tanggal target rencana ini sudah lewat."}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section
          aria-labelledby="ringkas-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2"
        >
          <h2 id="ringkas-heading" className="text-headline-sm font-semibold">
            Uraian
          </h2>
          <p className="mt-2 text-sm">
            {plan.summary || <span className="text-muted">Belum ada uraian.</span>}
          </p>

          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Ukuran keberhasilan</h3>
            <p className="mt-1 text-sm">
              {plan.outcome || (
                <span className="text-muted">
                  Belum ditetapkan — tanpa ini, keberhasilan hanya bisa ditaksir.
                </span>
              )}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="fakta-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card"
        >
          <h2 id="fakta-heading" className="text-headline-sm font-semibold">
            Ringkasan
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Penanggung jawab</dt>
              <dd className="mt-0.5 font-medium">{plan.owner?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Mitra</dt>
              <dd className="mt-0.5 font-medium">{plan.partner || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Periode</dt>
              <dd className="mt-0.5 font-medium">
                {plan.startDate || plan.targetDate
                  ? `${plan.startDate ? formatDate(plan.startDate) : "—"} s/d ${
                      plan.targetDate ? formatDate(plan.targetDate) : "—"
                    }`
                  : "Belum dijadwalkan"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Progres</dt>
              <dd className="mt-0.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-border/70"
                    role="progressbar"
                    aria-valuenow={plan.progress.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progres rencana"
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${plan.progress.pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {plan.progress.pct}%
                  </span>
                </div>
                <span className="mt-1 block text-xs text-muted">
                  {plan.progress.selesai} dari {plan.progress.total} langkah — dihitung dari
                  langkah, bukan diketik.
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
          <PlanSteps
            planId={plan.id}
            steps={steps}
            owners={anggota}
            bolehUbah={bolehUbah}
            hariIni={hariIni}
          />
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <PlanProspects planId={plan.id} prospects={prospects} bolehUbah={bolehUbah} />
        </section>

        <section
          aria-labelledby="proyek-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-3"
        >
          <h2 id="proyek-heading" className="text-headline-sm font-semibold">
            Proyek yang Lahir dari Rencana Ini
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Menyambungkan niat dengan pelaksanaannya. Menghapus proyek hanya memutus
            kaitannya — rencananya tetap ada.
          </p>
          <div className="mt-3">
            <PlanProjectPicker
              planId={plan.id}
              candidates={projectCandidates}
              selected={projects}
              bolehUbah={bolehUbah}
            />
          </div>
        </section>
      </div>

      <section aria-labelledby="komentar-heading" className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="komentar-heading" className="text-headline-sm font-semibold">
            Diskusi
          </h2>
          <span className="text-sm text-muted">{comments.length} komentar</span>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-surface p-5 shadow-card">
          <CommentThread
            comments={comments}
            currentUserId={pengguna.id}
            onKirim={async (body) => {
              "use server";
              return kirimKomentarRencana(plan.id, { body });
            }}
            bolehTulis={bolehKolaborasi}
          />
        </div>
      </section>
    </div>
  );
}
