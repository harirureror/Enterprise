"use server";

import { getAgenda, getProjects, getUsers } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { can, isFinanceField } from "@/lib/permissions";
import {
  PRINT_COLUMN_KEYS,
  PROJECT_COLUMNS,
  type Dataset,
  pickColumns,
  projectRows,
} from "@/lib/export/dataset";
import { datasetToExcel, nameSheet } from "@/lib/export/excel";
import { datasetToPdf, timelineToPdf } from "@/lib/export/pdf";
import {
  TIMELINE_COLUMNS,
  overlapLines,
  ownerConflictLines,
  timelineRows,
  timelineSummary,
} from "@/lib/export/timeline-dataset";
import { datasetToWord } from "@/lib/export/word";
import { berkasMingguan } from "@/lib/export/weekly";
import { berkasRencana } from "@/lib/export/plans";
import * as store from "@/lib/db/store";
import type { Project } from "@/lib/types";

/* Ekspor berkas.

   Sengaja server action, bukan route handler — alasan yang sama dengan
   lib/actions.ts: route handler punya salinan modul sendiri, jadi berkas yang
   dibuat di sana akan memuat data awal, bukan perubahan yang baru disimpan
   orang lewat form. Ekspor yang diam-diam basi jauh lebih berbahaya daripada
   ekspor yang gagal.

   Isinya dikembalikan sebagai base64: nilai balik server action diserialisasi
   RSC, dan string dijamin aman melewatinya. Untuk ukuran laporan divisi
   (puluhan sampai ribuan baris) tambahan 33% dari base64 tidak terasa. */

export type ExportFormat = "excel" | "word" | "pdf";
export type ExportScope = "proyek" | "timeline" | "mingguan" | "rencana";

export type ExportResult =
  | { ok: true; filename: string; mime: string; base64: string }
  | { ok: false; error: string };

const MIME: Record<ExportFormat, string> = {
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

const EKSTENSI: Record<ExportFormat, string> = {
  excel: "xlsx",
  word: "docx",
  pdf: "pdf",
};

const FORMATS: ExportFormat[] = ["excel", "word", "pdf"];
const SCOPES: ExportScope[] = ["proyek", "timeline", "mingguan", "rencana"];

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ambil proyek sesuai id yang sedang tampil di layar, dengan urutan yang sama.
 *
 * Yang dikirim klien hanya id — nilainya tetap dibaca ulang di server, jadi
 * berkas tidak bisa memuat angka yang sudah usang di tab yang lama dibuka.
 * Daftar kosong berarti "tidak disaring": ekspor seluruh proyek.
 */
async function pilihProyek(ids: number[] | undefined): Promise<Project[]> {
  const semua = await getProjects();
  if (!ids || ids.length === 0) return semua;

  return ids
    .map((id) => semua.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);
}

/** Berkas ekspor daftar proyek maupun timeline, dalam salah satu dari tiga format. */
export async function exportProjects(
  scope: ExportScope,
  format: ExportFormat,
  ids?: number[]
): Promise<ExportResult> {
  // Keduanya datang dari klien, jadi tetap dicocokkan ke daftar yang sah.
  if (!SCOPES.includes(scope)) return { ok: false, error: "Jenis ekspor tidak dikenal." };
  if (!FORMATS.includes(format)) return { ok: false, error: "Format ekspor tidak dikenal." };

  const pengguna = await getSessionUser();
  if (!pengguna) return { ok: false, error: "Perlu masuk untuk mengunduh berkas." };
  if (!can(pengguna.accessLevel, "ekspor")) {
    return { ok: false, error: "Akses Anda tidak mencakup ekspor." };
  }

  // Ditentukan sekali di sini, lalu diteruskan ke pembentuk dataset. Kolomnya
  // dibuang SEBELUM berkasnya dibentuk, jadi angka keuangan tidak pernah ikut
  // tertulis untuk peran yang tidak berhak — bukan disembunyikan belakangan.
  const bolehKeuangan = can(pengguna.accessLevel, "lihat-keuangan");

  try {
    const projects = await pilihProyek(ids);
    const users = await getUsers();
    const tanggal = hariIni();

    const isi =
      scope === "rencana"
        ? await berkasRencana({
            plans: store.plans.all(),
            steps: store.planSteps.all(),
            prospects: store.planProspects.all(),
            // Seluruh proyek, bukan hasil saring layar: kaitan rencana-proyek
            // tidak ada hubungannya dengan filter daftar proyek.
            projects: await getProjects(),
            planOutputs: store.planOutputs.all(),
            users,
            format,
            tanggal,
          })
        : scope === "mingguan"
        ? await berkasMingguan({
            projects,
            users,
            agenda: await getAgenda(),
            format,
            tanggal,
            bolehKeuangan,
          })
        : scope === "timeline"
          ? await berkasTimeline(projects, users, format, tanggal)
          : await berkasProyek(projects, users, format, tanggal, bolehKeuangan);

    return {
      ok: true,
      filename: `${scope}-${tanggal}.${EKSTENSI[format]}`,
      mime: MIME[format],
      base64: isi.toString("base64"),
    };
  } catch (err) {
    // Kegagalan pembuatan berkas tidak boleh menjatuhkan halamannya.
    console.error("Ekspor gagal:", err);
    return { ok: false, error: "Berkas gagal dibuat. Coba lagi atau kurangi jumlah barisnya." };
  }
}

async function berkasProyek(
  projects: Project[],
  users: Awaited<ReturnType<typeof getUsers>>,
  format: ExportFormat,
  tanggal: string,
  bolehKeuangan: boolean
): Promise<Buffer> {
  const rows = projectRows(projects, users, { today: tanggal });
  const catatan = [
    `${projects.length} proyek · dicetak ${tanggal}`,
    bolehKeuangan
      ? "Nilai kontrak untuk klien PKP sudah termasuk PPN; margin dihitung dari DPP."
      : "Kolom keuangan tidak disertakan sesuai tingkat akses Anda.",
  ];

  // Penyaringan kolom, bukan penimpaan nilai: baris yang nilainya dikosongkan
  // akan terbaca "belum diisi", dan itu berbohong soal kelengkapan data.
  const kolom = bolehKeuangan
    ? PROJECT_COLUMNS
    : PROJECT_COLUMNS.filter((c) => !isFinanceField(c.key));

  if (format === "excel") {
    // Spreadsheet dapat seluruh kolom: di sinilah orang menyaring dan menjumlah.
    return datasetToExcel({
      title: nameSheet("Daftar Proyek"),
      columns: kolom,
      rows,
      notes: catatan,
    });
  }

  // Word dan PDF dicetak, jadi kolomnya dibatasi supaya tidak melar ke luar halaman.
  const dataset: Dataset = {
    title: "Daftar Proyek — Divisi Enterprise",
    columns: pickColumns(kolom, PRINT_COLUMN_KEYS),
    rows,
    notes: catatan,
  };

  return format === "word" ? datasetToWord(dataset) : datasetToPdf(dataset);
}

async function berkasTimeline(
  projects: Project[],
  users: Awaited<ReturnType<typeof getUsers>>,
  format: ExportFormat,
  tanggal: string
): Promise<Buffer> {
  const rows = timelineRows(projects, users);
  const ringkas = timelineSummary(projects);
  const bentrok = overlapLines(projects);
  const konflikPIC = ownerConflictLines(projects, users);

  const catatan = [
    `${ringkas.projects} proyek · periode ${ringkas.periode} · dicetak ${tanggal}`,
    `${ringkas.pairs} pasang jadwal tumpang tindih, ${ringkas.sameOwnerPairs} di antaranya PIC-nya sama.`,
  ];

  if (format === "pdf") {
    // PDF dapat Gantt sungguhan — itu satu-satunya format di sini yang bisa
    // menggambar, dan bentuk visual justru inti dari timeline.
    return timelineToPdf(projects, { title: "Timeline Proyek — Divisi Enterprise", notes: catatan });
  }

  const dataset: Dataset = {
    title: format === "excel" ? nameSheet("Timeline") : "Timeline Proyek — Divisi Enterprise",
    columns: TIMELINE_COLUMNS,
    rows,
    notes: catatan,
  };

  const kolomBentrok = [
    { key: "a", header: "Proyek A", kind: "text" as const, width: 30 },
    { key: "b", header: "Proyek B", kind: "text" as const, width: 30 },
    { key: "periode", header: "Masa Bentrok", kind: "text" as const, width: 26 },
    { key: "days", header: "Hari", kind: "integer" as const, width: 8 },
    { key: "sameOwner", header: "PIC Sama", kind: "text" as const, width: 11 },
  ];
  const barisBentrok = bentrok.map((b) => ({ ...b, sameOwner: b.sameOwner ? "Ya" : "Tidak" }));

  const kolomPIC = [
    { key: "owner", header: "PIC", kind: "text" as const, width: 20 },
    { key: "projects", header: "Proyek", kind: "text" as const, width: 46 },
    { key: "pairs", header: "Pasangan", kind: "integer" as const, width: 11 },
    { key: "totalDays", header: "Total Hari", kind: "integer" as const, width: 11 },
  ];

  if (format === "excel") {
    return datasetToExcel(dataset, [
      { name: nameSheet("Bentrok Jadwal"), columns: kolomBentrok, rows: barisBentrok },
      { name: nameSheet("Bentrok PIC"), columns: kolomPIC, rows: konflikPIC },
    ]);
  }

  return datasetToWord(dataset, [
    {
      heading: "Jadwal yang Tumpang Tindih",
      paragraphs:
        bentrok.length === 0 ? ["Tidak ada jadwal yang beririsan pada rentang ini."] : [],
      table: bentrok.length === 0 ? undefined : { columns: kolomBentrok, rows: barisBentrok },
    },
    {
      heading: "Bentrok Alokasi PIC",
      paragraphs:
        konflikPIC.length === 0
          ? ["Tidak ada anggota yang dijadwalkan di dua proyek sekaligus."]
          : [],
      table: konflikPIC.length === 0 ? undefined : { columns: kolomPIC, rows: konflikPIC },
    },
  ]);
}
