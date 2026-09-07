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

/* --- Rentang tampilan --------------------------------------------------------

   Papan tidak lagi terkunci sepekan. Rentangnya disejajarkan kalender — "1
   Bulan" berarti September, bukan "30 hari dari hari ini" — supaya tombol
   Berikutnya berarti Oktober dan bukan mendarat di tengah bulan. */

/** Periode yang bisa dipilih lewat tombol. */
export type SkalaPreset = "minggu" | "2minggu" | "bulan" | "3bulan" | "tahun";
/** Termasuk rentang tanggal bebas, yang tidak lewat rentangSkala(). */
export type SkalaAgenda = SkalaPreset | "khusus";

export type RentangAgenda = {
  start: string;
  end: string;
  /** Inklusif kedua ujungnya; penyebut semua hitungan posisi. */
  totalDays: number;
};

/**
 * Di atas sekian hari, satu hari jadi terlalu sempit untuk bar berdurasi —
 * papan berganti ke titik dan menggulir. Ambangnya diturunkan dari RENTANGNYA,
 * bukan dari tombol yang ditekan, supaya rentang khusus dua tahun tidak
 * dipaksa muat layar dan jadi tidak terbaca.
 */
export const AMBANG_TITIK = 120;

/** Ambang label harian; di atasnya kepala kolom jadi mingguan. */
const AMBANG_HARIAN = 14;

function hariUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function keIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rentangDari(start: string, end: string): RentangAgenda {
  return { start, end, totalDays: toDay(end) - toDay(start) + 1 };
}

/** Rentang satu skala, disejajarkan kalender, digeser `geser` satuan skala itu. */
export function rentangSkala(
  skala: SkalaPreset,
  acuan: string,
  geser: number
): RentangAgenda {
  if (skala === "minggu") {
    const w = shiftWeek(weekRange(acuan), geser);
    return rentangDari(w.start, w.end);
  }

  if (skala === "2minggu") {
    // Tetap mulai Senin, dan satu geseran memindahkan dua pekan sekaligus.
    const w = shiftWeek(weekRange(acuan), geser * 2);
    return rentangDari(w.start, fromDay(toDay(w.start) + 2 * HARI - 1));
  }

  const d = hariUTC(acuan);
  const tahun = d.getUTCFullYear();
  const bulan = d.getUTCMonth();

  if (skala === "tahun") {
    // Date.UTC menormalkan tahun sendiri, jadi geser negatif pun aman.
    return rentangDari(
      keIso(new Date(Date.UTC(tahun + geser, 0, 1))),
      keIso(new Date(Date.UTC(tahun + geser, 11, 31)))
    );
  }

  const panjang = skala === "3bulan" ? 3 : 1;
  const mulai = bulan + geser * panjang;
  return rentangDari(
    keIso(new Date(Date.UTC(tahun, mulai, 1))),
    // Tanggal 0 bulan berikutnya = hari terakhir bulan ini, termasuk kabisat.
    keIso(new Date(Date.UTC(tahun, mulai + panjang, 0)))
  );
}

/**
 * Rentang tanggal bebas.
 *
 * Tanggal akhir yang mendahului tanggal mulai dijepit jadi sehari, bukan
 * ditukar diam-diam: menukar akan menampilkan rentang yang tidak diminta siapa
 * pun. Formnya sendiri sudah menahan lewat atribut `min`.
 */
export function rentangKhusus(start: string, end: string): RentangAgenda {
  return rentangDari(start, end < start ? start : end);
}

/** Satu geseran maju atau mundur untuk rentang khusus: sepanjang rentangnya. */
export function geserKhusus(r: RentangAgenda, arah: number): RentangAgenda {
  const langkah = arah * r.totalDays;
  return rentangDari(fromDay(toDay(r.start) + langkah), fromDay(toDay(r.end) + langkah));
}

export function modeTampilan(r: RentangAgenda): "bar" | "titik" {
  return r.totalDays > AMBANG_TITIK ? "titik" : "bar";
}

export type TickAgenda = {
  key: string;
  label: string;
  /** Persen dari lebar rentang. */
  leftPct: number;
};

/**
 * Kepala kolom papan. Kerapatannya diturunkan dari PANJANG rentang, bukan dari
 * skalanya — rentang khusus sepuluh hari harus berlabel harian sama seperti
 * tampilan sepekan.
 */
export function ticksRentang(r: RentangAgenda): TickAgenda[] {
  const awal = toDay(r.start);
  const persen = (hari: number) => (Math.max(hari - awal, 0) / r.totalDays) * 100;

  if (r.totalDays <= AMBANG_HARIAN) {
    return Array.from({ length: r.totalDays }, (_, i) => {
      const tanggal = fromDay(awal + i);
      return { key: tanggal, label: dayLabel(tanggal), leftPct: persen(awal + i) };
    });
  }

  if (r.totalDays <= AMBANG_TITIK) {
    // Tiap tujuh hari dari awal rentang. Sengaja tidak dipaksa jatuh di Senin:
    // tick yang jatuh sebelum rentang akan berlabel tanggal yang tidak ada di
    // papan, dan itu lebih membingungkan daripada kolom yang tidak mulai Senin.
    const ticks: TickAgenda[] = [];
    for (let i = 0; i < r.totalDays; i += HARI) {
      const tanggal = fromDay(awal + i);
      const d = hariUTC(tanggal);
      ticks.push({
        key: tanggal,
        label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
        leftPct: persen(awal + i),
      });
    }
    return ticks;
  }

  // Per bulan, rumus sama dengan monthTicks() di Gantt proyek.
  const ticks: TickAgenda[] = [];
  const akhir = hariUTC(r.end);
  const cursor = hariUTC(r.start);
  cursor.setUTCDate(1);

  while (cursor <= akhir) {
    ticks.push({
      key: keIso(cursor).slice(0, 7),
      label: cursor.toLocaleDateString("id-ID", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      leftPct: persen(toDay(keIso(cursor))),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
}

/* --- Petak kalender ----------------------------------------------------------

   Grid kalender adalah barisan pekan, dan tiap pekan ITU SENDIRI sebuah
   RentangAgenda tujuh hari. Karena begitu, barSpan() yang sudah ada langsung
   bisa dipakai untuk menempatkan chip di dalam satu baris pekan, lengkap
   dengan pemotongan di kedua ujungnya — agenda yang melewati batas pekan
   otomatis terpotong jadi dua segmen bersambung, persis seperti kalender pada
   umumnya. */

/**
 * Baris pekan yang menutupi rentang, selalu Senin sampai Minggu penuh.
 *
 * Sengaja melebar ke luar rentang: petak kalender yang barisnya tidak utuh
 * akan membuat kolom hari tidak sejajar dari baris ke baris.
 */
export function weekRowsOf(rentang: RentangAgenda): RentangAgenda[] {
  const awal = toDay(weekRange(rentang.start).start);
  const akhir = toDay(weekRange(rentang.end).end);

  const baris: RentangAgenda[] = [];
  for (let d = awal; d <= akhir; d += HARI) {
    baris.push(rentangDari(fromDay(d), fromDay(d + HARI - 1)));
  }
  return baris;
}

export type BulanPetak = {
  key: string;
  label: string;
  rentang: RentangAgenda;
};

/** Bulan-bulan yang tersentuh rentang; dipakai tampilan tahunan. */
export function monthsOf(rentang: RentangAgenda): BulanPetak[] {
  const hasil: BulanPetak[] = [];
  const akhir = hariUTC(rentang.end);
  const cursor = hariUTC(rentang.start);
  cursor.setUTCDate(1);

  while (cursor <= akhir) {
    const tahun = cursor.getUTCFullYear();
    const bulan = cursor.getUTCMonth();
    hasil.push({
      key: keIso(cursor).slice(0, 7),
      label: cursor.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      rentang: rentangDari(
        keIso(new Date(Date.UTC(tahun, bulan, 1))),
        keIso(new Date(Date.UTC(tahun, bulan + 1, 0)))
      ),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return hasil;
}

/** Tanggal ini di luar rentang yang diminta? Dipakai meredupkan hari tetangga. */
export function diLuarRentang(tanggal: string, rentang: RentangAgenda): boolean {
  return tanggal < rentang.start || tanggal > rentang.end;
}

/* --- Bar gabungan ------------------------------------------------------------

   Papan menggambar satu bar memanjang per orang per proyek, bukan satu kotak
   per hari. Yang digabung hanya tampilannya — baris di database tidak pernah
   disatukan, jadi keputusan ini bisa dibalik tanpa kehilangan apa pun. */

/** AgendaLike ditambah proyeknya, yang dibutuhkan untuk mengelompokkan. */
export type AgendaBarLike = AgendaLike & { projectId: number | null };

export type AgendaBar<T extends AgendaBarLike> = {
  /** Kunci stabil untuk React dan untuk pencentangan. */
  key: string;
  userId: number;
  projectId: number | null;
  kind: AgendaKind;
  /** Rentang gabungan, inklusif. */
  startDate: string;
  endDate: string;
  /** Entri penyusunnya, terurut tanggal. Selalu minimal satu. */
  entries: T[];
  /** Ada entri di dalamnya yang tanggalnya saling bertumpuk. */
  bertumpuk: boolean;
};

/**
 * Kunci pengelompokan: orang + proyek + jenis kegiatan.
 *
 * `kind` ikut karena warna dan label bar adalah jenis kegiatannya — bar yang
 * mencampur Perjalanan dan Lapangan tidak punya warna yang jujur, dan legenda
 * jenis di atas papan jadi berbohong. Entri tanpa proyek dikelompokkan per
 * jenis saja: tidak ada proyek yang bisa "sama", tapi dua blok Kantor yang
 * berdampingan tetap layak menyatu.
 */
function kunciBar(entry: AgendaBarLike): string {
  return `${entry.userId}|${entry.projectId ?? "-"}|${entry.kind}`;
}

/**
 * Gabungkan entri sekelompok yang tanggalnya bersambung jadi satu bar.
 *
 * Hanya yang berdampingan atau beririsan yang menyatu. Senin-Selasa dan Jumat
 * di proyek yang sama tetap DUA bar: meleburnya jadi satu bar Senin-Jumat akan
 * mengklaim orangnya ada di proyek itu Rabu-Kamis padahal tidak, dan papan ini
 * dibaca untuk tahu siapa sedang di mana.
 */
export function mergeBars<T extends AgendaBarLike>(entries: T[]): AgendaBar<T>[] {
  const kelompok = new Map<string, T[]>();
  for (const e of entries) {
    const k = kunciBar(e);
    const isi = kelompok.get(k);
    if (isi) isi.push(e);
    else kelompok.set(k, [e]);
  }

  const hasil: AgendaBar<T>[] = [];

  for (const [kunci, isi] of kelompok) {
    // Urut tanggal; id jadi pemutus supaya hasilnya tidak bergantung urutan masuk.
    const urut = [...isi].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id
    );

    let berjalan: T[] = [];
    let akhir = 0;
    let bertumpuk = false;

    const tutup = () => {
      if (berjalan.length === 0) return;
      const pertama = berjalan[0];
      hasil.push({
        key: `${kunci}|${pertama.startDate}|${pertama.id}`,
        userId: pertama.userId,
        projectId: pertama.projectId,
        kind: pertama.kind,
        startDate: pertama.startDate,
        endDate: fromDay(akhir),
        entries: berjalan,
        bertumpuk,
      });
      berjalan = [];
      bertumpuk = false;
    };

    for (const e of urut) {
      const mulai = toDay(e.startDate);
      // Selesai sebelum mulai tidak mungkin lolos CHECK skema, tapi kalau toh
      // ada, jangan sampai membuat rentang bar jadi mundur.
      const selesai = Math.max(toDay(e.endDate), mulai);

      if (berjalan.length === 0) {
        berjalan = [e];
        akhir = selesai;
        continue;
      }

      // Bersambung: mulai paling lambat sehari setelah bar berjalan berakhir.
      if (mulai <= akhir + 1) {
        // Beririsan berarti data ganda milik orang yang sama di proyek yang
        // sama — bukan orang di dua tempat. Barnya menyatu, tapi ditandai
        // supaya sinyalnya tidak hilang dari layar.
        if (mulai <= akhir) bertumpuk = true;
        berjalan.push(e);
        akhir = Math.max(akhir, selesai);
        continue;
      }

      tutup();
      berjalan = [e];
      akhir = selesai;
    }
    tutup();
  }

  return hasil.sort(
    (a, b) => a.userId - b.userId || a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key)
  );
}

export type LaidOutBar<T extends AgendaBarLike> = AgendaBar<T> & {
  /** Jalur tumpuk dalam satu baris anggota. */
  lane: number;
};

/**
 * Taruh bar ke jalur bertingkat supaya yang beririsan tidak saling menutupi.
 *
 * Rakus dan sederhana: bar diurutkan menurut tanggal mulai, lalu masuk ke jalur
 * pertama yang bar terakhirnya sudah selesai. Dipisah dari mergeBars() karena
 * jalur dihitung SETELAH bar disaring ke satu pekan — kalau dihitung lebih dulu,
 * baris bisa menyisakan jalur kosong dari bar yang tidak ikut tampil.
 */
export function assignLanes<T extends AgendaBarLike>(bars: AgendaBar<T>[]): LaidOutBar<T>[] {
  const urut = [...bars].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key)
  );

  /** Hari terakhir yang sudah terpakai di tiap jalur. */
  const terpakai: number[] = [];

  return urut.map((bar) => {
    const mulai = toDay(bar.startDate);
    let lane = terpakai.findIndex((akhir) => akhir < mulai);
    if (lane === -1) lane = terpakai.length;
    terpakai[lane] = Math.max(toDay(bar.endDate), mulai);
    return { ...bar, lane };
  });
}

export type AgendaBarRow<T extends AgendaBarLike> = {
  user: User;
  bars: LaidOutBar<T>[];
  /** Berapa jalur yang terpakai; menentukan tinggi baris. Minimal 1. */
  laneCount: number;
  /** Jumlah ENTRI orang ini di pekan tersebut, bukan jumlah bar. */
  total: number;
};

/**
 * Baris per orang berisi bar gabungan — bentuk yang langsung dipakai papan.
 *
 * Penggabungan dihitung dari SELURUH entri, bukan hanya yang masuk rentang,
 * lalu bar yang menyentuh rentang itu yang ditampilkan. Kalau dipotong lebih
 * dulu, agenda yang membentang melewati batas rentang akan pecah jadi dua bar
 * berbeda di dua rentang yang bersebelahan.
 *
 * Anggota tanpa agenda tetap dapat barisnya, sama seperti weekGrid(): "tidak
 * ada agenda" adalah informasi yang dicari, bukan alasan menghilangkan orangnya.
 */
export function rangeBars<T extends AgendaBarLike>(
  entries: T[],
  users: User[],
  rentang: RentangAgenda
): AgendaBarRow<T>[] {
  const semua = mergeBars(entries);

  return users.map((user) => {
    const miliknya = semua.filter(
      (b) => b.userId === user.id && b.startDate <= rentang.end && b.endDate >= rentang.start
    );
    const bars = assignLanes(miliknya);

    return {
      user,
      bars,
      laneCount: Math.max(...bars.map((b) => b.lane + 1), 1),
      total: entriesInRange(entries, rentang.start, rentang.end).filter(
        (e) => e.userId === user.id
      ).length,
    };
  });
}

export type BarSpan = {
  /** Persen dari lebar rentang; 0 di hari pertamanya. */
  leftPct: number;
  widthPct: number;
  /** Bar mulai sebelum rentang ini — digambar terpotong di tepi kiri. */
  terpotongKiri: boolean;
  terpotongKanan: boolean;
};

/**
 * Letak bar dalam rentang, dalam persen.
 *
 * Rumusnya sama dengan barPosition() di Gantt proyek, dengan satu perbedaan
 * yang memang perlu: hasilnya DIPOTONG pada batas rentang, dan menandai sisi
 * mana yang terpotong. Gantt proyek tidak butuh itu karena rentangnya selalu
 * memuat proyeknya; agenda bisa mulai sebelum dan berakhir sesudahnya.
 */
export function barSpan(
  bar: { startDate: string; endDate: string },
  rentang: RentangAgenda
): BarSpan {
  const awal = toDay(rentang.start);
  const akhir = toDay(rentang.end);

  const mulai = toDay(bar.startDate);
  const selesai = Math.max(toDay(bar.endDate), mulai);

  const kiri = Math.max(mulai, awal);
  const kanan = Math.min(selesai, akhir);

  return {
    leftPct: ((kiri - awal) / rentang.totalDays) * 100,
    // Bar yang sama sekali di luar rentang menghasilkan lebar 0, bukan negatif —
    // pemanggilnya sudah menyaring, tapi lebar negatif merusak layout diam-diam.
    widthPct: (Math.max(kanan - kiri + 1, 0) / rentang.totalDays) * 100,
    terpotongKiri: mulai < awal,
    terpotongKanan: selesai > akhir,
  };
}

/** Sisi bar yang ditarik saat mengubah durasi. */
export type SisiBar = "kiri" | "kanan";

/**
 * Ubah durasi hanya menyentuh entri di UJUNG bar, dan tidak boleh melewatinya.
 *
 * Gagang kanan menggeser endDate entri terakhir, gagang kiri menggeser
 * startDate entri pertama. Keduanya dijepit supaya menyeret ujung tidak pernah
 * bisa membalik, menelan, atau menghapus entri di sebelahnya — untuk menghapus
 * ada tombolnya sendiri.
 */
export function clampResize<T extends AgendaBarLike>(
  bar: AgendaBar<T>,
  sisi: SisiBar,
  deltaHari: number
): number {
  const ujung = sisi === "kanan" ? bar.entries[bar.entries.length - 1] : bar.entries[0];
  const mulai = toDay(ujung.startDate);
  const selesai = toDay(ujung.endDate);

  // Kanan tidak boleh memendek melewati awal entrinya sendiri.
  if (sisi === "kanan") return Math.max(deltaHari, mulai - selesai);
  // Kiri tidak boleh memanjang ke kanan melewati akhir entrinya sendiri.
  return Math.min(deltaHari, selesai - mulai);
}

/** Entri mana yang berubah dan jadi tanggal berapa — siap dikirim ke server. */
export function resizeTarget<T extends AgendaBarLike>(
  bar: AgendaBar<T>,
  sisi: SisiBar,
  deltaHari: number
): { id: number; startDate: string; endDate: string } {
  const geser = clampResize(bar, sisi, deltaHari);
  const ujung = sisi === "kanan" ? bar.entries[bar.entries.length - 1] : bar.entries[0];

  return {
    id: ujung.id,
    startDate: sisi === "kiri" ? fromDay(toDay(ujung.startDate) + geser) : ujung.startDate,
    endDate: sisi === "kanan" ? fromDay(toDay(ujung.endDate) + geser) : ujung.endDate,
  };
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
