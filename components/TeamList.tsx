import Link from "next/link";
import Badge from "@/components/Badge";
import type { TeamMember } from "@/lib/api";
import { deadlineLabel, formatCurrencyShort, priorityClass, statusClass } from "@/lib/ui";

/* Daftar beban kerja per anggota. Angkanya diturunkan dari proyek, jadi tidak
   ada yang perlu diperbarui manual saat proyek berpindah tangan. */

/** Inisial dipakai sebagai avatar sementara — `avatarUrl` masih null semua. */
function inisial(nama: string): string {
  return nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function TeamList({ members }: { members: TeamMember[] }) {
  if (members.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
        Belum ada anggota tim yang terdaftar.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {members.map((m) => (
        <li
          key={m.user.id}
          className={`rounded-xl border bg-surface p-5 shadow-card ${
            m.overdue > 0 ? "border-high/30" : "border-border"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold text-muted ring-1 ring-border"
              >
                {inisial(m.user.name)}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">
                  <Link href={`/tim/${m.user.id}`} className="hover:underline">
                    {m.user.name}
                  </Link>
                </h3>
                <p className="text-xs text-muted">{m.user.role}</p>
                <a
                  href={`mailto:${m.user.email}`}
                  className="text-xs text-muted break-all hover:underline"
                >
                  {m.user.email}
                </a>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {m.overdue > 0 && (
                <Badge className="bg-high/10 text-high ring-1 ring-high/20">
                  {m.overdue} telat
                </Badge>
              )}
              {m.clashPairs > 0 && (
                <Badge className="bg-med/10 text-med ring-1 ring-med/20">
                  {m.clashPairs} bentrok
                </Badge>
              )}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Aktif</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{m.activeCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Selesai</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{m.doneCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Nilai aktif</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {formatCurrencyShort(m.pipelineValue)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tenggat terdekat</dt>
              <dd className="mt-0.5 font-medium">
                {m.nextDeadline ? deadlineLabel(m.nextDeadline) : "—"}
              </dd>
            </div>
          </dl>

          {m.projects.length === 0 ? (
            <p className="mt-4 border-t border-border pt-3 text-sm text-muted">
              Belum memegang proyek apa pun.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 border-t border-border pt-3">
              {m.projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/proyek/${p.id}`}
                    className="min-w-0 flex-1 truncate text-sm hover:underline"
                    title={p.name}
                  >
                    {p.name}
                  </Link>
                  <span className="flex shrink-0 gap-1.5">
                    <Badge className={statusClass[p.status]}>{p.status}</Badge>
                    <Badge className={priorityClass[p.priority]}>{p.priority}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
