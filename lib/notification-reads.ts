import type { Notification } from "./notifications";

/* Status "sudah dibaca" disimpan per peramban, bukan di database.
   Alasannya: notifikasi di sini diturunkan dari keadaan proyek dan belum ada
   autentikasi (fase 4), jadi belum ada "siapa" yang bisa dijadikan pemilik
   status baca. Fungsinya dipisah ke sini supaya aturannya bisa diuji tanpa
   peramban sama sekali.

   ponytail: setelah login jadi, ganti penyimpanannya ke tabel
   (user_id, notification_id, signature) — bentuk datanya sudah sama. */

export const STORAGE_KEY = "jsi.notifikasi.dibaca.v1";

/** id notifikasi → tanda tangan keadaan saat ditandai dibaca. */
export type ReadState = Record<string, string>;

/**
 * Tanda tangan sebuah notifikasi. Memakai `date` — tanggal kejadian yang
 * mendasarinya — bukan judulnya, supaya notifikasi tidak berubah jadi "belum
 * dibaca" tiap hari hanya karena kalimatnya ikut berubah ("4 hari lagi" jadi
 * "3 hari lagi"). Kalau tenggatnya digeser atau ada catatan progres baru,
 * tanda tangannya berubah dan notifikasinya memang layak dilihat lagi.
 *
 * Naik tingkat (segera → terlambat) tidak perlu ditangani di sini: `id`-nya
 * ikut berubah, jadi otomatis terhitung notifikasi baru.
 */
export function signature(n: Notification): string {
  return n.date;
}

export function isUnread(n: Notification, read: ReadState): boolean {
  return read[n.id] !== signature(n);
}

export function unreadCount(items: Notification[], read: ReadState): number {
  return items.filter((n) => isUnread(n, read)).length;
}

/** Tandai satu notifikasi terbaca pada keadaannya sekarang. */
export function markRead(n: Notification, read: ReadState): ReadState {
  return { ...read, [n.id]: signature(n) };
}

export function markAllRead(items: Notification[], read: ReadState): ReadState {
  return items.reduce((acc, n) => markRead(n, acc), read);
}

/** Kebalikannya, supaya pengguna bisa memunculkan lagi satu notifikasi. */
export function markUnread(n: Notification, read: ReadState): ReadState {
  const sisanya = { ...read };
  delete sisanya[n.id];
  return sisanya;
}

/**
 * Buang catatan untuk notifikasi yang sudah tidak muncul lagi, supaya
 * penyimpanannya tidak menumpuk selamanya.
 */
export function prune(items: Notification[], read: ReadState): ReadState {
  const hidup = new Set(items.map((n) => n.id));
  return Object.fromEntries(Object.entries(read).filter(([id]) => hidup.has(id)));
}

/** Baca dari localStorage. Selalu aman: mode privat pun hanya menghasilkan {}. */
export function loadReadState(): ReadState {
  try {
    const mentah = window.localStorage.getItem(STORAGE_KEY);
    if (!mentah) return {};
    const isi: unknown = JSON.parse(mentah);
    if (typeof isi !== "object" || isi === null || Array.isArray(isi)) return {};
    return Object.fromEntries(
      Object.entries(isi as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    );
  } catch {
    return {};
  }
}

export function saveReadState(read: ReadState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(read));
  } catch {
    // Penyimpanan penuh atau diblokir: indikatornya jadi tidak persisten,
    // tapi daftarnya tetap bisa dipakai.
  }
}

/* --- Jembatan ke React ---------------------------------------------------
   Dibungkus sebagai external store supaya komponen bisa memakai
   useSyncExternalStore: localStorage memang sistem di luar React, dan
   membacanya lewat useEffect + setState akan memicu render bertingkat. */

let cache: ReadState | null = null;
const listeners = new Set<() => void>();

export function subscribeReadState(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Snapshot di klien. Referensinya dijaga tetap sama sampai ada perubahan. */
export function readStateSnapshot(): ReadState {
  cache ??= loadReadState();
  return cache;
}

/**
 * Di server localStorage belum ada, jadi statusnya "belum diketahui" — bukan
 * "kosong". Bedanya penting: kalau dianggap kosong, semua notifikasi terlihat
 * belum dibaca saat render server lalu berkedip begitu hidrasi selesai.
 */
export function serverReadState(): null {
  return null;
}

export function setReadState(next: ReadState): void {
  cache = next;
  saveReadState(next);
  for (const l of listeners) l();
}
