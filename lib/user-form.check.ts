/**
 * Cek mandiri validasi akun: `npx tsx lib/user-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/project-form.check.ts.
 */
import assert from "node:assert/strict";
import { PASSWORD_MIN } from "./login-form";
import {
  type UserDraft,
  draftToUser,
  emptyUserDraft,
  validateUser,
} from "./user-form";

const TERPAKAI = ["harir@jayasurvey.id", "rika@jayasurvey.id"];

function draft(over: Partial<UserDraft> = {}): UserDraft {
  return {
    name: "Dewi Larasati",
    email: "dewi@jayasurvey.id",
    role: "Surveyor",
    accessLevel: "Anggota",
    password: "sandiAwal123",
    ...over,
  };
}

const cek = (over: Partial<UserDraft> = {}) => validateUser(draft(over), TERPAKAI);

// Isian lengkap dan benar tidak menghasilkan pesan apa pun.
assert.deepEqual(cek(), {});

/* --- Nama ------------------------------------------------------------------ */

assert.ok(cek({ name: "" }).name);
assert.ok(cek({ name: "   " }).name);
assert.ok(cek({ name: "A" }).name); // terlalu pendek
assert.equal(cek({ name: "Ab" }).name, undefined);
assert.ok(cek({ name: "x".repeat(81) }).name);
assert.equal(cek({ name: "x".repeat(80) }).name, undefined);

/* --- Email ----------------------------------------------------------------- */

assert.ok(cek({ email: "" }).email);
assert.ok(cek({ email: "bukan-email" }).email);
assert.ok(cek({ email: "tanpa@titik" }).email);
assert.ok(cek({ email: "spasi di@tengah.com" }).email);
assert.equal(cek({ email: "a.b+tag@sub.instansi.co.id" }).email, undefined);

// Email kembar ditolak — dan yang paling penting, tanpa memandang kapitalisasi.
// Tanpa ini dua baris bisa mewakili satu identitas login, dan yang terpilih
// saat masuk bergantung urutan data.
assert.ok(cek({ email: "harir@jayasurvey.id" }).email);
assert.ok(cek({ email: "HARIR@jayasurvey.id" }).email);
assert.ok(cek({ email: "Harir@JayaSurvey.id" }).email);
assert.ok(cek({ email: "  rika@jayasurvey.id  " }).email); // spasi pinggir dipangkas dulu

// Daftar email lain kosong berarti tidak ada yang bentrok.
assert.equal(validateUser(draft({ email: "harir@jayasurvey.id" }), []).email, undefined);

/* --- Jabatan --------------------------------------------------------------- */

// Opsional: yang menentukan hak adalah accessLevel, bukan jabatan.
assert.equal(cek({ role: "" }).role, undefined);
assert.ok(cek({ role: "x".repeat(61) }).role);

/* --- Tingkat akses --------------------------------------------------------- */

for (const level of ["Admin", "Owner", "HR", "Manager", "Anggota"]) {
  assert.equal(cek({ accessLevel: level }).accessLevel, undefined);
}
assert.ok(cek({ accessLevel: "Superadmin" }).accessLevel);
assert.ok(cek({ accessLevel: "admin" }).accessLevel); // huruf kecil tidak sah
assert.ok(cek({ accessLevel: "" }).accessLevel);

/* --- Sandi ----------------------------------------------------------------- */

assert.ok(cek({ password: "" }).password);
assert.ok(cek({ password: "a".repeat(PASSWORD_MIN - 1) }).password);
assert.equal(cek({ password: "a".repeat(PASSWORD_MIN) }).password, undefined);

// Saat mengubah akun, sandi kosong berarti "jangan diganti" — bukan kesalahan.
assert.equal(validateUser(draft({ password: "" }), TERPAKAI, { wajibSandi: false }).password, undefined);
// Tapi kalau diisi, panjangnya tetap diperiksa.
assert.ok(validateUser(draft({ password: "pendek" }), TERPAKAI, { wajibSandi: false }).password);

/* --- Bolak-balik ----------------------------------------------------------- */

const hasil = draftToUser(draft({ name: "  Dewi  ", email: "  dewi@x.co.id  ", role: "  Surveyor  " }));
assert.equal(hasil.name, "Dewi");
assert.equal(hasil.email, "dewi@x.co.id");
assert.equal(hasil.role, "Surveyor");
assert.equal(hasil.accessLevel, "Anggota");
// Sandi tidak ikut: hash-nya dibuat terpisah dan tidak pernah menempel di User.
assert.equal(Object.hasOwn(hasil, "password"), false);

// Draft kosong belum lolos validasi, dan tingkat aksesnya paling kecil.
const baru = emptyUserDraft();
assert.equal(baru.accessLevel, "Anggota");
const kosong = validateUser(baru, TERPAKAI);
assert.ok(kosong.name && kosong.email && kosong.password);
assert.equal(kosong.accessLevel, undefined);

console.log("ok: user-form");
