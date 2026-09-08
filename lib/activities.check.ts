/**
 * Cek mandiri checklist aktivitas dan kurva S: `npx tsx lib/activities.check.ts`
 */
import assert from "node:assert/strict";
import {
  type ActivityLike,
  kurvaS,
  progresDariAktivitas,
  selisihRencana,
  statusDariAktivitas,
  tindakLanjutTerlewat,
  totalBobot,
} from "./activities";
import type { ProjectStatus } from "./types";

function a(
  name: string,
  weight: number,
  status: ProjectStatus,
  over: Partial<ActivityLike> = {}
): ActivityLike {
  return {
    name,
    weight,
    status,
    slaDays: null,
    targetDate: null,
    doneDate: null,
    sortOrder: 0,
    ...over,
  };
}

/** Alur Jasa yang disederhanakan; bobotnya berjumlah 100. */
const alur = (): ActivityLike[] => [
  a("Prospek masuk", 10, "Prospect", { sortOrder: 0 }),
  a("Penawaran dikirim", 20, "Penawaran", { sortOrder: 1, slaDays: 14 }),
  a("Negosiasi", 20, "Negosiasi", { sortOrder: 2, slaDays: 7 }),
  a("Pelaksanaan", 30, "Berjalan", { sortOrder: 3 }),
  a("Laporan", 20, "Selesai", { sortOrder: 4 }),
];

const centang = (list: ActivityLike[], sampai: number, tanggal: string) =>
  list.map((x, i) => (i <= sampai ? { ...x, doneDate: tanggal } : x));

/* --- progresDariAktivitas --------------------------------------------------- */

assert.equal(totalBobot(alur()), 100);
assert.equal(progresDariAktivitas(alur()), 0, "belum ada yang tercentang");
assert.equal(progresDariAktivitas(centang(alur(), 0, "2026-09-01")), 10);
assert.equal(progresDariAktivitas(centang(alur(), 1, "2026-09-01")), 30);
assert.equal(progresDariAktivitas(centang(alur(), 4, "2026-09-01")), 100, "semua selesai");

// Daftar kosong tidak membagi nol.
assert.equal(progresDariAktivitas([]), 0);
// Bobot nol semua juga tidak.
assert.equal(progresDariAktivitas([a("Kosong", 0, "Prospect")]), 0);

// Pembaginya TOTAL BOBOT, bukan 100. Daftar yang belum genap tetap bisa 100%
// kalau semuanya selesai — kalau dibagi 100, ia akan mentok di 60 selamanya.
const belumGenap = [
  a("Satu", 30, "Prospect", { sortOrder: 0, doneDate: "2026-09-01" }),
  a("Dua", 30, "Berjalan", { sortOrder: 1, doneDate: "2026-09-02" }),
];
assert.equal(totalBobot(belumGenap), 60);
assert.equal(progresDariAktivitas(belumGenap), 100);

// Mencentang tidak berurutan tetap dihitung apa adanya.
const lompat = alur().map((x, i) => (i === 3 ? { ...x, doneDate: "2026-09-05" } : x));
assert.equal(progresDariAktivitas(lompat), 30);

/* --- statusDariAktivitas ---------------------------------------------------- */

// Belum ada yang tercentang: status TIDAK diubah, bukan dilempar ke tahap awal.
assert.equal(statusDariAktivitas(alur(), "Tertunda"), "Tertunda");
assert.equal(statusDariAktivitas([], "Penawaran"), "Penawaran");

assert.equal(statusDariAktivitas(centang(alur(), 0, "2026-09-01"), "Prospect"), "Prospect");
assert.equal(statusDariAktivitas(centang(alur(), 1, "2026-09-01"), "Prospect"), "Penawaran");
assert.equal(statusDariAktivitas(centang(alur(), 3, "2026-09-01"), "Prospect"), "Berjalan");
assert.equal(statusDariAktivitas(centang(alur(), 4, "2026-09-01"), "Prospect"), "Selesai");

// Yang menentukan urutan sortOrder, bukan urutan dalam array.
const acak = [...centang(alur(), 2, "2026-09-01")].reverse();
assert.equal(statusDariAktivitas(acak, "Prospect"), "Negosiasi");

// Mencentang yang belakangan saja tetap memakai yang TERAKHIR menurut urutan.
assert.equal(statusDariAktivitas(lompat, "Prospect"), "Berjalan");

/* --- kurvaS ----------------------------------------------------------------- */

assert.deepEqual(kurvaS([], "2026-09-10"), []);

// Tanpa satu pun tanggal target, garis rencana null — bukan garis karangan.
const tanpaRencana = centang(alur(), 1, "2026-09-01");
const kTanpa = kurvaS(tanpaRencana, "2026-09-10");
assert.ok(kTanpa.length > 0);
assert.ok(kTanpa.every((t) => t.rencana === null), "tanpa target_date tidak ada garis rencana");
assert.equal(kTanpa[kTanpa.length - 1].aktual, 30);

// Dengan tanggal target, rencana naik bertahap.
const berencana: ActivityLike[] = [
  a("A", 25, "Prospect", { sortOrder: 0, targetDate: "2026-09-01", doneDate: "2026-09-01" }),
  a("B", 25, "Penawaran", { sortOrder: 1, targetDate: "2026-09-10", doneDate: "2026-09-12" }),
  a("C", 25, "Berjalan", { sortOrder: 2, targetDate: "2026-09-20" }),
  a("D", 25, "Selesai", { sortOrder: 3, targetDate: "2026-09-30" }),
];
const k = kurvaS(berencana, "2026-09-15");

// Titiknya menaik dan tidak ada tanggal ganda.
assert.deepEqual(
  k.map((t) => t.date),
  [...new Set(k.map((t) => t.date))].sort()
);
assert.equal(k.find((t) => t.date === "2026-09-01")!.rencana, 25);
assert.equal(k.find((t) => t.date === "2026-09-10")!.rencana, 50);
assert.equal(k.find((t) => t.date === "2026-09-30")!.rencana, 100);

// Garis aktual BERHENTI di hari ini: yang sesudahnya null, bukan diteruskan.
assert.equal(k.find((t) => t.date === "2026-09-15")!.aktual, 50);
assert.equal(k.find((t) => t.date === "2026-09-20")!.aktual, null);
assert.equal(k.find((t) => t.date === "2026-09-30")!.aktual, null);
// Sedangkan rencananya tetap digambar sampai ujung — itu memang rencana.
assert.equal(k.find((t) => t.date === "2026-09-20")!.rencana, 75);

// Hari ini selalu ikut jadi titik, walau tidak ada aktivitas bertanggal itu.
assert.ok(k.some((t) => t.date === "2026-09-15"));

/* --- selisihRencana --------------------------------------------------------- */

// 12 Sep: rencana 50 (A+B), aktual 50 (A+B selesai) -> pas.
assert.equal(selisihRencana(berencana, "2026-09-12"), 0);
// 10 Sep: rencana 50, aktual baru 25 karena B baru selesai 12 Sep -> tertinggal.
assert.equal(selisihRencana(berencana, "2026-09-10"), -25);
// Tanpa rencana tidak ada yang bisa dibandingkan.
assert.equal(selisihRencana(tanpaRencana, "2026-09-10"), null);
assert.equal(selisihRencana([], "2026-09-10"), null);

/* --- tindakLanjutTerlewat --------------------------------------------------- */

// Penawaran dikirim 1 Sep, berlaku 14 hari -> jatuh tempo 15 Sep.
const ditawar = alur().map((x, i) => (i <= 1 ? { ...x, doneDate: "2026-09-01" } : x));

assert.deepEqual(tindakLanjutTerlewat(ditawar, "2026-09-15"), [], "tepat di hari jatuh tempo belum lewat");
const lewat = tindakLanjutTerlewat(ditawar, "2026-09-17");
assert.equal(lewat.length, 1);
assert.equal(lewat[0].name, "Penawaran dikirim");
assert.equal(lewat[0].jatuhTempo, "2026-09-15");
assert.equal(lewat[0].lewatHari, 2);

// Begitu aktivitas BERIKUTNYA selesai, pengingat penawaran padam — urusannya
// sudah berlanjut, dan pengingat yang menyala setelah beres akan cepat
// diabaikan. Yang tersisa justru tenggat milik negosiasi itu sendiri.
const lanjutNegosiasi = ditawar.map((x, i) => (i === 2 ? { ...x, doneDate: "2026-09-16" } : x));
const sesudahLanjut = tindakLanjutTerlewat(lanjutNegosiasi, "2026-09-30");
assert.equal(sesudahLanjut.length, 1);
assert.equal(sesudahLanjut[0].name, "Negosiasi", "penawaran padam, negosiasi yang kini jatuh tempo");
// Dan sebelum tenggat negosiasi lewat, tidak ada yang berbunyi sama sekali.
assert.deepEqual(tindakLanjutTerlewat(lanjutNegosiasi, "2026-09-20"), []);

// Aktivitas tanpa SLA tidak pernah memicu apa pun.
const tanpaSla = alur().map((x) => ({ ...x, slaDays: null, doneDate: "2026-01-01" }));
assert.deepEqual(tindakLanjutTerlewat(tanpaSla, "2026-12-31"), []);

// Aktivitas ber-SLA yang belum selesai juga tidak: tenggatnya belum mulai jalan.
assert.deepEqual(tindakLanjutTerlewat(alur(), "2026-12-31"), []);

// Dua aktivitas ber-SLA berturut-turut: hanya yang terakhir yang berbunyi.
const duaSla: ActivityLike[] = [
  a("Satu", 50, "Penawaran", { sortOrder: 0, slaDays: 5, doneDate: "2026-09-01" }),
  a("Dua", 50, "Negosiasi", { sortOrder: 1, slaDays: 5, doneDate: "2026-09-02" }),
];
const duaHasil = tindakLanjutTerlewat(duaSla, "2026-09-20");
assert.equal(duaHasil.length, 1);
assert.equal(duaHasil[0].name, "Dua");

assert.deepEqual(tindakLanjutTerlewat([], "2026-09-20"), []);

console.log("ok: activities");
