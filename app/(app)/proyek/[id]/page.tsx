import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/Badge";
import CommentThread from "@/components/CommentThread";
import DependencyPicker from "@/components/DependencyPicker";
import ProgressForm from "@/components/ProgressForm";
import ProgressHistory from "@/components/ProgressHistory";
import ProjectStatusControl from "@/components/ProjectStatusControl";
import ReminderForm from "@/components/ReminderForm";
import ReminderScheduleForm from "@/components/ReminderScheduleForm";
import ReminderStatusStrip from "@/components/ReminderStatusStrip";
import { getProjectDetail } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { can, canEditProject } from "@/lib/permissions";
import { formatMarginPct, projectMargin } from "@/lib/finance";
import { SCORE_MAX } from "@/lib/priority";
import { isActiveStatus } from "@/lib/types";
import {
  deadlineLabel,
  daysUntil,
  formatCurrency,
  formatDate,
  priorityClass,
  statusClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/proyek/[id]">) {
  const detail = await getProjectDetail(Number((await params).id));
  if (!detail) return { title: "Proyek tidak ditemukan — Divisi Enterprise JSI" };

  return {
    title: `${detail.project.name} — Divisi Enterprise JSI`,
    description: detail.project.description,
  };
}

export default async function DetailProyekPage({ params }: PageProps<"/proyek/[id]">) {
  const pengguna = await requireAbility("lihat-detail");

  const { id } = await params;
  // Id non-angka ("abc") ikut jatuh ke notFound lewat NaN.
  const detail = await getProjectDetail(Number(id));
  if (!detail) notFound();

  const {
    project,
    owner,
    conflicts,
    history,
    priority,
    reminders,
    schedule,
    reminderStatus,
    comments,
    dependencies,
    dependencyCandidates,
  } =
    detail;
  /* Hak dihitung sekali di server. Menyembunyikan tombol bukan kontrol
     keamanan — server action punya penjaganya sendiri — tapi menampilkan
     tombol yang pasti ditolak itu menyesatkan. */
  const bolehUbah = canEditProject(pengguna, project);
  const bolehKeuangan = can(pengguna.accessLevel, "lihat-keuangan");
  const bolehKolaborasi = can(pengguna.accessLevel, "kolaborasi");

  // Tanggal acuan ditentukan server supaya validasi klien tidak beda gara-gara zona waktu.
  const hariIni = new Date().toISOString().slice(0, 10);
  const aktif = isActiveStatus(project.status);
  const sisa = daysUntil(project.deadline);
  const telat = aktif && sisa < 0;
  const bentrokPIC = conflicts.filter((c) => c.sameOwner);
  const untung = projectMargin(project);

  return (
    <div className="w-full">
      <header>
        <Link href="/proyek" className="text-sm text-muted hover:text-foreground">
          ← Kembali ke daftar proyek
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-headline-lg font-semibold">{project.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{project.description}</p>
          </div>
          <span className="text-sm text-muted">
            Diperbarui {formatDate(project.updatedAt)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className={statusClass[project.status]}>{project.status}</Badge>
          <Badge className={priorityClass[project.priority]}>Prioritas {project.priority}</Badge>
          <Badge className="text-muted ring-1 ring-border">{project.type}</Badge>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section
          aria-labelledby="progres-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2"
        >
          <div className="flex items-baseline justify-between">
            <h2 id="progres-heading" className="text-headline-sm font-semibold">
              Progres
            </h2>
            <span className="text-headline-sm font-semibold tabular-nums">
              {project.progressPct}%
            </span>
          </div>

          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-border/70"
            role="progressbar"
            aria-valuenow={project.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progres ${project.name}`}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${project.progressPct}%` }}
            />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Mulai</dt>
              <dd className="mt-0.5 font-medium">{formatDate(project.startDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tenggat</dt>
              <dd className="mt-0.5 font-medium">{formatDate(project.deadline)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Sisa waktu</dt>
              <dd className={`mt-0.5 font-medium ${telat ? "text-high" : ""}`}>
                {aktif ? deadlineLabel(project.deadline) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Durasi</dt>
              <dd className="mt-0.5 font-medium">
                {daysUntil(project.deadline, project.startDate) + 1} hari
              </dd>
            </div>
          </dl>

          {bolehUbah && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Catat progres</h3>
              <p className="mt-0.5 text-xs text-muted">
                Setiap pembaruan tersimpan di riwayat sebagai jejak audit.
              </p>
              <div className="mt-3">
                <ProgressForm projectId={project.id} current={project.progressPct} />
              </div>
            </div>
          )}
        </section>

        <section
          aria-labelledby="skor-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="skor-heading" className="text-headline-sm font-semibold">
              Skor Prioritas
            </h2>
            <span className="text-headline-sm font-semibold tabular-nums">
              {priority.score.toFixed(2)}
              <span className="text-sm font-normal text-muted"> / {SCORE_MAX}</span>
            </span>
          </div>

          <p className="mt-1 text-sm text-muted">
            {project.priorityMode === "auto" ? (
              <>
                Dihitung otomatis &rarr; <span className="font-medium text-foreground">{priority.level}</span>
              </>
            ) : (
              <>
                Prioritas dikunci manual di{" "}
                <span className="font-medium text-foreground">{project.priority}</span>; saran
                sistem <span className="font-medium text-foreground">{priority.level}</span>.
              </>
            )}
          </p>

          {/* Rincian enam parameter kesepakatan tim: skor 1-5 dikali bobotnya.
             Ditampilkan utuh supaya angka totalnya bisa ditelusuri, bukan diterima
             begitu saja. */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Rincian skor prioritas per parameter
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th scope="col" className="pb-2 font-medium">
                    Parameter
                  </th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    Skor
                  </th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    Bobot
                  </th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    Kontribusi
                  </th>
                </tr>
              </thead>
              <tbody>
                {priority.factors.map((f) => (
                  <tr key={f.key} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <span className="block">{f.label}</span>
                      <span className="block text-xs text-muted">{f.reason}</span>
                    </th>
                    <td className="py-2 pl-3 text-right tabular-nums">{f.score}</td>
                    <td className="py-2 pl-3 text-right tabular-nums text-muted">
                      {Math.round(f.weight * 100)}%
                    </td>
                    <td className="py-2 pl-3 text-right font-medium tabular-nums">
                      {f.contribution.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <th scope="row" className="pt-2 text-left font-medium">
                    Total
                  </th>
                  <td />
                  <td className="pt-2 pl-3 text-right text-xs tabular-nums text-muted">
                    {Math.round(priority.factors.reduce((n, f) => n + f.weight, 0) * 100)}%
                  </td>
                  <td className="pt-2 pl-3 text-right font-semibold tabular-nums">
                    {priority.score.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="status-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2"
        >
          <h2 id="status-heading" className="text-headline-sm font-semibold">
            Status
          </h2>
          <p className="mt-1 text-sm text-muted">
            Alur pipeline-nya Prospect → Penawaran → Negosiasi → Berjalan → Selesai;
            <span className="text-high"> Tertunda</span> dipakai kalau proyek diparkir
            sementara dan tetap dihitung aktif. Mengubah status tidak mengubah persentase
            progres.
          </p>
          <div className="mt-3">
            {bolehUbah ? (
              <ProjectStatusControl projectId={project.id} status={project.status} />
            ) : (
              <p className="text-sm text-muted">
                Status hanya bisa diubah PIC proyek ini atau Manager.
              </p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="ketergantungan-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2"
        >
          <h2 id="ketergantungan-heading" className="text-headline-sm font-semibold">
            Ketergantungan
          </h2>
          <p className="mt-1 text-sm text-muted">
            Centang proyek yang <em>tidak bisa jalan</em> sebelum proyek ini beres. Makin
            banyak yang tertahan, makin tinggi skor prioritasnya — parameter ini berbobot
            10%. Dua proyek tidak boleh saling menahan.
          </p>
          <div className="mt-3">
            {bolehUbah ? (
              <DependencyPicker
                projectId={project.id}
                candidates={dependencyCandidates}
                blocking={dependencies.blocking}
                blockedBy={dependencies.blockedBy}
              />
            ) : (
              <p className="text-sm text-muted">
                {dependencies.blocking.length === 0
                  ? "Proyek ini tidak menahan proyek lain."
                  : `Menahan: ${dependencies.blocking.map((p) => p.name).join(", ")}.`}
              </p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="pic-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card"
        >
          <h2 id="pic-heading" className="text-headline-sm font-semibold">
            Penanggung Jawab
          </h2>
          {owner ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Nama</dt>
                <dd className="mt-0.5 font-medium">{owner.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Peran</dt>
                <dd className="mt-0.5">{owner.role}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Email</dt>
                <dd className="mt-0.5 break-all">{owner.email}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">Belum ada PIC yang ditugaskan.</p>
          )}
        </section>

        <section
          aria-labelledby="klien-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-3"
        >
          <h2 id="klien-heading" className="text-headline-sm font-semibold">
            Klien
          </h2>
          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Instansi</dt>
              <dd className="mt-0.5 font-medium">{project.clientOrg || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">PIC klien</dt>
              <dd className="mt-0.5 font-medium">{project.clientName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Email</dt>
              <dd className="mt-0.5 break-all">
                {project.clientEmail ? (
                  <a className="font-medium hover:underline" href={`mailto:${project.clientEmail}`}>
                    {project.clientEmail}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Telepon</dt>
              <dd className="mt-0.5">
                {project.clientPhone ? (
                  // Spasi dan tanda hubung dibuang supaya tel: bisa langsung dipanggil.
                  <a
                    className="font-medium hover:underline"
                    href={`tel:${project.clientPhone.replace(/[^0-9+]/g, "")}`}
                  >
                    {project.clientPhone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tingkat kemitraan</dt>
              <dd className="mt-0.5 font-medium">{project.clientTier}</dd>
            </div>
          </dl>
        </section>

        {bolehKeuangan && (
        <section
          aria-labelledby="kontrak-heading"
          className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-3"
        >
          <h2 id="kontrak-heading" className="text-headline-sm font-semibold">
            Kontrak &amp; Keuangan
          </h2>

          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">No kontrak</dt>
              <dd className="mt-0.5 font-medium">
                {project.contractNo || <span className="font-normal text-muted">belum ada</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tanggal kontrak</dt>
              <dd className="mt-0.5 font-medium">
                {project.contractDate ? (
                  formatDate(project.contractDate)
                ) : (
                  <span className="font-normal text-muted">belum diteken</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Nilai kontrak</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {formatCurrency(project.value)}
                {project.value === null && (
                  <span className="ml-1 font-normal text-muted">belum ditentukan</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Type tax</dt>
              <dd className="mt-0.5 font-medium">{project.taxType}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">TOP</dt>
              <dd className="mt-0.5 font-medium">
                {project.paymentTerm}
                {project.paymentNote && (
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {project.paymentNote}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Sales fee</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {formatCurrency(project.salesFee)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Cost operasional</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {formatCurrency(project.operationalCost)}
              </dd>
            </div>
          </dl>

          {/* Margin tidak disimpan sebagai kolom: ia turunan dari empat angka di
             atas. Rinciannya dibuka supaya angkanya bisa ditelusuri, bukan
             diterima begitu saja. */}
          <div className="mt-4 border-t border-border pt-4">
            {untung === null ? (
              <p className="text-sm text-muted">
                Margin belum bisa dihitung — nilai kontraknya belum ada.
              </p>
            ) : (
              <>
                <dl className="grid gap-2 text-sm sm:max-w-md">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">
                      {project.taxType === "PKP" ? "Pendapatan (DPP)" : "Pendapatan"}
                    </dt>
                    <dd className="tabular-nums">{formatCurrency(untung.revenueBase)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Sales fee</dt>
                    <dd className="tabular-nums">−{formatCurrency(untung.salesFee)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Cost operasional</dt>
                    <dd className="tabular-nums">−{formatCurrency(untung.operationalCost)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                    <dt className="font-medium">Margin</dt>
                    <dd
                      className={`font-semibold tabular-nums ${
                        untung.margin < 0 ? "text-high" : ""
                      }`}
                    >
                      {formatCurrency(untung.margin)}
                      <span className="ml-1 font-normal text-muted">
                        ({formatMarginPct(untung.marginPct)})
                      </span>
                    </dd>
                  </div>
                </dl>

                <p className="mt-2 text-xs text-muted">
                  {project.taxType === "PKP" &&
                    "Nilai kontrak dianggap sudah termasuk PPN, jadi PPN dikeluarkan lebih dulu. "}
                  {untung.incomplete && "Masih estimasi — ada komponen biaya yang belum diisi. "}
                  {untung.margin < 0 && "Biaya melampaui pendapatan: proyek ini rugi."}
                </p>
              </>
            )}
          </div>
        </section>
        )}
      </div>

      <section aria-labelledby="pengingat-heading" className="mt-6">
        <h2 id="pengingat-heading" className="text-headline-sm font-semibold">
          Kirim Pengingat
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Pengingat tercatat di aplikasi dan ditujukan ke PIC proyek ini. Pengiriman lewat
          email menyusul setelah layanan surel terpasang.
        </p>
        <div className="mt-3">
          <ReminderStatusStrip status={reminderStatus} />
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {bolehKolaborasi && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
              <ReminderForm projectId={project.id} ownerName={owner?.name ?? "PIC proyek"} />
            </div>
          )}

          {bolehUbah && (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
            <h3 className="text-sm font-medium">Jadwal Berulang</h3>
            <p className="mt-0.5 mb-3 text-xs text-muted">
              Pengingat dikirim otomatis pada tanggal yang dijadwalkan.
            </p>
            <ReminderScheduleForm
              projectId={project.id}
              schedule={schedule}
              today={hariIni}
            />
          </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-medium">Sudah Dikirim</h3>
            {reminders.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Belum ada pengingat untuk proyek ini.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {reminders.map((r) => (
                  <li key={r.id} className="border-l-2 border-border pl-3">
                    <p className="text-sm">{r.message}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.from?.name ?? "—"} → {r.to?.name ?? "—"} · {formatDate(r.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="riwayat-heading" className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="riwayat-heading" className="text-headline-sm font-semibold">
            Riwayat Progres
          </h2>
          {history.length > 0 && (
            <span className="text-sm text-muted">
              {history.length} catatan · terakhir {formatDate(history[0].createdAt)}
            </span>
          )}
        </div>
        <div className="mt-3">
          <ProgressHistory entries={history} />
        </div>
      </section>

      <section aria-labelledby="komentar-heading" className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="komentar-heading" className="text-headline-sm font-semibold">
            Diskusi
          </h2>
          <span className="text-sm text-muted">
            {comments.length} komentar
          </span>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-surface p-5 shadow-card">
          <CommentThread
            projectId={project.id}
            comments={comments}
            currentUserId={pengguna.id}
            bolehTulis={bolehKolaborasi}
          />
        </div>
      </section>

      <section aria-labelledby="bentrok-heading" className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="bentrok-heading" className="text-headline-sm font-semibold">
            Bentrok Jadwal
          </h2>
          <Link href="/timeline" className="text-sm text-muted hover:text-foreground">
            Lihat di timeline →
          </Link>
        </div>

        {conflicts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
            Jadwal proyek ini tidak beririsan dengan proyek lain.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Beririsan dengan {conflicts.length} proyek lain
              {bentrokPIC.length > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-med">
                    {bentrokPIC.length} di antaranya dipegang PIC yang sama
                  </span>
                </>
              )}
              .
            </p>

            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {conflicts.map((c) => (
                <li
                  key={c.project.id}
                  className={`rounded-xl border bg-surface p-4 shadow-card ${
                    c.sameOwner ? "border-med/30" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/proyek/${c.project.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.project.name}
                    </Link>
                    <Badge className={priorityClass[c.project.priority]}>
                      {c.project.priority}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    PIC {c.owner?.name ?? "—"}
                    {c.sameOwner && <span className="ml-1 text-med">· PIC yang sama</span>}
                  </p>
                  <p className="mt-2 text-sm">
                    Bentrok {formatDate(c.startDate)} – {formatDate(c.endDate)}{" "}
                    <span className="text-muted">({c.days} hari)</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
