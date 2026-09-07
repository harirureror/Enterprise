/**
 * Isi database dengan data awal dari `lib/mock-data.ts`.
 *
 * PENTING — hanya mengisi database yang MASIH KOSONG.
 *
 * Sejak lib/api.ts membaca dan menulis ke SQLite, database ini memuat data
 * kerja yang sesungguhnya: sandi yang disetel admin, proyek yang disunting,
 * agenda yang diisi orang. Menjalankan seed dengan upsert seperti dulu akan
 * mengembalikan semuanya ke isi mock-data — persis bug yang mendorong
 * pemindahan ini.
 *
 * Untuk sengaja menimpa (mis. membangun ulang data contoh), panggil dengan
 * `{ force: true }` — atau `npx tsx lib/db/setup.ts --force` dari CLI.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  agenda,
  comments,
  credentials,
  planProjects,
  planProspects,
  planSteps,
  projectDependencies,
  progressHistory,
  projects,
  reminderSchedules,
  reminders,
  strategicPlans,
  users,
} from "../mock-data";
import { PROJECT_TYPES } from "../types";

/** Keterangan tiap jenis, dipakai halaman kelola jenis. */
const TYPE_DESCRIPTIONS: Record<string, string> = {
  Penjualan: "Pengadaan alat dan solusi ke klien.",
  Jasa: "Pekerjaan survei dan layanan lapangan.",
  Training: "Pelatihan dan transfer pengetahuan.",
  Riset: "Kajian pasar dan pengembangan internal.",
};

export type SeedHasil = {
  users: number;
  projects: number;
  types: number;
  progress: number;
  reminders: number;
  schedules: number;
  comments: number;
  dependencies: number;
  agenda: number;
  plans: number;
  planSteps: number;
  planProspects: number;
  planProjects: number;
  /** Seed dilewati karena database sudah berisi. */
  dilewati: boolean;
};

const KOSONG: SeedHasil = {
  users: 0,
  projects: 0,
  types: 0,
  progress: 0,
  reminders: 0,
  schedules: 0,
  comments: 0,
  dependencies: 0,
  agenda: 0,
  plans: 0,
  planSteps: 0,
  planProspects: 0,
  planProjects: 0,
  dilewati: true,
};

export function seed(db: DatabaseSync, options: { force?: boolean } = {}): SeedHasil {
  // Kehadiran pengguna dipakai sebagai penanda "sudah pernah diisi": tanpa
  // pengguna, aplikasinya tidak bisa dipakai siapa pun, jadi database yang
  // punya baris users pasti bukan database kosong.
  const sudahAda = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n > 0;
  if (sudahAda && options.force !== true) return KOSONG;

  const insertPlan = db.prepare(`
    INSERT INTO strategic_plans
      (id, title, summary, kind, goal, segment, region, partner, status, priority,
       owner_id, start_date, target_date, outcome, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      kind = excluded.kind,
      goal = excluded.goal,
      segment = excluded.segment,
      region = excluded.region,
      partner = excluded.partner,
      status = excluded.status,
      priority = excluded.priority,
      owner_id = excluded.owner_id,
      start_date = excluded.start_date,
      target_date = excluded.target_date,
      outcome = excluded.outcome,
      created_by = excluded.created_by,
      updated_at = excluded.updated_at
  `);

  const insertPlanStep = db.prepare(`
    INSERT INTO plan_steps (id, plan_id, title, owner_id, target_date, status, note, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      plan_id = excluded.plan_id,
      title = excluded.title,
      owner_id = excluded.owner_id,
      target_date = excluded.target_date,
      status = excluded.status,
      note = excluded.note,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `);

  const insertPlanProspect = db.prepare(`
    INSERT INTO plan_prospects (id, plan_id, name, contact, region, status, note, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      plan_id = excluded.plan_id,
      name = excluded.name,
      contact = excluded.contact,
      region = excluded.region,
      status = excluded.status,
      note = excluded.note,
      updated_at = excluded.updated_at
  `);

  const insertPlanProject = db.prepare(`
    INSERT INTO plan_projects (plan_id, project_id)
    VALUES (?, ?)
    ON CONFLICT(plan_id, project_id) DO NOTHING
  `);

  const insertAgenda = db.prepare(`
    INSERT INTO agenda
      (id, user_id, project_id, kind, start_date, end_date,
       location_city, location_province, note, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      project_id = excluded.project_id,
      kind = excluded.kind,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      location_city = excluded.location_city,
      location_province = excluded.location_province,
      note = excluded.note,
      created_by = excluded.created_by,
      updated_at = excluded.updated_at
  `);

  const insertDependency = db.prepare(`
    INSERT INTO project_dependencies (blocker_id, blocked_id)
    VALUES (?, ?)
    ON CONFLICT(blocker_id, blocked_id) DO NOTHING
  `);

  const insertComment = db.prepare(`
    INSERT INTO comments (id, project_id, user_id, body, created_at, posted_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      user_id = excluded.user_id,
      body = excluded.body,
      created_at = excluded.created_at,
      posted_at = excluded.posted_at
  `);

  const insertReminder = db.prepare(`
    INSERT INTO reminders
      (id, project_id, to_user_id, from_user_id, message, channel, created_at, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      to_user_id = excluded.to_user_id,
      from_user_id = excluded.from_user_id,
      message = excluded.message,
      channel = excluded.channel,
      created_at = excluded.created_at,
      sent_at = excluded.sent_at
  `);

  const insertSchedule = db.prepare(`
    INSERT INTO reminder_schedules (id, project_id, to_user_id, frequency, next_at, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      to_user_id = excluded.to_user_id,
      frequency = excluded.frequency,
      next_at = excluded.next_at,
      is_active = excluded.is_active,
      updated_at = datetime('now')
  `);

  const insertType = db.prepare(`
    INSERT INTO project_types (code, label, description, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order
  `);

  const insertProgress = db.prepare(`
    INSERT INTO progress_history (id, project_id, user_id, progress_pct, note, created_at, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      user_id = excluded.user_id,
      progress_pct = excluded.progress_pct,
      note = excluded.note,
      created_at = excluded.created_at,
      recorded_at = excluded.recorded_at
  `);

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, avatar_url, role, access_level, is_active, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      role = excluded.role,
      access_level = excluded.access_level,
      is_active = excluded.is_active,
      password_hash = excluded.password_hash,
      updated_at = datetime('now')
  `);

  const insertProject = db.prepare(`
    INSERT INTO projects
      (id, name, description, type, status, priority, priority_mode, progress_pct,
       client_org, location_city, location_province, client_name, client_email, client_phone, client_tier, penalty_risk, value,
       contract_no, contract_date, payment_term, payment_note, tax_type, sales_fee,
       operational_cost, start_date, deadline, owner_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      type = excluded.type,
      status = excluded.status,
      priority = excluded.priority,
      priority_mode = excluded.priority_mode,
      progress_pct = excluded.progress_pct,
      client_org = excluded.client_org,
      location_city = excluded.location_city,
      location_province = excluded.location_province,
      client_name = excluded.client_name,
      client_email = excluded.client_email,
      client_phone = excluded.client_phone,
      client_tier = excluded.client_tier,
      penalty_risk = excluded.penalty_risk,
      value = excluded.value,
      contract_no = excluded.contract_no,
      contract_date = excluded.contract_date,
      payment_term = excluded.payment_term,
      payment_note = excluded.payment_note,
      tax_type = excluded.tax_type,
      sales_fee = excluded.sales_fee,
      operational_cost = excluded.operational_cost,
      start_date = excluded.start_date,
      deadline = excluded.deadline,
      owner_id = excluded.owner_id,
      updated_at = excluded.updated_at
  `);

  db.exec("BEGIN");
  try {
    // Jenis lebih dulu: tidak bergantung pada tabel lain.
    PROJECT_TYPES.forEach((t, i) => {
      insertType.run(t, t, TYPE_DESCRIPTIONS[t] ?? "", i);
    });

    // Anggota dulu, baru proyek — owner_id menunjuk ke users.id.
    for (const u of users) {
      // Hanya akun yang punya kredensial yang dapat hash; sisanya null.
      const kredensial = credentials.find((c) => c.userId === u.id);
      insertUser.run(
        u.id,
        u.email,
        u.name,
        u.avatarUrl,
        u.role,
        u.accessLevel,
        u.isActive ? 1 : 0,
        kredensial?.passwordHash ?? null
      );
    }
    for (const p of projects) {
      insertProject.run(
        p.id,
        p.name,
        p.description,
        p.type,
        p.status,
        p.priority,
        p.priorityMode,
        p.progressPct,
        p.clientOrg,
        p.locationCity,
        p.locationProvince,
        p.clientName,
        p.clientEmail,
        p.clientPhone,
        p.clientTier,
        p.penaltyRisk,
        p.value,
        p.contractNo,
        p.contractDate,
        p.paymentTerm,
        p.paymentNote,
        p.taxType,
        p.salesFee,
        p.operationalCost,
        p.startDate,
        p.deadline,
        p.ownerId,
        p.updatedAt
      );
    }
    // Riwayat paling akhir: menunjuk ke projects dan users sekaligus.
    for (const e of progressHistory) {
      insertProgress.run(
        e.id,
        e.projectId,
        e.userId,
        e.progressPct,
        e.note,
        e.createdAt,
        e.recordedAt
      );
    }
    // Pengingat dan jadwal paling akhir: menunjuk ke projects dan users.
    for (const r of reminders) {
      insertReminder.run(
        r.id,
        r.projectId,
        r.toUserId,
        r.fromUserId,
        r.message,
        r.channel,
        r.createdAt,
        r.sentAt
      );
    }
    for (const j of reminderSchedules) {
      insertSchedule.run(
        j.id,
        j.projectId,
        j.toUserId,
        j.frequency,
        j.nextAt,
        j.isActive ? 1 : 0,
        j.createdAt
      );
    }
    for (const c of comments) {
      insertComment.run(c.id, c.projectId, c.userId, c.body, c.createdAt, c.postedAt);
    }
    // Agenda menunjuk users dan projects sekaligus, jadi setelah keduanya ada.
    for (const a of agenda) {
      insertAgenda.run(
        a.id,
        a.userId,
        a.projectId,
        a.kind,
        a.startDate,
        a.endDate,
        a.locationCity,
        a.locationProvince,
        a.note,
        a.createdBy,
        a.updatedAt
      );
    }
    // Ketergantungan paling akhir: kedua sisinya menunjuk projects.
    for (const d of projectDependencies) {
      insertDependency.run(d.blockerId, d.blockedId);
    }
    // Rencana menunjuk users; langkah, prospek, dan kaitannya menunjuk rencana,
    // jadi urutannya rencana dulu.
    for (const p of strategicPlans) {
      insertPlan.run(
        p.id,
        p.title,
        p.summary,
        p.kind,
        p.goal,
        p.segment,
        p.region,
        p.partner,
        p.status,
        p.priority,
        p.ownerId,
        p.startDate,
        p.targetDate,
        p.outcome,
        p.createdBy,
        p.updatedAt
      );
    }
    for (const s of planSteps) {
      insertPlanStep.run(
        s.id,
        s.planId,
        s.title,
        s.ownerId,
        s.targetDate,
        s.status,
        s.note,
        s.sortOrder
      );
    }
    for (const x of planProspects) {
      insertPlanProspect.run(
        x.id,
        x.planId,
        x.name,
        x.contact,
        x.region,
        x.status,
        x.note,
        x.updatedAt
      );
    }
    for (const l of planProjects) {
      insertPlanProject.run(l.planId, l.projectId);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    users: users.length,
    projects: projects.length,
    types: PROJECT_TYPES.length,
    progress: progressHistory.length,
    reminders: reminders.length,
    schedules: reminderSchedules.length,
    comments: comments.length,
    dependencies: projectDependencies.length,
    agenda: agenda.length,
    plans: strategicPlans.length,
    planSteps: planSteps.length,
    planProspects: planProspects.length,
    planProjects: planProjects.length,
    dilewati: false,
  };
}
