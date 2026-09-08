/**
 * Cek mandiri validasi agenda: `npx tsx lib/agenda-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/project-form.check.ts.
 */
import assert from "node:assert/strict";
import {
  type AgendaDraft,
  agendaToDraft,
  draftToAgenda,
  emptyAgendaDraft,
  validateAgenda,
  withProjectLocation,
} from "./agenda-form";
import type { AgendaEntry, Project } from "./types";

const ANGGOTA = [1, 2, 3];
const PROYEK = [10, 11];

function draft(over: Partial<AgendaDraft> = {}): AgendaDraft {
  return {
    userId: "1",
    projectId: "10",
    kind: "Lapangan",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    locationCity: "Muara Enim",
    locationProvince: "Sumatera Selatan",
    note: "Akuisisi LiDAR.",
    ...over,
  };
}

const cek = (over: Partial<AgendaDraft> = {}) => validateAgenda(draft(over), ANGGOTA, PROYEK);

// Isian lengkap dan benar tidak menghasilkan pesan apa pun.
assert.deepEqual(cek(), {});

/* --- Anggota --------------------------------------------------------------- */

assert.ok(cek({ userId: "" }).userId);
assert.ok(cek({ userId: "99" }).userId); // bukan anggota
assert.ok(cek({ userId: "abc" }).userId);
assert.equal(cek({ userId: "3" }).userId, undefined);

/* --- Jenis kegiatan -------------------------------------------------------- */

for (const kind of ["Lapangan", "Kantor", "Perjalanan"]) {
  assert.equal(cek({ kind }).kind, undefined);
}
// Cuti sah, asalkan tanpa proyek.
assert.equal(cek({ kind: "Cuti", projectId: "" }).kind, undefined);
assert.ok(cek({ kind: "Libur" }).kind);
assert.ok(cek({ kind: "" }).kind);
assert.ok(cek({ kind: "lapangan" }).kind); // huruf kecil bukan nilai yang sah

/* --- Proyek ---------------------------------------------------------------- */

// Opsional: agenda kantor atau perjalanan tidak harus punya proyek.
assert.equal(cek({ projectId: "" }).projectId, undefined);
assert.equal(cek({ projectId: "   " }).projectId, undefined);
assert.ok(cek({ projectId: "999" }).projectId); // proyek tidak ada

// Cuti berproyek pasti salah isi: laporan ke HR akan menunjukkan orang
// mengerjakan proyek padahal sedang libur.
assert.ok(cek({ kind: "Cuti", projectId: "10" }).projectId);
assert.equal(cek({ kind: "Cuti", projectId: "" }).projectId, undefined);

/* --- Tanggal --------------------------------------------------------------- */

assert.ok(cek({ startDate: "" }).startDate);
assert.ok(cek({ endDate: "" }).endDate);
assert.ok(cek({ startDate: "2026-02-31" }).startDate); // lolos regex, tidak nyata
assert.ok(cek({ endDate: "1 September" }).endDate);

// Sehari penuh sah: mulai dan selesai di tanggal yang sama.
assert.equal(cek({ startDate: "2026-09-01", endDate: "2026-09-01" }).endDate, undefined);
// Terbalik ditolak.
assert.ok(cek({ startDate: "2026-09-05", endDate: "2026-09-01" }).endDate);
// Lintas bulan dan tahun tetap sah.
assert.equal(cek({ startDate: "2026-08-31", endDate: "2026-09-02" }).endDate, undefined);
assert.equal(cek({ startDate: "2026-12-30", endDate: "2027-01-02" }).endDate, undefined);

// Tanggal mulai yang tidak valid tidak ikut memunculkan pesan pada tanggal
// selesai — satu kesalahan, satu pesan.
assert.equal(cek({ startDate: "salah", endDate: "2026-09-01" }).endDate, undefined);

/* --- Panjang teks ---------------------------------------------------------- */

assert.ok(cek({ note: "x".repeat(201) }).note);
assert.equal(cek({ note: "x".repeat(200) }).note, undefined);
assert.ok(cek({ locationCity: "k".repeat(61) }).locationCity);
assert.ok(cek({ locationProvince: "p".repeat(61) }).locationProvince);
// Lokasi boleh kosong: cuti tidak perlu tempat.
assert.equal(cek({ locationCity: "", locationProvince: "" }).locationCity, undefined);

/* --- Lokasi dari proyek ---------------------------------------------------- */

const proyek: Project[] = [
  {
    id: 10,
    name: "Topografi LiDAR",
    description: "",
    type: "Jasa",
    status: "Berjalan",
    priority: "Sedang",
    priorityMode: "auto",
    statusOverride: null,
    progressPct: 0,
    clientOrg: "PT Uji",
    locationCity: "Muara Enim",
    locationProvince: "Sumatera Selatan",
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
    startDate: "2026-09-01",
    deadline: "2026-09-30",
    ownerId: 1,
    updatedAt: "2026-09-01",
  },
];

// Lokasi kosong diisi dari proyeknya.
const terisi = withProjectLocation(draft({ locationCity: "", locationProvince: "" }), proyek);
assert.equal(terisi.locationCity, "Muara Enim");
assert.equal(terisi.locationProvince, "Sumatera Selatan");

// Yang sudah diketik tidak ditimpa — orang bisa menginap di kota sebelah.
const ditimpa = withProjectLocation(draft({ locationCity: "Palembang" }), proyek);
assert.equal(ditimpa.locationCity, "Palembang");
assert.equal(ditimpa.locationProvince, "Sumatera Selatan"); // yang kosong tetap terisi

// Tanpa proyek, isian dibiarkan apa adanya.
assert.deepEqual(withProjectLocation(draft({ projectId: "" }), proyek), draft({ projectId: "" }));
assert.deepEqual(withProjectLocation(draft({ projectId: "999" }), proyek), draft({ projectId: "999" }));

/* --- Bolak-balik ----------------------------------------------------------- */

const hasil = draftToAgenda(draft({ note: "  Dipangkas  " }), 2);
assert.equal(hasil.userId, 1);
assert.equal(hasil.projectId, 10);
assert.equal(hasil.kind, "Lapangan");
assert.equal(hasil.note, "Dipangkas");
// createdBy datang dari pemanggil, bukan dari isian — Manager bisa mengisikan
// untuk anggotanya, dan jejak siapa yang mencatat harus tetap benar.
assert.equal(hasil.createdBy, 2);
assert.match(hasil.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(Object.hasOwn(hasil, "id"), false);

// Proyek kosong jadi null, bukan 0 atau NaN.
assert.equal(draftToAgenda(draft({ projectId: "" }), 1).projectId, null);
assert.equal(draftToAgenda(draft({ projectId: "  " }), 1).projectId, null);

// Agenda tersimpan bisa dimuat ke form lalu dikembalikan tanpa berubah.
const tersimpan: AgendaEntry = {
  id: 5,
  userId: 3,
  projectId: null,
  kind: "Cuti",
  startDate: "2026-09-06",
  endDate: "2026-09-09",
  locationCity: "",
  locationProvince: "",
  note: "Cuti tahunan.",
  createdBy: 3,
  updatedAt: "2026-08-30",
};
const dimuat = agendaToDraft(tersimpan);
assert.equal(dimuat.projectId, ""); // null jadi input kosong, bukan "null"
assert.equal(dimuat.userId, "3");
assert.deepEqual(Object.keys(dimuat).sort(), Object.keys(emptyAgendaDraft(1)).sort());
// Isian hasil muat langsung lolos validasi — agenda lama tidak boleh dianggap salah.
assert.deepEqual(validateAgenda(dimuat, ANGGOTA, PROYEK), {});

const kembali = draftToAgenda(dimuat, 3);
assert.equal(kembali.userId, tersimpan.userId);
assert.equal(kembali.projectId, tersimpan.projectId);
assert.equal(kembali.kind, tersimpan.kind);
assert.equal(kembali.startDate, tersimpan.startDate);
assert.equal(kembali.endDate, tersimpan.endDate);
assert.equal(kembali.note, tersimpan.note);

// Draft kosong menunjuk orang yang meminta, dan tanggalnya wajib diisi.
const baru = emptyAgendaDraft(7);
assert.equal(baru.userId, "7");
assert.equal(baru.projectId, "");
assert.ok(validateAgenda(baru, [7], PROYEK).startDate);

console.log("ok: agenda-form");
