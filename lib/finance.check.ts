/**
 * Cek mandiri hitungan untung-rugi: `npx tsx lib/finance.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 */
import assert from "node:assert/strict";
import { PPN_RATE, formatMarginPct, projectMargin, revenueBase } from "./finance";
import type { Project } from "./types";

type Uang = Pick<Project, "value" | "taxType" | "salesFee" | "operationalCost">;

function u(over: Partial<Uang> = {}): Uang {
  return {
    value: 500_000_000,
    taxType: "Non PKP",
    salesFee: 0,
    operationalCost: 0,
    ...over,
  };
}

/* --- DPP ------------------------------------------------------------------- */

// Non PKP: tidak ada PPN yang dipungut, jadi nilai kontraknya utuh jadi pendapatan.
assert.equal(revenueBase(500_000_000, "Non PKP"), 500_000_000);
assert.equal(revenueBase(0, "Non PKP"), 0);

// PKP: nilai kontrak dianggap sudah termasuk PPN, jadi PPN-nya dikeluarkan.
assert.equal(revenueBase(505_000_000, "PKP"), 454_954_955);
assert.equal(revenueBase(1_110_000_000, "PKP"), 1_000_000_000);
assert.equal(revenueBase(0, "PKP"), 0);

// Hasilnya selalu rupiah bulat, tidak pernah menyisakan pecahan.
for (const nilai of [1, 7, 99, 145_000_000, 980_000_000, 1_850_000_000]) {
  assert.ok(Number.isInteger(revenueBase(nilai, "PKP")), `pecahan pada ${nilai}`);
}

// DPP selalu lebih kecil dari nilai kontrak untuk PKP, dan selisihnya PPN.
const dpp = revenueBase(1_110_000_000, "PKP");
assert.ok(dpp < 1_110_000_000);
assert.equal(Math.round(dpp * PPN_RATE), 1_110_000_000 - dpp);

/* --- Margin ---------------------------------------------------------------- */

// Tanpa nilai kontrak, margin bukan nol melainkan tidak diketahui.
assert.equal(projectMargin(u({ value: null })), null);
assert.equal(projectMargin(u({ value: null, salesFee: 10, operationalCost: 20 })), null);

// Hitungan pokok: DPP dikurangi kedua biaya.
const normal = projectMargin(
  u({ value: 500_000_000, salesFee: 20_000_000, operationalCost: 300_000_000 })
)!;
assert.equal(normal.revenueBase, 500_000_000);
assert.equal(normal.margin, 180_000_000);
assert.equal(normal.marginPct, 0.36);
assert.equal(normal.incomplete, false);

// Contoh PKP dari rencana: nilai Rp 505 jt, fee Rp 15 jt, biaya Rp 300 jt.
const pkp = projectMargin(
  u({ value: 505_000_000, taxType: "PKP", salesFee: 15_000_000, operationalCost: 300_000_000 })
)!;
assert.equal(pkp.revenueBase, 454_954_955);
assert.equal(pkp.margin, 139_954_955);

// Proyek yang sama sebagai Non PKP untung lebih besar, tepat sebesar PPN-nya.
const nonPkp = projectMargin(
  u({ value: 505_000_000, salesFee: 15_000_000, operationalCost: 300_000_000 })
)!;
assert.equal(nonPkp.margin, 190_000_000);
assert.equal(nonPkp.margin - pkp.margin, 505_000_000 - 454_954_955);

// Margin tipis dan margin nol tetap terhitung, tidak dibulatkan jadi "tidak ada".
assert.equal(projectMargin(u({ value: 100_000_000, operationalCost: 99_000_000 }))!.margin, 1_000_000);
const impas = projectMargin(u({ value: 100_000_000, operationalCost: 100_000_000 }))!;
assert.equal(impas.margin, 0);
assert.equal(impas.marginPct, 0);

// Margin negatif tidak ditolak — proyek rugi itu keadaan nyata yang harus terlihat.
const rugi = projectMargin(
  u({ value: 505_000_000, taxType: "PKP", salesFee: 20_000_000, operationalCost: 460_000_000 })
)!;
assert.ok(rugi.margin < 0);
assert.equal(rugi.margin, 454_954_955 - 20_000_000 - 460_000_000);
assert.ok(rugi.marginPct !== null && rugi.marginPct < 0);

// Nilai kontrak nol: pembagian tidak menghasilkan Infinity maupun NaN.
const nol = projectMargin(u({ value: 0 }))!;
assert.equal(nol.revenueBase, 0);
assert.equal(nol.margin, 0);
assert.equal(nol.marginPct, null);

/* --- Kelengkapan data ------------------------------------------------------ */

// Biaya yang belum diisi dihitung nol, tapi hasilnya jujur menyebut diri estimasi.
const belumLengkap = projectMargin(u({ value: 200_000_000, salesFee: null }))!;
assert.equal(belumLengkap.salesFee, 0);
assert.equal(belumLengkap.margin, 200_000_000);
assert.equal(belumLengkap.incomplete, true);

assert.equal(projectMargin(u({ operationalCost: null }))!.incomplete, true);
assert.equal(projectMargin(u({ salesFee: null, operationalCost: null }))!.incomplete, true);
// Nol yang memang diisi berbeda dari "belum diisi".
assert.equal(projectMargin(u({ salesFee: 0, operationalCost: 0 }))!.incomplete, false);

/* --- Tampilan persentase --------------------------------------------------- */

assert.equal(formatMarginPct(null), "—");
assert.equal(formatMarginPct(0), "0%");
assert.equal(formatMarginPct(0.36), "36%");
// Koma desimal mengikuti kebiasaan Indonesia, bukan titik.
assert.match(formatMarginPct(0.3077), /^30,8%$/);
assert.match(formatMarginPct(-0.05), /^-5%$/);

console.log("ok: finance");
