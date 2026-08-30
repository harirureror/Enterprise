/**
 * Cek mandiri validasi komentar: `npx tsx lib/comment-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/reminder-form.check.ts.
 */
import assert from "node:assert/strict";
import {
  COMMENT_MAX,
  COMMENT_MIN,
  emptyCommentDraft,
  validateComment,
} from "./comment-form";

const cek = (body: string) => validateComment({ body });

// Komentar wajar lolos.
assert.deepEqual(cek("Vendor sudah konfirmasi harga."), {});

// Kosong dan spasi saja sama-sama ditolak.
assert.equal(cek("").body, "Komentar tidak boleh kosong.");
assert.equal(cek("      ").body, "Komentar tidak boleh kosong.");
assert.equal(cek("\n\n").body, "Komentar tidak boleh kosong.");

// Batas bawah dan atas dihitung setelah dipangkas.
assert.ok(cek("A".repeat(COMMENT_MIN - 1)).body);
assert.deepEqual(cek("A".repeat(COMMENT_MIN)), {});
assert.deepEqual(cek("A".repeat(COMMENT_MAX)), {});
assert.ok(cek("A".repeat(COMMENT_MAX + 1)).body);
// Spasi pinggir tidak membuat komentar terlalu panjang jadi lolos.
assert.ok(cek("  " + "A".repeat(COMMENT_MAX + 1) + "  ").body);

// Draft kosong memang belum valid, jadi form baru tidak bisa langsung dikirim.
assert.ok(validateComment(emptyCommentDraft()).body);

// Komentar berbaris banyak tetap sah.
assert.deepEqual(cek("Baris pertama.\nBaris kedua."), {});

console.log("ok: comment-form");
