import { PASSWORD_MIN } from "./login-form";
import { isAccessLevel } from "./permissions";
import type { AccessLevel } from "./types";

/* Validasi form pengguna, dipakai halaman Kelola Pengguna dan server action-nya.
   Fungsi murni supaya aturannya bisa diuji tanpa peramban maupun database. */

export type UserDraft = {
  name: string;
  email: string;
  /** Jabatan, teks bebas — bukan penentu hak akses. */
  role: string;
  accessLevel: string;
  /** Sandi awal. Kosong saat mengubah data, wajib saat membuat akun. */
  password: string;
};

export type UserField = keyof UserDraft;
export type UserErrors = Partial<Record<UserField, string>>;

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const ROLE_MAX = 60;

/* Cukup memastikan bentuknya masuk akal — sama seperti di login-form.ts.
   Pola yang terlalu ketat menolak alamat yang sah. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyUserDraft(): UserDraft {
  return {
    name: "",
    email: "",
    role: "",
    // Hak paling kecil sebagai bawaan: menaikkan akses harus jadi tindakan
    // sadar, bukan akibat lupa mengubah pilihan.
    accessLevel: "Anggota",
    password: "",
  };
}

/**
 * Periksa isian akun.
 *
 * `emailLain` adalah email yang sudah dipakai akun lain, huruf kecil semua —
 * pemanggil yang menyiapkannya karena hanya dia yang tahu akun mana yang
 * sedang diedit. `wajibSandi` dimatikan saat mengubah akun yang sudah ada.
 */
export function validateUser(
  draft: UserDraft,
  emailLain: string[],
  options: { wajibSandi?: boolean } = {}
): UserErrors {
  const errors: UserErrors = {};
  const wajibSandi = options.wajibSandi ?? true;

  const name = draft.name.trim();
  if (name === "") errors.name = "Nama wajib diisi.";
  else if (name.length < NAME_MIN) errors.name = `Nama minimal ${NAME_MIN} karakter.`;
  else if (name.length > NAME_MAX) errors.name = `Nama maksimal ${NAME_MAX} karakter.`;

  const email = draft.email.trim();
  if (email === "") errors.email = "Email wajib diisi.";
  else if (!EMAIL.test(email)) errors.email = "Format email tidak valid.";
  // Perbandingan huruf kecil, sejalan dengan idx_users_email_lower di skema.
  // Tanpa ini dua baris bisa mewakili satu identitas login.
  else if (emailLain.includes(email.toLowerCase())) errors.email = "Email sudah dipakai akun lain.";

  if (draft.role.trim().length > ROLE_MAX) {
    errors.role = `Jabatan maksimal ${ROLE_MAX} karakter.`;
  }

  if (!isAccessLevel(draft.accessLevel)) {
    errors.accessLevel = "Tingkat akses tidak dikenal.";
  }

  if (wajibSandi || draft.password !== "") {
    if (draft.password === "") errors.password = "Sandi awal wajib diisi.";
    else if (draft.password.length < PASSWORD_MIN) {
      errors.password = `Sandi minimal ${PASSWORD_MIN} karakter.`;
    }
  }

  return errors;
}

/** Isian yang sudah lolos validasi jadi data akun (tanpa id dan sandi). */
export function draftToUser(draft: UserDraft): {
  name: string;
  email: string;
  role: string;
  accessLevel: AccessLevel;
} {
  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    // Jabatan kosong tidak apa-apa; yang menentukan hak adalah accessLevel.
    role: draft.role.trim(),
    accessLevel: draft.accessLevel as AccessLevel,
  };
}
