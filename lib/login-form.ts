/* Validasi form masuk. Fungsi murni, dipakai form di browser dan server action.

   Catatan penting soal pesan kesalahan: validasi di sini hanya menilai BENTUK
   isian (kosong, format email). Salah kredensial dijawab satu pesan seragam
   dari server — memberi tahu "email tidak terdaftar" akan membocorkan siapa
   saja yang punya akun. */

export type LoginDraft = {
  email: string;
  password: string;
};

export type LoginField = keyof LoginDraft;
export type LoginErrors = Partial<Record<LoginField, string>>;

/**
 * Panjang minimal untuk sandi BARU (pendaftaran / ganti sandi).
 *
 * Sengaja tidak dipakai di form masuk: menolak sandi pendek saat login berarti
 * mengunci akun yang sandinya dibuat sebelum aturan ini ada, dan pesannya
 * ikut membocorkan panjang sandi yang berlaku. Form masuk hanya memastikan
 * kolomnya terisi; benar atau tidaknya dijawab server dengan satu pesan seragam.
 */
export const PASSWORD_MIN = 8;

/** Satu-satunya pesan untuk kredensial salah, apa pun sebabnya. */
export const PESAN_KREDENSIAL_SALAH = "Identitas atau kata sandi salah.";

export function emptyLoginDraft(): LoginDraft {
  return { email: "", password: "" };
}

export function validateLogin(draft: LoginDraft): LoginErrors {
  const errors: LoginErrors = {};

  const email = draft.email.trim();
  if (email === "") errors.email = "Email atau nama pengguna wajib diisi.";

  // Hanya "terisi atau tidak" — lihat catatan di PASSWORD_MIN.
  if (draft.password === "") errors.password = "Kata sandi wajib diisi.";

  return errors;
}
