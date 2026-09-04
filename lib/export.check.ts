/**
 * Cek mandiri ekspor berkas: `npx tsx lib/export.check.ts`
 *
 * Berkas .xlsx dan .docx sebenarnya arsip zip, jadi hasilnya benar-benar
 * dibuka dan isinya diperiksa — bukan sekadar dilihat ukurannya. PDF dimuat
 * ulang oleh pdf-lib, sehingga berkas yang rusak strukturnya akan ketahuan
 * di sini, bukan saat orang gagal membukanya.
 */
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  PRINT_COLUMN_KEYS,
  PROJECT_COLUMNS,
  formatCell,
  pickColumns,
  projectRows,
} from "./export/dataset";
import { datasetToExcel, nameSheet } from "./export/excel";
import { aman, datasetToPdf, potong, timelineToPdf } from "./export/pdf";
import {
  TIMELINE_COLUMNS,
  overlapLines,
  ownerConflictLines,
  timelineRows,
  timelineSummary,
} from "./export/timeline-dataset";
import { datasetToWord } from "./export/word";
import { agenda as mockAgenda, projects as mockProjects, users as mockUsers } from "./mock-data";
import { berkasMingguan } from "./export/weekly";
import { FINANCE_FIELDS } from "./permissions";
import type { AgendaEntry, Project, User } from "./types";

const HARI_INI = "2026-08-30";

/* --- Kolom dan baris ------------------------------------------------------- */

// Kunci kolom unik, dan tiap kolom punya judul.
const kunci = PROJECT_COLUMNS.map((c) => c.key);
assert.deepEqual(kunci, [...new Set(kunci)]);
assert.ok(PROJECT_COLUMNS.every((c) => c.header.trim() !== "" && c.width > 0));

// Kolom cetak benar-benar ada di daftar utama — salah ketik satu kunci akan
// membuat kolomnya hilang diam-diam dari PDF dan Word.
const cetak = pickColumns(PROJECT_COLUMNS, PRINT_COLUMN_KEYS);
assert.equal(cetak.length, PRINT_COLUMN_KEYS.length);
assert.deepEqual(cetak.map((c) => c.key), PRINT_COLUMN_KEYS);

// Kunci yang tidak dikenal dibuang, bukan menghasilkan kolom kosong.
assert.deepEqual(pickColumns(PROJECT_COLUMNS, ["name", "tidakAda"]).map((c) => c.key), ["name"]);

const rows = projectRows(mockProjects, mockUsers, { today: HARI_INI });
assert.equal(rows.length, mockProjects.length);

// Tiap kolom punya nilai di tiap baris — undefined berarti kolom yang
// dideklarasikan tapi lupa diisi, dan itu tercetak sebagai sel kosong.
for (const row of rows) {
  for (const c of PROJECT_COLUMNS) {
    assert.ok(c.key in row, `kolom ${c.key} tidak ada di baris`);
  }
}

/* Assertion di bawah sengaja mencari proyeknya berdasarkan sifat, bukan id
   tertentu: mock-data adalah data kerja yang berubah-ubah, dan cek yang
   mengunci baris nomor sekian akan patah tiap kali daftarnya disunting. */

// Nilai mentah, bukan teks berformat: Excel perlu angka asli untuk dijumlah.
assert.ok(
  mockProjects.some((p) => p.value !== null),
  "mock-data perlu minimal satu proyek yang ada nilai kontraknya"
);
const berharga = mockProjects.find((p) => p.value !== null)!;
const barisBerharga = rows.find((r) => r.id === berharga.id)!;
assert.equal(typeof barisBerharga.value, "number");
assert.equal(barisBerharga.value, berharga.value);
assert.equal(barisBerharga.contractNo, berharga.contractNo);
assert.equal(typeof barisBerharga.margin, "number");
// PIC diterjemahkan jadi nama, bukan dibiarkan sebagai id.
assert.equal(barisBerharga.owner, mockUsers.find((u) => u.id === berharga.ownerId)!.name);

// Proyek tanpa nilai kontrak: margin tidak diketahui, bukan nol.
const kosongNilai = mockProjects.find((p) => p.value === null);
if (kosongNilai) {
  const baris = rows.find((r) => r.id === kosongNilai.id)!;
  assert.equal(baris.value, null);
  assert.equal(baris.margin, null);
}

// Setiap proyek muncul tepat sekali, dengan id yang sama.
assert.deepEqual(rows.map((r) => r.id), mockProjects.map((p) => p.id));

/* --- Perenderan sel -------------------------------------------------------- */

// Intl menyisipkan spasi tak-putus setelah "Rp"; dinormalkan supaya assertion
// membandingkan isinya, bukan jenis spasinya.
const rapi = (t: string) => t.replace(/ /g, " ");

assert.equal(formatCell(null, "currency"), "—");
assert.equal(formatCell("", "text"), "—");
assert.equal(rapi(formatCell(0, "currency")), "Rp 0");
assert.equal(rapi(formatCell(505_000_000, "currency")), "Rp 505.000.000");
assert.equal(rapi(formatCell(-25_045_045, "currency")), "-Rp 25.045.045");
assert.equal(formatCell(0.308, "percent"), "30,8%");
assert.equal(formatCell(-0.055, "percent"), "-5,5%");
assert.equal(formatCell(1234, "integer"), "1.234");
// Tanggal tetap ISO — tidak pernah ambigu soal urutan hari-bulan.
assert.equal(formatCell("2026-08-30", "date"), "2026-08-30");

/* --- Nama lembar Excel ----------------------------------------------------- */

assert.equal(nameSheet("Daftar Proyek"), "Daftar Proyek");
// Karakter terlarang Excel dibuang, bukan bikin berkasnya rusak.
assert.equal(nameSheet("Data: 2026/08"), "Data  2026 08");
assert.ok(nameSheet("x".repeat(50)).length <= 31);
assert.equal(nameSheet("///"), "Sheet1");

/* --- Teks aman untuk PDF --------------------------------------------------- */

// Font standar PDF hanya WinAnsi; karakter di luar itu harus diganti, bukan
// dibiarkan melempar dan menggagalkan seluruh ekspor.
assert.equal(aman("Proyek — GNSS"), "Proyek - GNSS");
assert.equal(aman("naik ≥ 20"), "naik >= 20");
assert.equal(aman("Bendungan"), "Bendungan");
assert.equal(aman("Café Ñoño"), "Café Ñoño"); // Latin-1 aman apa adanya
// Satu emoji jadi satu tanda tanya: teksnya ditelusuri per titik kode, jadi
// pasangan pengganti UTF-16 tidak terbelah dua.
assert.equal(aman("emoji 🚧 di nama"), "emoji ? di nama");
assert.ok(!aman("baris\nbaru").includes("\n"));
// Semua hasilnya harus bisa dikodekan WinAnsi.
for (const p of mockProjects) {
  assert.ok([...aman(p.name)].every((c) => c.codePointAt(0)! <= 0xff));
}

/* --- Pemotongan teks kolom ------------------------------------------------- */

async function cekPotong() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Muat seluruhnya: dibiarkan apa adanya, tanpa elipsis.
  assert.equal(potong("Pendek", font, 8, 200), "Pendek");

  // Kepanjangan: dipotong dan diberi elipsis, dan hasilnya benar-benar muat.
  const panjang = "Pengadaan GNSS Receiver untuk Tim Survei Tambang Kalimantan Timur";
  const hasil = potong(panjang, font, 8, 60);
  assert.ok(hasil.endsWith("..."));
  assert.ok(hasil.length < panjang.length);
  assert.ok(font.widthOfTextAtSize(hasil, 8) <= 60);

  // Lebar yang sangat sempit tidak bikin perulangannya menggantung.
  assert.ok(potong(panjang, font, 8, 1).length <= 4);

  // Karakter di luar WinAnsi ikut dijinakkan sebelum diukur.
  assert.equal(potong("A — B", font, 8, 200), "A - B");
}

/* --- Pembuatan berkas ------------------------------------------------------ */

const users = mockUsers;
const catatan = [`${mockProjects.length} proyek · dicetak ${HARI_INI}`];
const datasetProyek = {
  title: "Daftar Proyek",
  columns: PROJECT_COLUMNS,
  rows,
  notes: catatan,
};
const datasetCetak = { ...datasetProyek, columns: cetak };

function isiZip(buf: Buffer): Record<string, Uint8Array> {
  assert.equal(buf.subarray(0, 2).toString(), "PK", "berkas bukan arsip zip");
  return unzipSync(new Uint8Array(buf));
}

const teksDari = (isi: Record<string, Uint8Array>, cocok: RegExp) =>
  Object.entries(isi)
    .filter(([nama]) => cocok.test(nama))
    .map(([, data]) => Buffer.from(data).toString("utf8"))
    .join("");

async function main() {
  await cekPotong();

  /* Excel */
  const xlsx = await datasetToExcel(datasetProyek);
  const isiXlsx = isiZip(xlsx);
  assert.ok(isiXlsx["xl/workbook.xml"], "workbook.xml tidak ada");
  assert.ok(isiXlsx["xl/worksheets/sheet1.xml"], "sheet1.xml tidak ada");

  // Judul kolom benar-benar tertulis di berkasnya.
  const kamus = teksDari(isiXlsx, /sharedStrings\.xml$/);
  for (const header of ["Nama Proyek", "No Kontrak", "Margin", "Nilai Kontrak"]) {
    assert.ok(kamus.includes(header), `judul kolom "${header}" tidak ada di xlsx`);
  }
  assert.ok(kamus.includes(mockProjects[0].name), "nama proyek tidak ada di xlsx");

  // Angka disimpan sebagai angka, bukan teks: tanpa ini Excel tidak bisa
  // menjumlah kolom nilai kontrak.
  const sheet1 = teksDari(isiXlsx, /worksheets\/sheet1\.xml$/);
  assert.ok(
    sheet1.includes(`>${berharga.value}<`),
    "nilai kontrak tidak tersimpan sebagai angka"
  );
  // Baris kepala dibekukan.
  assert.ok(sheet1.includes("pane"), "baris kepala tidak dibekukan");

  /* Excel banyak lembar */
  const xlsxTimeline = await datasetToExcel(
    { title: nameSheet("Timeline"), columns: TIMELINE_COLUMNS, rows: timelineRows(mockProjects, users), notes: catatan },
    [
      {
        name: nameSheet("Bentrok Jadwal"),
        columns: [{ key: "a", header: "Proyek A", kind: "text", width: 30 }],
        rows: overlapLines(mockProjects).map((b) => ({ a: b.a })),
      },
    ]
  );
  const isiTimeline = isiZip(xlsxTimeline);
  assert.ok(isiTimeline["xl/worksheets/sheet2.xml"], "lembar kedua tidak dibuat");
  assert.ok(teksDari(isiTimeline, /workbook\.xml$/).includes("Bentrok Jadwal"));

  /* Word */
  const docx = await datasetToWord(datasetCetak, [
    { heading: "Jadwal yang Tumpang Tindih", paragraphs: ["Contoh keterangan."] },
  ]);
  const isiDocx = isiZip(docx);
  assert.ok(isiDocx["word/document.xml"], "document.xml tidak ada");
  const dokumen = teksDari(isiDocx, /word\/document\.xml$/);
  assert.ok(dokumen.includes("Daftar Proyek"), "judul tidak ada di docx");
  assert.ok(dokumen.includes("Jadwal yang Tumpang Tindih"), "bagian tambahan tidak ada di docx");
  assert.ok(dokumen.includes(mockProjects[0].name), "nama proyek tidak ada di docx");
  // Bentang, bukan tegak — tabelnya terlalu lebar untuk halaman tegak.
  assert.ok(dokumen.includes("landscape"), "halaman docx bukan bentang");

  /* PDF tabel */
  const pdf = await datasetToPdf(datasetCetak);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  const dimuat = await PDFDocument.load(new Uint8Array(pdf));
  assert.ok(dimuat.getPageCount() >= 1);
  const ukuran = dimuat.getPage(0).getSize();
  // A4 mendatar: lebih lebar daripada tinggi.
  assert.ok(ukuran.width > ukuran.height, "halaman PDF bukan mendatar");
  assert.ok(Math.round(ukuran.width) === 842, `lebar halaman ${ukuran.width}`);

  /* PDF Gantt */
  const gantt = await timelineToPdf(mockProjects, {
    title: "Timeline Proyek",
    notes: catatan,
  });
  assert.equal(gantt.subarray(0, 4).toString(), "%PDF");
  const ganttDoc = await PDFDocument.load(new Uint8Array(gantt));
  assert.ok(ganttDoc.getPageCount() >= 1);
  // Gantt menggambar batang, jadi berkasnya jelas lebih dari halaman kosong.
  assert.ok(gantt.length > 1500, `berkas Gantt terlalu kecil: ${gantt.length}`);

  /* Tiap proyek benar-benar dapat barisnya sendiri: daftar yang jauh lebih
     panjang dari tinggi halaman harus tumpah ke halaman berikutnya. Kalau
     barisnya tidak digambar, jumlah halamannya tidak akan pernah bertambah. */
  const banyakProyek = Array.from({ length: 60 }, (_, i) => ({
    ...mockProjects[0],
    id: 1000 + i,
    name: `Proyek uji ${i}`,
  }));
  const ganttPanjang = await PDFDocument.load(
    new Uint8Array(await timelineToPdf(banyakProyek, { title: "Timeline", notes: [] }))
  );
  assert.ok(
    ganttPanjang.getPageCount() >= 2,
    `Gantt panjang tidak dipecah jadi beberapa halaman (${ganttPanjang.getPageCount()})`
  );
  // Semua halamannya berukuran sama, bukan cuma yang pertama yang benar.
  const ukuranGantt = ganttPanjang.getPages().map((p) => Math.round(p.getSize().width));
  assert.deepEqual(ukuranGantt, ukuranGantt.map(() => 842));

  /* Daftar kosong tidak boleh melempar — filter bisa saja menyisakan nol baris. */
  const kosongPdf = await datasetToPdf({ ...datasetCetak, rows: [] });
  assert.equal((await PDFDocument.load(new Uint8Array(kosongPdf))).getPageCount(), 1);
  const kosongGantt = await timelineToPdf([], { title: "Timeline", notes: [] });
  assert.equal((await PDFDocument.load(new Uint8Array(kosongGantt))).getPageCount(), 1);
  isiZip(await datasetToExcel({ ...datasetProyek, rows: [] }));
  isiZip(await datasetToWord({ ...datasetCetak, rows: [] }));

  /* Nama proyek dengan karakter di luar WinAnsi tidak menggagalkan PDF. */
  const nakal = mockProjects.map((p) => ({ ...p, name: `${p.name} 🚧 — ≥` }));
  assert.ok((await timelineToPdf(nakal, { title: "Timeline 🚧", notes: ["≥ 20"] })).length > 0);

  /* Banyak baris memaksa halaman kedua, dan kepala tabel ikut diulang. */
  const banyak = Array.from({ length: 90 }, (_, i) => ({ ...rows[0], id: i + 1 }));
  const berhalaman = await PDFDocument.load(
    new Uint8Array(await datasetToPdf({ ...datasetCetak, rows: banyak }))
  );
  assert.ok(berhalaman.getPageCount() >= 2, "tabel panjang tidak dipecah jadi beberapa halaman");

  /* --- Ringkasan timeline -------------------------------------------------- */

  const ringkas = timelineSummary(mockProjects);
  assert.equal(ringkas.projects, mockProjects.length);
  assert.ok(ringkas.pairs >= ringkas.sameOwnerPairs);
  assert.match(ringkas.periode, /^\d{4}-\d{2}-\d{2} s\/d \d{4}-\d{2}-\d{2}$/);

  // Daftar kosong tetap aman, bukan melempar atau menghasilkan "undefined".
  const nihil = timelineSummary([]);
  assert.equal(nihil.projects, 0);
  assert.equal(nihil.range, null);
  assert.equal(nihil.periode, "—");

  const barisTimeline = timelineRows(mockProjects, users);
  assert.equal(barisTimeline.length, mockProjects.length);
  // Durasi inklusif, jadi selalu minimal 1 hari.
  assert.ok(barisTimeline.every((r) => typeof r.durasi === "number" && (r.durasi as number) >= 1));

  // Bentrok memakai nama proyek, bukan id — berkasnya dibaca orang.
  for (const b of overlapLines(mockProjects)) {
    assert.ok(b.a.length > 0 && b.b.length > 0);
    assert.match(b.periode, /s\/d/);
  }
  for (const k of ownerConflictLines(mockProjects, users)) {
    assert.ok(k.owner.length > 0 && k.projects.includes(","));
  }

  /* --- Laporan mingguan ---------------------------------------------------- */

  const ACUAN = "2026-09-04"; // Jumat; pekannya 31 Agustus - 6 September.

  const mingguan = (bolehKeuangan: boolean, format: "excel" | "word" | "pdf") =>
    berkasMingguan({
      projects: mockProjects,
      users: mockUsers,
      agenda: mockAgenda,
      format,
      tanggal: ACUAN,
      bolehKeuangan,
    });

  /* Excel: satu lembar per bagian, dan bagian agenda benar-benar ada. */
  const mingguExcel = await mingguan(true, "excel");
  const isiMinggu = isiZip(mingguExcel);
  assert.ok(isiMinggu["xl/worksheets/sheet1.xml"], "lembar pertama tidak ada");
  assert.ok(isiMinggu["xl/worksheets/sheet4.xml"], "bagian agenda tidak dapat lembarnya");

  const bukuMinggu = teksDari(isiMinggu, /workbook\.xml$/);
  for (const bagian of ["Lewat Tenggat", "Tenggat 7 Hari", "Agenda Pekan Ini", "Bentrok PIC"]) {
    assert.ok(bukuMinggu.includes(bagian), `bagian "${bagian}" tidak ada di laporan mingguan`);
  }

  // Agenda pekan itu benar-benar tertulis, lengkap dengan orang dan lokasinya.
  const kamusMinggu = teksDari(isiMinggu, /sharedStrings\.xml$/);
  const agendaPekanItu = mockAgenda.filter(
    (a) => a.startDate <= "2026-09-06" && a.endDate >= "2026-08-31"
  );
  assert.ok(agendaPekanItu.length > 0, "mock-data perlu agenda di pekan acuan");
  for (const a of agendaPekanItu) {
    const orang = mockUsers.find((u) => u.id === a.userId)!;
    assert.ok(kamusMinggu.includes(orang.name), `${orang.name} tidak muncul di laporan`);
  }
  // Agenda di luar pekan itu tidak ikut terbawa.
  const diLuarPekan = mockAgenda.filter((a) => a.startDate > "2026-09-06" || a.endDate < "2026-08-31");
  for (const a of diLuarPekan) {
    if (a.note !== "") {
      assert.equal(
        kamusMinggu.includes(a.note),
        false,
        `agenda di luar pekan ikut terbawa: ${a.note}`
      );
    }
  }

  /* Word dan PDF juga terbentuk utuh. */
  const mingguWord = isiZip(await mingguan(true, "word"));
  const dokumenMinggu = teksDari(mingguWord, /word\/document\.xml$/);
  assert.ok(dokumenMinggu.includes("Agenda Pekan Ini"), "bagian agenda tidak ada di docx");
  assert.ok(dokumenMinggu.includes("Laporan Mingguan"));

  const mingguPdf = await mingguan(true, "pdf");
  assert.equal(mingguPdf.subarray(0, 4).toString(), "%PDF");
  assert.ok((await PDFDocument.load(new Uint8Array(mingguPdf))).getPageCount() >= 1);

  /* --- Penyensoran keuangan ------------------------------------------------ */

  /* Yang paling penting: kolom keuangan tidak boleh ADA di berkasnya, bukan
     sekadar dikosongkan. Dicari langsung di XML-nya. */
  const JUDUL_UANG = ["Nilai Kontrak", "Margin", "Sales Fee", "Cost Operasional", "Pendapatan (DPP)"];

  const tanpaUang = isiZip(await mingguan(false, "excel"));
  const kamusTanpaUang = teksDari(tanpaUang, /sharedStrings\.xml$/);
  for (const judul of JUDUL_UANG) {
    assert.equal(
      kamusTanpaUang.includes(judul),
      false,
      `kolom "${judul}" bocor ke laporan tanpa hak keuangan`
    );
  }
  // Tapi isinya tetap berguna: bagian agenda dan proyeknya tetap ada.
  assert.ok(teksDari(tanpaUang, /workbook\.xml$/).includes("Agenda Pekan Ini"));
  assert.ok(kamusTanpaUang.includes("Nama Proyek"));

  // Nilai kontraknya sendiri juga tidak ikut sebagai angka mentah.
  const lembarTanpaUang = teksDari(tanpaUang, /worksheets\/sheet1\.xml$/);
  const berharga2 = mockProjects.find((p) => p.value !== null);
  if (berharga2) {
    assert.equal(
      lembarTanpaUang.includes(`>${berharga2.value}<`),
      false,
      "nilai kontrak bocor sebagai angka"
    );
  }

  // Word dan PDF pun sama.
  const wordTanpaUang = teksDari(isiZip(await mingguan(false, "word")), /word\/document\.xml$/);
  for (const judul of JUDUL_UANG) {
    assert.equal(wordTanpaUang.includes(judul), false, `"${judul}" bocor ke docx`);
  }

  // Daftar kunci keuangan tidak boleh kosong — kalau kosong, seluruh
  // penyensoran di atas jadi tidak menguji apa pun.
  assert.ok(FINANCE_FIELDS.length >= 4);

  /* Daftar kosong tetap menghasilkan berkas yang bisa dibuka. */
  const kosongArgs = {
    projects: [] as Project[],
    users: [] as User[],
    agenda: [] as AgendaEntry[],
    tanggal: ACUAN,
    bolehKeuangan: true,
  };

  // Excel: lembarnya tetap terbentuk dengan kepala kolom. Sengaja tidak
  // menuliskan "tidak ada apa-apa" — lembar kosong berkepala justru yang
  // diharapkan orang saat menyaring spreadsheet.
  const kosongExcel = isiZip(await berkasMingguan({ ...kosongArgs, format: "excel" }));
  assert.ok(kosongExcel["xl/worksheets/sheet1.xml"]);
  assert.ok(teksDari(kosongExcel, /workbook\.xml$/).includes("Agenda Pekan Ini"));

  // Word dan PDF dibaca orang, jadi di sana kekosongannya dikatakan.
  const kosongWord = teksDari(
    isiZip(await berkasMingguan({ ...kosongArgs, format: "word" })),
    /word\/document\.xml$/
  );
  assert.ok(kosongWord.includes("Belum ada agenda tercatat"));
  assert.ok(
    (await PDFDocument.load(
      new Uint8Array(await berkasMingguan({ ...kosongArgs, format: "pdf" }))
    )).getPageCount() >= 1
  );

  console.log("ok: export");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
