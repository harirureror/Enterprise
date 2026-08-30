/**
 * Cek mandiri skema dan migrasi: `npx tsx lib/db/db.check.ts`
 * Semua dijalankan di database `:memory:`, jadi `data/dashboard.db` tidak tersentuh.
 */
import assert from "node:assert/strict";
import { openDb } from "./index";
import { runMigrations } from "./migrate";
import { migrations } from "./migrations";
import { seed } from "./seed";
import {
  comments as mockComments,
  progressHistory as mockProgress,
  projects as mockProjects,
  reminderSchedules as mockSchedules,
  reminders as mockReminders,
  users as mockUsers,
} from "../mock-data";
import {
  CLIENT_TIERS,
  PAYMENT_TERMS,
  PENALTY_RISKS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  TAX_TYPES,
} from "../types";

const db = openDb(":memory:");

// Daftar migrasi harus berid unik dan menaik. Migrasi dijalankan berurutan dan
// dicatat per id, jadi id ganda membuat salah satunya tidak pernah jalan.
const idMigrasi = migrations.map((m) => m.id);
assert.deepEqual(idMigrasi, [...new Set(idMigrasi)], "id migrasi tidak boleh ganda");
assert.deepEqual(idMigrasi, [...idMigrasi].sort((a, b) => a - b), "id migrasi harus urut menaik");
assert.ok(
  migrations.every((m) => m.name.trim() !== "" && m.up.trim() !== ""),
  "tiap migrasi wajib punya nama dan isi"
);

// Migrasi pertama menerapkan semua yang terdaftar.
const baru = runMigrations(db);
assert.equal(baru.length, migrations.length);

// Dijalankan lagi tidak menerapkan apa pun (idempoten).
assert.deepEqual(runMigrations(db), []);

// Tabel yang dijanjikan skema benar-benar ada.
const tabel = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((r) => String(r.name));
assert.ok(tabel.includes("users"));
assert.ok(tabel.includes("projects"));
assert.ok(tabel.includes("_migrations"));
assert.ok(tabel.includes("project_types"));
assert.ok(tabel.includes("progress_history"));
assert.ok(tabel.includes("reminders"));
assert.ok(tabel.includes("reminder_schedules"));
assert.ok(tabel.includes("notification_reads"));
assert.ok(tabel.includes("comments"));
assert.ok(tabel.includes("sessions"));
assert.ok(tabel.includes("user_preferences"));
assert.ok(tabel.includes("project_dependencies"));
// Notifikasi sengaja tidak punya tabel sendiri: isinya dihitung dari keadaan proyek.
assert.equal(tabel.includes("notifications"), false);

// Kolom projects mengikuti ERD PRD dan menutup semua field `lib/types.ts`.
const kolom = db
  .prepare("PRAGMA table_info(projects)")
  .all()
  .map((r) => String(r.name));
assert.deepEqual(kolom, [
  "id",
  "name",
  "description",
  "type",
  "status",
  "priority",
  "progress_pct",
  "client_org",
  "client_name",
  "client_email",
  "client_phone",
  "value",
  "start_date",
  "deadline",
  "owner_id",
  "created_at",
  "updated_at",
  // Ditambahkan migrasi 4 lewat ALTER TABLE, jadi letaknya di paling belakang.
  "priority_mode",
  // Dua parameter prioritas hasil kesepakatan tim, migrasi 10.
  "client_tier",
  "penalty_risk",
  // Detail kontrak dan keuangan, migrasi 11.
  "contract_no",
  "contract_date",
  "payment_term",
  "payment_note",
  "tax_type",
  "sales_fee",
  "operational_cost",
]);

// Seed memasukkan seluruh data awal.
const jumlah = seed(db);
assert.equal(jumlah.users, mockUsers.length);
assert.equal(jumlah.projects, mockProjects.length);
assert.equal(jumlah.types, PROJECT_TYPES.length);
assert.equal(jumlah.progress, mockProgress.length);
assert.equal(jumlah.reminders, mockReminders.length);
assert.equal(jumlah.schedules, mockSchedules.length);
assert.equal(jumlah.comments, mockComments.length);

const hitung = (sql: string) => Number(db.prepare(sql).get()!.n);
assert.equal(hitung("SELECT COUNT(*) AS n FROM users"), mockUsers.length);
assert.equal(hitung("SELECT COUNT(*) AS n FROM projects"), mockProjects.length);

// Seed ulang menimpa, bukan menggandakan.
seed(db);
assert.equal(hitung("SELECT COUNT(*) AS n FROM projects"), mockProjects.length);

// Nilai yang tersimpan sama persis dengan mock-data.
const p1 = db.prepare("SELECT * FROM projects WHERE id = 1").get()!;
assert.equal(p1.name, mockProjects[0].name);
assert.equal(p1.progress_pct, mockProjects[0].progressPct);
assert.equal(p1.start_date, mockProjects[0].startDate);
assert.equal(p1.owner_id, mockProjects[0].ownerId);
assert.equal(p1.client_org, mockProjects[0].clientOrg);
assert.equal(p1.client_email, mockProjects[0].clientEmail);
assert.equal(p1.value, mockProjects[0].value);
// Proyek internal tanpa nilai tersimpan sebagai NULL, bukan 0.
assert.equal(db.prepare("SELECT value FROM projects WHERE id = 4").get()!.value, null);
assert.equal(db.prepare("SELECT * FROM users WHERE id = 1").get()!.avatar_url, null);

const tolak = (sql: string, alasan: string) =>
  assert.throws(() => db.exec(sql), new RegExp(alasan, "i"));

// Enum dijaga di level database, bukan cuma di TypeScript.
tolak(
  `INSERT INTO projects (name, type, status, priority, start_date, deadline, owner_id)
   VALUES ('X', 'Konsultasi', 'Selesai', 'Tinggi', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
tolak(
  `INSERT INTO projects (name, type, status, priority, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Pending', 'Tinggi', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
// Status lama sudah tidak berlaku setelah migrasi 3.
tolak(
  `INSERT INTO projects (name, type, status, priority, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Sedang Berjalan', 'Tinggi', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
tolak(
  `INSERT INTO projects (name, type, status, priority, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Selesai', 'Urgent', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);

// Progres di luar 0-100 ditolak.
tolak(
  `INSERT INTO projects (name, type, status, priority, progress_pct, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Selesai', 'Tinggi', 120, '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);

// Tanggal wajib ISO YYYY-MM-DD, karena timeline mengurutkan sebagai teks.
tolak(
  `INSERT INTO projects (name, type, status, priority, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Selesai', 'Tinggi', '01-08-2026', '2026-08-02', 1)`,
  "constraint"
);

// owner_id harus menunjuk anggota yang ada.
tolak(
  `INSERT INTO projects (name, type, status, priority, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Selesai', 'Tinggi', '2026-08-01', '2026-08-02', 99)`,
  "foreign key"
);

// Nilai proyek tidak boleh negatif, tapi NULL sah — artinya belum ada angkanya.
tolak(
  `INSERT INTO projects (name, type, status, priority, value, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', -1, '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, value, start_date, deadline, owner_id)
   VALUES (901, 'Tanpa nilai', 'Jasa', 'Prospect', 'Rendah', NULL, '2026-08-01', '2026-08-02', 1)`
);
assert.equal(db.prepare("SELECT value FROM projects WHERE id = 901").get()!.value, null);
// Kolom klien punya DEFAULT '', jadi baris tanpa kolom itu tetap bisa masuk.
assert.equal(db.prepare("SELECT client_org FROM projects WHERE id = 901").get()!.client_org, "");
db.exec("DELETE FROM projects WHERE id = 901");

// Setiap status di PROJECT_STATUSES diterima database. Diambil dari konstanta
// TypeScript, bukan daftar tersendiri, supaya CHECK di skema tidak bisa
// melenceng dari union tanpa ketahuan.
PROJECT_STATUSES.forEach((st, i) => {
  db.exec(
    `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
     VALUES (${910 + i}, 'Uji ${st}', 'Jasa', '${st}', 'Rendah', '2026-08-01', '2026-08-02', 1)`
  );
});
assert.equal(
  hitung(`SELECT COUNT(*) AS n FROM projects WHERE id BETWEEN 910 AND ${909 + PROJECT_STATUSES.length}`),
  PROJECT_STATUSES.length
);
// Sebaliknya juga: CHECK tidak boleh menerima nilai di luar union.
assert.deepEqual(
  db
    .prepare(`SELECT DISTINCT status FROM projects WHERE id BETWEEN 910 AND ${909 + PROJECT_STATUSES.length} ORDER BY status`)
    .all()
    .map((r) => String(r.status))
    .sort(),
  [...PROJECT_STATUSES].sort()
);
db.exec(`DELETE FROM projects WHERE id BETWEEN 910 AND ${909 + PROJECT_STATUSES.length}`);

// Mode prioritas hanya boleh 'auto' atau 'manual'.
tolak(
  `INSERT INTO projects (name, type, status, priority, priority_mode, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', 'otomatis', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
// Tanpa kolom itu, DEFAULT 'auto' yang dipakai.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (902, 'Default mode', 'Jasa', 'Prospect', 'Rendah', '2026-08-01', '2026-08-02', 1)`
);
assert.equal(
  db.prepare("SELECT priority_mode FROM projects WHERE id = 902").get()!.priority_mode,
  "auto"
);
db.exec("DELETE FROM projects WHERE id = 902");

// Jenis proyek: tabel referensi harus sinkron dengan PROJECT_TYPES di TypeScript.
assert.deepEqual(
  db
    .prepare("SELECT code FROM project_types ORDER BY sort_order")
    .all()
    .map((r) => String(r.code)),
  PROJECT_TYPES
);
// Kode di luar keempat kategori ditolak.
tolak(
  `INSERT INTO project_types (code, label, sort_order) VALUES ('Konsultasi', 'Konsultasi', 9)`,
  "constraint"
);

// Riwayat progres: tersimpan lengkap dan terikat ke proyek yang benar.
assert.equal(hitung("SELECT COUNT(*) AS n FROM progress_history"), mockProgress.length);
const riwayat1 = db
  .prepare("SELECT * FROM progress_history WHERE project_id = 1 ORDER BY created_at DESC")
  .all();
assert.equal(riwayat1.length, mockProgress.filter((e) => e.projectId === 1).length);
assert.equal(riwayat1[0].progress_pct, 65);

// Progres di riwayat juga dibatasi 0-100.
tolak(
  `INSERT INTO progress_history (project_id, user_id, progress_pct, created_at)
   VALUES (1, 1, 150, '2026-08-01')`,
  "constraint"
);
// Tanggal riwayat wajib ISO.
tolak(
  `INSERT INTO progress_history (project_id, user_id, progress_pct, created_at)
   VALUES (1, 1, 50, '01-08-2026')`,
  "constraint"
);
// Riwayat tidak boleh menggantung ke proyek atau anggota yang tidak ada.
tolak(
  `INSERT INTO progress_history (project_id, user_id, progress_pct, created_at)
   VALUES (999, 1, 50, '2026-08-01')`,
  "foreign key"
);
tolak(
  `INSERT INTO progress_history (project_id, user_id, progress_pct, created_at)
   VALUES (1, 99, 50, '2026-08-01')`,
  "foreign key"
);

// Menghapus proyek ikut menghapus riwayatnya (CASCADE), tanpa menyentuh yang lain.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (903, 'Proyek sekali pakai', 'Jasa', 'Prospect', 'Rendah', '2026-08-01', '2026-08-02', 1)`
);
db.exec(
  `INSERT INTO progress_history (project_id, user_id, progress_pct, created_at)
   VALUES (903, 1, 10, '2026-08-01')`
);
assert.equal(hitung("SELECT COUNT(*) AS n FROM progress_history WHERE project_id = 903"), 1);
db.exec("DELETE FROM projects WHERE id = 903");
assert.equal(hitung("SELECT COUNT(*) AS n FROM progress_history WHERE project_id = 903"), 0);
assert.equal(hitung("SELECT COUNT(*) AS n FROM progress_history"), mockProgress.length);

// Stempel waktu riwayat: kolomnya ada, terisi, dan formatnya dijaga.
const kolomRiwayat = db
  .prepare("PRAGMA table_info(progress_history)")
  .all()
  .map((r) => String(r.name));
assert.deepEqual(kolomRiwayat, [
  "id",
  "project_id",
  "user_id",
  "progress_pct",
  "note",
  "created_at",
  // Ditambahkan migrasi 6 lewat ALTER TABLE.
  "recorded_at",
]);
assert.equal(hitung("SELECT COUNT(*) AS n FROM progress_history WHERE recorded_at IS NULL"), 0);
tolak(
  `INSERT INTO progress_history (project_id, user_id, progress_pct, created_at, recorded_at)
   VALUES (1, 1, 50, '2026-08-01', '2026-08-01')`,
  "constraint"
);

// Dua catatan di hari yang sama tetap berurutan lewat recorded_at.
db.exec(
  `INSERT INTO progress_history (id, project_id, user_id, progress_pct, created_at, recorded_at)
   VALUES (801, 1, 1, 80, '2026-09-01', '2026-09-01 08:00:00'),
          (802, 1, 1, 90, '2026-09-01', '2026-09-01 16:30:00')`
);
assert.deepEqual(
  db
    .prepare(
      "SELECT id FROM progress_history WHERE created_at = '2026-09-01' ORDER BY recorded_at DESC"
    )
    .all()
    .map((r) => Number(r.id)),
  [802, 801]
);
db.exec("DELETE FROM progress_history WHERE id IN (801, 802)");

// Anggota yang pernah mencatat progres tidak boleh terhapus diam-diam.
tolak("DELETE FROM users WHERE id = 3", "foreign key");

// Pengingat: tersimpan lengkap dan terikat ke proyek serta anggota yang ada.
assert.equal(hitung("SELECT COUNT(*) AS n FROM reminders"), mockReminders.length);
tolak(
  `INSERT INTO reminders (project_id, to_user_id, from_user_id, message, created_at, sent_at)
   VALUES (999, 1, 1, 'x', '2026-08-01', '2026-08-01 09:00:00')`,
  "foreign key"
);
// Kanal hanya in-app atau email.
tolak(
  `INSERT INTO reminders (project_id, to_user_id, from_user_id, message, channel, created_at, sent_at)
   VALUES (1, 1, 1, 'x', 'whatsapp', '2026-08-01', '2026-08-01 09:00:00')`,
  "constraint"
);

// Jadwal: satu proyek hanya boleh punya satu, ditegakkan UNIQUE.
assert.equal(hitung("SELECT COUNT(*) AS n FROM reminder_schedules"), mockSchedules.length);
tolak(
  `INSERT INTO reminder_schedules (project_id, to_user_id, frequency, next_at)
   VALUES (${mockSchedules[0].projectId}, 1, 'harian', '2026-09-01')`,
  "unique"
);
// Frekuensi di luar daftar ditolak.
tolak(
  `INSERT INTO reminder_schedules (project_id, to_user_id, frequency, next_at)
   VALUES (1, 1, 'tiap jam', '2026-09-01')`,
  "constraint"
);
// is_active hanya 0 atau 1.
tolak(
  `INSERT INTO reminder_schedules (project_id, to_user_id, frequency, next_at, is_active)
   VALUES (2, 1, 'harian', '2026-09-01', 2)`,
  "constraint"
);

// Menghapus proyek ikut menghapus pengingat dan jadwalnya.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (904, 'Sekali pakai', 'Jasa', 'Prospect', 'Rendah', '2026-08-01', '2026-08-02', 1)`
);
db.exec(
  `INSERT INTO reminders (project_id, to_user_id, from_user_id, message, created_at, sent_at)
   VALUES (904, 1, 1, 'x', '2026-08-01', '2026-08-01 09:00:00')`
);
db.exec(
  `INSERT INTO reminder_schedules (project_id, to_user_id, frequency, next_at)
   VALUES (904, 1, 'harian', '2026-09-01')`
);
db.exec("DELETE FROM projects WHERE id = 904");
assert.equal(hitung("SELECT COUNT(*) AS n FROM reminders WHERE project_id = 904"), 0);
assert.equal(hitung("SELECT COUNT(*) AS n FROM reminder_schedules WHERE project_id = 904"), 0);

// Status baca notifikasi: satu baris per (pengguna, notifikasi).
db.exec(
  `INSERT INTO notification_reads (user_id, notification_id, signature)
   VALUES (1, 'segera-6', '2026-09-01')`
);
tolak(
  `INSERT INTO notification_reads (user_id, notification_id, signature)
   VALUES (1, 'segera-6', '2026-09-02')`,
  "unique|primary key|constraint"
);
// Pengguna berbeda boleh menandai notifikasi yang sama.
db.exec(
  `INSERT INTO notification_reads (user_id, notification_id, signature)
   VALUES (2, 'segera-6', '2026-09-01')`
);
assert.equal(hitung("SELECT COUNT(*) AS n FROM notification_reads"), 2);
db.exec("DELETE FROM notification_reads");

// Pulang-pergi: apa yang di-seed harus terbaca kembali persis seperti bentuk
// TypeScript-nya. Ini yang paling gampang meleset karena SQLite tidak punya
// tipe boolean — is_active tersimpan sebagai 0/1.
const jadwalDb = db.prepare("SELECT * FROM reminder_schedules ORDER BY id").all();
assert.equal(jadwalDb.length, mockSchedules.length);
jadwalDb.forEach((row, i) => {
  const asal = mockSchedules[i];
  assert.equal(Number(row.project_id), asal.projectId);
  assert.equal(Number(row.to_user_id), asal.toUserId);
  assert.equal(String(row.frequency), asal.frequency);
  assert.equal(String(row.next_at), asal.nextAt);
  // 0/1 harus bisa dipetakan balik ke boolean tanpa kehilangan makna.
  assert.equal(Boolean(row.is_active), asal.isActive);
  assert.equal(typeof row.is_active, "number");
});

const pengingatDb = db.prepare("SELECT * FROM reminders ORDER BY id").all();
assert.equal(pengingatDb.length, mockReminders.length);
pengingatDb.forEach((row, i) => {
  const asal = mockReminders[i];
  assert.equal(Number(row.project_id), asal.projectId);
  assert.equal(Number(row.to_user_id), asal.toUserId);
  assert.equal(Number(row.from_user_id), asal.fromUserId);
  assert.equal(String(row.message), asal.message);
  assert.equal(String(row.channel), asal.channel);
  assert.equal(String(row.created_at), asal.createdAt);
  assert.equal(String(row.sent_at), asal.sentAt);
});

// Jadwal yang dimatikan tetap tersimpan 0, bukan hilang atau jadi NULL.
db.exec("UPDATE reminder_schedules SET is_active = 0 WHERE id = 1");
assert.equal(
  Boolean(db.prepare("SELECT is_active FROM reminder_schedules WHERE id = 1").get()!.is_active),
  false
);
db.exec("UPDATE reminder_schedules SET is_active = 1 WHERE id = 1");

// Komentar: tersimpan lengkap dan terurut sebagai percakapan.
assert.equal(hitung("SELECT COUNT(*) AS n FROM comments"), mockComments.length);
assert.deepEqual(
  db
    .prepare("SELECT id FROM comments WHERE project_id = 6 ORDER BY posted_at")
    .all()
    .map((r) => Number(r.id)),
  mockComments
    .filter((c) => c.projectId === 6)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
    .map((c) => c.id)
);

// Komentar kosong atau hanya spasi ditolak database, bukan cuma form.
tolak(
  `INSERT INTO comments (project_id, user_id, body, created_at, posted_at)
   VALUES (1, 1, '   ', '2026-08-01', '2026-08-01 09:00:00')`,
  "constraint"
);
tolak(
  `INSERT INTO comments (project_id, user_id, body, created_at, posted_at)
   VALUES (1, 1, 'a', '2026-08-01', '2026-08-01 09:00:00')`,
  "constraint"
);
// Terlalu panjang juga ditolak, batasnya sama dengan validasi form.
tolak(
  `INSERT INTO comments (project_id, user_id, body, created_at, posted_at)
   VALUES (1, 1, '${"x".repeat(1001)}', '2026-08-01', '2026-08-01 09:00:00')`,
  "constraint"
);
// Panjang tepat di batas atas diterima.
db.exec(
  `INSERT INTO comments (id, project_id, user_id, body, created_at, posted_at)
   VALUES (801, 1, 1, '${"x".repeat(1000)}', '2026-08-01', '2026-08-01 09:00:00')`
);
db.exec("DELETE FROM comments WHERE id = 801");

// Komentar tidak boleh menggantung ke proyek atau penulis yang tidak ada.
tolak(
  `INSERT INTO comments (project_id, user_id, body, created_at, posted_at)
   VALUES (999, 1, 'halo', '2026-08-01', '2026-08-01 09:00:00')`,
  "foreign key"
);
tolak(
  `INSERT INTO comments (project_id, user_id, body, created_at, posted_at)
   VALUES (1, 99, 'halo', '2026-08-01', '2026-08-01 09:00:00')`,
  "foreign key"
);

// Menghapus proyek ikut menghapus komentarnya.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (905, 'Sekali pakai', 'Jasa', 'Prospect', 'Rendah', '2026-08-01', '2026-08-02', 1)`
);
db.exec(
  `INSERT INTO comments (project_id, user_id, body, created_at, posted_at)
   VALUES (905, 1, 'komentar uji', '2026-08-01', '2026-08-01 09:00:00')`
);
db.exec("DELETE FROM projects WHERE id = 905");
assert.equal(hitung("SELECT COUNT(*) AS n FROM comments WHERE project_id = 905"), 0);

// Penulis komentar tidak boleh terhapus diam-diam.
tolak(`DELETE FROM users WHERE id = ${mockComments[0].userId}`, "foreign key");

// Email unik tanpa memandang huruf besar-kecil. Tanpa ini, dua baris bisa
// mewakili satu identitas login dan yang terpilih bergantung urutan data.
tolak(
  `INSERT INTO users (email, name, role) VALUES ('${mockUsers[0].email.toUpperCase()}', 'Kembar', 'Staf')`,
  "unique"
);
tolak(
  `INSERT INTO users (email, name, role) VALUES ('${mockUsers[0].email.replace("@", "@").toUpperCase()}', 'Kembar', 'Staf')`,
  "unique"
);

// Sesi: token acak, terikat pengguna, dan ikut terhapus bersama akunnya.
db.exec(
  `INSERT INTO users (id, email, name, role) VALUES (900, 'sesi@uji.co.id', 'Uji Sesi', 'Staf')`
);
db.exec(
  `INSERT INTO sessions (token, user_id, expires_at)
   VALUES ('token-uji-1', 900, '2026-12-31 00:00:00')`
);
// Token wajib unik — dua sesi dengan token sama berarti satu bisa membajak lainnya.
tolak(
  `INSERT INTO sessions (token, user_id, expires_at)
   VALUES ('token-uji-1', 900, '2026-12-31 00:00:00')`,
  "unique|primary key|constraint"
);
tolak(
  `INSERT INTO sessions (token, user_id, expires_at)
   VALUES ('token-uji-2', 999, '2026-12-31 00:00:00')`,
  "foreign key"
);

// Preferensi: satu baris per pengguna, nilainya dijaga CHECK.
db.exec(`INSERT INTO user_preferences (user_id) VALUES (900)`);
const pref = db.prepare("SELECT * FROM user_preferences WHERE user_id = 900").get()!;
assert.equal(pref.theme_mode, "system");
assert.equal(pref.accent_color, "bawaan");
tolak(`INSERT INTO user_preferences (user_id) VALUES (900)`, "unique|primary key|constraint");
tolak(`UPDATE user_preferences SET theme_mode = 'gelap' WHERE user_id = 900`, "constraint");
tolak(`UPDATE user_preferences SET accent_color = 'merah' WHERE user_id = 900`, "constraint");

// Menghapus pengguna ikut menghapus sesi dan preferensinya.
db.exec("DELETE FROM users WHERE id = 900");
assert.equal(hitung("SELECT COUNT(*) AS n FROM sessions WHERE user_id = 900"), 0);
assert.equal(hitung("SELECT COUNT(*) AS n FROM user_preferences WHERE user_id = 900"), 0);

// Email anggota unik.
tolak(
  `INSERT INTO users (email, name, role) VALUES ('${mockUsers[0].email}', 'Kembar', 'Staf')`,
  "unique"
);

// Anggota yang masih pegang proyek tidak bisa dihapus begitu saja.
tolak("DELETE FROM users WHERE id = 1", "foreign key");

// Timeline: tenggat tidak boleh mendahului tanggal mulai.
tolak(
  `INSERT INTO projects (name, type, status, priority, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Selesai', 'Tinggi', '2026-08-10', '2026-08-01', 1)`,
  "constraint"
);
// Mulai dan tenggat di hari yang sama tetap sah — proyek sehari.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (900, 'Sehari', 'Jasa', 'Selesai', 'Rendah', '2026-08-10', '2026-08-10', 1)`
);
assert.equal(hitung("SELECT COUNT(*) AS n FROM projects WHERE id = 900"), 1);
db.exec("DELETE FROM projects WHERE id = 900");

// Indeks yang dipakai kueri rentang timeline benar-benar ada.
const indeks = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'projects'")
  .all()
  .map((r) => String(r.name));
assert.ok(indeks.includes("idx_projects_range"));
assert.ok(indeks.includes("idx_projects_client_org"));
assert.ok(indeks.includes("idx_projects_priority_mode"));

/* --- Ketergantungan antar proyek (migrasi 10) ------------------------------ */

// Dua kolom parameter prioritas punya DEFAULT, jadi baris lama tetap sah.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (903, 'Tanpa parameter', 'Jasa', 'Prospect', 'Rendah', '2026-08-01', '2026-08-02', 1)`
);
const bawaan = db.prepare("SELECT client_tier, penalty_risk FROM projects WHERE id = 903").get()!;
assert.equal(bawaan.client_tier, "Reguler");
assert.equal(bawaan.penalty_risk, "Tidak ada");
db.exec("DELETE FROM projects WHERE id = 903");

// Keduanya enum tertutup: nilai di luar daftar ditolak database, bukan disimpan.
tolak(
  `INSERT INTO projects (name, type, status, priority, client_tier, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', 'Platinum', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
tolak(
  `INSERT INTO projects (name, type, status, priority, penalty_risk, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', 'Blacklist', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);

// Semua nilai yang sah menurut TypeScript diterima database — daftarnya diambil
// dari konstanta, jadi CHECK tidak bisa melenceng dari union tanpa ketahuan.
CLIENT_TIERS.forEach((t, i) => {
  db.exec(
    `INSERT INTO projects (id, name, type, status, priority, client_tier, start_date, deadline, owner_id)
     VALUES (${920 + i}, 'Uji ${t}', 'Jasa', 'Prospect', 'Rendah', '${t}', '2026-08-01', '2026-08-02', 1)`
  );
});
PENALTY_RISKS.forEach((r, i) => {
  db.exec(
    `INSERT INTO projects (id, name, type, status, priority, penalty_risk, start_date, deadline, owner_id)
     VALUES (${930 + i}, 'Uji penalti ${i}', 'Jasa', 'Prospect', 'Rendah', '${r}', '2026-08-01', '2026-08-02', 1)`
  );
});
assert.equal(
  hitung("SELECT COUNT(*) AS n FROM projects WHERE id BETWEEN 920 AND 939"),
  CLIENT_TIERS.length + PENALTY_RISKS.length
);

// Relasi ketergantungan: arahnya blocker -> blocked.
db.exec("INSERT INTO project_dependencies (blocker_id, blocked_id) VALUES (920, 921)");
assert.equal(
  hitung("SELECT COUNT(*) AS n FROM project_dependencies WHERE blocker_id = 920"),
  1
);

// Proyek tidak boleh menahan dirinya sendiri.
tolak(
  "INSERT INTO project_dependencies (blocker_id, blocked_id) VALUES (920, 920)",
  "constraint"
);

// Relasi yang sama tidak bisa dicatat dua kali.
tolak(
  "INSERT INTO project_dependencies (blocker_id, blocked_id) VALUES (920, 921)",
  "constraint"
);

// Menunjuk proyek yang tidak ada ditolak foreign key.
tolak(
  "INSERT INTO project_dependencies (blocker_id, blocked_id) VALUES (920, 99999)",
  "foreign key"
);

// Proyek dihapus, relasinya ikut hilang — tidak menyisakan baris menggantung.
db.exec("DELETE FROM projects WHERE id = 921");
assert.equal(hitung("SELECT COUNT(*) AS n FROM project_dependencies WHERE blocked_id = 921"), 0);
db.exec("DELETE FROM projects WHERE id BETWEEN 920 AND 939");
assert.equal(hitung("SELECT COUNT(*) AS n FROM project_dependencies WHERE blocker_id = 920"), 0);

const indeksRelasi = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'project_dependencies'")
  .all()
  .map((r) => String(r.name));
assert.ok(indeksRelasi.includes("idx_dependencies_blocked"));
assert.ok(indeks.includes("idx_projects_client_tier"));

/* --- Detail kontrak & keuangan (migrasi 11) -------------------------------- */

// Semua kolom baru punya DEFAULT atau boleh NULL, jadi baris tanpa kolom itu
// tetap bisa masuk — inilah yang membuat migrasinya aman untuk data lama.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (940, 'Tanpa kontrak', 'Jasa', 'Prospect', 'Rendah', '2026-08-01', '2026-08-02', 1)`
);
const kontrakBawaan = db
  .prepare(
    `SELECT contract_no, contract_date, payment_term, payment_note, tax_type,
            sales_fee, operational_cost
     FROM projects WHERE id = 940`
  )
  .get()!;
assert.equal(kontrakBawaan.contract_no, "");
assert.equal(kontrakBawaan.contract_date, null);
assert.equal(kontrakBawaan.payment_term, "Full");
assert.equal(kontrakBawaan.payment_note, "");
assert.equal(kontrakBawaan.tax_type, "Non PKP");
// NULL, bukan 0: "belum diisi" berbeda dari "memang tidak ada biayanya".
assert.equal(kontrakBawaan.sales_fee, null);
assert.equal(kontrakBawaan.operational_cost, null);
db.exec("DELETE FROM projects WHERE id = 940");

// Dua enum tertutup ditolak database kalau isinya di luar daftar.
tolak(
  `INSERT INTO projects (name, type, status, priority, payment_term, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', 'Termin', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
tolak(
  `INSERT INTO projects (name, type, status, priority, tax_type, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', 'NonPKP', '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);

// Semua nilai yang sah menurut TypeScript diterima database. Diambil dari
// konstanta, jadi CHECK tidak bisa melenceng dari union tanpa ketahuan.
PAYMENT_TERMS.forEach((t, i) => {
  db.exec(
    `INSERT INTO projects (id, name, type, status, priority, payment_term, start_date, deadline, owner_id)
     VALUES (${941 + i}, 'Uji TOP ${i}', 'Jasa', 'Prospect', 'Rendah', '${t}', '2026-08-01', '2026-08-02', 1)`
  );
});
TAX_TYPES.forEach((t, i) => {
  db.exec(
    `INSERT INTO projects (id, name, type, status, priority, tax_type, start_date, deadline, owner_id)
     VALUES (${951 + i}, 'Uji pajak ${i}', 'Jasa', 'Prospect', 'Rendah', '${t}', '2026-08-01', '2026-08-02', 1)`
  );
});
assert.equal(
  hitung("SELECT COUNT(*) AS n FROM projects WHERE id BETWEEN 941 AND 959"),
  PAYMENT_TERMS.length + TAX_TYPES.length
);
db.exec("DELETE FROM projects WHERE id BETWEEN 941 AND 959");

// Biaya negatif ditolak; nol dan NULL diterima.
tolak(
  `INSERT INTO projects (name, type, status, priority, sales_fee, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', -1, '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
tolak(
  `INSERT INTO projects (name, type, status, priority, operational_cost, start_date, deadline, owner_id)
   VALUES ('X', 'Jasa', 'Prospect', 'Tinggi', -5000, '2026-08-01', '2026-08-02', 1)`,
  "constraint"
);
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, sales_fee, operational_cost, start_date, deadline, owner_id)
   VALUES (960, 'Biaya nol', 'Jasa', 'Prospect', 'Rendah', 0, 0, '2026-08-01', '2026-08-02', 1)`
);
assert.equal(db.prepare("SELECT sales_fee FROM projects WHERE id = 960").get()!.sales_fee, 0);
db.exec("DELETE FROM projects WHERE id = 960");

// Data seed membawa nomor kontraknya, bukan kolom kosong.
assert.equal(
  db.prepare("SELECT contract_no FROM projects WHERE id = 1").get()!.contract_no,
  mockProjects[0].contractNo
);
assert.equal(
  db.prepare("SELECT operational_cost FROM projects WHERE id = 1").get()!.operational_cost,
  mockProjects[0].operationalCost
);
// Proyek internal tanpa kontrak tetap tersimpan sebagai NULL, bukan string "null".
assert.equal(db.prepare("SELECT contract_date FROM projects WHERE id = 4").get()!.contract_date, null);

assert.ok(indeks.includes("idx_projects_contract_no"));

const indeksRiwayat = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'progress_history'")
  .all()
  .map((r) => String(r.name));
assert.ok(indeksRiwayat.includes("idx_progress_project"));
assert.ok(indeksRiwayat.includes("idx_progress_user"));
assert.ok(indeksRiwayat.includes("idx_progress_recorded"));

const indeksPengingat = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('reminders', 'reminder_schedules')")
  .all()
  .map((r) => String(r.name));
assert.ok(indeksPengingat.includes("idx_reminders_project"));
assert.ok(indeksPengingat.includes("idx_schedules_due"));
assert.ok(indeks.includes("idx_projects_deadline"));
assert.ok(indeks.includes("idx_projects_owner"));

db.close();
console.log("ok: db schema + migrasi");
