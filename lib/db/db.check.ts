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
  agenda as mockAgenda,
  planOutputs as mockPlanOutputs,
  planProspects as mockPlanProspects,
  planSteps as mockPlanSteps,
  projects as mockProjects,
  reminderSchedules as mockSchedules,
  reminders as mockReminders,
  strategicPlans as mockPlans,
  users as mockUsers,
} from "../mock-data";
import {
  ACCESS_LEVELS,
  AGENDA_KINDS,
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
assert.ok(tabel.includes("agenda"));
assert.ok(tabel.includes("strategic_plans"));
assert.ok(tabel.includes("plan_steps"));
assert.ok(tabel.includes("plan_prospects"));
assert.ok(tabel.includes("plan_outputs"));
// plan_projects dilebur ke plan_outputs oleh migrasi 16.
assert.equal(tabel.includes("plan_projects"), false);
assert.ok(tabel.includes("plan_comments"));
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
  // Lokasi klien dipecah jadi dua kolom, migrasi 12.
  "location_city",
  "location_province",
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
assert.equal(jumlah.plans, mockPlans.length);
assert.equal(jumlah.planSteps, mockPlanSteps.length);
assert.equal(jumlah.planProspects, mockPlanProspects.length);
assert.equal(jumlah.planOutputs, mockPlanOutputs.length);

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
// Proyek tanpa nilai tersimpan sebagai NULL, bukan 0. Proyeknya dicari lewat
// sifatnya, bukan id tertentu: mock-data adalah data kerja yang berubah-ubah.
const tanpaNilai = mockProjects.find((p) => p.value === null);
if (tanpaNilai) {
  assert.equal(
    db.prepare(`SELECT value FROM projects WHERE id = ${tanpaNilai.id}`).get()!.value,
    null
  );
}
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
// Isi barisnya hanya diperiksa kalau memang ada riwayatnya — mock-data adalah
// data kerja yang boleh saja belum punya catatan progres sama sekali.
if (riwayat1.length > 0) {
  const terbaru = mockProgress
    .filter((e) => e.projectId === 1)
    .reduce((a, b) => (b.createdAt >= a.createdAt ? b : a));
  assert.equal(riwayat1[0].progress_pct, terbaru.progressPct);
}

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
// Barisnya dibuat sendiri lebih dulu, bukan mengandalkan mock-data punya
// jadwal: yang diuji constraint UNIQUE-nya, bukan isi datanya.
db.exec(
  `INSERT INTO reminder_schedules (id, project_id, to_user_id, frequency, next_at)
   VALUES (990, 1, 1, 'harian', '2026-09-01')`
);
tolak(
  `INSERT INTO reminder_schedules (project_id, to_user_id, frequency, next_at)
   VALUES (1, 1, 'harian', '2026-09-02')`,
  "unique"
);
db.exec("DELETE FROM reminder_schedules WHERE id = 990");
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
// Barisnya dibuat sendiri supaya tidak bergantung pada isi mock-data.
db.exec(
  `INSERT INTO reminder_schedules (id, project_id, to_user_id, frequency, next_at, is_active)
   VALUES (991, 2, 1, 'harian', '2026-09-01', 1)`
);
db.exec("UPDATE reminder_schedules SET is_active = 0 WHERE id = 991");
assert.equal(
  Boolean(db.prepare("SELECT is_active FROM reminder_schedules WHERE id = 991").get()!.is_active),
  false
);
db.exec("DELETE FROM reminder_schedules WHERE id = 991");

// Komentar: tersimpan lengkap dan terurut sebagai percakapan.
assert.equal(hitung("SELECT COUNT(*) AS n FROM comments"), mockComments.length);
const idKomentar = mockComments[0]?.projectId ?? 0;
assert.deepEqual(
  db
    .prepare(`SELECT id FROM comments WHERE project_id = ${idKomentar} ORDER BY posted_at`)
    .all()
    .map((r) => Number(r.id)),
  mockComments
    .filter((c) => c.projectId === idKomentar)
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

// Penulis komentar tidak boleh terhapus diam-diam. Komentarnya dibuat sendiri
// supaya yang teruji constraint-nya, bukan kebetulan isi mock-data.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (906, 'Proyek berkomentar', 'Jasa', 'Prospect', 'Rendah', '2026-08-01', '2026-08-02', 1)`
);
db.exec(
  `INSERT INTO comments (id, project_id, user_id, body, created_at, posted_at)
   VALUES (992, 906, 2, 'komentar uji', '2026-08-01', '2026-08-01 09:00:00')`
);
tolak("DELETE FROM users WHERE id = 2", "foreign key");
db.exec("DELETE FROM comments WHERE id = 992");
db.exec("DELETE FROM projects WHERE id = 906");

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
// Proyek tanpa kontrak tetap tersimpan sebagai NULL, bukan string "null".
const tanpaKontrak = mockProjects.find((p) => p.contractDate === null);
if (tanpaKontrak) {
  assert.equal(
    db
      .prepare(`SELECT contract_date FROM projects WHERE id = ${tanpaKontrak.id}`)
      .get()!.contract_date,
    null
  );
}

assert.ok(indeks.includes("idx_projects_contract_no"));


/* --- Tingkat akses pengguna (migrasi 13) ----------------------------------- */

const kolomUser = db
  .prepare("PRAGMA table_info(users)")
  .all()
  .map((r) => String(r.name));
// Ditambahkan lewat ALTER TABLE, jadi letaknya di paling belakang.
assert.deepEqual(kolomUser.slice(-2), ["access_level", "is_active"]);

// Baris tanpa kedua kolom itu tetap bisa masuk, dan dapat hak paling kecil.
db.exec(
  `INSERT INTO users (id, email, name, role) VALUES (970, 'baru@uji.co.id', 'Baru', 'Staf')`
);
const bawaanUser = db.prepare("SELECT access_level, is_active FROM users WHERE id = 970").get()!;
// Menebak lebih tinggi berarti memberi akses yang belum pernah diputuskan orang.
assert.equal(bawaanUser.access_level, "Anggota");
assert.equal(bawaanUser.is_active, 1);
db.exec("DELETE FROM users WHERE id = 970");

// Tingkat akses enum tertutup; daftarnya diambil dari konstanta TypeScript
// supaya CHECK tidak bisa melenceng dari union tanpa ketahuan.
ACCESS_LEVELS.forEach((l, i) => {
  db.exec(
    `INSERT INTO users (id, email, name, role, access_level)
     VALUES (${971 + i}, 'akses${i}@uji.co.id', 'Uji ${l}', 'Staf', '${l}')`
  );
});
assert.equal(
  hitung("SELECT COUNT(*) AS n FROM users WHERE id BETWEEN 971 AND 979"),
  ACCESS_LEVELS.length
);
db.exec("DELETE FROM users WHERE id BETWEEN 971 AND 979");

tolak(
  `INSERT INTO users (email, name, role, access_level)
   VALUES ('x@uji.co.id', 'X', 'Staf', 'Superadmin')`,
  "constraint"
);
tolak(
  `INSERT INTO users (email, name, role, access_level)
   VALUES ('x@uji.co.id', 'X', 'Staf', 'admin')`,
  "constraint"
);
// is_active hanya 0 atau 1, bukan sembarang angka.
tolak(
  `INSERT INTO users (email, name, role, is_active)
   VALUES ('x@uji.co.id', 'X', 'Staf', 2)`,
  "constraint"
);

const indeksUser = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'users'")
  .all()
  .map((r) => String(r.name));
assert.ok(indeksUser.includes("idx_users_access_level"));

// Data seed membawa tingkat aksesnya, bukan jatuh ke bawaan.
assert.equal(
  db.prepare(`SELECT access_level FROM users WHERE id = ${mockUsers[0].id}`).get()!.access_level,
  mockUsers[0].accessLevel
);
// Minimal satu admin aktif, kalau tidak aplikasinya tidak bisa dikelola siapa pun.
assert.ok(hitung("SELECT COUNT(*) AS n FROM users WHERE access_level = 'Admin' AND is_active = 1") >= 1);

/* --- Agenda tim (migrasi 14) ----------------------------------------------- */

const kolomAgenda = db
  .prepare("PRAGMA table_info(agenda)")
  .all()
  .map((r) => String(r.name));
assert.deepEqual(kolomAgenda, [
  "id",
  "user_id",
  "project_id",
  "kind",
  "start_date",
  "end_date",
  "location_city",
  "location_province",
  "note",
  "created_by",
  "created_at",
  "updated_at",
]);

assert.equal(hitung("SELECT COUNT(*) AS n FROM agenda"), mockAgenda.length);

// Jenis kegiatan enum tertutup, diambil dari konstanta TypeScript.
AGENDA_KINDS.forEach((k, i) => {
  db.exec(
    `INSERT INTO agenda (id, user_id, kind, start_date, end_date, created_by)
     VALUES (${980 + i}, 1, '${k}', '2026-09-01', '2026-09-02', 1)`
  );
});
assert.equal(
  hitung("SELECT COUNT(*) AS n FROM agenda WHERE id BETWEEN 980 AND 989"),
  AGENDA_KINDS.length
);
db.exec("DELETE FROM agenda WHERE id BETWEEN 980 AND 989");

tolak(
  `INSERT INTO agenda (user_id, kind, start_date, end_date, created_by)
   VALUES (1, 'Libur', '2026-09-01', '2026-09-02', 1)`,
  "constraint"
);

// Tanggal selesai tidak boleh mendahului tanggal mulai — aturan yang sama
// dijaga validasi aplikasi di lib/agenda-form.ts.
tolak(
  `INSERT INTO agenda (user_id, kind, start_date, end_date, created_by)
   VALUES (1, 'Kantor', '2026-09-05', '2026-09-01', 1)`,
  "constraint"
);
// Sehari penuh sah.
db.exec(
  `INSERT INTO agenda (id, user_id, kind, start_date, end_date, created_by)
   VALUES (990, 1, 'Kantor', '2026-09-01', '2026-09-01', 1)`
);
db.exec("DELETE FROM agenda WHERE id = 990");

// Tanggal wajib berbentuk ISO.
tolak(
  `INSERT INTO agenda (user_id, kind, start_date, end_date, created_by)
   VALUES (1, 'Kantor', '01-09-2026', '02-09-2026', 1)`,
  "constraint"
);

// Menunjuk orang atau pencatat yang tidak ada ditolak foreign key.
tolak(
  `INSERT INTO agenda (user_id, kind, start_date, end_date, created_by)
   VALUES (99999, 'Kantor', '2026-09-01', '2026-09-02', 1)`,
  "foreign key"
);
tolak(
  `INSERT INTO agenda (user_id, kind, start_date, end_date, created_by)
   VALUES (1, 'Kantor', '2026-09-01', '2026-09-02', 99999)`,
  "foreign key"
);

// Proyek dihapus: agendanya TETAP ADA dengan project_id NULL. Orangnya memang
// pernah pergi ke sana, dan jejak itu yang dicari HR.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (995, 'Proyek beragenda', 'Jasa', 'Berjalan', 'Rendah', '2026-09-01', '2026-09-30', 1)`
);
db.exec(
  `INSERT INTO agenda (id, user_id, project_id, kind, start_date, end_date, created_by)
   VALUES (996, 1, 995, 'Lapangan', '2026-09-01', '2026-09-02', 1)`
);
db.exec("DELETE FROM projects WHERE id = 995");
const yatim = db.prepare("SELECT project_id FROM agenda WHERE id = 996").get();
assert.ok(yatim, "agenda ikut terhapus bersama proyeknya");
assert.equal(yatim.project_id, null);

// Sebaliknya, pengguna dihapus: agendanya ikut hilang (CASCADE) karena tanpa
// orangnya baris itu tidak berarti apa-apa.
db.exec(
  `INSERT INTO users (id, email, name, role) VALUES (997, 'sekali@uji.co.id', 'Sekali', 'Staf')`
);
db.exec(
  `INSERT INTO agenda (id, user_id, kind, start_date, end_date, created_by)
   VALUES (998, 997, 'Cuti', '2026-09-01', '2026-09-02', 1)`
);
db.exec("DELETE FROM users WHERE id = 997");
assert.equal(hitung("SELECT COUNT(*) AS n FROM agenda WHERE id = 998"), 0);
db.exec("DELETE FROM agenda WHERE id = 996");

const indeksAgenda = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'agenda'")
  .all()
  .map((r) => String(r.name));
assert.ok(indeksAgenda.includes("idx_agenda_user"));
assert.ok(indeksAgenda.includes("idx_agenda_rentang"));

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

/* --- Rencana strategis (migrasi 15) ------------------------------------------ */

db.exec(
  `INSERT INTO strategic_plans (id, title, kind, goal, segment, status, priority, owner_id, created_by)
   VALUES (900, 'Uji rencana', 'Pelatihan', 'Penetrasi Pasar', 'Tambang', 'Ide', 'Sedang', 1, 1)`
);

// Enum tertutup: nilai di luar daftar ditolak database, bukan hanya formulir.
assert.throws(
  () =>
    db.exec(
      `INSERT INTO strategic_plans (id, title, kind, goal, segment, status, priority, owner_id, created_by)
       VALUES (901, 'Jenis asing', 'Piknik', 'Penetrasi Pasar', 'Tambang', 'Ide', 'Sedang', 1, 1)`
    ),
  "kind di luar daftar harus ditolak"
);
assert.throws(
  () =>
    db.exec(
      `INSERT INTO strategic_plans (id, title, kind, goal, segment, status, priority, owner_id, created_by)
       VALUES (902, 'Tujuan asing', 'Pelatihan', 'Menang Banyak', 'Tambang', 'Ide', 'Sedang', 1, 1)`
    ),
  "goal di luar daftar harus ditolak"
);
assert.throws(
  () =>
    db.exec(
      `INSERT INTO strategic_plans (id, title, kind, goal, segment, status, priority, owner_id, created_by)
       VALUES (903, 'Segmen asing', 'Pelatihan', 'Penetrasi Pasar', 'Peternakan', 'Ide', 'Sedang', 1, 1)`
    ),
  "segment di luar daftar harus ditolak"
);

// Target sebelum mulai itu mustahil, jadi ditolak skema — bukan hanya formulir.
assert.throws(
  () =>
    db.exec(
      `INSERT INTO strategic_plans
         (id, title, kind, goal, segment, status, priority, owner_id, created_by, start_date, target_date)
       VALUES (904, 'Mundur', 'Pelatihan', 'Penetrasi Pasar', 'Tambang', 'Ide', 'Sedang', 1, 1,
               '2026-10-01', '2026-09-01')`
    ),
  "target_date lebih awal dari start_date harus ditolak"
);

// Rencana tanpa tanggal tetap sah: sebuah ide belum tentu sudah berjadwal.
db.exec(
  `INSERT INTO strategic_plans (id, title, kind, goal, segment, status, priority, owner_id, created_by)
   VALUES (905, 'Ide tanpa tanggal', 'Riset', 'Kesiapan Regulasi', 'Akademik', 'Ide', 'Rendah', 1, 1)`
);
assert.equal(hitung("SELECT COUNT(*) AS n FROM strategic_plans WHERE id = 905"), 1);
db.exec("DELETE FROM strategic_plans WHERE id = 905");

// Status langkah dan status prospek juga tertutup.
db.exec(
  `INSERT INTO plan_steps (id, plan_id, title, status) VALUES (910, 900, 'Langkah uji', 'Belum')`
);
assert.throws(
  () =>
    db.exec(
      `INSERT INTO plan_steps (id, plan_id, title, status) VALUES (911, 900, 'Aneh', 'Nanti Saja')`
    ),
  "status langkah di luar daftar harus ditolak"
);
db.exec(
  `INSERT INTO plan_prospects (id, plan_id, name, status)
   VALUES (912, 900, 'PT Uji', 'Belum dihubungi')`
);
assert.throws(
  () =>
    db.exec(
      `INSERT INTO plan_prospects (id, plan_id, name, status) VALUES (913, 900, 'PT Aneh', 'Kenalan')`
    ),
  "status prospek di luar daftar harus ditolak"
);

// Komentar rencana dibatasi panjangnya di database, sama seperti comments.
assert.throws(
  () =>
    db.exec(
      `INSERT INTO plan_comments (plan_id, user_id, body, created_at, posted_at)
       VALUES (900, 1, ' ', '2026-09-01', '2026-09-01')`
    ),
  "komentar kosong harus ditolak"
);
db.exec(
  `INSERT INTO plan_comments (id, plan_id, user_id, body, created_at, posted_at)
   VALUES (914, 900, 1, 'Catatan uji', '2026-09-01', '2026-09-01')`
);

// PIC rencana tidak bisa dihapus selama masih dipakai (RESTRICT): namanya
// melekat di rencana, jadi menghilangkannya diam-diam akan memutus jejak.
assert.throws(
  () => db.exec("DELETE FROM users WHERE id = 1"),
  "owner_id rencana menahan penghapusan penggunanya"
);

// Langkah boleh belum ditugaskan, dan PIC yang dihapus menyisakan langkahnya
// (SET NULL) — pekerjaannya tetap ada walau orangnya tidak.
db.exec(`INSERT INTO users (id, email, name, role) VALUES (920, 'lepas@uji.co.id', 'Lepas', 'Staf')`);
db.exec(
  `INSERT INTO plan_steps (id, plan_id, title, owner_id, status)
   VALUES (921, 900, 'Punya PIC', 920, 'Belum')`
);
db.exec("DELETE FROM users WHERE id = 920");
assert.equal(db.prepare("SELECT owner_id FROM plan_steps WHERE id = 921").get()!.owner_id, null);

// Menghapus PROYEK hanya melepas tautannya; baris luarannya TETAP ADA, dan
// rencananya juga. Ini lebih kuat daripada plan_projects yang dulu: catatan
// bahwa rencana ini pernah melahirkan proyek tidak ikut hilang.
db.exec(
  `INSERT INTO projects (id, name, type, status, priority, start_date, deadline, owner_id)
   VALUES (930, 'Proyek berencana', 'Jasa', 'Berjalan', 'Rendah', '2026-09-01', '2026-09-30', 1)`
);
db.exec(
  `INSERT INTO plan_outputs (id, plan_id, kind, title, project_id)
   VALUES (940, 900, 'Proyek Turunan', 'Proyek berencana', 930)`
);
db.exec("DELETE FROM projects WHERE id = 930");
assert.equal(hitung("SELECT COUNT(*) AS n FROM plan_outputs WHERE id = 940"), 1, "baris luaran bertahan");
assert.equal(
  db.prepare("SELECT project_id FROM plan_outputs WHERE id = 940").get()!.project_id,
  null,
  "hanya tautannya yang lepas"
);
assert.equal(
  db.prepare("SELECT title FROM plan_outputs WHERE id = 940").get()!.title,
  "Proyek berencana",
  "judulnya tetap terbaca walau proyeknya sudah hilang"
);
assert.equal(hitung("SELECT COUNT(*) AS n FROM strategic_plans WHERE id = 900"), 1);

// Jenis luaran tertutup: nilai di luar daftar ditolak database.
assert.throws(
  () =>
    db.exec(
      `INSERT INTO plan_outputs (plan_id, kind, title) VALUES (900, 'Piagam', 'Jenis asing')`
    ),
  "jenis luaran di luar daftar harus ditolak"
);

// Sebaliknya, menghapus RENCANA membawa serta seluruh isinya (CASCADE) — tidak
// ada langkah, prospek, kaitan, atau komentar yang menggantung.
db.exec("DELETE FROM strategic_plans WHERE id = 900");
assert.equal(hitung("SELECT COUNT(*) AS n FROM plan_steps WHERE plan_id = 900"), 0);
assert.equal(hitung("SELECT COUNT(*) AS n FROM plan_prospects WHERE plan_id = 900"), 0);
assert.equal(hitung("SELECT COUNT(*) AS n FROM plan_comments WHERE plan_id = 900"), 0);
assert.equal(hitung("SELECT COUNT(*) AS n FROM plan_outputs WHERE plan_id = 900"), 0);

const indeksRencana = db
  .prepare(
    `SELECT name FROM sqlite_master WHERE type = 'index'
     AND tbl_name IN ('strategic_plans', 'plan_steps', 'plan_prospects', 'plan_comments', 'plan_outputs')`
  )
  .all()
  .map((r) => String(r.name));
assert.ok(indeksRencana.includes("idx_plans_goal"));
assert.ok(indeksRencana.includes("idx_plans_segment"));
assert.ok(indeksRencana.includes("idx_plan_steps_plan"));
assert.ok(indeksRencana.includes("idx_plan_prospects_plan"));
assert.ok(indeksRencana.includes("idx_plan_comments_plan"));
assert.ok(indeksRencana.includes("idx_plan_outputs_plan"));
assert.ok(indeksRencana.includes("idx_plan_outputs_project"));

db.close();

console.log("ok: db schema + migrasi");
