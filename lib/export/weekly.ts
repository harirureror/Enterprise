import { entriesInRange, weekRange } from "../agenda";
import { isFinanceField } from "../permissions";
import { projectSummary } from "../summary";
import { ownerConflicts, toDay } from "../timeline";
import { isActiveStatus, type AgendaEntry, type Project, type User } from "../types";
import { formatCurrencyShort } from "../ui";
import { type ExportColumn, type Row } from "./dataset";
import { datasetToExcel, nameSheet } from "./excel";
import { datasetToPdf } from "./pdf";
import { datasetToWord, type WordSection } from "./word";

/* Laporan mingguan — satu berkas yang menjawab "pekan ini bagaimana".

   Terbuka untuk kelima peran, tapi kolom keuangannya menyesuaikan hak masing-
   masing. Isinya diturunkan dari fungsi yang sudah dipakai layar, bukan
   dihitung ulang, supaya berkasnya tidak pernah bercerita lain dari aplikasi. */

export type WeeklyInput = {
  projects: Project[];
  users: User[];
  agenda: AgendaEntry[];
  format: "excel" | "word" | "pdf";
  /** Tanggal acuan; pekan Senin-Minggu yang memuatnya yang dilaporkan. */
  tanggal: string;
  bolehKeuangan: boolean;
};

/* --- Kolom ----------------------------------------------------------------- */

const KOLOM_PROYEK: ExportColumn[] = [
  { key: "name", header: "Nama Proyek", kind: "text", width: 34 },
  { key: "owner", header: "PIC", kind: "text", width: 16 },
  { key: "status", header: "Status", kind: "text", width: 11 },
  { key: "priority", header: "Prioritas", kind: "text", width: 10 },
  { key: "deadline", header: "Tenggat", kind: "date", width: 12 },
  { key: "sisaHari", header: "Sisa Hari", kind: "integer", width: 10 },
  { key: "progressPct", header: "Progres (%)", kind: "integer", width: 11 },
  { key: "value", header: "Nilai Kontrak", kind: "currency", width: 16 },
];

const KOLOM_AGENDA: ExportColumn[] = [
  { key: "orang", header: "Anggota", kind: "text", width: 18 },
  { key: "kind", header: "Kegiatan", kind: "text", width: 12 },
  { key: "mulai", header: "Mulai", kind: "date", width: 12 },
  { key: "selesai", header: "Selesai", kind: "date", width: 12 },
  { key: "lokasi", header: "Lokasi", kind: "text", width: 26 },
  { key: "proyek", header: "Proyek", kind: "text", width: 30 },
  { key: "catatan", header: "Catatan", kind: "text", width: 34 },
];

const KOLOM_PIC: ExportColumn[] = [
  { key: "owner", header: "PIC", kind: "text", width: 18 },
  { key: "projects", header: "Proyek Bentrok", kind: "text", width: 44 },
  { key: "totalDays", header: "Total Hari", kind: "integer", width: 11 },
];

function saringKeuangan(columns: ExportColumn[], boleh: boolean): ExportColumn[] {
  return boleh ? columns : columns.filter((c) => !isFinanceField(c.key));
}

/* --- Baris ----------------------------------------------------------------- */

function barisProyek(projects: Project[], users: User[], acuan: string): Row[] {
  const nama = (id: number) => users.find((u) => u.id === id)?.name ?? "—";
  const hariIni = toDay(acuan);

  return projects.map((p) => ({
    name: p.name,
    owner: nama(p.ownerId),
    status: p.status,
    priority: p.priority,
    deadline: p.deadline,
    sisaHari: toDay(p.deadline) - hariIni,
    progressPct: p.progressPct,
    value: p.value,
  }));
}

export function barisAgenda(
  agenda: AgendaEntry[],
  users: User[],
  projects: Project[]
): Row[] {
  const nama = (id: number) => users.find((u) => u.id === id)?.name ?? `Anggota ${id}`;
  const proyek = (id: number | null) =>
    id === null ? "" : projects.find((p) => p.id === id)?.name ?? "";

  return agenda.map((a) => ({
    orang: nama(a.userId),
    kind: a.kind,
    mulai: a.startDate,
    selesai: a.endDate,
    // Kota dan provinsi digabung: di berkas cetak dua kolom sempit lebih sulit
    // dibaca daripada satu kolom yang utuh.
    lokasi: [a.locationCity, a.locationProvince].filter((x) => x !== "").join(", "),
    proyek: proyek(a.projectId),
    catatan: a.note,
  }));
}

/* --- Perakitan ------------------------------------------------------------- */

export async function berkasMingguan(input: WeeklyInput): Promise<Buffer> {
  const { projects, users, agenda, format, tanggal, bolehKeuangan } = input;
  const pekan = weekRange(tanggal);
  const ringkas = projectSummary(projects, { today: tanggal });

  const aktif = projects.filter((p) => isActiveStatus(p.status));
  // "Selesai pekan ini" dibaca dari updatedAt: itu satu-satunya jejak waktu
  // yang dipunyai proyek tanpa riwayat status tersendiri.
  const selesaiPekanIni = projects.filter(
    (p) => !isActiveStatus(p.status) && p.updatedAt >= pekan.start && p.updatedAt <= pekan.end
  );
  const telat = aktif.filter((p) => p.deadline < tanggal);
  const tenggatPekanDepan = aktif.filter(
    (p) => p.deadline >= tanggal && toDay(p.deadline) - toDay(tanggal) <= 7
  );

  const agendaPekanIni = entriesInRange(agenda, pekan.start, pekan.end);
  const konflikPIC = ownerConflicts(aktif);

  const catatan = [
    `Pekan ${pekan.start} s/d ${pekan.end} · dicetak ${tanggal}`,
    `${aktif.length} proyek aktif · ${telat.length} lewat tenggat · ${tenggatPekanDepan.length} jatuh tempo 7 hari ke depan · ${selesaiPekanIni.length} selesai pekan ini`,
    bolehKeuangan
      ? `Nilai pipeline aktif ${formatCurrencyShort(ringkas.pipelineValue)}`
      : "Kolom keuangan tidak disertakan sesuai tingkat akses Anda.",
  ];

  const kolomProyek = saringKeuangan(KOLOM_PROYEK, bolehKeuangan);

  const bagian: { nama: string; columns: ExportColumn[]; rows: Row[]; kosong: string }[] = [
    {
      nama: "Lewat Tenggat",
      columns: kolomProyek,
      rows: barisProyek(telat, users, tanggal),
      kosong: "Tidak ada proyek yang lewat tenggat.",
    },
    {
      nama: "Tenggat 7 Hari",
      columns: kolomProyek,
      rows: barisProyek(tenggatPekanDepan, users, tanggal),
      kosong: "Tidak ada tenggat dalam tujuh hari ke depan.",
    },
    {
      nama: "Selesai Pekan Ini",
      columns: kolomProyek,
      rows: barisProyek(selesaiPekanIni, users, tanggal),
      kosong: "Belum ada proyek yang selesai pekan ini.",
    },
    {
      // Bagian yang dicari HR: siapa di mana sepanjang pekan ini.
      nama: "Agenda Pekan Ini",
      columns: KOLOM_AGENDA,
      rows: barisAgenda(agendaPekanIni, users, projects),
      kosong: "Belum ada agenda tercatat untuk pekan ini.",
    },
    {
      nama: "Bentrok PIC",
      columns: KOLOM_PIC,
      rows: konflikPIC.map((k) => ({
        owner: users.find((u) => u.id === k.ownerId)?.name ?? `Anggota ${k.ownerId}`,
        projects: k.projectIds
          .map((id) => projects.find((p) => p.id === id)?.name ?? `Proyek ${id}`)
          .join(", "),
        totalDays: k.totalDays,
      })),
      kosong: "Tidak ada anggota yang dijadwalkan di dua proyek sekaligus.",
    },
  ];

  const judul = "Laporan Mingguan — Divisi Enterprise";

  if (format === "excel") {
    // Satu lembar per bagian: itu bentuk yang bisa disaring dan dijumlah orang.
    const [utama, ...sisanya] = bagian;
    return datasetToExcel(
      { title: nameSheet(utama.nama), columns: utama.columns, rows: utama.rows, notes: catatan },
      sisanya.map((b) => ({ name: nameSheet(b.nama), columns: b.columns, rows: b.rows }))
    );
  }

  if (format === "word") {
    const [utama, ...sisanya] = bagian;
    const sections: WordSection[] = sisanya.map((b) => ({
      heading: b.nama,
      paragraphs: b.rows.length === 0 ? [b.kosong] : [],
      table: b.rows.length === 0 ? undefined : { columns: b.columns, rows: b.rows },
    }));

    return datasetToWord(
      { title: `${judul} — ${utama.nama}`, columns: utama.columns, rows: utama.rows, notes: catatan },
      sections
    );
  }

  // PDF tidak punya konsep "bagian" seperti Word, jadi seluruh baris digabung
  // dengan satu kolom penanda bagian di depan — tetap terbaca sebagai satu
  // laporan, dan tetap satu tabel yang rapi.
  const kolomGabungan: ExportColumn[] = [
    { key: "bagian", header: "Bagian", kind: "text", width: 16 },
    { key: "isi", header: "Keterangan", kind: "text", width: 62 },
    { key: "detail", header: "Detail", kind: "text", width: 34 },
  ];

  const barisGabungan: Row[] = bagian.flatMap((b) =>
    b.rows.length === 0
      ? [{ bagian: b.nama, isi: b.kosong, detail: "" }]
      : b.rows.map((r) => ({
          bagian: b.nama,
          isi: ringkasBaris(b.columns, r),
          detail: String(r[b.columns[b.columns.length - 1].key] ?? ""),
        }))
  );

  return datasetToPdf({ title: judul, columns: kolomGabungan, rows: barisGabungan, notes: catatan });
}

/** Rangkum satu baris jadi satu kalimat untuk tabel PDF yang lebih sempit. */
function ringkasBaris(columns: ExportColumn[], row: Row): string {
  return columns
    .slice(0, 4)
    .map((c) => row[c.key])
    .filter((v) => v !== null && v !== "")
    .join(" · ");
}
