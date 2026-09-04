import { tanggalNyata } from "./project-form";
import { AGENDA_KINDS, type AgendaEntry, type Project } from "./types";

/* Validasi form agenda. Fungsi murni dan bebas React supaya aturan yang sama
   dipakai form di browser dan server action — pesan kesalahannya pun sama. */

/** Isi form apa adanya: semua string, karena input HTML memang begitu. */
export type AgendaDraft = {
  /** Siapa yang menjalani. Manager boleh mengisikan untuk anggotanya. */
  userId: string;
  /** "" berarti agenda non-proyek. */
  projectId: string;
  kind: string;
  startDate: string;
  endDate: string;
  locationCity: string;
  locationProvince: string;
  note: string;
};

export type AgendaField = keyof AgendaDraft;
export type AgendaErrors = Partial<Record<AgendaField, string>>;

export const NOTE_MAX = 200;
export const LOCATION_MAX = 60;

export function emptyAgendaDraft(userId: number): AgendaDraft {
  return {
    userId: String(userId),
    projectId: "",
    // Kantor sebagai default: tebakan paling tidak mengejutkan, dan tidak
    // mengklaim seseorang sedang di lapangan padahal belum tentu.
    kind: "Kantor",
    startDate: "",
    endDate: "",
    locationCity: "",
    locationProvince: "",
    note: "",
  };
}

export function agendaToDraft(entry: AgendaEntry): AgendaDraft {
  return {
    userId: String(entry.userId),
    projectId: entry.projectId === null ? "" : String(entry.projectId),
    kind: entry.kind,
    startDate: entry.startDate,
    endDate: entry.endDate,
    locationCity: entry.locationCity,
    locationProvince: entry.locationProvince,
    note: entry.note,
  };
}

/**
 * Periksa isian agenda. `userIds` anggota yang sah, `projectIds` proyek yang ada.
 */
export function validateAgenda(
  draft: AgendaDraft,
  userIds: number[],
  projectIds: number[]
): AgendaErrors {
  const errors: AgendaErrors = {};

  const pemilik = Number(draft.userId);
  if (draft.userId.trim() === "") errors.userId = "Anggota wajib dipilih.";
  else if (!userIds.includes(pemilik)) errors.userId = "Anggota tidak terdaftar.";

  if (!(AGENDA_KINDS as string[]).includes(draft.kind)) {
    errors.kind = "Jenis kegiatan tidak dikenal.";
  }

  const proyek = draft.projectId.trim();
  if (proyek !== "") {
    if (!projectIds.includes(Number(proyek))) errors.projectId = "Proyek tidak ditemukan.";
    // Cuti yang ditempeli proyek pasti salah isi — dan kalau dibiarkan, laporan
    // ke HR akan menunjukkan orang sedang mengerjakan proyek saat dia libur.
    else if (draft.kind === "Cuti") errors.projectId = "Agenda cuti tidak terkait proyek.";
  }

  if (draft.startDate === "") errors.startDate = "Tanggal mulai wajib diisi.";
  else if (!tanggalNyata(draft.startDate)) errors.startDate = "Tanggal mulai tidak valid.";

  if (draft.endDate === "") errors.endDate = "Tanggal selesai wajib diisi.";
  else if (!tanggalNyata(draft.endDate)) errors.endDate = "Tanggal selesai tidak valid.";
  else if (!errors.startDate && draft.endDate < draft.startDate) {
    // Aturan yang sama dijaga CHECK di skema.
    errors.endDate = "Tanggal selesai tidak boleh mendahului tanggal mulai.";
  }

  if (draft.locationCity.trim().length > LOCATION_MAX) {
    errors.locationCity = `Kota/kabupaten maksimal ${LOCATION_MAX} karakter.`;
  }
  if (draft.locationProvince.trim().length > LOCATION_MAX) {
    errors.locationProvince = `Provinsi maksimal ${LOCATION_MAX} karakter.`;
  }
  if (draft.note.trim().length > NOTE_MAX) {
    errors.note = `Catatan maksimal ${NOTE_MAX} karakter.`;
  }

  return errors;
}

/**
 * Lokasi bawaan dari proyek yang dipilih.
 *
 * Hanya mengisi yang masih kosong — orang bisa saja menginap di kota sebelah,
 * dan menimpa isian yang sudah diketik akan menghapus koreksi mereka.
 */
export function withProjectLocation(draft: AgendaDraft, projects: Project[]): AgendaDraft {
  const proyek = projects.find((p) => String(p.id) === draft.projectId.trim());
  if (!proyek) return draft;

  return {
    ...draft,
    locationCity: draft.locationCity.trim() === "" ? proyek.locationCity : draft.locationCity,
    locationProvince:
      draft.locationProvince.trim() === "" ? proyek.locationProvince : draft.locationProvince,
  };
}

/** Ubah isian yang sudah lolos validasi jadi data agenda (tanpa id). */
export function draftToAgenda(draft: AgendaDraft, createdBy: number): Omit<AgendaEntry, "id"> {
  return {
    userId: Number(draft.userId),
    projectId: draft.projectId.trim() === "" ? null : Number(draft.projectId),
    kind: draft.kind as AgendaEntry["kind"],
    startDate: draft.startDate,
    endDate: draft.endDate,
    locationCity: draft.locationCity.trim(),
    locationProvince: draft.locationProvince.trim(),
    note: draft.note.trim(),
    createdBy,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}
