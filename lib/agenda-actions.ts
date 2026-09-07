"use server";

import { revalidatePath } from "next/cache";
import {
  type AgendaMove,
  createAgenda,
  deleteAgenda,
  deleteAgendaEntries,
  getAgendaEntry,
  getProjects,
  getUsers,
  moveAgendaEntries,
  updateAgenda,
} from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import {
  type AgendaDraft,
  type AgendaErrors,
  agendaToDraft,
  draftToAgenda,
  validateAgenda,
  withProjectLocation,
} from "@/lib/agenda-form";
import { fromDay, toDay } from "@/lib/timeline";
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
  // Agenda pindah ke sub-tab Rencana; "/agenda" sudah tidak menunjuk apa pun.
  revalidatePath("/rencana/agenda");
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

/* --- Seret-lepas dan hapus massal -------------------------------------------

   Ketiganya dipanggil dari papan agenda. Penjaganya sama persis dengan jalur
   form di atas — menyeret bar bukan cara lain untuk mengubah agenda, hanya
   cara lain untuk memintanya. */

/** Sejauh apa satu seretan boleh memindahkan tanggal. */
const GESER_MAKS_HARI = 370;

/**
 * Geser satu bar: seluruh entri di dalamnya bergerak sejauh hari yang sama, dan
 * boleh sekalian berpindah ke anggota lain.
 *
 * Klien hanya mengirim SELISIH hari, bukan tanggal jadi. Tanggal barunya
 * dihitung server dari nilai tersimpan, sehingga tab yang lama terbuka tidak
 * bisa menuliskan hasil hitungan yang sudah usang.
 */
export async function geserAgenda(
  ids: number[],
  deltaHari: number,
  userIdBaru: number | null
): Promise<AgendaHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk memindahkan agenda.", errors: {} };

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Tidak ada agenda yang dipindahkan.", errors: {} };
  }
  if (!Number.isInteger(deltaHari) || Math.abs(deltaHari) > GESER_MAKS_HARI) {
    // Tanpa batas ini, klien yang berulah bisa mendorong tanggal ke tahun 9999;
    // CHECK di skema hanya memeriksa bentuk teksnya, bukan kewajarannya.
    return { ok: false, error: "Pergeseran tanggal di luar batas wajar.", errors: {} };
  }

  const unik = [...new Set(ids)];
  const perubahan: AgendaMove[] = [];

  for (const id of unik) {
    const lama = await getAgendaEntry(id);
    if (!lama) return { ok: false, error: "Agenda tidak ditemukan.", errors: {} };
    // Diperiksa per entri, bukan sekali untuk seluruh bar: bar dibentuk di
    // klien, jadi isinya tidak boleh dipercaya sebagai milik satu orang.
    if (!canEditAgenda(pengguna, lama)) return { ok: false, error: TIDAK_BOLEH, errors: {} };

    perubahan.push({
      id,
      userId: userIdBaru ?? lama.userId,
      startDate: fromDay(toDay(lama.startDate) + deltaHari),
      endDate: fromDay(toDay(lama.endDate) + deltaHari),
    });
  }

  if (userIdBaru !== null) {
    const users = await getUsers();
    if (!users.some((u) => u.id === userIdBaru)) {
      return { ok: false, error: "Anggota tidak terdaftar.", errors: {} };
    }
    // Sisi kedua: tanpa ini, seseorang bisa menyeret agendanya sendiri ke nama
    // orang lain. Aturan yang sama dijaga perbaruiAgenda().
    if (!canEditAgenda(pengguna, { userId: userIdBaru })) {
      return { ok: false, error: TIDAK_BOLEH, errors: {} };
    }
  }

  const hasil = await moveAgendaEntries(perubahan);
  if (!hasil.ok) return { ok: false, error: hasil.error, errors: {} };

  segarkan();
  return { ok: true };
}

/**
 * Ubah rentang satu agenda — dipakai gagang ujung bar.
 *
 * Diteruskan ke perbaruiAgenda() supaya validasi tanggal, pengisian lokasi dari
 * proyek, dan penjaga dua sisi tidak bercabang dari jalur form.
 */
export async function ubahRentangAgenda(
  id: number,
  startDate: string,
  endDate: string
): Promise<AgendaHasil> {
  const lama = await getAgendaEntry(id);
  if (!lama) return { ok: false, error: "Agenda tidak ditemukan.", errors: {} };

  return perbaruiAgenda(id, { ...agendaToDraft(lama), startDate, endDate });
}

/**
 * Hapus beberapa agenda sekaligus.
 *
 * Menolak SELURUH batch kalau ada satu yang tidak boleh, dan menyebut berapa
 * yang ditolak. Menghapus sebagian lalu diam akan membuat orang mengira
 * pilihannya sudah bersih padahal belum.
 */
export async function hapusAgendaBanyak(ids: number[]): Promise<AgendaHasil> {
  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk menghapus agenda.", errors: {} };

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Tidak ada agenda yang dipilih.", errors: {} };
  }

  const unik = [...new Set(ids)];
  let ditolak = 0;

  for (const id of unik) {
    const lama = await getAgendaEntry(id);
    if (!lama) return { ok: false, error: "Ada agenda yang sudah dihapus.", errors: {} };
    if (!canEditAgenda(pengguna, lama)) ditolak++;
  }

  if (ditolak > 0) {
    return {
      ok: false,
      error: `${ditolak} dari ${unik.length} agenda di luar hak Anda — tidak ada yang dihapus.`,
      errors: {},
    };
  }

  const hasil = await deleteAgendaEntries(unik);
  if (!hasil.ok) return { ok: false, error: hasil.error, errors: {} };

  segarkan();
  return { ok: true };
}
