/* Validasi form catat progres. Fungsi murni, dipakai form di browser dan
   server action — sama seperti lib/project-form.ts. */

export type ProgressDraft = {
  /** String karena datang dari input HTML. */
  progressPct: string;
  note: string;
};

export type ProgressField = keyof ProgressDraft;
export type ProgressErrors = Partial<Record<ProgressField, string>>;

export const NOTE_MAX = 300;

export function emptyProgressDraft(current: number): ProgressDraft {
  return { progressPct: String(current), note: "" };
}

/**
 * `current` adalah progres proyek saat ini. Kalau angkanya tidak berubah dan
 * catatannya kosong, tidak ada yang layak dicatat — itu dianggap kesalahan
 * supaya riwayat tidak penuh baris tanpa isi.
 */
export function validateProgress(draft: ProgressDraft, current: number): ProgressErrors {
  const errors: ProgressErrors = {};

  const nilai = Number(draft.progressPct);
  const angkaSah =
    draft.progressPct.trim() !== "" && Number.isInteger(nilai) && nilai >= 0 && nilai <= 100;

  if (draft.progressPct.trim() === "" || !Number.isInteger(nilai)) {
    errors.progressPct = "Progres harus berupa angka bulat.";
  } else if (nilai < 0 || nilai > 100) {
    errors.progressPct = "Progres harus antara 0 dan 100.";
  }

  const note = draft.note.trim();
  if (note.length > NOTE_MAX) {
    errors.note = `Catatan maksimal ${NOTE_MAX} karakter.`;
  } else if (angkaSah && nilai === current && note === "") {
    errors.note = "Isi catatan kalau persentasenya tidak berubah.";
  }

  return errors;
}
