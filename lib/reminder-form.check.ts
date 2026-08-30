/**
 * Cek mandiri validasi pengingat: `npx tsx lib/reminder-form.check.ts`
 * ponytail: assert polos, sejalan dengan lib/progress-form.check.ts.
 */
import assert from "node:assert/strict";
import {
  MESSAGE_MAX,
  MESSAGE_MIN,
  REMINDER_TEMPLATES,
  emptyReminderDraft,
  validateReminder,
} from "./reminder-form";

const cek = (message: string) => validateReminder({ message });

// Pesan wajar lolos.
assert.deepEqual(cek("Mohon perbarui progres proyek ini."), {});

// Wajib diisi; spasi saja tidak dihitung sebagai isi.
assert.ok(cek("").message);
assert.ok(cek("     ").message);
assert.equal(cek("").message, "Pesan pengingat wajib diisi.");

// Batas bawah dan atas, dihitung setelah dipangkas.
assert.ok(cek("A".repeat(MESSAGE_MIN - 1)).message);
assert.deepEqual(cek("A".repeat(MESSAGE_MIN)), {});
assert.deepEqual(cek("A".repeat(MESSAGE_MAX)), {});
assert.ok(cek("A".repeat(MESSAGE_MAX + 1)).message);
// Spasi pinggir tidak boleh membuat pesan pendek jadi lolos.
assert.ok(cek("   ab   ").message);

// Draft kosong memang belum valid, jadi form baru tidak bisa langsung dikirim.
assert.ok(Object.keys(validateReminder(emptyReminderDraft())).length > 0);

// Semua kalimat siap pakai harus lolos validasinya sendiri.
for (const t of REMINDER_TEMPLATES) {
  assert.deepEqual(cek(t), {}, `template tidak lolos: ${t}`);
}

console.log("ok: reminder-form");
