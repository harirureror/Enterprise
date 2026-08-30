import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/* Hashing kata sandi memakai scrypt bawaan Node — tidak ada dependensi baru.

   scrypt dipilih karena sengaja lambat dan boros memori, jadi menebak sandi
   secara massal jadi mahal. Parameternya ikut disimpan di dalam string hash
   supaya sandi lama tetap bisa diverifikasi saat parameternya dinaikkan kelak. */

const N = 16384; // biaya CPU/memori
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Format: scrypt$N$r$p$saltHex$hashHex */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Cocokkan sandi dengan hash tersimpan. Selalu `false` untuk hash yang bentuknya
 * tidak dikenal — bukan melempar, supaya pemanggil tidak perlu membedakan
 * "hash rusak" dari "sandi salah" (perbedaan itu bocor ke penyerang).
 */
export function verifyPassword(password: string, stored: string): boolean {
  const bagian = stored.split("$");
  if (bagian.length !== 6 || bagian[0] !== "scrypt") return false;

  const n = Number(bagian[1]);
  const r = Number(bagian[2]);
  const p = Number(bagian[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let harapan: Buffer;
  try {
    salt = Buffer.from(bagian[4], "hex");
    harapan = Buffer.from(bagian[5], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || harapan.length === 0) return false;

  let aktual: Buffer;
  try {
    aktual = scryptSync(password, salt, harapan.length, { N: n, r, p });
  } catch {
    // Parameter di luar batas yang diterima Node (mis. N bukan pangkat dua).
    return false;
  }

  // Perbandingan tahan-waktu: lama pembandingan tidak boleh membocorkan
  // seberapa banyak byte awal yang sudah cocok.
  return aktual.length === harapan.length && timingSafeEqual(aktual, harapan);
}
