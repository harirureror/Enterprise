import { tanggalNyata } from "./project-form";
import { PROJECT_STATUSES, type ActivityTemplate, type ProjectActivity } from "./types";

/* Validasi isian aktivitas. Fungsi murni, dipakai form di browser dan server
   action — supaya aturannya tidak bercabang antara keduanya. */

export type ActivityDraft = {
  name: string;
  /** Persen sumbangan ke progres. String karena input HTML memang begitu. */
  weight: string;
  status: string;
  /** "" berarti tidak ada tenggat tindak lanjut. */
  slaDays: string;
  /** Awal rentang kerja. Bersama targetDate menentukan sebaran bobot di kurva S. */
  startDate: string;
  targetDate: string;
  /** Hanya untuk template: perkiraan lama pengerjaan dalam hari. */
  durationDays: string;
};

export type ActivityField = keyof ActivityDraft;
export type ActivityErrors = Partial<Record<ActivityField, string>>;

export const NAME_MIN = 3;
export const NAME_MAX = 120;
/** Sehari terlalu pendek untuk jadi tenggat tindak lanjut yang berarti. */
export const SLA_MAX = 365;
/** Lebih dari ini bukan satu aktivitas lagi, melainkan satu proyek sendiri. */
export const DURASI_MAX = 365;

export function emptyActivityDraft(): ActivityDraft {
  return {
    name: "",
    weight: "10",
    status: "Berjalan",
    slaDays: "",
    startDate: "",
    targetDate: "",
    durationDays: "",
  };
}

export function activityToDraft(a: ProjectActivity): ActivityDraft {
  return {
    name: a.name,
    weight: String(a.weight),
    status: a.status,
    slaDays: a.slaDays === null ? "" : String(a.slaDays),
    startDate: a.startDate ?? "",
    targetDate: a.targetDate ?? "",
    durationDays: "",
  };
}

export function templateToDraft(t: ActivityTemplate): ActivityDraft {
  return {
    name: t.name,
    weight: String(t.weight),
    status: t.status,
    slaDays: t.slaDays === null ? "" : String(t.slaDays),
    startDate: "",
    targetDate: "",
    durationDays: t.durationDays === null ? "" : String(t.durationDays),
  };
}

/**
 * `template: true` untuk isian template per jenis, yang tidak punya tanggal
 * target — tanggal itu milik proyek, bukan milik cetakannya.
 */
export function validateActivity(
  draft: ActivityDraft,
  options: { template?: boolean } = {}
): ActivityErrors {
  const errors: ActivityErrors = {};

  const name = draft.name.trim();
  if (name === "") errors.name = "Nama aktivitas wajib diisi.";
  else if (name.length < NAME_MIN) errors.name = `Nama minimal ${NAME_MIN} karakter.`;
  else if (name.length > NAME_MAX) errors.name = `Nama maksimal ${NAME_MAX} karakter.`;

  const weight = Number(draft.weight);
  if (draft.weight.trim() === "") errors.weight = "Bobot wajib diisi.";
  else if (!Number.isInteger(weight)) errors.weight = "Bobot harus bilangan bulat.";
  else if (weight < 0 || weight > 100) errors.weight = "Bobot antara 0 dan 100.";

  if (!(PROJECT_STATUSES as string[]).includes(draft.status)) {
    errors.status = "Status tidak dikenal.";
  }

  const sla = draft.slaDays.trim();
  if (sla !== "") {
    const hari = Number(sla);
    if (!Number.isInteger(hari)) errors.slaDays = "Tenggat harus bilangan bulat hari.";
    else if (hari < 1) errors.slaDays = "Tenggat minimal 1 hari.";
    else if (hari > SLA_MAX) errors.slaDays = `Tenggat maksimal ${SLA_MAX} hari.`;
  }

  if (options.template) {
    // Lama pengerjaan hanya berarti di template; di proyek yang berlaku
    // tanggalnya, dan dua sumber untuk hal yang sama pasti berselisih.
    const durasi = draft.durationDays.trim();
    if (durasi !== "") {
      const hari = Number(durasi);
      if (!Number.isInteger(hari)) errors.durationDays = "Lama harus bilangan bulat hari.";
      else if (hari < 1) errors.durationDays = "Lama minimal 1 hari.";
      else if (hari > DURASI_MAX) errors.durationDays = `Lama maksimal ${DURASI_MAX} hari.`;
    }
  } else {
    if (draft.startDate !== "" && !tanggalNyata(draft.startDate)) {
      errors.startDate = "Tanggal mulai tidak valid.";
    }
    if (draft.targetDate !== "" && !tanggalNyata(draft.targetDate)) {
      errors.targetDate = "Tanggal target tidak valid.";
    }
    // Rentang terbalik akan menyebar bobot mundur di kurva S; ditolak di sini
    // supaya grafiknya tidak perlu membetulkan data yang salah.
    if (
      errors.startDate === undefined &&
      errors.targetDate === undefined &&
      draft.startDate !== "" &&
      draft.targetDate !== "" &&
      draft.startDate > draft.targetDate
    ) {
      errors.targetDate = "Tanggal target tidak boleh sebelum tanggal mulai.";
    }
  }

  return errors;
}

export function draftToActivity(
  draft: ActivityDraft
): Omit<ProjectActivity, "id" | "projectId" | "sortOrder" | "doneDate" | "doneBy"> & {
  doneDate: null;
  doneBy: null;
} {
  return {
    name: draft.name.trim(),
    weight: Number(draft.weight),
    status: draft.status as ProjectActivity["status"],
    slaDays: draft.slaDays.trim() === "" ? null : Number(draft.slaDays),
    startDate: draft.startDate === "" ? null : draft.startDate,
    targetDate: draft.targetDate === "" ? null : draft.targetDate,
    // Aktivitas baru selalu belum selesai; mencentang punya jalurnya sendiri.
    doneDate: null,
    doneBy: null,
  };
}

/** Bagian template dari sebuah draft; tanggal sengaja tidak ikut. */
export function draftToTemplate(
  draft: ActivityDraft
): Omit<ActivityTemplate, "id" | "typeCode" | "sortOrder"> {
  return {
    name: draft.name.trim(),
    weight: Number(draft.weight),
    status: draft.status as ActivityTemplate["status"],
    slaDays: draft.slaDays.trim() === "" ? null : Number(draft.slaDays),
    durationDays: draft.durationDays.trim() === "" ? null : Number(draft.durationDays),
  };
}
