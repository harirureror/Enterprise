import Link from "next/link";
import Badge from "@/components/Badge";
import type { FocusItem } from "@/lib/api";
import { SCORE_MAX } from "@/lib/priority";
import { deadlineLabel, formatCurrencyShort, priorityClass, statusClass } from "@/lib/ui";

/* Daftar "kerjakan ini dulu" berdasarkan skor prioritas. Alasannya ikut
   ditampilkan supaya urutannya bisa dipertanggungjawabkan, bukan angka
   yang muncul entah dari mana. */

/** Warna batang skor mengikuti level, jadi sepintas sudah terbaca. */
const barClass: Record<string, string> = {
  Tinggi: "bg-high",
  Sedang: "bg-med",
  Rendah: "bg-muted",
};

export default function FocusList({ items }: { items: FocusItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
        Tidak ada proyek aktif yang perlu difokuskan.
      </p>
    );
  }

  return (
    <ol className="grid gap-3">
      {items.map(({ project, owner, score }, i) => (
        <li
          key={project.id}
          className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-muted"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">
                  <Link href={`/proyek/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {project.clientOrg || "Tanpa instansi"} · PIC {owner?.name ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge className={statusClass[project.status]}>{project.status}</Badge>
              <Badge className={priorityClass[project.priority]}>{project.priority}</Badge>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/70"
              role="img"
              aria-label={`Skor prioritas ${score.score.toFixed(2)} dari ${SCORE_MAX}`}
            >
              <div
                className={`h-full rounded-full ${barClass[score.level]}`}
                // Dibulatkan satu desimal: pembagian pecahan menghasilkan ekor
                // seperti 42.00000000000001 yang bocor ke atribut style.
                style={{ width: `${Math.round((score.score / SCORE_MAX) * 1000) / 10}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
              skor {score.score.toFixed(2)}
            </span>
          </div>

          {/* Tiga penyumbang terbesar sudah cukup menjelaskan; sisanya di halaman detail. */}
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {score.factors.slice(0, 3).map((f) => (
              <li key={f.key}>· {f.reason}</li>
            ))}
          </ul>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
            <div className="flex gap-1">
              <dt>Tenggat:</dt>
              <dd className="text-foreground">{deadlineLabel(project.deadline)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Nilai:</dt>
              <dd className="text-foreground">{formatCurrencyShort(project.value)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Progres:</dt>
              <dd className="text-foreground">{project.progressPct}%</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}
