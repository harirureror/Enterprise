import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, getUsers } from "./api";
import { type Ability, can, landingPath } from "./permissions";
import { credentials as mockCredentials } from "./mock-data";
import { verifyPassword } from "./password";
import { getSessionUserId } from "./session";
import type { User } from "./types";

/**
 * Satu pintu identitas. Seluruh kode yang butuh "siapa yang sedang memakai
 * aplikasi" memanggil `getSession()` — bukan `getCurrentUser()` langsung —
 * supaya saat login sungguhan jadi (fase 4), yang berubah hanya berkas ini.
 *
 * PENTING soal keadaan sekarang: belum ada verifikasi kredensial. Cookie sesi
 * hanya berisi id pengguna dan tidak ditandatangani, jadi ini BUKAN kontrol
 * keamanan — fungsinya memisahkan "identitas" dari "data" supaya lapisan akses
 * sudah pada tempatnya. Di produksi tanpa login, akses ditolak ketimbang
 * diam-diam memakai pengguna bawaan.
 */

export const SESSION_COOKIE = "jsi_session";

export type Session = {
  user: User;
  /**
   * `dev-fallback` berarti identitasnya diasumsikan, bukan dibuktikan.
   * Berguna untuk mengembangkan fase 1-3 sebelum login ada.
   */
  source: "cookie" | "dev-fallback";
};

/** Sesi saat ini, atau `null` kalau tidak ada identitas yang bisa dipakai. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const nilai = jar.get(SESSION_COOKIE)?.value;

  if (nilai) {
    // Cookie berisi token acak, bukan id pengguna: id bisa ditebak siapa saja,
    // token tidak — dan token bisa dicabut.
    const id = getSessionUserId(nilai);
    if (id !== null) {
      const user = (await getUsers()).find((u) => u.id === id);
      // Akun yang dinonaktifkan tidak boleh lolos hanya karena tokennya belum
      // kedaluwarsa. Sesinya memang dicabut saat dinonaktifkan, tapi pemeriksaan
      // di sini yang membuatnya tidak bergantung pada langkah itu berhasil.
      if (user && user.isActive) return { user, source: "cookie" };
    }
    // Token tidak dikenal atau kedaluwarsa: perlakukan seperti tidak ada.
  }

  // Belum ada halaman login, jadi menolak semua permintaan tanpa cookie akan
  // membuat aplikasinya tidak bisa dipakai sama sekali. Selama itu, identitas
  // jatuh ke pengguna bawaan — dan ditandai `dev-fallback` supaya jelas bahwa
  // identitasnya diasumsikan.
  //
  // Setel env REQUIRE_AUTH untuk mematikan kelonggaran ini; itu yang dipakai
  // menguji jalur 401, dan yang dinyalakan permanen begitu fase 4 selesai.
  if (!authWajib()) {
    return { user: await getCurrentUser(), source: "dev-fallback" };
  }

  return null;
}

/**
 * Sesi wajib dibuktikan, bukan diasumsikan.
 *
 * Menyala secara bawaan sejak peran diberlakukan: selama jalan pintas
 * `dev-fallback` hidup, siapa pun yang membuka aplikasi otomatis jadi pengguna
 * pertama — dan pembedaan peran tidak menahan apa pun. Setel REQUIRE_AUTH=0
 * hanya kalau sengaja mau mematikannya saat mengembangkan.
 */
export function authWajib(): boolean {
  return process.env.REQUIRE_AUTH !== "0";
}

/** Sesi yang wajib ada. `null` berarti pemanggil harus membalas 401. */
export async function requireSession(): Promise<Session | null> {
  return getSession();
}

/** Pengguna aktif saja, untuk pemanggil yang tidak peduli asal identitasnya. */
export async function getSessionUser(): Promise<User | null> {
  return (await getSession())?.user ?? null;
}

/* --- Penjaga kemampuan -----------------------------------------------------

   Dua bentuk untuk dua tempat: halaman mengalihkan, server action membalas.
   Keduanya membaca matriks yang sama di lib/permissions.ts. */

/**
 * Penjaga halaman. Tanpa sesi diantar ke /login; punya sesi tapi bukan haknya
 * diantar ke halaman yang memang boleh dia buka — bukan ke halaman kosong atau
 * pesan galat yang tidak bisa ditindaklanjuti.
 */
export async function requireAbility(ability: Ability): Promise<User> {
  const sesi = await getSession();
  if (!sesi) redirect("/login");
  if (!can(sesi.user.accessLevel, ability)) redirect(landingPath(sesi.user.accessLevel));
  return sesi.user;
}

export type Ditolak = { ok: false; error: string; errors: Record<string, never> };

/**
 * Penjaga server action. `null` berarti lolos; selain itu hasil penolakan yang
 * bentuknya sudah cocok dengan `SimpanHasil` dan kerabatnya di lib/actions.ts.
 */
export async function tolakKalauTakBoleh(ability: Ability): Promise<Ditolak | null> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk melakukan ini.", errors: {} };
  if (!can(pengguna.accessLevel, ability)) {
    return { ok: false, error: "Akses Anda tidak mencakup tindakan ini.", errors: {} };
  }
  return null;
}

/**
 * Cocokkan kredensial. Mengembalikan pengguna kalau cocok, `null` kalau tidak —
 * tanpa membedakan "email tidak ada" dari "sandi salah", supaya pemanggil tidak
 * bisa dipakai menebak siapa yang punya akun.
 *
 * Dua jalur, keduanya hanya di luar produksi:
 *   1. Kredensial per akun dengan hash scrypt (akun uji).
 *   2. DEV_LOGIN_PASSWORD — satu sandi untuk semua akun seed, untuk menelusuri
 *      aplikasi sebagai anggota mana pun tanpa membuat sandi satu per satu.
 *
 * ponytail: begitu pendaftaran ada, kredensial nyata (devOnly: false) berlaku
 * di semua lingkungan dan jalur kedua dihapus.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const produksi = process.env.NODE_ENV === "production";
  const alamat = email.trim().toLowerCase();
  const ditemukan = (await getUsers()).find((u) => u.email.toLowerCase() === alamat || u.name.toLowerCase() === alamat);
  // Akun nonaktif diperlakukan persis seperti akun yang tidak ada — termasuk
  // sandinya tetap diperiksa — supaya tidak bocor akun mana yang dinonaktifkan.
  const user = ditemukan?.isActive ? ditemukan : undefined;

  // Sandi tetap diperiksa walau penggunanya tidak ada, supaya lama proses tidak
  // membocorkan email mana yang terdaftar.
  const kredensial = user ? mockCredentials.find((c) => c.userId === user.id) : undefined;

  if (kredensial && !(kredensial.devOnly && produksi)) {
    return verifyPassword(password, kredensial.passwordHash) && user ? user : null;
  }

  const devPassword = process.env.DEV_LOGIN_PASSWORD;
  if (!devPassword || produksi || !user) return null;

  return password === devPassword ? user : null;
}
