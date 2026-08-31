import writeXlsxFile from "write-excel-file/node";
import type { CellKind, Dataset, ExportColumn, Row } from "./dataset";

/* Ekspor .xlsx.

   Angka ditulis sebagai angka, bukan teks berformat — inilah bedanya dengan
   PDF dan Word. Orang membuka spreadsheet justru untuk menjumlah, menyaring,
   dan membuat pivot; nilai "Rp 505.000.000" sebagai teks membatalkan semua itu. */

/** Format angka Excel per jenis kolom. */
const NUMBER_FORMAT: Partial<Record<CellKind, string>> = {
  // Tanpa simbol Rp: kolomnya sudah berjudul, dan simbol per sel bikin lebar
  // kolom melar tanpa menambah informasi.
  currency: "#,##0",
  integer: "#,##0",
  percent: "0,0%",
};

type SheetCell = {
  value?: string | number | null;
  type?: typeof String | typeof Number;
  format?: string;
  fontWeight?: "bold";
  align?: "left" | "center" | "right";
  wrap?: boolean;
  backgroundColor?: string;
  color?: string;
};

function isiSel(nilai: Row[string], kind: CellKind): SheetCell {
  if (nilai === null || nilai === "") return { value: null };

  if (typeof nilai === "number") {
    return {
      value: nilai,
      type: Number,
      format: NUMBER_FORMAT[kind],
      align: "right",
    };
  }

  // Tanggal tetap teks ISO. Mengubahnya jadi Date berarti menyerahkan
  // penafsiran zona waktu ke Excel, dan tanggal yang bergeser sehari di
  // laporan kontrak jauh lebih merugikan daripada kolom yang tidak bisa
  // difilter sebagai tanggal. ISO tetap terurut benar secara teks.
  return { value: nilai, type: String };
}

export async function datasetToExcel(
  dataset: Dataset,
  extraSheets: { name: string; columns: ExportColumn[]; rows: Row[] }[] = []
): Promise<Buffer> {
  const lembar = [
    { name: dataset.title, columns: dataset.columns, rows: dataset.rows },
    ...extraSheets,
  ];

  // Selalu lewat jalur banyak-lembar, walau lembarnya cuma satu: satu jalur
  // kode berarti satu perilaku yang perlu diuji.
  const sheets = lembar.map((s) => ({
    sheet: nameSheet(s.name),
    // Baris kepala dibekukan — hal pertama yang dilakukan orang pada tabel
    // panjang, jadi sekalian disiapkan.
    stickyRowsCount: 1,
    columns: s.columns.map((c) => ({ width: c.width })),
    data: [
      s.columns.map(
        (c): SheetCell => ({
          value: c.header,
          fontWeight: "bold" as const,
          // Kepala tabel diberi latar supaya tetap terbaca sebagai kepala
          // setelah dicetak hitam-putih.
          backgroundColor: "#EEF2F7",
          align: "left" as const,
          wrap: true,
        })
      ),
      ...s.rows.map((row) => s.columns.map((c) => isiSel(row[c.key] ?? null, c.kind))),
    ],
  }));

  const hasil = await writeXlsxFile(sheets as never, {
    fontFamily: "Calibri",
    fontSize: 11,
  });

  return (hasil as unknown as { toBuffer(): Promise<Buffer> }).toBuffer();
}

/**
 * Nama lembar Excel tidak boleh memuat : \ / ? * [ ] dan maksimal 31 karakter.
 * Dibersihkan di sini, bukan di pemanggil, supaya judul boleh ditulis bebas.
 */
export function nameSheet(judul: string): string {
  const bersih = judul.replace(/[:\\/?*[\]]/g, " ").trim();
  return (bersih.length > 31 ? bersih.slice(0, 31) : bersih) || "Sheet1";
}
