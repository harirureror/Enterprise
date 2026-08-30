import type { Project, TaxType } from "./types";

/* Hitungan untung-rugi satu proyek.

   Dipisah dari lib/ui.ts karena ini aturan bisnis, bukan format tampilan — dan
   aturan bisnis perlu bisa diuji sendiri tanpa React maupun DOM.

   Margin sengaja tidak disimpan sebagai kolom. Ia turunan dari nilai kontrak,
   status pajak, sales fee, dan cost operasional; menyimpannya berarti ada dua
   sumber kebenaran yang akan berselisih begitu salah satu komponennya diubah. */

/**
 * Tarif PPN barang dan jasa umum. Ditaruh di satu tempat supaya perubahan tarif
 * tidak perlu diburu ke seluruh berkas.
 */
export const PPN_RATE = 0.11;

export type MarginResult = {
  /**
   * Dasar Pengenaan Pajak — pendapatan yang benar-benar jadi hak perusahaan.
   * Untuk klien PKP, PPN sudah dikeluarkan dari nilai kontrak.
   */
  revenueBase: number;
  salesFee: number;
  operationalCost: number;
  /** revenueBase − salesFee − operationalCost. Boleh negatif. */
  margin: number;
  /** margin / revenueBase, 0..1. `null` kalau revenueBase nol. */
  marginPct: number | null;
  /**
   * Ada komponen biaya yang belum diisi, jadi angkanya baru estimasi.
   * Tetap dihitung dan ditampilkan — menyembunyikannya justru membuat orang
   * mengira datanya tidak ada sama sekali.
   */
  incomplete: boolean;
};

/**
 * Pendapatan bersih dari nilai kontrak.
 *
 * Konvensi yang dipakai di sini: **nilai kontrak sudah termasuk PPN**. Untuk
 * klien PKP, PPN yang dipungut adalah titipan negara, bukan pendapatan — jadi
 * dikeluarkan dulu sebelum margin dihitung. Untuk Non PKP tidak ada PPN yang
 * dipungut, jadi nilai kontraknya utuh jadi pendapatan.
 */
export function revenueBase(value: number, taxType: TaxType): number {
  if (taxType !== "PKP") return value;
  // Dibulatkan ke rupiah penuh: sistem ini tidak pernah menampilkan sen, dan
  // menyimpan pecahan hanya memindahkan selisih pembulatan ke tempat lain.
  return Math.round(value / (1 + PPN_RATE));
}

/**
 * Margin satu proyek. `null` kalau nilai kontraknya belum ada — tanpa itu
 * marginnya bukan nol melainkan tidak diketahui, dan menampilkan "Rp 0" akan
 * menyesatkan.
 */
export function projectMargin(
  project: Pick<Project, "value" | "taxType" | "salesFee" | "operationalCost">
): MarginResult | null {
  if (project.value === null) return null;

  const dasar = revenueBase(project.value, project.taxType);
  const fee = project.salesFee ?? 0;
  const biaya = project.operationalCost ?? 0;
  const margin = dasar - fee - biaya;

  return {
    revenueBase: dasar,
    salesFee: fee,
    operationalCost: biaya,
    margin,
    marginPct: dasar === 0 ? null : margin / dasar,
    incomplete: project.salesFee === null || project.operationalCost === null,
  };
}

/** Persentase margin sebagai teks, mis. "30,8%". `null` jadi "—". */
export function formatMarginPct(pct: number | null): string {
  if (pct === null) return "—";
  return `${(pct * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}
