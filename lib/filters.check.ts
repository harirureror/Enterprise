/**
 * Cek mandiri filter daftar proyek: `npx tsx lib/filters.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 */
import assert from "node:assert/strict";
import { SEMUA, filterProjects, parseProjectFilter } from "./filters";
import type { Project } from "./types";

function p(id: number, over: Partial<Project> = {}): Project {
  return {
    id,
    name: `P${id}`,
    description: "",
    type: "Jasa",
    status: "Berjalan",
    priority: "Sedang",
    priorityMode: "auto",
    progressPct: 0,
    clientOrg: "",
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

const data = [
  p(1, { name: "Pengadaan GNSS", type: "Penjualan", status: "Berjalan", priority: "Tinggi", ownerId: 1, clientOrg: "PT Karya Bumi" }),
  p(2, { name: "Topografi Cikarang", type: "Jasa", status: "Selesai", priority: "Tinggi", ownerId: 2, clientOrg: "PT Kawasan Industri" }),
  p(3, { name: "Training LiDAR", type: "Training", status: "Penawaran", priority: "Rendah", ownerId: 2, clientName: "Agus Setiawan" }),
  p(4, { name: "Riset Drone", description: "Kajian harga GNSS", type: "Riset", status: "Berjalan", priority: "Sedang", ownerId: 3, contractNo: "SPK/RND/2026/008" }),
];

const ids = (list: Project[]) => list.map((x) => x.id);

// Tanpa filter, atau semuanya "Semua", daftar utuh dan urutannya tidak berubah.
assert.deepEqual(ids(filterProjects(data)), [1, 2, 3, 4]);
assert.deepEqual(
  ids(filterProjects(data, { status: SEMUA, priority: SEMUA, type: SEMUA, ownerId: SEMUA, q: "" })),
  [1, 2, 3, 4]
);

// Tidak mengubah array asal.
const asal = [...data];
filterProjects(data, { status: "Selesai" });
assert.deepEqual(data, asal);

// Filter tunggal per kolom.
assert.deepEqual(ids(filterProjects(data, { status: "Berjalan" })), [1, 4]);
assert.deepEqual(ids(filterProjects(data, { priority: "Tinggi" })), [1, 2]);
assert.deepEqual(ids(filterProjects(data, { type: "Training" })), [3]);
assert.deepEqual(ids(filterProjects(data, { ownerId: 2 })), [2, 3]);

// Beberapa filter digabung dengan DAN, bukan ATAU.
assert.deepEqual(ids(filterProjects(data, { priority: "Tinggi", status: "Selesai" })), [2]);
assert.deepEqual(ids(filterProjects(data, { priority: "Tinggi", ownerId: 3 })), []);

// Pencarian: tidak peduli huruf besar-kecil, spasi pinggir diabaikan,
// dan ikut menyisir deskripsi.
assert.deepEqual(ids(filterProjects(data, { q: "gnss" })), [1, 4]);
assert.deepEqual(ids(filterProjects(data, { q: "  TOPOGRAFI  " })), [2]);
assert.deepEqual(ids(filterProjects(data, { q: "tidak ada" })), []);
assert.deepEqual(ids(filterProjects(data, { q: "   " })), [1, 2, 3, 4]);

// Pencarian juga menyisir instansi dan nama PIC klien.
assert.deepEqual(ids(filterProjects(data, { q: "karya bumi" })), [1]);
assert.deepEqual(ids(filterProjects(data, { q: "PT" })), [1, 2]);
assert.deepEqual(ids(filterProjects(data, { q: "agus" })), [3]);

// Nomor kontrak ikut disisir — itu cara orang mencari proyek saat memegang
// dokumennya, bukan namanya.
assert.deepEqual(ids(filterProjects(data, { q: "SPK/RND" })), [4]);
assert.deepEqual(ids(filterProjects(data, { q: "spk/rnd/2026/008" })), [4]);
// Proyek tanpa nomor kontrak tidak ikut terjaring kata kunci apa pun.
assert.deepEqual(ids(filterProjects(data, { q: "SPK" })), [4]);

// Query string kosong = tidak menyaring apa pun.
const kosong = parseProjectFilter(new URLSearchParams(""));
assert.deepEqual(kosong.invalid, []);
assert.deepEqual(kosong.filter, {
  status: SEMUA,
  priority: SEMUA,
  type: SEMUA,
  ownerId: SEMUA,
  q: "",
});

// Nilai yang sah terbaca apa adanya, termasuk yang mengandung spasi.
const lengkap = parseProjectFilter(
  new URLSearchParams({
    status: "Negosiasi",
    priority: "Tinggi",
    type: "Penjualan",
    ownerId: "2",
    q: " gnss ",
  })
);
assert.deepEqual(lengkap.invalid, []);
assert.deepEqual(lengkap.filter, {
  status: "Negosiasi",
  priority: "Tinggi",
  type: "Penjualan",
  ownerId: 2,
  q: "gnss",
});

// "Semua" dan parameter kosong sama-sama berarti tidak menyaring.
assert.deepEqual(parseProjectFilter(new URLSearchParams({ status: SEMUA })).invalid, []);
assert.equal(parseProjectFilter(new URLSearchParams({ status: "" })).filter.status, SEMUA);

// Nilai di luar daftar dilaporkan, tidak diam-diam diloloskan.
const salah = parseProjectFilter(
  new URLSearchParams({ status: "Pending", priority: "Urgent", type: "Konsultasi" })
);
assert.deepEqual(salah.invalid, ["status", "priority", "type"]);

// Status lama sudah pensiun — jangan diam-diam diperlakukan sebagai "Semua".
assert.deepEqual(parseProjectFilter(new URLSearchParams({ status: "Belum Mulai" })).invalid, [
  "status",
]);
assert.deepEqual(parseProjectFilter(new URLSearchParams({ status: "Sedang Berjalan" })).invalid, [
  "status",
]);

// ownerId harus bilangan bulat.
assert.deepEqual(parseProjectFilter(new URLSearchParams({ ownerId: "abc" })).invalid, ["ownerId"]);
assert.deepEqual(parseProjectFilter(new URLSearchParams({ ownerId: "3.5" })).invalid, ["ownerId"]);
assert.deepEqual(parseProjectFilter(new URLSearchParams({ ownerId: "-1" })).invalid, ["ownerId"]);
assert.equal(parseProjectFilter(new URLSearchParams({ ownerId: "7" })).filter.ownerId, 7);

console.log("ok: filters");
