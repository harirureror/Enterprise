import {
  PLAN_GOALS,
  isActivePlan,
  type PlanGoal,
  type PlanProspect,
  type PlanStep,
  type Project,
  type StrategicPlan,
} from "./types";

/* Hitungan rencana strategis.

   Fungsi murni, tanpa React dan tanpa akses data, supaya seluruhnya bisa diuji
   tanpa peramban maupun database — sejalan dengan lib/agenda.ts dan
   lib/finance.ts. */

export type PlanProgress = {
  /** Langkah yang dihitung: seluruhnya kecuali yang dibatalkan. */
  total: number;
  selesai: number;
  /** 0-100, dibulatkan. 0 kalau belum ada langkah yang dihitung. */
  pct: number;
  /** Langkah yang tanggalnya lewat dan belum selesai. */
  telat: number;
};

/**
 * Progres rencana diturunkan dari langkahnya — tidak pernah diketik orang.
 *
 * Alasannya sama dengan margin di lib/finance.ts: angka yang disimpan akan
 * melenceng dari langkah-langkahnya begitu salah satunya berubah.
 *
 * Langkah `Batal` tidak dihitung sebagai selesai MAUPUN sebagai penyebut —
 * membatalkan satu langkah seharusnya tidak menurunkan progres rencana.
 */
export function planProgress(steps: PlanStep[], today?: string): PlanProgress {
  const acuan = today ?? new Date().toISOString().slice(0, 10);
  const dihitung = steps.filter((s) => s.status !== "Batal");
  const selesai = dihitung.filter((s) => s.status === "Selesai").length;

  return {
    total: dihitung.length,
    selesai,
    pct: dihitung.length === 0 ? 0 : Math.round((selesai / dihitung.length) * 100),
    telat: dihitung.filter(
      (s) => s.status !== "Selesai" && s.targetDate !== null && s.targetDate < acuan
    ).length,
  };
}

/**
 * Langkah yang jatuh tempo dalam rentang, inklusif di kedua ujungnya.
 * Langkah tanpa tanggal tidak pernah ikut — ia memang belum dijadwalkan.
 */
export function stepsDueBetween(steps: PlanStep[], start: string, end: string): PlanStep[] {
  return steps.filter(
    (s) => s.targetDate !== null && s.targetDate >= start && s.targetDate <= end
  );
}

/**
 * Rencana dikelompokkan per tujuan strategis.
 *
 * Keempat tujuan selalu muncul walau kosong, dengan urutan tetap — "belum ada
 * rencana untuk efisiensi biaya" adalah informasi, bukan alasan menghilangkan
 * kolomnya.
 */
export function groupByGoal<T extends Pick<StrategicPlan, "goal">>(
  plans: T[]
): { goal: PlanGoal; plans: T[] }[] {
  return PLAN_GOALS.map((goal) => ({
    goal,
    plans: plans.filter((p) => p.goal === goal),
  }));
}

/**
 * Rencana yang perlu perhatian: masih berjalan, tapi ada langkah yang telat
 * atau tanggal targetnya sendiri sudah lewat.
 *
 * Rencana yang sudah Selesai atau Dibatalkan tidak pernah menyala — tidak ada
 * lagi yang bisa dikejar di sana.
 */
export function needsAttention(
  plan: StrategicPlan,
  steps: PlanStep[],
  today?: string
): boolean {
  if (!isActivePlan(plan.status)) return false;

  const acuan = today ?? new Date().toISOString().slice(0, 10);
  if (plan.targetDate !== null && plan.targetDate < acuan) return true;

  return planProgress(steps, acuan).telat > 0;
}

/* --- Jangkauan wilayah ------------------------------------------------------ */

export type Coverage = {
  region: string;
  /** Proyek yang sudah berjalan di sana. */
  projects: number;
  /** Rencana yang menyasar ke sana. */
  plans: number;
  prospects: number;
  /** Ada rencana atau prospek, tapi belum ada proyek — inilah wilayah yang dituju. */
  baru: boolean;
};

/**
 * Wilayah dicocokkan apa adanya setelah dipangkas dan disamakan huruf besar-
 * kecilnya — tanpa pencocokan kira-kira.
 *
 * Akibatnya "Kepri" dan "Kepulauan Riau" tampil sebagai dua baris. Itu memang
 * disengaja: ketidakseragaman pengisian perlu terlihat supaya bisa dirapikan,
 * bukan disembunyikan penggabungan otomatis yang bisa saja salah menebak.
 */
function kunciWilayah(nama: string): string {
  return nama.trim().toLowerCase();
}

export function coverage(
  projects: Pick<Project, "locationProvince">[],
  plans: Pick<StrategicPlan, "region">[],
  prospects: Pick<PlanProspect, "region">[]
): Coverage[] {
  const peta = new Map<string, Coverage>();

  /** Ambil (atau buat) baris untuk satu wilayah; nama tampil yang pertama menang. */
  const baris = (nama: string): Coverage | null => {
    const kunci = kunciWilayah(nama);
    // Wilayah kosong bukan wilayah; menghitungnya hanya membuat baris hantu.
    if (kunci === "") return null;

    let ada = peta.get(kunci);
    if (!ada) {
      ada = { region: nama.trim(), projects: 0, plans: 0, prospects: 0, baru: false };
      peta.set(kunci, ada);
    }
    return ada;
  };

  for (const p of projects) {
    const b = baris(p.locationProvince);
    if (b) b.projects++;
  }
  for (const p of plans) {
    const b = baris(p.region);
    if (b) b.plans++;
  }
  for (const p of prospects) {
    const b = baris(p.region);
    if (b) b.prospects++;
  }

  const hasil = [...peta.values()].map((c) => ({
    ...c,
    baru: c.projects === 0 && (c.plans > 0 || c.prospects > 0),
  }));

  // Yang sedang dituju lebih dulu; sisanya dari yang proyeknya paling banyak.
  return hasil.sort(
    (a, b) =>
      Number(b.baru) - Number(a.baru) ||
      b.projects - a.projects ||
      b.plans - a.plans ||
      a.region.localeCompare(b.region, "id")
  );
}

/** Ringkasan sebaris untuk kartu di atas daftar rencana. */
export type CoverageSummary = {
  /** Wilayah yang sudah ada proyeknya. */
  dijangkau: number;
  /** Wilayah yang baru jadi sasaran, belum ada proyeknya. */
  dituju: number;
  total: number;
};

export function coverageSummary(rows: Coverage[]): CoverageSummary {
  return {
    dijangkau: rows.filter((c) => c.projects > 0).length,
    dituju: rows.filter((c) => c.baru).length,
    total: rows.length,
  };
}

/** Berapa prospek yang sudah berhasil jadi klien, per rencana. */
export function prospectWins(prospects: PlanProspect[]): number {
  return prospects.filter((p) => p.status === "Menjadi Klien").length;
}
