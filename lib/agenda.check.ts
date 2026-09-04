/**
 * Cek mandiri hitungan agenda: `npx tsx lib/agenda.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 */
import assert from "node:assert/strict";
import {
  type AgendaLike,
  agendaClashes,
  coversDay,
  dayLabel,
  durationDays,
  entriesInRange,
  shiftWeek,
  weekGrid,
  weekRange,
} from "./agenda";
import type { AccessLevel, AgendaKind, User } from "./types";

function a(
  id: number,
  userId: number,
  startDate: string,
  endDate: string,
  kind: AgendaKind = "Lapangan"
): AgendaLike {
  return { id, userId, kind, startDate, endDate };
}

function u(id: number, name: string, accessLevel: AccessLevel = "Anggota"): User {
  return {
    id,
    name,
    email: `${name.toLowerCase()}@uji.co.id`,
    avatarUrl: null,
    role: "Staf",
    accessLevel,
    isActive: true,
  };
}

/* --- weekRange ------------------------------------------------------------- */

// 2026-09-04 adalah Jumat; pekannya 31 Agustus (Senin) sampai 6 September.
const pekan = weekRange("2026-09-04");
assert.equal(pekan.start, "2026-08-31");
assert.equal(pekan.end, "2026-09-06");
assert.equal(pekan.days.length, 7);
assert.equal(pekan.days[0], "2026-08-31");
assert.equal(pekan.days[6], "2026-09-06");

// Hari mana pun dalam pekan itu menghasilkan pekan yang sama — termasuk kedua
// ujungnya, yang paling mudah meleset karena pembulatan sisa bagi.
for (const hari of pekan.days) {
  assert.deepEqual(weekRange(hari), pekan, `${hari} jatuh di pekan yang salah`);
}

// Acuan hari Minggu tetap masuk pekan yang sama, bukan terlempar ke pekan
// berikutnya. Inilah jebakan klasik saat awal pekan dianggap Minggu.
assert.equal(weekRange("2026-09-06").start, "2026-08-31");
// Sedangkan Senin berikutnya memang pekan baru.
assert.equal(weekRange("2026-09-07").start, "2026-09-07");

// Melintasi pergantian bulan dan tahun.
assert.equal(weekRange("2026-09-01").start, "2026-08-31"); // Selasa, bulan berbeda
const tahunBaru = weekRange("2027-01-01"); // Jumat
assert.equal(tahunBaru.start, "2026-12-28");
assert.equal(tahunBaru.end, "2027-01-03");
assert.equal(tahunBaru.days.length, 7);

// Hari-harinya selalu berurutan tanpa lompat.
for (const p of [pekan, tahunBaru, weekRange("2026-02-25")]) {
  const hari = p.days.map((d) => Date.parse(`${d}T00:00:00Z`));
  for (let i = 1; i < hari.length; i++) {
    assert.equal(hari[i] - hari[i - 1], 86_400_000, "hari tidak berurutan");
  }
}

// Tahun kabisat: 2028-02-29 ada, dan pekannya tetap tujuh hari.
const kabisat = weekRange("2028-02-29");
assert.equal(kabisat.days.length, 7);
assert.ok(kabisat.days.includes("2028-02-29"));

/* --- shiftWeek ------------------------------------------------------------- */

assert.equal(shiftWeek(pekan, 1).start, "2026-09-07");
assert.equal(shiftWeek(pekan, -1).start, "2026-08-24");
assert.equal(shiftWeek(pekan, 0).start, pekan.start);
// Maju lalu mundur kembali ke asal.
assert.deepEqual(shiftWeek(shiftWeek(pekan, 3), -3), pekan);

/* --- entriesInRange -------------------------------------------------------- */

const daftar = [
  a(1, 1, "2026-08-24", "2026-08-30"), // seluruhnya sebelum pekan
  a(2, 1, "2026-08-28", "2026-09-01"), // mulai sebelum, berakhir di dalam
  a(3, 2, "2026-09-01", "2026-09-03"), // seluruhnya di dalam
  a(4, 2, "2026-09-05", "2026-09-10"), // mulai di dalam, berakhir sesudah
  a(5, 3, "2026-09-07", "2026-09-09"), // seluruhnya sesudah
  a(6, 3, "2026-08-01", "2026-12-31"), // melingkupi seluruh pekan
];

// Beririsan, bukan termuat: yang menyentuh ujung pekan tetap ikut.
assert.deepEqual(
  entriesInRange(daftar, pekan.start, pekan.end).map((x) => x.id),
  [2, 3, 4, 6]
);

// Menyentuh tepat satu hari di ujung tetap terhitung.
assert.deepEqual(
  entriesInRange([a(9, 1, "2026-08-20", "2026-08-31")], pekan.start, pekan.end).map((x) => x.id),
  [9]
);
assert.deepEqual(
  entriesInRange([a(9, 1, "2026-09-06", "2026-09-20")], pekan.start, pekan.end).map((x) => x.id),
  [9]
);
// Selisih sehari di luar rentang tidak ikut.
assert.deepEqual(entriesInRange([a(9, 1, "2026-08-20", "2026-08-30")], pekan.start, pekan.end), []);
assert.deepEqual(entriesInRange([a(9, 1, "2026-09-07", "2026-09-20")], pekan.start, pekan.end), []);

// Daftar kosong aman, dan array asal tidak diubah.
assert.deepEqual(entriesInRange([], pekan.start, pekan.end), []);
assert.equal(daftar.length, 6);

/* --- coversDay ------------------------------------------------------------- */

const rentang = a(1, 1, "2026-09-01", "2026-09-03");
assert.equal(coversDay(rentang, "2026-09-01"), true); // ujung awal
assert.equal(coversDay(rentang, "2026-09-02"), true);
assert.equal(coversDay(rentang, "2026-09-03"), true); // ujung akhir
assert.equal(coversDay(rentang, "2026-08-31"), false);
assert.equal(coversDay(rentang, "2026-09-04"), false);

/* --- weekGrid -------------------------------------------------------------- */

const anggota = [u(1, "Harir"), u(2, "Rika"), u(3, "Nurdiyansah")];
const grid = weekGrid(daftar, anggota, pekan);

// Satu baris per orang, tujuh kolom per baris — termasuk yang tanpa agenda.
assert.equal(grid.length, anggota.length);
assert.ok(grid.every((r) => r.cells.length === 7));
assert.deepEqual(grid.map((r) => r.user.id), [1, 2, 3]);

// Kolomnya sejajar dengan hari di pekan itu.
assert.deepEqual(grid[0].cells.map((c) => c.date), pekan.days);

// Harir: agenda 2 menyentuh Senin (31/8) sampai Selasa (1/9), lalu kosong.
assert.deepEqual(grid[0].cells[0].entries.map((x) => x.id), [2]); // Senin
assert.deepEqual(grid[0].cells[1].entries.map((x) => x.id), [2]); // Selasa
assert.deepEqual(grid[0].cells[2].entries, []); // Rabu
assert.equal(grid[0].total, 1);

// Rika: agenda 3 Selasa-Kamis, agenda 4 mulai Sabtu.
assert.deepEqual(grid[1].cells[1].entries.map((x) => x.id), [3]);
assert.deepEqual(grid[1].cells[3].entries.map((x) => x.id), [3]);
assert.deepEqual(grid[1].cells[5].entries.map((x) => x.id), [4]);
assert.equal(grid[1].total, 2);

// Nurdiyansah: agenda 6 melingkupi seluruh pekan, jadi ketujuh harinya terisi.
assert.ok(grid[2].cells.every((c) => c.entries.some((x) => x.id === 6)));

// Agenda di luar pekan tidak pernah muncul di sel mana pun.
const semuaId = grid.flatMap((r) => r.cells.flatMap((c) => c.entries.map((x) => x.id)));
assert.equal(semuaId.includes(1), false);
assert.equal(semuaId.includes(5), false);

// Anggota tanpa agenda tetap dapat barisnya — "tidak ada agenda" itu informasi.
const kosong = weekGrid([], anggota, pekan);
assert.equal(kosong.length, 3);
assert.ok(kosong.every((r) => r.total === 0 && r.cells.every((c) => c.entries.length === 0)));

// Tanpa anggota sama sekali tetap aman.
assert.deepEqual(weekGrid(daftar, [], pekan), []);

/* --- agendaClashes --------------------------------------------------------- */

// Satu orang di dua tempat sekaligus.
const bentrok = agendaClashes([
  a(1, 1, "2026-09-01", "2026-09-05"),
  a(2, 1, "2026-09-03", "2026-09-08"),
]);
assert.equal(bentrok.length, 1);
assert.deepEqual(bentrok[0], {
  userId: 1,
  a: 1,
  b: 2,
  startDate: "2026-09-03",
  endDate: "2026-09-05",
});

// Orang berbeda di tanggal yang sama bukan bentrok.
assert.deepEqual(
  agendaClashes([a(1, 1, "2026-09-01", "2026-09-05"), a(2, 2, "2026-09-01", "2026-09-05")]),
  []
);

// Bersentuhan satu hari tetap bentrok; terpisah sehari tidak.
assert.equal(agendaClashes([a(1, 1, "2026-09-01", "2026-09-03"), a(2, 1, "2026-09-03", "2026-09-05")]).length, 1);
assert.equal(agendaClashes([a(1, 1, "2026-09-01", "2026-09-03"), a(2, 1, "2026-09-04", "2026-09-05")]).length, 0);

// Tiga agenda saling tumpuk menghasilkan tiga pasangan, dan id-nya selalu urut.
const tiga = agendaClashes([
  a(3, 1, "2026-09-01", "2026-09-10"),
  a(1, 1, "2026-09-02", "2026-09-04"),
  a(2, 1, "2026-09-03", "2026-09-06"),
]);
assert.equal(tiga.length, 3);
assert.ok(tiga.every((x) => x.a < x.b));

// Daftar kosong dan satu entri aman.
assert.deepEqual(agendaClashes([]), []);
assert.deepEqual(agendaClashes([a(1, 1, "2026-09-01", "2026-09-05")]), []);

/* --- durationDays & dayLabel ----------------------------------------------- */

assert.equal(durationDays(a(1, 1, "2026-09-01", "2026-09-01")), 1); // sehari tetap 1
assert.equal(durationDays(a(1, 1, "2026-09-01", "2026-09-05")), 5);
assert.equal(durationDays(a(1, 1, "2026-08-31", "2026-09-01")), 2); // lintas bulan

assert.match(dayLabel("2026-08-31"), /31\/8$/);
assert.match(dayLabel("2026-09-06"), /6\/9$/);

console.log("ok: agenda");
