import { isOverlapping, toDay } from "./timeline";
import {
  isActiveStatus,
  type ClientTier,
  type PenaltyRisk,
  type Project,
  type ProjectDependency,
  type ProjectPriority,
  type ProjectStatus,
} from "./types";

/* Penentuan prioritas otomatis menurut parameter yang disepakati tim: enam
   parameter, masing-masing diberi skor 1-5, lalu dijumlahkan berbobot jadi
   angka 1,00-5,00.

   Tiap parameter membawa kalimat alasannya sendiri. Kalau PIC bertanya "kenapa
   ini Tinggi?", jawabannya ada di `factors` — bukan di kepala orang yang
   menulis rumusnya.

   Semua ambang ditulis sebagai tabel bertingkat, bukan rumus melengkung, supaya
   bisa ditinjau tim tanpa menebak-nebak efek perubahannya. */

export type PriorityParam =
  | "nilai"
  | "klien"
  | "penalti"
  | "progres"
  | "tenggat"
  | "ketergantungan";

/** Skor tiap parameter selalu bilangan bulat 1-5. */
export type ParamScore = 1 | 2 | 3 | 4 | 5;

export type PriorityFactor = {
  key: PriorityParam;
  label: string;
  /** Porsi parameter ini terhadap skor akhir; totalnya 1,00. */
  weight: number;
  score: ParamScore;
  /** Kenapa skornya segitu, dalam kalimat yang bisa dibaca PIC. */
  reason: string;
  /** score × weight — inilah yang dijumlahkan jadi skor akhir. */
  contribution: number;
};

export type PriorityScore = {
  /** 1,00-5,00. Makin tinggi makin perlu dikerjakan lebih dulu. */
  score: number;
  level: ProjectPriority;
  /** Rincian per parameter, penyumbang terbesar dulu. */
  factors: PriorityFactor[];
};

/**
 * Bobot hasil kesepakatan tim. Totalnya wajib 1,00 — dijaga assertion di
 * lib/priority.check.ts supaya perubahan sebelah tidak diam-diam menggeser
 * skala skor.
 */
export const PARAM_WEIGHTS: Record<PriorityParam, number> = {
  nilai: 0.25,
  klien: 0.2,
  penalti: 0.15,
  progres: 0.15,
  tenggat: 0.15,
  ketergantungan: 0.1,
};

export const PARAM_LABELS: Record<PriorityParam, string> = {
  nilai: "Nilai Proyek",
  klien: "Status Mitra / Klien",
  penalti: "Risiko Penalti",
  progres: "Progres Tertinggal",
  tenggat: "Tenggat Waktu",
  ketergantungan: "Ketergantungan",
};

/** Urutan parameter sesuai tabel tim, dipakai saat menampilkan rincian. */
export const PRIORITY_PARAMS: PriorityParam[] = [
  "nilai",
  "klien",
  "penalti",
  "progres",
  "tenggat",
  "ketergantungan",
];

/** Ambang skor berbobot ke level prioritas. */
export const PRIORITY_THRESHOLD = { tinggi: 3.5, sedang: 2.5 } as const;

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

/* --- Skor per parameter --------------------------------------------------- */

/** Bobot 25%. Skor 5 = di atas Rp 500 juta, skor 1 = di bawah Rp 50 juta. */
function nilaiScore(value: number | null): { score: ParamScore; reason: string } {
  // "Belum ditentukan" bukan berarti kecil. Memberi skor 1 akan menghukum
  // proyek yang angkanya sekadar belum diisi, jadi dipakai nilai tengah.
  if (value === null) return { score: 3, reason: "Nilai belum ditentukan — dianggap menengah" };
  if (value > 500_000_000) return { score: 5, reason: "Di atas Rp 500 juta" };
  if (value > 250_000_000) return { score: 4, reason: "Rp 250–500 juta" };
  if (value > 100_000_000) return { score: 3, reason: "Rp 100–250 juta" };
  if (value >= 50_000_000) return { score: 2, reason: "Rp 50–100 juta" };
  return { score: 1, reason: "Di bawah Rp 50 juta" };
}

/** Bobot 20%. Tingkat klien memetakan langsung ke skor. */
const TIER_SCORE: Record<ClientTier, ParamScore> = {
  VIP: 5,
  Strategis: 4,
  Reguler: 3,
  Baru: 2,
  Internal: 1,
};

/** Bobot 15%. Denda harian dan putus kontrak sama-sama paling kritis. */
const PENALTY_SCORE: Record<PenaltyRisk, ParamScore> = {
  "Putus kontrak": 5,
  "Denda harian": 5,
  "Denda tetap": 4,
  Teguran: 2,
  "Tidak ada": 1,
};

/**
 * Bobot 15%. Selisih antara porsi waktu yang sudah terpakai dan progres yang
 * dilaporkan. Skor 5 = tertinggal lebih dari 20 poin, skor 1 = mendahului jadwal.
 */
function progresScore(
  project: Project,
  hariIni: number
): { score: ParamScore; reason: string } {
  const mulai = toDay(project.startDate);
  const tenggat = toDay(project.deadline);
  const durasi = tenggat - mulai + 1;

  if (durasi <= 0 || hariIni < mulai) {
    // Proyek yang belum mulai tidak bisa disebut tertinggal.
    return { score: 2, reason: "Belum mulai — belum bisa tertinggal" };
  }

  const terpakai = Math.min((hariIni - mulai + 1) / durasi, 1) * 100;
  const tertinggal = Math.round(terpakai - project.progressPct);

  if (tertinggal > 20) return { score: 5, reason: `Tertinggal ${tertinggal} poin dari jadwal` };
  if (tertinggal > 10) return { score: 4, reason: `Tertinggal ${tertinggal} poin dari jadwal` };
  if (tertinggal > 0) return { score: 3, reason: `Tertinggal ${tertinggal} poin dari jadwal` };
  if (tertinggal >= -10) return { score: 2, reason: "Sesuai jadwal" };
  return { score: 1, reason: `Mendahului jadwal ${Math.abs(tertinggal)} poin` };
}

/**
 * Bobot 15%. Skor 5 = kurang dari 7 hari lagi, skor 1 = lebih dari 30 hari.
 *
 * Tenggat yang sudah lewat ikut masuk band 5. Tabel tim tidak memberi band
 * tersendiri untuk keterlambatan, jadi ketajamannya berkurang dibanding model
 * sebelumnya — dicatat di sini supaya pilihan itu terlihat, bukan tersembunyi.
 * Keterlambatan tetap menonjol lewat notifikasi dan progres yang tertinggal.
 */
function tenggatScore(sisaHari: number): { score: ParamScore; reason: string } {
  if (sisaHari < 0) return { score: 5, reason: `Lewat tenggat ${Math.abs(sisaHari)} hari` };
  if (sisaHari < 7) return { score: 5, reason: `Tinggal ${sisaHari} hari` };
  if (sisaHari <= 14) return { score: 4, reason: `Tinggal ${sisaHari} hari` };
  if (sisaHari <= 21) return { score: 3, reason: `Tinggal ${sisaHari} hari` };
  if (sisaHari <= 30) return { score: 2, reason: `Tinggal ${sisaHari} hari` };
  return { score: 1, reason: `Masih ${sisaHari} hari lagi` };
}

/**
 * Bobot 10%. Skor 5 = menahan lebih dari 2 proyek lain, skor 1 = mandiri.
 * `bergantung` membedakan proyek yang menunggu proyek lain (skor 2) dari yang
 * benar-benar berdiri sendiri (skor 1).
 */
function ketergantunganScore(
  menahan: number,
  bergantung: number
): { score: ParamScore; reason: string } {
  if (menahan > 2) return { score: 5, reason: `Menahan ${menahan} proyek lain` };
  if (menahan === 2) return { score: 4, reason: "Menahan 2 proyek lain" };
  if (menahan === 1) return { score: 3, reason: "Menahan 1 proyek lain" };
  if (bergantung > 0) {
    return { score: 2, reason: `Menunggu ${bergantung} proyek, tidak menahan siapa pun` };
  }
  return { score: 1, reason: "Mandiri — tidak berkaitan dengan proyek lain" };
}

/* --- Perhitungan gabungan -------------------------------------------------- */

export type PriorityContext = {
  /** Tanggal acuan, ISO YYYY-MM-DD. Default hari ini. */
  today?: string;
  /** Jumlah proyek lain yang ditahan proyek ini. */
  blocking?: number;
  /** Jumlah proyek lain yang menahan proyek ini. */
  blockedBy?: number;
};

function buatFactor(
  key: PriorityParam,
  hasil: { score: ParamScore; reason: string }
): PriorityFactor {
  const weight = PARAM_WEIGHTS[key];
  return {
    key,
    label: PARAM_LABELS[key],
    weight,
    score: hasil.score,
    reason: hasil.reason,
    contribution: hasil.score * weight,
  };
}

/** Hitung skor prioritas satu proyek berikut rincian per parameternya. */
export function priorityScore(project: Project, context: PriorityContext = {}): PriorityScore {
  const asOf = context.today ?? new Date().toISOString().slice(0, 10);
  const hariIni = toDay(asOf);

  // Proyek selesai tidak punya prioritas — tidak ada lagi yang perlu dikejar.
  if (!isActiveStatus(project.status)) {
    return {
      score: SCORE_MIN,
      level: "Rendah",
      factors: [
        {
          key: "tenggat",
          label: "Proyek sudah selesai",
          weight: 1,
          score: 1,
          reason: "Tidak ada lagi yang perlu ditindaklanjuti",
          contribution: SCORE_MIN,
        },
      ],
    };
  }

  const factors: PriorityFactor[] = [
    buatFactor("nilai", nilaiScore(project.value)),
    buatFactor("klien", {
      score: TIER_SCORE[project.clientTier],
      reason: `Klien ${project.clientTier}`,
    }),
    buatFactor("penalti", {
      score: PENALTY_SCORE[project.penaltyRisk],
      reason: project.penaltyRisk === "Tidak ada" ? "Tidak ada penalti" : project.penaltyRisk,
    }),
    buatFactor("progres", progresScore(project, hariIni)),
    buatFactor("tenggat", tenggatScore(toDay(project.deadline) - hariIni)),
    buatFactor(
      "ketergantungan",
      ketergantunganScore(context.blocking ?? 0, context.blockedBy ?? 0)
    ),
  ];

  const total = factors.reduce((sum, f) => sum + f.contribution, 0);
  // Dibulatkan dua desimal: bobot pecahan bisa menghasilkan ekor mengambang
  // seperti 3,4500000000000006 yang jelek dilihat dan menyulitkan pembandingan.
  const score = Math.round(total * 100) / 100;

  return {
    score,
    level:
      score >= PRIORITY_THRESHOLD.tinggi
        ? "Tinggi"
        : score >= PRIORITY_THRESHOLD.sedang
          ? "Sedang"
          : "Rendah",
    // Penyumbang terbesar dulu; urutan parameter jadi penentu terakhir supaya
    // rinciannya tidak berubah-ubah saat kontribusinya kebetulan sama.
    factors: [...factors].sort(
      (a, b) =>
        b.contribution - a.contribution ||
        PRIORITY_PARAMS.indexOf(a.key) - PRIORITY_PARAMS.indexOf(b.key)
    ),
  };
}

/* --- Ketergantungan -------------------------------------------------------- */

export type DependencyCounts = {
  /** id proyek → berapa proyek lain yang ditahannya. */
  blocking: Map<number, number>;
  /** id proyek → berapa proyek lain yang menahannya. */
  blockedBy: Map<number, number>;
};

/**
 * Hitung ketergantungan dua arah sekaligus. Relasi yang menunjuk proyek di luar
 * daftar diabaikan — proyek yang sudah dihapus tidak boleh ikut menaikkan skor.
 */
export function dependencyCounts(
  projects: Project[],
  dependencies: ProjectDependency[]
): DependencyCounts {
  const ada = new Set(projects.map((p) => p.id));
  const blocking = new Map<number, number>(projects.map((p) => [p.id, 0]));
  const blockedBy = new Map<number, number>(projects.map((p) => [p.id, 0]));

  for (const d of dependencies) {
    if (!ada.has(d.blockerId) || !ada.has(d.blockedId)) continue;
    blocking.set(d.blockerId, (blocking.get(d.blockerId) ?? 0) + 1);
    blockedBy.set(d.blockedId, (blockedBy.get(d.blockedId) ?? 0) + 1);
  }

  return { blocking, blockedBy };
}

/**
 * Apakah menambah relasi `blocker → blocked` akan membuat lingkaran?
 *
 * Lingkaran berarti dua proyek saling menunggu dan tak satu pun bisa jalan;
 * SQLite tidak bisa menjaganya lewat constraint, jadi dijaga di sini sebelum
 * relasinya disimpan. Ditelusuri dari `blocked`: kalau dari sana bisa sampai
 * kembali ke `blocker`, relasi barunya menutup lingkaran.
 */
export function wouldCycle(
  dependencies: ProjectDependency[],
  blockerId: number,
  blockedId: number
): boolean {
  if (blockerId === blockedId) return true;

  const berikutnya = new Map<number, number[]>();
  for (const d of dependencies) {
    berikutnya.set(d.blockerId, [...(berikutnya.get(d.blockerId) ?? []), d.blockedId]);
  }

  const dikunjungi = new Set<number>();
  const antrean = [blockedId];

  while (antrean.length > 0) {
    const kini = antrean.pop()!;
    if (kini === blockerId) return true;
    if (dikunjungi.has(kini)) continue;
    dikunjungi.add(kini);
    antrean.push(...(berikutnya.get(kini) ?? []));
  }

  return false;
}

/* --- Pemecah seri ---------------------------------------------------------- */

/**
 * Tahap pipeline dan bentrok jadwal PIC tidak lagi menyumbang skor — keduanya
 * di luar parameter yang disepakati tim. Keduanya tetap dipakai memecah seri
 * saat dua proyek skornya sama persis, supaya urutannya tetap masuk akal dan
 * tidak bergantung urutan data.
 */
const STAGE_URGENCY: Record<ProjectStatus, number> = {
  Negosiasi: 5,
  Tertunda: 4,
  Berjalan: 3,
  Penawaran: 2,
  Prospect: 1,
  Selesai: 0,
};

/**
 * Berapa proyek lain milik PIC yang sama yang jadwalnya beririsan, per proyek.
 * Dihitung sekali untuk seluruh daftar supaya hasilnya tidak berubah hanya
 * karena daftarnya sedang disaring.
 */
export function ownerClashCounts(projects: Project[]): Map<number, number> {
  const counts = new Map<number, number>(projects.map((p) => [p.id, 0]));

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];
      if (a.ownerId !== b.ownerId || !isOverlapping(a, b)) continue;
      counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
      counts.set(b.id, (counts.get(b.id) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Pembanding untuk mengurutkan proyek: skor dulu, lalu pemecah seri.
 * `clash` dari `ownerClashCounts`.
 */
export function compareByPriority(
  a: { project: Project; score: PriorityScore },
  b: { project: Project; score: PriorityScore },
  clash: Map<number, number>
): number {
  return (
    b.score.score - a.score.score ||
    STAGE_URGENCY[b.project.status] - STAGE_URGENCY[a.project.status] ||
    (clash.get(b.project.id) ?? 0) - (clash.get(a.project.id) ?? 0) ||
    a.project.deadline.localeCompare(b.project.deadline) ||
    a.project.id - b.project.id
  );
}

/** Skor seluruh daftar sekaligus, dengan konteks ketergantungan yang konsisten. */
export function scoreAll(
  projects: Project[],
  dependencies: ProjectDependency[] = [],
  options: { today?: string } = {}
): Map<number, PriorityScore> {
  const { blocking, blockedBy } = dependencyCounts(projects, dependencies);

  return new Map(
    projects.map((p) => [
      p.id,
      priorityScore(p, {
        today: options.today,
        blocking: blocking.get(p.id) ?? 0,
        blockedBy: blockedBy.get(p.id) ?? 0,
      }),
    ])
  );
}
