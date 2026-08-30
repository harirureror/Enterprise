/**
 * Isi database dengan data awal yang sama persis dengan `lib/mock-data.ts`,
 * supaya tampilan dashboard tidak berubah saat sumber datanya pindah ke SQLite.
 *
 * Aman diulang: baris yang id-nya sudah ada ditimpa, bukan digandakan.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  comments,
  credentials,
  projectDependencies,
  progressHistory,
  projects,
  reminderSchedules,
  reminders,
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

export function seed(db: DatabaseSync): {
  users: number;
  projects: number;
  types: number;
  progress: number;
  reminders: number;
  schedules: number;
  comments: number;
  dependencies: number;
} {
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
    INSERT INTO users (id, email, name, avatar_url, role, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      role = excluded.role,
      password_hash = excluded.password_hash,
      updated_at = datetime('now')
  `);

  const insertProject = db.prepare(`
    INSERT INTO projects
      (id, name, description, type, status, priority, priority_mode, progress_pct,
       client_org, client_name, client_email, client_phone, client_tier, penalty_risk, value,
       contract_no, contract_date, payment_term, payment_note, tax_type, sales_fee,
       operational_cost, start_date, deadline, owner_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      type = excluded.type,
      status = excluded.status,
      priority = excluded.priority,
      priority_mode = excluded.priority_mode,
      progress_pct = excluded.progress_pct,
      client_org = excluded.client_org,
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
      insertUser.run(u.id, u.email, u.name, u.avatarUrl, u.role, kredensial?.passwordHash ?? null);
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
    // Ketergantungan paling akhir: kedua sisinya menunjuk projects.
    for (const d of projectDependencies) {
      insertDependency.run(d.blockerId, d.blockedId);
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
  };
}
