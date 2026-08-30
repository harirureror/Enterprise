import { toDay } from "./timeline";

/* Jadwal pengingat berulang. Perhitungan tanggalnya dipisah ke sini supaya
   bisa diuji tanpa menyentuh React maupun tanggal sistem — setiap fungsi
   menerima tanggal acuan sebagai argumen. */

export type ReminderFrequency = "harian" | "mingguan" | "dua-mingguan" | "bulanan";

export const REMINDER_FREQUENCIES: ReminderFrequency[] = [
  "harian",
  "mingguan",
  "dua-mingguan",
  "bulanan",
];

export const FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  harian: "Setiap hari",
  mingguan: "Setiap minggu",
  "dua-mingguan": "Setiap dua minggu",
  bulanan: "Setiap bulan",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function tanggalNyata(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/**
 * Tanggal pengingat berikutnya setelah `dari`.
 *
 * Bulanan memakai aritmetika kalender, bukan 30 hari, supaya tanggalnya tetap
 * di angka yang sama tiap bulan. Kalau tanggalnya tidak ada di bulan tujuan
 * (31 Januari → Februari), dipakai hari terakhir bulan itu — bukan melompat ke
 * bulan berikutnya seperti perilaku bawaan `Date`.
 */
export function nextOccurrence(dari: string, frequency: ReminderFrequency): string {
  const d = new Date(`${dari}T00:00:00Z`);

  if (frequency === "bulanan") {
    const tanggalAsli = d.getUTCDate();
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    // Hari terakhir bulan tujuan.
    const akhirBulan = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
    ).getUTCDate();
    target.setUTCDate(Math.min(tanggalAsli, akhirBulan));
    return target.toISOString().slice(0, 10);
  }

  const hari = frequency === "harian" ? 1 : frequency === "mingguan" ? 7 : 14;
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

/** Jadwal sudah waktunya dikirim pada tanggal `today`. */
export function isDue(nextAt: string, today: string): boolean {
  return toDay(nextAt) <= toDay(today);
}

/**
 * Majukan `nextAt` sampai melewati `today`. Dipakai kalau jadwalnya sempat
 * terlewat beberapa periode — hasilnya satu tanggal di depan, bukan tumpukan
 * pengingat yang menunggak.
 */
export function advancePast(
  nextAt: string,
  frequency: ReminderFrequency,
  today: string
): string {
  let hasil = nextAt;
  // Batas putaran menjaga dari kemungkinan tanggal yang tidak pernah maju.
  for (let i = 0; i < 500 && isDue(hasil, today); i++) {
    hasil = nextOccurrence(hasil, frequency);
  }
  return hasil;
}

export type ScheduleDraft = {
  frequency: string;
  startDate: string;
};

export type ScheduleField = keyof ScheduleDraft;
export type ScheduleErrors = Partial<Record<ScheduleField, string>>;

export function emptyScheduleDraft(today: string): ScheduleDraft {
  return { frequency: "mingguan", startDate: today };
}

/** `today` jadi argumen supaya hasilnya bisa diuji tanpa bergantung jam sistem. */
export function validateSchedule(draft: ScheduleDraft, today: string): ScheduleErrors {
  const errors: ScheduleErrors = {};

  if (!(REMINDER_FREQUENCIES as string[]).includes(draft.frequency)) {
    errors.frequency = "Frekuensi tidak dikenal.";
  }

  if (draft.startDate === "") errors.startDate = "Tanggal mulai wajib diisi.";
  else if (!tanggalNyata(draft.startDate)) errors.startDate = "Tanggal mulai tidak valid.";
  else if (toDay(draft.startDate) < toDay(today)) {
    errors.startDate = "Tanggal mulai tidak boleh di masa lalu.";
  }

  return errors;
}

/** Kalimat pengingat otomatis. Dipisah supaya isinya bisa diuji dan diseragamkan. */
export function autoReminderMessage(projectName: string, frequency: ReminderFrequency): string {
  return `Pengingat ${FREQUENCY_LABELS[frequency].toLowerCase()}: mohon perbarui progres "${projectName}".`;
}
