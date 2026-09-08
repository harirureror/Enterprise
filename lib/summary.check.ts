/**
 * Cek mandiri hitungan ringkasan: `npx tsx lib/summary.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 */
import assert from "node:assert/strict";
import { DUE_SOON_DAYS, projectSummary, typeBreakdown } from "./summary";
import type { Project, ProjectPriority, ProjectStatus, ProjectType } from "./types";

function p(
  id: number,
  over: Partial<Project> = {}
): Project {
  return {
    id,
    name: `P${id}`,
    description: "",
    type: "Jasa",
    status: "Berjalan",
    priority: "Sedang",
    priorityMode: "auto",
    statusOverride: null,
    progressPct: 0,
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
    startDate: "2026-08-01",
    deadline: "2026-08-31",
    ownerId: 1,
    updatedAt: "2026-08-01",
    ...over,
  };
}

const HARI_INI = "2026-08-28";
const ringkas = (list: Project[]) => projectSummary(list, { today: HARI_INI });

// Daftar kosong tidak bikin pembagian nol.
const kosong = ringkas([]);
assert.equal(kosong.total, 0);
assert.equal(kosong.avgProgress, 0);
assert.equal(kosong.highPriorityActive, 0);
assert.equal(kosong.overdue, 0);
assert.equal(kosong.dueSoon, 0);
// Semua kunci enum tetap ada meski nilainya nol, jadi UI tidak perlu cek undefined.
assert.deepEqual(Object.keys(kosong.byStatus) as ProjectStatus[], [
  "Prospect",
  "Penawaran",
  "Negosiasi",
  "Berjalan",
  "Tertunda",
  "Selesai",
]);
assert.deepEqual(Object.keys(kosong.byPriority) as ProjectPriority[], [
  "Tinggi",
  "Sedang",
  "Rendah",
]);
assert.deepEqual(Object.keys(kosong.byType) as ProjectType[], [
  "Penjualan",
  "Jasa",
  "Training",
  "Riset",
]);
assert.equal(kosong.byStatus.Selesai, 0);

// Pengelompokan menghitung tiap proyek tepat sekali.
const campur = ringkas([
  p(1, { status: "Prospect", priority: "Tinggi", type: "Penjualan" }),
  p(2, { status: "Berjalan", priority: "Tinggi", type: "Jasa" }),
  p(3, { status: "Berjalan", priority: "Sedang", type: "Training" }),
  p(4, { status: "Selesai", priority: "Rendah", type: "Riset" }),
]);
assert.equal(campur.total, 4);
assert.deepEqual(campur.byStatus, {
  Prospect: 1,
  Penawaran: 0,
  Negosiasi: 0,
  Berjalan: 2,
  Tertunda: 0,
  Selesai: 1,
});
assert.deepEqual(campur.byPriority, { Tinggi: 2, Sedang: 1, Rendah: 1 });
assert.deepEqual(campur.byType, { Penjualan: 1, Jasa: 1, Training: 1, Riset: 1 });
assert.equal(
  Object.values(campur.byStatus).reduce((a, b) => a + b, 0),
  campur.total
);

// Prioritas tinggi yang sudah selesai tidak ikut dihitung sebagai fokus.
const fokus = ringkas([
  p(1, { priority: "Tinggi", status: "Berjalan" }),
  p(2, { priority: "Tinggi", status: "Prospect" }),
  p(3, { priority: "Tinggi", status: "Selesai" }),
  // Tertunda tetap dianggap aktif — proyek diparkir justru perlu dikejar.
  p(4, { priority: "Tinggi", status: "Tertunda" }),
]);
assert.equal(fokus.byPriority.Tinggi, 4);
assert.equal(fokus.highPriorityActive, 3);

// Rata-rata progres dibulatkan dan mencakup seluruh proyek.
assert.equal(ringkas([p(1, { progressPct: 65 }), p(2, { progressPct: 40 })]).avgProgress, 53);
assert.equal(ringkas([p(1, { progressPct: 100 })]).avgProgress, 100);

// Tenggat: lewat = overdue, hari ini dan seminggu ke depan = dueSoon.
const tenggat = ringkas([
  p(1, { deadline: "2026-08-20" }), // lewat
  p(2, { deadline: "2026-08-27" }), // lewat sehari
  p(3, { deadline: HARI_INI }), // hari ini
  p(4, { deadline: "2026-09-04" }), // tepat 7 hari lagi
  p(5, { deadline: "2026-09-05" }), // 8 hari lagi, di luar ambang
]);
assert.equal(tenggat.overdue, 2);
assert.equal(tenggat.dueSoon, 2);
assert.equal(tenggat.dueSoonDays, DUE_SOON_DAYS);
assert.equal(tenggat.asOf, HARI_INI);

// Proyek yang sudah selesai tidak pernah dianggap telat atau perlu follow-up.
const beres = ringkas([
  p(1, { deadline: "2026-08-01", status: "Selesai" }),
  p(2, { deadline: "2026-08-29", status: "Selesai" }),
]);
assert.equal(beres.overdue, 0);
assert.equal(beres.dueSoon, 0);

// Ambang dueSoon bisa diatur pemanggil.
assert.equal(
  projectSummary([p(1, { deadline: "2026-09-20" })], { today: HARI_INI, dueSoonDays: 30 }).dueSoon,
  1
);

// Rincian per jenis: keempat kategori selalu muncul, urutannya tetap.
const perJenis = typeBreakdown(
  [
    p(1, { type: "Penjualan", status: "Berjalan", priority: "Tinggi", progressPct: 60, ownerId: 1 }),
    p(2, { type: "Penjualan", status: "Selesai", progressPct: 100, ownerId: 2, deadline: "2026-08-01" }),
    p(3, { type: "Jasa", status: "Berjalan", progressPct: 40, ownerId: 1, deadline: "2026-08-20" }),
    p(4, { type: "Training", status: "Prospect", progressPct: 0, ownerId: 3, deadline: "2026-09-02" }),
  ],
  { today: HARI_INI }
);
assert.deepEqual(perJenis.map((j) => j.type), ["Penjualan", "Jasa", "Training", "Riset"]);

// Jenis tanpa proyek tetap ada, dengan angka nol dan tanpa tenggat.
const riset = perJenis.find((j) => j.type === "Riset")!;
assert.equal(riset.total, 0);
assert.equal(riset.avgProgress, 0);
assert.equal(riset.owners, 0);
assert.equal(riset.nextDeadline, null);

// Angka per jenis hanya menghitung proyek jenis itu.
const penjualan = perJenis.find((j) => j.type === "Penjualan")!;
assert.equal(penjualan.total, 2);
assert.deepEqual(penjualan.byStatus, {
  Prospect: 0,
  Penawaran: 0,
  Negosiasi: 0,
  Berjalan: 1,
  Tertunda: 0,
  Selesai: 1,
});
assert.equal(penjualan.highPriorityActive, 1);
assert.equal(penjualan.avgProgress, 80); // (60 + 100) / 2
assert.equal(penjualan.owners, 2);
// Proyek yang sudah selesai tidak dihitung telat walau tenggatnya lewat.
assert.equal(penjualan.overdue, 0);

// Tenggat terdekat diambil dari yang belum selesai.
const jasa = perJenis.find((j) => j.type === "Jasa")!;
assert.equal(jasa.nextDeadline, "2026-08-20");
assert.equal(jasa.overdue, 1); // 20 Agustus sudah lewat dari 28 Agustus
const training = perJenis.find((j) => j.type === "Training")!;
assert.equal(training.nextDeadline, "2026-09-02");
assert.equal(training.dueSoon, 1);

// Totalnya tidak bocor: jumlah semua jenis = jumlah proyek.
assert.equal(perJenis.reduce((sum, j) => sum + j.total, 0), 4);

// Daftar kosong aman.
assert.equal(typeBreakdown([]).length, 4);
assert.ok(typeBreakdown([]).every((j) => j.total === 0 && j.nextDeadline === null));

// Nilai proyek: yang aktif masuk pipeline, yang selesai dihitung terpisah.
const nilai = ringkas([
  p(1, { status: "Negosiasi", value: 980_000_000 }),
  p(2, { status: "Berjalan", value: 450_000_000 }),
  p(3, { status: "Tertunda", value: 505_000_000 }), // tertunda tetap masuk pipeline
  p(4, { status: "Selesai", value: 275_000_000 }),
  p(5, { status: "Prospect", value: null }), // belum ada angkanya
]);
assert.equal(nilai.pipelineValue, 980_000_000 + 450_000_000 + 505_000_000);
assert.equal(nilai.completedValue, 275_000_000);
assert.equal(nilai.valueMissing, 1);

// Proyek selesai tanpa nilai tidak dihitung sebagai pipeline yang belum lengkap.
const tanpaNilai = ringkas([p(1, { status: "Selesai", value: null })]);
assert.equal(tanpaNilai.valueMissing, 0);
assert.equal(tanpaNilai.completedValue, 0);

// Daftar kosong tetap memberi angka nol, bukan NaN.
assert.equal(kosong.pipelineValue, 0);
assert.equal(kosong.completedValue, 0);
assert.equal(kosong.valueMissing, 0);

console.log("ok: summary");
