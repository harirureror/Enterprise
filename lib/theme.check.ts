/**
 * Cek mandiri logika tema: `npx tsx lib/theme.check.ts`
 * Semua fungsi murni; yang menyentuh DOM diuji lewat objek tiruan.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_INIT_SCRIPT,
  THEME_LABELS,
  THEME_STORAGE_KEY,
  applyTheme,
  isTheme,
  resolveTheme,
  themeAttribute,
} from "./theme";

// Default ikut sistem: menebak preferensi orang lebih buruk daripada mengikuti
// setelan perangkatnya.
assert.equal(DEFAULT_THEME, "system");
assert.deepEqual(THEMES, ["system", "light", "dark"]);
assert.ok(THEMES.every((t) => THEME_LABELS[t] !== undefined));

// isTheme menyaring nilai asing dari localStorage.
assert.equal(isTheme("dark"), true);
assert.equal(isTheme("system"), true);
assert.equal(isTheme("gelap"), false);
assert.equal(isTheme(null), false);
assert.equal(isTheme(undefined), false);
assert.equal(isTheme(1), false);

// "system" mengikuti perangkat; pilihan manual mengabaikannya.
assert.equal(resolveTheme("system", true), "dark");
assert.equal(resolveTheme("system", false), "light");
assert.equal(resolveTheme("light", true), "light");
assert.equal(resolveTheme("dark", false), "dark");

// "system" tidak menulis atribut — kalau ditulis, pilihan jadi beku saat
// pengguna mengganti setelan perangkatnya.
assert.equal(themeAttribute("system"), null);
assert.equal(themeAttribute("light"), "light");
assert.equal(themeAttribute("dark"), "dark");

// applyTheme memasang dan membersihkan atribut pada elemen.
const atribut = new Map<string, string>();
const root = {
  setAttribute: (k: string, v: string) => atribut.set(k, v),
  removeAttribute: (k: string) => atribut.delete(k),
} as unknown as HTMLElement;

applyTheme(root, "dark");
assert.equal(atribut.get("data-theme"), "dark");
applyTheme(root, "light");
assert.equal(atribut.get("data-theme"), "light");
// Kembali ke "system" harus menghapus atributnya, bukan menulis hasil terjemahan.
applyTheme(root, "system");
assert.equal(atribut.has("data-theme"), false);

// Skrip anti-kedip: memakai kunci yang sama, hanya memasang nilai manual,
// dan tidak pernah melempar walau localStorage diblokir.
assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_STORAGE_KEY)));
assert.ok(THEME_INIT_SCRIPT.includes("data-theme"));
assert.ok(THEME_INIT_SCRIPT.includes("try{") && THEME_INIT_SCRIPT.includes("catch"));
// "system" sengaja tidak ditangani skrip — CSS-nya sudah menangani sendiri.
assert.equal(THEME_INIT_SCRIPT.includes('"system"'), false);
// Tidak boleh ada penutup tag yang bisa memutus <script> saat disisipkan.
assert.equal(THEME_INIT_SCRIPT.includes("</"), false);

// Kunci penyimpanan diberi versi, supaya bentuk data yang berubah kelak bisa
// dipisahkan tanpa menabrak nilai lama di peramban pengguna.
assert.match(THEME_STORAGE_KEY, /\.v\d+$/);

console.log("ok: theme");
