import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectType,
} from "./types";

/* Satu definisi filter daftar proyek, dipakai halaman, komponen klien, dan
   GET /api/projects — supaya "Semua" berarti hal yang sama di mana-mana. */

/** Nilai netral: tidak menyaring pada kolom itu. */
export const SEMUA = "Semua";
export type Semua = typeof SEMUA;

export type ProjectFilter = {
  status: ProjectStatus | Semua;
  priority: ProjectPriority | Semua;
  type: ProjectType | Semua;
  ownerId: number | Semua;
  /** Kata kunci untuk nama dan deskripsi. String kosong = tidak menyaring. */
  q: string;
};

export const FILTER_KOSONG: ProjectFilter = {
  status: SEMUA,
  priority: SEMUA,
  type: SEMUA,
  ownerId: SEMUA,
  q: "",
};

/** Terapkan filter. Field yang tidak disebut dianggap "Semua". */
export function filterProjects(
  projects: Project[],
  filter: Partial<ProjectFilter> = {}
): Project[] {
  const { status, priority, type, ownerId, q } = { ...FILTER_KOSONG, ...filter };
  const kata = q.trim().toLowerCase();

  return projects.filter(
    (p) =>
      (status === SEMUA || p.status === status) &&
      (priority === SEMUA || p.priority === priority) &&
      (type === SEMUA || p.type === type) &&
      (ownerId === SEMUA || p.ownerId === ownerId) &&
      // Mencari lewat instansi, PIC klien, atau nomor kontrak sama wajarnya
      // dengan lewat nama proyek — semuanya cara orang mengingat satu proyek.
      (kata === "" ||
        p.name.toLowerCase().includes(kata) ||
        p.description.toLowerCase().includes(kata) ||
        p.clientOrg.toLowerCase().includes(kata) ||
        p.locationCity.toLowerCase().includes(kata) ||
        p.locationProvince.toLowerCase().includes(kata) ||
        p.clientName.toLowerCase().includes(kata) ||
        p.contractNo.toLowerCase().includes(kata))
  );
}

export type ParsedFilter = {
  filter: ProjectFilter;
  /** Nama parameter yang nilainya tidak dikenal; pemanggil boleh membalas 400. */
  invalid: string[];
};

/**
 * Baca filter dari query string. Parameter yang kosong atau tidak ada
 * dianggap "Semua"; nilai di luar daftar yang sah dilaporkan lewat `invalid`
 * supaya salah ketik tidak diam-diam mengembalikan seluruh proyek.
 */
export function parseProjectFilter(params: URLSearchParams): ParsedFilter {
  const invalid: string[] = [];

  function pilih<T extends string>(key: string, sah: T[]): T | Semua {
    const nilai = params.get(key)?.trim();
    if (!nilai || nilai === SEMUA) return SEMUA;
    if ((sah as string[]).includes(nilai)) return nilai as T;
    invalid.push(key);
    return SEMUA;
  }

  const ownerRaw = params.get("ownerId")?.trim();
  let ownerId: number | Semua = SEMUA;
  if (ownerRaw && ownerRaw !== SEMUA) {
    // Harus bilangan bulat positif; "3.5" dan "abc" sama-sama ditolak.
    if (/^\d+$/.test(ownerRaw)) ownerId = Number(ownerRaw);
    else invalid.push("ownerId");
  }

  return {
    filter: {
      status: pilih("status", PROJECT_STATUSES),
      priority: pilih("priority", PROJECT_PRIORITIES),
      type: pilih("type", PROJECT_TYPES),
      ownerId,
      q: params.get("q")?.trim() ?? "",
    },
    invalid,
  };
}
