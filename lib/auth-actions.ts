"use server";

import { cookies } from "next/headers";
import { getUsers, updateUserIdentity } from "@/lib/api";
import { SESSION_COOKIE, getSessionUser, verifyCredentials } from "@/lib/auth";
import { SESSION_TTL_HOURS, createSession, revokeAllForUser, revokeSession } from "@/lib/session";
import {
  type ProfileDraft,
  type ProfileErrors,
  validateProfile,
} from "@/lib/profile-form";
import { revalidatePath } from "next/cache";
import {
  type LoginDraft,
  type LoginErrors,
  PESAN_KREDENSIAL_SALAH,
  validateLogin,
} from "@/lib/login-form";

export type MasukHasil = { ok: true } | { ok: false; error: string; errors: LoginErrors };

/**
 * Proses masuk. Kalau kredensialnya cocok, id pengguna disimpan di cookie sesi.
 *
 * ponytail: cookie ini belum ditandatangani, jadi belum bisa disebut kontrol
 * keamanan — penandatanganan menyusul bersama verifikasi hash sandi.
 */
export async function masuk(draft: LoginDraft): Promise<MasukHasil> {
  const errors = validateLogin(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const user = await verifyCredentials(draft.email, draft.password);
  if (!user) {
    // Satu pesan seragam: jangan bocorkan email mana yang terdaftar.
    return { ok: false, error: PESAN_KREDENSIAL_SALAH, errors: {} };
  }

  const sesi = createSession(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sesi.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // Cookie kedaluwarsa bersamaan dengan sesinya di server.
    maxAge: 60 * 60 * SESSION_TTL_HOURS,
  });

  return { ok: true };
}

/** Keluar: cabut sesinya di server, lalu hapus cookie. */
export async function keluar(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  // Dicabut di server juga — menghapus cookie saja menyisakan token yang
  // masih sah kalau sempat disalin.
  if (token) revokeSession(token);
  jar.delete(SESSION_COOKIE);
}

export type ProfilHasil = { ok: true } | { ok: false; error: string; errors: ProfileErrors };

/**
 * Perbarui profil pengguna yang sedang masuk.
 *
 * Email ikut bisa diubah di sini — untuk memperbaiki salah ketik pada alamat
 * sendiri. Karena email adalah identitas login, mengubahnya MENCABUT seluruh
 * sesi orang itu: kalau alamatnya diganti justru karena akunnya disalahgunakan,
 * sesi penyusup tidak boleh ikut bertahan.
 */
export async function perbaruiProfil(draft: ProfileDraft): Promise<ProfilHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) {
    return { ok: false, error: "Perlu masuk untuk mengubah profil.", errors: {} };
  }

  // Email akun lain saja; tanpa pengecualian ini, menyimpan tanpa mengganti
  // email akan dianggap bentrok dengan dirinya sendiri.
  const emailLain = (await getUsers())
    .filter((u) => u.id !== pengguna.id)
    .map((u) => u.email.toLowerCase());

  const errors = validateProfile(draft, emailLain);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const avatar = draft.avatarUrl.trim();
  const emailBaru = draft.email.trim();
  const emailBerubah = emailBaru.toLowerCase() !== pengguna.email.toLowerCase();

  const hasil = await updateUserIdentity(pengguna.id, {
    name: draft.name.trim(),
    email: emailBaru,
    // Kosong berarti kembali ke inisial, bukan menyimpan string kosong.
    avatarUrl: avatar === "" ? null : avatar,
  });

  if (!hasil.ok) {
    return { ok: false, error: hasil.error, errors: {} };
  }

  if (emailBerubah) {
    // Termasuk sesi ini sendiri — orangnya akan diminta masuk lagi dengan
    // alamat barunya, dan itu memang yang diharapkan.
    revokeAllForUser(pengguna.id);
  }

  // Nama muncul di topbar, daftar tim, dan riwayat — segarkan semuanya.
  revalidatePath("/", "layout");
  return { ok: true };
}
