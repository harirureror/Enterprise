import { projectMargin } from "../finance";
import { daysUntil } from "../ui";
import type { Project, User } from "../types";

/* Bentuk data ekspor, dipakai bersama tiga format sekaligus.

   Kolomnya didefinisikan sekali di sini supaya Excel, Word, dan PDF tidak bisa
   menyajikan angka yang berbeda untuk proyek yang sama. Yang boleh berbeda
   hanya kolom mana yang dipakai: spreadsheet muat memuat semuanya, halaman
   cetak tidak.

   Nilainya disimpan mentah (angka tetap angka), bukan sudah diformat. Excel
   perlu angka asli supaya bisa dijumlah dan disaring; perenderan jadi teks
   dikerjakan masing-masing format lewat formatCell(). */

export type CellKind = "text" | "integer" | "currency" | "percent" | "date";

export type ExportColumn = {
  key: string;
  header: string;
  kind: CellKind;
  /** Lebar kira-kira dalam karakter; dipakai Excel dan penataan kolom PDF. */
  width: number;
};

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export type Dataset = {
  title: string;
  columns: ExportColumn[];
  rows: Row[];
  /** Baris keterangan di bawah judul, mis. jumlah proyek dan tanggal cetak. */
  notes: string[];
};

/* --- Kolom daftar proyek --------------------------------------------------- */

export const PROJECT_COLUMNS: ExportColumn[] = [
  { key: "id", header: "ID", kind: "integer", width: 5 },
  { key: "name", header: "Nama Proyek", kind: "text", width: 38 },
  { key: "type", header: "Jenis", kind: "text", width: 11 },
  { key: "status", header: "Status", kind: "text", width: 11 },
  { key: "priority", header: "Prioritas", kind: "text", width: 10 },
  { key: "priorityMode", header: "Mode Prioritas", kind: "text", width: 13 },
  { key: "progressPct", header: "Progres (%)", kind: "integer", width: 11 },
  { key: "owner", header: "PIC", kind: "text", width: 18 },
  { key: "startDate", header: "Mulai", kind: "date", width: 12 },
  { key: "deadline", header: "Tenggat", kind: "date", width: 12 },
  { key: "sisaHari", header: "Sisa Hari", kind: "integer", width: 10 },
  { key: "clientOrg", header: "Instansi Klien", kind: "text", width: 30 },
  { key: "locationCity", header: "Kota/Kabupaten", kind: "text", width: 20 },
  { key: "locationProvince", header: "Provinsi", kind: "text", width: 20 },
  { key: "clientName", header: "PIC Klien", kind: "text", width: 20 },
  { key: "clientEmail", header: "Email Klien", kind: "text", width: 26 },
  { key: "clientPhone", header: "Telepon Klien", kind: "text", width: 18 },
  { key: "clientTier", header: "Tingkat Kemitraan", kind: "text", width: 16 },
  { key: "penaltyRisk", header: "Risiko Penalti", kind: "text", width: 15 },
  { key: "contractNo", header: "No Kontrak", kind: "text", width: 22 },
  { key: "contractDate", header: "Tgl Kontrak", kind: "date", width: 12 },
  { key: "value", header: "Nilai Kontrak", kind: "currency", width: 16 },
  { key: "paymentTerm", header: "TOP", kind: "text", width: 11 },
  { key: "paymentNote", header: "Keterangan TOP", kind: "text", width: 34 },
  { key: "taxType", header: "Type Tax", kind: "text", width: 10 },
  { key: "revenueBase", header: "Pendapatan (DPP)", kind: "currency", width: 16 },
  { key: "salesFee", header: "Sales Fee", kind: "currency", width: 14 },
  { key: "operationalCost", header: "Cost Operasional", kind: "currency", width: 16 },
  { key: "margin", header: "Margin", kind: "currency", width: 15 },
  { key: "marginPct", header: "Margin (%)", kind: "percent", width: 10 },
  { key: "updatedAt", header: "Diperbarui", kind: "date", width: 12 },
];

/**
 * Kolom untuk format yang dicetak. Lembar kerja boleh selebar apa pun, halaman
 * A4 tidak — jadi yang dibawa ke Word dan PDF hanya yang paling sering dibaca.
 */
export const PRINT_COLUMN_KEYS = [
  "name",
  "status",
  "priority",
  "owner",
  "deadline",
  "progressPct",
  "contractNo",
  "value",
  "margin",
];

export function pickColumns(columns: ExportColumn[], keys: string[]): ExportColumn[] {
  return keys
    .map((k) => columns.find((c) => c.key === k))
    .filter((c): c is ExportColumn => c !== undefined);
}

function namaPIC(users: User[], ownerId: number): string {
  return users.find((u) => u.id === ownerId)?.name ?? "—";
}

/**
 * Satu baris per proyek. `today` bisa dikunci dari luar supaya hasilnya bisa
 * diuji — kolom "sisa hari" jelas bergerak tiap hari.
 */
export function projectRows(
  projects: Project[],
  users: User[],
  options: { today?: string } = {}
): Row[] {
  return projects.map((p) => {
    // Margin ikut diekspor karena itu yang paling sering dicari di spreadsheet,
    // dan menghitungnya ulang di Excel berarti menyalin aturan pajaknya.
    const untung = projectMargin(p);

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      priority: p.priority,
      priorityMode: p.priorityMode === "auto" ? "Otomatis" : "Manual",
      progressPct: p.progressPct,
      owner: namaPIC(users, p.ownerId),
      startDate: p.startDate,
      deadline: p.deadline,
      sisaHari: daysUntil(p.deadline, options.today),
      clientOrg: p.clientOrg,
      locationCity: p.locationCity,
      locationProvince: p.locationProvince,
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      clientPhone: p.clientPhone,
      clientTier: p.clientTier,
      penaltyRisk: p.penaltyRisk,
      contractNo: p.contractNo,
      contractDate: p.contractDate,
      value: p.value,
      paymentTerm: p.paymentTerm,
      paymentNote: p.paymentNote,
      taxType: p.taxType,
      revenueBase: untung?.revenueBase ?? null,
      salesFee: p.salesFee,
      operationalCost: p.operationalCost,
      margin: untung?.margin ?? null,
      marginPct: untung?.marginPct ?? null,
      updatedAt: p.updatedAt,
    };
  });
}

/* --- Perenderan jadi teks -------------------------------------------------- */

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/**
 * Nilai jadi teks untuk format yang dicetak.
 *
 * Tanggal sengaja tetap ISO (YYYY-MM-DD), bukan "30 Agu 2026": berkas ekspor
 * sering dibaca ulang mesin, dan bentuk ISO tidak pernah ambigu soal urutan
 * hari-bulan maupun bahasa.
 */
export function formatCell(value: Cell, kind: CellKind): string {
  if (value === null || value === "") return "—";

  switch (kind) {
    case "currency":
      return typeof value === "number" ? rupiah.format(value) : String(value);
    case "percent":
      return typeof value === "number"
        ? `${(value * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
        : String(value);
    case "integer":
      return typeof value === "number" ? value.toLocaleString("id-ID") : String(value);
    default:
      return String(value);
  }
}
