import type {
  Credential,
  ProjectDependency,
  ProgressEntry,
  Project,
  ProjectTypeInfo,
  ProjectComment,
  Reminder,
  ReminderSchedule,
  User,
} from "./types";

/** ponytail: data tiruan in-memory sampai API backend siap (fase backend). */

export const users: User[] = [
  { id: 1, name: "Rani Puspita", email: "rani@jayasurvei.co.id", avatarUrl: null, role: "Account Manager" },
  { id: 2, name: "Bagas Prakoso", email: "bagas@jayasurvei.co.id", avatarUrl: null, role: "Project Lead" },
  { id: 3, name: "Sinta Marlina", email: "sinta@jayasurvei.co.id", avatarUrl: null, role: "Analis Riset" },
  { id: 4, name: "Dimas Adiputra", email: "dimas@jayasurvei.co.id", avatarUrl: null, role: "Trainer" },
  { id: 5, name: "Nadia Kusuma", email: "nadia@jayasurvei.co.id", avatarUrl: null, role: "Engineer Jasa" },
  // Akun uji: sengaja diberi nama jelas supaya tidak tertukar dengan anggota
  // sungguhan, dan tidak memegang proyek apa pun.
  { id: 6, name: "Admin Uji", email: "admin@jayasurvei.co.id", avatarUrl: null, role: "Administrator" },
];

export const currentUser: User = users[0];

/** Keterangan jenis proyek; kodenya tetap, sisanya bisa diubah lewat API. */
export const projectTypes: ProjectTypeInfo[] = [
  { code: "Penjualan", label: "Penjualan", description: "Pengadaan alat dan solusi ke klien.", sortOrder: 0 },
  { code: "Jasa", label: "Jasa", description: "Pekerjaan survei dan layanan lapangan.", sortOrder: 1 },
  { code: "Training", label: "Training", description: "Pelatihan dan transfer pengetahuan.", sortOrder: 2 },
  { code: "Riset", label: "Riset", description: "Kajian pasar dan pengembangan internal.", sortOrder: 3 },
];

export const projects: Project[] = [
  {
    id: 1,
    name: "Pengadaan GNSS PT Karya Bumi",
    description: "Penawaran dan pengadaan 8 unit GNSS receiver untuk tim survei tambang.",
    type: "Penjualan",
    status: "Berjalan",
    priority: "Tinggi",
    priorityMode: "auto",
    progressPct: 65,
    clientOrg: "PT Karya Bumi Sejahtera",
    clientName: "Ir. Hendra Wijaya",
    clientEmail: "hendra.wijaya@karyabumi.co.id",
    clientPhone: "+62 812-3456-7890",
    clientTier: "Strategis",
    penaltyRisk: "Denda tetap",
    value: 1_850_000_000,
    contractNo: "SPK/KBS/2026/0142",
    contractDate: "2026-08-05",
    paymentTerm: "3 Termin",
    paymentNote: "30% DP, 40% saat unit diterima, 30% setelah BAST.",
    taxType: "PKP",
    salesFee: 55_000_000,
    operationalCost: 1_320_000_000,
    startDate: "2026-08-10",
    deadline: "2026-09-12",
    ownerId: 1,
    updatedAt: "2026-08-26",
  },
  {
    id: 2,
    name: "Topografi Kawasan Industri Cikarang",
    description: "Pekerjaan pemetaan topografi seluas 120 ha termasuk pengolahan data.",
    type: "Jasa",
    status: "Berjalan",
    priority: "Tinggi",
    priorityMode: "auto",
    progressPct: 40,
    clientOrg: "PT Kawasan Industri Cikarang",
    clientName: "Maya Ratnasari",
    clientEmail: "maya.r@kicikarang.co.id",
    clientPhone: "+62 821-1122-3344",
    clientTier: "Reguler",
    penaltyRisk: "Denda harian",
    value: 450_000_000,
    contractNo: "KTR/KIC/2026/077",
    contractDate: "2026-08-14",
    paymentTerm: "3 Termin",
    paymentNote: "25% mobilisasi, 50% progres 60%, 25% BAST.",
    taxType: "PKP",
    salesFee: 12_000_000,
    operationalCost: 288_000_000,
    startDate: "2026-08-18",
    deadline: "2026-09-05",
    ownerId: 2,
    updatedAt: "2026-08-27",
  },
  {
    id: 3,
    name: "Training Pengolahan Data LiDAR Batch 3",
    description: "Pelatihan 3 hari untuk 20 peserta dari dinas tata ruang.",
    type: "Training",
    status: "Penawaran",
    priority: "Sedang",
    priorityMode: "auto",
    progressPct: 0,
    clientOrg: "Dinas Tata Ruang Kabupaten Bekasi",
    clientName: "Agus Setiawan, S.T.",
    clientEmail: "agus.setiawan@bekasikab.go.id",
    clientPhone: "(021) 8899-7766",
    clientTier: "Baru",
    penaltyRisk: "Teguran",
    value: 145_000_000,
    contractNo: "",
    contractDate: null,
    paymentTerm: "Full",
    paymentNote: "",
    taxType: "Non PKP",
    salesFee: null,
    operationalCost: 96_000_000,
    startDate: "2026-09-22",
    deadline: "2026-10-02",
    ownerId: 4,
    updatedAt: "2026-08-20",
  },
  {
    id: 4,
    name: "Riset Pasar Drone Pemetaan 2026",
    description: "Kajian kompetitor dan tren harga drone pemetaan di segmen enterprise.",
    type: "Riset",
    status: "Prospect",
    priority: "Rendah",
    priorityMode: "manual",
    progressPct: 25,
    // Riset internal: tidak ada PIC luar dan belum ada angka kontrak.
    clientOrg: "Internal — Divisi Enterprise",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientTier: "Internal",
    penaltyRisk: "Tidak ada",
    value: null,
    contractNo: "",
    contractDate: null,
    paymentTerm: "Full",
    paymentNote: "",
    taxType: "Non PKP",
    salesFee: null,
    operationalCost: null,
    startDate: "2026-08-01",
    deadline: "2026-11-15",
    ownerId: 3,
    updatedAt: "2026-08-18",
  },
  {
    id: 5,
    name: "Kalibrasi Total Station Dinas PU Bandung",
    description: "Layanan kalibrasi berkala 15 unit total station beserta sertifikat.",
    type: "Jasa",
    status: "Selesai",
    priority: "Sedang",
    priorityMode: "auto",
    progressPct: 100,
    clientOrg: "Dinas PU Kota Bandung",
    clientName: "Dedi Kurniawan",
    clientEmail: "dedi.k@bandung.go.id",
    clientPhone: "(022) 4231-9080",
    clientTier: "Reguler",
    penaltyRisk: "Tidak ada",
    value: 275_000_000,
    contractNo: "SPK/DPUBDG/2026/019",
    contractDate: "2026-07-20",
    paymentTerm: "Full",
    paymentNote: "",
    taxType: "PKP",
    salesFee: 8_000_000,
    operationalCost: 235_000_000,
    startDate: "2026-07-28",
    deadline: "2026-08-15",
    ownerId: 5,
    updatedAt: "2026-08-15",
  },
  {
    id: 6,
    name: "Tender Sistem Monitoring Deformasi Bendungan",
    description: "Persiapan dokumen tender solusi monitoring deformasi berbasis IoT.",
    type: "Penjualan",
    status: "Negosiasi",
    priority: "Tinggi",
    priorityMode: "auto",
    progressPct: 10,
    clientOrg: "BBWS Citarum",
    clientName: "Ir. Siti Rahmawati, M.T.",
    clientEmail: "siti.rahmawati@pu.go.id",
    clientPhone: "+62 813-9900-1122",
    clientTier: "VIP",
    penaltyRisk: "Putus kontrak",
    value: 980_000_000,
    contractNo: "KTR/BBWS-CTR/2026/004",
    contractDate: "2026-08-18",
    paymentTerm: "Custom",
    paymentNote: "20% uang muka, 5 termin bulanan @14%, retensi 10% dicairkan 6 bulan setelah BAST.",
    taxType: "PKP",
    salesFee: 40_000_000,
    operationalCost: 610_000_000,
    startDate: "2026-08-22",
    deadline: "2026-09-01",
    ownerId: 2,
    updatedAt: "2026-08-25",
  },
  {
    id: 7,
    name: "Training Internal QGIS untuk Tim Sales",
    description: "Sesi upskilling internal agar tim sales paham demo produk GIS.",
    type: "Training",
    status: "Selesai",
    priority: "Rendah",
    priorityMode: "auto",
    progressPct: 100,
    // Upskilling internal: tidak ditagihkan ke siapa pun.
    clientOrg: "Internal — Divisi Sales",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientTier: "Internal",
    penaltyRisk: "Tidak ada",
    value: null,
    contractNo: "",
    contractDate: null,
    paymentTerm: "Full",
    paymentNote: "",
    taxType: "Non PKP",
    salesFee: null,
    operationalCost: 4_500_000,
    startDate: "2026-08-04",
    deadline: "2026-08-08",
    ownerId: 4,
    updatedAt: "2026-08-08",
  },
  {
    id: 8,
    name: "Survei Batimetri Pelabuhan Tanjung Emas",
    description: "Pemeruman kedalaman alur pelayaran dan pembuatan peta batimetri.",
    type: "Jasa",
    status: "Tertunda",
    priority: "Sedang",
    priorityMode: "auto",
    progressPct: 55,
    clientOrg: "PT Pelindo Regional 3",
    clientName: "Capt. Bambang Sujarwo",
    clientEmail: "bambang.s@pelindo.co.id",
    clientPhone: "+62 811-3344-5566",
    clientTier: "Strategis",
    penaltyRisk: "Denda harian",
    value: 505_000_000,
    contractNo: "KTR/PLD3/2026/231",
    contractDate: "2026-08-19",
    paymentTerm: "3 Termin",
    paymentNote: "30% DP, 40% progres 70%, 30% BAST.",
    taxType: "PKP",
    salesFee: 20_000_000,
    operationalCost: 460_000_000,
    startDate: "2026-08-25",
    deadline: "2026-09-28",
    ownerId: 5,
    updatedAt: "2026-08-24",
  },
];

/** Riwayat progres awal; entri baru ditambahkan lewat form di halaman detail. */
export const progressHistory: ProgressEntry[] = [
  { id: 1, projectId: 1, userId: 1, progressPct: 20, note: "Penawaran dikirim ke procurement.", createdAt: "2026-08-12", recordedAt: "2026-08-12 09:00:00" },
  { id: 2, projectId: 1, userId: 1, progressPct: 45, note: "Negosiasi harga selesai, menunggu PO.", createdAt: "2026-08-19", recordedAt: "2026-08-19 09:00:00" },
  { id: 3, projectId: 1, userId: 1, progressPct: 65, note: "PO terbit, unit disiapkan gudang.", createdAt: "2026-08-26", recordedAt: "2026-08-26 09:00:00" },
  { id: 4, projectId: 2, userId: 2, progressPct: 15, note: "Mobilisasi tim dan pemasangan BM.", createdAt: "2026-08-20", recordedAt: "2026-08-20 09:00:00" },
  { id: 5, projectId: 2, userId: 2, progressPct: 40, note: "Pengukuran 50 ha selesai.", createdAt: "2026-08-27", recordedAt: "2026-08-27 09:00:00" },
  { id: 6, projectId: 4, userId: 3, progressPct: 25, note: "Kompilasi data kompetitor tahap awal.", createdAt: "2026-08-05", recordedAt: "2026-08-05 09:00:00" },
  { id: 7, projectId: 8, userId: 5, progressPct: 55, note: "Pemeruman jalur utama rampung.", createdAt: "2026-08-24", recordedAt: "2026-08-24 09:00:00" },
];

export function getUser(id: number): User | undefined {
  return users.find((u) => u.id === id);
}

/** Pengingat yang sudah pernah dikirim; bertambah lewat form di halaman detail. */
export const reminders: Reminder[] = [
  {
    id: 1,
    projectId: 4,
    toUserId: 3,
    fromUserId: 1,
    message: "Mohon update progres riset, sudah tiga minggu tidak ada catatan.",
    channel: "in-app",
    createdAt: "2026-08-26",
    sentAt: "2026-08-26 10:15:00",
  },
];

/** Jadwal pengingat berulang; diatur lewat form di halaman detail. */
export const reminderSchedules: ReminderSchedule[] = [
  {
    id: 1,
    projectId: 4,
    toUserId: 3,
    frequency: "mingguan",
    nextAt: "2026-09-02",
    isActive: true,
    createdAt: "2026-08-26",
  },
];

/** Komentar awal; entri baru ditambahkan lewat form di halaman detail. */
export const comments: ProjectComment[] = [
  {
    id: 1,
    projectId: 6,
    userId: 1,
    body: "Klien minta rincian biaya perawatan tahunan sebelum tanda tangan.",
    createdAt: "2026-08-25",
    postedAt: "2026-08-25 14:20:00",
  },
  {
    id: 2,
    projectId: 6,
    userId: 2,
    body: "Sudah disiapkan, menunggu konfirmasi harga dari vendor sensor.",
    createdAt: "2026-08-26",
    postedAt: "2026-08-26 09:05:00",
  },
  {
    id: 3,
    projectId: 2,
    userId: 5,
    body: "Tim lapangan butuh tambahan satu surveyor minggu depan.",
    createdAt: "2026-08-27",
    postedAt: "2026-08-27 16:40:00",
  },
];

/**
 * Kredensial masuk. Hanya akun uji yang punya sandi; anggota lain belum bisa
 * masuk sampai pendaftaran ada.
 *
 * Hash di bawah untuk sandi "admin123" dan memang ikut ke repositori — itulah
 * sebabnya `devOnly: true`, sehingga ditolak saat NODE_ENV=production.
 */
export const credentials: Credential[] = [
  {
    userId: 6,
    passwordHash:
      "scrypt$16384$8$1$dad6019acaeff8be525e59be5056931f$66cf33bf9ffaba38ca1da809b94033bd947b988d81472e1c4eb4d5cb62bdf852b5c93b78a5e5b7ccdabc41e9177a95bf3b1ca0d67a7b39cbc21b2e54d00d448d",
    devOnly: true,
  },
];

/**
 * Ketergantungan antar proyek: blockerId menahan blockedId.
 *
 * Tender Bendungan (6) menahan tiga proyek sekaligus — dokumen tendernya jadi
 * prasyarat pekerjaan lain, jadi parameter Ketergantungan benar-benar terpakai
 * di skor tertingginya.
 */
export const projectDependencies: ProjectDependency[] = [
  { blockerId: 6, blockedId: 1 },
  { blockerId: 6, blockedId: 2 },
  { blockerId: 6, blockedId: 8 },
  // Riset pasar menahan satu proyek training.
  { blockerId: 4, blockedId: 3 },
];
