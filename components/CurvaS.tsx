import type { TitikKurva } from "@/lib/activities";
import { toDay } from "@/lib/timeline";
import { formatDate } from "@/lib/ui";

/* Kurva S: rencana vs aktual, digambar SVG inline.

   Tanpa pustaka grafik, sejalan dengan TimelineChart yang memakai div
   berposisi. Warnanya var(--accent) dan var(--muted) supaya ikut berganti
   di mode gelap tanpa cabang kode.

   Yang penting dari grafik ini bukan kecantikannya: garis aktual berhenti di
   hari ini, dan garis rencana tidak digambar sama sekali kalau tidak ada
   tanggal target. Grafik yang menerka masa depan lebih buruk daripada grafik
   yang berhenti apa adanya. */

const W = 640;
const H = 260;
const KIRI = 34;
const KANAN = 12;
const ATAS = 12;
const BAWAH = 30;

type Titik = { x: number; y: number };

function polyline(titik: Titik[]): string {
  return titik.map((t) => `${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(" ");
}

export default function CurvaS({
  titik,
  selisih,
  totalBobot,
  hariIni,
}: {
  titik: TitikKurva[];
  /** Positif mendahului rencana, negatif tertinggal, null tanpa rencana. */
  selisih: number | null;
  totalBobot: number;
  hariIni: string;
}) {
  if (titik.length === 0) {
    return (
      <p className="text-sm text-muted">
        Kurva S muncul setelah proyek ini punya daftar aktivitas.
      </p>
    );
  }

  const hari = titik.map((t) => toDay(t.date));
  const mulai = hari[0];
  const akhir = hari[hari.length - 1];
  // Rentang nol hari (semua aktivitas satu tanggal) akan membagi nol; sumbu
  // dipaksa selebar sehari supaya titiknya tetap tergambar di kiri.
  const rentang = Math.max(akhir - mulai, 1);

  const x = (tanggal: string) => KIRI + ((toDay(tanggal) - mulai) / rentang) * (W - KIRI - KANAN);
  const y = (persen: number) => ATAS + ((100 - persen) / 100) * (H - ATAS - BAWAH);

  const garisRencana = titik
    .filter((t): t is TitikKurva & { rencana: number } => t.rencana !== null)
    .map((t) => ({ x: x(t.date), y: y(t.rencana) }));
  const garisAktual = titik
    .filter((t): t is TitikKurva & { aktual: number } => t.aktual !== null)
    .map((t) => ({ x: x(t.date), y: y(t.aktual) }));

  const xHariIni = hariIni >= titik[0].date && hariIni <= titik[titik.length - 1].date
    ? x(hariIni)
    : null;

  const keterangan =
    selisih === null
      ? "Belum ada tanggal target, jadi belum ada garis rencana untuk dibandingkan."
      : selisih === 0
        ? "Progres pas dengan rencana."
        : selisih > 0
          ? `Mendahului rencana ${selisih}%.`
          : `Tertinggal ${Math.abs(selisih)}% dari rencana.`;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className={`text-sm ${selisih !== null && selisih < 0 ? "text-high" : "text-muted"}`}
        >
          {keterangan}
        </p>
        {totalBobot !== 100 && (
          <p className="text-xs text-muted">
            Total bobot {totalBobot}%, bukan 100% — progres dihitung dari total itu.
          </p>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[20rem]"
          role="img"
          aria-label={`Kurva S. ${keterangan}`}
        >
          {[0, 25, 50, 75, 100].map((n) => (
            <g key={n}>
              <line
                x1={KIRI}
                x2={W - KANAN}
                y1={y(n)}
                y2={y(n)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={KIRI - 6}
                y={y(n) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--muted)"
              >
                {n}
              </text>
            </g>
          ))}

          {xHariIni !== null && (
            <line
              x1={xHariIni}
              x2={xHariIni}
              y1={ATAS}
              y2={H - BAWAH}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {garisRencana.length > 1 && (
            <polyline
              points={polyline(garisRencana)}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}

          {garisAktual.length > 1 && (
            <polyline
              points={polyline(garisAktual)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.5}
            />
          )}
          {garisAktual.map((t, i) => (
            <circle key={i} cx={t.x} cy={t.y} r={3} fill="var(--accent)" />
          ))}

          <text x={KIRI} y={H - 8} fontSize={11} fill="var(--muted)">
            {formatDate(titik[0].date)}
          </text>
          {titik.length > 1 && (
            <text x={W - KANAN} y={H - 8} textAnchor="end" fontSize={11} fill="var(--muted)">
              {formatDate(titik[titik.length - 1].date)}
            </text>
          )}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-accent" aria-hidden />
          Aktual (berhenti di hari ini)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-6"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, var(--muted) 0 6px, transparent 6px 10px)",
            }}
            aria-hidden
          />
          Rencana
        </span>
      </div>

      {/* Angka yang sama dalam bentuk yang bisa dibaca pembaca layar dan
          disalin ke tempat lain — grafik saja tidak cukup. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted">Lihat sebagai tabel</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                Tanggal
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Rencana
              </th>
              <th scope="col" className="py-1 font-medium">
                Aktual
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {titik.map((t) => (
              <tr key={t.date} className="border-t border-border">
                <td className="py-1 pr-3">{formatDate(t.date)}</td>
                <td className="py-1 pr-3">{t.rencana === null ? "—" : `${t.rencana}%`}</td>
                <td className="py-1">{t.aktual === null ? "—" : `${t.aktual}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
