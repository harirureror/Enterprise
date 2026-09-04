import { fromDay, toDay } from "./timeline";
import type { AgendaKind, User } from "./types";

/* Hitungan agenda tim.

   Dipisah dari React supaya bisa diuji tanpa DOM, dan aritmetika tanggalnya
   meminjam toDay()/fromDay() dari lib/timeline.ts ketimbang menulis ulang —
   dua penanggalan yang berbeda di satu aplikasi cepat atau lambat akan
   berselisih sehari. */

/** Bentuk minimum yang dibutuhkan hitungan di sini. */
export type AgendaLike = {
  id: number;
  userId: number;
  kind: AgendaKind;
  /** ISO date, inklusif di kedua ujungnya. */
  startDate: string;
  endDate: string;
};

export type Week = {
  /** Senin, ISO date. */
  start: string;
  /** Minggu, ISO date. */
  end: string;
  /** Ketujuh harinya, Senin lebih dulu. */
  days: string[];
};

const HARI = 7;

/**
 * Pekan Senin-Minggu yang memuat tanggal acuan.
 *
 * Senin dipilih sebagai awal pekan karena itu awal pekan kerja di sini; dengan
 * awal Minggu, pekerjaan Sabtu dan Senin berikutnya jatuh di kolom yang jauh.
 * `today` bisa dikunci dari luar supaya hasilnya bisa diuji.
 */
export function weekRange(today?: string): Week {
  const acuan = today ?? new Date().toISOString().slice(0, 10);
  const hari = toDay(acuan);

  // getUTCDay(): 0 = Minggu, 1 = Senin. (hari + 4) % 7 karena hari ke-0 epoch
  // (1970-01-01) jatuh di Kamis, jadi Senin ada di sisa 4.
  const sejakSenin = ((hari % HARI) + HARI - 4) % HARI;
  const senin = hari - sejakSenin;

  return {
    start: fromDay(senin),
    end: fromDay(senin + 6),
    days: Array.from({ length: HARI }, (_, i) => fromDay(senin + i)),
  };
}

/** Geser pekan maju atau mundur. `arah` dalam satuan pekan. */
export function shiftWeek(week: Week, arah: number): Week {
  return weekRange(fromDay(toDay(week.start) + arah * HARI));
}

/**
 * Agenda yang menyentuh rentang ini — beririsan, bukan termuat seluruhnya.
 *
 * Ini bedanya yang paling mudah salah: agenda yang mulai pekan lalu dan
 * berakhir pekan ini tetap harus muncul di pekan ini, karena orangnya memang
 * sedang di sana.
 */
export function entriesInRange<T extends AgendaLike>(
  entries: T[],
  start: string,
  end: string
): T[] {
  return entries.filter((a) => a.startDate <= end && a.endDate >= start);
}

/** Satu agenda menyentuh satu hari tertentu? */
export function coversDay(entry: AgendaLike, date: string): boolean {
  return entry.startDate <= date && entry.endDate >= date;
}

export type AgendaCell<T extends AgendaLike> = {
  date: string;
  /** Bisa lebih dari satu — itu justru tanda bentrok. */
  entries: T[];
};

export type AgendaRow<T extends AgendaLike> = {
  user: User;
  cells: AgendaCell<T>[];
  /** Jumlah agenda orang ini di pekan tersebut, untuk keterangan ringkas. */
  total: number;
};

/**
 * Baris per orang, tujuh kolom per hari — bentuk yang langsung dipakai tabel.
 *
 * Anggota tanpa agenda tetap dapat barisnya: "tidak ada agenda" adalah
 * informasi yang dicari HR, bukan alasan menghilangkan orangnya dari daftar.
 */
export function weekGrid<T extends AgendaLike>(
  entries: T[],
  users: User[],
  week: Week
): AgendaRow<T>[] {
  const sepekan = entriesInRange(entries, week.start, week.end);

  return users.map((user) => {
    const miliknya = sepekan.filter((a) => a.userId === user.id);
    return {
      user,
      total: miliknya.length,
      cells: week.days.map((date) => ({
        date,
        entries: miliknya.filter((a) => coversDay(a, date)),
      })),
    };
  });
}

export type AgendaClash = {
  userId: number;
  a: number;
  b: number;
  /** Masa beririsan, inklusif. */
  startDate: string;
  endDate: string;
};

/**
 * Dua agenda milik orang yang sama yang tanggalnya beririsan.
 *
 * Hanya orang yang sama: dua orang di lokasi berbeda pada hari yang sama itu
 * biasa, satu orang di dua tempat sekaligus yang tidak mungkin.
 */
export function agendaClashes<T extends AgendaLike>(entries: T[]): AgendaClash[] {
  const hasil: AgendaClash[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.userId !== b.userId) continue;
      if (a.startDate > b.endDate || b.startDate > a.endDate) continue;

      const [kecil, besar] = a.id <= b.id ? [a, b] : [b, a];
      hasil.push({
        userId: a.userId,
        a: kecil.id,
        b: besar.id,
        startDate: a.startDate > b.startDate ? a.startDate : b.startDate,
        endDate: a.endDate < b.endDate ? a.endDate : b.endDate,
      });
    }
  }

  return hasil.sort((x, y) => x.userId - y.userId || x.a - y.a || x.b - y.b);
}

/** Lama agenda dalam hari, inklusif. Selalu minimal 1. */
export function durationDays(entry: AgendaLike): number {
  return Math.max(toDay(entry.endDate) - toDay(entry.startDate) + 1, 1);
}

/** Label hari untuk kepala tabel, mis. "Sen 31/8". */
export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const hari = d.toLocaleDateString("id-ID", { weekday: "short", timeZone: "UTC" });
  return `${hari} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}
