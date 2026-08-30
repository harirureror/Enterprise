/**
 * Cek mandiri pilihan kolom tabel: `npx tsx lib/table-columns.check.ts`
 * ponytail: assert polos, sejalan dengan lib/notification-reads.check.ts.
 */
import assert from "node:assert/strict";
import {
  COLUMN_KEYS,
  PROJECT_COLUMNS,
  defaultColumns,
  mergeColumns,
  serverColumns,
  toggleColumn,
  visibleCount,
} from "./table-columns";

/* --- Bentuk daftar kolom --------------------------------------------------- */

// Tiap kolom punya kunci unik dan label yang terbaca.
assert.deepEqual(COLUMN_KEYS, [...new Set(COLUMN_KEYS)]);
assert.ok(PROJECT_COLUMNS.every((c) => c.label.trim().length > 0));

// Kolom nama proyek dan aksi tidak boleh ada di sini — keduanya selalu tampil.
assert.equal(
  PROJECT_COLUMNS.some((c) => (c.key as string) === "nama" || (c.key as string) === "aksi"),
  false
);

// Default menyebut semua kolom, tidak ada yang tertinggal jadi undefined.
const bawaan = defaultColumns();
assert.deepEqual(Object.keys(bawaan).sort(), [...COLUMN_KEYS].sort());
assert.ok(Object.values(bawaan).every((v) => typeof v === "boolean"));

// Setidaknya satu kolom tampil secara bawaan; tabel kosong tidak berguna.
assert.ok(visibleCount(bawaan) > 0);

// Kolom uang sengaja mati secara bawaan, No Kontrak menyala.
assert.equal(bawaan.nilai, false);
assert.equal(bawaan.margin, false);
assert.equal(bawaan.kontrak, true);

/* --- Penggabungan dengan data tersimpan ------------------------------------ */

// Pilihan tersimpan menang atas default.
assert.equal(mergeColumns({ margin: true }).margin, true);
assert.equal(mergeColumns({ status: false }).status, false);

// Kolom yang tidak disebut data lama tetap memakai default — bukan hilang.
// Ini yang menjaga kolom baru tetap muncul untuk orang yang sudah pernah
// menyimpan pilihannya.
const separuh = mergeColumns({ status: false });
assert.deepEqual(Object.keys(separuh).sort(), [...COLUMN_KEYS].sort());
assert.equal(separuh.jenis, bawaan.jenis);
assert.equal(separuh.margin, bawaan.margin);

// Kunci asing diabaikan, tidak diteruskan ke hasil.
const asing = mergeColumns({ margin: true, kolomHantu: true });
assert.equal("kolomHantu" in asing, false);
assert.deepEqual(Object.keys(asing).sort(), [...COLUMN_KEYS].sort());

// Nilai bertipe salah diabaikan, bukan dipaksa jadi boolean.
assert.equal(mergeColumns({ status: "ya" }).status, bawaan.status);
assert.equal(mergeColumns({ status: 0 }).status, bawaan.status);
assert.equal(mergeColumns({ status: null }).status, bawaan.status);

// Bentuk yang sama sekali bukan objek jatuh ke default, tidak melempar.
for (const rusak of [null, undefined, 42, "kolom", [], [1, 2], true]) {
  assert.deepEqual(mergeColumns(rusak), bawaan);
}

// Menggabungkan hasil gabungan tidak mengubah apa pun (idempoten).
assert.deepEqual(mergeColumns(asing), asing);

/* --- Toggle ---------------------------------------------------------------- */

const sesudah = toggleColumn(bawaan, "margin");
assert.equal(sesudah.margin, !bawaan.margin);
// Kolom lain tidak ikut tersenggol.
assert.equal(sesudah.status, bawaan.status);
// Array asal tidak diubah di tempat.
assert.equal(bawaan.margin, false);

// Bolak-balik kembali ke keadaan semula.
assert.deepEqual(toggleColumn(toggleColumn(bawaan, "status"), "status"), bawaan);

// Hitungan kolom tampil ikut bergerak.
assert.equal(visibleCount(toggleColumn(bawaan, "margin")), visibleCount(bawaan) + 1);
assert.equal(visibleCount(toggleColumn(bawaan, "status")), visibleCount(bawaan) - 1);

// Semua kolom bisa dimatikan sekaligus — nama proyek dan aksi tetap menahan
// tabelnya, jadi keadaan ini sah dan tidak boleh membuat hitungannya kacau.
const kosong = COLUMN_KEYS.reduce((acc, k) => (acc[k] ? toggleColumn(acc, k) : acc), bawaan);
assert.equal(visibleCount(kosong), 0);

/* --- Sisi server ----------------------------------------------------------- */

// Di server belum ada localStorage: "belum diketahui", bukan "kosong".
assert.equal(serverColumns(), null);

console.log("ok: table-columns");
