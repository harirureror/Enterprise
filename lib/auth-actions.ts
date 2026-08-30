"use server";

import { cookies } from "next/headers";
import { updateUser } from "@/lib/api";
import { SESSION_COOKIE, getSessionUser, verifyCredentials } from "@/lib/auth";
import { SESSION_TTL_HOURS, createSession, revokeSession } from "@/lib/session";
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

/** Perbarui profil pengguna yang sedang masuk. */
export async function perbaruiProfil(draft: ProfileDraft): Promise<ProfilHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) {
    return { ok: false, error: "Perlu masuk untuk mengubah profil.", errors: {} };
  }

  const errors = validateProfile(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const avatar = draft.avatarUrl.trim();
  const hasil = await updateUser(pengguna.id, {
    name: draft.name.trim(),
    // Kosong berarti kembali ke inisial, bukan menyimpan string kosong.
    avatarUrl: avatar === "" ? null : avatar,
  });

  if (hasil === null) {
    return { ok: false, error: "Akun tidak ditemukan.", errors: {} };
  }

  // Nama muncul di topbar, daftar tim, dan riwayat — segarkan semuanya.
  revalidatePath("/", "layout");
  return { ok: true };
}
