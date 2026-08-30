import { randomBytes } from "node:crypto";

/* Sesi bertoken. Cookie sebelumnya berisi id pengguna — siapa pun bisa menulis
   "2" dan menjadi orang lain. Token acak 256-bit menutup itu tanpa perlu
   menandatangani cookie: nilainya tidak bisa ditebak dan bisa dicabut.

   ponytail: penyimpanan masih di memori (hilang saat server restart, dan tidak
   dibagi antar instance). Bentuk datanya sudah sama dengan tabel `sessions`
   di migrasi 9, jadi pindahnya tinggal mengganti isi fungsi-fungsi ini. */

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

const store = new Map<string, Session>();

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
  store.set(session.token, session);
  return session;
}

/** Id pengguna dari token, atau `null` kalau tidak ada / sudah kedaluwarsa. */
export function getSessionUserId(token: string): number | null {
  const session = store.get(token);
  if (!session) return null;

  if (session.expiresAt <= sekarang()) {
    // Sekalian dibuang supaya tidak menumpuk.
    store.delete(token);
    return null;
  }

  return session.userId;
}

export function revokeSession(token: string): boolean {
  return store.delete(token);
}

/** Cabut seluruh sesi satu pengguna — dipakai saat ganti sandi atau ditangguhkan. */
export function revokeAllForUser(userId: number): number {
  let jumlah = 0;
  for (const [token, s] of store) {
    if (s.userId === userId) {
      store.delete(token);
      jumlah++;
    }
  }
  return jumlah;
}

/** Buang sesi kedaluwarsa. Dipanggil penjadwal, atau saat pengujian. */
export function purgeExpired(): number {
  const batas = sekarang();
  let jumlah = 0;
  for (const [token, s] of store) {
    if (s.expiresAt <= batas) {
      store.delete(token);
      jumlah++;
    }
  }
  return jumlah;
}

/** Hanya untuk pengujian: kosongkan seluruh sesi. */
export function clearSessions(): void {
  store.clear();
}
