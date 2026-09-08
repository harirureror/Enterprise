/**
 * Cek mandiri hitungan timeline: `npx tsx lib/timeline.check.ts`
 * ponytail: assert polos, belum pakai test runner — tambah kalau logika timeline makin ramai.
 */
import assert from "node:assert/strict";
import type { Project } from "./types";
import {
  barPosition,
  fromDay,
  isOverlapping,
  monthTicks,
  overlapInfo,
  overlapPairsList,
  overlapPerMonth,
  overlapStats,
  ownerConflicts,
  timelineRange,
  toDay,
} from "./timeline";

function p(id: number, startDate: string, deadline: string, ownerId = 1): Project {
  return {
    id,
    name: `P${id}`,
    description: "",
    type: "Jasa",
    status: "Berjalan",
    priority: "Sedang",
    priorityMode: "auto",
    progressMode: "auto",
    progressPct: 0,
    clientOrg: "PT Uji",
    locationCity: "",
    locationProvince: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientTier: "Reguler",
    penaltyRisk: "Tidak ada",
    value: null,
    contractNo: "",
    contractDate: null,
    paymentTerm: "Full",
    paymentNote: "",
    taxType: "Non PKP",
    salesFee: null,
    operationalCost: null,
    startDate,
    deadline,
    ownerId,
    updatedAt: "2026-08-01",
  };
}

// Rentang menampung tanggal paling awal dan paling akhir, inklusif.
const range = timelineRange([p(1, "2026-08-01", "2026-08-10"), p(2, "2026-08-05", "2026-08-20")])!;
assert.equal(range.startDay, toDay("2026-08-01"));
assert.equal(range.endDay, toDay("2026-08-20"));
assert.equal(range.totalDays, 20);

// Proyek pertama mulai di 0% dan mengisi 10 dari 20 hari.
const bar = barPosition(p(1, "2026-08-01", "2026-08-10"), range);
assert.equal(bar.leftPct, 0);
assert.equal(bar.widthPct, 50);

// Proyek yang mulai di tengah bergeser sesuai jumlah hari lewat.
const bar2 = barPosition(p(2, "2026-08-11", "2026-08-20"), range);
assert.equal(bar2.leftPct, 50);
assert.equal(bar2.widthPct, 50);

// Satu hari tetap punya lebar, tidak nol.
assert.ok(barPosition(p(3, "2026-08-01", "2026-08-01"), range).widthPct > 0);

// Tanggal terbalik tidak bikin lebar negatif.
assert.ok(barPosition(p(4, "2026-08-10", "2026-08-01"), range).widthPct > 0);

// Daftar kosong aman.
assert.equal(timelineRange([]), null);

// Penanda bulan mencakup tiap bulan dalam rentang.
const ticks = monthTicks(timelineRange([p(5, "2026-08-01", "2026-10-05")])!);
assert.deepEqual(ticks.map((t) => t.key), ["2026-08", "2026-09", "2026-10"]);
assert.equal(ticks[0].leftPct, 0);

// Bentrok: beririsan, bersentuhan di satu hari, dan terpisah.
assert.equal(isOverlapping(p(1, "2026-08-01", "2026-08-10"), p(2, "2026-08-05", "2026-08-20")), true);
assert.equal(isOverlapping(p(1, "2026-08-01", "2026-08-10"), p(2, "2026-08-10", "2026-08-20")), true);
assert.equal(isOverlapping(p(1, "2026-08-01", "2026-08-10"), p(2, "2026-08-11", "2026-08-20")), false);

// Tiga proyek saling tumpuk: 3 pasangan, tiap proyek bentrok dengan 2 lainnya.
const semua = overlapInfo([
  p(1, "2026-08-01", "2026-08-20"),
  p(2, "2026-08-05", "2026-08-25"),
  p(3, "2026-08-10", "2026-08-30"),
]);
assert.equal(semua.pairs, 3);
assert.deepEqual([...semua.counts.values()], [2, 2, 2]);

// Proyek yang jadwalnya sendirian tetap tercatat dengan hitungan nol.
const sebagian = overlapInfo([
  p(1, "2026-08-01", "2026-08-10"),
  p(2, "2026-08-05", "2026-08-12"),
  p(3, "2026-09-01", "2026-09-05"),
]);
assert.equal(sebagian.pairs, 1);
assert.equal(sebagian.counts.get(3), 0);

// Daftar kosong aman.
assert.equal(overlapInfo([]).pairs, 0);

// Bentrok per bulan: pasangan hanya dihitung di bulan tempat irisannya jatuh.
const perBulan = overlapPerMonth([
  p(1, "2026-08-01", "2026-08-20"),
  p(2, "2026-08-10", "2026-08-25"),
  p(3, "2026-10-01", "2026-10-10"),
]);
assert.deepEqual(perBulan.map((m) => m.key), ["2026-08", "2026-09", "2026-10"]);
assert.equal(perBulan[0].pairs, 1); // Agustus: proyek 1 dan 2 bentrok.
assert.equal(perBulan[1].pairs, 0); // September: tidak ada proyek jalan.
assert.equal(perBulan[2].pairs, 0); // Oktober: proyek 3 sendirian.
assert.equal(perBulan[0].projects, 2);
assert.equal(perBulan[2].projects, 1);

// Daftar kosong aman.
assert.deepEqual(overlapPerMonth([]), []);

// fromDay membalik toDay tanpa geser zona waktu.
assert.equal(fromDay(toDay("2026-08-01")), "2026-08-01");
assert.equal(fromDay(toDay("2026-12-31")), "2026-12-31");

// Pasangan bentrok: masa irisan dan lamanya dihitung inklusif.
const daftar = overlapPairsList([
  p(1, "2026-08-01", "2026-08-10"),
  p(2, "2026-08-05", "2026-08-20"),
]);
assert.equal(daftar.length, 1);
assert.deepEqual(daftar[0], {
  a: 1,
  b: 2,
  startDate: "2026-08-05",
  endDate: "2026-08-10",
  days: 6,
  sameOwner: true,
});

// Bersentuhan satu hari tetap terhitung, terpisah tidak.
assert.equal(overlapPairsList([p(1, "2026-08-01", "2026-08-10"), p(2, "2026-08-10", "2026-08-20")])[0].days, 1);
assert.deepEqual(overlapPairsList([p(1, "2026-08-01", "2026-08-10"), p(2, "2026-08-11", "2026-08-20")]), []);
assert.deepEqual(overlapPairsList([]), []);

// Id pasangan selalu urut naik, dan hasilnya diurutkan dari bentrok terlama.
const urut = overlapPairsList([
  p(3, "2026-08-01", "2026-08-31"),
  p(1, "2026-08-01", "2026-08-03"), // irisan pendek dengan p3
  p(2, "2026-08-01", "2026-08-25"), // irisan panjang dengan p3
]);
assert.ok(urut.every((x) => x.a < x.b));
assert.deepEqual(urut.map((x) => x.days), [25, 3, 3]);
assert.deepEqual(urut.map((x) => [x.a, x.b]), [[2, 3], [1, 2], [1, 3]]);

// Jumlah pasangan konsisten dengan overlapInfo.
const acak = [
  p(1, "2026-08-01", "2026-08-20"),
  p(2, "2026-08-05", "2026-08-25"),
  p(3, "2026-09-01", "2026-09-10"),
];
assert.equal(overlapPairsList(acak).length, overlapInfo(acak).pairs);

// sameOwner membedakan bentrok kalender dari bentrok orang.
const bedaPIC = overlapPairsList([
  p(1, "2026-08-01", "2026-08-10", 1),
  p(2, "2026-08-05", "2026-08-20", 2),
]);
assert.equal(bedaPIC[0].sameOwner, false);

// Hanya bentrok milik anggota yang sama yang jadi masalah alokasi.
assert.deepEqual(
  ownerConflicts([p(1, "2026-08-01", "2026-08-10", 1), p(2, "2026-08-05", "2026-08-20", 2)]),
  []
);

const konflik = ownerConflicts([
  p(1, "2026-08-01", "2026-08-10", 1),
  p(2, "2026-08-05", "2026-08-20", 1), // bentrok dengan p1, PIC sama
  p(3, "2026-08-08", "2026-08-12", 2),
  p(4, "2026-08-09", "2026-08-30", 2), // bentrok dengan p3, PIC sama
  p(5, "2026-08-09", "2026-08-30", 3), // bentrok lintas PIC saja
]);
// Anggota 1 dan 2 sama-sama punya satu pasangan; yang totalnya lebih lama di atas.
assert.deepEqual(konflik.map((k) => k.ownerId), [1, 2]);
assert.deepEqual(konflik[0].projectIds, [1, 2]);
assert.equal(konflik[0].totalDays, 6); // 5-10 Agustus
assert.deepEqual(konflik[1].projectIds, [3, 4]);
assert.equal(konflik[1].totalDays, 4); // 9-12 Agustus
assert.ok(konflik.every((k) => k.pairs.every((x) => x.sameOwner)));
assert.deepEqual(ownerConflicts([]), []);

// Statistik: angkanya harus konsisten dengan fungsi-fungsi di atas.
const statistik = overlapStats([
  p(1, "2026-08-01", "2026-08-10", 1),
  p(2, "2026-08-05", "2026-08-20", 1), // bentrok dengan p1, PIC sama
  p(3, "2026-08-08", "2026-08-12", 2), // bentrok dengan p1 dan p2, PIC beda
  p(4, "2026-10-01", "2026-10-05", 3), // sendirian
]);
assert.equal(statistik.projects, 4);
assert.equal(statistik.pairs, 3);
assert.equal(statistik.sameOwnerPairs, 1);
assert.equal(statistik.projectsInvolved, 3); // p4 tidak terlibat
assert.equal(statistik.maxOverlapDays, 6); // p1+p2, 5-10 Agustus
assert.equal(statistik.busiestMonth?.key, "2026-08");
assert.deepEqual(statistik.byOwner.map((k) => k.ownerId), [1]);
assert.equal(statistik.range?.startDay, toDay("2026-08-01"));

// Tanpa bentrok sama sekali: bulan terpadat kosong, bukan bulan pertama.
const tenang = overlapStats([p(1, "2026-08-01", "2026-08-10"), p(2, "2026-09-01", "2026-09-10")]);
assert.equal(tenang.pairs, 0);
assert.equal(tenang.projectsInvolved, 0);
assert.equal(tenang.maxOverlapDays, 0);
assert.equal(tenang.busiestMonth, null);
assert.deepEqual(tenang.byOwner, []);

// Daftar kosong aman.
const nihil = overlapStats([]);
assert.equal(nihil.projects, 0);
assert.equal(nihil.pairs, 0);
assert.equal(nihil.busiestMonth, null);
assert.equal(nihil.range, null);
assert.deepEqual(nihil.perMonth, []);

console.log("ok: timeline");
