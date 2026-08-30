"use server";

import { revalidatePath } from "next/cache";
import {
  addProgress,
  createComment,
  createProject,
  createReminder,
  deleteProject,
  getProject,
  getUsers,
  saveSchedule,
  setDependencies,
  setScheduleActive,
  updateProject,
  updateProjectStatus,
} from "@/lib/api";
import {
  type ProgressDraft,
  type ProgressErrors,
  validateProgress,
} from "@/lib/progress-form";
import {
  type CommentDraft,
  type CommentErrors,
  validateComment,
} from "@/lib/comment-form";
import {
  type ReminderFrequency,
  type ScheduleDraft,
  type ScheduleErrors,
  validateSchedule,
} from "@/lib/reminder-schedule";
import {
  type ReminderDraft,
  type ReminderErrors,
  validateReminder,
} from "@/lib/reminder-form";
import { getSessionUser } from "@/lib/auth";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/types";
import {
  type DraftErrors,
  type ProjectDraft,
  draftToProject,
  validateDraft,
} from "@/lib/project-form";

/**
 * Simpan proyek dari form. Sengaja lewat server action, bukan fetch ke
 * /api/projects: route handler dan halaman punya salinan modul sendiri-sendiri,
 * jadi proyek yang ditulis lewat HTTP tidak akan terlihat di daftar selama
 * datanya masih array in-memory.
 *
 * ponytail: setelah lib/api.ts pindah ke SQLite, keduanya baca sumber yang sama
 * dan pilihan ini tinggal soal selera.
 */
export type SimpanHasil = { ok: true } | { ok: false; error: string; errors: DraftErrors };

/** Daftar, dashboard, dan timeline sama-sama membaca daftar proyek. */
function segarkanHalaman() {
  revalidatePath("/proyek");
  revalidatePath("/");
  revalidatePath("/timeline");
}

async function periksa(draft: ProjectDraft): Promise<DraftErrors> {
  const users = await getUsers();
  return validateDraft(
    draft,
    users.map((u) => u.id)
  );
}

export async function simpanProyek(draft: ProjectDraft): Promise<SimpanHasil> {
  const errors = await periksa(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Data proyek belum valid.", errors };
  }

  await createProject(draftToProject(draft));
  segarkanHalaman();
  return { ok: true };
}

/** Perbarui proyek yang sudah ada; aturan validasinya persis sama dengan tambah. */
export async function perbaruiProyek(id: number, draft: ProjectDraft): Promise<SimpanHasil> {
  const errors = await periksa(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Data proyek belum valid.", errors };
  }

  const hasil = await updateProject(id, draftToProject(draft));
  if (hasil === null) {
    return { ok: false, error: "Proyek tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  segarkanHalaman();
  return { ok: true };
}

export type ProgresHasil =
  | { ok: true }
  | { ok: false; error: string; errors: ProgressErrors };

/**
 * Catat progres baru dari halaman detail. Pencatatnya diambil dari pengguna
 * yang sedang masuk, bukan dikirim klien.
 */
export async function catatProgres(id: number, draft: ProgressDraft): Promise<ProgresHasil> {
  const project = await getProject(id);
  if (!project) {
    return { ok: false, error: "Proyek tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  const errors = validateProgress(draft, project.progressPct);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Catatan progres belum valid.", errors };
  }

  const pencatat = await getSessionUser();
  if (!pencatat) {
    return { ok: false, error: "Perlu masuk untuk mencatat progres.", errors: {} };
  }

  await addProgress({
    projectId: id,
    userId: pencatat.id,
    progressPct: Number(draft.progressPct),
    note: draft.note.trim(),
  });

  segarkanHalaman();
  revalidatePath(`/proyek/${id}`);
  return { ok: true };
}

/** Ganti status proyek dari halaman detail. */
export async function ubahStatusProyek(id: number, status: string): Promise<SimpanHasil> {
  // Nilai datang dari klien, jadi tetap dicocokkan dengan daftar status yang sah.
  if (!(PROJECT_STATUSES as string[]).includes(status)) {
    return { ok: false, error: "Status proyek tidak dikenal.", errors: {} };
  }

  const hasil = await updateProjectStatus(id, status as ProjectStatus);
  if (hasil === null) {
    return { ok: false, error: "Proyek tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  segarkanHalaman();
  revalidatePath(`/proyek/${id}`);
  return { ok: true };
}

/**
 * Hapus proyek. Konfirmasi ada di sisi UI; di sini cukup dipastikan proyeknya
 * memang masih ada supaya klik ganda tidak melaporkan sukses palsu.
 */
export async function hapusProyek(id: number): Promise<SimpanHasil> {
  const terhapus = await deleteProject(id);
  if (!terhapus) {
    return { ok: false, error: "Proyek tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  segarkanHalaman();
  return { ok: true };
}

/**
 * Tetapkan proyek mana saja yang ditahan proyek ini.
 *
 * Relasinya diatur di halaman detail, bukan di form proyek: sebelum proyeknya
 * tersimpan ia belum punya id, jadi belum ada sisi "penahan" yang bisa ditunjuk.
 */
export async function aturKetergantungan(
  id: number,
  blockedIds: number[]
): Promise<SimpanHasil> {
  // Id datang dari klien: apa pun yang bukan bilangan bulat dibuang di sini,
  // sebelum sempat dicocokkan ke daftar proyek.
  const bersih = blockedIds.filter((n) => Number.isInteger(n));

  const hasil = await setDependencies(id, bersih);
  if (!hasil.ok) {
    const nama =
      hasil.projectId === undefined ? null : (await getProject(hasil.projectId))?.name ?? null;
    const pesan: Record<typeof hasil.error, string> = {
      "diri-sendiri": "Proyek tidak bisa menahan dirinya sendiri.",
      melingkar: nama
        ? `"${nama}" sudah menahan proyek ini — relasinya akan saling mengunci.`
        : "Relasi ini membuat dua proyek saling menunggu.",
      "tidak-ada": "Proyek tidak ditemukan atau sudah dihapus.",
      "sudah-ada": "Relasi itu sudah tercatat.",
    };
    return { ok: false, error: pesan[hasil.error], errors: {} };
  }

  // Skor prioritas seluruh daftar ikut bergeser, jadi bukan hanya halaman ini.
  segarkanHalaman();
  revalidatePath(`/proyek/${id}`);
  return { ok: true };
}

export type PengingatHasil = { ok: true } | { ok: false; error: string; errors: ReminderErrors };

/** Kirim pengingat manual ke PIC proyek dari halaman detail. */
export async function kirimPengingat(id: number, draft: ReminderDraft): Promise<PengingatHasil> {
  const errors = validateReminder(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Pesan pengingat belum valid.", errors };
  }

  const pengirim = await getSessionUser();
  if (!pengirim) {
    return { ok: false, error: "Perlu masuk untuk mengirim pengingat.", errors: {} };
  }

  const hasil = await createReminder({
    projectId: id,
    fromUserId: pengirim.id,
    message: draft.message.trim(),
  });

  if (hasil === null) {
    return { ok: false, error: "Proyek tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  revalidatePath(`/proyek/${id}`);
  return { ok: true };
}

export type JadwalHasil = { ok: true } | { ok: false; error: string; errors: ScheduleErrors };

/** Atur (atau perbarui) jadwal pengingat berulang sebuah proyek. */
export async function aturJadwalPengingat(
  id: number,
  draft: ScheduleDraft
): Promise<JadwalHasil> {
  const hariIni = new Date().toISOString().slice(0, 10);
  const errors = validateSchedule(draft, hariIni);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Jadwal pengingat belum valid.", errors };
  }

  const hasil = await saveSchedule({
    projectId: id,
    frequency: draft.frequency as ReminderFrequency,
    startDate: draft.startDate,
  });

  if (hasil === null) {
    return { ok: false, error: "Proyek tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  revalidatePath(`/proyek/${id}`);
  return { ok: true };
}

/** Hidupkan atau matikan jadwal tanpa kehilangan setelannya. */
export async function ubahAktifJadwal(id: number, aktif: boolean): Promise<JadwalHasil> {
  const hasil = await setScheduleActive(id, aktif);
  if (hasil === null) {
    return { ok: false, error: "Jadwal pengingat belum pernah diatur.", errors: {} };
  }

  revalidatePath(`/proyek/${id}`);
  return { ok: true };
}

export type KomentarHasil = { ok: true } | { ok: false; error: string; errors: CommentErrors };

/** Tambah komentar pada sebuah proyek. Penulisnya diambil dari sesi, bukan klien. */
export async function kirimKomentar(id: number, draft: CommentDraft): Promise<KomentarHasil> {
  const errors = validateComment(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Komentar belum valid.", errors };
  }

  const penulis = await getSessionUser();
  if (!penulis) {
    return { ok: false, error: "Perlu masuk untuk berkomentar.", errors: {} };
  }

  const hasil = await createComment({
    projectId: id,
    userId: penulis.id,
    body: draft.body.trim(),
  });

  if (hasil === null) {
    return { ok: false, error: "Proyek tidak ditemukan atau sudah dihapus.", errors: {} };
  }

  revalidatePath(`/proyek/${id}`);
  return { ok: true };
}
