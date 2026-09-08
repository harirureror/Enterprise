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

export type TitikKurva = {
  date: string;
  /** Bobot kumulatif menurut tanggal target, 0-100. */
  rencana: number | null;
  /** Bobot kumulatif menurut tanggal selesai. `null` sesudah hari ini. */
  aktual: number | null;
};

/**
 * Kurva S: rencana vs aktual.
 *
 * Garis aktual BERHENTI di hari ini. Menariknya sampai ujung rentang akan
 * menggambar masa depan yang belum terjadi, dan grafik yang menjanjikan hal
 * seperti itu lebih buruk daripada grafik yang berhenti apa adanya.
 *
 * Rencana bernilai `null` kalau tidak ada satu pun tanggal target — tanpa
 * rencana yang benar-benar disusun orang, garisnya cuma karangan.
 */
export function kurvaS(activities: ActivityLike[], hariIni?: string): TitikKurva[] {
  if (activities.length === 0) return [];

  const acuan = hariIni ?? new Date().toISOString().slice(0, 10);
  const total = totalBobot(activities);
  if (total <= 0) return [];

  const adaRencana = activities.some((a) => a.targetDate !== null);

  // Tiap tanggal yang disebut aktivitas jadi satu titik, plus hari ini supaya
  // garis aktual selalu punya ujung yang terlihat.
  const tanggal = [
    ...new Set(
      [
        ...activities.map((a) => a.targetDate),
        ...activities.map((a) => a.doneDate),
        acuan,
      ].filter((d): d is string => d !== null)
    ),
  ].sort();

  return tanggal.map((date) => {
    const rencanaBobot = activities
      .filter((a) => a.targetDate !== null && a.targetDate <= date)
      .reduce((n, a) => n + a.weight, 0);

    const aktualBobot = activities
      .filter((a) => a.doneDate !== null && a.doneDate <= date)
      .reduce((n, a) => n + a.weight, 0);

    return {
      date,
      rencana: adaRencana ? Math.round((rencanaBobot / total) * 100) : null,
      aktual: date <= acuan ? Math.round((aktualBobot / total) * 100) : null,
    };
  });
}

/**
 * Selisih progres terhadap rencana pada hari tertentu.
 *
 * Positif berarti mendahului rencana, negatif berarti tertinggal. `null` kalau
 * tidak ada rencana untuk dibandingkan.
 */
export function selisihRencana(activities: ActivityLike[], hariIni?: string): number | null {
  const titik = kurvaS(activities, hariIni);
  if (titik.length === 0) return null;

  const acuan = hariIni ?? new Date().toISOString().slice(0, 10);
  const sampaiKini = titik.filter((t) => t.date <= acuan);
  const terakhir = sampaiKini[sampaiKini.length - 1] ?? titik[0];

  return terakhir.rencana === null || terakhir.aktual === null
    ? null
    : terakhir.aktual - terakhir.rencana;
}

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
