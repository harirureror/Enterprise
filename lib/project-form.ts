import {
  CLIENT_TIERS,
  PAYMENT_TERMS,
  PENALTY_RISKS,
  PRIORITY_MODES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  TAX_TYPES,
  type Project,
} from "./types";

/* Validasi form proyek. Fungsi murni dan bebas React supaya aturan yang sama
   dipakai form di browser dan route handler — pesan kesalahannya pun sama. */

/** Isi form apa adanya: semua string, karena input HTML memang mengembalikan string. */
export type ProjectDraft = {
  name: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  priorityMode: string;
  progressPct: string;
  clientOrg: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientTier: string;
  penaltyRisk: string;
  value: string;
  contractNo: string;
  contractDate: string;
  paymentTerm: string;
  paymentNote: string;
  taxType: string;
  salesFee: string;
  operationalCost: string;
  startDate: string;
  deadline: string;
  ownerId: string;
};

export type DraftField = keyof ProjectDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export const NAME_MIN = 3;
export const NAME_MAX = 120;
export const DESCRIPTION_MAX = 500;
export const CLIENT_MAX = 120;
export const CONTRACT_NO_MAX = 60;
export const PAYMENT_NOTE_MAX = 200;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/* Cukup memastikan bentuknya masuk akal — validasi email sungguhan hanya bisa
   lewat kirim surel, dan pola yang terlalu ketat menolak alamat yang sah. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/* Nomor Indonesia ditulis macam-macam: +62, spasi, tanda hubung, kurung kode area. */
const PHONE = /^[0-9+()\-\s]{7,25}$/;

export function emptyDraft(): ProjectDraft {
  return {
    name: "",
    description: "",
    type: "",
    status: "Prospect",
    priority: "Sedang",
    // Default otomatis: dashboard yang menentukan kecuali sengaja dikunci.
    priorityMode: "auto",
    progressPct: "0",
    clientOrg: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    // Default yang paling tidak mengejutkan: klien biasa, tanpa konsekuensi kontrak.
    clientTier: "Reguler",
    penaltyRisk: "Tidak ada",
    value: "",
    contractNo: "",
    contractDate: "",
    // Default yang paling tidak mengejutkan: bayar sekali, tanpa PPN dipungut.
    paymentTerm: "Full",
    paymentNote: "",
    taxType: "Non PKP",
    salesFee: "",
    operationalCost: "",
    startDate: "",
    deadline: "",
    ownerId: "",
  };
}

/** Isi form dari proyek yang sudah ada, untuk diedit. */
export function projectToDraft(project: Project): ProjectDraft {
  return {
    name: project.name,
    description: project.description,
    type: project.type,
    status: project.status,
    priority: project.priority,
    priorityMode: project.priorityMode,
    progressPct: String(project.progressPct),
    clientOrg: project.clientOrg,
    clientName: project.clientName,
    clientEmail: project.clientEmail,
    clientPhone: project.clientPhone,
    clientTier: project.clientTier,
    penaltyRisk: project.penaltyRisk,
    // null jadi input kosong, bukan tulisan "null".
    value: project.value === null ? "" : String(project.value),
    contractNo: project.contractNo,
    // null jadi input tanggal kosong, bukan tulisan "null".
    contractDate: project.contractDate ?? "",
    paymentTerm: project.paymentTerm,
    paymentNote: project.paymentNote,
    taxType: project.taxType,
    salesFee: project.salesFee === null ? "" : String(project.salesFee),
    operationalCost: project.operationalCost === null ? "" : String(project.operationalCost),
    startDate: project.startDate,
    deadline: project.deadline,
    ownerId: String(project.ownerId),
  };
}

/** Tanggal benar-benar ada di kalender — "2026-02-31" lolos regex tapi tidak nyata. */
function tanggalNyata(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/**
 * Periksa isian form. Mengembalikan pesan per kolom; kosong berarti lolos.
 * `ownerIds` adalah anggota yang boleh jadi PIC.
 */
export function validateDraft(draft: ProjectDraft, ownerIds: number[]): DraftErrors {
  const errors: DraftErrors = {};

  const name = draft.name.trim();
  if (name === "") errors.name = "Nama proyek wajib diisi.";
  else if (name.length < NAME_MIN) errors.name = `Nama proyek minimal ${NAME_MIN} karakter.`;
  else if (name.length > NAME_MAX) errors.name = `Nama proyek maksimal ${NAME_MAX} karakter.`;

  if (draft.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Deskripsi maksimal ${DESCRIPTION_MAX} karakter.`;
  }

  if (draft.type === "") errors.type = "Jenis proyek wajib dipilih.";
  else if (!(PROJECT_TYPES as string[]).includes(draft.type)) {
    errors.type = "Jenis proyek tidak dikenal.";
  }

  if (!(PROJECT_STATUSES as string[]).includes(draft.status)) {
    errors.status = "Status proyek tidak dikenal.";
  }

  if (!(PROJECT_PRIORITIES as string[]).includes(draft.priority)) {
    errors.priority = "Prioritas tidak dikenal.";
  }

  if (!(PRIORITY_MODES as string[]).includes(draft.priorityMode)) {
    errors.priorityMode = "Mode prioritas tidak dikenal.";
  }

  const progres = Number(draft.progressPct);
  if (draft.progressPct.trim() === "" || !Number.isInteger(progres)) {
    errors.progressPct = "Progres harus berupa angka bulat.";
  } else if (progres < 0 || progres > 100) {
    errors.progressPct = "Progres harus antara 0 dan 100.";
  }

  const clientOrg = draft.clientOrg.trim();
  if (clientOrg === "") errors.clientOrg = "Instansi klien wajib diisi.";
  else if (clientOrg.length > CLIENT_MAX) {
    errors.clientOrg = `Instansi klien maksimal ${CLIENT_MAX} karakter.`;
  }

  // Nama PIC, email, dan telepon opsional — di tahap prospek sering belum ada.
  if (draft.clientName.trim().length > CLIENT_MAX) {
    errors.clientName = `Nama PIC klien maksimal ${CLIENT_MAX} karakter.`;
  }

  const clientEmail = draft.clientEmail.trim();
  if (clientEmail !== "" && !EMAIL.test(clientEmail)) {
    errors.clientEmail = "Format email tidak valid.";
  }

  const clientPhone = draft.clientPhone.trim();
  if (clientPhone !== "" && !PHONE.test(clientPhone)) {
    errors.clientPhone = "Nomor telepon hanya boleh angka, spasi, +, -, dan tanda kurung.";
  }

  // Dua parameter prioritas: pilihan tertutup, jadi cukup dicocokkan ke daftarnya.
  if (!(CLIENT_TIERS as string[]).includes(draft.clientTier)) {
    errors.clientTier = "Tingkat kemitraan klien tidak dikenal.";
  }

  if (!(PENALTY_RISKS as string[]).includes(draft.penaltyRisk)) {
    errors.penaltyRisk = "Risiko penalti tidak dikenal.";
  }

  const nilai = draft.value.trim();
  if (nilai !== "") {
    const angka = Number(nilai);
    if (!Number.isInteger(angka)) errors.value = "Nilai proyek harus berupa angka bulat rupiah.";
    else if (angka < 0) errors.value = "Nilai proyek tidak boleh negatif.";
  }

  const contractNo = draft.contractNo.trim();
  if (contractNo.length > CONTRACT_NO_MAX) {
    errors.contractNo = `Nomor kontrak maksimal ${CONTRACT_NO_MAX} karakter.`;
  }

  // Tanggal kontrak opsional dan sengaja tanpa aturan silang dengan tanggal
  // mulai: pekerjaan bisa sah dimulai lebih dulu berbekal SPK atau LoI, dan
  // menolaknya akan membuang data yang sebenarnya benar.
  if (draft.contractDate !== "" && !tanggalNyata(draft.contractDate)) {
    errors.contractDate = "Tanggal kontrak tidak valid.";
  }

  if (!(PAYMENT_TERMS as string[]).includes(draft.paymentTerm)) {
    errors.paymentTerm = "Skema pembayaran tidak dikenal.";
  }

  const paymentNote = draft.paymentNote.trim();
  if (paymentNote.length > PAYMENT_NOTE_MAX) {
    errors.paymentNote = `Keterangan pembayaran maksimal ${PAYMENT_NOTE_MAX} karakter.`;
  } else if (draft.paymentTerm === "Custom" && paymentNote === "") {
    // Tanpa keterangan, "Custom" tidak memberi tahu apa pun soal skemanya.
    errors.paymentNote = "Skema Custom wajib dijelaskan di keterangan.";
  }

  if (!(TAX_TYPES as string[]).includes(draft.taxType)) {
    errors.taxType = "Status pajak tidak dikenal.";
  }

  // Sales fee dan cost operasional memakai aturan yang sama dengan nilai kontrak.
  for (const field of ["salesFee", "operationalCost"] as const) {
    const isi = draft[field].trim();
    if (isi === "") continue;
    const angka = Number(isi);
    if (!Number.isInteger(angka)) errors[field] = "Harus berupa angka bulat rupiah.";
    else if (angka < 0) errors[field] = "Tidak boleh negatif.";
  }

  if (draft.startDate === "") errors.startDate = "Tanggal mulai wajib diisi.";
  else if (!tanggalNyata(draft.startDate)) errors.startDate = "Tanggal mulai tidak valid.";

  if (draft.deadline === "") errors.deadline = "Tenggat wajib diisi.";
  else if (!tanggalNyata(draft.deadline)) errors.deadline = "Tenggat tidak valid.";
  else if (!errors.startDate && draft.deadline < draft.startDate) {
    // Aturan yang sama dijaga CHECK di skema database.
    errors.deadline = "Tenggat tidak boleh mendahului tanggal mulai.";
  }

  const owner = Number(draft.ownerId);
  if (draft.ownerId.trim() === "") errors.ownerId = "PIC wajib dipilih.";
  else if (!ownerIds.includes(owner)) errors.ownerId = "PIC tidak terdaftar.";

  return errors;
}

/** Ubah isian yang sudah lolos validasi jadi data proyek (tanpa id). */
export function draftToProject(draft: ProjectDraft): Omit<Project, "id"> {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    type: draft.type as Project["type"],
    status: draft.status as Project["status"],
    priority: draft.priority as Project["priority"],
    priorityMode: draft.priorityMode as Project["priorityMode"],
    progressPct: Number(draft.progressPct),
    clientOrg: draft.clientOrg.trim(),
    clientName: draft.clientName.trim(),
    clientEmail: draft.clientEmail.trim(),
    clientPhone: draft.clientPhone.trim(),
    clientTier: draft.clientTier as Project["clientTier"],
    penaltyRisk: draft.penaltyRisk as Project["penaltyRisk"],
    // Kosong berarti "belum ada angka", bukan nol rupiah.
    value: draft.value.trim() === "" ? null : Number(draft.value),
    contractNo: draft.contractNo.trim(),
    contractDate: draft.contractDate === "" ? null : draft.contractDate,
    paymentTerm: draft.paymentTerm as Project["paymentTerm"],
    paymentNote: draft.paymentNote.trim(),
    taxType: draft.taxType as Project["taxType"],
    salesFee: draft.salesFee.trim() === "" ? null : Number(draft.salesFee),
    operationalCost:
      draft.operationalCost.trim() === "" ? null : Number(draft.operationalCost),
    startDate: draft.startDate,
    deadline: draft.deadline,
    ownerId: Number(draft.ownerId),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}
