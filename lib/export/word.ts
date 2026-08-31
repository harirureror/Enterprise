import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { type Cell, type Dataset, type ExportColumn, type Row, formatCell } from "./dataset";

/* Ekspor .docx.

   Word dipakai orang untuk laporan yang dibaca, bukan diolah — jadi isinya
   sudah jadi teks berformat, dan kolomnya dibatasi supaya tabelnya tidak
   melar keluar halaman. */

const ABU = "F1F5F9";

function selTeks(teks: string, opsi: { tebal?: boolean; rata?: "right" } = {}): TableCell {
  return new TableCell({
    shading: opsi.tebal ? { fill: ABU } : undefined,
    children: [
      new Paragraph({
        alignment: opsi.rata === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: teks, bold: opsi.tebal, size: 18 })],
      }),
    ],
  });
}

function tabel(columns: ExportColumn[], rows: Row[]): Table {
  const total = columns.reduce((n, c) => n + c.width, 0);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // Lebar kolom mengikuti proporsi lebar yang sama dengan Excel dan PDF,
    // jadi ketiganya terlihat seperti tabel yang sama.
    columnWidths: columns.map((c) => Math.round((c.width / total) * 10000)),
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map((c) => selTeks(c.header, { tebal: true })),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: columns.map((c) =>
              selTeks(formatCell(row[c.key] ?? null, c.kind), {
                rata: angkaKanan(c, row[c.key] ?? null),
              })
            ),
          })
      ),
    ],
  });
}

function angkaKanan(c: ExportColumn, nilai: Cell): "right" | undefined {
  return typeof nilai === "number" && c.kind !== "text" ? "right" : undefined;
}

export type WordSection = {
  heading: string;
  paragraphs?: string[];
  table?: { columns: ExportColumn[]; rows: Row[] };
};

export async function datasetToWord(
  dataset: Dataset,
  sections: WordSection[] = []
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        // Bentang: tabel proyek punya banyak kolom, dan halaman tegak
        // memaksa teksnya terpotong jadi satu-dua huruf per baris.
        properties: { page: { size: { orientation: "landscape" } } },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: dataset.title }),
          ...dataset.notes.map(
            (n) =>
              new Paragraph({
                children: [new TextRun({ text: n, size: 18, color: "666666" })],
              })
          ),
          new Paragraph({ text: "" }),
          tabel(dataset.columns, dataset.rows),
          ...sections.flatMap((s) => [
            new Paragraph({ text: "" }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, text: s.heading }),
            ...(s.paragraphs ?? []).map(
              (t) => new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })
            ),
            ...(s.table ? [tabel(s.table.columns, s.table.rows)] : []),
          ]),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
