import type { Coverage } from "@/lib/strategy";
import { coverageSummary } from "@/lib/strategy";

/* Jangkauan wilayah: mana yang sudah ada proyeknya, mana yang baru dituju.

   Inilah yang menjawab "jangkauan kita bertambah ke mana" tanpa perlu
   menghitung manual dari daftar proyek. */

export default function CoverageSummary({ rows }: { rows: Coverage[] }) {
  const ringkas = coverageSummary(rows);
  const dituju = rows.filter((c) => c.baru);
  const dijangkau = rows.filter((c) => c.projects > 0);

  if (rows.length === 0) {
    return (
      <section
        aria-labelledby="jangkauan-heading"
        className="rounded-xl border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="jangkauan-heading" className="text-headline-sm font-semibold">
          Jangkauan Wilayah
        </h2>
        <p className="mt-2 text-sm text-muted">
          Belum ada wilayah tercatat — isi wilayah sasaran pada rencana untuk mulai
          membandingkannya dengan proyek yang sudah berjalan.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="jangkauan-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="jangkauan-heading" className="text-headline-sm font-semibold">
          Jangkauan Wilayah
        </h2>
        <span className="text-sm text-muted">
          {ringkas.dijangkau} sudah dijangkau · {ringkas.dituju} sedang dituju
        </span>
      </div>

      {dituju.length > 0 && (
        <div className="mt-3">
          <h3 className="text-label-caps text-muted uppercase">Wilayah baru yang dituju</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {dituju.map((c) => (
              <li
                key={c.region}
                className="rounded-lg bg-accent/10 px-2.5 py-1 text-sm text-accent ring-1 ring-accent/20"
              >
                {c.region}
                <span className="ml-1.5 text-xs opacity-80">
                  {c.plans > 0 && `${c.plans} rencana`}
                  {c.plans > 0 && c.prospects > 0 && " · "}
                  {c.prospects > 0 && `${c.prospects} prospek`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-label-caps text-muted uppercase">Sudah ada proyek</h3>
        {dijangkau.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada proyek dengan wilayah terisi.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {dijangkau.map((c) => (
              <li
                key={c.region}
                className="rounded-lg bg-background px-2.5 py-1 text-sm text-muted"
              >
                {c.region}
                <span className="ml-1.5 text-xs">
                  {c.projects} proyek
                  {c.plans > 0 && ` · ${c.plans} rencana`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        Wilayah dicocokkan apa adanya. Kalau satu daerah muncul dua kali dengan ejaan
        berbeda, itu tanda pengisiannya perlu diseragamkan — bukan digabung otomatis
        oleh sistem, yang bisa saja salah menebak.
      </p>
    </section>
  );
}
