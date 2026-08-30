/**
 * Cek mandiri validasi keterangan jenis: `npx tsx lib/type-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/project-form.check.ts.
 */
import assert from "node:assert/strict";
import { LABEL_MAX, TYPE_DESCRIPTION_MAX, type TypeDraft, validateTypeDraft } from "./type-form";
import { PROJECT_TYPES } from "./types";

function draft(over: Partial<TypeDraft> = {}): TypeDraft {
  return { label: "Jasa", description: "Pekerjaan survei.", sortOrder: "1", ...over };
}

const cek = (over: Partial<TypeDraft> = {}) => validateTypeDraft(draft(over));

// Isian benar tidak menghasilkan pesan.
assert.deepEqual(cek(), {});

// Label wajib dan ada batas panjang; spasi saja tidak dihitung.
assert.ok(cek({ label: "" }).label);
assert.ok(cek({ label: "   " }).label);
assert.equal(cek({ label: "A".repeat(LABEL_MAX) }).label, undefined);
assert.ok(cek({ label: "A".repeat(LABEL_MAX + 1) }).label);

// Keterangan boleh kosong.
assert.equal(cek({ description: "" }).description, undefined);
assert.equal(cek({ description: "A".repeat(TYPE_DESCRIPTION_MAX) }).description, undefined);
assert.ok(cek({ description: "A".repeat(TYPE_DESCRIPTION_MAX + 1) }).description);

// Urutan: bilangan bulat dalam rentang jumlah jenis yang ada.
assert.equal(cek({ sortOrder: "0" }).sortOrder, undefined);
assert.equal(cek({ sortOrder: String(PROJECT_TYPES.length - 1) }).sortOrder, undefined);
assert.ok(cek({ sortOrder: "" }).sortOrder);
assert.ok(cek({ sortOrder: "-1" }).sortOrder);
assert.ok(cek({ sortOrder: String(PROJECT_TYPES.length) }).sortOrder);
assert.ok(cek({ sortOrder: "1.5" }).sortOrder);
assert.ok(cek({ sortOrder: "kedua" }).sortOrder);

// Semua kesalahan dilaporkan sekaligus, bukan satu per satu.
assert.deepEqual(
  Object.keys(validateTypeDraft({ label: "", description: "", sortOrder: "x" })).sort(),
  ["label", "sortOrder"]
);

console.log("ok: type-form");
