/**
 * Cek mandiri pilihan warna aksen: `npx tsx lib/accent.check.ts`
 * Fungsi murni; yang menyentuh DOM diuji lewat objek tiruan.
 */
import assert from "node:assert/strict";
import {
  ACCENTS,
  ACCENT_INIT_SCRIPT,
  ACCENT_LABELS,
  ACCENT_STORAGE_KEY,
  ACCENT_SWATCH,
  DEFAULT_ACCENT,
  accentAttribute,
  applyAccent,
  isAccent,
} from "./accent";

// Tiap aksen punya label dan warna contoh.
assert.equal(DEFAULT_ACCENT, "bawaan");
assert.ok(ACCENTS.includes(DEFAULT_ACCENT));
assert.ok(ACCENTS.every((a) => ACCENT_LABELS[a] !== undefined));
assert.ok(ACCENTS.every((a) => /^#[0-9a-f]{6}$/i.test(ACCENT_SWATCH[a])));
// Warna contohnya berbeda satu sama lain, kalau tidak swatch-nya tidak berguna.
assert.equal(new Set(ACCENTS.map((a) => ACCENT_SWATCH[a])).size, ACCENTS.length);

// isAccent menyaring nilai asing dari localStorage.
assert.equal(isAccent("ungu"), true);
assert.equal(isAccent("merah"), false);
assert.equal(isAccent(null), false);
assert.equal(isAccent(7), false);

// "bawaan" tidak menulis atribut — token asli di :root yang berlaku.
assert.equal(accentAttribute("bawaan"), null);
assert.equal(accentAttribute("hijau"), "hijau");

const atribut = new Map<string, string>();
const root = {
  setAttribute: (k: string, v: string) => atribut.set(k, v),
  removeAttribute: (k: string) => atribut.delete(k),
} as unknown as HTMLElement;

applyAccent(root, "jingga");
assert.equal(atribut.get("data-accent"), "jingga");
applyAccent(root, "biru");
assert.equal(atribut.get("data-accent"), "biru");
// Kembali ke bawaan harus membersihkan atributnya.
applyAccent(root, "bawaan");
assert.equal(atribut.has("data-accent"), false);

// Skrip anti-kedip: kunci yang sama, hanya memasang aksen non-bawaan, aman
// walau localStorage diblokir, dan tidak bisa memutus tag <script>.
assert.ok(ACCENT_INIT_SCRIPT.includes(JSON.stringify(ACCENT_STORAGE_KEY)));
assert.ok(ACCENT_INIT_SCRIPT.includes("data-accent"));
assert.ok(ACCENT_INIT_SCRIPT.includes("try{") && ACCENT_INIT_SCRIPT.includes("catch"));
assert.ok(ACCENT_INIT_SCRIPT.includes('"bawaan"'));
assert.equal(ACCENT_INIT_SCRIPT.includes("</"), false);
// Nilai yang sah ikut tertanam supaya skrip menolak isi localStorage yang asing.
for (const a of ACCENTS) assert.ok(ACCENT_INIT_SCRIPT.includes(`"${a}"`));

assert.match(ACCENT_STORAGE_KEY, /\.v\d+$/);
// Tema dan aksen memakai kunci berbeda supaya bisa diubah sendiri-sendiri.
assert.notEqual(ACCENT_STORAGE_KEY, "jsi.tema.v1");

console.log("ok: accent");
