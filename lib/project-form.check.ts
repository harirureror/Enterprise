/**
 * Cek mandiri validasi form proyek: `npx tsx lib/project-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 */
import assert from "node:assert/strict";
import {
  CLIENT_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  NAME_MIN,
  type ProjectDraft,
  draftToProject,
  emptyDraft,
  projectToDraft,
  validateDraft,
} from "./project-form";
import type { Project } from "./types";

const PIC = [1, 2, 3];

/** Isian yang sudah benar; tiap kasus tinggal merusak satu kolom. */
function draft(over: Partial<ProjectDraft> = {}): ProjectDraft {
  return {
    name: "Survei Batimetri Pelabuhan",
    description: "Pemeruman kedalaman alur pelayaran.",
    type: "Jasa",
    status: "Prospect",
    priority: "Tinggi",
    priorityMode: "auto",
    progressPct: "0",
    clientOrg: "PT Pelindo Regional 3",
    clientName: "Capt. Bambang Sujarwo",
    clientEmail: "bambang.s@pelindo.co.id",
    clientPhone: "+62 811-3344-5566",
    clientTier: "Strategis",
    penaltyRisk: "Denda harian",
    value: "505000000",
    contractNo: "KTR/PLD3/2026/231",
    contractDate: "2026-08-19",
    paymentTerm: "3 Termin",
    paymentNote: "30% DP, 40% progres 70%, 30% BAST.",
    taxType: "PKP",
    salesFee: "20000000",
    operationalCost: "460000000",
    startDate: "2026-09-01",
    deadline: "2026-09-30",
    ownerId: "2",
    ...over,
  };
}

const cek = (over: Partial<ProjectDraft> = {}) => validateDraft(draft(over), PIC);

// Isian lengkap dan benar tidak menghasilkan pesan apa pun.
assert.deepEqual(cek(), {});

// Form kosong: semua kolom wajib dilaporkan sekaligus, bukan satu per satu.
const kosong = validateDraft(emptyDraft(), PIC);
assert.deepEqual(Object.keys(kosong).sort(), [
  "clientOrg",
  "deadline",
  "name",
  "ownerId",
  "startDate",
  "type",
]);
// Status, prioritas, dan progres sudah punya nilai awal yang sah.
assert.equal(kosong.status, undefined);
assert.equal(kosong.priority, undefined);
assert.equal(kosong.progressPct, undefined);

// Nama: wajib, ada batas bawah dan atas, spasi tidak dihitung sebagai isi.
assert.ok(cek({ name: "   " }).name);
assert.ok(cek({ name: "A".repeat(NAME_MIN - 1) }).name);
assert.equal(cek({ name: "A".repeat(NAME_MIN) }).name, undefined);
assert.equal(cek({ name: "A".repeat(NAME_MAX) }).name, undefined);
assert.ok(cek({ name: "A".repeat(NAME_MAX + 1) }).name);

// Deskripsi boleh kosong, tapi ada batas panjang.
assert.equal(cek({ description: "" }).description, undefined);
assert.equal(cek({ description: "A".repeat(DESCRIPTION_MAX) }).description, undefined);
assert.ok(cek({ description: "A".repeat(DESCRIPTION_MAX + 1) }).description);

// Enum: kosong dan nilai asing sama-sama ditolak, pesannya dibedakan.
assert.equal(cek({ type: "" }).type, "Jenis proyek wajib dipilih.");
assert.equal(cek({ type: "Konsultasi" }).type, "Jenis proyek tidak dikenal.");
assert.ok(cek({ status: "Pending" }).status);
assert.ok(cek({ priority: "Urgent" }).priority);

// Progres: bilangan bulat 0-100.
assert.equal(cek({ progressPct: "0" }).progressPct, undefined);
assert.equal(cek({ progressPct: "100" }).progressPct, undefined);
assert.ok(cek({ progressPct: "" }).progressPct);
assert.ok(cek({ progressPct: "abc" }).progressPct);
assert.ok(cek({ progressPct: "50.5" }).progressPct);
assert.ok(cek({ progressPct: "-1" }).progressPct);
assert.ok(cek({ progressPct: "101" }).progressPct);

// Tanggal: format ISO dan harus benar-benar ada di kalender.
assert.ok(cek({ startDate: "" }).startDate);
assert.ok(cek({ startDate: "01-09-2026" }).startDate);
assert.ok(cek({ startDate: "2026-02-31" }).startDate);
assert.equal(cek({ startDate: "2026-02-28" }).startDate, undefined);

// Tenggat tidak boleh mendahului tanggal mulai; hari yang sama boleh.
assert.ok(cek({ startDate: "2026-09-10", deadline: "2026-09-01" }).deadline);
assert.equal(cek({ startDate: "2026-09-10", deadline: "2026-09-10" }).deadline, undefined);
// Kalau tanggal mulai sendiri sudah salah, tenggat tidak ikut disalahkan.
assert.equal(cek({ startDate: "bukan tanggal", deadline: "2026-09-01" }).deadline, undefined);

// Instansi klien wajib; spasi saja tidak dihitung sebagai isi.
assert.ok(cek({ clientOrg: "" }).clientOrg);
assert.ok(cek({ clientOrg: "   " }).clientOrg);
assert.ok(cek({ clientOrg: "A".repeat(CLIENT_MAX + 1) }).clientOrg);
assert.equal(cek({ clientOrg: "A".repeat(CLIENT_MAX) }).clientOrg, undefined);

// Nama PIC klien opsional, tapi tetap ada batas panjang.
assert.equal(cek({ clientName: "" }).clientName, undefined);
assert.ok(cek({ clientName: "A".repeat(CLIENT_MAX + 1) }).clientName);

// Email opsional; kalau diisi bentuknya harus masuk akal.
assert.equal(cek({ clientEmail: "" }).clientEmail, undefined);
assert.equal(cek({ clientEmail: "a@b.co" }).clientEmail, undefined);
assert.ok(cek({ clientEmail: "bukan-email" }).clientEmail);
assert.ok(cek({ clientEmail: "a@b" }).clientEmail);
assert.ok(cek({ clientEmail: "a b@c.co" }).clientEmail);

// Telepon opsional; menerima format Indonesia yang lazim.
assert.equal(cek({ clientPhone: "" }).clientPhone, undefined);
assert.equal(cek({ clientPhone: "+62 812-3456-7890" }).clientPhone, undefined);
assert.equal(cek({ clientPhone: "(022) 4231-9080" }).clientPhone, undefined);

// Tingkat klien dan risiko penalti adalah pilihan tertutup — di luar daftar ditolak,
// bukan diam-diam disimpan sebagai teks bebas.
assert.equal(cek({ clientTier: "VIP" }).clientTier, undefined);
assert.equal(cek({ clientTier: "Internal" }).clientTier, undefined);
assert.ok(cek({ clientTier: "Platinum" }).clientTier);
assert.ok(cek({ clientTier: "" }).clientTier);
assert.ok(cek({ clientTier: "vip" }).clientTier); // huruf kecil bukan nilai yang sah
assert.equal(cek({ penaltyRisk: "Putus kontrak" }).penaltyRisk, undefined);
assert.equal(cek({ penaltyRisk: "Tidak ada" }).penaltyRisk, undefined);
assert.ok(cek({ penaltyRisk: "Blacklist" }).penaltyRisk);
assert.ok(cek({ penaltyRisk: "" }).penaltyRisk);
assert.ok(cek({ clientPhone: "hubungi saya" }).clientPhone);
assert.ok(cek({ clientPhone: "123" }).clientPhone); // terlalu pendek

/* --- Detail kontrak -------------------------------------------------------- */

// Nomor kontrak opsional — proyek tahap Prospect memang belum punya.
assert.equal(cek({ contractNo: "" }).contractNo, undefined);
assert.equal(cek({ contractNo: "SPK/ABC/2026/001" }).contractNo, undefined);
assert.ok(cek({ contractNo: "K".repeat(61) }).contractNo);
assert.equal(cek({ contractNo: "K".repeat(60) }).contractNo, undefined);

// Tanggal kontrak opsional, tapi kalau diisi harus benar-benar ada di kalender.
assert.equal(cek({ contractDate: "" }).contractDate, undefined);
assert.equal(cek({ contractDate: "2026-02-28" }).contractDate, undefined);
assert.ok(cek({ contractDate: "2026-02-31" }).contractDate);
assert.ok(cek({ contractDate: "19 Agustus" }).contractDate);

// Sengaja tidak ada aturan silang: kontrak boleh diteken setelah pekerjaan
// dimulai (SPK/LoI lebih dulu), dan itu bukan kesalahan pengisian.
assert.equal(
  cek({ contractDate: "2026-09-20", startDate: "2026-09-01", deadline: "2026-09-30" }).contractDate,
  undefined
);

// TOP adalah pilihan tertutup.
assert.equal(cek({ paymentTerm: "Full" }).paymentTerm, undefined);
assert.equal(cek({ paymentTerm: "3 Termin" }).paymentTerm, undefined);
assert.ok(cek({ paymentTerm: "Termin" }).paymentTerm);
assert.ok(cek({ paymentTerm: "" }).paymentTerm);

// "Custom" tanpa keterangan tidak memberi tahu apa pun, jadi ditolak.
assert.ok(cek({ paymentTerm: "Custom", paymentNote: "" }).paymentNote);
assert.ok(cek({ paymentTerm: "Custom", paymentNote: "   " }).paymentNote);
assert.equal(cek({ paymentTerm: "Custom", paymentNote: "40/40/20" }).paymentNote, undefined);
// Skema baku tidak mewajibkan keterangan.
assert.equal(cek({ paymentTerm: "Full", paymentNote: "" }).paymentNote, undefined);
assert.ok(cek({ paymentNote: "x".repeat(201) }).paymentNote);

// Status pajak pilihan tertutup.
assert.equal(cek({ taxType: "PKP" }).taxType, undefined);
assert.equal(cek({ taxType: "Non PKP" }).taxType, undefined);
assert.ok(cek({ taxType: "NonPKP" }).taxType);
assert.ok(cek({ taxType: "" }).taxType);

// Sales fee dan cost operasional: opsional, bulat, tidak negatif.
for (const field of ["salesFee", "operationalCost"] as const) {
  assert.equal(cek({ [field]: "" })[field], undefined);
  assert.equal(cek({ [field]: "0" })[field], undefined);
  assert.equal(cek({ [field]: "15000000" })[field], undefined);
  assert.ok(cek({ [field]: "-1" })[field]);
  assert.ok(cek({ [field]: "1.5" })[field]);
  assert.ok(cek({ [field]: "banyak" })[field]);
}

// Biaya melebihi nilai kontrak tidak ditolak: proyek rugi itu keadaan nyata,
// dan menyembunyikannya justru membuat kerugiannya tidak pernah terlihat.
assert.equal(cek({ value: "100000000", operationalCost: "200000000" }).operationalCost, undefined);

// Nilai proyek opsional; kalau diisi harus bilangan bulat tidak negatif.
assert.equal(cek({ value: "" }).value, undefined);
assert.equal(cek({ value: "0" }).value, undefined);
assert.equal(cek({ value: "1850000000" }).value, undefined);
assert.ok(cek({ value: "-1" }).value);
assert.ok(cek({ value: "12.5" }).value);
assert.ok(cek({ value: "seratus juta" }).value);

// PIC harus salah satu anggota yang terdaftar.
assert.ok(cek({ ownerId: "" }).ownerId);
assert.ok(cek({ ownerId: "99" }).ownerId);
assert.equal(cek({ ownerId: "3" }).ownerId, undefined);

// Konversi: spasi dipangkas, angka jadi number, updatedAt diisi tanggal hari ini.
const hasil = draftToProject(draft({ name: "  Proyek Baru  ", description: "  Isi  ", progressPct: "45" }));
assert.equal(hasil.name, "Proyek Baru");
assert.equal(hasil.description, "Isi");
assert.equal(hasil.progressPct, 45);
assert.equal(hasil.ownerId, 2);
assert.match(hasil.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(Object.hasOwn(hasil, "id"), false);

// Kolom klien ikut dipangkas spasinya; nilai jadi angka.
const rapi = draftToProject(draft({ clientOrg: "  PT Uji  ", clientEmail: "  a@b.co  ", value: " 450000000 " }));
assert.equal(rapi.clientOrg, "PT Uji");
assert.equal(rapi.clientEmail, "a@b.co");
assert.equal(rapi.value, 450_000_000);

// Nilai kosong berarti "belum ada angka", bukan nol rupiah.
assert.equal(draftToProject(draft({ value: "" })).value, null);
assert.equal(draftToProject(draft({ value: "   " })).value, null);
assert.equal(draftToProject(draft({ value: "0" })).value, 0);

// Proyek yang sudah ada bisa dimuat ke form lalu dikembalikan tanpa berubah.
const tersimpan: Project = {
  id: 7,
  name: "Kalibrasi Total Station",
  description: "Layanan kalibrasi berkala.",
  type: "Jasa",
  status: "Berjalan",
  priority: "Sedang",
  priorityMode: "manual",
  progressPct: 55,
  clientOrg: "Dinas PU Kota Bandung",
  clientName: "Dedi Kurniawan",
  clientEmail: "dedi.k@bandung.go.id",
  clientPhone: "(022) 4231-9080",
  clientTier: "Reguler",
  penaltyRisk: "Denda tetap",
  value: 275_000_000,
  contractNo: "SPK/DPUBDG/2026/019",
  contractDate: "2026-07-20",
  paymentTerm: "Custom",
  paymentNote: "50% di muka, sisanya setelah sertifikat kalibrasi terbit.",
  taxType: "PKP",
  salesFee: 8_000_000,
  operationalCost: null,
  startDate: "2026-07-28",
  deadline: "2026-08-15",
  ownerId: 3,
  updatedAt: "2026-08-15",
};

const dimuat = projectToDraft(tersimpan);
// Semua kolom form terisi, dan angkanya jadi string seperti nilai input HTML.
assert.equal(dimuat.progressPct, "55");
assert.equal(dimuat.ownerId, "3");
assert.equal(dimuat.value, "275000000");
assert.equal(dimuat.clientOrg, "Dinas PU Kota Bandung");
assert.equal(dimuat.clientTier, "Reguler");
assert.equal(dimuat.penaltyRisk, "Denda tetap");
assert.deepEqual(Object.keys(dimuat).sort(), Object.keys(emptyDraft()).sort());

// Proyek tanpa nilai jadi input kosong, bukan tulisan "null".
assert.equal(projectToDraft({ ...tersimpan, value: null }).value, "");

// Isian hasil muat langsung lolos validasi — proyek lama tidak boleh dianggap salah.
assert.deepEqual(validateDraft(dimuat, PIC), {});

// Bolak-balik draft → proyek mempertahankan datanya (kecuali updatedAt yang memang diperbarui).
const kembali = draftToProject(dimuat);
assert.equal(kembali.name, tersimpan.name);
assert.equal(kembali.type, tersimpan.type);
assert.equal(kembali.status, tersimpan.status);
assert.equal(kembali.priority, tersimpan.priority);
assert.equal(kembali.progressPct, tersimpan.progressPct);
assert.equal(kembali.startDate, tersimpan.startDate);
assert.equal(kembali.deadline, tersimpan.deadline);
assert.equal(kembali.ownerId, tersimpan.ownerId);
assert.equal(kembali.contractNo, tersimpan.contractNo);
assert.equal(kembali.contractDate, tersimpan.contractDate);
assert.equal(kembali.paymentTerm, tersimpan.paymentTerm);
assert.equal(kembali.paymentNote, tersimpan.paymentNote);
assert.equal(kembali.taxType, tersimpan.taxType);
assert.equal(kembali.salesFee, tersimpan.salesFee);
// null tetap null lewat form, bukan berubah jadi 0.
assert.equal(kembali.operationalCost, null);

// Kontrak yang belum ada: null jadi input kosong, lalu kembali null.
const tanpaKontrak = projectToDraft({ ...tersimpan, contractDate: null, salesFee: null });
assert.equal(tanpaKontrak.contractDate, "");
assert.equal(tanpaKontrak.salesFee, "");
assert.equal(draftToProject(tanpaKontrak).contractDate, null);
assert.equal(draftToProject(tanpaKontrak).salesFee, null);

// Angka kontrak dipangkas spasinya seperti kolom rupiah lain.
assert.equal(draftToProject(draft({ salesFee: " 20000000 " })).salesFee, 20_000_000);
assert.equal(draftToProject(draft({ contractNo: "  SPK/X/1  " })).contractNo, "SPK/X/1");

console.log("ok: project-form");
