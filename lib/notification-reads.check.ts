/**
 * Cek mandiri status baca notifikasi: `npx tsx lib/notification-reads.check.ts`
 * Semua fungsi murni, jadi bisa diuji tanpa peramban.
 */
import assert from "node:assert/strict";
import type { Notification } from "./notifications";
import {
  type ReadState,
  isUnread,
  markAllRead,
  markRead,
  markUnread,
  prune,
  signature,
  unreadCount,
} from "./notification-reads";

function n(id: string, date: string): Notification {
  return {
    id,
    kind: "segera",
    severity: "sedang",
    projectId: 1,
    projectName: "P1",
    ownerId: 1,
    title: "Jatuh tempo",
    detail: "",
    date,
  };
}

const a = n("segera-1", "2026-09-01");
const b = n("mandek-2", "2026-08-05");
const kosong: ReadState = {};

// Belum pernah ditandai = belum dibaca.
assert.equal(isUnread(a, kosong), true);
assert.equal(unreadCount([a, b], kosong), 2);

// Setelah ditandai, jadi terbaca — dan hanya yang ditandai.
const satu = markRead(a, kosong);
assert.equal(isUnread(a, satu), false);
assert.equal(isUnread(b, satu), true);
assert.equal(unreadCount([a, b], satu), 1);

// markRead tidak mengubah objek asal.
assert.deepEqual(kosong, {});

// Tandai semua sekaligus.
const semua = markAllRead([a, b], kosong);
assert.equal(unreadCount([a, b], semua), 0);

// Keadaan berubah (tenggat digeser) membuatnya belum dibaca lagi.
const aGeser = n("segera-1", "2026-09-10");
assert.equal(isUnread(aGeser, semua), true);
// Tanda tangan mengikuti tanggal kejadian, bukan judulnya.
assert.equal(signature(a), "2026-09-01");
assert.notEqual(signature(a), signature(aGeser));

// Judul berubah tapi tanggalnya sama: tetap terbaca, tidak berkedip tiap hari.
const aJudulBaru: Notification = { ...a, title: "Jatuh tempo 2 hari lagi" };
assert.equal(isUnread(aJudulBaru, semua), false);

// Bisa dikembalikan jadi belum dibaca.
const dibalik = markUnread(a, semua);
assert.equal(isUnread(a, dibalik), true);
assert.equal(isUnread(b, dibalik), false);
// Menandai belum untuk yang memang belum tidak menimbulkan error.
assert.deepEqual(markUnread(a, kosong), {});

// prune membuang catatan notifikasi yang sudah tidak muncul lagi.
const dibersihkan = prune([a], semua);
assert.deepEqual(Object.keys(dibersihkan), ["segera-1"]);
assert.deepEqual(prune([], semua), {});
assert.deepEqual(prune([a, b], semua), semua);

// Daftar kosong aman.
assert.equal(unreadCount([], kosong), 0);
assert.deepEqual(markAllRead([], kosong), {});

console.log("ok: notification-reads");
