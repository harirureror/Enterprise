"use server";

import { revalidatePath } from "next/cache";
import {
  applyTemplateToProject,
  createActivityTemplate,
  createProjectActivity,
  deleteActivityTemplate,
  deleteProjectActivity,
  getProject,
  getProjectActivity,
  setActivityDone,
  setProgressMode,
  updateActivityTemplate,
  updateProjectActivity,
} from "@/lib/api";
import { getSessionUser, tolakKalauTakBoleh } from "@/lib/auth";
import { canEditProject } from "@/lib/permissions";
import {
  type ActivityDraft,
  type ActivityErrors,
  draftToActivity,
  validateActivity,
} from "@/lib/activity-form";

/* Checklist aktivitas.

   Penjaganya canEditProject(), bukan sekadar "punya kemampuan mengubah":
   Anggota boleh mengubah proyeknya sendiri, bukan proyek rekannya. Memeriksa
   kemampuannya saja akan membuat Anggota bisa mencentang aktivitas milik
   siapa pun — dan karena centang menggerakkan progres DAN status, itu berarti
   ia bisa mengubah tahap pipeline proyek orang lain. */

export type AktivitasHasil =
  | { ok: true }
  | { ok: false; error: string; errors: ActivityErrors };

const TIDAK_BOLEH = "Akses Anda tidak mencakup pengubahan proyek ini.";

function segarkan(projectId: number): void {
  revalidatePath("/proyek");
  revalidatePath(`/proyek/${projectId}`);
  // Progres dan status ikut berubah, jadi overview dan timeline ikut basi.
  revalidatePath("/", "layout");
}

/** `null` kalau boleh; selain itu balasan penolakan yang sudah jadi. */
async function jagaProyek(projectId: number): Promise<AktivitasHasil | null> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk mengubah aktivitas.", errors: {} };

  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Proyek tidak ditemukan.", errors: {} };

  return canEditProject(pengguna, project) ? null : { ok: false, error: TIDAK_BOLEH, errors: {} };
}

export async function centangAktivitas(id: number, selesai: boolean): Promise<AktivitasHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk mengubah aktivitas.", errors: {} };

  const aktivitas = await getProjectActivity(id);
  if (!aktivitas) return { ok: false, error: "Aktivitas tidak ditemukan.", errors: {} };

  const ditolak = await jagaProyek(aktivitas.projectId);
  if (ditolak) return ditolak;

  const hasil = await setActivityDone(id, selesai, pengguna.id);
  if (!hasil.ok) return { ok: false, error: hasil.error, errors: {} };

  segarkan(aktivitas.projectId);
  return { ok: true };
}

export async function simpanAktivitas(
  projectId: number,
  draft: ActivityDraft
): Promise<AktivitasHasil> {
  const ditolak = await jagaProyek(projectId);
  if (ditolak) return ditolak;

  const errors = validateActivity(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const dibuat = await createProjectActivity(projectId, draftToActivity(draft));
  if (dibuat === null) return { ok: false, error: "Proyek tidak ditemukan.", errors: {} };

  segarkan(projectId);
  return { ok: true };
}

export async function perbaruiAktivitas(
  id: number,
  draft: ActivityDraft
): Promise<AktivitasHasil> {
  const lama = await getProjectActivity(id);
  if (!lama) return { ok: false, error: "Aktivitas tidak ditemukan.", errors: {} };

  const ditolak = await jagaProyek(lama.projectId);
  if (ditolak) return ditolak;

  const errors = validateActivity(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  // doneDate, doneBy, dan sortOrder dipertahankan: mencentang dan mengurutkan
  // punya jalurnya sendiri, dan formulir ini tidak boleh menghapusnya.
  const hasil = await updateProjectActivity(id, {
    ...draftToActivity(draft),
    doneDate: lama.doneDate,
    doneBy: lama.doneBy,
    sortOrder: lama.sortOrder,
  });
  if (hasil === null) return { ok: false, error: "Aktivitas tidak ditemukan.", errors: {} };

  segarkan(lama.projectId);
  return { ok: true };
}

export async function hapusAktivitas(id: number): Promise<AktivitasHasil> {
  const lama = await getProjectActivity(id);
  if (!lama) return { ok: false, error: "Aktivitas tidak ditemukan.", errors: {} };

  const ditolak = await jagaProyek(lama.projectId);
  if (ditolak) return ditolak;

  await deleteProjectActivity(id);
  segarkan(lama.projectId);
  return { ok: true };
}

/** Bekali proyek dengan salinan template jenisnya. */
export async function pakaiTemplateAktivitas(projectId: number): Promise<AktivitasHasil> {
  const ditolak = await jagaProyek(projectId);
  if (ditolak) return ditolak;

  const hasil = await applyTemplateToProject(projectId);
  if (!hasil.ok) return { ok: false, error: hasil.error, errors: {} };

  segarkan(projectId);
  return { ok: true };
}

export async function ubahModeProgres(projectId: number, mode: string): Promise<AktivitasHasil> {
  const ditolak = await jagaProyek(projectId);
  if (ditolak) return ditolak;

  if (mode !== "auto" && mode !== "manual") {
    return { ok: false, error: "Mode progres tidak dikenal.", errors: {} };
  }

  const hasil = await setProgressMode(projectId, mode);
  if (hasil === null) return { ok: false, error: "Proyek tidak ditemukan.", errors: {} };

  segarkan(projectId);
  return { ok: true };
}

/* --- Template per jenis proyek ----------------------------------------------

   Dijaga "kelola-jenis", bukan "ubah-proyek-sendiri": template berlaku untuk
   seluruh proyek berjenis itu, jadi mengubahnya bukan urusan satu pemilik. */

export async function simpanTemplateAktivitas(
  typeCode: string,
  draft: ActivityDraft
): Promise<AktivitasHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-jenis");
  if (ditolak) return ditolak;

  const errors = validateActivity(draft, { template: true });
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const { name, weight, status, slaDays } = draftToActivity(draft);
  await createActivityTemplate(typeCode, { name, weight, status, slaDays });

  revalidatePath("/proyek/jenis");
  return { ok: true };
}

export async function perbaruiTemplateAktivitas(
  id: number,
  draft: ActivityDraft,
  sortOrder: number
): Promise<AktivitasHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-jenis");
  if (ditolak) return ditolak;

  const errors = validateActivity(draft, { template: true });
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", errors };
  }

  const { name, weight, status, slaDays } = draftToActivity(draft);
  const hasil = await updateActivityTemplate(id, { name, weight, status, slaDays, sortOrder });
  if (hasil === null) return { ok: false, error: "Template tidak ditemukan.", errors: {} };

  revalidatePath("/proyek/jenis");
  return { ok: true };
}

export async function hapusTemplateAktivitas(id: number): Promise<AktivitasHasil> {
  const ditolak = await tolakKalauTakBoleh("kelola-jenis");
  if (ditolak) return ditolak;

  if (!(await deleteActivityTemplate(id))) {
    return { ok: false, error: "Template tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  revalidatePath("/proyek/jenis");
  return { ok: true };
}
