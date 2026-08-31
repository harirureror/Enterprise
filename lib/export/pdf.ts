import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import { barPosition, monthTicks, timelineRange } from "../timeline";
import type { Project } from "../types";
import { type Dataset, type ExportColumn, formatCell } from "./dataset";

/* Ekspor .pdf.

   pdf-lib tidak punya mesin tata letak, jadi tabel dan Gantt digambar sendiri.
   Justru itu yang dibutuhkan di sini: bar Gantt memang persegi panjang, dan
   posisinya diambil dari barPosition() — fungsi yang sama dengan yang dipakai
   layar, sehingga grafik cetak tidak bisa bergeser dari grafik di aplikasi. */

// A4 mendatar. Tegak tidak cukup untuk tabel maupun rentang bulan.
const LEBAR = 841.89;
const TINGGI = 595.28;
const MARGIN = 32;

const HITAM = rgb(0.09, 0.11, 0.15);
const ABU = rgb(0.42, 0.45, 0.5);
const GARIS = rgb(0.85, 0.87, 0.9);
const KEPALA = rgb(0.93, 0.95, 0.97);

/** Warna bar mengikuti level prioritas, sama peranannya dengan di layar. */
const WARNA_PRIORITAS: Record<Project["priority"], ReturnType<typeof rgb>> = {
  Tinggi: rgb(0.86, 0.25, 0.24),
  Sedang: rgb(0.9, 0.62, 0.16),
  Rendah: rgb(0.55, 0.59, 0.64),
};

/* --- Teks ------------------------------------------------------------------ */

/**
 * Font standar PDF hanya mengenal WinAnsi, dan pdf-lib melempar begitu ada
 * karakter di luar itu. Nama proyek datang dari isian orang, jadi teksnya
 * dijinakkan lebih dulu — berkas yang tercetak dengan satu tanda tanya jauh
 * lebih baik daripada ekspor yang gagal total.
 */
const GANTI: Record<string, string> = {
  "—": "-",
  "–": "-",
  "−": "-",
  "·": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "•": "-",
};

export function aman(teks: string): string {
  return [...teks]
    .map((c) => {
      if (GANTI[c] !== undefined) return GANTI[c];
      const kode = c.codePointAt(0)!;
      if (kode === 0x0a || kode === 0x09) return " ";
      // 0x20-0x7E ASCII tercetak, 0xA0-0xFF Latin-1 yang ditanggung WinAnsi.
      if ((kode >= 0x20 && kode <= 0x7e) || (kode >= 0xa0 && kode <= 0xff)) return c;
      return "?";
    })
    .join("");
}

/** Potong teks agar muat di lebar tertentu, dengan elipsis kalau kepanjangan. */
export function potong(teks: string, font: PDFFont, size: number, maxWidth: number): string {
  const bersih = aman(teks);
  if (font.widthOfTextAtSize(bersih, size) <= maxWidth) return bersih;

  let hasil = bersih;
  while (hasil.length > 1 && font.widthOfTextAtSize(`${hasil}...`, size) > maxWidth) {
    hasil = hasil.slice(0, -1);
  }
  return `${hasil}...`;
}

type Konteks = {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
};

function halamanBaru(ctx: Konteks): PDFPage {
  return ctx.pdf.addPage([LEBAR, TINGGI]);
}

function judulHalaman(ctx: Konteks, page: PDFPage, dataset: Dataset): number {
  let y = TINGGI - MARGIN - 14;
  page.drawText(potong(dataset.title, ctx.bold, 15, LEBAR - MARGIN * 2), {
    x: MARGIN,
    y,
    size: 15,
    font: ctx.bold,
    color: HITAM,
  });

  y -= 14;
  for (const catatan of dataset.notes) {
    page.drawText(potong(catatan, ctx.font, 8.5, LEBAR - MARGIN * 2), {
      x: MARGIN,
      y,
      size: 8.5,
      font: ctx.font,
      color: ABU,
    });
    y -= 11;
  }

  return y - 6;
}

/** Nomor halaman ditulis belakangan, saat jumlah halamannya sudah pasti. */
function nomorHalaman(ctx: Konteks): void {
  const halaman = ctx.pdf.getPages();
  halaman.forEach((page, i) => {
    const teks = `Halaman ${i + 1} dari ${halaman.length}`;
    page.drawText(teks, {
      x: LEBAR - MARGIN - ctx.font.widthOfTextAtSize(teks, 8),
      y: MARGIN - 12,
      size: 8,
      font: ctx.font,
      color: ABU,
    });
  });
}

async function buatKonteks(): Promise<Konteks> {
  const pdf = await PDFDocument.create();
  return {
    pdf,
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
}

/* --- Tabel ----------------------------------------------------------------- */

const BARIS_TINGGI = 16;

function lebarKolom(columns: ExportColumn[]): number[] {
  const total = columns.reduce((n, c) => n + c.width, 0);
  const tersedia = LEBAR - MARGIN * 2;
  return columns.map((c) => (c.width / total) * tersedia);
}

function gambarKepala(
  ctx: Konteks,
  page: PDFPage,
  columns: ExportColumn[],
  lebar: number[],
  y: number
): number {
  page.drawRectangle({
    x: MARGIN,
    y: y - BARIS_TINGGI + 4,
    width: LEBAR - MARGIN * 2,
    height: BARIS_TINGGI,
    color: KEPALA,
  });

  let x = MARGIN + 4;
  columns.forEach((c, i) => {
    page.drawText(potong(c.header, ctx.bold, 8, lebar[i] - 8), {
      x,
      y: y - BARIS_TINGGI + 9,
      size: 8,
      font: ctx.bold,
      color: HITAM,
    });
    x += lebar[i];
  });

  return y - BARIS_TINGGI;
}

export async function datasetToPdf(dataset: Dataset): Promise<Buffer> {
  const ctx = await buatKonteks();
  const lebar = lebarKolom(dataset.columns);

  let page = halamanBaru(ctx);
  let y = judulHalaman(ctx, page, dataset);
  y = gambarKepala(ctx, page, dataset.columns, lebar, y);

  for (const row of dataset.rows) {
    // Halaman penuh: mulai halaman baru dan ulangi kepala tabelnya, supaya
    // kolom di halaman kedua dan seterusnya tetap punya judul.
    if (y - BARIS_TINGGI < MARGIN) {
      page = halamanBaru(ctx);
      y = TINGGI - MARGIN - 10;
      y = gambarKepala(ctx, page, dataset.columns, lebar, y);
    }

    let x = MARGIN + 4;
    dataset.columns.forEach((c, i) => {
      const nilai = row[c.key] ?? null;
      const teks = formatCell(nilai, c.kind);
      const angka = typeof nilai === "number" && c.kind !== "text";
      const dipotong = potong(teks, ctx.font, 8, lebar[i] - 8);

      page.drawText(dipotong, {
        // Angka dirata kanan supaya digitnya sejajar dan mudah dibandingkan.
        x: angka ? x + lebar[i] - 8 - ctx.font.widthOfTextAtSize(dipotong, 8) : x,
        y: y - 11,
        size: 8,
        font: ctx.font,
        color: HITAM,
      });
      x += lebar[i];
    });

    page.drawLine({
      start: { x: MARGIN, y: y - BARIS_TINGGI + 3 },
      end: { x: LEBAR - MARGIN, y: y - BARIS_TINGGI + 3 },
      thickness: 0.5,
      color: GARIS,
    });
    y -= BARIS_TINGGI;
  }

  if (dataset.rows.length === 0) {
    page.drawText("Tidak ada data yang cocok dengan filter.", {
      x: MARGIN,
      y: y - 14,
      size: 9,
      font: ctx.font,
      color: ABU,
    });
  }

  nomorHalaman(ctx);
  return Buffer.from(await ctx.pdf.save());
}

/* --- Gantt ----------------------------------------------------------------- */

const NAMA_LEBAR = 190;
const GANTT_BARIS = 18;

/**
 * Gantt dengan geometri yang sama seperti di layar: posisi bar diambil dari
 * barPosition() dan penanda bulan dari monthTicks(), jadi hasil cetaknya tidak
 * bisa bercerita lain dari grafik yang dilihat orang saat menekan tombolnya.
 */
export async function timelineToPdf(
  projects: Project[],
  meta: { title: string; notes: string[] }
): Promise<Buffer> {
  const ctx = await buatKonteks();
  const range = timelineRange(projects);

  let page = halamanBaru(ctx);
  let y = judulHalaman(ctx, page, { ...meta, columns: [], rows: [] });

  if (range === null) {
    page.drawText("Tidak ada proyek yang cocok dengan filter.", {
      x: MARGIN,
      y: y - 14,
      size: 9,
      font: ctx.font,
      color: ABU,
    });
    nomorHalaman(ctx);
    return Buffer.from(await ctx.pdf.save());
  }

  const chartX = MARGIN + NAMA_LEBAR;
  const chartW = LEBAR - MARGIN - chartX;
  const pctX = (pct: number) => chartX + (pct / 100) * chartW;

  const gambarSkala = (p: PDFPage, atas: number) => {
    for (const t of monthTicks(range)) {
      const x = pctX(t.leftPct);
      p.drawLine({
        start: { x, y: atas },
        end: { x, y: MARGIN + 4 },
        thickness: 0.5,
        color: GARIS,
      });
      p.drawText(aman(t.label), { x: x + 2, y: atas + 4, size: 7.5, font: ctx.font, color: ABU });
    }
  };

  let atasSkala = y;
  gambarSkala(page, atasSkala);
  y -= 12;

  for (const p of projects) {
    if (y - GANTT_BARIS < MARGIN + 40) {
      page = halamanBaru(ctx);
      y = TINGGI - MARGIN - 16;
      atasSkala = y;
      gambarSkala(page, atasSkala);
      y -= 12;
    }

    page.drawText(potong(p.name, ctx.font, 8, NAMA_LEBAR - 10), {
      x: MARGIN,
      y: y - 11,
      size: 8,
      font: ctx.font,
      color: HITAM,
    });

    const { leftPct, widthPct } = barPosition(p, range);
    page.drawRectangle({
      x: pctX(leftPct),
      y: y - 12,
      // Proyek sehari tetap harus terlihat, jadi ada lebar minimum.
      width: Math.max((widthPct / 100) * chartW, 2),
      height: 8,
      color: WARNA_PRIORITAS[p.priority],
    });

    y -= GANTT_BARIS;
  }

  // Keterangan warna: tanpa ini bar berwarna di kertas tidak berarti apa-apa.
  let lx = MARGIN;
  const ly = MARGIN + 8;
  page.drawText("Prioritas:", { x: lx, y: ly, size: 8, font: ctx.bold, color: HITAM });
  lx += ctx.bold.widthOfTextAtSize("Prioritas:", 8) + 8;
  for (const level of ["Tinggi", "Sedang", "Rendah"] as const) {
    page.drawRectangle({ x: lx, y: ly - 1, width: 14, height: 8, color: WARNA_PRIORITAS[level] });
    lx += 18;
    page.drawText(level, { x: lx, y: ly, size: 8, font: ctx.font, color: ABU });
    lx += ctx.font.widthOfTextAtSize(level, 8) + 14;
  }

  nomorHalaman(ctx);
  return Buffer.from(await ctx.pdf.save());
}
