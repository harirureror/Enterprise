/* Pilihan kolom tabel daftar proyek, disimpan per peramban.

   Bukan di database: ini preferensi tampilan satu orang di satu perangkat,
   sama sifatnya dengan tema — dan menyimpannya di server berarti menambah
   tabel serta perjalanan bolak-balik hanya untuk menyembunyikan sebuah kolom.

   Fungsi murninya dipisah dari jembatan React di bawah supaya aturannya bisa
   diuji tanpa peramban sama sekali, mengikuti pola lib/notification-reads.ts. */

export const STORAGE_KEY = "jsi.kolom-proyek.v1";

export type ColumnKey =
  | "jenis"
  | "status"
  | "prioritas"
  | "pic"
  | "tenggat"
  | "progres"
  | "kontrak"
  | "nilai"
  | "margin";

/**
 * Kolom yang bisa disembunyikan, berikut urutannya di tabel.
 *
 * Kolom nama proyek dan kolom aksi sengaja tidak ada di sini: keduanya selalu
 * tampil, jadi tabelnya tidak pernah bisa dikosongkan sampai tak berguna.
 */
export const PROJECT_COLUMNS: { key: ColumnKey; label: string; default: boolean }[] = [
  { key: "jenis", label: "Jenis", default: true },
  { key: "status", label: "Status", default: true },
  { key: "prioritas", label: "Prioritas", default: true },
  { key: "pic", label: "PIC", default: true },
  { key: "tenggat", label: "Tenggat", default: true },
  { key: "progres", label: "Progres", default: true },
  { key: "kontrak", label: "No Kontrak", default: true },
  // Dua kolom uang mati secara bawaan: berguna, tapi tabelnya sudah padat dan
  // tidak semua orang mengurus sisi keuangan.
  { key: "nilai", label: "Nilai Kontrak", default: false },
  { key: "margin", label: "Margin", default: false },
];

export type ColumnState = Record<ColumnKey, boolean>;

export const COLUMN_KEYS = PROJECT_COLUMNS.map((c) => c.key);

export function defaultColumns(): ColumnState {
  return Object.fromEntries(PROJECT_COLUMNS.map((c) => [c.key, c.default])) as ColumnState;
}

function isColumnKey(nilai: string): nilai is ColumnKey {
  return (COLUMN_KEYS as string[]).includes(nilai);
}

/**
 * Gabungkan pilihan tersimpan di atas default.
 *
 * Sengaja tidak memakai nilai tersimpan mentah-mentah: kolom yang ditambahkan
 * belakangan tidak ada di data lama, dan kalau dianggap `false` ia akan hilang
 * diam-diam dari tabel setiap orang yang pernah membuka pemilih kolom.
 */
export function mergeColumns(tersimpan: unknown): ColumnState {
  const hasil = defaultColumns();
  if (typeof tersimpan !== "object" || tersimpan === null || Array.isArray(tersimpan)) {
    return hasil;
  }

  for (const [kunci, nilai] of Object.entries(tersimpan as Record<string, unknown>)) {
    // Kunci asing diabaikan, bukan diteruskan — isi localStorage bisa apa saja.
    if (isColumnKey(kunci) && typeof nilai === "boolean") hasil[kunci] = nilai;
  }
  return hasil;
}

export function toggleColumn(state: ColumnState, key: ColumnKey): ColumnState {
  return { ...state, [key]: !state[key] };
}

/** Berapa kolom opsional yang sedang tampil. */
export function visibleCount(state: ColumnState): number {
  return COLUMN_KEYS.filter((k) => state[k]).length;
}

/** Baca dari localStorage. Selalu aman: mode privat pun jatuh ke default. */
export function loadColumns(): ColumnState {
  try {
    const mentah = window.localStorage.getItem(STORAGE_KEY);
    if (!mentah) return defaultColumns();
    return mergeColumns(JSON.parse(mentah));
  } catch {
    // JSON rusak atau penyimpanan diblokir: tampilkan susunan bawaan.
    return defaultColumns();
  }
}

export function saveColumns(state: ColumnState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Penyimpanan penuh atau diblokir: pilihannya tetap berlaku di halaman ini,
    // hanya tidak bertahan sampai kunjungan berikutnya.
  }
}

/* --- Jembatan ke React ---------------------------------------------------
   Dibungkus external store supaya komponen memakai useSyncExternalStore:
   localStorage memang sistem di luar React, dan membacanya lewat useEffect +
   setState memicu render bertingkat (dan melanggar react-hooks/set-state-in-effect). */

let cache: ColumnState | null = null;
const listeners = new Set<() => void>();

export function subscribeColumns(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Snapshot di klien. Referensinya tetap sama sampai ada perubahan. */
export function columnsSnapshot(): ColumnState {
  cache ??= loadColumns();
  return cache;
}

/**
 * Di server localStorage belum ada. Dikembalikan `null` — "belum diketahui",
 * bukan "kosong" — supaya pemanggil sadar sedang memakai susunan bawaan dan
 * tidak menganggapnya pilihan orang.
 */
export function serverColumns(): null {
  return null;
}

export function setColumns(next: ColumnState): void {
  cache = next;
  saveColumns(next);
  for (const l of listeners) l();
}
