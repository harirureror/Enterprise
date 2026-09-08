/* Validasi form catat perkembangan. Fungsi murni, dipakai form di browser dan
   server action — sama seperti lib/project-form.ts.

   Persennya sudah tidak ada di sini. Sejak progres sepenuhnya diturunkan dari
   checklist aktivitas, menyediakan isian angka di sampingnya berarti menawarkan
   dua kebenaran untuk satu hal — dan yang diketik akan langsung ditimpa centang
   berikutnya. Yang tersisa adalah ceritanya, dan itu memang tidak bisa
   diturunkan dari mana pun. */

export type ProgressDraft = {
  note: string;
};

export type ProgressField = keyof ProgressDraft;
export type ProgressErrors = Partial<Record<ProgressField, string>>;

export const NOTE_MAX = 300;
export const NOTE_MIN = 3;

export function emptyProgressDraft(): ProgressDraft {
  return { note: "" };
}

/**
 * Catatan wajib diisi. Baris riwayat tanpa isi tidak menceritakan apa pun,
 * dan riwayat yang penuh baris kosong berhenti dibaca orang.
 */
export function validateProgress(draft: ProgressDraft): ProgressErrors {
  const errors: ProgressErrors = {};

  const note = draft.note.trim();
  if (note === "") errors.note = "Catatan wajib diisi.";
  else if (note.length < NOTE_MIN) errors.note = `Catatan minimal ${NOTE_MIN} karakter.`;
  else if (note.length > NOTE_MAX) errors.note = `Catatan maksimal ${NOTE_MAX} karakter.`;

  return errors;
}
