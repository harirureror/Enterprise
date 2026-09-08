/**
 * Cek mandiri validasi catatan perkembangan:
 * `npx tsx lib/progress-form.check.ts`
 */
import assert from "node:assert/strict";
import {
  NOTE_MAX,
  NOTE_MIN,
  emptyProgressDraft,
  validateProgress,
} from "./progress-form";

// Draft kosong: catatannya wajib, jadi ini belum sah.
assert.deepEqual(emptyProgressDraft(), { note: "" });
assert.ok(validateProgress({ note: "" }).note, "catatan kosong ditolak");
assert.ok(validateProgress({ note: "   " }).note, "spasi saja sama dengan kosong");

// Terlalu pendek tidak menceritakan apa pun.
assert.ok(validateProgress({ note: "a".repeat(NOTE_MIN - 1) }).note);
assert.deepEqual(validateProgress({ note: "a".repeat(NOTE_MIN) }), {});

assert.deepEqual(validateProgress({ note: "a".repeat(NOTE_MAX) }), {});
assert.ok(validateProgress({ note: "a".repeat(NOTE_MAX + 1) }).note);

// Panjang dihitung setelah dipangkas, bukan sebelum.
assert.deepEqual(validateProgress({ note: `  ${"a".repeat(NOTE_MAX)}  ` }), {});

assert.deepEqual(validateProgress({ note: "Data lapangan selesai, tinggal pengolahan." }), {});

console.log("ok: progress-form");
