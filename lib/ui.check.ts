/**
 * Cek mandiri urutan daftar proyek: `npx tsx lib/ui.check.ts`
 * ponytail: assert polos, belum pakai test runner — tambah kalau logika urut makin ramai.
 */
import assert from "node:assert/strict";
import type { Project } from "./types";
import { SORT_KEYS, daysUntil, deadlineLabel, sortByPriority, sortProjects } from "./ui";

function p(
  id: number,
  priority: Project["priority"],
  deadline: string,
  over: Partial<Project> = {}
): Project {
  return {
    id,
    name: `P${id}`,
    description: "",
    type: "Jasa",
    status: "Berjalan",
    priority,
    priorityMode: "auto",
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
    deadline,
    ownerId: 1,
    updatedAt: "2026-08-01",
    ...over,
  };
}

const input = [
  p(1, "Rendah", "2026-09-01"),
  p(2, "Tinggi", "2026-09-20"),
  p(3, "Sedang", "2026-09-02"),
  p(4, "Tinggi", "2026-09-05"),
];

const sorted = sortByPriority(input);

// Tinggi di atas, di dalamnya tenggat terdekat dulu.
assert.deepEqual(sorted.map((x) => x.id), [4, 2, 3, 1]);

// Array asal tidak berubah.
assert.deepEqual(input.map((x) => x.id), [1, 2, 3, 4]);

// Daftar kosong aman.
assert.deepEqual(sortByPriority([]), []);

// sortProjects("prioritas") sama dengan sortByPriority.
assert.deepEqual(sortProjects(input, "prioritas"), sortByPriority(input));

const beragam = [
  p(1, "Rendah", "2026-09-10", { progressPct: 80, updatedAt: "2026-08-01" }),
  p(2, "Tinggi", "2026-09-01", { progressPct: 20, updatedAt: "2026-08-20" }),
  p(3, "Sedang", "2026-09-05", { progressPct: 50, updatedAt: "2026-08-10" }),
];

assert.deepEqual(sortProjects(beragam, "tenggat").map((x) => x.id), [2, 3, 1]);
assert.deepEqual(sortProjects(beragam, "progres").map((x) => x.id), [2, 3, 1]);
assert.deepEqual(sortProjects(beragam, "terbaru").map((x) => x.id), [2, 3, 1]);

// Nilai kembar diselesaikan lewat id, jadi urutannya stabil.
const kembar = [
  p(3, "Sedang", "2026-09-01", { progressPct: 10, updatedAt: "2026-08-05" }),
  p(1, "Sedang", "2026-09-01", { progressPct: 10, updatedAt: "2026-08-05" }),
  p(2, "Sedang", "2026-09-01", { progressPct: 10, updatedAt: "2026-08-05" }),
];
assert.deepEqual(sortProjects(kembar, "tenggat").map((x) => x.id), [1, 2, 3]);
assert.deepEqual(sortProjects(kembar, "progres").map((x) => x.id), [1, 2, 3]);
assert.deepEqual(sortProjects(kembar, "terbaru").map((x) => x.id), [1, 2, 3]);

// Semua kunci urut aman untuk daftar kosong dan tidak mengubah array asal.
for (const key of SORT_KEYS) {
  assert.deepEqual(sortProjects([], key), []);
  sortProjects(beragam, key);
  assert.deepEqual(beragam.map((x) => x.id), [1, 2, 3]);
}

// Sisa hari dihitung inklusif dari tanggal acuan, dan bisa negatif kalau lewat.
assert.equal(daysUntil("2026-09-05", "2026-09-01"), 4);
assert.equal(daysUntil("2026-09-01", "2026-09-01"), 0);
assert.equal(daysUntil("2026-08-28", "2026-09-01"), -4);
// Lintas bulan dan lintas tahun tetap benar.
assert.equal(daysUntil("2026-09-01", "2026-08-31"), 1);
assert.equal(daysUntil("2027-01-01", "2026-12-31"), 1);

assert.equal(deadlineLabel("2026-09-05", "2026-09-01"), "4 hari lagi");
assert.equal(deadlineLabel("2026-09-01", "2026-09-01"), "jatuh tempo hari ini");
assert.equal(deadlineLabel("2026-08-28", "2026-09-01"), "telat 4 hari");

console.log("ok: sortProjects");
