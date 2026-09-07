"use server";

import { revalidatePath } from "next/cache";
import {
  createPlan,
  createPlanComment,
  createPlanProspect,
  createPlanStep,
  deletePlan,
  deletePlanProspect,
  deletePlanStep,
  getPlan,
  getPlanProspect,
  getPlanStep,
  getUsers,
  setPlanProjects,
  setPlanStepStatus,
  updatePlan,
  updatePlanProspect,
  updatePlanStep,
} from "@/lib/api";
import { getSessionUser, tolakKalauTakBoleh } from "@/lib/auth";
import { type CommentDraft, type CommentErrors, validateComment } from "@/lib/comment-form";
import {
  type PlanDraft,
  type PlanErrors,
  type ProspectDraft,
  type ProspectErrors,
  type StepDraft,
  type StepErrors,
  draftToPlan,
  draftToProspect,
  draftToStep,
  validatePlan,
  validateProspect,
  validateStep,
} from "@/lib/plan-form";
import { STEP_STATUSES, type StepStatus } from "@/lib/types";

/* Rencana strategis.

   Setiap penulis data memeriksa izinnya sendiri lewat tolakKalauTakBoleh().
   Tombolnya memang tidak dirender untuk peran yang tidak berhak, tapi tombol
   yang tidak terlihat bukan kontrol keamanan — server action bisa dipanggil
   langsung. Yang benar-benar menahan ada di sini. */

export type PlanHasil = { ok: true } | { ok: false; error: string; errors: PlanErrors };
export type StepHasil = { ok: true } | { ok: false; error: string; errors: StepErrors };
export type ProspectHasil = { ok: true } | { ok: false; error: string; errors: ProspectErrors };
export type PlanKomentarHasil =
  | { ok: true }
  | { ok: false; error: string; errors: CommentErrors };

function segarkan(id?: number): void {
  revalidatePath("/rencana");
  if (id !== undefined) revalidatePath(`/rencana/${id}`);
}

/* --- Rencana ---------------------------------------------------------------- */

export async function simpanRencana(draft: PlanDraft): Promise<PlanHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk menyusun rencana.", errors: {} };

  const users = await getUsers();
  const errors = validatePlan(draft, users.map((u) => u.id));
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  await createPlan(draftToPlan(draft, pengguna.id));
  segarkan();
  return { ok: true };
}

export async function perbaruiRencana(id: number, draft: PlanDraft): Promise<PlanHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const lama = await getPlan(id);
  if (!lama) return { ok: false, error: "Rencana tidak ditemukan.", errors: {} };

  const users = await getUsers();
  const errors = validatePlan(draft, users.map((u) => u.id));
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  // createdBy dipertahankan store: itu jejak siapa yang pertama menyusun.
  const { createdBy: _abaikan, ...tanpaPembuat } = draftToPlan(draft, lama.createdBy);
  void _abaikan;

  const hasil = await updatePlan(id, tanpaPembuat);
  if (hasil === null) return { ok: false, error: "Rencana tidak ditemukan.", errors: {} };

  segarkan(id);
  return { ok: true };
}

export async function hapusRencana(id: number): Promise<PlanHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  // Langkah, prospek, kaitan proyek, dan komentarnya ikut terhapus lewat
  // ON DELETE CASCADE — tidak ada baris menggantung yang tertinggal.
  if (!(await deletePlan(id))) {
    return { ok: false, error: "Rencana tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  segarkan();
  return { ok: true };
}

/* --- Langkah ---------------------------------------------------------------- */

export async function simpanLangkah(planId: number, draft: StepDraft): Promise<StepHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const users = await getUsers();
  const errors = validateStep(draft, users.map((u) => u.id));
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  // sortOrder ditentukan server, bukan dikirim klien.
  const { sortOrder: _abaikan, planId: _abaikanPlan, ...isi } = draftToStep(draft, planId, 0);
  void _abaikan;
  void _abaikanPlan;

  const hasil = await createPlanStep(planId, isi);
  if (hasil === null) return { ok: false, error: "Rencana tidak ditemukan.", errors: {} };

  segarkan(planId);
  return { ok: true };
}

export async function perbaruiLangkah(id: number, draft: StepDraft): Promise<StepHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const lama = await getPlanStep(id);
  if (!lama) return { ok: false, error: "Langkah tidak ditemukan.", errors: {} };

  const users = await getUsers();
  const errors = validateStep(draft, users.map((u) => u.id));
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  // Urutan dipertahankan: mengubah isi langkah bukan berarti memindahkannya.
  const { planId: _abaikan, ...isi } = draftToStep(draft, lama.planId, lama.sortOrder);
  void _abaikan;

  await updatePlanStep(id, isi);
  segarkan(lama.planId);
  return { ok: true };
}

/** Jalur tersering: mencentang langkah selesai. */
export async function ubahStatusLangkah(id: number, status: string): Promise<StepHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  // Nilai datang dari klien, jadi tetap dicocokkan ke daftar yang sah.
  if (!(STEP_STATUSES as string[]).includes(status)) {
    return { ok: false, error: "Status langkah tidak dikenal.", errors: {} };
  }

  const lama = await getPlanStep(id);
  if (!lama) return { ok: false, error: "Langkah tidak ditemukan.", errors: {} };

  await setPlanStepStatus(id, status as StepStatus);
  segarkan(lama.planId);
  return { ok: true };
}

export async function hapusLangkah(id: number): Promise<StepHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const lama = await getPlanStep(id);
  if (!lama) return { ok: false, error: "Langkah tidak ditemukan atau sudah dihapus.", errors: {} };

  await deletePlanStep(id);
  segarkan(lama.planId);
  return { ok: true };
}

/* --- Prospek ---------------------------------------------------------------- */

export async function simpanProspek(
  planId: number,
  draft: ProspectDraft
): Promise<ProspectHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const errors = validateProspect(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const hasil = await createPlanProspect(draftToProspect(draft, planId));
  if (hasil === null) return { ok: false, error: "Rencana tidak ditemukan.", errors: {} };

  segarkan(planId);
  return { ok: true };
}

export async function perbaruiProspek(id: number, draft: ProspectDraft): Promise<ProspectHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const lama = await getPlanProspect(id);
  if (!lama) return { ok: false, error: "Calon klien tidak ditemukan.", errors: {} };

  const errors = validateProspect(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const { planId: _abaikan, ...isi } = draftToProspect(draft, lama.planId);
  void _abaikan;

  await updatePlanProspect(id, isi);
  segarkan(lama.planId);
  return { ok: true };
}

export async function hapusProspek(id: number): Promise<ProspectHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  const lama = await getPlanProspect(id);
  if (!lama) {
    return { ok: false, error: "Calon klien tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  await deletePlanProspect(id);
  segarkan(lama.planId);
  return { ok: true };
}

/* --- Kaitan proyek dan komentar --------------------------------------------- */

export async function aturProyekRencana(
  planId: number,
  projectIds: number[]
): Promise<PlanHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-rencana");
  if (ditolak) return ditolak;

  // Id datang dari klien: apa pun yang bukan bilangan bulat dibuang di sini.
  const bersih = projectIds.filter((n) => Number.isInteger(n));

  const hasil = await setPlanProjects(planId, bersih);
  if (!hasil.ok) return { ok: false, error: hasil.error, errors: {} };

  segarkan(planId);
  return { ok: true };
}

/**
 * Komentar memakai kemampuan `kolaborasi`, bukan `kelola-rencana` — Owner bisa
 * menanggapi arah divisi tanpa bisa mengubahnya, sama seperti di halaman
 * detail proyek.
 */
export async function kirimKomentarRencana(
  planId: number,
  draft: CommentDraft
): Promise<PlanKomentarHasil> {
  const ditolak = await tolakKalauTakBoleh("kolaborasi");
  if (ditolak) return ditolak;

  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk berkomentar.", errors: {} };

  const errors = validateComment(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Komentar belum valid.", errors };
  }

  const hasil = await createPlanComment({
    planId,
    // Dari sesi, bukan dari body.
    userId: pengguna.id,
    body: draft.body.trim(),
  });
  if (hasil === null) return { ok: false, error: "Rencana tidak ditemukan.", errors: {} };

  segarkan(planId);
  return { ok: true };
}
