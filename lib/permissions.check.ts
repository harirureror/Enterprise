/**
 * Cek mandiri matriks izin: `npx tsx lib/permissions.check.ts`
 *
 * Berkas ini mengunci kesepakatan siapa-boleh-apa. Kalau ada satu baris matriks
 * yang bergeser tanpa keputusan baru, di sinilah ketahuannya — bukan setelah
 * seseorang menemukan dirinya bisa menghapus proyek orang lain.
 */
import assert from "node:assert/strict";
import {
  ABILITIES,
  type Ability,
  MATRIX,
  can,
  canEditAgenda,
  canEditProject,
  FINANCE_FIELDS,
  isAccessLevel,
  landingPath,
  redactFinance,
} from "./permissions";
import { ACCESS_LEVELS, type AccessLevel } from "./types";

const orang = (id: number, accessLevel: AccessLevel) => ({ id, accessLevel });

/* --- Bentuk matriks -------------------------------------------------------- */

// Kelima peran punya entri; tidak ada yang tertinggal jadi undefined.
assert.deepEqual(Object.keys(MATRIX).sort(), [...ACCESS_LEVELS].sort());
assert.equal(ACCESS_LEVELS.length, 5);

// Tidak ada kemampuan yang ditulis dua kali, dan tidak ada yang di luar daftar.
for (const level of ACCESS_LEVELS) {
  const daftar = MATRIX[level];
  assert.deepEqual([...daftar], [...new Set(daftar)], `${level} punya kemampuan ganda`);
  assert.ok(
    daftar.every((a) => ABILITIES.includes(a)),
    `${level} memuat kemampuan yang tidak dikenal`
  );
}

// Daftar ABILITIES sendiri unik.
assert.deepEqual(ABILITIES, [...new Set(ABILITIES)]);

/* --- Matriks lengkap, peran demi peran ------------------------------------- */

/** Kebenaran yang diharapkan, ditulis ulang secara mandiri dari tabel kesepakatan. */
const HARAPAN: Record<AccessLevel, Record<Ability, boolean>> = {
  Admin: {
    "lihat-daftar": true,
    "lihat-overview": true,
    "lihat-detail": true,
    "lihat-tim": true,
    "lihat-notifikasi": true,
    "lihat-keuangan": true,
    kolaborasi: true,
    "ubah-semua-proyek": true,
    "ubah-proyek-sendiri": true,
    "buat-proyek": true,
    "hapus-proyek": true,
    "kelola-jenis": true,
    "kelola-pengguna": true,
    ekspor: true,
    "lihat-agenda": true,
    "isi-agenda-sendiri": true,
    "isi-agenda-orang-lain": true,
  },
  Owner: {
    "lihat-daftar": true,
    "lihat-overview": true,
    "lihat-detail": true,
    "lihat-tim": true,
    "lihat-notifikasi": true,
    "lihat-keuangan": true,
    kolaborasi: true,
    "ubah-semua-proyek": false,
    "ubah-proyek-sendiri": false,
    "buat-proyek": false,
    "hapus-proyek": false,
    "kelola-jenis": false,
    "kelola-pengguna": false,
    ekspor: true,
    "lihat-agenda": true,
    "isi-agenda-sendiri": false,
    "isi-agenda-orang-lain": false,
  },
  HR: {
    "lihat-daftar": true,
    "lihat-overview": false,
    "lihat-detail": false,
    "lihat-tim": false,
    "lihat-notifikasi": false,
    "lihat-keuangan": false,
    kolaborasi: false,
    "ubah-semua-proyek": false,
    "ubah-proyek-sendiri": false,
    "buat-proyek": false,
    "hapus-proyek": false,
    "kelola-jenis": false,
    "kelola-pengguna": false,
    ekspor: true,
    "lihat-agenda": true,
    "isi-agenda-sendiri": false,
    "isi-agenda-orang-lain": false,
  },
  Manager: {
    "lihat-daftar": true,
    "lihat-overview": true,
    "lihat-detail": true,
    "lihat-tim": true,
    "lihat-notifikasi": true,
    "lihat-keuangan": true,
    kolaborasi: true,
    "ubah-semua-proyek": true,
    "ubah-proyek-sendiri": true,
    "buat-proyek": true,
    "hapus-proyek": true,
    "kelola-jenis": true,
    "kelola-pengguna": false,
    ekspor: true,
    "lihat-agenda": true,
    "isi-agenda-sendiri": true,
    "isi-agenda-orang-lain": true,
  },
  Anggota: {
    "lihat-daftar": true,
    "lihat-overview": true,
    "lihat-detail": true,
    "lihat-tim": true,
    "lihat-notifikasi": true,
    "lihat-keuangan": false,
    kolaborasi: true,
    "ubah-semua-proyek": false,
    "ubah-proyek-sendiri": true,
    "buat-proyek": false,
    "hapus-proyek": false,
    "kelola-jenis": false,
    "kelola-pengguna": false,
    ekspor: true,
    "lihat-agenda": true,
    "isi-agenda-sendiri": true,
    "isi-agenda-orang-lain": false,
  },
};

// Setiap peran diperiksa terhadap setiap kemampuan — 5 x 17 = 85 keputusan.
for (const level of ACCESS_LEVELS) {
  for (const ability of ABILITIES) {
    assert.equal(
      can(level, ability),
      HARAPAN[level][ability],
      `${level} / ${ability} tidak sesuai kesepakatan`
    );
  }
}

/* --- Sifat yang harus selalu benar ----------------------------------------- */

// Admin adalah superset dari semua peran lain. Kalau ada peran yang punya
// sesuatu di luar jangkauan Admin, itu pasti salah tulis.
for (const level of ACCESS_LEVELS) {
  for (const ability of MATRIX[level]) {
    assert.ok(can("Admin", ability), `Admin kehilangan ${ability} yang dipunyai ${level}`);
  }
}

// Hanya Admin yang boleh mengelola akun.
assert.deepEqual(
  ACCESS_LEVELS.filter((l) => can(l, "kelola-pengguna")),
  ["Admin"]
);

// Kelima peran boleh mengekspor, termasuk laporan mingguan.
assert.ok(ACCESS_LEVELS.every((l) => can(l, "ekspor")));

// Kelima peran boleh melihat agenda — itulah gunanya buat HR.
assert.ok(ACCESS_LEVELS.every((l) => can(l, "lihat-agenda")));

// Owner benar-benar tidak menulis data proyek, tapi tetap bisa berkolaborasi.
// Pembedaan inilah yang paling mudah rusak saat matriksnya disunting.
const TULIS_PROYEK: Ability[] = [
  "ubah-semua-proyek",
  "ubah-proyek-sendiri",
  "buat-proyek",
  "hapus-proyek",
  "kelola-jenis",
];
assert.ok(TULIS_PROYEK.every((a) => !can("Owner", a)));
assert.equal(can("Owner", "kolaborasi"), true);

// HR tidak punya tempat berkomentar, jadi tidak boleh punya kemampuannya.
assert.equal(can("HR", "kolaborasi"), false);
// HR juga tidak boleh melihat angka keuangan, di layar maupun di berkas ekspor.
assert.equal(can("HR", "lihat-keuangan"), false);
// Komentar hidup di halaman detail: siapa pun yang bisa berkolaborasi harus
// bisa membuka halamannya, kalau tidak kemampuannya tidak ada artinya.
for (const level of ACCESS_LEVELS) {
  if (can(level, "kolaborasi")) {
    assert.ok(can(level, "lihat-detail"), `${level} bisa kolaborasi tapi tak bisa buka detail`);
  }
}

// Siapa pun yang boleh mengubah proyek harus bisa membukanya lebih dulu.
for (const level of ACCESS_LEVELS) {
  if (can(level, "ubah-semua-proyek") || can(level, "ubah-proyek-sendiri")) {
    assert.ok(can(level, "lihat-detail"), `${level} bisa mengubah tapi tak bisa buka detail`);
  }
}

/* --- canEditProject -------------------------------------------------------- */

const proyekMilikDia = { ownerId: 7 };
const proyekOrangLain = { ownerId: 99 };

// Admin dan Manager: proyek siapa pun.
for (const level of ["Admin", "Manager"] as const) {
  assert.equal(canEditProject(orang(7, level), proyekMilikDia), true);
  assert.equal(canEditProject(orang(7, level), proyekOrangLain), true);
}

// Anggota: hanya yang dia pegang. Inilah aturan yang paling sering dilanggar
// kalau pemanggilnya hanya memeriksa "punya kemampuan ubah".
assert.equal(canEditProject(orang(7, "Anggota"), proyekMilikDia), true);
assert.equal(canEditProject(orang(7, "Anggota"), proyekOrangLain), false);

// Owner dan HR: tidak keduanya.
for (const level of ["Owner", "HR"] as const) {
  assert.equal(canEditProject(orang(7, level), proyekMilikDia), false);
  assert.equal(canEditProject(orang(7, level), proyekOrangLain), false);
}

/* --- canEditAgenda --------------------------------------------------------- */

const agendaDia = { userId: 7 };
const agendaOrangLain = { userId: 99 };

// Manager boleh mengisikan untuk anggotanya; Admin juga.
for (const level of ["Admin", "Manager"] as const) {
  assert.equal(canEditAgenda(orang(7, level), agendaDia), true);
  assert.equal(canEditAgenda(orang(7, level), agendaOrangLain), true);
}

// Anggota hanya agendanya sendiri.
assert.equal(canEditAgenda(orang(7, "Anggota"), agendaDia), true);
assert.equal(canEditAgenda(orang(7, "Anggota"), agendaOrangLain), false);

// Owner dan HR melihat saja, tidak pernah mengisi.
for (const level of ["Owner", "HR"] as const) {
  assert.equal(canEditAgenda(orang(7, level), agendaDia), false);
  assert.equal(canEditAgenda(orang(7, level), agendaOrangLain), false);
}

/* --- Penyensoran keuangan -------------------------------------------------- */

assert.deepEqual([...FINANCE_FIELDS], [...new Set(FINANCE_FIELDS)]);

const baris = {
  id: 1,
  name: "Proyek Uji",
  value: 505_000_000,
  salesFee: 20_000_000,
  operationalCost: 460_000_000,
  revenueBase: 454_954_955,
  margin: -25_045_045,
  marginPct: -0.055,
  deadline: "2026-09-30",
};

const disensor = redactFinance(baris);
// Semua kunci keuangan hilang...
for (const f of FINANCE_FIELDS) {
  assert.equal(f in disensor, false, `${f} masih ada setelah disensor`);
}
// ...dan tidak ada kunci lain yang ikut terbuang.
assert.deepEqual(Object.keys(disensor).sort(), ["deadline", "id", "name"]);
// Objek asalnya tidak diubah di tempat.
assert.equal(baris.margin, -25_045_045);

// Nilainya dibuang, bukan ditimpa null: null di sistem ini berarti "belum
// diisi", jadi menimpanya akan berbohong soal kelengkapan data.
assert.ok((Object.values(disensor) as unknown[]).every((v) => v !== null));

/* --- landingPath ----------------------------------------------------------- */

// Tiap peran diantar ke halaman yang benar-benar boleh dia buka.
for (const level of ACCESS_LEVELS) {
  const tujuan = landingPath(level);
  if (tujuan === "/") assert.ok(can(level, "lihat-overview"));
  else assert.ok(can(level, "lihat-daftar"), `${level} diantar ke halaman yang bukan haknya`);
}
assert.equal(landingPath("HR"), "/proyek");
assert.equal(landingPath("Admin"), "/");

/* --- isAccessLevel --------------------------------------------------------- */

assert.equal(isAccessLevel("Admin"), true);
assert.equal(isAccessLevel("Anggota"), true);
assert.equal(isAccessLevel("admin"), false); // huruf kecil bukan nilai yang sah
assert.equal(isAccessLevel("Superadmin"), false);
assert.equal(isAccessLevel(""), false);
assert.equal(isAccessLevel(null as unknown), false);
assert.equal(isAccessLevel(1 as unknown), false);
assert.equal(isAccessLevel(undefined as unknown), false);

console.log("ok: permissions");
