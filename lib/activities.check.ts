/**
 * Cek mandiri checklist aktivitas dan kurva S: `npx tsx lib/activities.check.ts`
 */
import assert from "node:assert/strict";
import {
  type ActivityLike,
  progresDariAktivitas,
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

/* Kurva S sekarang diuji di lib/schedule-curve.check.ts. */

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
