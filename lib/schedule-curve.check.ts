/**
 * Cek mandiri kurva S berbentuk master schedule:
 * `npx tsx lib/schedule-curve.check.ts`
 */
import assert from "node:assert/strict";
import {
  BATAS_HARIAN,
  BATAS_MINGGUAN,
  type KurvaActivity,
  periodeAntara,
  pilihGranularitas,
  selisihRencana,
  tabelKurva,
} from "./schedule-curve";

let n = 0;
function a(over: Partial<KurvaActivity> = {}): KurvaActivity {
  n += 1;
  return {
    id: n,
    name: `A${n}`,
    weight: 25,
    startDate: null,
    targetDate: null,
    doneDate: null,
    sortOrder: n,
    ...over,
  };
}

/** Dibulatkan supaya pembandingan tidak tersandung sisa pecahan biner. */
const bulat = (x: number) => Math.round(x * 1e6) / 1e6;
const jumlah = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/* --- pilihGranularitas ------------------------------------------------------ */

assert.equal(pilihGranularitas("2026-09-01", "2026-09-01"), "harian", "satu hari");
// Batasnya inklusif: 14 hari masih harian, 15 hari sudah mingguan.
assert.equal(pilihGranularitas("2026-09-01", "2026-09-14"), "harian");
assert.equal(pilihGranularitas("2026-09-01", "2026-09-15"), "mingguan");
assert.equal(BATAS_HARIAN, 14);

assert.equal(pilihGranularitas("2026-01-01", "2026-04-30"), "mingguan", "120 hari");
assert.equal(pilihGranularitas("2026-01-01", "2026-05-01"), "bulanan", "121 hari");
assert.equal(BATAS_MINGGUAN, 120);

// Proyek nyata di database ini: median 31 hari, terpanjang 62.
assert.equal(pilihGranularitas("2026-08-01", "2026-09-01"), "mingguan");
assert.equal(pilihGranularitas("2026-07-06", "2026-09-06"), "mingguan");
// Proyek konstruksi seperti contoh acuan tetap bulanan.
assert.equal(pilihGranularitas("2025-03-01", "2026-09-30"), "bulanan");

// Tanggal terbalik tidak melempar galat, hanya dibaca apa adanya.
assert.equal(pilihGranularitas("2026-09-14", "2026-09-01"), "harian");

/* --- periodeAntara ---------------------------------------------------------- */

const harian = periodeAntara("2026-09-01", "2026-09-03", "harian");
assert.equal(harian.length, 3);
assert.deepEqual(
  harian.map((p) => p.mulai),
  ["2026-09-01", "2026-09-02", "2026-09-03"]
);
assert.equal(harian[0].label, "1 Sep");
// Periode harian mulai dan berakhir di hari yang sama.
assert.ok(harian.every((p) => p.mulai === p.akhir));

// Minggu diikat ke tanggal mulai, bukan ke hari Senin.
const mingguan = periodeAntara("2026-08-05", "2026-09-01", "mingguan");
assert.deepEqual(
  mingguan.map((p) => p.mulai),
  ["2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26"]
);
assert.equal(mingguan[0].akhir, "2026-08-11", "tujuh hari inklusif");
assert.equal(mingguan[0].label, "Mg 1");
// Periode terakhir dipotong di ujung rentang, tidak menjorok keluar.
assert.equal(mingguan[mingguan.length - 1].akhir, "2026-09-01");

const bulanan = periodeAntara("2026-03-15", "2026-06-10", "bulanan");
assert.deepEqual(
  bulanan.map((p) => p.label),
  ["Mar", "Apr", "Mei", "Jun"]
);
// Bulan pertama dan terakhir dipotong di ujung rentang.
assert.equal(bulanan[0].mulai, "2026-03-15");
assert.equal(bulanan[0].akhir, "2026-03-31");
assert.equal(bulanan[3].mulai, "2026-06-01");
assert.equal(bulanan[3].akhir, "2026-06-10");

// Tahun ikut ditulis hanya kalau rentangnya melewati pergantian tahun.
const lintasTahun = periodeAntara("2026-11-01", "2027-02-01", "bulanan");
assert.deepEqual(
  lintasTahun.map((p) => p.label),
  ["Nov '26", "Des '26", "Jan '27", "Feb '27"]
);

// Tidak ada celah dan tidak ada tumpang tindih, apa pun granularitasnya.
for (const g of ["harian", "mingguan", "bulanan"] as const) {
  const ps = periodeAntara("2026-01-15", "2026-07-20", g);
  assert.equal(ps[0].mulai, "2026-01-15", `${g}: mulai persis di ujung`);
  assert.equal(ps[ps.length - 1].akhir, "2026-07-20", `${g}: berakhir persis di ujung`);
  for (let i = 1; i < ps.length; i++) {
    const sebelumnya = new Date(`${ps[i - 1].akhir}T00:00:00Z`).getTime() + 86_400_000;
    assert.equal(
      new Date(sebelumnya).toISOString().slice(0, 10),
      ps[i].mulai,
      `${g}: periode ${i} harus menyambung tanpa celah`
    );
  }
  assert.equal(new Set(ps.map((p) => p.kunci)).size, ps.length, `${g}: kunci unik`);
}

/* --- tabelKurva: daftar yang tidak bisa digambar ---------------------------- */

assert.equal(tabelKurva([], "2026-09-08"), null, "tanpa aktivitas");
assert.equal(tabelKurva([a(), a()], "2026-09-08"), null, "tidak satu pun bertanggal");
assert.equal(
  tabelKurva([a({ weight: 0, startDate: "2026-09-01", targetDate: "2026-09-30" })], "2026-09-08"),
  null,
  "bobot nol semua tidak bisa dinormalkan"
);

/* --- tabelKurva: aritmetikanya harus jujur ---------------------------------- */

const alur: KurvaActivity[] = [
  a({ weight: 20, startDate: "2026-03-01", targetDate: "2026-03-31", sortOrder: 0 }),
  a({ weight: 30, startDate: "2026-04-01", targetDate: "2026-05-31", sortOrder: 1 }),
  a({ weight: 50, startDate: "2026-06-01", targetDate: "2026-06-30", sortOrder: 2 }),
];
const t = tabelKurva(alur, "2026-04-15", "bulanan")!;

assert.equal(t.granularitas, "bulanan");
assert.deepEqual(
  t.periode.map((p) => p.label),
  ["Mar", "Apr", "Mei", "Jun"]
);
assert.equal(t.totalBobot, 100);

// Tiap baris menyebarkan PERSIS bobotnya, tidak lebih dan tidak kurang.
for (const b of t.baris) {
  assert.equal(bulat(jumlah(b.perPeriode)), b.bobot, `baris ${b.nama} harus berjumlah bobotnya`);
}
// TOTAL adalah jumlah kolom, KUMULATIF menaik dan berakhir di 100.
for (let i = 0; i < t.periode.length; i++) {
  assert.equal(bulat(t.total[i]), bulat(jumlah(t.baris.map((b) => b.perPeriode[i]))));
}
assert.equal(bulat(t.kumulatif[t.kumulatif.length - 1]), 100, "kumulatif berakhir di 100");
for (let i = 1; i < t.kumulatif.length; i++) {
  assert.ok(t.kumulatif[i] >= t.kumulatif[i - 1], "kumulatif tidak boleh turun");
}

// Aktivitas yang seluruhnya di dalam satu bulan menyumbang penuh di bulan itu.
assert.equal(bulat(t.baris[0].perPeriode[0]), 20);
assert.equal(t.baris[0].perPeriode[1], 0);

// Aktivitas dua bulan dibagi menurut JUMLAH HARI, bukan rata per bulan.
// 1 Apr–31 Mei = 61 hari: 30 di April, 31 di Mei. Rata per bulan akan memberi
// 15/15 dan menggemukkan April.
assert.equal(bulat(t.baris[1].perPeriode[1]), bulat((30 * 30) / 61));
assert.equal(bulat(t.baris[1].perPeriode[2]), bulat((30 * 31) / 61));
assert.notEqual(bulat(t.baris[1].perPeriode[1]), 15);

/* --- tabelKurva: garis aktual ----------------------------------------------- */

const dikerjakan: KurvaActivity[] = [
  a({ weight: 20, startDate: "2026-03-01", targetDate: "2026-03-31", doneDate: "2026-03-20", sortOrder: 0 }),
  a({ weight: 30, startDate: "2026-04-01", targetDate: "2026-05-31", doneDate: "2026-04-10", sortOrder: 1 }),
  a({ weight: 50, startDate: "2026-06-01", targetDate: "2026-06-30", sortOrder: 2 }),
];
const ta = tabelKurva(dikerjakan, "2026-04-15", "bulanan")!;

assert.equal(bulat(ta.aktualKumulatif[0]!), 20, "Maret: satu aktivitas selesai");
assert.equal(bulat(ta.aktualKumulatif[1]!), 50, "April: dua aktivitas selesai");
// Periode yang BELUM DIMULAI tidak punya realisasi — bukan nol, melainkan
// kosong. Nol akan menggambar garis jatuh ke dasar.
assert.equal(ta.aktualKumulatif[2], null, "Mei belum dimulai");
assert.equal(ta.aktualKumulatif[3], null, "Juni belum dimulai");

// Periode yang sedang berjalan tetap punya nilai, walau baru separuh lewat.
assert.notEqual(ta.aktualKumulatif[1], null);

/* --- selisihRencana --------------------------------------------------------- */

// 15 Apr: rencana = 20 (Maret) + porsi April, aktual 50. Mendahului rencana.
assert.ok(selisihRencana(ta, "2026-04-15")! > 0, "selesai lebih cepat dari rencana");
// Sebelum periode pertama dimulai, tidak ada yang bisa dibandingkan.
assert.equal(selisihRencana(ta, "2026-01-01"), null);
assert.equal(selisihRencana(null, "2026-04-15"), null);

// Tidak ada yang dikerjakan sama sekali di akhir rencana: tertinggal penuh.
assert.equal(selisihRencana(tabelKurva(alur, "2026-06-30", "bulanan"), "2026-06-30"), -100);

/* --- Satu tanggal saja tetap sah -------------------------------------------- */

const sehari = tabelKurva(
  [
    a({ weight: 40, targetDate: "2026-09-10", sortOrder: 0 }),
    a({ weight: 60, startDate: "2026-09-11", targetDate: "2026-09-20", sortOrder: 1 }),
  ],
  "2026-09-30",
  "harian"
)!;
// Aktivitas bertanggal tunggal jatuh utuh di satu kolom.
const kolom10 = sehari.periode.findIndex((p) => p.mulai === "2026-09-10");
assert.equal(bulat(sehari.baris[0].perPeriode[kolom10]), 40);
assert.equal(bulat(jumlah(sehari.baris[0].perPeriode)), 40);

/* --- Bobot belum genap 100 -------------------------------------------------- */

// Kumulatif tetap berakhir di 100 karena dinormalkan ke TOTAL bobot, alasannya
// sama dengan progresDariAktivitas: daftar yang belum genap tetap bisa 100%.
const belumGenap = tabelKurva(
  [
    a({ weight: 30, startDate: "2026-09-01", targetDate: "2026-09-10", sortOrder: 0 }),
    a({ weight: 30, startDate: "2026-09-11", targetDate: "2026-09-20", sortOrder: 1 }),
  ],
  "2026-09-30",
  "harian"
)!;
assert.equal(belumGenap.totalBobot, 60, "bobot mentahnya dilaporkan apa adanya");
assert.equal(bulat(belumGenap.kumulatif[belumGenap.kumulatif.length - 1]), 100);

/* --- Urutan baris mengikuti sortOrder, bukan urutan array ------------------- */

const acak = tabelKurva(
  [
    a({ name: "Kedua", weight: 50, startDate: "2026-09-11", targetDate: "2026-09-20", sortOrder: 1 }),
    a({ name: "Pertama", weight: 50, startDate: "2026-09-01", targetDate: "2026-09-10", sortOrder: 0 }),
  ],
  "2026-09-30",
  "harian"
)!;
assert.deepEqual(
  acak.baris.map((b) => b.nama),
  ["Pertama", "Kedua"]
);

/* --- Granularitas otomatis dipilih dari rentang aktivitas ------------------- */

assert.equal(
  tabelKurva([a({ startDate: "2026-09-01", targetDate: "2026-09-05" })], "2026-09-03")!
    .granularitas,
  "harian"
);
assert.equal(
  tabelKurva([a({ startDate: "2026-08-01", targetDate: "2026-09-01" })], "2026-08-15")!
    .granularitas,
  "mingguan"
);

console.log("ok: schedule-curve");
