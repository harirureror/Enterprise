/**
 * Cek mandiri validasi catat progres: `npx tsx lib/progress-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/project-form.check.ts.
 */
import assert from "node:assert/strict";
import { NOTE_MAX, emptyProgressDraft, validateProgress } from "./progress-form";

const SEKARANG = 40;
const cek = (progressPct: string, note = "") =>
  validateProgress({ progressPct, note }, SEKARANG);

// Isian awal memakai progres proyek saat ini.
assert.deepEqual(emptyProgressDraft(65), { progressPct: "65", note: "" });

// Angka berubah: catatan boleh kosong.
assert.deepEqual(cek("55"), {});
assert.deepEqual(cek("0"), {});
assert.deepEqual(cek("100"), {});
// Progres boleh turun — pekerjaan bisa dinilai ulang.
assert.deepEqual(cek("20"), {});

// Angka tidak berubah dan catatan kosong: tidak ada yang layak dicatat.
assert.equal(cek("40").note, "Isi catatan kalau persentasenya tidak berubah.");
assert.equal(cek("40", "   ").note, "Isi catatan kalau persentasenya tidak berubah.");
// Dengan catatan, pembaruan tanpa perubahan angka tetap sah.
assert.deepEqual(cek("40", "Menunggu konfirmasi klien."), {});

// Angka wajib bulat 0-100.
assert.ok(cek("").progressPct);
assert.ok(cek("abc").progressPct);
assert.ok(cek("55.5").progressPct);
assert.equal(cek("-1").progressPct, "Progres harus antara 0 dan 100.");
assert.equal(cek("101").progressPct, "Progres harus antara 0 dan 100.");

// Angka rusak tidak ikut memicu pesan "isi catatan" yang menyesatkan.
assert.equal(cek("abc").note, undefined);
assert.equal(cek("").note, undefined);

// Catatan ada batas panjang; spasi pinggir tidak dihitung.
assert.equal(cek("55", "A".repeat(NOTE_MAX)).note, undefined);
assert.ok(cek("55", "A".repeat(NOTE_MAX + 1)).note);
assert.equal(cek("55", `  ${"A".repeat(NOTE_MAX)}  `).note, undefined);

console.log("ok: progress-form");
