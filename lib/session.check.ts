/**
 * Cek mandiri sesi bertoken: `npx tsx lib/session.check.ts`
 */
import assert from "node:assert/strict";
import {
  SESSION_TTL_HOURS,
  TOKEN_PATTERN,
  clearSessions,
  createSession,
  getSessionUserId,
  purgeExpired,
  revokeAllForUser,
  revokeSession,
} from "./session";

clearSessions();

// Token acak, bukan angka berurut: id yang bisa ditebak sama saja dengan
// tidak punya sesi.
const a = createSession(6);
assert.match(a.token, TOKEN_PATTERN);
assert.equal(a.token.length, 64);
assert.equal(a.userId, 6);

// Dua sesi tidak pernah berbagi token.
const b = createSession(6);
assert.notEqual(a.token, b.token);

// Token menunjuk penggunanya; token asing tidak.
assert.equal(getSessionUserId(a.token), 6);
assert.equal(getSessionUserId(b.token), 6);
assert.equal(getSessionUserId("a".repeat(64)), null);
assert.equal(getSessionUserId(""), null);
assert.equal(getSessionUserId(a.token.toUpperCase()), null);

// Umur sesi terpasang dan berada di masa depan.
assert.ok(SESSION_TTL_HOURS > 0);
assert.ok(a.expiresAt > a.createdAt, "kedaluwarsa harus setelah dibuat");

// Mencabut satu sesi tidak mengganggu sesi lain milik orang yang sama —
// keluar di satu perangkat tidak boleh menendang perangkat lainnya.
assert.equal(revokeSession(a.token), true);
assert.equal(getSessionUserId(a.token), null);
assert.equal(getSessionUserId(b.token), 6);
// Mencabut dua kali aman.
assert.equal(revokeSession(a.token), false);

// Mencabut semua sesi satu orang (ganti sandi / akun ditangguhkan).
const c = createSession(6);
const lain = createSession(2);
assert.equal(revokeAllForUser(6), 2);
assert.equal(getSessionUserId(b.token), null);
assert.equal(getSessionUserId(c.token), null);
// Milik orang lain tidak ikut terbawa.
assert.equal(getSessionUserId(lain.token), 2);

// Sesi kedaluwarsa tidak dianggap sah dan ikut dibuang.
clearSessions();
const kedaluwarsa = createSession(3);
kedaluwarsa.expiresAt = "2020-01-01 00:00:00";
assert.equal(getSessionUserId(kedaluwarsa.token), null);
// Sudah terbuang saat dibaca, jadi purge tidak menemukan apa pun lagi.
assert.equal(purgeExpired(), 0);

clearSessions();
const lama = createSession(4);
lama.expiresAt = "2020-01-01 00:00:00";
const segar = createSession(5);
assert.equal(purgeExpired(), 1);
assert.equal(getSessionUserId(segar.token), 5);

// Skenario "keluar dari semua perangkat": tiga sesi milik satu orang dari
// perangkat berbeda, satu sesi orang lain. Mencabut semua hanya menyentuh
// yang bersangkutan.
clearSessions();
const hp = createSession(6);
const laptop = createSession(6);
const tablet = createSession(6);
const rekan = createSession(2);
assert.equal(revokeAllForUser(6), 3);
for (const t of [hp, laptop, tablet]) assert.equal(getSessionUserId(t.token), null);
assert.equal(getSessionUserId(rekan.token), 2);
// Mencabut lagi tidak error dan tidak menghitung apa pun.
assert.equal(revokeAllForUser(6), 0);

clearSessions();
console.log("ok: session");
