import { toDay } from "./timeline";
import type { Project, ProjectPriority, ProjectStatus, ProjectType } from "./types";

/* Chip mengikuti "Enterprise Precision": latar tipis + teks berwarna + garis 1px.
   Warna diambil dari token tema, jadi mode gelap ikut otomatis. */

/* Enam tahap butuh enam warna yang bisa dibedakan sekali lihat. Semuanya pakai
   ring, bukan border, supaya tinggi chip tetap sama — border ikut menambah
   ukuran kotak sedangkan ring tidak. */
export const statusClass: Record<ProjectStatus, string> = {
  Prospect: "bg-foreground/5 text-muted ring-1 ring-border",
  Penawaran: "bg-stage/10 text-stage ring-1 ring-stage/20",
  Negosiasi: "bg-med/10 text-med ring-1 ring-med/20",
  Berjalan: "bg-accent/10 text-accent ring-1 ring-accent/20",
  // Diparkir = butuh perhatian, jadi diberi warna peringatan.
  Tertunda: "bg-high/10 text-high ring-1 ring-high/20",
  Selesai: "bg-low/10 text-low ring-1 ring-low/20",
};

export const priorityClass: Record<ProjectPriority, string> = {
  Tinggi: "bg-high/10 text-high ring-1 ring-high/20",
  Sedang: "bg-med/10 text-med ring-1 ring-med/20",
  Rendah: "bg-foreground/5 text-muted ring-1 ring-border",
};

/** Jenis proyek dibedakan lewat teks, bukan warna — tabel Stitch sengaja tenang. */
export const typeClass: Record<ProjectType, string> = {
  Penjualan: "text-muted ring-1 ring-border",
  Jasa: "text-muted ring-1 ring-border",
  Training: "text-muted ring-1 ring-border",
  Riset: "text-muted ring-1 ring-border",
};

/** Urutan tampil: prioritas tinggi selalu di atas. */
export const priorityRank: Record<ProjectPriority, number> = {
  Tinggi: 0,
  Sedang: 1,
  Rendah: 2,
};

/** Prioritas tinggi di atas, lalu tenggat terdekat. Tidak mengubah array asal. */
export function sortByPriority(list: Project[]): Project[] {
  return [...list].sort(
    (a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority] ||
      a.deadline.localeCompare(b.deadline)
  );
}

export type SortKey = "prioritas" | "tenggat" | "progres" | "terbaru";

export const SORT_LABELS: Record<SortKey, string> = {
  prioritas: "Prioritas tertinggi",
  tenggat: "Tenggat terdekat",
  progres: "Progres terendah",
  terbaru: "Terakhir diperbarui",
};

export const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

/** Urutan daftar proyek. Tidak mengubah array asal; id jadi penentu terakhir
    supaya urutannya tetap sama di server dan di klien. */
export function sortProjects(list: Project[], key: SortKey): Project[] {
  if (key === "prioritas") return sortByPriority(list);

  const banding: Record<Exclude<SortKey, "prioritas">, (a: Project, b: Project) => number> = {
    tenggat: (a, b) => a.deadline.localeCompare(b.deadline),
    // Yang paling tertinggal muncul lebih dulu supaya gampang ditindaklanjuti.
    progres: (a, b) => a.progressPct - b.progressPct,
    terbaru: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };

  return [...list].sort((a, b) => banding[key](a, b) || a.id - b.id);
}

/**
 * Sisa hari sampai tenggat, dihitung dari `today` (default hari ini).
 * Negatif berarti sudah lewat; 0 berarti jatuh tempo hari ini.
 */
export function daysUntil(deadline: string, today?: string): number {
  return toDay(deadline) - toDay(today ?? new Date().toISOString().slice(0, 10));
}

/** Kalimat singkat status tenggat, mis. "3 hari lagi" atau "telat 2 hari". */
export function deadlineLabel(deadline: string, today?: string): string {
  const sisa = daysUntil(deadline, today);
  if (sisa < 0) return `telat ${Math.abs(sisa)} hari`;
  if (sisa === 0) return "jatuh tempo hari ini";
  return `${sisa} hari lagi`;
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/* Bentuk ringkas untuk kartu ringkasan: "Rp 1,9 M" ketimbang "Rp 1.850.000.000",
   supaya angka besar tidak memaksa kartunya melebar. */
const rupiahRingkas = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Nilai proyek lengkap. `null` berarti angkanya memang belum ada. */
export function formatCurrency(value: number | null): string {
  return value === null ? "—" : rupiah.format(value);
}

export function formatCurrencyShort(value: number | null): string {
  return value === null ? "—" : rupiahRingkas.format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
