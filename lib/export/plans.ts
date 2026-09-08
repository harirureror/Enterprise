import { coverage, planProgress, prospectWins } from "../strategy";
import type {
  PlanOutput,
  PlanProspect,
  PlanStep,
  Project,
  StrategicPlan,
  User,
} from "../types";
import { type ExportColumn, type Row } from "./dataset";
import { datasetToExcel, nameSheet } from "./excel";
import { datasetToPdf } from "./pdf";
import { datasetToWord, type WordSection } from "./word";

/* Ekspor rencana strategis.

   Memakai ketiga perender yang sudah ada, jadi tidak ada kode perenderan baru.
   Tidak ada kolom keuangan di sini sama sekali — jadi penyaringan
   `lihat-keuangan` memang tidak berlaku, dan itu ditulis di sini supaya tidak
   terbaca sebagai kelalaian. */

export type PlansInput = {
  plans: StrategicPlan[];
  steps: PlanStep[];
  prospects: PlanProspect[];
  projects: Project[];
  /** Luaran tiap rencana; diteruskan apa adanya dari store. */
  planOutputs: PlanOutput[];
  users: User[];
  format: "excel" | "word" | "pdf";
  tanggal: string;
};

export const KOLOM_RENCANA: ExportColumn[] = [
  { key: "title", header: "Rencana", kind: "text", width: 34 },
  { key: "kind", header: "Jenis", kind: "text", width: 12 },
  { key: "goal", header: "Tujuan Strategis", kind: "text", width: 18 },
  { key: "segment", header: "Segmen", kind: "text", width: 16 },
  { key: "region", header: "Wilayah", kind: "text", width: 18 },
  { key: "partner", header: "Mitra", kind: "text", width: 26 },
  { key: "status", header: "Status", kind: "text", width: 11 },
  { key: "priority", header: "Prioritas", kind: "text", width: 10 },
  { key: "owner", header: "PIC", kind: "text", width: 16 },
  { key: "startDate", header: "Mulai", kind: "date", width: 12 },
  { key: "targetDate", header: "Target", kind: "date", width: 12 },
  { key: "progres", header: "Progres (%)", kind: "integer", width: 11 },
  { key: "langkah", header: "Langkah Selesai", kind: "text", width: 14 },
  { key: "telat", header: "Langkah Telat", kind: "integer", width: 13 },
  { key: "prospek", header: "Prospek Jadi Klien", kind: "text", width: 17 },
  { key: "luaran", header: "Luaran", kind: "text", width: 34 },
  { key: "outcome", header: "Ukuran Keberhasilan", kind: "text", width: 34 },
];

const KOLOM_LANGKAH: ExportColumn[] = [
  { key: "plan", header: "Rencana", kind: "text", width: 30 },
  { key: "urutan", header: "No", kind: "integer", width: 5 },
  { key: "title", header: "Langkah", kind: "text", width: 34 },
  { key: "owner", header: "PIC", kind: "text", width: 16 },
  { key: "targetDate", header: "Target", kind: "date", width: 12 },
  { key: "status", header: "Status", kind: "text", width: 11 },
  { key: "note", header: "Catatan", kind: "text", width: 34 },
];

const KOLOM_PROSPEK: ExportColumn[] = [
  { key: "plan", header: "Rencana", kind: "text", width: 30 },
  { key: "name", header: "Calon Klien", kind: "text", width: 30 },
  { key: "contact", header: "Kontak", kind: "text", width: 20 },
  { key: "region", header: "Wilayah", kind: "text", width: 18 },
  { key: "status", header: "Status Pendekatan", kind: "text", width: 18 },
  { key: "note", header: "Catatan", kind: "text", width: 30 },
];

const KOLOM_LUARAN: ExportColumn[] = [
  { key: "plan", header: "Rencana", kind: "text", width: 30 },
  { key: "kind", header: "Jenis", kind: "text", width: 16 },
  { key: "title", header: "Judul", kind: "text", width: 40 },
  { key: "project", header: "Proyek Tertaut", kind: "text", width: 28 },
  { key: "achievedAt", header: "Tercapai", kind: "date", width: 12 },
  { key: "url", header: "Tautan", kind: "text", width: 34 },
  { key: "note", header: "Catatan", kind: "text", width: 30 },
];

const KOLOM_JANGKAUAN: ExportColumn[] = [
  { key: "region", header: "Wilayah", kind: "text", width: 22 },
  { key: "projects", header: "Proyek Berjalan", kind: "integer", width: 15 },
  { key: "plans", header: "Rencana", kind: "integer", width: 10 },
  { key: "prospects", header: "Prospek", kind: "integer", width: 10 },
  { key: "keterangan", header: "Keterangan", kind: "text", width: 24 },
];

export async function berkasRencana(input: PlansInput): Promise<Buffer> {
  const { plans, steps, prospects, projects, planOutputs, users, format, tanggal } = input;

  const nama = (id: number | null) =>
    id === null ? "" : users.find((u) => u.id === id)?.name ?? `Anggota ${id}`;
  const judulRencana = (planId: number) =>
    plans.find((p) => p.id === planId)?.title ?? `Rencana ${planId}`;

  const barisRencana: Row[] = plans.map((p) => {
    const miliknya = steps.filter((s) => s.planId === p.id);
    const prospekNya = prospects.filter((x) => x.planId === p.id);
    const progres = planProgress(miliknya, tanggal);
    const luaranNya = planOutputs.filter((o) => o.planId === p.id);

    return {
      title: p.title,
      kind: p.kind,
      goal: p.goal,
      segment: p.segment,
      region: p.region,
      partner: p.partner,
      status: p.status,
      priority: p.priority,
      owner: nama(p.ownerId),
      startDate: p.startDate,
      targetDate: p.targetDate,
      progres: progres.pct,
      langkah: `${progres.selesai}/${progres.total}`,
      telat: progres.telat,
      prospek: `${prospectWins(prospekNya)}/${prospekNya.length}`,
      luaran: luaranNya.map((o) => `${o.kind}: ${o.title}`).join(", "),
      outcome: p.outcome,
    };
  });

  /* Nomor yang tampil dihitung dari posisi dalam rencananya, bukan dari
     sort_order mentah — kunci urut boleh berlubang setelah ada yang dihapus,
     nomor di laporan tidak boleh. */
  const nomorLangkah = new Map<number, number>();
  for (const p of plans) {
    steps
      .filter((s) => s.planId === p.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((s, i) => nomorLangkah.set(s.id, i + 1));
  }

  const barisLangkah: Row[] = steps.map((s) => ({
    plan: judulRencana(s.planId),
    urutan: nomorLangkah.get(s.id) ?? s.sortOrder + 1,
    title: s.title,
    owner: nama(s.ownerId),
    targetDate: s.targetDate,
    status: s.status,
    note: s.note,
  }));

  const barisProspek: Row[] = prospects.map((x) => ({
    plan: judulRencana(x.planId),
    name: x.name,
    contact: x.contact,
    region: x.region,
    status: x.status,
    note: x.note,
  }));

  const barisLuaran: Row[] = planOutputs.map((o) => ({
    plan: judulRencana(o.planId),
    kind: o.kind,
    title: o.title,
    project: o.projectId === null ? "" : projects.find((p) => p.id === o.projectId)?.name ?? "",
    achievedAt: o.achievedAt,
    url: o.url,
    note: o.note,
  }));

  const barisJangkauan: Row[] = coverage(projects, plans, prospects).map((c) => ({
    region: c.region,
    projects: c.projects,
    plans: c.plans,
    prospects: c.prospects,
    keterangan: c.baru ? "Wilayah baru yang dituju" : "Sudah ada proyek",
  }));

  const catatan = [
    `${plans.length} rencana · ${steps.length} langkah · ${prospects.length} prospek · ${planOutputs.length} luaran · dicetak ${tanggal}`,
    "Progres diturunkan dari langkah yang tuntas; langkah yang dibatalkan tidak dihitung.",
  ];

  const bagian = [
    { nama: "Rencana", columns: KOLOM_RENCANA, rows: barisRencana, kosong: "Belum ada rencana strategis." },
    { nama: "Langkah", columns: KOLOM_LANGKAH, rows: barisLangkah, kosong: "Belum ada langkah tercatat." },
    { nama: "Prospek", columns: KOLOM_PROSPEK, rows: barisProspek, kosong: "Belum ada calon klien tercatat." },
    { nama: "Luaran", columns: KOLOM_LUARAN, rows: barisLuaran, kosong: "Belum ada luaran tercatat." },
    { nama: "Jangkauan", columns: KOLOM_JANGKAUAN, rows: barisJangkauan, kosong: "Belum ada wilayah tercatat." },
  ];

  const judul = "Rencana Strategis — Divisi Enterprise";

  if (format === "excel") {
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

    /* Word dibaca orang, jadi kekosongan dikatakan — bukan disajikan sebagai
       tabel berkepala tanpa isi seperti di Excel. Bagian lain sudah dapat
       kalimatnya lewat `paragraphs`; bagian utama tidak punya tempat itu, jadi
       kalimatnya diselipkan sebagai catatan. */
    const catatanUtama = utama.rows.length === 0 ? [utama.kosong, ...catatan] : catatan;

    return datasetToWord(
      {
        title: `${judul} — ${utama.nama}`,
        columns: utama.columns,
        rows: utama.rows,
        notes: catatanUtama,
      },
      sections
    );
  }

  /* PDF tidak punya konsep "bagian" seperti Word, jadi seluruh baris digabung
     dengan satu kolom penanda bagian di depan — tetap terbaca sebagai satu
     laporan, dan tetap satu tabel yang rapi. */
  const kolomGabungan: ExportColumn[] = [
    { key: "bagian", header: "Bagian", kind: "text", width: 14 },
    { key: "isi", header: "Keterangan", kind: "text", width: 64 },
    { key: "detail", header: "Detail", kind: "text", width: 30 },
  ];

  const barisGabungan: Row[] = bagian.flatMap((b) =>
    b.rows.length === 0
      ? [{ bagian: b.nama, isi: b.kosong, detail: "" }]
      : b.rows.map((r) => ({
          bagian: b.nama,
          isi: b.columns
            .slice(0, 4)
            .map((c) => r[c.key])
            .filter((v) => v !== null && v !== "")
            .join(" · "),
          detail: String(r[b.columns[b.columns.length - 1].key] ?? ""),
        }))
  );

  return datasetToPdf({ title: judul, columns: kolomGabungan, rows: barisGabungan, notes: catatan });
}
