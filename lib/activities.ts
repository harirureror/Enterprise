import { fromDay, toDay } from "./timeline";
import type { ProjectActivity, ProjectStatus } from "./types";

/* Checklist aktivitas: progres, status, kurva S, dan tenggat tindak lanjut.

   Semuanya diturunkan dari daftar aktivitas — tidak ada angka progres yang
   diketik orang. Alasannya sama dengan margin di lib/finance.ts: angka yang
   disimpan akan melenceng dari kenyataannya begitu salah satu komponennya
   berubah, dan tidak ada yang tahu mana yang benar.

   Tanpa React dan tanpa akses data, jadi seluruhnya bisa diuji tanpa peramban
   maupun database. */

/** Bentuk minimum yang dibutuhkan hitungan di sini. */
export type ActivityLike = Pick<
  ProjectActivity,
  "name" | "weight" | "status" | "slaDays" | "targetDate" | "doneDate" | "sortOrder"
>;

const urut = <T extends { sortOrder: number }>(a: T[]): T[] =>
  [...a].sort((x, y) => x.sortOrder - y.sortOrder);

/**
 * Progres = bobot yang tercentang dibagi TOTAL BOBOT, bukan dibagi 100.
 *
 * Kalau dibagi 100, daftar yang bobotnya belum genap (mis. baru diisi separuh)
 * akan selamanya mentok di bawah 100% walau semua aktivitasnya sudah selesai —
 * dan orang akan mengira ada yang tertinggal padahal tidak.
 */
export function progresDariAktivitas(activities: ActivityLike[]): number {
  const total = activities.reduce((n, a) => n + a.weight, 0);
  if (total <= 0) return 0;

  const selesai = activities
    .filter((a) => a.doneDate !== null)
    .reduce((n, a) => n + a.weight, 0);

  return Math.round((selesai / total) * 100);
}

/**
 * Status = status aktivitas selesai TERAKHIR menurut urutan.
 *
 * Belum ada yang tercentang berarti status tidak diubah: proyek baru tetap di
 * status awalnya, bukan dilempar mundur ke tahap pertama template.
 */
export function statusDariAktivitas(
  activities: ActivityLike[],
  semula: ProjectStatus
): ProjectStatus {
  const selesai = urut(activities).filter((a) => a.doneDate !== null);
  return selesai.length === 0 ? semula : selesai[selesai.length - 1].status;
}

/** Jumlah bobot; dipakai layar untuk memperingatkan daftar yang belum genap 100. */
export function totalBobot(activities: ActivityLike[]): number {
  return activities.reduce((n, a) => n + a.weight, 0);
}

/* Kurva S pindah ke lib/schedule-curve.ts: bentuknya berubah dari deretan titik
   menjadi tabel periode ala master schedule, dan hitungannya sudah cukup besar
   untuk berdiri sendiri. Yang tersisa di sini adalah yang diturunkan dari
   CENTANG, bukan dari tanggal. */

export type TindakLanjut = {
  name: string;
  /** Aktivitas yang memicunya sudah selesai pada tanggal ini. */
  doneDate: string;
  /** Batas tindak lanjut, ISO date. */
  jatuhTempo: string;
  /** Berapa hari lewat dari batas. Selalu positif. */
  lewatHari: number;
};

/**
 * Aktivitas yang tenggat tindak lanjutnya sudah lewat.
 *
 * Tiga syarat, dan yang ketiga yang paling penting: aktivitas BERIKUTNYA belum
 * selesai. Penawaran yang sudah lanjut ke negosiasi tidak perlu diingatkan
 * lagi — pengingat yang menyala setelah urusannya beres akan cepat diabaikan,
 * dan begitu diabaikan seluruh pengingat lain ikut kehilangan artinya.
 */
export function tindakLanjutTerlewat(
  activities: ActivityLike[],
  hariIni?: string
): TindakLanjut[] {
  const acuan = hariIni ?? new Date().toISOString().slice(0, 10);
  const semua = urut(activities);

  return semua.flatMap((a, i) => {
    if (a.slaDays === null || a.doneDate === null) return [];

    // Sudah ada aktivitas sesudahnya yang selesai berarti urusannya berlanjut.
    if (semua.slice(i + 1).some((b) => b.doneDate !== null)) return [];

    const jatuhTempo = fromDay(toDay(a.doneDate) + a.slaDays);
    if (jatuhTempo >= acuan) return [];

    return [
      {
        name: a.name,
        doneDate: a.doneDate,
        jatuhTempo,
        lewatHari: toDay(acuan) - toDay(jatuhTempo),
      },
    ];
  });
}
