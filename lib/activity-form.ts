import { tanggalNyata } from "./project-form";
import { PROJECT_STATUSES, type ProjectActivity } from "./types";

/* Validasi isian aktivitas. Fungsi murni, dipakai form di browser dan server
   action — supaya aturannya tidak bercabang antara keduanya. */

export type ActivityDraft = {
  name: string;
  /** Persen sumbangan ke progres. String karena input HTML memang begitu. */
  weight: string;
  status: string;
  /** "" berarti tidak ada tenggat tindak lanjut. */
  slaDays: string;
  targetDate: string;
};

export type ActivityField = keyof ActivityDraft;
export type ActivityErrors = Partial<Record<ActivityField, string>>;

export const NAME_MIN = 3;
export const NAME_MAX = 120;
/** Sehari terlalu pendek untuk jadi tenggat tindak lanjut yang berarti. */
export const SLA_MAX = 365;

export function emptyActivityDraft(): ActivityDraft {
  return { name: "", weight: "10", status: "Berjalan", slaDays: "", targetDate: "" };
}

export function activityToDraft(a: ProjectActivity): ActivityDraft {
  return {
    name: a.name,
    weight: String(a.weight),
    status: a.status,
    slaDays: a.slaDays === null ? "" : String(a.slaDays),
    targetDate: a.targetDate ?? "",
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

  if (!options.template && draft.targetDate !== "" && !tanggalNyata(draft.targetDate)) {
    errors.targetDate = "Tanggal target tidak valid.";
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
    targetDate: draft.targetDate === "" ? null : draft.targetDate,
    // Aktivitas baru selalu belum selesai; mencentang punya jalurnya sendiri.
    doneDate: null,
    doneBy: null,
  };
}
