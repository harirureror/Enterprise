import {
  type TimelineRange,
  overlapInfo,
  overlapPairsList,
  ownerConflicts,
  timelineRange,
  toDay,
} from "../timeline";
import type { Project, User } from "../types";
import type { ExportColumn, Row } from "./dataset";

/* Data timeline untuk diekspor.

   Semua hitungannya dipinjam dari lib/timeline.ts — yang sama dipakai layar —
   supaya berkas ekspor tidak pernah bercerita lain dari grafik yang dilihat
   orang saat menekan tombolnya. */

export const TIMELINE_COLUMNS: ExportColumn[] = [
  { key: "name", header: "Nama Proyek", kind: "text", width: 38 },
  { key: "owner", header: "PIC", kind: "text", width: 18 },
  { key: "status", header: "Status", kind: "text", width: 11 },
  { key: "priority", header: "Prioritas", kind: "text", width: 10 },
  { key: "startDate", header: "Mulai", kind: "date", width: 12 },
  { key: "deadline", header: "Tenggat", kind: "date", width: 12 },
  { key: "durasi", header: "Durasi (hari)", kind: "integer", width: 13 },
  { key: "bentrok", header: "Bentrok", kind: "integer", width: 9 },
];

export function timelineRows(projects: Project[], users: User[]): Row[] {
  const { counts } = overlapInfo(projects);
  const nama = (id: number) => users.find((u) => u.id === id)?.name ?? "—";

  return projects.map((p) => ({
    name: p.name,
    owner: nama(p.ownerId),
    status: p.status,
    priority: p.priority,
    startDate: p.startDate,
    deadline: p.deadline,
    // Inklusif: proyek yang mulai dan berakhir di hari yang sama berdurasi 1.
    durasi: toDay(p.deadline) - toDay(p.startDate) + 1,
    bentrok: counts.get(p.id) ?? 0,
  }));
}

export type OverlapLine = {
  a: string;
  b: string;
  periode: string;
  days: number;
  sameOwner: boolean;
};

/** Pasangan jadwal yang beririsan, terlama dulu — sama urutannya dengan layar. */
export function overlapLines(projects: Project[]): OverlapLine[] {
  const nama = (id: number) => projects.find((p) => p.id === id)?.name ?? `Proyek ${id}`;

  return overlapPairsList(projects).map((pair) => ({
    a: nama(pair.a),
    b: nama(pair.b),
    periode: `${pair.startDate} s/d ${pair.endDate}`,
    days: pair.days,
    sameOwner: pair.sameOwner,
  }));
}

export type OwnerConflictLine = {
  owner: string;
  projects: string;
  pairs: number;
  totalDays: number;
};

/** Bentrok yang PIC-nya sama — ini yang benar-benar masalah alokasi orang. */
export function ownerConflictLines(projects: Project[], users: User[]): OwnerConflictLine[] {
  const namaProyek = (id: number) => projects.find((p) => p.id === id)?.name ?? `Proyek ${id}`;

  return ownerConflicts(projects).map((k) => ({
    owner: users.find((u) => u.id === k.ownerId)?.name ?? `Anggota ${k.ownerId}`,
    projects: k.projectIds.map(namaProyek).join(", "),
    pairs: k.pairs.length,
    totalDays: k.totalDays,
  }));
}

export type TimelineSummary = {
  projects: number;
  pairs: number;
  sameOwnerPairs: number;
  range: TimelineRange | null;
  /** Rentang dalam bentuk yang bisa dibaca, "—" kalau daftarnya kosong. */
  periode: string;
};

export function timelineSummary(projects: Project[]): TimelineSummary {
  const range = timelineRange(projects);
  const pairs = overlapPairsList(projects);

  return {
    projects: projects.length,
    pairs: pairs.length,
    sameOwnerPairs: pairs.filter((p) => p.sameOwner).length,
    range,
    periode:
      projects.length === 0 || range === null
        ? "—"
        : `${projects.reduce((min, p) => (p.startDate < min ? p.startDate : min), projects[0].startDate)} s/d ${projects.reduce((max, p) => (p.deadline > max ? p.deadline : max), projects[0].deadline)}`,
  };
}
