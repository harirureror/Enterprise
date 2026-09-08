import { daysUntil } from "./ui";
import { tindakLanjutTerlewat } from "./activities";
import type { ProjectActivity } from "./types";
import { isOverlapping, toDay } from "./timeline";
import { isActiveStatus, type ProgressEntry, type Project } from "./types";

/** Aktivitas beserta proyeknya — bentuk yang dibutuhkan deteksi tindak lanjut. */
type ActivityLike = Pick<
  ProjectActivity,
  "projectId" | "name" | "weight" | "status" | "slaDays" | "targetDate" | "doneDate" | "sortOrder"
>;

/* Notifikasi tidak disimpan sebagai tabel sendiri: semuanya diturunkan dari
   keadaan proyek saat ini. Konsekuensinya notifikasi tidak pernah basi — begitu
   tenggatnya diperpanjang atau progresnya dicatat, peringatannya hilang dengan
   sendirinya tanpa perlu ada yang menandai "sudah dibaca".

   ponytail: kalau nanti perlu status dibaca/diabaikan per pengguna, tabelnya
   cukup menyimpan id notifikasi + pengguna, bukan menyalin isinya. */

export type NotificationKind =
  | "terlambat"
  | "segera"
  | "mandek"
  | "bentrok"
  | "tindak-lanjut";

export type NotificationSeverity = "tinggi" | "sedang" | "info";

export type Notification = {
  /** Stabil selama keadaannya sama, jadi bisa dipakai sebagai key React. */
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  projectId: number;
  projectName: string;
  ownerId: number;
  title: string;
  detail: string;
  /** Tanggal acuan kejadian (ISO), dipakai mengurutkan. */
  date: string;
};

/** Ambang "sudah lama tidak ada kabar" dalam hari. */
export const STALE_DAYS = 14;
/** Ambang "tenggat sudah dekat" dalam hari. */
export const SOON_DAYS = 7;

const RANK: Record<NotificationSeverity, number> = { tinggi: 0, sedang: 1, info: 2 };

export const KIND_LABELS: Record<NotificationKind, string> = {
  terlambat: "Lewat tenggat",
  segera: "Segera jatuh tempo",
  mandek: "Tidak ada kabar",
  bentrok: "Bentrok jadwal",
  "tindak-lanjut": "Perlu ditindaklanjuti",
};

/**
 * Bagian halaman detail yang paling menjawab tiap jenis notifikasi. Dipakai
 * sebagai fragment URL supaya sekali klik langsung mendarat di tempat yang
 * relevan, bukan di puncak halaman.
 */
const KIND_ANCHORS: Record<NotificationKind, string> = {
  terlambat: "progres-heading",
  segera: "progres-heading",
  mandek: "riwayat-heading",
  bentrok: "bentrok-heading",
  "tindak-lanjut": "aktivitas-heading",
};

/** Tautan tujuan sebuah notifikasi. */
export function notificationHref(n: Notification): string {
  return `/proyek/${n.projectId}#${KIND_ANCHORS[n.kind]}`;
}

export type NotificationOptions = {
  /** Tanggal acuan ISO. Default hari ini. */
  today?: string;
  staleDays?: number;
  soonDays?: number;
  /**
   * Aktivitas per proyek, untuk mendeteksi tenggat tindak lanjut yang lewat —
   * misalnya penawaran yang berlaku 14 hari tapi tidak berlanjut ke negosiasi.
   * Tidak diberikan berarti jenis notifikasi itu dilewati.
   */
  activities?: ActivityLike[];
};

/**
 * Susun notifikasi dari keadaan proyek. Proyek yang sudah selesai dilewati —
 * tidak ada lagi yang perlu ditindaklanjuti di sana.
 */
export function buildNotifications(
  projects: Project[],
  history: ProgressEntry[],
  options: NotificationOptions = {}
): Notification[] {
  const asOf = options.today ?? new Date().toISOString().slice(0, 10);
  const staleDays = options.staleDays ?? STALE_DAYS;
  const soonDays = options.soonDays ?? SOON_DAYS;
  const hariIni = toDay(asOf);

  const aktif = projects.filter((p) => isActiveStatus(p.status));
  const hasil: Notification[] = [];

  // Catatan progres terakhir per proyek, dipakai mendeteksi yang mandek.
  const terakhir = new Map<number, string>();
  for (const e of history) {
    const sebelumnya = terakhir.get(e.projectId);
    if (!sebelumnya || e.createdAt > sebelumnya) terakhir.set(e.projectId, e.createdAt);
  }

  // Aktivitas dikelompokkan per proyek sekali di depan, bukan disaring ulang
  // di dalam perulangan.
  const aktivitasProyek = new Map<number, ActivityLike[]>();
  for (const a of options.activities ?? []) {
    const isi = aktivitasProyek.get(a.projectId);
    if (isi) isi.push(a);
    else aktivitasProyek.set(a.projectId, [a]);
  }

  for (const p of aktif) {
    const sisa = daysUntil(p.deadline, asOf);

    // Tenggat tindak lanjut yang lewat — mis. penawaran berlaku 14 hari dan
    // belum berlanjut. Padam sendiri begitu aktivitas berikutnya dicentang.
    for (const t of tindakLanjutTerlewat(aktivitasProyek.get(p.id) ?? [], asOf)) {
      hasil.push({
        id: `tindak-lanjut-${p.id}-${t.name}`,
        kind: "tindak-lanjut",
        severity: t.lewatHari > 7 ? "tinggi" : "sedang",
        projectId: p.id,
        projectName: p.name,
        ownerId: p.ownerId,
        title: `Tindak lanjut lewat ${t.lewatHari} hari`,
        detail: `"${t.name}" selesai ${t.doneDate}, batas tindak lanjutnya ${t.jatuhTempo}.`,
        date: t.jatuhTempo,
      });
    }

    if (sisa < 0) {
      hasil.push({
        id: `terlambat-${p.id}`,
        kind: "terlambat",
        severity: "tinggi",
        projectId: p.id,
        projectName: p.name,
        ownerId: p.ownerId,
        title: `Lewat tenggat ${Math.abs(sisa)} hari`,
        detail: `Tenggatnya ${p.deadline} dan progresnya masih ${p.progressPct}%.`,
        date: p.deadline,
      });
    } else if (sisa <= soonDays) {
      hasil.push({
        id: `segera-${p.id}`,
        kind: "segera",
        severity: "sedang",
        projectId: p.id,
        projectName: p.name,
        ownerId: p.ownerId,
        title: sisa === 0 ? "Jatuh tempo hari ini" : `Jatuh tempo ${sisa} hari lagi`,
        detail: `Tahap ${p.status}, progres ${p.progressPct}%.`,
        date: p.deadline,
      });
    }

    // Mandek dihitung dari catatan progres terakhir; kalau belum pernah ada
    // catatan sama sekali, tanggal mulai yang jadi patokan.
    const acuan = terakhir.get(p.id) ?? p.startDate;
    const diam = hariIni - toDay(acuan);
    if (diam >= staleDays && toDay(p.startDate) <= hariIni) {
      hasil.push({
        id: `mandek-${p.id}`,
        kind: "mandek",
        severity: "sedang",
        projectId: p.id,
        projectName: p.name,
        ownerId: p.ownerId,
        title: `Tidak ada catatan progres ${diam} hari`,
        detail: terakhir.has(p.id)
          ? `Catatan terakhir ${acuan}.`
          : `Belum pernah ada catatan sejak mulai ${p.startDate}.`,
        date: acuan,
      });
    }
  }

  // Bentrok jadwal hanya dilaporkan kalau PIC-nya sama — dua orang berbeda
  // mengerjakan proyek bersamaan itu normal.
  for (let i = 0; i < aktif.length; i++) {
    for (let j = i + 1; j < aktif.length; j++) {
      const a = aktif[i];
      const b = aktif[j];
      if (a.ownerId !== b.ownerId || !isOverlapping(a, b)) continue;

      const [kecil, besar] = a.id <= b.id ? [a, b] : [b, a];
      hasil.push({
        id: `bentrok-${kecil.id}-${besar.id}`,
        kind: "bentrok",
        severity: "info",
        projectId: kecil.id,
        projectName: kecil.name,
        ownerId: kecil.ownerId,
        title: "PIC menangani dua proyek sekaligus",
        detail: `Jadwal "${kecil.name}" beririsan dengan "${besar.name}".`,
        date: kecil.startDate,
      });
    }
  }

  // Paling mendesak dulu; dalam tingkat yang sama, yang tanggalnya paling lama
  // menunggu naik ke atas.
  return hasil.sort(
    (x, y) => RANK[x.severity] - RANK[y.severity] || x.date.localeCompare(y.date) || x.id.localeCompare(y.id)
  );
}

/** Jumlah notifikasi per tingkat, untuk lencana dan ringkasan. */
export function countBySeverity(list: Notification[]): Record<NotificationSeverity, number> {
  return {
    tinggi: list.filter((n) => n.severity === "tinggi").length,
    sedang: list.filter((n) => n.severity === "sedang").length,
    info: list.filter((n) => n.severity === "info").length,
  };
}
