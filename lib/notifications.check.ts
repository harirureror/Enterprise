/**
 * Cek mandiri penyusunan notifikasi: `npx tsx lib/notifications.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 */
import assert from "node:assert/strict";
import { SOON_DAYS, STALE_DAYS, buildNotifications, countBySeverity } from "./notifications";
import type { ProgressEntry, Project } from "./types";

const HARI_INI = "2026-08-28";

function p(id: number, over: Partial<Project> = {}): Project {
  return {
    id,
    name: `P${id}`,
    description: "",
    type: "Jasa",
    status: "Berjalan",
    priority: "Sedang",
    priorityMode: "auto",
    progressPct: 50,
    clientOrg: "PT Uji",
    locationCity: "",
    locationProvince: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientTier: "Reguler",
    penaltyRisk: "Tidak ada",
    value: null,
    contractNo: "",
    contractDate: null,
    paymentTerm: "Full",
    paymentNote: "",
    taxType: "Non PKP",
    salesFee: null,
    operationalCost: null,
    // Mulai jauh di masa lalu supaya tidak memicu "mandek" tanpa sengaja.
    startDate: "2026-08-20",
    deadline: "2026-12-31",
    ownerId: 1,
    updatedAt: "2026-08-27",
    ...over,
  };
}

function e(id: number, projectId: number, createdAt: string): ProgressEntry {
  return {
    id,
    projectId,
    userId: 1,
    progressPct: 50,
    note: "",
    createdAt,
    recordedAt: `${createdAt} 09:00:00`,
  };
}

// Catatan progres kemarin: tidak ada yang mandek.
const segar = [e(1, 1, "2026-08-27")];
const susun = (list: Project[], hist: ProgressEntry[] = segar) =>
  buildNotifications(list, hist, { today: HARI_INI });

// Keadaan tenang tidak memunculkan apa pun.
assert.deepEqual(susun([p(1)]), []);

// Proyek selesai tidak pernah jadi notifikasi, walau tenggatnya lewat jauh.
assert.deepEqual(susun([p(1, { status: "Selesai", deadline: "2026-01-01" })]), []);

// Lewat tenggat: tingkat tinggi.
const telat = susun([p(1, { deadline: "2026-08-20" })]);
assert.equal(telat.length, 1);
assert.equal(telat[0].kind, "terlambat");
assert.equal(telat[0].severity, "tinggi");
assert.match(telat[0].title, /8 hari/);

// Segera jatuh tempo: batas tepat SOON_DAYS masih masuk, sehari sesudahnya tidak.
const batas = susun([p(1, { deadline: "2026-09-04" })]); // tepat 7 hari
assert.equal(batas[0].kind, "segera");
assert.deepEqual(susun([p(1, { deadline: "2026-09-05" })]), []); // 8 hari
assert.equal(SOON_DAYS, 7);

// Jatuh tempo hari ini punya kalimat sendiri.
assert.equal(susun([p(1, { deadline: HARI_INI })])[0].title, "Jatuh tempo hari ini");

// Terlambat dan segera tidak pernah muncul bersamaan untuk satu proyek.
assert.equal(susun([p(1, { deadline: "2026-08-20" })]).filter((n) => n.kind === "segera").length, 0);

// Mandek: catatan terakhir sudah lewat ambang.
const mandek = susun([p(1)], [e(1, 1, "2026-08-10")]); // 18 hari
assert.equal(mandek.length, 1);
assert.equal(mandek[0].kind, "mandek");
assert.match(mandek[0].detail, /Catatan terakhir 2026-08-10/);
// Tepat di ambang sudah dihitung.
assert.equal(susun([p(1)], [e(1, 1, "2026-08-14")]).length, 1); // 14 hari
assert.equal(susun([p(1)], [e(1, 1, "2026-08-15")]).length, 0); // 13 hari
assert.equal(STALE_DAYS, 14);

// Belum pernah ada catatan: tanggal mulai jadi patokan, dan kalimatnya beda.
const belumPernah = susun([p(1, { startDate: "2026-08-01" })], []);
assert.equal(belumPernah[0].kind, "mandek");
assert.match(belumPernah[0].detail, /Belum pernah ada catatan/);

// Proyek yang belum mulai tidak dianggap mandek.
assert.deepEqual(susun([p(1, { startDate: "2026-09-10", deadline: "2026-10-30" })], []), []);

// Bentrok hanya dilaporkan kalau PIC-nya sama.
const bedaPIC = susun([
  p(1, { ownerId: 1, startDate: "2026-08-20", deadline: "2026-09-30" }),
  p(2, { ownerId: 2, startDate: "2026-08-25", deadline: "2026-09-30" }),
]);
assert.equal(bedaPIC.filter((n) => n.kind === "bentrok").length, 0);

const samaPIC = susun([
  p(1, { ownerId: 1, startDate: "2026-08-20", deadline: "2026-09-30" }),
  p(2, { ownerId: 1, startDate: "2026-08-25", deadline: "2026-09-30" }),
]);
const bentrok = samaPIC.filter((n) => n.kind === "bentrok");
assert.equal(bentrok.length, 1);
assert.equal(bentrok[0].severity, "info");
// Id pasangan selalu urut naik, jadi tidak tergantung urutan masukan.
assert.equal(bentrok[0].id, "bentrok-1-2");

// Urutan: tingkat tinggi lebih dulu, lalu yang paling lama menunggu.
// PIC dibuat berbeda supaya yang diuji murni urutan tenggat, bukan bentrok.
const campur = susun(
  [
    p(1, { ownerId: 1, deadline: "2026-09-02" }), // segera
    p(2, { ownerId: 2, deadline: "2026-08-10" }), // terlambat, lebih lama
    p(3, { ownerId: 3, deadline: "2026-08-25" }), // terlambat, lebih baru
  ],
  [e(1, 1, "2026-08-27"), e(2, 2, "2026-08-27"), e(3, 3, "2026-08-27")]
);
assert.deepEqual(campur.map((n) => n.severity), ["tinggi", "tinggi", "sedang"]);
assert.deepEqual(campur.slice(0, 2).map((n) => n.projectId), [2, 3]);

// Id notifikasi unik, jadi aman dipakai sebagai key.
assert.equal(new Set(campur.map((n) => n.id)).size, campur.length);

// Hitungan per tingkat konsisten dengan isinya.
const hitung = countBySeverity(campur);
assert.equal(hitung.tinggi + hitung.sedang + hitung.info, campur.length);
assert.equal(hitung.tinggi, 2);
assert.deepEqual(countBySeverity([]), { tinggi: 0, sedang: 0, info: 0 });

// Daftar kosong aman.
assert.deepEqual(buildNotifications([], []), []);

console.log("ok: notifications");
