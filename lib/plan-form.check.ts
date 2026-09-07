/**
 * Cek mandiri validasi rencana strategis: `npx tsx lib/plan-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/agenda-form.check.ts.
 */
import assert from "node:assert/strict";
import {
  type PlanDraft,
  type ProspectDraft,
  type StepDraft,
  draftToPlan,
  draftToProspect,
  draftToStep,
  emptyPlanDraft,
  emptyProspectDraft,
  emptyStepDraft,
  planToDraft,
  prospectToDraft,
  stepToDraft,
  validatePlan,
  validateProspect,
  validateStep,
} from "./plan-form";
import {
  PLAN_GOALS,
  PLAN_KINDS,
  PLAN_SEGMENTS,
  PLAN_STATUSES,
  PROSPECT_STATUSES,
  STEP_STATUSES,
  type PlanProspect,
  type PlanStep,
  type StrategicPlan,
} from "./types";

const PIC = [1, 2, 3];

/* --- Rencana ---------------------------------------------------------------- */

function draft(over: Partial<PlanDraft> = {}): PlanDraft {
  return {
    title: "Pelatihan Inspektur Tambang",
    summary: "Membangun kedekatan dengan regulator lewat pelatihan teknis.",
    kind: "Pelatihan",
    goal: "Penetrasi Pasar",
    segment: "Tambang",
    region: "Kalimantan Timur",
    partner: "Inspektur Tambang (Kementerian ESDM)",
    status: "Disetujui",
    priority: "Tinggi",
    ownerId: "1",
    startDate: "2026-10-01",
    targetDate: "2026-12-20",
    outcome: "Dua angkatan pelatihan dan tiga prospek baru.",
    ...over,
  };
}

const cek = (over: Partial<PlanDraft> = {}) => validatePlan(draft(over), PIC);

assert.deepEqual(cek(), {});

// Judul
assert.ok(cek({ title: "" }).title);
assert.ok(cek({ title: "  " }).title);
assert.ok(cek({ title: "ab" }).title);
assert.equal(cek({ title: "abc" }).title, undefined);
assert.ok(cek({ title: "x".repeat(121) }).title);
assert.equal(cek({ title: "x".repeat(120) }).title, undefined);

// Panjang teks lain
assert.ok(cek({ summary: "x".repeat(1001) }).summary);
assert.ok(cek({ outcome: "x".repeat(301) }).outcome);
assert.ok(cek({ partner: "x".repeat(121) }).partner);
assert.ok(cek({ region: "x".repeat(61) }).region);
// Semuanya opsional.
assert.deepEqual(cek({ summary: "", outcome: "", partner: "", region: "" }), {});

// Keempat enum tertutup — daftarnya diambil dari konstanta supaya tidak
// melenceng dari union tanpa ketahuan.
for (const k of PLAN_KINDS) assert.equal(cek({ kind: k }).kind, undefined);
for (const g of PLAN_GOALS) assert.equal(cek({ goal: g }).goal, undefined);
for (const sg of PLAN_SEGMENTS) assert.equal(cek({ segment: sg }).segment, undefined);
for (const st of PLAN_STATUSES) assert.equal(cek({ status: st }).status, undefined);

assert.ok(cek({ kind: "Workshop" }).kind);
assert.ok(cek({ kind: "pelatihan" }).kind); // huruf kecil bukan nilai yang sah
assert.ok(cek({ goal: "Cuan" }).goal);
assert.ok(cek({ segment: "Retail" }).segment);
assert.ok(cek({ status: "Draf" }).status);
assert.ok(cek({ priority: "Urgent" }).priority);
assert.ok(cek({ kind: "" }).kind);

// Penanggung jawab
assert.ok(cek({ ownerId: "" }).ownerId);
assert.ok(cek({ ownerId: "99" }).ownerId);
assert.equal(cek({ ownerId: "3" }).ownerId, undefined);

/* Tanggal seluruhnya opsional: sebuah ide belum tentu berjadwal, dan memaksa
   mengisinya hanya akan membuat orang mengarang tanggal. */
assert.deepEqual(cek({ startDate: "", targetDate: "" }), {});
assert.equal(cek({ startDate: "", targetDate: "2026-12-01" }).targetDate, undefined);
assert.equal(cek({ startDate: "2026-10-01", targetDate: "" }).startDate, undefined);

assert.ok(cek({ startDate: "2026-02-31" }).startDate); // lolos regex, tidak nyata
assert.ok(cek({ targetDate: "1 Desember" }).targetDate);
// Sehari penuh sah.
assert.equal(cek({ startDate: "2026-10-01", targetDate: "2026-10-01" }).targetDate, undefined);
// Terbalik ditolak.
assert.ok(cek({ startDate: "2026-12-01", targetDate: "2026-10-01" }).targetDate);
// Lintas tahun tetap sah.
assert.equal(cek({ startDate: "2026-12-20", targetDate: "2027-02-01" }).targetDate, undefined);
// Satu kesalahan, satu pesan: tanggal mulai rusak tidak ikut menuduh target.
assert.equal(cek({ startDate: "salah", targetDate: "2026-12-01" }).targetDate, undefined);

// Bolak-balik
const hasil = draftToPlan(draft({ title: "  Dipangkas  ", region: "  Papua  " }), 2);
assert.equal(hasil.title, "Dipangkas");
assert.equal(hasil.region, "Papua");
assert.equal(hasil.ownerId, 1);
// createdBy datang dari pemanggil, bukan dari isian.
assert.equal(hasil.createdBy, 2);
assert.match(hasil.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(Object.hasOwn(hasil, "id"), false);
// Tanggal kosong jadi null, bukan string kosong.
assert.equal(draftToPlan(draft({ startDate: "", targetDate: "" }), 1).startDate, null);
assert.equal(draftToPlan(draft({ startDate: "", targetDate: "" }), 1).targetDate, null);

const tersimpan: StrategicPlan = {
  id: 7,
  title: "Riset Arkeologi & Carbon Stock",
  summary: "Kesiapan menghadapi aturan baru.",
  kind: "Riset",
  goal: "Kesiapan Regulasi",
  segment: "Akademik",
  region: "Jawa Tengah",
  partner: "Undip & ITERA",
  status: "Berjalan",
  priority: "Tinggi",
  ownerId: 2,
  startDate: null,
  targetDate: null,
  outcome: "Dua publikasi dan satu metode baku.",
  createdBy: 1,
  updatedAt: "2026-09-01",
};
const dimuat = planToDraft(tersimpan);
assert.equal(dimuat.startDate, ""); // null jadi input kosong
assert.equal(dimuat.ownerId, "2");
assert.deepEqual(Object.keys(dimuat).sort(), Object.keys(emptyPlanDraft(1)).sort());
// Rencana lama tidak boleh dianggap salah saat dimuat ke form.
assert.deepEqual(validatePlan(dimuat, [2]), {});

// Draft kosong belum lolos, dan statusnya paling awal.
const baru = emptyPlanDraft(3);
assert.equal(baru.status, "Ide");
assert.equal(baru.ownerId, "3");
assert.ok(validatePlan(baru, PIC).title);

/* --- Langkah ---------------------------------------------------------------- */

const langkah = (over: Partial<StepDraft> = {}): StepDraft => ({
  title: "Susun silabus",
  ownerId: "1",
  targetDate: "2026-10-15",
  status: "Belum",
  note: "",
  ...over,
});
const cekLangkah = (over: Partial<StepDraft> = {}) => validateStep(langkah(over), PIC);

assert.deepEqual(cekLangkah(), {});
assert.ok(cekLangkah({ title: "" }).title);
assert.ok(cekLangkah({ title: "ab" }).title);
assert.ok(cekLangkah({ title: "x".repeat(121) }).title);

// Penanggung jawab opsional: langkah boleh disusun sebelum ada yang ditugaskan.
assert.equal(cekLangkah({ ownerId: "" }).ownerId, undefined);
assert.ok(cekLangkah({ ownerId: "99" }).ownerId);

for (const st of STEP_STATUSES) assert.equal(cekLangkah({ status: st }).status, undefined);
assert.ok(cekLangkah({ status: "Tertunda" }).status);

// Tanggal opsional dan tetap harus nyata kalau diisi.
assert.equal(cekLangkah({ targetDate: "" }).targetDate, undefined);
assert.ok(cekLangkah({ targetDate: "2026-02-31" }).targetDate);
assert.ok(cekLangkah({ note: "x".repeat(301) }).note);

const langkahJadi = draftToStep(langkah({ title: "  Audiensi  ", ownerId: "" }), 5, 3);
assert.equal(langkahJadi.title, "Audiensi");
assert.equal(langkahJadi.planId, 5);
assert.equal(langkahJadi.sortOrder, 3);
// Tanpa penanggung jawab jadi null, bukan 0 atau NaN.
assert.equal(langkahJadi.ownerId, null);

const stepTersimpan: PlanStep = {
  id: 3,
  planId: 5,
  title: "Evaluasi angkatan 1",
  ownerId: null,
  targetDate: null,
  status: "Berjalan",
  note: "Menunggu umpan balik peserta.",
  sortOrder: 4,
};
const stepDimuat = stepToDraft(stepTersimpan);
assert.equal(stepDimuat.ownerId, "");
assert.equal(stepDimuat.targetDate, "");
assert.deepEqual(Object.keys(stepDimuat).sort(), Object.keys(emptyStepDraft()).sort());
assert.deepEqual(validateStep(stepDimuat, PIC), {});

/* --- Prospek ---------------------------------------------------------------- */

const prospek = (over: Partial<ProspectDraft> = {}): ProspectDraft => ({
  name: "PT Tambang Sejahtera",
  contact: "Bpk. Andi",
  region: "Kalimantan Timur",
  status: "Belum dihubungi",
  note: "",
  ...over,
});
const cekProspek = (over: Partial<ProspectDraft> = {}) => validateProspect(prospek(over));

assert.deepEqual(cekProspek(), {});
assert.ok(cekProspek({ name: "" }).name);
assert.ok(cekProspek({ name: "   " }).name);
assert.ok(cekProspek({ name: "x".repeat(121) }).name);

for (const st of PROSPECT_STATUSES) assert.equal(cekProspek({ status: st }).status, undefined);
assert.ok(cekProspek({ status: "Closing" }).status);

// Kontak, wilayah, dan catatan opsional.
assert.deepEqual(cekProspek({ contact: "", region: "", note: "" }), {});
assert.ok(cekProspek({ contact: "x".repeat(121) }).contact);
assert.ok(cekProspek({ region: "x".repeat(61) }).region);
assert.ok(cekProspek({ note: "x".repeat(301) }).note);

const prospekJadi = draftToProspect(prospek({ name: "  PT Uji  " }), 9);
assert.equal(prospekJadi.name, "PT Uji");
assert.equal(prospekJadi.planId, 9);
assert.match(prospekJadi.updatedAt, /^\d{4}-\d{2}-\d{2}$/);

const prospekTersimpan: PlanProspect = {
  id: 2,
  planId: 9,
  name: "PT Batubara Nusantara",
  contact: "",
  region: "",
  status: "Menjadi Klien",
  note: "",
  updatedAt: "2026-09-01",
};
const prospekDimuat = prospectToDraft(prospekTersimpan);
assert.deepEqual(Object.keys(prospekDimuat).sort(), Object.keys(emptyProspectDraft()).sort());
assert.deepEqual(validateProspect(prospekDimuat), {});

console.log("ok: plan-form");
