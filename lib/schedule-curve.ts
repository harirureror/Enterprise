import { fromDay, toDay } from "./timeline";
import type { ProjectActivity } from "./types";

/* Kurva S berbentuk master schedule.

   Bentuknya mengikuti jadwal induk proyek konstruksi: baris aktivitas, kolom
   periode, tiap sel berisi porsi bobot yang direncanakan jatuh di periode itu,
   lalu baris TOTAL dan KUMULATIF di bawahnya. Kurvanya digambar di atas baris
   kumulatif.

   Bedanya dengan bentuk sebelumnya: bobot sebuah aktivitas DISEBAR sepanjang
   rentang kerjanya, bukan ditumpuk di satu tanggal. Bobot yang ditumpuk membuat
   garisnya naik bertangga, dan tangga tidak bisa dibandingkan dengan rencana
   siapa pun.

   Tanpa React dan tanpa akses data, jadi seluruhnya bisa diuji tanpa peramban
   maupun database. */

export type Granularitas = "harian" | "mingguan" | "bulanan";

/** Batas pemilihan granularitas otomatis, dalam hari inklusif. */
export const BATAS_HARIAN = 14;
export const BATAS_MINGGUAN = 120;

/** Yang dibutuhkan hitungan di sini; sengaja lebih sempit dari ProjectActivity. */
export type KurvaActivity = Pick<
  ProjectActivity,
  "id" | "name" | "weight" | "startDate" | "targetDate" | "doneDate" | "sortOrder"
>;

export type Periode = {
  /** Stabil antar-render, dipakai sebagai key React. */
  kunci: string;
  label: string;
  /** ISO, inklusif. */
  mulai: string;
  akhir: string;
};

export type BarisKurva = {
  id: number;
  nama: string;
  bobot: number;
  /** Porsi bobot per periode, dinormalkan ke persen dari TOTAL bobot. */
  perPeriode: number[];
};

export type TabelKurva = {
  granularitas: Granularitas;
  periode: Periode[];
  baris: BarisKurva[];
  /** Jumlah tiap kolom. */
  total: number[];
  /** Menaik, berakhir di 100 kalau semua aktivitas punya tanggal. */
  kumulatif: number[];
  /** Bobot selesai kumulatif; `null` untuk periode yang belum dimulai. */
  aktualKumulatif: (number | null)[];
  /** Jumlah bobot mentah, untuk memperingatkan daftar yang belum genap 100. */
  totalBobot: number;
};

const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const urut = <T extends { sortOrder: number }>(a: T[]): T[] =>
  [...a].sort((x, y) => x.sortOrder - y.sortOrder);

/**
 * Rentang kerja sebuah aktivitas, atau `null` kalau tidak punya tanggal sama
 * sekali. Satu tanggal saja tetap sah: ia jadi rentang sehari.
 */
function rentangAktivitas(a: KurvaActivity): { d0: number; d1: number } | null {
  const mulai = a.startDate ?? a.targetDate;
  const akhir = a.targetDate ?? a.startDate;
  if (mulai === null || akhir === null) return null;

  // Tanggal terbalik tidak dilempar sebagai galat: data lama bisa saja begitu,
  // dan grafik yang menolak tampil lebih buruk daripada grafik yang membetulkan
  // urutannya sendiri.
  const d0 = Math.min(toDay(mulai), toDay(akhir));
  const d1 = Math.max(toDay(mulai), toDay(akhir));
  return { d0, d1 };
}

/**
 * Satuan kolom mengikuti panjang proyek.
 *
 * Kolom bulanan untuk proyek sebulan hanya menghasilkan satu-dua kolom, dan
 * kurva dari dua titik tidak memberi tahu apa pun. Sebaliknya kolom harian
 * untuk proyek dua tahun menghasilkan 700 kolom yang tidak terbaca.
 */
export function pilihGranularitas(mulai: string, akhir: string): Granularitas {
  const hari = Math.abs(toDay(akhir) - toDay(mulai)) + 1;
  if (hari <= BATAS_HARIAN) return "harian";
  if (hari <= BATAS_MINGGUAN) return "mingguan";
  return "bulanan";
}

/** Awal bulan yang memuat sebuah hari. */
function awalBulan(day: number): number {
  const d = new Date(day * 86_400_000);
  return toDay(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
}

function bulanBerikutnya(day: number): number {
  const d = new Date(day * 86_400_000);
  const tahun = d.getUTCFullYear() + (d.getUTCMonth() === 11 ? 1 : 0);
  const bulan = d.getUTCMonth() === 11 ? 1 : d.getUTCMonth() + 2;
  return toDay(`${tahun}-${String(bulan).padStart(2, "0")}-01`);
}

/**
 * Kolom-kolom tabel, berurutan dan tanpa celah.
 *
 * Minggu diikat ke tanggal mulai, bukan ke hari Senin: proyek jarang mulai
 * Senin, dan minggu pertama yang cuma berisi dua hari membuat kolom pertama
 * selalu terlihat kosong tanpa alasan.
 */
export function periodeAntara(mulai: string, akhir: string, g: Granularitas): Periode[] {
  const d0 = Math.min(toDay(mulai), toDay(akhir));
  const d1 = Math.max(toDay(mulai), toDay(akhir));
  const hasil: Periode[] = [];

  if (g === "harian") {
    for (let d = d0; d <= d1; d++) {
      const iso = fromDay(d);
      const t = new Date(d * 86_400_000);
      hasil.push({
        kunci: iso,
        label: `${t.getUTCDate()} ${BULAN[t.getUTCMonth()]}`,
        mulai: iso,
        akhir: iso,
      });
    }
    return hasil;
  }

  if (g === "mingguan") {
    let n = 1;
    for (let d = d0; d <= d1; d += 7, n++) {
      hasil.push({
        kunci: fromDay(d),
        label: `Mg ${n}`,
        mulai: fromDay(d),
        akhir: fromDay(Math.min(d + 6, d1)),
      });
    }
    return hasil;
  }

  // Bulanan. Tahun ikut ditulis hanya kalau rentangnya melewati pergantian
  // tahun — kalau tidak, ia cuma mengulang keterangan yang sama di tiap kolom.
  const lintasTahun =
    new Date(d0 * 86_400_000).getUTCFullYear() !== new Date(d1 * 86_400_000).getUTCFullYear();

  for (let d = awalBulan(d0); d <= d1; d = bulanBerikutnya(d)) {
    const t = new Date(d * 86_400_000);
    const habis = bulanBerikutnya(d) - 1;
    hasil.push({
      kunci: fromDay(d).slice(0, 7),
      label: lintasTahun
        ? `${BULAN[t.getUTCMonth()]} '${String(t.getUTCFullYear()).slice(2)}`
        : BULAN[t.getUTCMonth()],
      mulai: fromDay(Math.max(d, d0)),
      akhir: fromDay(Math.min(habis, d1)),
    });
  }
  return hasil;
}

/**
 * Tabel kurva S lengkap: baris aktivitas, TOTAL, KUMULATIF, dan garis aktual.
 *
 * Bobot dibagi rata **per hari** lalu dijumlahkan per periode — bukan dibagi
 * rata per periode. Aktivitas yang hanya menyentuh separuh sebuah bulan memang
 * hanya menyumbang separuh porsinya di bulan itu, dan pembagian per periode
 * akan menggemukkan kolom pertama dan terakhir setiap kali.
 *
 * Semua angka dinormalkan ke persen dari TOTAL bobot, alasannya sama dengan
 * `progresDariAktivitas`: daftar yang bobotnya belum genap tetap harus bisa
 * mencapai 100%.
 */
export function tabelKurva(
  activities: KurvaActivity[],
  hariIni?: string,
  granularitas?: Granularitas
): TabelKurva | null {
  const daftar = urut(activities);
  const totalBobot = daftar.reduce((n, a) => n + a.weight, 0);

  const rentang = daftar.map(rentangAktivitas);
  const berjadwal = rentang.filter((r): r is { d0: number; d1: number } => r !== null);
  if (daftar.length === 0 || totalBobot <= 0 || berjadwal.length === 0) return null;

  const d0 = Math.min(...berjadwal.map((r) => r.d0));
  const d1 = Math.max(...berjadwal.map((r) => r.d1));
  const g = granularitas ?? pilihGranularitas(fromDay(d0), fromDay(d1));
  const periode = periodeAntara(fromDay(d0), fromDay(d1), g);

  const baris: BarisKurva[] = daftar.map((a, i) => {
    const r = rentang[i];
    const perPeriode = periode.map((p) => {
      if (r === null) return 0;

      // Berapa hari milik aktivitas ini yang jatuh di dalam periode tersebut.
      const irisan =
        Math.min(r.d1, toDay(p.akhir)) - Math.max(r.d0, toDay(p.mulai)) + 1;
      if (irisan <= 0) return 0;

      const hariAktivitas = r.d1 - r.d0 + 1;
      return ((a.weight * irisan) / hariAktivitas / totalBobot) * 100;
    });
    return { id: a.id, nama: a.name, bobot: a.weight, perPeriode };
  });

  const total = periode.map((_, i) => baris.reduce((n, b) => n + b.perPeriode[i], 0));

  let jalan = 0;
  const kumulatif = total.map((n) => (jalan += n));

  const acuan = hariIni ?? new Date().toISOString().slice(0, 10);
  const aktualKumulatif = periode.map((p) => {
    // Periode yang belum dimulai tidak punya realisasi. Menuliskannya nol akan
    // menggambar garis mendatar di bawah rencana, seolah pekerjaannya berhenti.
    if (p.mulai > acuan) return null;

    const selesai = daftar
      .filter((a) => a.doneDate !== null && a.doneDate <= p.akhir && a.doneDate <= acuan)
      .reduce((n, a) => n + a.weight, 0);
    return (selesai / totalBobot) * 100;
  });

  return { granularitas: g, periode, baris, total, kumulatif, aktualKumulatif, totalBobot };
}

/**
 * Selisih realisasi terhadap rencana pada periode berjalan.
 *
 * Positif berarti mendahului rencana, negatif tertinggal. `null` kalau belum
 * ada satu pun periode yang dimulai.
 */
export function selisihRencana(tabel: TabelKurva | null, hariIni?: string): number | null {
  if (tabel === null) return null;

  const acuan = hariIni ?? new Date().toISOString().slice(0, 10);
  let i = -1;
  for (let n = 0; n < tabel.periode.length; n++) {
    if (tabel.periode[n].mulai <= acuan) i = n;
  }
  if (i < 0) return null;

  const aktual = tabel.aktualKumulatif[i];
  return aktual === null ? null : Math.round(aktual - tabel.kumulatif[i]);
}
