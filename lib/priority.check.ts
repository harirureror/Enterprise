/**
 * Cek mandiri skor prioritas: `npx tsx lib/priority.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 *
 * Isinya mengunci tabel parameter yang disepakati tim. Kalau ada bobot atau
 * ambang yang digeser tanpa kesepakatan baru, berkas ini yang berteriak.
 */
import assert from "node:assert/strict";
import {
  PARAM_LABELS,
  PARAM_WEIGHTS,
  PRIORITY_PARAMS,
  PRIORITY_THRESHOLD,
  SCORE_MAX,
  SCORE_MIN,
  compareByPriority,
  dependencyCounts,
  ownerClashCounts,
  priorityScore,
  scoreAll,
  wouldCycle,
  type PriorityContext,
  type PriorityParam,
  type PriorityScore,
} from "./priority";
import type { Project, ProjectDependency } from "./types";

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

const HARI_INI = "2026-08-05";

const skor = (over: Partial<Project> = {}, ctx: Omit<PriorityContext, "today"> = {}) =>
  priorityScore(p(1, over), { today: HARI_INI, ...ctx });

const faktor = (s: PriorityScore, key: PriorityParam) => s.factors.find((f) => f.key === key)!;
const nilaiFaktor = (over: Partial<Project>, key: PriorityParam) => faktor(skor(over), key).score;

/* --- Bentuk hasil ---------------------------------------------------------- */

// Bobot enam parameter harus tepat 1,00 — kalau tidak, skalanya bukan 1-5 lagi.
assert.equal(
  Object.values(PARAM_WEIGHTS).reduce((a, b) => a + b, 0),
  1
);

// Bobot persis seperti tabel tim.
assert.deepEqual(PARAM_WEIGHTS, {
  nilai: 0.25,
  klien: 0.2,
  penalti: 0.15,
  progres: 0.15,
  tenggat: 0.15,
  ketergantungan: 0.1,
});

// Semua parameter punya label dan bobot, tidak ada yang tertinggal.
assert.equal(PRIORITY_PARAMS.length, 6);
assert.deepEqual(Object.keys(PARAM_WEIGHTS).sort(), [...PRIORITY_PARAMS].sort());
assert.deepEqual(Object.keys(PARAM_LABELS).sort(), [...PRIORITY_PARAMS].sort());

// Setiap proyek aktif selalu dinilai di keenam parameter, tidak kurang.
const lengkap = skor();
assert.equal(lengkap.factors.length, 6);
assert.deepEqual([...lengkap.factors.map((f) => f.key)].sort(), [...PRIORITY_PARAMS].sort());

// Kontribusi = skor x bobot, dan totalnya sama dengan skor akhir.
assert.ok(lengkap.factors.every((f) => f.contribution === f.score * f.weight));
assert.equal(
  Math.round(lengkap.factors.reduce((a, f) => a + f.contribution, 0) * 100) / 100,
  lengkap.score
);

// Rincian diurut dari penyumbang terbesar, supaya alasan teratas yang paling menentukan.
assert.deepEqual(
  lengkap.factors.map((f) => f.contribution),
  [...lengkap.factors.map((f) => f.contribution)].sort((a, b) => b - a)
);

// Tiap faktor membawa kalimat alasannya sendiri.
assert.ok(lengkap.factors.every((f) => f.reason.length > 0));

/* --- Nilai Proyek (25%) ---------------------------------------------------- */

assert.equal(nilaiFaktor({ value: 980_000_000 }, "nilai"), 5); // > Rp 500 jt
assert.equal(nilaiFaktor({ value: 500_000_001 }, "nilai"), 5);
assert.equal(nilaiFaktor({ value: 500_000_000 }, "nilai"), 4); // batas atas band 4
assert.equal(nilaiFaktor({ value: 250_000_001 }, "nilai"), 4);
assert.equal(nilaiFaktor({ value: 250_000_000 }, "nilai"), 3);
assert.equal(nilaiFaktor({ value: 100_000_001 }, "nilai"), 3);
assert.equal(nilaiFaktor({ value: 100_000_000 }, "nilai"), 2);
assert.equal(nilaiFaktor({ value: 50_000_000 }, "nilai"), 2); // batas bawah band 2
assert.equal(nilaiFaktor({ value: 49_999_999 }, "nilai"), 1);
assert.equal(nilaiFaktor({ value: 0 }, "nilai"), 1);

// Nilai belum diisi bukan berarti proyeknya kecil — diberi skor tengah, bukan 1.
assert.equal(nilaiFaktor({ value: null }, "nilai"), 3);
assert.match(faktor(skor({ value: null }), "nilai").reason, /belum ditentukan/i);

/* --- Status Mitra / Klien (20%) -------------------------------------------- */

assert.equal(nilaiFaktor({ clientTier: "VIP" }, "klien"), 5);
assert.equal(nilaiFaktor({ clientTier: "Strategis" }, "klien"), 4);
assert.equal(nilaiFaktor({ clientTier: "Reguler" }, "klien"), 3);
assert.equal(nilaiFaktor({ clientTier: "Baru" }, "klien"), 2);
assert.equal(nilaiFaktor({ clientTier: "Internal" }, "klien"), 1);

/* --- Risiko Penalti (15%) -------------------------------------------------- */

assert.equal(nilaiFaktor({ penaltyRisk: "Putus kontrak" }, "penalti"), 5);
assert.equal(nilaiFaktor({ penaltyRisk: "Denda harian" }, "penalti"), 5);
assert.equal(nilaiFaktor({ penaltyRisk: "Denda tetap" }, "penalti"), 4);
assert.equal(nilaiFaktor({ penaltyRisk: "Teguran" }, "penalti"), 2);
assert.equal(nilaiFaktor({ penaltyRisk: "Tidak ada" }, "penalti"), 1);

/* --- Progres Tertinggal (15%) ---------------------------------------------- */

// Rentang 1-10 Agustus, acuan 5 Agustus: 50% waktu terpakai.
const jadwal = { startDate: "2026-08-01", deadline: "2026-08-10" };
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 0 }, "progres"), 5); // tertinggal 50
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 29 }, "progres"), 5); // tertinggal 21
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 30 }, "progres"), 4); // tertinggal 20
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 39 }, "progres"), 4); // tertinggal 11
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 40 }, "progres"), 3); // tertinggal 10
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 49 }, "progres"), 3); // tertinggal 1
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 50 }, "progres"), 2); // tepat jadwal
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 60 }, "progres"), 2); // mendahului 10
assert.equal(nilaiFaktor({ ...jadwal, progressPct: 61 }, "progres"), 1); // mendahului 11

// Proyek yang belum mulai tidak bisa disebut tertinggal.
const belumMulai = skor({ startDate: "2026-09-01", deadline: "2026-09-30" });
assert.equal(faktor(belumMulai, "progres").score, 2);
assert.match(faktor(belumMulai, "progres").reason, /belum mulai/i);

/* --- Tenggat Waktu (15%) --------------------------------------------------- */

assert.equal(nilaiFaktor({ deadline: "2026-07-25" }, "tenggat"), 5); // sudah lewat
assert.equal(nilaiFaktor({ deadline: HARI_INI }, "tenggat"), 5); // jatuh tempo hari ini
assert.equal(nilaiFaktor({ deadline: "2026-08-11" }, "tenggat"), 5); // 6 hari lagi
assert.equal(nilaiFaktor({ deadline: "2026-08-12" }, "tenggat"), 4); // 7 hari
assert.equal(nilaiFaktor({ deadline: "2026-08-19" }, "tenggat"), 4); // 14 hari
assert.equal(nilaiFaktor({ deadline: "2026-08-20" }, "tenggat"), 3); // 15 hari
assert.equal(nilaiFaktor({ deadline: "2026-08-26" }, "tenggat"), 3); // 21 hari
assert.equal(nilaiFaktor({ deadline: "2026-08-27" }, "tenggat"), 2); // 22 hari
assert.equal(nilaiFaktor({ deadline: "2026-09-04" }, "tenggat"), 2); // 30 hari
assert.equal(nilaiFaktor({ deadline: "2026-09-05" }, "tenggat"), 1); // 31 hari

// Tenggat lewat masuk band paling kritis, tapi alasannya tetap menyebut telat.
assert.match(faktor(skor({ deadline: "2026-07-25" }), "tenggat").reason, /lewat/i);

/* --- Ketergantungan (10%) -------------------------------------------------- */

assert.equal(faktor(skor({}, { blocking: 3 }), "ketergantungan").score, 5);
assert.equal(faktor(skor({}, { blocking: 2 }), "ketergantungan").score, 4);
assert.equal(faktor(skor({}, { blocking: 1 }), "ketergantungan").score, 3);
// Menunggu proyek lain tanpa menahan siapa pun: tetap terkait, tapi bukan penahan.
assert.equal(faktor(skor({}, { blocking: 0, blockedBy: 2 }), "ketergantungan").score, 2);
assert.equal(faktor(skor({}, {}), "ketergantungan").score, 1);
// Menahan mengalahkan ditahan — yang penting berapa proyek lain yang tersendat.
assert.equal(faktor(skor({}, { blocking: 1, blockedBy: 5 }), "ketergantungan").score, 3);

/* --- Skor gabungan dan ambang level ---------------------------------------- */

// Semua parameter di titik paling kritis: tepat batas atas skala.
const maksimal = skor(
  {
    value: 980_000_000,
    clientTier: "VIP",
    penaltyRisk: "Putus kontrak",
    startDate: "2026-08-01",
    deadline: "2026-08-06",
    progressPct: 0,
  },
  { blocking: 3 }
);
assert.equal(maksimal.score, SCORE_MAX);
assert.equal(maksimal.level, "Tinggi");

// Semua parameter paling aman: tepat batas bawah skala.
const minimal = skor({
  value: 10_000_000,
  clientTier: "Internal",
  penaltyRisk: "Tidak ada",
  startDate: "2026-08-01",
  deadline: "2026-10-31",
  progressPct: 80,
});
assert.equal(minimal.score, SCORE_MIN);
assert.equal(minimal.level, "Rendah");

// Skor selalu di dalam rentang, apa pun kombinasinya.
for (const kandidat of [maksimal, minimal, lengkap, belumMulai]) {
  assert.ok(kandidat.score >= SCORE_MIN && kandidat.score <= SCORE_MAX);
}

// Ambang Tinggi: 3,50 masuk, 3,40 tidak.
// Parameter di titik (4, 4, 4, 3, 3, k) — hanya ketergantungan yang digeser.
const nyaris = {
  value: 400_000_000, // 4
  clientTier: "Strategis" as const, // 4
  penaltyRisk: "Denda tetap" as const, // 4
  startDate: "2026-08-01",
  deadline: "2026-08-20", // tenggat 15 hari -> 3
  progressPct: 20, // tertinggal 5 poin -> 3
};
const tepatTinggi = skor(nyaris, { blockedBy: 1 }); // ketergantungan 2
assert.equal(tepatTinggi.score, PRIORITY_THRESHOLD.tinggi);
assert.equal(tepatTinggi.level, "Tinggi");

const kurangSedikit = skor(nyaris); // ketergantungan 1
assert.equal(kurangSedikit.score, 3.4);
assert.equal(kurangSedikit.level, "Sedang");

// Ambang Sedang: 2,50 masuk, 2,40 tidak.
const rendahan = {
  value: 50_000_000, // 2
  clientTier: "Baru" as const, // 2
  penaltyRisk: "Teguran" as const, // 2
  startDate: "2026-08-01",
  deadline: "2026-08-20", // 3
  progressPct: 20, // 3
};
const tepatSedang = skor(rendahan, { blocking: 2 }); // ketergantungan 4
assert.equal(tepatSedang.score, PRIORITY_THRESHOLD.sedang);
assert.equal(tepatSedang.level, "Sedang");

const jatuhRendah = skor(rendahan, { blocking: 1 }); // ketergantungan 3
assert.equal(jatuhRendah.score, 2.4);
assert.equal(jatuhRendah.level, "Rendah");

// Bobotnya benar-benar berlaku: naik dari Internal ke VIP menggeser skor
// tepat 4 x 20% = 0,80, tidak lebih dan tidak kurang.
const internal = skor({ ...nyaris, clientTier: "Internal" });
const vip = skor({ ...nyaris, clientTier: "VIP" });
assert.equal(Math.round((vip.score - internal.score) * 100) / 100, 0.8);

// Skor dibulatkan dua desimal, tidak menyisakan ekor mengambang.
assert.ok([maksimal, minimal, lengkap, tepatTinggi].every((s) => s.score === Math.round(s.score * 100) / 100));

/* --- Proyek selesai -------------------------------------------------------- */

// Sudah selesai berarti tidak ada lagi yang perlu dikejar, seberapa pun besarnya.
const selesai = skor({
  status: "Selesai",
  value: 980_000_000,
  clientTier: "VIP",
  penaltyRisk: "Putus kontrak",
  deadline: "2026-07-01",
});
assert.equal(selesai.score, SCORE_MIN);
assert.equal(selesai.level, "Rendah");
assert.equal(selesai.factors.length, 1);
assert.match(selesai.factors[0].label, /selesai/i);

// Tertunda tetap dihitung aktif — proyek yang diparkir justru perlu dikejar.
assert.equal(skor({ status: "Tertunda" }).factors.length, 6);

/* --- Ketergantungan antar proyek ------------------------------------------- */

const daftar = [p(1), p(2), p(3), p(4)];
const relasi: ProjectDependency[] = [
  { blockerId: 1, blockedId: 2 },
  { blockerId: 1, blockedId: 3 },
  { blockerId: 2, blockedId: 4 },
];
const hitung = dependencyCounts(daftar, relasi);
assert.equal(hitung.blocking.get(1), 2);
assert.equal(hitung.blocking.get(2), 1);
assert.equal(hitung.blocking.get(4), 0);
assert.equal(hitung.blockedBy.get(2), 1);
assert.equal(hitung.blockedBy.get(4), 1);
assert.equal(hitung.blockedBy.get(1), 0);

// Tiap proyek dalam daftar selalu punya entri, jadi pemanggil tidak perlu cek undefined.
assert.equal(hitung.blocking.size, daftar.length);
assert.equal(hitung.blockedBy.size, daftar.length);

// Relasi yang menunjuk proyek di luar daftar diabaikan — proyek terhapus tidak
// boleh diam-diam menaikkan skor proyek yang masih ada.
const yatim = dependencyCounts(daftar, [{ blockerId: 1, blockedId: 99 }]);
assert.equal(yatim.blocking.get(1), 0);
assert.equal(yatim.blocking.has(99), false);

// Daftar kosong aman.
assert.equal(dependencyCounts([], relasi).blocking.size, 0);
assert.equal(dependencyCounts(daftar, []).blocking.get(1), 0);

/* --- Deteksi lingkaran ----------------------------------------------------- */

// Menahan diri sendiri selalu ditolak.
assert.equal(wouldCycle([], 1, 1), true);

// Relasi baru yang tidak menutup jalur mana pun boleh.
assert.equal(wouldCycle(relasi, 3, 4), false);
assert.equal(wouldCycle([], 1, 2), false);

// Kebalikan relasi langsung menutup lingkaran.
assert.equal(wouldCycle(relasi, 2, 1), true);

// Lingkaran tak langsung ikut tertangkap: 1 -> 2 -> 4, jadi 4 -> 1 melingkar.
assert.equal(wouldCycle(relasi, 4, 1), true);
assert.equal(wouldCycle(relasi, 3, 1), true);

// Relasi yang sudah ada tidak dianggap lingkaran baru.
assert.equal(wouldCycle(relasi, 1, 2), false);

// Graf bercabang tanpa lingkaran tidak bikin penelusuran mandek.
assert.equal(
  wouldCycle(
    [
      { blockerId: 1, blockedId: 2 },
      { blockerId: 1, blockedId: 3 },
      { blockerId: 2, blockedId: 4 },
      { blockerId: 3, blockedId: 4 },
    ],
    4,
    5
  ),
  false
);

/* --- scoreAll -------------------------------------------------------------- */

const semua = scoreAll(daftar, relasi, { today: HARI_INI });
assert.equal(semua.size, daftar.length);
// Proyek 1 menahan dua proyek lain, proyek 4 hanya menunggu: skornya harus beda
// tepat sebesar selisih parameter ketergantungan, 3 skor x 10%.
assert.equal(faktor(semua.get(1)!, "ketergantungan").score, 4);
assert.equal(faktor(semua.get(4)!, "ketergantungan").score, 2);
assert.equal(Math.round((semua.get(1)!.score - semua.get(4)!.score) * 100) / 100, 0.2);

// Tanpa daftar relasi, semua proyek dianggap mandiri.
const mandiri = scoreAll(daftar, [], { today: HARI_INI });
assert.ok([...mandiri.values()].every((s) => faktor(s, "ketergantungan").score === 1));

// Daftar kosong aman.
assert.equal(scoreAll([], relasi).size, 0);

/* --- Pemecah seri ---------------------------------------------------------- */

// Bentrok PIC: hanya jadwal beririsan milik anggota yang sama yang dihitung.
const bentrok = ownerClashCounts([
  p(1, { startDate: "2026-08-01", deadline: "2026-08-20", ownerId: 1 }),
  p(2, { startDate: "2026-08-10", deadline: "2026-08-25", ownerId: 1 }),
  p(3, { startDate: "2026-08-10", deadline: "2026-08-25", ownerId: 2 }),
]);
assert.equal(bentrok.get(1), 1);
assert.equal(bentrok.get(2), 1);
assert.equal(bentrok.get(3), 0);
assert.equal(ownerClashCounts([]).size, 0);

const entri = (project: Project, angka: number) => ({
  project,
  score: { score: angka, level: "Sedang", factors: [] } as PriorityScore,
});
const tanpaBentrok = new Map<number, number>();

// Skor lebih tinggi selalu di depan.
assert.ok(compareByPriority(entri(p(1), 4.2), entri(p(2), 3.1), tanpaBentrok) < 0);

// Skor sama: tahap yang lebih genting menang (Negosiasi di atas Prospect).
assert.ok(
  compareByPriority(
    entri(p(1, { status: "Negosiasi" }), 3),
    entri(p(2, { status: "Prospect" }), 3),
    tanpaBentrok
  ) < 0
);

// Tahap sama: PIC yang jadwalnya sedang bentrok didahulukan.
assert.ok(
  compareByPriority(
    entri(p(1), 3),
    entri(p(2), 3),
    new Map([
      [1, 0],
      [2, 2],
    ])
  ) > 0
);

// Semua sama: tenggat terdekat dulu, lalu id supaya urutannya stabil.
assert.ok(
  compareByPriority(
    entri(p(1, { deadline: "2026-08-10" }), 3),
    entri(p(2, { deadline: "2026-08-20" }), 3),
    tanpaBentrok
  ) < 0
);
assert.ok(compareByPriority(entri(p(1), 3), entri(p(2), 3), tanpaBentrok) < 0);
assert.equal(compareByPriority(entri(p(1), 3), entri(p(1), 3), tanpaBentrok), 0);

console.log("ok: priority");
