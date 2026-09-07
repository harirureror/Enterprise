import { ACCESS_LEVELS, type AccessLevel, type AgendaEntry, type Project, type User } from "./types";

/* Siapa boleh apa.

   Seluruh matriksnya ditulis sekali di sini sebagai fungsi murni — tanpa React,
   tanpa akses data, tanpa cookie — supaya bisa diuji seluruhnya tanpa peramban
   maupun database, dan supaya pertanyaan "kenapa dia tidak bisa menekan tombol
   itu?" dijawab satu berkas, bukan hasil menyisir belasan komponen.

   Yang di sini hanya keputusannya. Penegakannya ada di lib/auth.ts (halaman),
   lib/actions.ts (server action), dan route handler. */

export type Ability =
  // Melihat
  | "lihat-daftar"
  | "lihat-overview"
  | "lihat-detail"
  | "lihat-tim"
  | "lihat-notifikasi"
  | "lihat-keuangan"
  // Menindaklanjuti tanpa mengubah data proyek.
  | "kolaborasi"
  // Mengubah
  | "ubah-semua-proyek"
  | "ubah-proyek-sendiri"
  | "buat-proyek"
  | "hapus-proyek"
  | "kelola-jenis"
  | "kelola-pengguna"
  | "ekspor"
  // Agenda
  | "lihat-agenda"
  | "isi-agenda-sendiri"
  | "isi-agenda-orang-lain"
  // Rencana strategis
  | "lihat-rencana"
  | "kelola-rencana";

export const ABILITIES: Ability[] = [
  "lihat-daftar",
  "lihat-overview",
  "lihat-detail",
  "lihat-tim",
  "lihat-notifikasi",
  "lihat-keuangan",
  "kolaborasi",
  "ubah-semua-proyek",
  "ubah-proyek-sendiri",
  "buat-proyek",
  "hapus-proyek",
  "kelola-jenis",
  "kelola-pengguna",
  "ekspor",
  "lihat-agenda",
  "isi-agenda-sendiri",
  "isi-agenda-orang-lain",
  "lihat-rencana",
  "kelola-rencana",
];

/**
 * Matriks kesepakatan. Ditulis per peran, bukan per kemampuan, supaya bisa
 * dibaca sebagai "apa saja yang boleh dilakukan orang ini".
 */
export const MATRIX: Record<AccessLevel, readonly Ability[]> = {
  // Semuanya, termasuk satu-satunya yang boleh mengelola akun.
  Admin: ABILITIES,

  // Pengawas: melihat seluruhnya termasuk angka untung-rugi, tapi tidak
  // menyentuh data proyek. Tetap bisa berkomentar dan menegur lewat pengingat —
  // itulah cara dia menindaklanjuti apa yang dilihatnya.
  Owner: [
    "lihat-daftar",
    "lihat-overview",
    "lihat-detail",
    "lihat-tim",
    "lihat-notifikasi",
    "lihat-keuangan",
    "kolaborasi",
    "ekspor",
    "lihat-agenda",
    "lihat-rencana",
  ],

  // Mengurus orang, bukan pekerjaan: cukup tahu proyek apa yang jalan dan siapa
  // sedang di mana. Tanpa angka keuangan, dan tanpa halaman detail — jadi tidak
  // punya tempat untuk berkomentar.
  HR: ["lihat-daftar", "ekspor", "lihat-agenda", "lihat-rencana"],

  // Menjalankan divisi: seluruh proyek boleh dia ubah, dan dia boleh mengisikan
  // agenda anggotanya. Yang tidak boleh hanya mengelola akun.
  Manager: [
    "lihat-daftar",
    "lihat-overview",
    "lihat-detail",
    "lihat-tim",
    "lihat-notifikasi",
    "lihat-keuangan",
    "kolaborasi",
    "ubah-semua-proyek",
    "ubah-proyek-sendiri",
    "buat-proyek",
    "hapus-proyek",
    "kelola-jenis",
    "ekspor",
    "lihat-agenda",
    "isi-agenda-sendiri",
    "isi-agenda-orang-lain",
    "lihat-rencana",
    "kelola-rencana",
  ],

  // Pelaksana: melihat semuanya supaya bisa berkoordinasi, tapi hanya mengubah
  // proyek yang dia pegang. Angka keuangan bukan urusannya.
  Anggota: [
    "lihat-daftar",
    "lihat-overview",
    "lihat-detail",
    "lihat-tim",
    "lihat-notifikasi",
    "kolaborasi",
    "ubah-proyek-sendiri",
    "ekspor",
    "lihat-agenda",
    "isi-agenda-sendiri",
    "lihat-rencana",
  ],
};

export function can(level: AccessLevel, ability: Ability): boolean {
  return MATRIX[level].includes(ability);
}

/**
 * Boleh mengubah proyek ini?
 *
 * Menggabungkan dua kemampuan yang selalu diperiksa bersamaan: "boleh mengubah
 * apa pun" dan "boleh mengubah yang dia pegang". Dipusatkan di sini supaya
 * tidak ada pemanggil yang lupa cabang keduanya.
 */
export function canEditProject(
  user: Pick<User, "id" | "accessLevel">,
  project: Pick<Project, "ownerId">
): boolean {
  if (can(user.accessLevel, "ubah-semua-proyek")) return true;
  return can(user.accessLevel, "ubah-proyek-sendiri") && project.ownerId === user.id;
}

/** Boleh mengubah agenda ini? Bentuknya sama persis dengan canEditProject. */
export function canEditAgenda(
  user: Pick<User, "id" | "accessLevel">,
  entry: Pick<AgendaEntry, "userId">
): boolean {
  if (can(user.accessLevel, "isi-agenda-orang-lain")) return true;
  return can(user.accessLevel, "isi-agenda-sendiri") && entry.userId === user.id;
}

/**
 * Kolom keuangan, satu daftar untuk semua tempat yang perlu menyensornya:
 * halaman detail, tabel, form, berkas ekspor, dan balasan API.
 *
 * Penyensoran TIDAK dilakukan dengan menimpa nilainya jadi `null` — di sistem
 * ini `null` sudah berarti "belum diisi", jadi menimpanya akan berbohong soal
 * kelengkapan data. Yang dilakukan: kolomnya tidak dirender, tidak dibentuk,
 * dan kuncinya dihapus dari JSON.
 */
export const FINANCE_FIELDS = [
  "value",
  "salesFee",
  "operationalCost",
  "revenueBase",
  "margin",
  "marginPct",
] as const;

export type FinanceField = (typeof FINANCE_FIELDS)[number];

export function isFinanceField(key: string): key is FinanceField {
  return (FINANCE_FIELDS as readonly string[]).includes(key);
}

/** Buang kunci keuangan dari sebuah objek. Dipakai balasan API. */
export function redactFinance<T extends Record<string, unknown>>(row: T): Partial<T> {
  const bersih: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!isFinanceField(k)) bersih[k] = v;
  }
  return bersih as Partial<T>;
}

/**
 * Halaman pertama tiap peran.
 *
 * HR tidak punya Overview, jadi mengantarnya ke "/" hanya akan memantulkannya
 * kembali. Dipakai juga saat seseorang membuka halaman yang bukan haknya:
 * dialihkan ke tempat yang memang boleh dia buka, bukan ke halaman kosong.
 */
export function landingPath(level: AccessLevel): string {
  return can(level, "lihat-overview") ? "/" : "/proyek";
}

export function isAccessLevel(nilai: unknown): nilai is AccessLevel {
  return typeof nilai === "string" && (ACCESS_LEVELS as string[]).includes(nilai);
}
