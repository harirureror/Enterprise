/**
 * Cek mandiri validasi profil: `npx tsx lib/profile-form.check.ts`
 */
import assert from "node:assert/strict";
import { NAME_MAX, NAME_MIN, initials, validateProfile } from "./profile-form";

const cek = (name: string, avatarUrl = "") => validateProfile({ name, avatarUrl });

// Isian wajar lolos; foto boleh kosong.
assert.deepEqual(cek("Rani Puspita"), {});
assert.deepEqual(cek("Rani Puspita", "https://contoh.co.id/foto.jpg"), {});
assert.deepEqual(cek("Rani Puspita", "http://contoh.co.id/foto.png"), {});

// Nama: wajib, ada batas bawah dan atas, spasi tidak dihitung isi.
assert.equal(cek("").name, "Nama wajib diisi.");
assert.equal(cek("   ").name, "Nama wajib diisi.");
assert.ok(cek("A".repeat(NAME_MIN - 1)).name);
assert.deepEqual(cek("A".repeat(NAME_MIN)), {});
assert.deepEqual(cek("A".repeat(NAME_MAX)), {});
assert.ok(cek("A".repeat(NAME_MAX + 1)).name);

// URL foto: hanya http/https. Skema lain berbahaya untuk ditampilkan ke orang lain.
assert.ok(cek("Rani", "bukan url").avatarUrl);
assert.ok(cek("Rani", "javascript:alert(1)").avatarUrl);
assert.ok(cek("Rani", "data:image/png;base64,AAAA").avatarUrl);
assert.ok(cek("Rani", "ftp://contoh.co.id/f.jpg").avatarUrl);
// Spasi pinggir dimaafkan.
assert.deepEqual(cek("Rani", "  https://contoh.co.id/f.jpg  "), {});

// Inisial: maksimal dua huruf, kapital, aman untuk masukan aneh.
assert.equal(initials("Rani Puspita"), "RP");
assert.equal(initials("Ir. Siti Rahmawati, M.T."), "IS");
assert.equal(initials("bagas"), "B");
assert.equal(initials("  dua   spasi  "), "DS");
assert.equal(initials(""), "");

console.log("ok: profile-form");
