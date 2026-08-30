import { toDay } from "./timeline";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  isActiveStatus,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectType,
} from "./types";

/* Hitungan ringkasan dashboard. Fungsi murni supaya bisa dipakai halaman,
   route handler, dan self-check tanpa perlu request HTTP. */

/** Default ambang "segera jatuh tempo": satu minggu ke depan. */
export const DUE_SOON_DAYS = 7;

export type ProjectSummary = {
  total: number;
  byStatus: Record<ProjectStatus, number>;
  byPriority: Record<ProjectPriority, number>;
  byType: Record<ProjectType, number>;
  /** Prioritas tinggi yang belum selesai — ini yang perlu difokuskan lebih dulu. */
  highPriorityActive: number;
  /** Rata-rata progres seluruh proyek, dibulatkan ke persen terdekat. */
  avgProgress: number;
  /** Belum selesai dan tenggatnya sudah lewat. */
  overdue: number;
  /** Belum selesai dan tenggatnya jatuh dalam `dueSoonDays` hari ke depan. */
  dueSoon: number;
  dueSoonDays: number;
  /** Total nilai proyek yang belum selesai — isi pipeline saat ini. */
  pipelineValue: number;
  /** Total nilai proyek yang sudah selesai. */
  completedValue: number;
  /** Proyek aktif yang nilainya belum diisi, jadi pipelineValue belum utuh. */
  valueMissing: number;
  /** Tanggal acuan perhitungan overdue/dueSoon, format ISO YYYY-MM-DD. */
  asOf: string;
};

export type TypeStats = {
  type: ProjectType;
  total: number;
  byStatus: Record<ProjectStatus, number>;
  /** Prioritas tinggi yang belum selesai di jenis ini. */
  highPriorityActive: number;
  avgProgress: number;
  overdue: number;
  dueSoon: number;
  /** Jumlah anggota berbeda yang memegang proyek jenis ini. */
  owners: number;
  /** Tenggat terdekat yang belum selesai; `null` kalau semuanya sudah beres. */
  nextDeadline: string | null;
};

/**
 * Rincian per jenis proyek untuk halaman kelola jenis. Jenis yang belum punya
 * proyek tetap muncul dengan angka nol — supaya kategorinya terlihat lengkap.
 */
export function typeBreakdown(
  projects: Project[],
  options: { today?: string; dueSoonDays?: number } = {}
): TypeStats[] {
  return PROJECT_TYPES.map((type) => {
    const milik = projects.filter((p) => p.type === type);
    const ringkas = projectSummary(milik, options);
    const belumSelesai = milik
      .filter((p) => isActiveStatus(p.status))
      .map((p) => p.deadline)
      .sort();

    return {
      type,
      total: ringkas.total,
      byStatus: ringkas.byStatus,
      highPriorityActive: ringkas.highPriorityActive,
      avgProgress: ringkas.avgProgress,
      overdue: ringkas.overdue,
      dueSoon: ringkas.dueSoon,
      owners: new Set(milik.map((p) => p.ownerId)).size,
      nextDeadline: belumSelesai[0] ?? null,
    };
  });
}

function hitung<K extends string>(keys: K[], pick: (k: K) => number): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, pick(k)])) as Record<K, number>;
}

export function projectSummary(
  projects: Project[],
  options: { today?: string; dueSoonDays?: number } = {}
): ProjectSummary {
  // Tanggal acuan bisa dikunci dari luar supaya hasilnya bisa diuji.
  const asOf = options.today ?? new Date().toISOString().slice(0, 10);
  const dueSoonDays = options.dueSoonDays ?? DUE_SOON_DAYS;

  const hariIni = toDay(asOf);
  const aktif = projects.filter((p) => isActiveStatus(p.status));
  const total = projects.length;

  // Proyek tanpa nilai dijumlahkan sebagai 0, lalu dihitung terpisah lewat
  // valueMissing supaya angka pipeline tidak terbaca lebih pasti dari kenyataan.
  const jumlahNilai = (list: Project[]) =>
    list.reduce((sum, p) => sum + (p.value ?? 0), 0);

  return {
    total,
    byStatus: hitung(PROJECT_STATUSES, (s) => projects.filter((p) => p.status === s).length),
    byPriority: hitung(PROJECT_PRIORITIES, (p) => projects.filter((x) => x.priority === p).length),
    byType: hitung(PROJECT_TYPES, (t) => projects.filter((p) => p.type === t).length),
    highPriorityActive: aktif.filter((p) => p.priority === "Tinggi").length,
    avgProgress:
      total === 0
        ? 0
        : Math.round(projects.reduce((sum, p) => sum + p.progressPct, 0) / total),
    overdue: aktif.filter((p) => toDay(p.deadline) < hariIni).length,
    // Hari ini ikut dihitung sebagai "segera", tenggat yang sudah lewat tidak.
    dueSoon: aktif.filter((p) => {
      const tenggat = toDay(p.deadline);
      return tenggat >= hariIni && tenggat <= hariIni + dueSoonDays;
    }).length,
    dueSoonDays,
    pipelineValue: jumlahNilai(aktif),
    completedValue: jumlahNilai(projects.filter((p) => !isActiveStatus(p.status))),
    valueMissing: aktif.filter((p) => p.value === null).length,
    asOf,
  };
}
