/**
 * Cek mandiri validasi profil: `npx tsx lib/profile-form.check.ts`
 */
import assert from "node:assert/strict";
import { NAME_MAX, NAME_MIN, initials, validateProfile } from "./profile-form";

/** Email sah dipakai sebagai bawaan supaya pemeriksaan nama dan foto tidak
    ikut tersandung galat email. */
const cek = (name: string, avatarUrl = "", email = "rani@contoh.co.id", emailLain: string[] = []) =>
  validateProfile({ name, avatarUrl, email }, emailLain);

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

/* --- Email: identitas login, jadi aturannya seketat form pembuatan akun --- */

const cekEmail = (email: string, emailLain: string[] = []) =>
  validateProfile({ name: "Rani", avatarUrl: "", email }, emailLain).email;

assert.equal(cekEmail("rani@contoh.co.id"), undefined);
assert.equal(cekEmail("  rani@contoh.co.id  "), undefined); // spasi pinggir dimaafkan

assert.equal(cekEmail(""), "Email wajib diisi.");
assert.equal(cekEmail("   "), "Email wajib diisi.");
assert.equal(cekEmail("bukan-email"), "Format email tidak valid.");
assert.equal(cekEmail("tanpa@titik"), "Format email tidak valid.");
assert.equal(cekEmail("spasi di@contoh.co.id"), "Format email tidak valid.");

// Bentrok dengan akun lain ditolak, tanpa memandang kapitalisasi — sejalan
// dengan idx_users_email_lower di skema.
assert.equal(cekEmail("dipakai@contoh.co.id", ["dipakai@contoh.co.id"]), "Email sudah dipakai akun lain.");
assert.equal(cekEmail("DiPakai@Contoh.co.id", ["dipakai@contoh.co.id"]), "Email sudah dipakai akun lain.");

// Email SENDIRI tidak boleh dianggap bentrok: pemanggil mengecualikan akun yang
// sedang disunting, jadi menyimpan tanpa mengganti email harus tetap lolos.
assert.equal(cekEmail("rani@contoh.co.id", ["orang.lain@contoh.co.id"]), undefined);

// Nama dan email bisa salah berbarengan, dan keduanya dilaporkan.
const duaGalat = validateProfile({ name: "", avatarUrl: "", email: "bukan-email" });
assert.equal(duaGalat.name, "Nama wajib diisi.");
assert.equal(duaGalat.email, "Format email tidak valid.");

console.log("ok: profile-form");
