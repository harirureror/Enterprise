/**
 * Cek mandiri validasi form masuk: `npx tsx lib/login-form.check.ts`
 */
import assert from "node:assert/strict";
import {
  PASSWORD_MIN,
  PESAN_KREDENSIAL_SALAH,
  emptyLoginDraft,
  validateLogin,
} from "./login-form";

const cek = (email: string, password: string) => validateLogin({ email, password });

// Isian wajar lolos.
assert.deepEqual(cek("rani@jayasurvey.id", "rahasia123"), {});

// Email atau nama: wajib diisi, format bebas.
assert.equal(cek("", "rahasia123").email, "Email atau nama pengguna wajib diisi.");
assert.equal(cek("   ", "rahasia123").email, "Email atau nama pengguna wajib diisi.");
assert.deepEqual(cek("bukan-email", "rahasia123"), {});
assert.deepEqual(cek("a@b", "rahasia123"), {});
assert.deepEqual(cek("  a@b.co  ", "rahasia123"), {});

// Kata sandi: hanya wajib terisi. Form masuk sengaja tidak menuntut panjang
// minimal — itu aturan untuk membuat sandi, bukan memasukkannya, dan menolak
// sandi pendek di sini akan mengunci akun lama sekaligus membocorkan aturannya.
assert.equal(cek("a@b.co", "").password, "Kata sandi wajib diisi.");
assert.deepEqual(cek("a@b.co", "admin"), {});
assert.deepEqual(cek("a@b.co", "x"), {});
assert.deepEqual(cek("a@b.co", "x".repeat(PASSWORD_MIN)), {});
// Spasi adalah karakter sah dalam sandi; jangan dipangkas seperti email.
assert.deepEqual(cek("a@b.co", "        "), {});
// Konstantanya tetap ada untuk dipakai form pendaftaran nanti.
assert.ok(PASSWORD_MIN >= 8);

// Kedua kesalahan dilaporkan sekaligus.
assert.deepEqual(Object.keys(cek("", "")).sort(), ["email", "password"]);

// Form kosong memang belum valid.
assert.ok(Object.keys(validateLogin(emptyLoginDraft())).length > 0);

// Pesan kredensial salah harus seragam dan tidak menyebut kolom tertentu —
// kalau menyebut, penyerang bisa menebak email mana yang terdaftar.
assert.equal(PESAN_KREDENSIAL_SALAH, "Identitas atau kata sandi salah.");
assert.equal(/tidak terdaftar|tidak ditemukan/i.test(PESAN_KREDENSIAL_SALAH), false);

console.log("ok: login-form");
