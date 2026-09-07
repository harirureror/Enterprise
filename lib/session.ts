import { randomBytes } from "node:crypto";
import { sessions } from "./db/store";

/* Sesi bertoken. Cookie sebelumnya berisi id pengguna — siapa pun bisa menulis
   "2" dan menjadi orang lain. Token acak 256-bit menutup itu tanpa perlu
   menandatangani cookie: nilainya tidak bisa ditebak dan bisa dicabut.

   Disimpan di tabel `sessions`, bukan di memori. Dua akibatnya:

   1. Orang tetap masuk setelah server dimulai ulang.
   2. Route handler dan halaman punya salinan modul sendiri-sendiri, tapi
      keduanya membaca file database yang sama — jadi sesi yang dibuat lewat
      form login kini juga berlaku untuk endpoint API, dan sebaliknya. */

export type Session = {
  token: string;
  userId: number;
  createdAt: string;
  expiresAt: string;
};

/** Umur sesi: satu hari kerja penuh. */
export const SESSION_TTL_HOURS = 12;

/** Panjang token dalam byte; 32 byte = 64 karakter heksadesimal. */
const TOKEN_BYTES = 32;

/** Bentuk token yang sah — dipakai juga middleware untuk menyaring lebih awal. */
export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function nowPlus(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString().replace("T", " ").slice(0, 19);
}

function sekarang(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function createSession(userId: number): Session {
  const session: Session = {
    token: randomBytes(TOKEN_BYTES).toString("hex"),
    userId,
    createdAt: sekarang(),
    expiresAt: nowPlus(SESSION_TTL_HOURS),
  };
  sessions.insert(session.token, session.userId, session.expiresAt);
  return session;
}

/**
 * Id pengguna dari token, atau `null` kalau tidak ada / sudah kedaluwarsa.
 * Kedaluwarsa disaring di query, jadi token basi tidak pernah lolos walau
 * barisnya belum sempat dibersihkan.
 */
export function getSessionUserId(token: string): number | null {
  return sessions.userId(token);
}

export function revokeSession(token: string): boolean {
  return sessions.revoke(token);
}

/** Cabut seluruh sesi satu pengguna — dipakai saat ganti sandi atau ditangguhkan. */
export function revokeAllForUser(userId: number): number {
  return sessions.revokeAllForUser(userId);
}

/** Buang sesi kedaluwarsa. Dipanggil penjadwal, atau saat pengujian. */
export function purgeExpired(): number {
  return sessions.purgeExpired();
}

/** Hanya untuk pengujian: kosongkan seluruh sesi. */
export function clearSessions(): void {
  sessions.clear();
}
