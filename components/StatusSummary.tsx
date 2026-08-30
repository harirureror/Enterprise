import Badge from "@/components/Badge";
import type { ProjectSummary } from "@/lib/summary";
import { PROJECT_STATUSES } from "@/lib/types";
import { formatCurrencyShort, statusClass } from "@/lib/ui";
import StatCard from "./StatCard";

/* Angkanya dihitung di `lib/summary.ts` — komponen ini cuma menampilkan,
   jadi kartu dan endpoint /api/projects/summary tidak bisa beda hasil.

   Dulu isinya empat kartu dengan dua status pilihan. Dengan enam tahap,
   memilih dua status jadi menyesatkan: yang ditampilkan sekarang adalah
   ringkasan (aktif vs selesai) plus baris chip berisi seluruh tahap. */
export default function StatusSummary({ summary }: { summary: ProjectSummary }) {
  const { total, byStatus, highPriorityActive, pipelineValue, completedValue, valueMissing } =
    summary;

  const selesai = byStatus.Selesai;
  const aktif = total - selesai;

  function porsi(part: number): string {
    return total === 0 ? "0% dari total" : `${Math.round((part / total) * 100)}% dari total`;
  }

  return (
    <section aria-label="Ringkasan proyek" className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Proyek" value={total} hint="Seluruh proyek divisi" />
        <StatCard label="Aktif" value={aktif} hint={porsi(aktif)} accent="text-accent" />
        <StatCard label="Selesai" value={selesai} hint={porsi(selesai)} accent="text-low" />
        <StatCard
          label="Nilai Pipeline"
          value={formatCurrencyShort(pipelineValue)}
          hint={
            valueMissing > 0
              ? `${valueMissing} proyek aktif belum ada nilainya`
              : "Seluruh proyek aktif sudah bernilai"
          }
        />
        <StatCard
          label="Nilai Selesai"
          value={formatCurrencyShort(completedValue)}
          hint="Proyek yang sudah rampung"
          accent="text-low"
        />
        <StatCard
          label="Prioritas Tinggi"
          value={highPriorityActive}
          hint="Masih berjalan"
          accent="text-high"
          danger
        />
      </div>

      {/* Sebaran seluruh tahap — supaya Penawaran/Negosiasi/Tertunda ikut terlihat,
          bukan cuma tersimpan di data. */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <p className="text-label-caps font-bold text-muted uppercase">Tahap Pipeline</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PROJECT_STATUSES.map((s) => (
            <li key={s}>
              <Badge className={statusClass[s]}>
                {s} <span className="ml-1 font-semibold tabular-nums">{byStatus[s]}</span>
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
