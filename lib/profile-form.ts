import { validateEmail } from "./user-form";

/* Validasi form profil. Fungsi murni, dipakai form di browser dan server action. */

export type ProfileDraft = {
  name: string;
  /** URL gambar. Kosong berarti pakai inisial. */
  avatarUrl: string;
  /** Sekaligus identitas login, jadi keunikannya dijaga sama ketatnya. */
  email: string;
};

export type ProfileField = keyof ProfileDraft;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const NAME_MIN = 2;
export const NAME_MAX = 80;

/**
 * Foto diterima sebagai URL, bukan unggahan berkas: penyimpanan berkas
 * (PRD bagian 5) belum ada, dan menyediakan tombol unggah yang tidak
 * menyimpan apa pun lebih buruk daripada meminta tautan.
 */
export function validateProfile(draft: ProfileDraft, emailLain: string[] = []): ProfileErrors {
  const errors: ProfileErrors = {};

  // Aturan email dipinjam dari user-form supaya jalur swalayan dan jalur admin
  // tidak pernah menerima alamat yang ditolak satunya.
  const galatEmail = validateEmail(draft.email, emailLain);
  if (galatEmail) errors.email = galatEmail;

  const name = draft.name.trim();
  if (name === "") errors.name = "Nama wajib diisi.";
  else if (name.length < NAME_MIN) errors.name = `Nama minimal ${NAME_MIN} karakter.`;
  else if (name.length > NAME_MAX) errors.name = `Nama maksimal ${NAME_MAX} karakter.`;

  const avatar = draft.avatarUrl.trim();
  if (avatar !== "") {
    let url: URL | null = null;
    try {
      url = new URL(avatar);
    } catch {
      url = null;
    }

    if (!url) errors.avatarUrl = "URL foto tidak valid.";
    else if (url.protocol !== "http:" && url.protocol !== "https:") {
      // Skema lain (javascript:, data:) tidak pantas dijadikan sumber gambar
      // yang akan ditampilkan ke pengguna lain.
      errors.avatarUrl = "URL foto harus diawali http:// atau https://";
    }
  }

  return errors;
}

/** Inisial dari nama, untuk avatar sementara saat foto belum diisi. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
