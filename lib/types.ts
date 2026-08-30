export type ProjectType = "Penjualan" | "Jasa" | "Training" | "Riset";
export type ProjectPriority = "Tinggi" | "Sedang" | "Rendah";
export type ProjectStatus =
  | "Prospect"
  | "Penawaran"
  | "Negosiasi"
  | "Berjalan"
  | "Tertunda"
  | "Selesai";

/* Daftar nilai yang sah, dipakai dropdown, validasi query API, dan CHECK di skema.
   Urutan status sengaja mengikuti alur pipeline divisi: prospek masuk, ditawar,
   dinegosiasikan, dikerjakan, dan berakhir selesai. "Tertunda" letaknya sebelum
   "Selesai" karena proyek yang diparkir belum keluar dari pipeline. */
/**
 * Prioritas dihitung sistem ("auto") atau dikunci orang ("manual").
 * Default auto: dashboard yang menentukan, kecuali ada alasan khusus.
 */
export type PriorityMode = "auto" | "manual";
export const PRIORITY_MODES: PriorityMode[] = ["auto", "manual"];

/**
 * Tingkat kemitraan klien — parameter prioritas berbobot 20%.
 * Urutannya dari paling kritis ke paling aman, dan memetakan langsung ke
 * skor 5..1 di lib/priority.ts.
 */
export type ClientTier = "VIP" | "Strategis" | "Reguler" | "Baru" | "Internal";
export const CLIENT_TIERS: ClientTier[] = ["VIP", "Strategis", "Reguler", "Baru", "Internal"];

/** Konsekuensi kontrak kalau proyek terlambat — parameter berbobot 15%. */
export type PenaltyRisk =
  | "Putus kontrak"
  | "Denda harian"
  | "Denda tetap"
  | "Teguran"
  | "Tidak ada";
export const PENALTY_RISKS: PenaltyRisk[] = [
  "Putus kontrak",
  "Denda harian",
  "Denda tetap",
  "Teguran",
  "Tidak ada",
];

/**
 * TOP — skema pembayaran yang disepakati di kontrak, bukan tempo jatuh tempo.
 * "Custom" wajib disertai keterangan di `paymentNote`; tanpa itu pilihannya
 * tidak membawa informasi apa pun.
 */
export type PaymentTerm = "Full" | "3 Termin" | "Custom";
export const PAYMENT_TERMS: PaymentTerm[] = ["Full", "3 Termin", "Custom"];

/**
 * Status pajak pemberi kerja. Untuk PKP, nilai kontrak dianggap sudah termasuk
 * PPN — lihat `lib/finance.ts` untuk konvensinya.
 */
export type TaxType = "PKP" | "Non PKP";
export const TAX_TYPES: TaxType[] = ["PKP", "Non PKP"];

export const PROJECT_TYPES: ProjectType[] = ["Penjualan", "Jasa", "Training", "Riset"];
export const PROJECT_PRIORITIES: ProjectPriority[] = ["Tinggi", "Sedang", "Rendah"];
export const PROJECT_STATUSES: ProjectStatus[] = [
  "Prospect",
  "Penawaran",
  "Negosiasi",
  "Berjalan",
  "Tertunda",
  "Selesai",
];

/**
 * Status terminal — proyek tidak perlu ditindaklanjuti lagi. Dipisah begini
 * supaya "aktif" punya satu definisi; sebelumnya tersebar sebagai
 * `status !== "Selesai"` di beberapa berkas dan gampang tertinggal saat
 * daftar statusnya bertambah.
 */
export const DONE_STATUSES: ProjectStatus[] = ["Selesai"];

/** Proyek masih perlu ditindaklanjuti. "Tertunda" tetap aktif — justru itu yang perlu dikejar. */
export function isActiveStatus(status: ProjectStatus): boolean {
  return !DONE_STATUSES.includes(status);
}

/**
 * Keterangan satu jenis proyek. `code` terkunci pada empat kategori di
 * `ProjectType` — yang bisa diubah hanya label, keterangan, dan urutannya.
 */
export type ProjectTypeInfo = {
  code: ProjectType;
  label: string;
  description: string;
  sortOrder: number;
};

export type User = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  /**
   * Prioritas yang berlaku. Kalau `priorityMode` = "auto" kolom ini diisi hasil
   * hitungan `lib/priority.ts` saat data dibaca lewat `lib/api.ts`; kalau
   * "manual" isinya nilai yang dikunci orang dan sistem tidak menimpanya.
   */
  priority: ProjectPriority;
  priorityMode: PriorityMode;
  progressPct: number;
  /** Instansi pemberi kerja — satu-satunya kolom klien yang wajib diisi. */
  clientOrg: string;
  /** PIC di sisi klien; "" kalau belum diketahui. */
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  /** Tingkat kemitraan klien — parameter prioritas. */
  clientTier: ClientTier;
  /** Konsekuensi kontrak kalau terlambat — parameter prioritas. */
  penaltyRisk: PenaltyRisk;
  /**
   * Nilai Kontrak dalam rupiah penuh. `null` = angkanya belum ada.
   * Untuk klien PKP angka ini dianggap sudah termasuk PPN.
   */
  value: number | null;
  /** Nomor kontrak/SPK. "" = belum ada kontrak (mis. masih tahap Prospect). */
  contractNo: string;
  /** ISO date tanda tangan kontrak. `null` = belum diteken. */
  contractDate: string | null;
  /** Skema pembayaran yang disepakati. */
  paymentTerm: PaymentTerm;
  /** Keterangan skema pembayaran; wajib diisi kalau `paymentTerm` = "Custom". */
  paymentNote: string;
  taxType: TaxType;
  /** Fee penjualan / kickback dalam rupiah. `null` = belum diisi. */
  salesFee: number | null;
  /** Biaya operasional pelaksanaan dalam rupiah. `null` = belum diisi. */
  operationalCost: number | null;
  /** ISO date (YYYY-MM-DD) — awal pengerjaan, dipakai timeline. */
  startDate: string;
  /** ISO date (YYYY-MM-DD) */
  deadline: string;
  ownerId: number;
  updatedAt: string;
  /* Margin/profit sengaja tidak disimpan di sini. Angkanya diturunkan dari
     value, taxType, salesFee, dan operationalCost lewat lib/finance.ts —
     kalau ikut disimpan, ia akan melenceng begitu salah satu komponennya
     diubah tanpa margin ikut disesuaikan. */
};

/**
 * Ketergantungan antar proyek: `blockerId` menahan `blockedId`.
 *
 * Disimpan sebagai relasi, bukan angka di `Project`, supaya hitungan "menahan
 * berapa proyek" selalu benar — kalau proyek yang ditahan selesai atau dihapus,
 * angkanya ikut turun sendiri tanpa ada yang perlu memperbaruinya.
 */
export type ProjectDependency = {
  blockerId: number;
  blockedId: number;
};

/** Satu baris riwayat progres — padanan tabel PROGRESS_HISTORY di PRD. */
export type ProgressEntry = {
  id: number;
  projectId: number;
  /** Anggota yang mencatat. */
  userId: number;
  /** Progres setelah pembaruan ini, 0-100. */
  progressPct: number;
  note: string;
  /** ISO date (YYYY-MM-DD) — dipakai untuk menampilkan tanggal. */
  createdAt: string;
  /**
   * Stempel waktu penuh "YYYY-MM-DD HH:MM:SS". Dipakai mengurutkan catatan
   * yang jatuh di hari yang sama; `createdAt` tidak cukup untuk itu.
   */
  recordedAt: string;
};

/**
 * Pengingat manual yang dikirim seseorang ke PIC sebuah proyek.
 *
 * `channel` sementara selalu "in-app": pengiriman email butuh layanan surel
 * (PRD bagian 8) yang belum terpasang, dan menawarkan pilihan yang tidak
 * benar-benar mengirim apa pun lebih buruk daripada tidak menawarkannya.
 */
export type ReminderChannel = "in-app";

export type Reminder = {
  id: number;
  projectId: number;
  /** Anggota yang dituju — biasanya PIC proyek. */
  toUserId: number;
  /** Anggota yang mengirim. */
  fromUserId: number;
  message: string;
  channel: ReminderChannel;
  /** ISO date (YYYY-MM-DD) */
  createdAt: string;
  /** Stempel waktu penuh "YYYY-MM-DD HH:MM:SS", untuk urutan dalam satu hari. */
  sentAt: string;
};

/** Jadwal pengingat berulang — padanan tabel REMINDERS di PRD. */
export type ReminderSchedule = {
  id: number;
  projectId: number;
  /** Anggota yang diingatkan; mengikuti PIC proyek saat jadwal dibuat. */
  toUserId: number;
  /** Nilai dari `REMINDER_FREQUENCIES` di lib/reminder-schedule.ts. */
  frequency: string;
  /** ISO date (YYYY-MM-DD) pengiriman berikutnya. */
  nextAt: string;
  isActive: boolean;
  createdAt: string;
};

/** Komentar diskusi pada sebuah proyek — padanan F14 di PRD. */
export type ProjectComment = {
  id: number;
  projectId: number;
  /** Penulis komentar. */
  userId: number;
  body: string;
  /** ISO date (YYYY-MM-DD) */
  createdAt: string;
  /** Stempel waktu penuh, untuk mengurutkan komentar di hari yang sama. */
  postedAt: string;
};

/**
 * Kredensial masuk. Sengaja TIDAK disimpan di dalam `User`: objek User dikirim
 * ke banyak endpoint (/api/users, /api/team, komentar), dan menaruh hash di
 * sana berarti satu kelalaian saja sudah cukup untuk membocorkannya.
 */
export type Credential = {
  userId: number;
  /** Format scrypt dari lib/password.ts. */
  passwordHash: string;
  /**
   * Kredensial contoh yang hash-nya ikut tersimpan di repositori. Ditolak saat
   * produksi — hash yang bisa dibaca siapa saja tidak boleh jadi pintu masuk.
   */
  devOnly: boolean;
};
