/**
 * Cek mandiri hashing sandi: `npx tsx lib/password.check.ts`
 * scrypt sengaja lambat, jadi jumlah kasusnya dijaga secukupnya.
 */
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

const hash = hashPassword("admin123");

// Bentuk hash membawa parameternya, supaya sandi lama tetap bisa diverifikasi
// kalau biayanya dinaikkan kelak.
const bagian = hash.split("$");
assert.equal(bagian.length, 6);
assert.equal(bagian[0], "scrypt");
assert.ok(Number(bagian[1]) >= 16384, "biaya scrypt tidak boleh diturunkan diam-diam");

// Cocok hanya untuk sandi yang sama persis.
assert.equal(verifyPassword("admin123", hash), true);
assert.equal(verifyPassword("admin124", hash), false);
assert.equal(verifyPassword("Admin123", hash), false);
assert.equal(verifyPassword("", hash), false);
assert.equal(verifyPassword("admin123 ", hash), false);

// Salt acak: sandi sama menghasilkan hash berbeda, dan keduanya tetap sah.
const lain = hashPassword("admin123");
assert.notEqual(lain, hash);
assert.equal(verifyPassword("admin123", lain), true);

// Hash cacat ditolak tanpa melempar — pemanggil tidak perlu membedakan
// "hash rusak" dari "sandi salah", karena perbedaan itu bocor ke penyerang.
for (const rusak of [
  "",
  "bukan-hash",
  "scrypt$16384$8$1$abc",
  "scrypt$16384$8$1$$",
  "bcrypt$16384$8$1$aa$bb",
  "scrypt$bukan-angka$8$1$aa$bb",
]) {
  assert.equal(verifyPassword("admin123", rusak), false, `hash cacat lolos: ${rusak}`);
}

console.log("ok: password");
