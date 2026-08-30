import type { Project } from "./types";

const DAY_MS = 86_400_000;

/** Nomor hari absolut dari tanggal ISO (UTC), supaya bebas zona waktu. */
export function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** Kebalikan `toDay`: nomor hari kembali ke tanggal ISO YYYY-MM-DD. */
export function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export type TimelineRange = {
  startDay: number;
  endDay: number;
  /** Jumlah hari inklusif (start dan end ikut dihitung). */
  totalDays: number;
};

/** Rentang yang menampung semua proyek. `null` kalau daftar kosong. */
export function timelineRange(projects: Project[]): TimelineRange | null {
  if (projects.length === 0) return null;

  let startDay = Infinity;
  let endDay = -Infinity;
  for (const p of projects) {
    startDay = Math.min(startDay, toDay(p.startDate));
    endDay = Math.max(endDay, toDay(p.deadline));
  }

  return { startDay, endDay, totalDays: endDay - startDay + 1 };
}

/** Posisi bar dalam persen terhadap lebar rentang. */
export function barPosition(project: Project, range: TimelineRange) {
  const start = toDay(project.startDate);
  const end = Math.max(toDay(project.deadline), start); // tanggal terbalik tetap terlihat
  return {
    leftPct: ((start - range.startDay) / range.totalDays) * 100,
    widthPct: ((end - start + 1) / range.totalDays) * 100,
  };
}

/** Dua proyek dianggap bentrok kalau rentang tanggalnya beririsan (inklusif). */
export function isOverlapping(a: Project, b: Project): boolean {
  return toDay(a.startDate) <= toDay(b.deadline) && toDay(b.startDate) <= toDay(a.deadline);
}

export type OverlapInfo = {
  /** id proyek → jumlah proyek lain yang jadwalnya bentrok dengannya. */
  counts: Map<number, number>;
  /** Jumlah pasangan proyek yang bentrok di seluruh rentang. */
  pairs: number;
};

/** Deteksi bentrok jadwal antar proyek. O(n²), cukup untuk skala satu divisi. */
export function overlapInfo(projects: Project[]): OverlapInfo {
  const counts = new Map<number, number>(projects.map((p) => [p.id, 0]));
  let pairs = 0;

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      if (!isOverlapping(projects[i], projects[j])) continue;
      pairs++;
      counts.set(projects[i].id, (counts.get(projects[i].id) ?? 0) + 1);
      counts.set(projects[j].id, (counts.get(projects[j].id) ?? 0) + 1);
    }
  }

  return { counts, pairs };
}

export type OverlapPair = {
  /** id proyek, selalu yang lebih kecil dulu supaya pasangan tidak dobel. */
  a: number;
  b: number;
  /** Masa bentroknya sendiri, bukan rentang masing-masing proyek. */
  startDate: string;
  endDate: string;
  /** Lama bentrok dalam hari, inklusif. */
  days: number;
  /** Dikerjakan PIC yang sama — ini bentrok orang, bukan sekadar bentrok kalender. */
  sameOwner: boolean;
};

/**
 * Daftar pasangan yang bentrok beserta masa irisannya. `overlapInfo` cuma
 * memberi jumlah; ini dipakai kalau perlu tahu proyek mana bentrok dengan
 * mana dan selama berapa hari. Urut dari yang paling lama.
 */
export function overlapPairsList(projects: Project[]): OverlapPair[] {
  const pairs: OverlapPair[] = [];

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];
      if (!isOverlapping(a, b)) continue;

      const mulai = Math.max(toDay(a.startDate), toDay(b.startDate));
      const selesai = Math.min(toDay(a.deadline), toDay(b.deadline));
      const [kecil, besar] = a.id <= b.id ? [a, b] : [b, a];

      pairs.push({
        a: kecil.id,
        b: besar.id,
        startDate: fromDay(mulai),
        endDate: fromDay(selesai),
        days: selesai - mulai + 1,
        sameOwner: a.ownerId === b.ownerId,
      });
    }
  }

  return pairs.sort((x, y) => y.days - x.days || x.a - y.a || x.b - y.b);
}

export type OwnerConflict = {
  ownerId: number;
  /** Bentrok jadwal milik anggota ini sendiri. */
  pairs: OverlapPair[];
  /** id proyek yang terlibat, tanpa duplikat. */
  projectIds: number[];
  /** Total hari bentrok, sebagai ukuran kasar beban tumpang tindih. */
  totalDays: number;
};

/**
 * Bentrok yang benar-benar jadi masalah alokasi: satu anggota memegang dua
 * proyek yang jadwalnya beririsan. Bentrok antar anggota berbeda tidak
 * dihitung di sini karena bisa dikerjakan paralel oleh tim yang berbeda.
 * Urut dari anggota yang paling padat.
 */
export function ownerConflicts(projects: Project[]): OwnerConflict[] {
  const owner = new Map(projects.map((p) => [p.id, p.ownerId]));
  const perOwner = new Map<number, OverlapPair[]>();

  for (const pair of overlapPairsList(projects)) {
    if (!pair.sameOwner) continue;
    const id = owner.get(pair.a)!;
    perOwner.set(id, [...(perOwner.get(id) ?? []), pair]);
  }

  return [...perOwner.entries()]
    .map(([ownerId, pairs]) => ({
      ownerId,
      pairs,
      projectIds: [...new Set(pairs.flatMap((p) => [p.a, p.b]))].sort((x, y) => x - y),
      totalDays: pairs.reduce((sum, p) => sum + p.days, 0),
    }))
    .sort((x, y) => y.pairs.length - x.pairs.length || y.totalDays - x.totalDays || x.ownerId - y.ownerId);
}

/** Label bulan untuk penanda sumbu waktu. */
export function monthTicks(range: TimelineRange) {
  const first = new Date(range.startDay * DAY_MS);
  const last = new Date(range.endDay * DAY_MS);
  const ticks: { key: string; label: string; leftPct: number }[] = [];

  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  while (cursor <= last) {
    const day = Math.floor(cursor.getTime() / DAY_MS);
    ticks.push({
      key: cursor.toISOString().slice(0, 7),
      label: cursor.toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" }),
      leftPct: (Math.max(day - range.startDay, 0) / range.totalDays) * 100,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return ticks;
}

export type MonthOverlap = {
  key: string;
  label: string;
  /** Pasangan proyek yang bentroknya jatuh di bulan ini. */
  pairs: number;
  /** Proyek yang jadwalnya menyentuh bulan ini. */
  projects: number;
};

/**
 * Jumlah bentrok per bulan, supaya bisa dilihat periode mana yang paling padat.
 * Satu pasangan dihitung di tiap bulan yang beririsan dengan masa bentroknya.
 */
export function overlapPerMonth(projects: Project[]): MonthOverlap[] {
  const range = timelineRange(projects);
  if (!range) return [];

  return monthTicks(range).map((tick) => {
    const monthStart = toDay(`${tick.key}-01`);
    const next = new Date(`${tick.key}-01T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const monthEnd = Math.floor(next.getTime() / DAY_MS) - 1;

    const inMonth = projects.filter(
      (p) => toDay(p.startDate) <= monthEnd && monthStart <= toDay(p.deadline)
    );

    let pairs = 0;
    for (let i = 0; i < inMonth.length; i++) {
      for (let j = i + 1; j < inMonth.length; j++) {
        const a = inMonth[i];
        const b = inMonth[j];
        if (!isOverlapping(a, b)) continue;
        // Masa bentrok kedua proyek harus benar-benar jatuh di bulan ini.
        const mulai = Math.max(toDay(a.startDate), toDay(b.startDate));
        const selesai = Math.min(toDay(a.deadline), toDay(b.deadline));
        if (mulai <= monthEnd && monthStart <= selesai) pairs++;
      }
    }

    return { key: tick.key, label: tick.label, pairs, projects: inMonth.length };
  });
}

export type OverlapStats = {
  /** Jumlah proyek yang ikut dihitung (setelah disaring). */
  projects: number;
  /** Total pasangan proyek yang jadwalnya bentrok. */
  pairs: number;
  /** Bagian dari `pairs` yang PIC-nya sama — bentrok orang, bukan cuma kalender. */
  sameOwnerPairs: number;
  /** Proyek yang punya minimal satu bentrok. */
  projectsInvolved: number;
  /** Lama bentrok terpanjang dalam hari. 0 kalau tidak ada bentrok. */
  maxOverlapDays: number;
  /** Bulan dengan bentrok terbanyak. `null` kalau tidak ada bentrok sama sekali. */
  busiestMonth: MonthOverlap | null;
  perMonth: MonthOverlap[];
  byOwner: OwnerConflict[];
  range: TimelineRange | null;
};

/** Ringkasan angka tumpang tindih jadwal, tanpa ikut membawa data proyeknya. */
export function overlapStats(projects: Project[]): OverlapStats {
  const pairs = overlapPairsList(projects);
  const { counts } = overlapInfo(projects);
  const perMonth = overlapPerMonth(projects);
  const terpadat = perMonth.reduce<MonthOverlap | null>(
    (max, m) => (max === null || m.pairs > max.pairs ? m : max),
    null
  );

  return {
    projects: projects.length,
    pairs: pairs.length,
    sameOwnerPairs: pairs.filter((p) => p.sameOwner).length,
    projectsInvolved: [...counts.values()].filter((n) => n > 0).length,
    maxOverlapDays: pairs[0]?.days ?? 0, // daftar sudah urut dari yang terlama
    busiestMonth: terpadat && terpadat.pairs > 0 ? terpadat : null,
    perMonth,
    byOwner: ownerConflicts(projects),
    range: timelineRange(projects),
  };
}
