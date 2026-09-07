"use client";

import type { RentangAgenda, SkalaAgenda, SkalaPreset } from "@/lib/agenda";
import { formatDate } from "@/lib/ui";

/* Pemilih periode papan agenda.

   Seluruh preset disejajarkan kalender — "1 Bulan" berarti September, bukan
   tiga puluh hari dari hari ini — supaya "Berikutnya" berarti Oktober dan
   bukan mendarat di tengah bulan. */

const PRESET: { nilai: SkalaPreset; label: string }[] = [
  { nilai: "minggu", label: "1 Minggu" },
  { nilai: "2minggu", label: "2 Minggu" },
  { nilai: "bulan", label: "1 Bulan" },
  { nilai: "3bulan", label: "3 Bulan" },
  { nilai: "tahun", label: "1 Tahun" },
];

const fieldClass =
  "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function AgendaScale({
  skala,
  rentang,
  khusus,
  bergeser,
  onSkala,
  onKhusus,
  onGeser,
  onSekarang,
}: {
  skala: SkalaAgenda;
  rentang: RentangAgenda;
  /** Isi kedua kolom tanggal rentang khusus. */
  khusus: { start: string; end: string };
  /** Sedang tidak berada di periode yang memuat hari ini. */
  bergeser: boolean;
  onSkala: (s: SkalaPreset) => void;
  onKhusus: (start: string, end: string) => void;
  onGeser: (arah: number) => void;
  onSekarang: () => void;
}) {
  return (
    <div className="grid gap-3">
      <div
        role="group"
        aria-label="Periode tampilan"
        className="flex flex-wrap items-center gap-1.5"
      >
        {PRESET.map(({ nilai, label }) => (
          <button
            key={nilai}
            type="button"
            aria-pressed={skala === nilai}
            onClick={() => onSkala(nilai)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              skala === nilai
                ? "bg-foreground font-medium text-background"
                : "border border-border text-muted hover:bg-surface"
            }`}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          aria-pressed={skala === "khusus"}
          onClick={() => onKhusus(khusus.start, khusus.end)}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            skala === "khusus"
              ? "bg-foreground font-medium text-background"
              : "border border-border text-muted hover:bg-surface"
          }`}
        >
          Khusus
        </button>
      </div>

      {skala === "khusus" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-xs text-muted">Dari</span>
            <input
              type="date"
              value={khusus.start}
              onChange={(e) => onKhusus(e.target.value, khusus.end)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted">Sampai</span>
            <input
              type="date"
              value={khusus.end}
              // Peramban sendiri menahan tanggal akhir yang mendahului awalnya;
              // rentangKhusus() tetap menjepitnya lagi kalau toh lolos.
              min={khusus.start || undefined}
              onChange={(e) => onKhusus(khusus.start, e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onGeser(-1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface"
        >
          ← Sebelumnya
        </button>
        <span className="text-sm font-medium">
          {formatDate(rentang.start)} – {formatDate(rentang.end)}
          <span className="ml-2 font-normal text-muted">({rentang.totalDays} hari)</span>
        </span>
        <button
          type="button"
          onClick={() => onGeser(1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface"
        >
          Berikutnya →
        </button>
        {bergeser && (
          <button
            type="button"
            onClick={onSekarang}
            className="rounded-lg px-2 py-1.5 text-sm text-muted underline hover:text-foreground"
          >
            Kembali ke hari ini
          </button>
        )}
      </div>
    </div>
  );
}
