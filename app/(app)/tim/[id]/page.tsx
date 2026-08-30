import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/Badge";
import ProjectCard from "@/components/ProjectCard";
import StatCard from "@/components/StatCard";
import { getMemberProfile } from "@/lib/api";
import { deadlineLabel, formatCurrency, formatCurrencyShort, formatDate } from "@/lib/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/tim/[id]">) {
  const profil = await getMemberProfile(Number((await params).id));
  if (!profil) return { title: "Anggota tidak ditemukan — Divisi Enterprise JSI" };

  return {
    title: `${profil.member.user.name} — Divisi Enterprise JSI`,
    description: `Proyek dan beban kerja ${profil.member.user.name}, ${profil.member.user.role}.`,
  };
}

export default async function ProfilAnggotaPage({ params }: PageProps<"/tim/[id]">) {
  const { id } = await params;
  // Id non-angka ("abc") ikut jatuh ke notFound lewat NaN.
  const profil = await getMemberProfile(Number(id));
  if (!profil) notFound();

  const { member, contributions, reminders, clashes } = profil;
  const { user } = member;

  return (
    <div className="w-full">
      <header>
        <Link href="/tim" className="text-sm text-muted hover:text-foreground">
          ← Kembali ke daftar tim
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-headline-lg font-semibold">{user.name}</h1>
            <p className="mt-1 text-sm text-muted">{user.role}</p>
            <a
              href={`mailto:${user.email}`}
              className="text-sm text-muted break-all hover:underline"
            >
              {user.email}
            </a>
          </div>

          <div className="flex flex-wrap justify-end gap-1.5">
            {member.overdue > 0 && (
              <Badge className="bg-high/10 text-high ring-1 ring-high/20">
                {member.overdue} lewat tenggat
              </Badge>
            )}
            {member.clashPairs > 0 && (
              <Badge className="bg-med/10 text-med ring-1 ring-med/20">
                {member.clashPairs} bentrok jadwal
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Proyek Aktif"
          value={member.activeCount}
          hint={`${member.doneCount} sudah selesai`}
          accent="text-accent"
        />
        <StatCard
          label="Prioritas Tinggi"
          value={member.highPriorityActive}
          hint="Masih berjalan"
          accent="text-high"
          danger={member.highPriorityActive > 0}
        />
        <StatCard
          label="Nilai Ditangani"
          value={formatCurrencyShort(member.pipelineValue)}
          hint="Proyek aktif"
        />
        <StatCard
          label="Tenggat Terdekat"
          value={member.nextDeadline ? deadlineLabel(member.nextDeadline) : "—"}
          hint={member.nextDeadline ? formatDate(member.nextDeadline) : "Tidak ada yang berjalan"}
        />
      </div>

      <section aria-labelledby="proyek-anggota" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="proyek-anggota" className="text-headline-sm font-semibold">
            Proyek yang Dipegang
          </h2>
          <span className="text-sm text-muted">{member.projects.length} proyek</span>
        </div>

        {member.projects.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
            Belum memegang proyek apa pun.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {member.projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="kontribusi"
          className="rounded-xl border border-border bg-surface p-5 shadow-card"
        >
          <h2 id="kontribusi" className="text-headline-sm font-semibold">
            Catatan Progres
          </h2>
          <p className="mt-0.5 text-xs text-muted">Pembaruan yang ditulis {user.name}.</p>

          {contributions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Belum pernah mencatat progres.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {contributions.map((e) => (
                <li key={e.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm">
                    {e.note || <span className="text-muted">Tanpa catatan</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(e.createdAt)} · progres jadi {e.progressPct}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="pengingat-diterima"
          className="rounded-xl border border-border bg-surface p-5 shadow-card"
        >
          <h2 id="pengingat-diterima" className="text-headline-sm font-semibold">
            Pengingat Diterima
          </h2>
          <p className="mt-0.5 text-xs text-muted">Pengingat yang ditujukan ke {user.name}.</p>

          {reminders.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Belum ada pengingat.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {reminders.map((r) => (
                <li key={r.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm">{r.message}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    dari {r.from?.name ?? "—"} · {formatDate(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {clashes && clashes.pairs.length > 0 && (
        <section aria-labelledby="bentrok-anggota" className="mt-8">
          <h2 id="bentrok-anggota" className="text-headline-sm font-semibold">
            Bentrok Jadwal Sendiri
          </h2>
          <p className="mt-1 text-sm text-muted">
            Total {clashes.totalDays} hari beririsan — ini yang perlu dibagi ke anggota lain.
          </p>

          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {clashes.pairs.map((pair) => (
              <li
                key={`${pair.a}-${pair.b}`}
                className="rounded-xl border border-med/30 bg-surface p-4 shadow-card"
              >
                <p className="text-sm font-medium">
                  <Link href={`/proyek/${pair.a}`} className="hover:underline">
                    Proyek #{pair.a}
                  </Link>
                  {" dan "}
                  <Link href={`/proyek/${pair.b}`} className="hover:underline">
                    Proyek #{pair.b}
                  </Link>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatDate(pair.startDate)} – {formatDate(pair.endDate)} ({pair.days} hari)
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs text-muted">
        Total nilai proyek aktif: {formatCurrency(member.pipelineValue)}
      </p>
    </div>
  );
}
