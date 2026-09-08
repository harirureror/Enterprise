"use client";

import { useMemo, useState } from "react";
import {
  type Granularitas,
  type KurvaActivity,
  selisihRencana,
  tabelKurva,
} from "@/lib/schedule-curve";

/* Kurva S berbentuk master schedule.

   Tabelnya dan grafiknya memakai LEBAR KOLOM YANG SAMA dan berada di dalam
   satu penggulung yang sama. Itu satu-satunya cara garisnya benar-benar
   sejajar dengan kolomnya: menumpuk SVG di atas tabel yang lebarnya ditentukan
   isi sel akan meleset begitu ada satu nama aktivitas yang lebih panjang.

   Warnanya var(--muted) dan var(--accent) supaya ikut berganti di mode gelap
   tanpa cabang kode. */

const LEBAR_NAMA = 220;
const LEBAR_BOBOT = 56;
const LEBAR_KOLOM = 64;
const TINGGI = 168;
const ATAS = 10;
const BAWAH = 8;

const PILIHAN: { nilai: Granularitas | "otomatis"; label: string }[] = [
  { nilai: "otomatis", label: "Otomatis" },
  { nilai: "harian", label: "Harian" },
  { nilai: "mingguan", label: "Mingguan" },
  { nilai: "bulanan", label: "Bulanan" },
];

/** Sel kosong ditulis "-", bukan "0,00": tidak ada pekerjaan ≠ nol persen. */
function sel(nilai: number): string {
  return nilai === 0 ? "–" : nilai.toFixed(2);
}

export default function CurvaS({
  activities,
  hariIni,
}: {
  activities: KurvaActivity[];
  /** Tanggal acuan dari server, supaya tidak bergeser karena zona waktu. */
  hariIni: string;
}) {
  const [pilihan, setPilihan] = useState<Granularitas | "otomatis">("otomatis");

  const tabel = useMemo(
    () => tabelKurva(activities, hariIni, pilihan === "otomatis" ? undefined : pilihan),
    [activities, hariIni, pilihan]
  );
  const selisih = useMemo(() => selisihRencana(tabel, hariIni), [tabel, hariIni]);

  if (tabel === null) {
    return (
      <p className="text-sm text-muted">
        Kurva S muncul setelah aktivitas proyek ini punya tanggal mulai dan tanggal target.
      </p>
    );
  }

  const { periode, baris, total, kumulatif, aktualKumulatif, totalBobot } = tabel;

  const lebar = LEBAR_NAMA + LEBAR_BOBOT + periode.length * LEBAR_KOLOM;
  const x = (i: number) => LEBAR_NAMA + LEBAR_BOBOT + i * LEBAR_KOLOM + LEBAR_KOLOM / 2;
  const y = (persen: number) => ATAS + ((100 - persen) / 100) * (TINGGI - ATAS - BAWAH);

  const titikRencana = kumulatif.map((v, i) => `${x(i)},${y(v).toFixed(1)}`).join(" ");
  const titikAktual = aktualKumulatif
    .map((v, i) => (v === null ? null : `${x(i)},${y(v).toFixed(1)}`))
    .filter((p): p is string => p !== null)
    .join(" ");

  const kolomKini = periode.findIndex((p) => p.mulai <= hariIni && hariIni <= p.akhir);

  const keterangan =
    selisih === null
      ? "Belum ada periode yang berjalan, jadi belum ada yang bisa dibandingkan."
      : selisih === 0
        ? "Realisasi pas dengan rencana."
        : selisih > 0
          ? `Mendahului rencana ${selisih}%.`
          : `Tertinggal ${Math.abs(selisih)}% dari rencana.`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm ${selisih !== null && selisih < 0 ? "text-high" : "text-muted"}`}>
            {keterangan}
          </p>
          {totalBobot !== 100 && (
            <p className="mt-0.5 text-xs text-muted">
              Total bobot {totalBobot}%, bukan 100% — seluruh angka dihitung dari total itu.
            </p>
          )}
        </div>

        <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
          Satuan kolom
          <select
            value={pilihan}
            onChange={(e) => setPilihan(e.target.value as Granularitas | "otomatis")}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
          >
            {PILIHAN.map((p) => (
              <option key={p.nilai} value={p.nilai}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div style={{ width: lebar, minWidth: "100%" }}>
          <svg
            viewBox={`0 0 ${lebar} ${TINGGI}`}
            width={lebar}
            height={TINGGI}
            role="img"
            aria-label={`Kurva S. ${keterangan}`}
            className="block"
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line
                  x1={LEBAR_NAMA}
                  x2={lebar}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={LEBAR_NAMA - 6}
                  y={y(v) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--muted)"
                >
                  {v}%
                </text>
              </g>
            ))}

            {kolomKini >= 0 && (
              <line
                x1={x(kolomKini)}
                x2={x(kolomKini)}
                y1={ATAS}
                y2={TINGGI - BAWAH}
                stroke="var(--muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            <polyline points={titikRencana} fill="none" stroke="var(--muted)" strokeWidth={2} />
            {aktualKumulatif.filter((v) => v !== null).length > 1 && (
              <polyline points={titikAktual} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
            )}
            {aktualKumulatif.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--accent)" />
              )
            )}
          </svg>

          <table
            className="w-full border-collapse text-xs tabular-nums"
            style={{ tableLayout: "fixed", width: lebar }}
          >
            <caption className="sr-only">
              Rencana penyerapan bobot per periode, dengan baris total dan kumulatif.
            </caption>
            <colgroup>
              <col style={{ width: LEBAR_NAMA }} />
              <col style={{ width: LEBAR_BOBOT }} />
              {periode.map((p) => (
                <col key={p.kunci} style={{ width: LEBAR_KOLOM }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-y border-border text-muted">
                <th scope="col" className="px-2 py-1.5 text-left font-medium">
                  Aktivitas
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  Bobot
                </th>
                {periode.map((p, i) => (
                  <th
                    key={p.kunci}
                    scope="col"
                    title={`${p.mulai} s.d. ${p.akhir}`}
                    className={`px-1 py-1.5 text-right font-medium ${
                      i === kolomKini ? "text-accent" : ""
                    }`}
                  >
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id} className="border-b border-border/60">
                  <th scope="row" className="truncate px-2 py-1 text-left font-normal" title={b.nama}>
                    {b.nama}
                  </th>
                  <td className="px-2 py-1 text-right text-muted">{b.bobot}</td>
                  {b.perPeriode.map((v, i) => (
                    <td
                      key={periode[i].kunci}
                      className={`px-1 py-1 text-right ${
                        v === 0 ? "text-muted/50" : "bg-accent/10"
                      }`}
                    >
                      {sel(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium">
                <th scope="row" className="px-2 py-1 text-left">
                  TOTAL
                </th>
                <td className="px-2 py-1 text-right">{totalBobot}</td>
                {total.map((v, i) => (
                  <td key={periode[i].kunci} className="px-1 py-1 text-right">
                    {sel(v)}
                  </td>
                ))}
              </tr>
              <tr className="font-medium">
                <th scope="row" className="px-2 py-1 text-left">
                  KUMULATIF
                </th>
                <td className="px-2 py-1 text-right text-muted">100</td>
                {kumulatif.map((v, i) => (
                  <td key={periode[i].kunci} className="px-1 py-1 text-right">
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr className="text-accent">
                <th scope="row" className="px-2 py-1 text-left font-medium">
                  REALISASI
                </th>
                <td className="px-2 py-1 text-right" />
                {aktualKumulatif.map((v, i) => (
                  <td key={periode[i].kunci} className="px-1 py-1 text-right">
                    {v === null ? "" : v.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-muted" aria-hidden />
          Rencana (kumulatif)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-accent" aria-hidden />
          Realisasi, berhenti di periode berjalan
        </span>
      </div>
    </div>
  );
}
