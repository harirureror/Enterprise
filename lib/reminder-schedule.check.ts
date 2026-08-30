/**
 * Cek mandiri jadwal pengingat berulang: `npx tsx lib/reminder-schedule.check.ts`
 * Semua fungsi menerima tanggal acuan, jadi hasilnya tidak bergantung jam sistem.
 */
import assert from "node:assert/strict";
import {
  REMINDER_FREQUENCIES,
  autoReminderMessage,
  advancePast,
  emptyScheduleDraft,
  isDue,
  nextOccurrence,
  validateSchedule,
} from "./reminder-schedule";

const HARI_INI = "2026-08-28";

// Frekuensi harian, mingguan, dua-mingguan: penambahan hari yang lurus.
assert.equal(nextOccurrence("2026-08-28", "harian"), "2026-08-29");
assert.equal(nextOccurrence("2026-08-28", "mingguan"), "2026-09-04");
assert.equal(nextOccurrence("2026-08-28", "dua-mingguan"), "2026-09-11");

// Lintas bulan dan lintas tahun tetap benar.
assert.equal(nextOccurrence("2026-08-31", "harian"), "2026-09-01");
assert.equal(nextOccurrence("2026-12-31", "harian"), "2027-01-01");

// Bulanan memakai kalender: tanggalnya tetap sama.
assert.equal(nextOccurrence("2026-08-15", "bulanan"), "2026-09-15");
assert.equal(nextOccurrence("2026-12-15", "bulanan"), "2027-01-15");
// Tanggal yang tidak ada di bulan tujuan jatuh ke hari terakhir, bukan melompat.
assert.equal(nextOccurrence("2026-01-31", "bulanan"), "2026-02-28");
assert.equal(nextOccurrence("2026-03-31", "bulanan"), "2026-04-30");
// 2028 kabisat: 29 Februari memang ada.
assert.equal(nextOccurrence("2028-01-31", "bulanan"), "2028-02-29");

// Semua frekuensi selalu memajukan tanggal, tidak pernah mundur atau diam.
for (const f of REMINDER_FREQUENCIES) {
  assert.ok(nextOccurrence(HARI_INI, f) > HARI_INI, `frekuensi ${f} tidak memajukan tanggal`);
}

// isDue: tanggal hari ini dan yang sudah lewat sama-sama jatuh tempo.
assert.equal(isDue("2026-08-27", HARI_INI), true);
assert.equal(isDue(HARI_INI, HARI_INI), true);
assert.equal(isDue("2026-08-29", HARI_INI), false);

// advancePast: jadwal yang lama terlewat dimajukan ke satu tanggal di depan,
// bukan menumpuk pengingat yang menunggak.
const maju = advancePast("2026-07-01", "mingguan", HARI_INI);
assert.ok(maju > HARI_INI, "hasilnya harus di depan hari ini");
assert.equal(isDue(maju, HARI_INI), false);
// Tanggalnya tetap kelipatan minggu dari tanggal asli.
assert.equal((new Date(`${maju}T00:00:00Z`).getTime() - new Date("2026-07-01T00:00:00Z").getTime()) % (7 * 86400000), 0);
// Yang belum jatuh tempo tidak diubah sama sekali.
assert.equal(advancePast("2026-09-30", "mingguan", HARI_INI), "2026-09-30");

// Validasi: draft bawaan langsung lolos.
assert.deepEqual(validateSchedule(emptyScheduleDraft(HARI_INI), HARI_INI), {});

// Frekuensi asing ditolak.
assert.ok(validateSchedule({ frequency: "tiap jam", startDate: HARI_INI }, HARI_INI).frequency);

// Tanggal: wajib, harus nyata, dan tidak boleh di masa lalu.
assert.ok(validateSchedule({ frequency: "mingguan", startDate: "" }, HARI_INI).startDate);
assert.ok(validateSchedule({ frequency: "mingguan", startDate: "28-08-2026" }, HARI_INI).startDate);
assert.ok(validateSchedule({ frequency: "mingguan", startDate: "2026-02-31" }, HARI_INI).startDate);
assert.ok(validateSchedule({ frequency: "mingguan", startDate: "2026-08-27" }, HARI_INI).startDate);
// Hari ini dan besok sah.
assert.deepEqual(validateSchedule({ frequency: "mingguan", startDate: HARI_INI }, HARI_INI), {});
assert.deepEqual(validateSchedule({ frequency: "bulanan", startDate: "2026-09-01" }, HARI_INI), {});

// Kalimat pengingat otomatis menyebut nama proyek dan frekuensinya.
const kalimat = autoReminderMessage("Survei Batimetri", "mingguan");
assert.match(kalimat, /Survei Batimetri/);
assert.match(kalimat, /setiap minggu/i);
// Harus lolos validasi form pengingat, karena disimpan lewat jalur yang sama.
for (const f of REMINDER_FREQUENCIES) {
  const teks = autoReminderMessage("P", f);
  assert.ok(teks.length >= 5 && teks.length <= 300, `kalimat ${f} di luar batas panjang`);
}

console.log("ok: reminder-schedule");
