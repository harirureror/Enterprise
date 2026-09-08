import type { Coverage } from "@/lib/strategy";
import { coverageSummary } from "@/lib/strategy";

/* Jangkauan wilayah: mana yang sudah ada proyeknya, mana yang baru dituju.

   Inilah yang menjawab "jangkauan kita bertambah ke mana" tanpa perlu
   menghitung manual dari daftar proyek. */

export default function CoverageSummary({ rows }: { rows: Coverage[] }) {
  const ringkas = coverageSummary(rows);

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

      <p className="mt-1 max-w-2xl text-sm text-muted">
        Wilayah yang sudah ada rencananya tapi belum ada proyeknya diletakkan paling atas —
        itulah yang sedang dituju.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">
            Wilayah terdampak: jumlah proyek berjalan, rencana, dan calon klien di tiap wilayah
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-label-caps text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Wilayah
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Proyek
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Rencana
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Prospek
              </th>
              <th scope="col" className="py-2 font-medium">
                Keterangan
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.region} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {c.region}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{c.projects}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{c.plans}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{c.prospects}</td>
                <td className="py-2">
                  {c.baru ? (
                    <span className="rounded px-1.5 py-0.5 text-xs text-accent ring-1 ring-accent/30">
                      Sedang dituju
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Sudah ada proyek</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ejaan yang berbeda sengaja TIDAK digabung otomatis — itu masalah
          keseragaman pengisian yang perlu terlihat, bukan disembunyikan. */}
      {rows.length > 1 && (
        <p className="mt-3 text-xs text-muted">
          Wilayah dicocokkan apa adanya. Ejaan yang berbeda (mis. &ldquo;Kepri&rdquo; dan
          &ldquo;Kepulauan Riau&rdquo;) tampil sebagai dua baris.
        </p>
      )}

    </section>
  );
}
