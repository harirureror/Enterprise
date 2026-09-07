import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Koneksi SQLite tunggal. Pakai `node:sqlite` bawaan Node — tidak ada dependensi baru,
 * tidak ada langkah build tambahan.
 *
 * ponytail: `lib/api.ts` masih baca mock-data; penggantinya jadi query ke sini
 * dikerjakan di task berikutnya, jadi file ini belum dipanggil dari halaman.
 */

/** Bisa ditimpa lewat env, mis. saat test atau deploy ke disk lain. */
export const DB_PATH =
  process.env.DASHBOARD_DB_PATH ?? path.join(process.cwd(), "data", "dashboard.db");

let cached: DatabaseSync | null = null;

/** Buka (atau pakai ulang) koneksi ke file database utama. */
export function getDb(): DatabaseSync {
  cached ??= openDb(DB_PATH);
  return cached;
}

/**
 * Buka koneksi baru ke path mana pun — dipakai skrip CLI dan self-check
 * (`":memory:"`) supaya tidak menyentuh database utama.
 */
export function openDb(filename: string): DatabaseSync {
  // Nama khusus SQLite (":memory:") bukan path, jadi tidak perlu bikin folder.
  if (!filename.startsWith(":")) {
    mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new DatabaseSync(filename);
  // Foreign key di SQLite mati secara default; tanpa ini owner_id tidak dijaga.
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function closeDb(): void {
  cached?.close();
  cached = null;
}

/**
 * Hanya untuk pengujian: pakai koneksi ini sebagai pengganti file utama.
 *
 * Ada sebagai jahitan yang terlihat, bukan lewat env yang dibaca diam-diam saat
 * modul dimuat — dengan begitu berkas check bisa menyiapkan database sendiri
 * tanpa pernah menyentuh data/dashboard.db.
 */
export function pakaiDb(db: DatabaseSync | null): void {
  cached = db;
}
