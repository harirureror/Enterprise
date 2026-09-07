/**
 * Daftar migrasi berurutan. Sekali sebuah migrasi masuk ke sini dan sudah jalan
 * di mesin orang lain, isinya JANGAN diubah — tambah migrasi baru di bawahnya.
 *
 * Nama kolom pakai snake_case mengikuti ERD di PRD bagian 6; pemetaan ke
 * camelCase milik `lib/types.ts` dikerjakan di lapisan query, bukan di skema.
 */

export type Migration = {
  /** Urutan sekaligus kunci di tabel `_migrations`. */
  id: number;
  name: string;
  up: string;
};

export const migrations: Migration[] = [
  {
    id: 1,
    name: "buat-tabel-users-dan-projects",
    up: `
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT NOT NULL UNIQUE,
        -- ponytail: diisi saat fase autentikasi (F1); seed sekarang belum punya password.
        password_hash TEXT,
        name          TEXT NOT NULL,
        avatar_url    TEXT,
        role          TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE projects (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        type         TEXT NOT NULL CHECK (type IN ('Penjualan', 'Jasa', 'Training', 'Riset')),
        status       TEXT NOT NULL CHECK (status IN ('Belum Mulai', 'Sedang Berjalan', 'Selesai')),
        priority     TEXT NOT NULL CHECK (priority IN ('Tinggi', 'Sedang', 'Rendah')),
        progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
        -- Format ISO YYYY-MM-DD; timeline menghitung langsung dari dua kolom ini.
        start_date   TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        deadline     TEXT NOT NULL CHECK (deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Filter dashboard paling sering lewat tiga kolom ini plus daftar proyek per anggota.
      CREATE INDEX idx_projects_owner ON projects(owner_id);
      CREATE INDEX idx_projects_status ON projects(status);
      CREATE INDEX idx_projects_priority ON projects(priority);
      CREATE INDEX idx_projects_deadline ON projects(deadline);
    `,
  },
  {
    id: 2,
    name: "jaga-rentang-tanggal-untuk-timeline",
    up: `
      -- SQLite tidak bisa menambah CHECK ke tabel yang sudah ada, jadi tabelnya
      -- dibangun ulang. Aman karena belum ada tabel lain yang menunjuk projects.
      CREATE TABLE projects_baru (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        type         TEXT NOT NULL CHECK (type IN ('Penjualan', 'Jasa', 'Training', 'Riset')),
        status       TEXT NOT NULL CHECK (status IN ('Belum Mulai', 'Sedang Berjalan', 'Selesai')),
        priority     TEXT NOT NULL CHECK (priority IN ('Tinggi', 'Sedang', 'Rendah')),
        progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
        start_date   TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        deadline     TEXT NOT NULL CHECK (deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        -- Bar timeline dihitung dari selisih dua kolom ini; tanggal terbalik
        -- bikin lebarnya tidak masuk akal, jadi ditolak sejak di database.
        CHECK (deadline >= start_date)
      );

      INSERT INTO projects_baru
        (id, name, description, type, status, priority, progress_pct,
         start_date, deadline, owner_id, created_at, updated_at)
      SELECT
         id, name, description, type, status, priority, progress_pct,
         start_date, deadline, owner_id, created_at, updated_at
      FROM projects;

      DROP TABLE projects;
      ALTER TABLE projects_baru RENAME TO projects;

      -- Indeks ikut terhapus bersama tabel lama, jadi dibuat ulang di sini.
      CREATE INDEX idx_projects_owner ON projects(owner_id);
      CREATE INDEX idx_projects_status ON projects(status);
      CREATE INDEX idx_projects_priority ON projects(priority);
      CREATE INDEX idx_projects_deadline ON projects(deadline);
      -- Timeline selalu mengambil proyek yang rentangnya menyentuh satu periode.
      CREATE INDEX idx_projects_range ON projects(start_date, deadline);
    `,
  },
  {
    id: 3,
    name: "status-pipeline-enam-tahap-dan-data-klien",
    up: `
      -- Rebuild lagi: CHECK status diperluas jadi enam tahap pipeline, sekaligus
      -- menambah identitas klien dan nilai kontrak. Pola sama dengan migrasi 2.
      CREATE TABLE projects_baru (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        type         TEXT NOT NULL CHECK (type IN ('Penjualan', 'Jasa', 'Training', 'Riset')),
        status       TEXT NOT NULL CHECK (status IN (
                       'Prospect', 'Penawaran', 'Negosiasi', 'Berjalan', 'Tertunda', 'Selesai'
                     )),
        priority     TEXT NOT NULL CHECK (priority IN ('Tinggi', 'Sedang', 'Rendah')),
        progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
        -- Instansi wajib untuk data baru, tapi diberi DEFAULT '' supaya baris
        -- lama (yang belum punya kolom ini) tetap bisa dipindahkan. Aturan
        -- "wajib diisi" ditegakkan di validasi form, bukan di sini.
        client_org   TEXT NOT NULL DEFAULT '',
        client_name  TEXT NOT NULL DEFAULT '',
        client_email TEXT NOT NULL DEFAULT '',
        client_phone TEXT NOT NULL DEFAULT '',
        -- Rupiah penuh, tanpa sen. NULL berarti nilainya memang belum ada.
        value        INTEGER CHECK (value IS NULL OR value >= 0),
        start_date   TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        deadline     TEXT NOT NULL CHECK (deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        CHECK (deadline >= start_date)
      );

      -- Pemetaan status lama dibuat generik (bukan per-id) supaya benar untuk
      -- data apa pun, bukan cuma delapan baris seed. Sebaran yang lebih kaya
      -- datang dari lib/mock-data.ts lewat upsert di seed.ts.
      INSERT INTO projects_baru
        (id, name, description, type, status, priority, progress_pct,
         start_date, deadline, owner_id, created_at, updated_at)
      SELECT
         id, name, description, type,
         CASE status
           WHEN 'Belum Mulai'     THEN 'Prospect'
           WHEN 'Sedang Berjalan' THEN 'Berjalan'
           ELSE 'Selesai'
         END,
         priority, progress_pct,
         start_date, deadline, owner_id, created_at, updated_at
      FROM projects;

      DROP TABLE projects;
      ALTER TABLE projects_baru RENAME TO projects;

      CREATE INDEX idx_projects_owner ON projects(owner_id);
      CREATE INDEX idx_projects_status ON projects(status);
      CREATE INDEX idx_projects_priority ON projects(priority);
      CREATE INDEX idx_projects_deadline ON projects(deadline);
      CREATE INDEX idx_projects_range ON projects(start_date, deadline);
      -- Daftar proyek sering disaring atau dicari lewat instansi klien.
      CREATE INDEX idx_projects_client_org ON projects(client_org);
    `,
  },
  {
    id: 4,
    name: "mode-prioritas-otomatis",
    up: `
      -- Kolom baru saja: tidak perlu rebuild tabel karena tidak ada CHECK lama
      -- yang berubah. ALTER TABLE ADD COLUMN aman di SQLite.
      ALTER TABLE projects ADD COLUMN priority_mode TEXT NOT NULL DEFAULT 'auto'
        CHECK (priority_mode IN ('auto', 'manual'));

      -- Baris lama sudah punya prioritas yang disetel orang, jadi dikunci
      -- manual supaya angkanya tidak berubah diam-diam setelah migrasi ini.
      UPDATE projects SET priority_mode = 'manual';

      CREATE INDEX idx_projects_priority_mode ON projects(priority_mode);
    `,
  },
  {
    id: 5,
    name: "tabel-jenis-proyek-dan-riwayat-progres",
    up: `
      -- Jenis proyek: tabel referensi berisi keempat kategori tetap. Penegakan
      -- nilainya tetap lewat CHECK di kolom projects.type — menambah FOREIGN KEY
      -- berarti membangun ulang tabel projects hanya untuk aturan yang sudah
      -- dijaga, jadi tabel ini dipakai untuk label, urutan, dan keterangannya.
      CREATE TABLE project_types (
        code        TEXT PRIMARY KEY CHECK (code IN ('Penjualan', 'Jasa', 'Training', 'Riset')),
        label       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        -- Urutan tampil di dropdown dan halaman kelola jenis.
        sort_order  INTEGER NOT NULL
      );

      -- Riwayat progres: satu baris per pembaruan, jadi jejak auditnya utuh
      -- (PRD bagian 11). Menghapus proyek ikut menghapus riwayatnya, tapi
      -- anggota yang pernah mencatat tidak boleh hilang begitu saja.
      CREATE TABLE progress_history (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        progress_pct INTEGER NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
        note         TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
      );

      -- Halaman detail selalu mengambil riwayat satu proyek, terbaru dulu.
      CREATE INDEX idx_progress_project ON progress_history(project_id, created_at DESC);
      CREATE INDEX idx_progress_user ON progress_history(user_id);
    `,
  },
  {
    id: 6,
    name: "stempel-waktu-riwayat-progres",
    up: `
      -- ERD PRD menyebut created_at sebagai datetime, tapi migrasi 5 menyimpan
      -- tanggal saja. Akibatnya dua catatan di hari yang sama hanya bisa
      -- diurutkan lewat id. Kolom ini menyimpan waktu penuh supaya jejak
      -- auditnya benar-benar berurutan.
      --
      -- Dibuat nullable karena SQLite melarang ADD COLUMN NOT NULL dengan
      -- DEFAULT berupa ekspresi seperti datetime('now'); baris lama diisi
      -- lewat UPDATE di bawah.
      ALTER TABLE progress_history ADD COLUMN recorded_at TEXT
        CHECK (recorded_at IS NULL OR recorded_at GLOB
          '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]');

      -- Baris lama tidak punya jam; dianggap tengah malam pada tanggalnya.
      UPDATE progress_history SET recorded_at = created_at || ' 00:00:00'
      WHERE recorded_at IS NULL;

      CREATE INDEX idx_progress_recorded ON progress_history(project_id, recorded_at DESC);
    `,
  },
  {
    id: 7,
    name: "tabel-pengingat-jadwal-dan-status-baca-notifikasi",
    up: `
      -- Catatan penting: TIDAK ada tabel "notifications" di sini, dan itu
      -- disengaja. Notifikasi di aplikasi ini diturunkan dari keadaan proyek
      -- (lihat lib/notifications.ts), jadi menyimpannya sebagai baris justru
      -- membuat peringatan basi bertahan setelah penyebabnya beres. Yang perlu
      -- disimpan hanyalah hal yang tidak bisa dihitung ulang: status baca per
      -- orang, dan pengingat yang benar-benar dikirim.

      -- Pengingat manual yang pernah dikirim. Jejaknya disimpan supaya jelas
      -- siapa sudah mengingatkan siapa, dan PIC tidak dinag berkali-kali.
      CREATE TABLE reminders (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        message      TEXT NOT NULL,
        -- Sementara hanya in-app; kolomnya sudah ada supaya penambahan email
        -- nanti tidak perlu membangun ulang tabel.
        channel      TEXT NOT NULL DEFAULT 'in-app' CHECK (channel IN ('in-app', 'email')),
        created_at   TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        sent_at      TEXT NOT NULL
      );

      -- Jadwal pengingat berulang — padanan tabel REMINDERS di ERD PRD.
      -- Satu proyek cukup satu jadwal, jadi project_id dibuat UNIQUE: aturan
      -- "mengatur ulang berarti menimpa" ditegakkan skema, bukan cuma kode.
      CREATE TABLE reminder_schedules (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        to_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        frequency   TEXT NOT NULL CHECK (frequency IN (
                      'harian', 'mingguan', 'dua-mingguan', 'bulanan'
                    )),
        next_at     TEXT NOT NULL CHECK (next_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Status baca notifikasi per orang. Sekarang masih di localStorage tiap
      -- peramban; tabel ini bentuk tujuannya setelah autentikasi jadi.
      -- Kolom signature menyimpan tanggal kejadian saat ditandai dibaca, sehingga
      -- notifikasi yang keadaannya berubah otomatis terhitung baru lagi.
      CREATE TABLE notification_reads (
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_id TEXT NOT NULL,
        signature       TEXT NOT NULL,
        read_at         TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, notification_id)
      );

      CREATE INDEX idx_reminders_project ON reminders(project_id, sent_at DESC);
      CREATE INDEX idx_reminders_to ON reminders(to_user_id);
      -- Pengiriman terjadwal dicari lewat "yang aktif dan sudah jatuh tempo".
      CREATE INDEX idx_schedules_due ON reminder_schedules(is_active, next_at);
    `,
  },
  {
    id: 8,
    name: "tabel-komentar-proyek",
    up: `
      -- Diskusi proyek (F14). Menghapus proyek ikut menghapus komentarnya,
      -- tapi anggota yang pernah menulis tidak boleh hilang begitu saja —
      -- kalau tidak, komentarnya jadi yatim tanpa penulis.
      CREATE TABLE comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        -- Komentar kosong tidak ada gunanya; batasnya sama dengan validasi form.
        body       TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 2 AND 1000),
        created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        posted_at  TEXT NOT NULL
      );

      -- Halaman detail selalu mengambil komentar satu proyek, terlama dulu.
      CREATE INDEX idx_comments_project ON comments(project_id, posted_at);
      CREATE INDEX idx_comments_user ON comments(user_id);
    `,
  },
  {
    id: 9,
    name: "email-unik-tanpa-huruf-besar-sesi-dan-preferensi",
    up: `
      -- UNIQUE bawaan di kolom email membedakan huruf besar-kecil, sehingga
      -- 'rani@jsi.co.id' dan 'RANI@jsi.co.id' bisa hidup berdampingan. Karena
      -- pencocokan saat masuk memakai huruf kecil, dua baris itu jadi satu
      -- identitas login dan yang terpilih bergantung urutan data. Indeks ini
      -- menutup celahnya di level database.
      CREATE UNIQUE INDEX idx_users_email_lower ON users(lower(email));

      -- Sesi masuk. Cookie sekarang hanya berisi id pengguna dan bisa ditebak;
      -- tabel ini wadah untuk token acak yang bisa dicabut dan kedaluwarsa.
      -- ponytail: lib/auth.ts beralih ke token ini begitu login sungguhan jadi.
      CREATE TABLE sessions (
        -- Token acak, bukan angka berurut: id yang bisa ditebak sama saja
        -- dengan tidak ada sesi.
        token      TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );

      -- Membersihkan sesi kedaluwarsa dan mencabut seluruh sesi satu orang.
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

      -- Preferensi tampilan per pengguna (ERD PRD bagian 6). Sekarang masih di
      -- localStorage tiap peramban; tabel ini bentuk tujuannya supaya setelan
      -- ikut orangnya, bukan perangkatnya.
      CREATE TABLE user_preferences (
        user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme_mode   TEXT NOT NULL DEFAULT 'system'
                       CHECK (theme_mode IN ('system', 'light', 'dark')),
        accent_color TEXT NOT NULL DEFAULT 'bawaan'
                       CHECK (accent_color IN ('bawaan', 'biru', 'ungu', 'hijau', 'jingga')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    id: 10,
    name: "parameter-prioritas-tim",
    up: `
      -- Tiga dari enam parameter prioritas yang disepakati tim belum punya
      -- datanya. Dua di antaranya cukup kolom baru; tidak perlu membangun ulang
      -- tabel karena tidak ada CHECK lama yang berubah.

      -- Bobot 20%. DEFAULT 'Reguler' supaya baris lama dapat nilai tengah yang
      -- netral, bukan dianggap VIP maupun internal.
      ALTER TABLE projects ADD COLUMN client_tier TEXT NOT NULL DEFAULT 'Reguler'
        CHECK (client_tier IN ('VIP', 'Strategis', 'Reguler', 'Baru', 'Internal'));

      -- Bobot 15%. DEFAULT 'Tidak ada': menganggap ada penalti padahal belum
      -- diperiksa akan menaikkan prioritas tanpa dasar.
      ALTER TABLE projects ADD COLUMN penalty_risk TEXT NOT NULL DEFAULT 'Tidak ada'
        CHECK (penalty_risk IN (
          'Putus kontrak', 'Denda harian', 'Denda tetap', 'Teguran', 'Tidak ada'
        ));

      -- Bobot 10%. Disimpan sebagai relasi, bukan angka di kolom projects,
      -- supaya hitungan "menahan berapa proyek" tidak pernah basi.
      -- Arahnya: blocker_id menahan blocked_id.
      CREATE TABLE project_dependencies (
        blocker_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        blocked_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        -- Pasangan yang sama tidak bisa dicatat dua kali.
        PRIMARY KEY (blocker_id, blocked_id),
        -- Proyek tidak bisa menahan dirinya sendiri.
        CHECK (blocker_id <> blocked_id)
      );

      -- PRIMARY KEY sudah mengindeks blocker_id; ini untuk arah sebaliknya
      -- ("proyek ini ditahan oleh siapa").
      CREATE INDEX idx_dependencies_blocked ON project_dependencies(blocked_id);

      -- Catatan: relasi melingkar (A menahan B, B menahan A) tidak bisa dijaga
      -- SQLite tanpa trigger rekursif. Itu ditegakkan validasi aplikasi lewat
      -- wouldCycle() di lib/priority.ts.
      CREATE INDEX idx_projects_client_tier ON projects(client_tier);
    `,
  },
  {
    id: 11,
    name: "detail-kontrak-keuangan",
    up: `
      -- Sisi kontrak proyek: nomor, tanggal tanda tangan, skema pembayaran,
      -- status pajak, dan struktur biaya. Semuanya kolom tambahan; tidak ada
      -- CHECK lama yang berubah, jadi tabelnya tidak perlu dibangun ulang.

      -- "" = belum ada kontrak, mengikuti pola kolom client_* yang sudah ada.
      ALTER TABLE projects ADD COLUMN contract_no TEXT NOT NULL DEFAULT '';

      -- NULL, bukan '': proyek tahap Prospect memang belum diteken. Sengaja
      -- dipisah dari start_date, yang tetap milik timeline dan parameter
      -- Progres Tertinggal — pekerjaan bisa mulai sebelum kontrak terbit.
      ALTER TABLE projects ADD COLUMN contract_date TEXT;

      -- TOP = skema pembayaran, bukan tempo jatuh tempo dalam hari.
      ALTER TABLE projects ADD COLUMN payment_term TEXT NOT NULL DEFAULT 'Full'
        CHECK (payment_term IN ('Full', '3 Termin', 'Custom'));

      -- Keterangan skema; kewajibannya saat payment_term = 'Custom' ditegakkan
      -- validasi aplikasi, karena CHECK lintas kolom di sini akan ikut menolak
      -- baris lama yang catatannya memang kosong.
      ALTER TABLE projects ADD COLUMN payment_note TEXT NOT NULL DEFAULT '';

      -- DEFAULT 'Non PKP' adalah satu-satunya pilihan yang tidak mengubah angka
      -- apa pun: margin tetap nilai dikurangi biaya. Menebak 'PKP' akan
      -- memotong sekitar 9,9% dari margin tiap proyek lama tanpa pernah
      -- diperiksa orang.
      ALTER TABLE projects ADD COLUMN tax_type TEXT NOT NULL DEFAULT 'Non PKP'
        CHECK (tax_type IN ('PKP', 'Non PKP'));

      -- NULL = belum diisi, berbeda dari 0 = memang tidak ada biayanya.
      ALTER TABLE projects ADD COLUMN sales_fee INTEGER
        CHECK (sales_fee IS NULL OR sales_fee >= 0);
      ALTER TABLE projects ADD COLUMN operational_cost INTEGER
        CHECK (operational_cost IS NULL OR operational_cost >= 0);

      -- Margin/profit sengaja tidak dikolomkan: ia turunan dari empat kolom di
      -- atas dan akan basi begitu salah satunya berubah.
      CREATE INDEX idx_projects_contract_no ON projects(contract_no);
    `,
  },
  {
    id: 12,
    name: "tambah-kolom-lokasi-dan-provinsi",
    up: `
      -- Tambahan kolom untuk menyimpan Kota/Kabupaten dan Provinsi secara terpisah
      ALTER TABLE projects ADD COLUMN location_city TEXT NOT NULL DEFAULT '';
      ALTER TABLE projects ADD COLUMN location_province TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    id: 13,
    name: "tingkat-akses-pengguna",
    up: `
      -- Tingkat akses sengaja kolom sendiri, bukan memakai ulang kolom role.
      -- role berisi jabatan bebas ("Project Manager"); kalau keduanya jadi satu,
      -- mengganti jabatan seseorang akan diam-diam mengganti haknya juga.
      --
      -- DEFAULT 'Anggota': hak paling kecil untuk baris lama. Menebak lebih
      -- tinggi berarti memberi akses yang belum pernah diputuskan orang.
      ALTER TABLE users ADD COLUMN access_level TEXT NOT NULL DEFAULT 'Anggota'
        CHECK (access_level IN ('Admin', 'Owner', 'HR', 'Manager', 'Anggota'));

      -- Akun dinonaktifkan, bukan dihapus: namanya harus tetap melekat di
      -- proyek, komentar, dan riwayat progres yang pernah dia buat.
      ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1));

      CREATE INDEX idx_users_access_level ON users(access_level);
    `,
  },
  {
    id: 14,
    name: "agenda-tim",
    up: `
      -- Agenda tim: siapa, kapan, sedang apa, dan di mana. Dipakai HR untuk
      -- tahu posisi orang, dan ikut jadi satu bagian di laporan mingguan.
      CREATE TABLE agenda (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        -- Orang yang menjalani agenda ini.
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        -- SET NULL, bukan CASCADE: orangnya tetap pernah pergi ke sana walau
        -- proyeknya kemudian dihapus, dan jejak itu yang dicari HR.
        project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        kind          TEXT NOT NULL
                        CHECK (kind IN ('Lapangan', 'Kantor', 'Perjalanan', 'Cuti')),
        start_date    TEXT NOT NULL CHECK (start_date LIKE '____-__-__'),
        end_date      TEXT NOT NULL CHECK (end_date LIKE '____-__-__'),
        location_city     TEXT NOT NULL DEFAULT '',
        location_province TEXT NOT NULL DEFAULT '',
        note          TEXT NOT NULL DEFAULT '',
        -- Manager boleh mengisikan untuk anggotanya, jadi "siapa yang mencatat"
        -- berbeda dari "siapa yang menjalani" dan keduanya perlu disimpan.
        created_by    INTEGER NOT NULL REFERENCES users(id),
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
        -- Aturan yang sama dijaga validasi aplikasi di lib/agenda-form.ts.
        CHECK (end_date >= start_date)
      );

      -- Dua arah baca yang berbeda: "agenda si A" dan "siapa saja pekan ini".
      CREATE INDEX idx_agenda_user ON agenda(user_id, start_date);
      CREATE INDEX idx_agenda_rentang ON agenda(start_date, end_date);
    `,
  },
  {
    id: 15,
    name: "rencana-strategis",
    up: `
      -- Lapisan di atas proyek: ke mana divisi menuju, dan pasar mana yang
      -- akan didekati. Tidak ada klien yang membayar dan tidak ada nilai
      -- kontrak — keberhasilannya diukur dari langkah yang tuntas.
      CREATE TABLE strategic_plans (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        summary     TEXT NOT NULL DEFAULT '',
        -- Dua sumbu yang sengaja dipisah: apa kegiatannya, dan untuk apa.
        kind        TEXT NOT NULL
                      CHECK (kind IN ('Pelatihan', 'Riset', 'Kemitraan', 'Sertifikasi', 'Pemasaran')),
        goal        TEXT NOT NULL
                      CHECK (goal IN ('Penetrasi Pasar', 'Kesiapan Regulasi',
                                      'Kapasitas Internal', 'Efisiensi Biaya')),
        -- Sasaran pasar. Segmen tertutup supaya bisa disaring dan dijumlah;
        -- wilayah teks bebas supaya sebangun dengan location_province.
        segment     TEXT NOT NULL
                      CHECK (segment IN ('Tambang', 'Perkebunan', 'Kehutanan', 'Infrastruktur',
                                         'Energi', 'Instansi Pemerintah', 'Akademik', 'Lainnya')),
        region      TEXT NOT NULL DEFAULT '',
        partner     TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL
                      CHECK (status IN ('Ide', 'Disetujui', 'Berjalan',
                                        'Selesai', 'Ditunda', 'Dibatalkan')),
        priority    TEXT NOT NULL CHECK (priority IN ('Tinggi', 'Sedang', 'Rendah')),
        -- RESTRICT: penyusun rencana tidak boleh hilang tanpa disadari.
        owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        -- Boleh NULL: sebuah ide belum tentu sudah punya tanggal.
        start_date  TEXT CHECK (start_date IS NULL OR start_date LIKE '____-__-__'),
        target_date TEXT CHECK (target_date IS NULL OR target_date LIKE '____-__-__'),
        -- Ukuran keberhasilan, ditulis di depan supaya tidak dikarang di belakang.
        outcome     TEXT NOT NULL DEFAULT '',
        created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        CHECK (target_date IS NULL OR start_date IS NULL OR target_date >= start_date)
      );

      -- Langkah pelaksanaan. Progres rencana diturunkan dari sini, tidak
      -- pernah diketik orang.
      CREATE TABLE plan_steps (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id     INTEGER NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        -- SET NULL: langkah boleh dibuat sebelum ada yang ditugaskan.
        owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        target_date TEXT CHECK (target_date IS NULL OR target_date LIKE '____-__-__'),
        status      TEXT NOT NULL CHECK (status IN ('Belum', 'Berjalan', 'Selesai', 'Batal')),
        note        TEXT NOT NULL DEFAULT '',
        -- Urutan ditentukan orang, bukan tanggal: langkah bisa sengaja
        -- berurutan walau tanggalnya belum diisi.
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Calon klien yang akan didekati. Corongnya sendiri, terpisah dari
      -- pipeline proyek: yang di sini belum tentu pernah jadi proyek.
      CREATE TABLE plan_prospects (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id    INTEGER NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        contact    TEXT NOT NULL DEFAULT '',
        region     TEXT NOT NULL DEFAULT '',
        status     TEXT NOT NULL
                     CHECK (status IN ('Belum dihubungi', 'Dihubungi', 'Presentasi',
                                       'Negosiasi', 'Menjadi Klien', 'Tidak Lanjut')),
        note       TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Satu rencana bisa melahirkan beberapa proyek, dan satu proyek bisa
      -- melayani lebih dari satu rencana. Bentuknya sama dengan
      -- project_dependencies.
      CREATE TABLE plan_projects (
        plan_id    INTEGER NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (plan_id, project_id)
      );

      -- Tabel sendiri, bukan menumpang comments: kolom project_id di sana
      -- NOT NULL, dan melonggarkannya akan membuat setiap pembaca komentar
      -- proyek harus menangani baris yang bukan miliknya.
      CREATE TABLE plan_comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id    INTEGER NOT NULL REFERENCES strategic_plans(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        body       TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 2 AND 1000),
        created_at TEXT NOT NULL
                     CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        posted_at  TEXT NOT NULL
      );

      CREATE INDEX idx_plans_goal ON strategic_plans(goal);
      CREATE INDEX idx_plans_segment ON strategic_plans(segment);
      CREATE INDEX idx_plan_steps_plan ON plan_steps(plan_id, sort_order);
      CREATE INDEX idx_plan_prospects_plan ON plan_prospects(plan_id, status);
      CREATE INDEX idx_plan_comments_plan ON plan_comments(plan_id, posted_at);
    `,
  },
];
