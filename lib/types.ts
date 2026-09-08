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

/**
 * Tingkat akses aplikasi. Sengaja TERPISAH dari `role` yang berisi jabatan
 * bebas ("Project Manager"): kalau keduanya satu kolom, mengganti jabatan
 * seseorang akan diam-diam mengganti haknya juga.
 *
 * Definisi kemampuan tiap tingkat ada di lib/permissions.ts.
 */
export type AccessLevel = "Admin" | "Owner" | "HR" | "Manager" | "Anggota";
export const ACCESS_LEVELS: AccessLevel[] = ["Admin", "Owner", "HR", "Manager", "Anggota"];

/** Jenis kegiatan di agenda tim — inti dari "orangnya lagi di mana". */
export type AgendaKind = "Lapangan" | "Kantor" | "Perjalanan" | "Cuti";
export const AGENDA_KINDS: AgendaKind[] = ["Lapangan", "Kantor", "Perjalanan", "Cuti"];

/* --- Rencana strategis ------------------------------------------------------

   Dua sumbu yang sengaja dipisah: `kind` menjawab "apa kegiatannya", `goal`
   menjawab "untuk apa". Pelatihan bisa mengarah ke penetrasi pasar maupun ke
   kapasitas internal — kalau keduanya jadi satu daftar, pertanyaan "rencana apa
   saja yang mengarah ke penetrasi pasar" tidak bisa dijawab. */

export type PlanKind = "Pelatihan" | "Riset" | "Kemitraan" | "Sertifikasi" | "Pemasaran";
export const PLAN_KINDS: PlanKind[] = [
  "Pelatihan",
  "Riset",
  "Kemitraan",
  "Sertifikasi",
  "Pemasaran",
];

export type PlanGoal =
  | "Penetrasi Pasar"
  | "Kesiapan Regulasi"
  | "Kapasitas Internal"
  | "Efisiensi Biaya";
export const PLAN_GOALS: PlanGoal[] = [
  "Penetrasi Pasar",
  "Kesiapan Regulasi",
  "Kapasitas Internal",
  "Efisiensi Biaya",
];

/** Segmen pasar yang disasar. Tertutup supaya bisa disaring dan dijumlah. */
export type PlanSegment =
  | "Tambang"
  | "Perkebunan"
  | "Kehutanan"
  | "Infrastruktur"
  | "Energi"
  | "Instansi Pemerintah"
  | "Akademik"
  | "Lainnya";
export const PLAN_SEGMENTS: PlanSegment[] = [
  "Tambang",
  "Perkebunan",
  "Kehutanan",
  "Infrastruktur",
  "Energi",
  "Instansi Pemerintah",
  "Akademik",
  "Lainnya",
];

export type PlanStatus =
  | "Ide"
  | "Disetujui"
  | "Berjalan"
  | "Selesai"
  | "Ditunda"
  | "Dibatalkan";
export const PLAN_STATUSES: PlanStatus[] = [
  "Ide",
  "Disetujui",
  "Berjalan",
  "Selesai",
  "Ditunda",
  "Dibatalkan",
];

/** Rencana yang tidak perlu dikejar lagi. */
export const PLAN_DONE_STATUSES: PlanStatus[] = ["Selesai", "Dibatalkan"];

export function isActivePlan(status: PlanStatus): boolean {
  return !PLAN_DONE_STATUSES.includes(status);
}

export type StepStatus = "Belum" | "Berjalan" | "Selesai" | "Batal";
export const STEP_STATUSES: StepStatus[] = ["Belum", "Berjalan", "Selesai", "Batal"];

/** Corong pendekatan calon klien. Terpisah dari pipeline proyek: yang di sini
    belum tentu pernah jadi proyek. */
export type ProspectStatus =
  | "Belum dihubungi"
  | "Dihubungi"
  | "Presentasi"
  | "Negosiasi"
  | "Menjadi Klien"
  | "Tidak Lanjut";
export const PROSPECT_STATUSES: ProspectStatus[] = [
  "Belum dihubungi",
  "Dihubungi",
  "Presentasi",
  "Negosiasi",
  "Menjadi Klien",
  "Tidak Lanjut",
];

export type User = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Jabatan, teks bebas. Bukan penentu hak akses — lihat `accessLevel`. */
  role: string;
  accessLevel: AccessLevel;
  /**
   * Akun nonaktif tidak bisa masuk, tapi barisnya tetap ada supaya namanya
   * masih melekat di proyek, komentar, dan riwayat yang pernah dia buat.
   */
  isActive: boolean;
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
  /** "auto" berarti progressPct dihitung dari checklist aktivitas. */
  progressMode: ProgressMode;
  progressPct: number;
  /** Instansi pemberi kerja — satu-satunya kolom klien yang wajib diisi. */
  clientOrg: string;
  /** Lokasi Kota/Kabupaten klien */
  locationCity: string;
  /** Lokasi Provinsi klien */
  locationProvince: string;
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
/** Meniru PriorityMode: dihitung sistem, kecuali sengaja dikunci. */
export type ProgressMode = "auto" | "manual";

/**
 * Satu langkah alur kerja proyek.
 *
 * Menggantikan progres yang diketik: yang tercentang menentukan progres DAN
 * status, sehingga angka di layar selalu punya pekerjaan nyata di belakangnya.
 */
export type ProjectActivity = {
  id: number;
  projectId: number;
  name: string;
  /** Sumbangan ke progres, 0-100. Jumlah seluruh aktivitas idealnya 100. */
  weight: number;
  /** Status proyek yang berlaku begitu aktivitas ini selesai. */
  status: ProjectStatus;
  /**
   * Berapa hari sesudah aktivitas ini selesai, tindak lanjut jatuh tempo.
   * `null` berarti tidak ada tenggat. Contoh: penawaran berlaku 14 hari.
   */
  slaDays: number | null;
  /** ISO date; menggambar garis RENCANA di kurva S. */
  targetDate: string | null;
  /** ISO date; `null` berarti belum selesai. Menggambar garis AKTUAL. */
  doneDate: string | null;
  doneBy: number | null;
  sortOrder: number;
};

/** Baris template per jenis proyek; disalin ke proyek saat dibuat. */
export type ActivityTemplate = {
  id: number;
  typeCode: string;
  name: string;
  weight: number;
  status: ProjectStatus;
  slaDays: number | null;
  sortOrder: number;
};

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
 * Satu baris agenda: siapa, kapan, sedang apa, dan di mana.
 *
 * `userId` adalah orang yang menjalani; `createdBy` yang mencatat. Keduanya
 * dipisah karena Manager boleh mengisikan agenda untuk anggotanya.
 */
export type AgendaEntry = {
  id: number;
  /** Orang yang menjalani agenda ini. */
  userId: number;
  /** Proyek terkait; `null` untuk agenda non-proyek seperti cuti atau kantor. */
  projectId: number | null;
  kind: AgendaKind;
  /** ISO date (YYYY-MM-DD), inklusif di kedua ujungnya. */
  startDate: string;
  endDate: string;
  locationCity: string;
  locationProvince: string;
  note: string;
  /** Siapa yang mencatat; bisa berbeda dari `userId`. */
  createdBy: number;
  updatedAt: string;
};

/**
 * Satu rencana strategis: ke mana divisi menuju, dan pasar mana yang didekati.
 *
 * Bedanya dengan `Project`: tidak ada klien yang membayar dan tidak ada nilai
 * kontrak. Keberhasilannya diukur lewat `outcome` dan kemajuan langkah-
 * langkahnya, bukan lewat rupiah.
 */
export type StrategicPlan = {
  id: number;
  title: string;
  /** Latar belakang dan uraian rencana. */
  summary: string;
  kind: PlanKind;
  goal: PlanGoal;
  segment: PlanSegment;
  /** Provinsi sasaran; sebangun dengan `Project.locationProvince`. */
  region: string;
  /** Lawan bicara: Inspektur Tambang, Undip, ITERA. */
  partner: string;
  status: PlanStatus;
  priority: ProjectPriority;
  ownerId: number;
  /** ISO date; `null` karena sebuah ide belum tentu sudah punya tanggal. */
  startDate: string | null;
  targetDate: string | null;
  /** Ukuran keberhasilan, ditulis di depan supaya tidak dikarang di belakang. */
  outcome: string;
  createdBy: number;
  updatedAt: string;
};

/**
 * Satu langkah pelaksanaan. Progres rencana diturunkan dari kumpulan langkah
 * ini — tidak pernah diketik orang; lihat lib/strategy.ts.
 */
export type PlanStep = {
  id: number;
  planId: number;
  title: string;
  /** `null` kalau langkahnya belum ditugaskan ke siapa pun. */
  ownerId: number | null;
  targetDate: string | null;
  status: StepStatus;
  note: string;
  /** Urutan ditentukan orang, bukan tanggal. */
  sortOrder: number;
};

/** Calon klien yang akan didekati dalam rangka sebuah rencana. */
export type PlanProspect = {
  id: number;
  planId: number;
  name: string;
  contact: string;
  region: string;
  status: ProspectStatus;
  note: string;
  updatedAt: string;
};

/**
 * Apa yang DIHASILKAN sebuah rencana.
 *
 * Sebelumnya hanya proyek yang tercatat, padahal riset menghasilkan jurnal,
 * kegiatan menghasilkan portofolio, dan pelatihan menghasilkan sertifikasi.
 * Proyek kini salah satu jenis luaran, bukan kategori tersendiri.
 */
export type PlanOutputKind =
  | "Jurnal"
  | "Portofolio"
  | "Sertifikasi"
  | "Produk"
  | "Proyek Turunan";

export const PLAN_OUTPUT_KINDS: PlanOutputKind[] = [
  "Jurnal",
  "Portofolio",
  "Sertifikasi",
  "Produk",
  "Proyek Turunan",
];

export type PlanOutput = {
  id: number;
  planId: number;
  kind: PlanOutputKind;
  title: string;
  /** Terisi hanya untuk "Proyek Turunan"; `null` kalau proyeknya sudah dihapus. */
  projectId: number | null;
  url: string;
  /** ISO date; `null` untuk luaran yang masih diupayakan. */
  achievedAt: string | null;
  note: string;
  sortOrder: number;
};

/** Komentar pada rencana. Bentuknya sama dengan ProjectComment, tabelnya beda. */
export type PlanComment = {
  id: number;
  planId: number;
  userId: number;
  body: string;
  createdAt: string;
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
