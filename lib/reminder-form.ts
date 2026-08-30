/* Validasi form kirim pengingat. Fungsi murni, dipakai form di browser dan
   server action — pola yang sama dengan lib/project-form.ts. */

export type ReminderDraft = {
  message: string;
};

export type ReminderField = keyof ReminderDraft;
export type ReminderErrors = Partial<Record<ReminderField, string>>;

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 300;

/** Kalimat siap pakai supaya pengirim tidak mulai dari halaman kosong. */
export const REMINDER_TEMPLATES = [
  "Mohon perbarui progres proyek ini.",
  "Tenggat sudah dekat, tolong dicek kesiapannya.",
  "Butuh update status untuk laporan mingguan.",
] as const;

export function emptyReminderDraft(): ReminderDraft {
  return { message: "" };
}

export function validateReminder(draft: ReminderDraft): ReminderErrors {
  const errors: ReminderErrors = {};
  const pesan = draft.message.trim();

  if (pesan === "") errors.message = "Pesan pengingat wajib diisi.";
  else if (pesan.length < MESSAGE_MIN) {
    errors.message = `Pesan minimal ${MESSAGE_MIN} karakter.`;
  } else if (pesan.length > MESSAGE_MAX) {
    errors.message = `Pesan maksimal ${MESSAGE_MAX} karakter.`;
  }

  return errors;
}
