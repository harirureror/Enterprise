/**
 * Cek mandiri validasi isian aktivitas: `npx tsx lib/activity-form.check.ts`
 */
import assert from "node:assert/strict";
import {
  NAME_MAX,
  NAME_MIN,
  SLA_MAX,
  type ActivityDraft,
  activityToDraft,
  draftToActivity,
  emptyActivityDraft,
  validateActivity,
} from "./activity-form";
import type { ProjectActivity } from "./types";

const d = (over: Partial<ActivityDraft> = {}): ActivityDraft => ({
  ...emptyActivityDraft(),
  name: "Penawaran dikirim",
  ...over,
});

/* --- Isian yang benar ------------------------------------------------------- */

assert.deepEqual(validateActivity(d()), {});
assert.deepEqual(validateActivity(d({ slaDays: "14", targetDate: "2026-10-01" })), {});
// Bobot nol sah: ada aktivitas penanda yang memang tidak menyumbang progres.
assert.deepEqual(validateActivity(d({ weight: "0" })), {});

/* --- Nama ------------------------------------------------------------------- */

assert.ok(validateActivity(d({ name: "" })).name);
assert.ok(validateActivity(d({ name: "   " })).name, "spasi saja sama dengan kosong");
assert.ok(validateActivity(d({ name: "a".repeat(NAME_MIN - 1) })).name);
assert.deepEqual(validateActivity(d({ name: "a".repeat(NAME_MIN) })), {});
assert.deepEqual(validateActivity(d({ name: "a".repeat(NAME_MAX) })), {});
assert.ok(validateActivity(d({ name: "a".repeat(NAME_MAX + 1) })).name);

/* --- Bobot ------------------------------------------------------------------ */

assert.ok(validateActivity(d({ weight: "" })).weight);
assert.ok(validateActivity(d({ weight: "10,5" })).weight, "bukan angka");
assert.ok(validateActivity(d({ weight: "10.5" })).weight, "harus bulat");
assert.ok(validateActivity(d({ weight: "-1" })).weight);
assert.ok(validateActivity(d({ weight: "101" })).weight);
assert.deepEqual(validateActivity(d({ weight: "100" })), {});

/* --- Status ----------------------------------------------------------------- */

assert.ok(validateActivity(d({ status: "Konsultasi" })).status);
assert.deepEqual(validateActivity(d({ status: "Selesai" })), {});

/* --- Tenggat tindak lanjut -------------------------------------------------- */

// Kosong berarti tidak ada tenggat, bukan salah isi.
assert.deepEqual(validateActivity(d({ slaDays: "" })), {});
assert.ok(validateActivity(d({ slaDays: "0" })).slaDays, "nol hari tidak berarti apa-apa");
assert.ok(validateActivity(d({ slaDays: "-3" })).slaDays);
assert.ok(validateActivity(d({ slaDays: "7.5" })).slaDays);
assert.deepEqual(validateActivity(d({ slaDays: String(SLA_MAX) })), {});
assert.ok(validateActivity(d({ slaDays: String(SLA_MAX + 1) })).slaDays);

/* --- Tanggal target --------------------------------------------------------- */

assert.deepEqual(validateActivity(d({ targetDate: "" })), {});
assert.ok(validateActivity(d({ targetDate: "2026-02-30" })).targetDate, "tanggal mustahil");
assert.ok(validateActivity(d({ targetDate: "bukan tanggal" })).targetDate);

// Template tidak punya tanggal target — tanggal milik proyek, bukan cetakannya —
// jadi isian yang salah pun tidak dipersoalkan di sana.
assert.deepEqual(validateActivity(d({ targetDate: "2026-02-30" }), { template: true }), {});

/* --- draftToActivity -------------------------------------------------------- */

const jadi = draftToActivity(
  d({ name: "  Penawaran dikirim  ", weight: "20", slaDays: "14", targetDate: "2026-10-01" })
);
assert.equal(jadi.name, "Penawaran dikirim", "nama dirapikan");
assert.equal(jadi.weight, 20);
assert.equal(jadi.slaDays, 14);
assert.equal(jadi.targetDate, "2026-10-01");
// Aktivitas baru selalu belum selesai; mencentang punya jalurnya sendiri.
assert.equal(jadi.doneDate, null);
assert.equal(jadi.doneBy, null);

// Kosong jadi null, bukan 0 atau "" — keduanya berarti hal yang berbeda.
const kosong = draftToActivity(d({ slaDays: "", targetDate: "" }));
assert.equal(kosong.slaDays, null);
assert.equal(kosong.targetDate, null);

/* --- Bolak-balik ------------------------------------------------------------ */

const tersimpan: ProjectActivity = {
  id: 5,
  projectId: 3,
  name: "Negosiasi lingkup",
  weight: 15,
  status: "Negosiasi",
  slaDays: 7,
  targetDate: "2026-11-02",
  doneDate: "2026-10-30",
  doneBy: 2,
  sortOrder: 2,
};
const pulang = draftToActivity(activityToDraft(tersimpan));
assert.equal(pulang.name, tersimpan.name);
assert.equal(pulang.weight, tersimpan.weight);
assert.equal(pulang.status, tersimpan.status);
assert.equal(pulang.slaDays, tersimpan.slaDays);
assert.equal(pulang.targetDate, tersimpan.targetDate);

// Aktivitas tanpa tenggat pulang tanpa tenggat, bukan dengan "null" sebagai teks.
assert.equal(activityToDraft({ ...tersimpan, slaDays: null, targetDate: null }).slaDays, "");
assert.equal(activityToDraft({ ...tersimpan, slaDays: null, targetDate: null }).targetDate, "");

console.log("ok: activity-form");
