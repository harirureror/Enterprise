"use server";

import { revalidatePath } from "next/cache";
import {
  createAgenda,
  deleteAgenda,
  getAgendaEntry,
  getProjects,
  getUsers,
  updateAgenda,
} from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import {
  type AgendaDraft,
  type AgendaErrors,
  draftToAgenda,
  validateAgenda,
  withProjectLocation,
} from "@/lib/agenda-form";
import { canEditAgenda } from "@/lib/permissions";

/* Pengisian agenda.

   Penjaganya canEditAgenda(), bukan sekadar "punya kemampuan mengisi": Anggota
   boleh mengisi agenda, tapi hanya agendanya sendiri. Memeriksa kemampuannya
   saja akan membuat Anggota bisa menuliskan agenda atas nama rekannya. */

export type AgendaHasil = { ok: true } | { ok: false; error: string; errors: AgendaErrors };

const TIDAK_BOLEH = "Akses Anda tidak mencakup pengisian agenda ini.";

/** Validasi bersama simpan dan perbarui, supaya aturannya tidak bercabang. */
async function siapkan(
  draft: AgendaDraft
): Promise<{ ok: true; bersih: AgendaDraft } | { ok: false; hasil: AgendaHasil }> {
  const projects = await getProjects();
  const users = await getUsers();

  // Lokasi diisi dari proyek SEBELUM divalidasi, supaya panjangnya ikut diperiksa.
  const bersih = withProjectLocation(draft, projects);
  const errors = validateAgenda(
    bersih,
    users.map((u) => u.id),
    projects.map((p) => p.id)
  );

  if (Object.keys(errors).length > 0) {
    return { ok: false, hasil: { ok: false, error: "Periksa kembali isian Anda.", errors } };
  }
  return { ok: true, bersih };
}

function segarkan(): void {
  revalidatePath("/agenda");
}

export async function simpanAgenda(draft: AgendaDraft): Promise<AgendaHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk mengisi agenda.", errors: {} };

  const siap = await siapkan(draft);
  if (!siap.ok) return siap.hasil;

  // Diperiksa terhadap pemilik agenda yang diminta, bukan terhadap penggunanya
  // sendiri — di sinilah "Manager boleh mengisikan anggotanya" ditegakkan.
  if (!canEditAgenda(pengguna, { userId: Number(siap.bersih.userId) })) {
    return { ok: false, error: TIDAK_BOLEH, errors: {} };
  }

  await createAgenda(draftToAgenda(siap.bersih, pengguna.id));
  segarkan();
  return { ok: true };
}

export async function perbaruiAgenda(id: number, draft: AgendaDraft): Promise<AgendaHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk mengubah agenda.", errors: {} };

  const lama = await getAgendaEntry(id);
  if (!lama) return { ok: false, error: "Agenda tidak ditemukan.", errors: {} };

  const siap = await siapkan(draft);
  if (!siap.ok) return siap.hasil;

  // Dua-duanya diperiksa: pemilik lama dan pemilik baru. Tanpa pemeriksaan
  // kedua, seseorang bisa memindahkan agendanya sendiri ke nama orang lain.
  if (
    !canEditAgenda(pengguna, lama) ||
    !canEditAgenda(pengguna, { userId: Number(siap.bersih.userId) })
  ) {
    return { ok: false, error: TIDAK_BOLEH, errors: {} };
  }

  // createdBy dipertahankan: itu jejak siapa yang pertama mencatat.
  const diubah = await updateAgenda(id, { ...draftToAgenda(siap.bersih, lama.createdBy) });
  if (diubah === null) return { ok: false, error: "Agenda tidak ditemukan.", errors: {} };

  segarkan();
  return { ok: true };
}

export async function hapusAgenda(id: number): Promise<AgendaHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk menghapus agenda.", errors: {} };

  const lama = await getAgendaEntry(id);
  if (!lama) return { ok: false, error: "Agenda tidak ditemukan atau sudah dihapus.", errors: {} };
  if (!canEditAgenda(pengguna, lama)) return { ok: false, error: TIDAK_BOLEH, errors: {} };

  await deleteAgenda(id);
  segarkan();
  return { ok: true };
}
