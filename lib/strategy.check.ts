/**
 * Cek mandiri hitungan rencana strategis: `npx tsx lib/strategy.check.ts`
 * ponytail: assert polos, sejalan dengan lib/agenda.check.ts.
 */
import assert from "node:assert/strict";
import {
  type Coverage,
  coverage,
  coverageSummary,
  groupByGoal,
  needsAttention,
  planProgress,
  prospectWins,
  stepsDueBetween,
} from "./strategy";
import {
  PLAN_GOALS,
  type PlanProspect,
  type PlanStep,
  type ProspectStatus,
  type StepStatus,
  type StrategicPlan,
} from "./types";

const HARI_INI = "2026-09-15";

function step(id: number, status: StepStatus, targetDate: string | null = null): PlanStep {
  return {
    id,
    planId: 1,
    title: `Langkah ${id}`,
    ownerId: null,
    targetDate,
    status,
    note: "",
    sortOrder: id,
  };
}

function plan(over: Partial<StrategicPlan> = {}): StrategicPlan {
  return {
    id: 1,
    title: "Rencana Uji",
    summary: "",
    kind: "Pelatihan",
    goal: "Penetrasi Pasar",
    segment: "Tambang",
    region: "Kalimantan Timur",
    partner: "",
    status: "Berjalan",
    priority: "Sedang",
    ownerId: 1,
    startDate: null,
    targetDate: null,
    outcome: "",
    createdBy: 1,
    updatedAt: "2026-09-01",
    ...over,
  };
}

function prospek(id: number, status: ProspectStatus, region = "Kalimantan Timur"): PlanProspect {
  return {
    id,
    planId: 1,
    name: `Calon ${id}`,
    contact: "",
    region,
    status,
    note: "",
    updatedAt: "2026-09-01",
  };
}

/* --- planProgress ----------------------------------------------------------- */

// Belum ada langkah: tidak membagi nol, dan progresnya nol — bukan 100.
const nol = planProgress([], HARI_INI);
assert.deepEqual(nol, { total: 0, selesai: 0, pct: 0, telat: 0 });

// Semua selesai.
assert.equal(planProgress([step(1, "Selesai"), step(2, "Selesai")], HARI_INI).pct, 100);

// Separuh.
assert.equal(planProgress([step(1, "Selesai"), step(2, "Belum")], HARI_INI).pct, 50);

// Dibulatkan, bukan dipotong: 1 dari 3 = 33%.
assert.equal(
  planProgress([step(1, "Selesai"), step(2, "Belum"), step(3, "Berjalan")], HARI_INI).pct,
  33
);

/* Langkah Batal tidak dihitung sebagai selesai MAUPUN sebagai penyebut.
   Kalau ia masuk penyebut, membatalkan satu langkah akan menurunkan progres
   rencana — padahal yang dibatalkan justru tidak perlu dikerjakan lagi. */
const denganBatal = planProgress(
  [step(1, "Selesai"), step(2, "Batal"), step(3, "Belum")],
  HARI_INI
);
assert.equal(denganBatal.total, 2);
assert.equal(denganBatal.selesai, 1);
assert.equal(denganBatal.pct, 50);

// Semuanya dibatalkan: kembali ke keadaan "tidak ada yang dihitung".
assert.deepEqual(planProgress([step(1, "Batal"), step(2, "Batal")], HARI_INI), {
  total: 0,
  selesai: 0,
  pct: 0,
  telat: 0,
});

/* Telat hanya menghitung yang tanggalnya lewat DAN belum selesai. */
const telat = planProgress(
  [
    step(1, "Belum", "2026-09-01"), // lewat, belum selesai -> telat
    step(2, "Berjalan", "2026-09-14"), // lewat sehari, belum selesai -> telat
    step(3, "Selesai", "2026-09-01"), // lewat tapi sudah selesai -> tidak
    step(4, "Belum", HARI_INI), // jatuh tempo hari ini -> belum telat
    step(5, "Belum", "2026-09-30"), // masih akan datang -> tidak
    step(6, "Belum", null), // belum dijadwalkan -> tidak pernah telat
    step(7, "Batal", "2026-01-01"), // dibatalkan -> tidak dihitung
  ],
  HARI_INI
);
assert.equal(telat.telat, 2);

/* --- stepsDueBetween -------------------------------------------------------- */

const daftar = [
  step(1, "Belum", "2026-09-13"),
  step(2, "Belum", "2026-09-14"), // tepat di ujung awal
  step(3, "Belum", "2026-09-17"),
  step(4, "Belum", "2026-09-20"), // tepat di ujung akhir
  step(5, "Belum", "2026-09-21"),
  step(6, "Belum", null),
];
assert.deepEqual(
  stepsDueBetween(daftar, "2026-09-14", "2026-09-20").map((s) => s.id),
  [2, 3, 4]
);
// Langkah tanpa tanggal tidak pernah ikut.
assert.deepEqual(stepsDueBetween([step(9, "Belum", null)], "2020-01-01", "2030-01-01"), []);
assert.deepEqual(stepsDueBetween([], "2026-09-01", "2026-09-30"), []);

/* --- groupByGoal ------------------------------------------------------------ */

const kelompok = groupByGoal([
  plan({ id: 1, goal: "Penetrasi Pasar" }),
  plan({ id: 2, goal: "Kesiapan Regulasi" }),
  plan({ id: 3, goal: "Penetrasi Pasar" }),
]);

// Keempat tujuan selalu muncul, urutannya tetap.
assert.equal(kelompok.length, PLAN_GOALS.length);
assert.deepEqual(kelompok.map((k) => k.goal), PLAN_GOALS);
assert.deepEqual(kelompok[0].plans.map((p) => p.id), [1, 3]);
assert.deepEqual(kelompok[1].plans.map((p) => p.id), [2]);
// Tujuan tanpa rencana tetap ada dengan daftar kosong — itu informasi.
assert.deepEqual(kelompok[3].plans, []);

// Tiap rencana muncul tepat sekali.
assert.equal(kelompok.reduce((n, k) => n + k.plans.length, 0), 3);
assert.equal(groupByGoal([]).length, PLAN_GOALS.length);

/* --- needsAttention --------------------------------------------------------- */

// Target rencana sudah lewat.
assert.equal(needsAttention(plan({ targetDate: "2026-09-01" }), [], HARI_INI), true);
// Target masih akan datang, langkah aman.
assert.equal(needsAttention(plan({ targetDate: "2026-12-01" }), [step(1, "Belum", "2026-11-01")], HARI_INI), false);
// Ada langkah telat walau target rencananya belum lewat.
assert.equal(
  needsAttention(plan({ targetDate: "2026-12-01" }), [step(1, "Belum", "2026-09-01")], HARI_INI),
  true
);

// Rencana yang sudah tidak aktif tidak pernah menyala, betapapun telatnya.
for (const status of ["Selesai", "Dibatalkan"] as const) {
  assert.equal(
    needsAttention(plan({ status, targetDate: "2020-01-01" }), [step(1, "Belum", "2020-01-01")], HARI_INI),
    false,
    `${status} seharusnya tidak perlu perhatian`
  );
}
// Ide yang tanggalnya lewat tetap perlu perhatian — ia masih aktif.
assert.equal(
  needsAttention(plan({ status: "Ide", targetDate: "2026-01-01" }), [], HARI_INI),
  true
);

/* --- coverage --------------------------------------------------------------- */

const proyek = (locationProvince: string) => ({ locationProvince });

const jangkauan = coverage(
  [proyek("Jawa Tengah"), proyek("Jawa Tengah"), proyek("Sumatera Selatan")],
  [plan({ region: "Kalimantan Timur" }), plan({ region: "Jawa Tengah" })],
  [prospek(1, "Dihubungi", "Kalimantan Timur"), prospek(2, "Belum dihubungi", "Papua")]
);

const cari = (nama: string) => jangkauan.find((c) => c.region === nama)!;

assert.equal(cari("Jawa Tengah").projects, 2);
assert.equal(cari("Jawa Tengah").plans, 1);
assert.equal(cari("Jawa Tengah").baru, false); // sudah ada proyeknya

// Ada rencana, belum ada proyek -> wilayah yang sedang dituju.
assert.equal(cari("Kalimantan Timur").projects, 0);
assert.equal(cari("Kalimantan Timur").baru, true);
// Prospek saja pun cukup untuk menandai wilayah sebagai dituju.
assert.equal(cari("Papua").prospects, 1);
assert.equal(cari("Papua").baru, true);
// Sudah ada proyeknya tapi tidak ada rencana: bukan wilayah baru.
assert.equal(cari("Sumatera Selatan").baru, false);

// Yang sedang dituju berada di urutan atas.
assert.ok(jangkauan[0].baru && jangkauan[1].baru);
assert.ok(!jangkauan[jangkauan.length - 1].baru);

// Wilayah kosong tidak pernah jadi baris hantu.
const denganKosong = coverage([proyek(""), proyek("   ")], [plan({ region: "" })], []);
assert.deepEqual(denganKosong, []);

/* Ejaan berbeda TIDAK digabung — ketidakseragaman pengisian perlu terlihat,
   bukan disembunyikan tebakan yang bisa saja salah. */
const ejaan = coverage([proyek("Kepri")], [plan({ region: "Kepulauan Riau" })], []);
assert.equal(ejaan.length, 2);

// Tapi beda huruf besar-kecil dan spasi pinggir memang satu wilayah yang sama.
const samaSaja = coverage([proyek("Jawa Barat")], [plan({ region: "  jawa barat  " })], []);
assert.equal(samaSaja.length, 1);
assert.equal(samaSaja[0].projects, 1);
assert.equal(samaSaja[0].plans, 1);
// Nama tampil memakai ejaan yang pertama ditemui.
assert.equal(samaSaja[0].region, "Jawa Barat");

assert.deepEqual(coverage([], [], []), []);

/* --- coverageSummary -------------------------------------------------------- */

const ringkas = coverageSummary(jangkauan);
assert.equal(ringkas.dijangkau, 2); // Jawa Tengah, Sumatera Selatan
assert.equal(ringkas.dituju, 2); // Kalimantan Timur, Papua
assert.equal(ringkas.total, jangkauan.length);
assert.deepEqual(coverageSummary([] as Coverage[]), { dijangkau: 0, dituju: 0, total: 0 });

/* --- prospectWins ----------------------------------------------------------- */

assert.equal(
  prospectWins([
    prospek(1, "Menjadi Klien"),
    prospek(2, "Negosiasi"),
    prospek(3, "Menjadi Klien"),
    prospek(4, "Tidak Lanjut"),
  ]),
  2
);
assert.equal(prospectWins([]), 0);

console.log("ok: strategy");
