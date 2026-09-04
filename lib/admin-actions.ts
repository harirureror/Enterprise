"use server";

import { revalidatePath } from "next/cache";
import {
  createUser,
  emailTerpakai,
  getUsers,
  jumlahAdminAktif,
  setUserAccessLevel,
  setUserActive,
  setUserPassword,
} from "@/lib/api";
import { getSessionUser, tolakKalauTakBoleh } from "@/lib/auth";
import { PASSWORD_MIN } from "@/lib/login-form";
import { hashPassword } from "@/lib/password";
import { isAccessLevel } from "@/lib/permissions";
import { revokeAllForUser } from "@/lib/session";
import { type UserDraft, type UserErrors, draftToUser, validateUser } from "@/lib/user-form";
import type { AccessLevel } from "@/lib/types";

/* Kelola pengguna — satu-satunya kemampuan yang khusus milik Admin.

   Setiap action memeriksa izinnya sendiri lewat tolakKalauTakBoleh(): tombolnya
   memang tidak dirender untuk peran lain, tapi tombol yang tidak terlihat bukan
   kontrol keamanan. Yang menahan ada di sini. */

export type AdminHasil = { ok: true } | { ok: false; error: string; errors: UserErrors };

/** Dua pengaman yang berlaku di semua tindakan yang menyentuh akun admin. */
async function jagaAdminTerakhir(
  targetId: number,
  akanTetapAdminAktif: boolean
): Promise<string | null> {
  const semua = await getUsers();
  const target = semua.find((u) => u.id === targetId);
  if (!target) return "Akun tidak ditemukan.";

  const masihAdmin = target.isActive && target.accessLevel === "Admin";
  if (!masihAdmin || akanTetapAdminAktif) return null;

  // Tanpa penjaga ini, satu klik bisa membuat aplikasi tidak punya admin lagi
  // dan hanya bisa diperbaiki lewat SQL langsung ke database.
  if ((await jumlahAdminAktif()) <= 1) {
    return "Ini admin aktif terakhir. Angkat admin lain lebih dulu.";
  }
  return null;
}

/** Tambah akun beserta sandi awalnya. */
export async function tambahPengguna(draft: UserDraft): Promise<AdminHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-pengguna");
  if (ditolak) return ditolak;

  const emailLain = (await getUsers()).map((u) => u.email.toLowerCase());
  const errors = validateUser(draft, emailLain);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const user = await createUser(draftToUser(draft), hashPassword(draft.password));
  if (user === null) {
    // Lolos validasi tapi ditolak lapisan data: kemungkinan ada yang menambah
    // email yang sama di saat bersamaan.
    return { ok: false, error: "Email sudah dipakai akun lain.", errors: { email: "Sudah dipakai." } };
  }

  revalidatePath("/admin/pengguna");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Setel ulang sandi, lalu cabut semua sesinya.
 *
 * Mencabut sesi itu inti dari reset: tanpa itu orang yang sandinya diganti
 * tetap bisa memakai aplikasi sampai 12 jam ke depan dengan sesi lamanya.
 */
export async function resetSandi(userId: number, sandiBaru: string): Promise<AdminHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-pengguna");
  if (ditolak) return ditolak;

  if (sandiBaru.length < PASSWORD_MIN) {
    return {
      ok: false,
      error: "Sandi terlalu pendek.",
      errors: { password: `Sandi minimal ${PASSWORD_MIN} karakter.` },
    };
  }

  const berhasil = await setUserPassword(userId, hashPassword(sandiBaru));
  if (!berhasil) return { ok: false, error: "Akun tidak ditemukan.", errors: {} };

  revokeAllForUser(userId);
  revalidatePath("/admin/pengguna");
  return { ok: true };
}

/** Ubah tingkat akses. Sesinya dicabut supaya hak barunya langsung berlaku. */
export async function ubahTingkatAkses(userId: number, level: string): Promise<AdminHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-pengguna");
  if (ditolak) return ditolak;

  if (!isAccessLevel(level)) {
    return { ok: false, error: "Tingkat akses tidak dikenal.", errors: {} };
  }

  const saya = await getSessionUser();
  if (saya && saya.id === userId && level !== "Admin") {
    // Menurunkan diri sendiri akan mengunci orangnya keluar dari halaman ini
    // di klik yang sama — hampir pasti bukan yang dia maksud.
    return { ok: false, error: "Tidak bisa menurunkan tingkat akses sendiri.", errors: {} };
  }

  const halangan = await jagaAdminTerakhir(userId, level === "Admin");
  if (halangan) return { ok: false, error: halangan, errors: {} };

  const user = await setUserAccessLevel(userId, level as AccessLevel);
  if (user === null) return { ok: false, error: "Akun tidak ditemukan.", errors: {} };

  revokeAllForUser(userId);
  revalidatePath("/admin/pengguna");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Nonaktifkan atau aktifkan kembali sebuah akun. */
export async function ubahAktifPengguna(userId: number, aktif: boolean): Promise<AdminHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-pengguna");
  if (ditolak) return ditolak;

  const saya = await getSessionUser();
  if (saya && saya.id === userId && !aktif) {
    return { ok: false, error: "Tidak bisa menonaktifkan akun sendiri.", errors: {} };
  }

  const halangan = await jagaAdminTerakhir(userId, aktif);
  if (halangan) return { ok: false, error: halangan, errors: {} };

  const user = await setUserActive(userId, aktif);
  if (user === null) return { ok: false, error: "Akun tidak ditemukan.", errors: {} };

  // Dinonaktifkan berarti keluar sekarang, bukan saat sesinya kedaluwarsa.
  if (!aktif) revokeAllForUser(userId);
  revalidatePath("/admin/pengguna");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Dipakai form untuk memberi tahu lebih awal kalau emailnya sudah dipakai. */
export async function emailSudahDipakai(email: string): Promise<boolean> {
  const ditolak = await tolakKalauTakBoleh("kelola-pengguna");
  if (ditolak) return true;
  return emailTerpakai(email);
}
