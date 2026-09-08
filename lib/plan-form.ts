import { tanggalNyata } from "./project-form";
import {
  PLAN_GOALS,
  PLAN_OUTPUT_KINDS,
  PLAN_KINDS,
  PLAN_SEGMENTS,
  PLAN_STATUSES,
  PROJECT_PRIORITIES,
  PROSPECT_STATUSES,
  STEP_STATUSES,
  type PlanOutput,
  type PlanProspect,
  type PlanStep,
  type StrategicPlan,
} from "./types";

/* Validasi form rencana strategis, langkah, dan prospek.

   Fungsi murni dan bebas React supaya aturan yang sama dipakai form di browser
   dan server action — pesan kesalahannya pun sama. Pola dan batasannya
   mengikuti lib/agenda-form.ts dan lib/project-form.ts. */

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const SUMMARY_MAX = 1000;
export const OUTCOME_MAX = 300;
export const PARTNER_MAX = 120;
export const REGION_MAX = 60;
export const NOTE_MAX = 300;
export const PROSPECT_NAME_MAX = 120;
export const CONTACT_MAX = 120;

/* --- Rencana ---------------------------------------------------------------- */

export type PlanDraft = {
  title: string;
  summary: string;
  kind: string;
  goal: string;
  segment: string;
  region: string;
  partner: string;
  status: string;
  priority: string;
  ownerId: string;
  startDate: string;
  targetDate: string;
  outcome: string;
};

export type PlanField = keyof PlanDraft;
export type PlanErrors = Partial<Record<PlanField, string>>;

export function emptyPlanDraft(ownerId: number): PlanDraft {
  return {
    title: "",
    summary: "",
    kind: "Pelatihan",
    goal: "Penetrasi Pasar",
    segment: "Tambang",
    region: "",
    partner: "",
    // Sebuah rencana selalu lahir sebagai ide; menaikkannya harus jadi
    // tindakan sadar, bukan akibat lupa mengubah pilihan.
    status: "Ide",
    priority: "Sedang",
    ownerId: String(ownerId),
    startDate: "",
    targetDate: "",
    outcome: "",
  };
}

export function planToDraft(plan: StrategicPlan): PlanDraft {
  return {
    title: plan.title,
    summary: plan.summary,
    kind: plan.kind,
    goal: plan.goal,
    segment: plan.segment,
    region: plan.region,
    partner: plan.partner,
    status: plan.status,
    priority: plan.priority,
    ownerId: String(plan.ownerId),
    // null jadi input kosong, bukan tulisan "null".
    startDate: plan.startDate ?? "",
    targetDate: plan.targetDate ?? "",
    outcome: plan.outcome,
  };
}

export function validatePlan(draft: PlanDraft, ownerIds: number[]): PlanErrors {
  const errors: PlanErrors = {};

  const title = draft.title.trim();
  if (title === "") errors.title = "Judul rencana wajib diisi.";
  else if (title.length < TITLE_MIN) errors.title = `Judul minimal ${TITLE_MIN} karakter.`;
  else if (title.length > TITLE_MAX) errors.title = `Judul maksimal ${TITLE_MAX} karakter.`;

  if (draft.summary.trim().length > SUMMARY_MAX) {
    errors.summary = `Uraian maksimal ${SUMMARY_MAX} karakter.`;
  }
  if (draft.outcome.trim().length > OUTCOME_MAX) {
    errors.outcome = `Ukuran keberhasilan maksimal ${OUTCOME_MAX} karakter.`;
  }
  if (draft.partner.trim().length > PARTNER_MAX) {
    errors.partner = `Mitra maksimal ${PARTNER_MAX} karakter.`;
  }
  if (draft.region.trim().length > REGION_MAX) {
    errors.region = `Wilayah maksimal ${REGION_MAX} karakter.`;
  }

  if (!(PLAN_KINDS as string[]).includes(draft.kind)) errors.kind = "Jenis rencana tidak dikenal.";
  if (!(PLAN_GOALS as string[]).includes(draft.goal)) errors.goal = "Tujuan strategis tidak dikenal.";
  if (!(PLAN_SEGMENTS as string[]).includes(draft.segment)) {
    errors.segment = "Segmen pasar tidak dikenal.";
  }
  if (!(PLAN_STATUSES as string[]).includes(draft.status)) errors.status = "Status tidak dikenal.";
  if (!(PROJECT_PRIORITIES as string[]).includes(draft.priority)) {
    errors.priority = "Prioritas tidak dikenal.";
  }

  const owner = Number(draft.ownerId);
  if (draft.ownerId.trim() === "") errors.ownerId = "Penanggung jawab wajib dipilih.";
  else if (!ownerIds.includes(owner)) errors.ownerId = "Penanggung jawab tidak terdaftar.";

  /* Tanggal seluruhnya opsional: sebuah ide belum tentu sudah berjadwal, dan
     memaksanya diisi hanya akan membuat orang mengarang tanggal. */
  if (draft.startDate !== "" && !tanggalNyata(draft.startDate)) {
    errors.startDate = "Tanggal mulai tidak valid.";
  }
  if (draft.targetDate !== "" && !tanggalNyata(draft.targetDate)) {
    errors.targetDate = "Tanggal target tidak valid.";
  } else if (
    !errors.startDate &&
    draft.startDate !== "" &&
    draft.targetDate !== "" &&
    draft.targetDate < draft.startDate
  ) {
    // Aturan yang sama dijaga CHECK di skema.
    errors.targetDate = "Tanggal target tidak boleh mendahului tanggal mulai.";
  }

  return errors;
}

export function draftToPlan(
  draft: PlanDraft,
  createdBy: number
): Omit<StrategicPlan, "id"> {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    kind: draft.kind as StrategicPlan["kind"],
    goal: draft.goal as StrategicPlan["goal"],
    segment: draft.segment as StrategicPlan["segment"],
    region: draft.region.trim(),
    partner: draft.partner.trim(),
    status: draft.status as StrategicPlan["status"],
    priority: draft.priority as StrategicPlan["priority"],
    ownerId: Number(draft.ownerId),
    startDate: draft.startDate === "" ? null : draft.startDate,
    targetDate: draft.targetDate === "" ? null : draft.targetDate,
    outcome: draft.outcome.trim(),
    createdBy,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

/* --- Langkah ---------------------------------------------------------------- */

export type StepDraft = {
  title: string;
  ownerId: string;
  targetDate: string;
  status: string;
  note: string;
};

export type StepField = keyof StepDraft;
export type StepErrors = Partial<Record<StepField, string>>;

export function emptyStepDraft(): StepDraft {
  return { title: "", ownerId: "", targetDate: "", status: "Belum", note: "" };
}

export function stepToDraft(step: PlanStep): StepDraft {
  return {
    title: step.title,
    ownerId: step.ownerId === null ? "" : String(step.ownerId),
    targetDate: step.targetDate ?? "",
    status: step.status,
    note: step.note,
  };
}

export function validateStep(draft: StepDraft, ownerIds: number[]): StepErrors {
  const errors: StepErrors = {};

  const title = draft.title.trim();
  if (title === "") errors.title = "Judul langkah wajib diisi.";
  else if (title.length < TITLE_MIN) errors.title = `Judul minimal ${TITLE_MIN} karakter.`;
  else if (title.length > TITLE_MAX) errors.title = `Judul maksimal ${TITLE_MAX} karakter.`;

  // Penanggung jawab opsional: langkah boleh disusun sebelum ada yang ditugaskan.
  if (draft.ownerId.trim() !== "" && !ownerIds.includes(Number(draft.ownerId))) {
    errors.ownerId = "Penanggung jawab tidak terdaftar.";
  }

  if (!(STEP_STATUSES as string[]).includes(draft.status)) {
    errors.status = "Status langkah tidak dikenal.";
  }

  if (draft.targetDate !== "" && !tanggalNyata(draft.targetDate)) {
    errors.targetDate = "Tanggal target tidak valid.";
  }
  if (draft.note.trim().length > NOTE_MAX) {
    errors.note = `Catatan maksimal ${NOTE_MAX} karakter.`;
  }

  return errors;
}

export function draftToStep(
  draft: StepDraft,
  planId: number,
  sortOrder: number
): Omit<PlanStep, "id"> {
  return {
    planId,
    title: draft.title.trim(),
    ownerId: draft.ownerId.trim() === "" ? null : Number(draft.ownerId),
    targetDate: draft.targetDate === "" ? null : draft.targetDate,
    status: draft.status as PlanStep["status"],
    note: draft.note.trim(),
    sortOrder,
  };
}

/* --- Prospek ---------------------------------------------------------------- */

export type ProspectDraft = {
  name: string;
  contact: string;
  region: string;
  status: string;
  note: string;
};

export type ProspectField = keyof ProspectDraft;
export type ProspectErrors = Partial<Record<ProspectField, string>>;

export function emptyProspectDraft(): ProspectDraft {
  return { name: "", contact: "", region: "", status: "Belum dihubungi", note: "" };
}

export function prospectToDraft(p: PlanProspect): ProspectDraft {
  return {
    name: p.name,
    contact: p.contact,
    region: p.region,
    status: p.status,
    note: p.note,
  };
}

export function validateProspect(draft: ProspectDraft): ProspectErrors {
  const errors: ProspectErrors = {};

  const name = draft.name.trim();
  if (name === "") errors.name = "Nama calon klien wajib diisi.";
  else if (name.length > PROSPECT_NAME_MAX) {
    errors.name = `Nama maksimal ${PROSPECT_NAME_MAX} karakter.`;
  }

  if (!(PROSPECT_STATUSES as string[]).includes(draft.status)) {
    errors.status = "Status pendekatan tidak dikenal.";
  }
  if (draft.contact.trim().length > CONTACT_MAX) {
    errors.contact = `Kontak maksimal ${CONTACT_MAX} karakter.`;
  }
  if (draft.region.trim().length > REGION_MAX) {
    errors.region = `Wilayah maksimal ${REGION_MAX} karakter.`;
  }
  if (draft.note.trim().length > NOTE_MAX) {
    errors.note = `Catatan maksimal ${NOTE_MAX} karakter.`;
  }

  return errors;
}

export function draftToProspect(
  draft: ProspectDraft,
  planId: number
): Omit<PlanProspect, "id"> {
  return {
    planId,
    name: draft.name.trim(),
    contact: draft.contact.trim(),
    region: draft.region.trim(),
    status: draft.status as PlanProspect["status"],
    note: draft.note.trim(),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

/* --- Luaran ------------------------------------------------------------------

   Apa yang dihasilkan sebuah rencana. Proyek salah satu jenisnya, bukan
   kategori tersendiri — riset juga melahirkan jurnal, dan pelatihan
   melahirkan portofolio. */

export type OutputDraft = {
  kind: string;
  title: string;
  /** "" berarti tidak ditautkan ke proyek mana pun. */
  projectId: string;
  url: string;
  achievedAt: string;
  note: string;
};

export type OutputField = keyof OutputDraft;
export type OutputErrors = Partial<Record<OutputField, string>>;

export const OUTPUT_TITLE_MAX = 160;
export const URL_MAX = 500;

export function emptyOutputDraft(): OutputDraft {
  return { kind: "Jurnal", title: "", projectId: "", url: "", achievedAt: "", note: "" };
}

export function outputToDraft(o: PlanOutput): OutputDraft {
  return {
    kind: o.kind,
    title: o.title,
    projectId: o.projectId === null ? "" : String(o.projectId),
    url: o.url,
    achievedAt: o.achievedAt ?? "",
    note: o.note,
  };
}

export function validateOutput(draft: OutputDraft): OutputErrors {
  const errors: OutputErrors = {};

  if (!(PLAN_OUTPUT_KINDS as string[]).includes(draft.kind)) {
    errors.kind = "Jenis luaran tidak dikenal.";
  }

  const title = draft.title.trim();
  if (title === "") errors.title = "Judul luaran wajib diisi.";
  else if (title.length > OUTPUT_TITLE_MAX) {
    errors.title = `Judul maksimal ${OUTPUT_TITLE_MAX} karakter.`;
  }

  // Proyek hanya bermakna untuk "Proyek Turunan"; menempelkannya di jenis lain
  // membuat daftar luaran menyesatkan. Aturan yang sama dijaga lib/api.ts.
  if (draft.projectId.trim() !== "" && draft.kind !== "Proyek Turunan") {
    errors.projectId = 'Hanya "Proyek Turunan" yang bisa ditautkan ke proyek.';
  }

  const url = draft.url.trim();
  if (url !== "") {
    if (url.length > URL_MAX) errors.url = `Tautan maksimal ${URL_MAX} karakter.`;
    else {
      let parsed: URL | null = null;
      try {
        parsed = new URL(url);
      } catch {
        parsed = null;
      }
      // Skema lain (javascript:, data:) tidak pantas jadi tautan yang diklik
      // orang lain — alasan yang sama dengan URL foto di lib/profile-form.ts.
      if (!parsed) errors.url = "Tautan tidak valid.";
      else if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.url = "Tautan harus diawali http:// atau https://";
      }
    }
  }

  if (draft.achievedAt !== "" && !tanggalNyata(draft.achievedAt)) {
    errors.achievedAt = "Tanggal tidak valid.";
  }

  if (draft.note.trim().length > NOTE_MAX) {
    errors.note = `Catatan maksimal ${NOTE_MAX} karakter.`;
  }

  return errors;
}

export function draftToOutput(draft: OutputDraft): Omit<PlanOutput, "id" | "planId" | "sortOrder"> {
  return {
    kind: draft.kind as PlanOutput["kind"],
    title: draft.title.trim(),
    projectId: draft.projectId.trim() === "" ? null : Number(draft.projectId),
    url: draft.url.trim(),
    achievedAt: draft.achievedAt === "" ? null : draft.achievedAt,
    note: draft.note.trim(),
  };
}
