/**
 * Cek mandiri hitungan agenda: `npx tsx lib/agenda.check.ts`
 * ponytail: assert polos, sejalan dengan lib/timeline.check.ts.
 */
import assert from "node:assert/strict";
import {
  type AgendaBarLike,
  type AgendaLike,
  agendaClashes,
  assignLanes,
  barSpan,
  coversDay,
  dayLabel,
  durationDays,
  entriesInRange,
  AMBANG_TITIK,
  clampResize,
  diLuarRentang,
  geserKhusus,
  mergeBars,
  modeTampilan,
  monthsOf,
  rangeBars,
  rentangKhusus,
  rentangSkala,
  resizeTarget,
  ticksRentang,
  weekRowsOf,
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

/** Seperti a(), ditambah proyek — bentuk yang dipakai penggabungan bar. */
function b(
  id: number,
  userId: number,
  startDate: string,
  endDate: string,
  projectId: number | null = 1,
  kind: AgendaKind = "Lapangan"
): AgendaBarLike {
  return { id, userId, kind, startDate, endDate, projectId };
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

const rPekan = rentangSkala("minggu", "2026-09-04", 0);
const rPekanLalu = rentangSkala("minggu", "2026-09-04", -1);

/* --- mergeBars ------------------------------------------------------------- */

const ids = (bar: { entries: { id: number }[] }) => bar.entries.map((e) => e.id);

// Berdampingan (selesai lalu mulai keesokan harinya) menyatu jadi satu bar.
const nyambung = mergeBars([
  b(1, 1, "2026-09-01", "2026-09-02"),
  b(2, 1, "2026-09-03", "2026-09-03"),
  b(3, 1, "2026-09-04", "2026-09-05"),
]);
assert.equal(nyambung.length, 1);
assert.equal(nyambung[0].startDate, "2026-09-01");
assert.equal(nyambung[0].endDate, "2026-09-05");
assert.deepEqual(ids(nyambung[0]), [1, 2, 3]);
assert.equal(nyambung[0].bertumpuk, false);

// Urutan masuk tidak boleh mengubah hasil.
assert.deepEqual(
  ids(
    mergeBars([
      b(3, 1, "2026-09-04", "2026-09-05"),
      b(1, 1, "2026-09-01", "2026-09-02"),
      b(2, 1, "2026-09-03", "2026-09-03"),
    ])[0]
  ),
  [1, 2, 3]
);

// Jeda sehari memutus bar — inilah yang menjaga papan tidak berbohong soal
// orangnya ada di proyek itu pada hari yang sebetulnya kosong.
const berjeda = mergeBars([
  b(1, 1, "2026-09-01", "2026-09-02"),
  b(2, 1, "2026-09-04", "2026-09-05"),
]);
assert.equal(berjeda.length, 2);
assert.deepEqual(ids(berjeda[0]), [1]);
assert.deepEqual(ids(berjeda[1]), [2]);

// Proyek berbeda tidak menyatu walau tanggalnya bersambung.
assert.equal(
  mergeBars([b(1, 1, "2026-09-01", "2026-09-02", 1), b(2, 1, "2026-09-03", "2026-09-04", 2)]).length,
  2
);

// Jenis berbeda tidak menyatu walau proyeknya sama — warna dan label bar
// mengikuti jenis, jadi bar campuran tidak punya warna yang jujur.
assert.equal(
  mergeBars([
    b(1, 1, "2026-09-01", "2026-09-02", 1, "Perjalanan"),
    b(2, 1, "2026-09-03", "2026-09-04", 1, "Lapangan"),
  ]).length,
  2
);

// Orang berbeda tidak pernah menyatu.
assert.equal(
  mergeBars([b(1, 1, "2026-09-01", "2026-09-02"), b(2, 2, "2026-09-03", "2026-09-04")]).length,
  2
);

// Entri tanpa proyek dikelompokkan per jenis; Kantor berdampingan tetap menyatu,
// tapi Cuti di sebelahnya berdiri sendiri.
const tanpaProyek = mergeBars([
  b(1, 1, "2026-09-01", "2026-09-01", null, "Kantor"),
  b(2, 1, "2026-09-02", "2026-09-02", null, "Kantor"),
  b(3, 1, "2026-09-03", "2026-09-03", null, "Cuti"),
]);
assert.equal(tanpaProyek.length, 2);
assert.deepEqual(ids(tanpaProyek.find((x) => x.kind === "Kantor")!), [1, 2]);
assert.deepEqual(ids(tanpaProyek.find((x) => x.kind === "Cuti")!), [3]);

// Beririsan tetap menyatu, tapi menyalakan penanda bertumpuk: itu data ganda
// milik orang yang sama, bukan orang di dua tempat.
const tumpuk = mergeBars([
  b(1, 1, "2026-09-01", "2026-09-03"),
  b(2, 1, "2026-09-02", "2026-09-05"),
]);
assert.equal(tumpuk.length, 1);
assert.equal(tumpuk[0].bertumpuk, true);
assert.equal(tumpuk[0].endDate, "2026-09-05");

// Entri yang termuat seluruhnya di dalam entri lain tidak memendekkan barnya.
const termuat = mergeBars([
  b(1, 1, "2026-09-01", "2026-09-10"),
  b(2, 1, "2026-09-03", "2026-09-04"),
]);
assert.equal(termuat.length, 1);
assert.equal(termuat[0].endDate, "2026-09-10");

// Satu entri tetap jadi satu bar, dan daftar kosong aman.
assert.equal(mergeBars([b(1, 1, "2026-09-01", "2026-09-01")]).length, 1);
assert.deepEqual(mergeBars([]), []);

// Kunci bar unik — kalau tidak, React akan menggabungkan dua bar jadi satu.
const kunci = mergeBars([
  b(1, 1, "2026-09-01", "2026-09-02"),
  b(2, 1, "2026-09-04", "2026-09-05"),
  b(3, 2, "2026-09-01", "2026-09-02"),
]).map((x) => x.key);
assert.deepEqual(kunci, [...new Set(kunci)]);

/* --- assignLanes ----------------------------------------------------------- */

// Bar yang tidak beririsan memakai ulang jalur 0 — baris tidak menebal percuma.
const berurutan = assignLanes(
  mergeBars([
    b(1, 1, "2026-09-01", "2026-09-02", 1),
    b(2, 1, "2026-09-04", "2026-09-05", 2),
  ])
);
assert.deepEqual(berurutan.map((x) => x.lane), [0, 0]);

// Yang beririsan turun ke jalur berikutnya, bukan saling menutupi.
const beririsan = assignLanes(
  mergeBars([
    b(1, 1, "2026-09-01", "2026-09-05", 1),
    b(2, 1, "2026-09-02", "2026-09-06", 2),
    b(3, 1, "2026-09-03", "2026-09-07", 3),
  ])
);
assert.deepEqual(beririsan.map((x) => x.lane), [0, 1, 2]);

// Bersentuhan di hari yang sama tetap dihitung beririsan.
assert.deepEqual(
  assignLanes(
    mergeBars([
      b(1, 1, "2026-09-01", "2026-09-03", 1),
      b(2, 1, "2026-09-03", "2026-09-05", 2),
    ])
  ).map((x) => x.lane),
  [0, 1]
);

assert.deepEqual(assignLanes([]), []);

/* --- weekBars -------------------------------------------------------------- */

const anggotaBar = [u(1, "Rika"), u(2, "Harir")];

// Satu baris per orang, termasuk yang tidak punya agenda sama sekali.
const barisBar = rangeBars([b(1, 1, "2026-09-01", "2026-09-03")], anggotaBar, rPekan);
assert.deepEqual(barisBar.map((r) => r.user.id), [1, 2]);
assert.equal(barisBar[1].bars.length, 0);
assert.equal(barisBar[1].total, 0);
// Baris tanpa bar tetap setinggi satu jalur.
assert.equal(barisBar[1].laneCount, 1);
assert.equal(barisBar[0].total, 1);

// total menghitung ENTRI, bukan bar: tiga entri yang menyatu tetap "3 agenda".
const tigaEntri = rangeBars(
  [
    b(1, 1, "2026-09-01", "2026-09-01"),
    b(2, 1, "2026-09-02", "2026-09-02"),
    b(3, 1, "2026-09-03", "2026-09-03"),
  ],
  anggotaBar,
  rPekan
);
assert.equal(tigaEntri[0].bars.length, 1);
assert.equal(tigaEntri[0].total, 3);

// Bar yang membentang melewati batas pekan tetap utuh dan muncul di KEDUA
// pekan — kalau entri dipotong dulu sebelum digabung, ia akan pecah jadi dua.
const lintasPekan = [b(1, 1, "2026-08-28", "2026-08-31"), b(2, 1, "2026-09-01", "2026-09-08")];
const pekanIni = rangeBars(lintasPekan, anggotaBar, rPekan)[0];
assert.equal(pekanIni.bars.length, 1);
assert.equal(pekanIni.bars[0].startDate, "2026-08-28");
assert.equal(pekanIni.bars[0].endDate, "2026-09-08");

const pekanLalu = rangeBars(lintasPekan, anggotaBar, rPekanLalu)[0];
assert.equal(pekanLalu.bars.length, 1);
assert.equal(pekanLalu.bars[0].endDate, "2026-09-08");
assert.deepEqual(ids(pekanLalu.bars[0]), [1, 2]);

// Bar yang tidak menyentuh pekan ini tidak ikut tampil.
assert.equal(rangeBars([b(1, 1, "2026-07-01", "2026-07-05")], anggotaBar, rPekan)[0].bars.length, 0);

// laneCount mengikuti jalur yang benar-benar dipakai di pekan itu.
assert.equal(
  rangeBars(
    [b(1, 1, "2026-09-01", "2026-09-05", 1), b(2, 1, "2026-09-02", "2026-09-04", 2)],
    anggotaBar,
    rPekan
  )[0].laneCount,
  2
);

assert.deepEqual(rangeBars([], anggotaBar, rPekan).map((r) => r.bars.length), [0, 0]);
assert.deepEqual(rangeBars([b(1, 1, "2026-09-01", "2026-09-01")], [], rPekan), []);

/* --- barSpan --------------------------------------------------------------- */

const seminggu = 100 / 7;
const bulat = (n: number) => Math.round(n * 1000) / 1000;

// Sehari penuh = seperujuh lebar; Senin mulai di 0.
const sehari = barSpan({ startDate: "2026-08-31", endDate: "2026-08-31" }, rPekan);
assert.equal(bulat(sehari.leftPct), 0);
assert.equal(bulat(sehari.widthPct), bulat(seminggu));
assert.equal(sehari.terpotongKiri, false);
assert.equal(sehari.terpotongKanan, false);

// Hari terakhir pekan berakhir tepat di 100%.
const minggu = barSpan({ startDate: "2026-09-06", endDate: "2026-09-06" }, rPekan);
assert.equal(bulat(minggu.leftPct + minggu.widthPct), 100);

// Sepekan penuh memenuhi seluruh lebar.
const penuh = barSpan({ startDate: "2026-08-31", endDate: "2026-09-06" }, rPekan);
assert.equal(bulat(penuh.leftPct), 0);
assert.equal(bulat(penuh.widthPct), 100);

// Mulai sebelum pekan: dipotong di tepi kiri dan ditandai.
const kiri = barSpan({ startDate: "2026-08-20", endDate: "2026-09-01" }, rPekan);
assert.equal(bulat(kiri.leftPct), 0);
assert.equal(bulat(kiri.widthPct), bulat(seminggu * 2));
assert.equal(kiri.terpotongKiri, true);
assert.equal(kiri.terpotongKanan, false);

// Berakhir setelah pekan: dipotong di tepi kanan.
const kanan = barSpan({ startDate: "2026-09-05", endDate: "2026-09-20" }, rPekan);
assert.equal(bulat(kanan.leftPct + kanan.widthPct), 100);
assert.equal(kanan.terpotongKiri, false);
assert.equal(kanan.terpotongKanan, true);

// Melingkupi seluruh pekan: terpotong di kedua sisi.
const dua = barSpan({ startDate: "2026-08-01", endDate: "2026-09-30" }, rPekan);
assert.equal(bulat(dua.widthPct), 100);
assert.equal(dua.terpotongKiri, true);
assert.equal(dua.terpotongKanan, true);

// Di luar pekan: lebar 0, bukan negatif yang merusak layout diam-diam.
assert.equal(barSpan({ startDate: "2026-07-01", endDate: "2026-07-05" }, rPekan).widthPct, 0);
assert.equal(barSpan({ startDate: "2026-10-01", endDate: "2026-10-05" }, rPekan).widthPct, 0);

/* --- clampResize & resizeTarget -------------------------------------------- */

const barTiga = mergeBars([
  b(1, 1, "2026-09-01", "2026-09-02"),
  b(2, 1, "2026-09-03", "2026-09-03"),
  b(3, 1, "2026-09-04", "2026-09-05"),
])[0];

// Memanjang bebas ke kanan.
assert.equal(clampResize(barTiga, "kanan", 3), 3);
assert.deepEqual(resizeTarget(barTiga, "kanan", 3), {
  id: 3,
  startDate: "2026-09-04",
  endDate: "2026-09-08",
});

// Memendek sampai batas awal entri terakhir (04-05 boleh menyusut 1 hari).
assert.equal(clampResize(barTiga, "kanan", -1), -1);
// Lebih dari itu terjepit — entri terakhir tidak boleh terbalik atau lenyap.
assert.equal(clampResize(barTiga, "kanan", -9), -1);
assert.deepEqual(resizeTarget(barTiga, "kanan", -9), {
  id: 3,
  startDate: "2026-09-04",
  endDate: "2026-09-04",
});

// Gagang kiri menyentuh entri PERTAMA, dan tidak boleh melewati akhirnya.
assert.equal(clampResize(barTiga, "kiri", -4), -4);
assert.equal(clampResize(barTiga, "kiri", 1), 1);
assert.equal(clampResize(barTiga, "kiri", 9), 1);
assert.deepEqual(resizeTarget(barTiga, "kiri", -4), {
  id: 1,
  startDate: "2026-08-28",
  endDate: "2026-09-02",
});
assert.deepEqual(resizeTarget(barTiga, "kiri", 9), {
  id: 1,
  startDate: "2026-09-02",
  endDate: "2026-09-02",
});

// Bar sehari tidak bisa dipendekkan sama sekali, dari sisi mana pun.
const barSehari = mergeBars([b(1, 1, "2026-09-01", "2026-09-01")])[0];
assert.equal(clampResize(barSehari, "kanan", -5), 0);
assert.equal(clampResize(barSehari, "kiri", 5), 0);
// Tapi tetap bisa dipanjangkan.
assert.equal(clampResize(barSehari, "kanan", 4), 4);
assert.equal(clampResize(barSehari, "kiri", -4), -4);

// Nol tetap nol — menyeret tanpa berpindah hari tidak mengubah apa pun.
assert.equal(clampResize(barTiga, "kanan", 0), 0);
assert.equal(clampResize(barTiga, "kiri", 0), 0);

/** Aritmetika hari lokal untuk cek; lib/agenda.ts tidak mengekspor toDay(). */
const toDayCheck = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/* --- rentangSkala ---------------------------------------------------------- */

// Skala minggu harus sama persis dengan weekRange() yang sudah ada — kalau
// berselisih, papan dan laporan mingguan akan menunjuk pekan yang berbeda.
assert.equal(rPekan.start, pekan.start);
assert.equal(rPekan.end, pekan.end);
assert.equal(rPekan.totalDays, 7);

const r2Minggu = rentangSkala("2minggu", "2026-09-04", 0);
assert.equal(r2Minggu.start, "2026-08-31"); // tetap mulai Senin
assert.equal(r2Minggu.end, "2026-09-13");
assert.equal(r2Minggu.totalDays, 14);
// Satu geseran memindahkan DUA pekan, bukan satu.
assert.equal(rentangSkala("2minggu", "2026-09-04", 1).start, "2026-09-14");

// Bulan kalender penuh, bukan 30 hari dari acuan.
const rBulan = rentangSkala("bulan", "2026-09-04", 0);
assert.equal(rBulan.start, "2026-09-01");
assert.equal(rBulan.end, "2026-09-30");
assert.equal(rBulan.totalDays, 30);
assert.equal(rentangSkala("bulan", "2026-09-04", 1).start, "2026-10-01");
assert.equal(rentangSkala("bulan", "2026-09-04", 1).end, "2026-10-31");
// Mundur melewati pergantian tahun.
assert.equal(rentangSkala("bulan", "2026-09-04", -9).start, "2025-12-01");
assert.equal(rentangSkala("bulan", "2026-09-04", -9).end, "2025-12-31");

// Februari kabisat berakhir di tanggal 29, bukan 28 atau 1 Maret.
const rKabisat = rentangSkala("bulan", "2028-02-10", 0);
assert.equal(rKabisat.end, "2028-02-29");
assert.equal(rKabisat.totalDays, 29);
assert.equal(rentangSkala("bulan", "2027-02-10", 0).end, "2027-02-28");

// Tiga bulan kalender berurutan.
const r3Bulan = rentangSkala("3bulan", "2026-09-04", 0);
assert.equal(r3Bulan.start, "2026-09-01");
assert.equal(r3Bulan.end, "2026-11-30");
assert.equal(r3Bulan.totalDays, 30 + 31 + 30);
// Satu geseran melompat tiga bulan, dan boleh melewati pergantian tahun.
const r3Depan = rentangSkala("3bulan", "2026-09-04", 1);
assert.equal(r3Depan.start, "2026-12-01");
assert.equal(r3Depan.end, "2027-02-28");

// Tahun kalender penuh.
const rTahun = rentangSkala("tahun", "2026-09-04", 0);
assert.equal(rTahun.start, "2026-01-01");
assert.equal(rTahun.end, "2026-12-31");
assert.equal(rTahun.totalDays, 365);
assert.equal(rentangSkala("tahun", "2028-06-01", 0).totalDays, 366); // kabisat
assert.equal(rentangSkala("tahun", "2026-09-04", -1).start, "2025-01-01");

// Maju lalu mundur kembali ke asal, untuk kelima skala preset.
for (const skala of ["minggu", "2minggu", "bulan", "3bulan", "tahun"] as const) {
  const asal = rentangSkala(skala, "2026-09-04", 0);
  const bolakBalik = rentangSkala(skala, "2026-09-04", 0);
  assert.deepEqual(bolakBalik, asal, `${skala} tidak stabil`);
  // Geseran berurutan tidak boleh tumpang tindih maupun menyisakan lubang.
  const berikut = rentangSkala(skala, "2026-09-04", 1);
  assert.equal(
    toDayCheck(berikut.start) - toDayCheck(asal.end),
    1,
    `${skala}: periode berikutnya harus mulai persis sehari setelah yang ini berakhir`
  );
}

/* --- rentangKhusus & geserKhusus ------------------------------------------- */

const rKhusus = rentangKhusus("2026-09-01", "2026-09-10");
assert.equal(rKhusus.totalDays, 10); // inklusif kedua ujungnya
assert.equal(rentangKhusus("2026-09-01", "2026-09-01").totalDays, 1);

// Tanggal terbalik dijepit jadi sehari, bukan menghasilkan totalDays negatif.
const terbalik = rentangKhusus("2026-09-10", "2026-09-01");
assert.equal(terbalik.start, "2026-09-10");
assert.equal(terbalik.end, "2026-09-10");
assert.equal(terbalik.totalDays, 1);

// Geseran rentang khusus sepanjang rentangnya sendiri.
assert.equal(geserKhusus(rKhusus, 1).start, "2026-09-11");
assert.equal(geserKhusus(rKhusus, 1).end, "2026-09-20");
assert.deepEqual(geserKhusus(geserKhusus(rKhusus, 1), -1), rKhusus);

/* --- ticksRentang ---------------------------------------------------------- */

// Sepekan: tujuh kolom harian, berlabel seperti dayLabel().
const tPekan = ticksRentang(rPekan);
assert.equal(tPekan.length, 7);
assert.equal(tPekan[0].label, dayLabel("2026-08-31"));
assert.equal(tPekan[0].leftPct, 0);

// Empat belas hari masih harian; lima belas sudah mingguan.
assert.equal(ticksRentang(r2Minggu).length, 14);
assert.equal(ticksRentang(rentangKhusus("2026-09-01", "2026-09-15")).length, 3);

// Rentang khusus sepuluh hari tetap HARIAN — kerapatan diturunkan dari panjang
// rentang, bukan dari tombol mana yang ditekan.
const tKhusus = ticksRentang(rKhusus);
assert.equal(tKhusus.length, 10);
assert.match(tKhusus[0].label, /^\S+ \d+\/\d+$/);

// Sebulan dan tiga bulan: mingguan.
assert.equal(ticksRentang(rBulan).length, Math.ceil(30 / 7));
assert.equal(ticksRentang(r3Bulan).length, Math.ceil(91 / 7));
assert.match(ticksRentang(rBulan)[1].label, /^\d+\/\d+$/);

// Setahun: dua belas kolom bulan.
const tTahun = ticksRentang(rTahun);
assert.equal(tTahun.length, 12);
assert.equal(tTahun[0].leftPct, 0);
assert.deepEqual(tTahun.map((t) => t.key), [
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
]);

// Berlaku untuk semua kerapatan: tick pertama di 0, tidak ada yang melewati
// tepi kanan, dan urutannya menaik.
for (const r of [rPekan, r2Minggu, rBulan, r3Bulan, rTahun, rKhusus]) {
  const t = ticksRentang(r);
  assert.ok(t.length > 0);
  assert.equal(t[0].leftPct, 0);
  assert.ok(t.every((x) => x.leftPct >= 0 && x.leftPct < 100));
  for (let i = 1; i < t.length; i++) {
    assert.ok(t[i].leftPct > t[i - 1].leftPct, "tick tidak menaik");
  }
  assert.deepEqual(t.map((x) => x.key), [...new Set(t.map((x) => x.key))]);
}

/* --- modeTampilan ---------------------------------------------------------- */

assert.equal(modeTampilan(rPekan), "bar");
assert.equal(modeTampilan(rBulan), "bar");
assert.equal(modeTampilan(r3Bulan), "bar"); // 91 hari, masih bar
assert.equal(modeTampilan(rTahun), "titik");

// Tepat di ambang masih bar; sehari di atasnya sudah titik.
assert.equal(rentangKhusus("2026-01-01", "2026-04-30").totalDays, AMBANG_TITIK);
assert.equal(modeTampilan(rentangKhusus("2026-01-01", "2026-04-30")), "bar");
assert.equal(modeTampilan(rentangKhusus("2026-01-01", "2026-05-01")), "titik");
// Rentang khusus dua tahun ikut jadi titik — ambangnya milik rentang, bukan tombol.
assert.equal(modeTampilan(rentangKhusus("2026-01-01", "2027-12-31")), "titik");

/* --- barSpan di rentang bukan tujuh hari ----------------------------------- */

const sehariBulan = barSpan({ startDate: "2026-09-01", endDate: "2026-09-01" }, rBulan);
assert.equal(sehariBulan.leftPct, 0);
assert.equal(bulat(sehariBulan.widthPct), bulat(100 / 30));

// Hari terakhir bulan berakhir tepat di 100%.
const akhirBulan = barSpan({ startDate: "2026-09-30", endDate: "2026-09-30" }, rBulan);
assert.equal(bulat(akhirBulan.leftPct + akhirBulan.widthPct), 100);

// Sebulan penuh memenuhi lebar.
assert.equal(bulat(barSpan({ startDate: "2026-09-01", endDate: "2026-09-30" }, rBulan).widthPct), 100);

// Terpotong di tepi kiri bulan.
const potongBulan = barSpan({ startDate: "2026-08-01", endDate: "2026-09-05" }, rBulan);
assert.equal(potongBulan.leftPct, 0);
assert.equal(bulat(potongBulan.widthPct), bulat((5 / 30) * 100));
assert.equal(potongBulan.terpotongKiri, true);
assert.equal(potongBulan.terpotongKanan, false);

// Sehari di rentang setahun jadi sangat tipis — itulah alasan mode titik ada.
assert.ok(barSpan({ startDate: "2026-09-01", endDate: "2026-09-01" }, rTahun).widthPct < 0.3);

/* --- rangeBars di rentang bulanan ------------------------------------------ */

// Bar yang membentang melewati batas bulan tetap utuh, tidak terpotong jadi dua.
const lintasBulan = rangeBars(
  [b(1, 1, "2026-08-28", "2026-08-31"), b(2, 1, "2026-09-01", "2026-09-08")],
  anggotaBar,
  rBulan
)[0];
assert.equal(lintasBulan.bars.length, 1);
assert.equal(lintasBulan.bars[0].startDate, "2026-08-28");
assert.equal(lintasBulan.bars[0].endDate, "2026-09-08");

// Anggota tanpa agenda tetap dapat barisnya di skala mana pun.
for (const r of [rPekan, rBulan, rTahun]) {
  const baris = rangeBars([b(1, 1, "2026-09-01", "2026-09-03")], anggotaBar, r);
  assert.equal(baris.length, 2);
  assert.equal(baris[1].bars.length, 0);
  assert.equal(baris[1].laneCount, 1);
}

/* --- weekRowsOf & monthsOf ------------------------------------------------- */

// Sepekan menghasilkan tepat satu baris, dan baris itu sama dengan rentangnya.
const barisPekan = weekRowsOf(rPekan);
assert.equal(barisPekan.length, 1);
assert.equal(barisPekan[0].start, rPekan.start);
assert.equal(barisPekan[0].end, rPekan.end);

// Setiap baris selalu Senin-Minggu utuh, walau rentangnya tidak.
const barisBulan = weekRowsOf(rBulan); // 1-30 September 2026
assert.ok(barisBulan.every((r) => r.totalDays === 7), "baris pekan harus tujuh hari");
assert.equal(barisBulan[0].start, "2026-08-31"); // Senin sebelum tanggal 1
assert.equal(barisBulan[barisBulan.length - 1].end, "2026-10-04"); // Minggu sesudah tanggal 30
assert.equal(barisBulan.length, 5);

// Barisnya bersambung tanpa lubang maupun tumpang tindih.
for (let i = 1; i < barisBulan.length; i++) {
  assert.equal(
    toDayCheck(barisBulan[i].start) - toDayCheck(barisBulan[i - 1].end),
    1,
    "baris pekan tidak bersambung"
  );
}

// Melebar ke luar rentang memang disengaja: kolom hari harus sejajar antar baris.
assert.ok(barisBulan[0].start < rBulan.start);
assert.ok(barisBulan[barisBulan.length - 1].end > rBulan.end);

// Rentang sehari tetap menghasilkan satu baris pekan penuh.
assert.equal(weekRowsOf(rentangKhusus("2026-09-02", "2026-09-02")).length, 1);
assert.equal(weekRowsOf(rentangKhusus("2026-09-02", "2026-09-02"))[0].totalDays, 7);

// Setahun: 12 bulan, dan tiap bulan berlabel serta rentangnya penuh.
const bulanTahun = monthsOf(rTahun);
assert.equal(bulanTahun.length, 12);
assert.equal(bulanTahun[0].key, "2026-01");
assert.equal(bulanTahun[0].rentang.start, "2026-01-01");
assert.equal(bulanTahun[0].rentang.end, "2026-01-31");
assert.equal(bulanTahun[1].rentang.end, "2026-02-28");
assert.equal(bulanTahun[11].rentang.end, "2026-12-31");
assert.match(bulanTahun[0].label, /Januari/);
assert.deepEqual(bulanTahun.map((m) => m.key), [...new Set(bulanTahun.map((m) => m.key))]);

// Februari kabisat ikut benar lewat jalur ini juga.
assert.equal(monthsOf(rentangSkala("tahun", "2028-06-01", 0))[1].rentang.end, "2028-02-29");

// Rentang sebulan menghasilkan satu bulan; rentang yang menyentuh dua bulan, dua.
assert.equal(monthsOf(rBulan).length, 1);
assert.equal(monthsOf(rentangKhusus("2026-09-28", "2026-10-02")).length, 2);
assert.equal(monthsOf(r3Bulan).length, 3);

/* --- diLuarRentang --------------------------------------------------------- */

// Hari tetangga yang ikut terbawa baris pekan harus bisa dikenali dan diredupkan.
assert.equal(diLuarRentang("2026-08-31", rBulan), true);
assert.equal(diLuarRentang("2026-09-01", rBulan), false);
assert.equal(diLuarRentang("2026-09-30", rBulan), false);
assert.equal(diLuarRentang("2026-10-01", rBulan), true);

console.log("ok: agenda");
