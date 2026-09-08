import { getDb } from "./index";
import type {
  ActivityTemplate,
  AgendaEntry,
  PlanComment,
  PlanOutput,
  PlanProspect,
  PlanStep,
  StrategicPlan,
  Project,
  ProgressEntry,
  ProjectActivity,
  ProjectComment,
  ProjectDependency,
  ProjectTypeInfo,
  Reminder,
  ReminderSchedule,
  User,
} from "../types";

/* Satu-satunya tempat SQL berjalan saat aplikasi dipakai.

   Sebelum ini lib/api.ts membaca dan menulis array in-memory dari mock-data.ts,
   jadi setiap perubahan — sandi yang disetel ulang, proyek baru, agenda —
   hilang begitu proses Node berhenti. Di sini penyimpanannya jadi SQLite,
   sementara seluruh logika bisnis (prioritas, filter, ringkasan) tetap di
   tempatnya masing-masing dan tidak ikut berubah.

   Bentuk barisnya snake_case; domainnya camelCase. Penerjemahan itu dikumpulkan
   di berkas ini supaya tidak tersebar dan tidak pernah berselisih.

   Efek samping yang bagus: route handler dan halaman punya salinan modul
   sendiri-sendiri, tapi keduanya membaca file database yang sama — jadi
   perbedaan yang dulu memisahkan sesi REST dari sesi halaman ikut hilang. */

type Row = Record<string, unknown>;

const teks = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const angka = (v: unknown): number => Number(v);
const angkaAtauNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const teksAtauNull = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
/** SQLite tidak punya boolean; 0/1 diterjemahkan di sini, bukan di pemanggil. */
const boolDb = (v: unknown): boolean => Number(v) === 1;

/* --- users ----------------------------------------------------------------- */

function keUser(r: Row): User {
  return {
    id: angka(r.id),
    name: teks(r.name),
    email: teks(r.email),
    avatarUrl: teksAtauNull(r.avatar_url),
    role: teks(r.role),
    accessLevel: teks(r.access_level) as User["accessLevel"],
    isActive: boolDb(r.is_active),
  };
}

export const users = {
  all(): User[] {
    return getDb().prepare("SELECT * FROM users ORDER BY id").all().map(keUser);
  },

  byId(id: number): User | null {
    const r = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
    return r ? keUser(r as Row) : null;
  },

  /** Pencocokan email tanpa memandang kapitalisasi, sejalan dengan idx_users_email_lower. */
  byEmail(email: string): User | null {
    const r = getDb()
      .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
      .get(email.trim());
    return r ? keUser(r as Row) : null;
  },

  /**
   * Cari akun dari apa yang diketik orang di kolom "identitas" — email atau
   * nama, keduanya tanpa memandang kapitalisasi. Email didahulukan: ia unik
   * menurut skema, sedangkan nama bisa saja kembar.
   */
  byIdentity(identitas: string): User | null {
    const teksIdentitas = identitas.trim();
    const r = getDb()
      .prepare(
        `SELECT * FROM users
         WHERE lower(email) = lower(?) OR lower(name) = lower(?)
         ORDER BY (lower(email) = lower(?)) DESC, id
         LIMIT 1`
      )
      .get(teksIdentitas, teksIdentitas, teksIdentitas);
    return r ? keUser(r as Row) : null;
  },

  /** Hash sandi sengaja diambil terpisah: ia tidak pernah menempel di objek User. */
  passwordHash(id: number): string | null {
    const r = getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get(id) as Row | undefined;
    return r ? teksAtauNull(r.password_hash) : null;
  },

  insert(input: Omit<User, "id">, passwordHash: string | null): User {
    const db = getDb();
    db.prepare(
      `INSERT INTO users (email, name, avatar_url, role, access_level, is_active, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.email,
      input.name,
      input.avatarUrl,
      input.role,
      input.accessLevel,
      input.isActive ? 1 : 0,
      passwordHash
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return users.byId(id)!;
  },

  /** Profil swalayan: hanya nama dan avatar. Email dan peran urusan admin. */
  updateProfile(id: number, name: string, avatarUrl: string | null): User | null {
    const hasil = getDb()
      .prepare("UPDATE users SET name = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, avatarUrl, id);
    return hasil.changes === 0 ? null : users.byId(id);
  },

  /**
   * Perbarui identitas: nama, email, dan (opsional) foto.
   *
   * Email ikut di sini karena ia identitas login, bukan sekadar keterangan —
   * memisahkannya jadi dua tulisan membuka celah salah satunya tersimpan
   * sementara satunya gagal.
   */
  updateIdentity(
    id: number,
    input: { name: string; email: string; avatarUrl?: string | null }
  ): User | null {
    const db = getDb();
    const hasil =
      input.avatarUrl === undefined
        ? db
            .prepare(
              "UPDATE users SET name = ?, email = ?, updated_at = datetime('now') WHERE id = ?"
            )
            .run(input.name, input.email, id)
        : db
            .prepare(
              `UPDATE users SET name = ?, email = ?, avatar_url = ?, updated_at = datetime('now')
               WHERE id = ?`
            )
            .run(input.name, input.email, input.avatarUrl, id);

    return hasil.changes === 0 ? null : users.byId(id);
  },

  setAccessLevel(id: number, level: User["accessLevel"]): User | null {
    const hasil = getDb()
      .prepare("UPDATE users SET access_level = ?, updated_at = datetime('now') WHERE id = ?")
      .run(level, id);
    return hasil.changes === 0 ? null : users.byId(id);
  },

  setActive(id: number, aktif: boolean): User | null {
    const hasil = getDb()
      .prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?")
      .run(aktif ? 1 : 0, id);
    return hasil.changes === 0 ? null : users.byId(id);
  },

  setPassword(id: number, passwordHash: string): boolean {
    return (
      getDb()
        .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
        .run(passwordHash, id).changes > 0
    );
  },

  emailTaken(email: string, kecuali?: number): boolean {
    const r = getDb()
      .prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ?")
      .get(email.trim(), kecuali ?? -1);
    return r !== undefined;
  },

  activeAdminCount(): number {
    const r = getDb()
      .prepare("SELECT COUNT(*) AS n FROM users WHERE access_level = 'Admin' AND is_active = 1")
      .get() as Row;
    return angka(r.n);
  },
};

/* --- projects -------------------------------------------------------------- */

function keProject(r: Row): Project {
  return {
    id: angka(r.id),
    name: teks(r.name),
    description: teks(r.description),
    type: teks(r.type) as Project["type"],
    status: teks(r.status) as Project["status"],
    priority: teks(r.priority) as Project["priority"],
    priorityMode: teks(r.priority_mode) as Project["priorityMode"],
    progressMode: teks(r.progress_mode) as Project["progressMode"],
    progressPct: angka(r.progress_pct),
    clientOrg: teks(r.client_org),
    locationCity: teks(r.location_city),
    locationProvince: teks(r.location_province),
    clientName: teks(r.client_name),
    clientEmail: teks(r.client_email),
    clientPhone: teks(r.client_phone),
    clientTier: teks(r.client_tier) as Project["clientTier"],
    penaltyRisk: teks(r.penalty_risk) as Project["penaltyRisk"],
    value: angkaAtauNull(r.value),
    contractNo: teks(r.contract_no),
    contractDate: teksAtauNull(r.contract_date),
    paymentTerm: teks(r.payment_term) as Project["paymentTerm"],
    paymentNote: teks(r.payment_note),
    taxType: teks(r.tax_type) as Project["taxType"],
    salesFee: angkaAtauNull(r.sales_fee),
    operationalCost: angkaAtauNull(r.operational_cost),
    startDate: teks(r.start_date),
    deadline: teks(r.deadline),
    ownerId: angka(r.owner_id),
    updatedAt: teks(r.updated_at),
  };
}

/** Kolom yang bisa ditulis, urut sama dengan nilai di isiProject(). */
const KOLOM_PROJECT = [
  "name",
  "description",
  "type",
  "status",
  "priority",
  "priority_mode",
  "progress_mode",
  "progress_pct",
  "client_org",
  "location_city",
  "location_province",
  "client_name",
  "client_email",
  "client_phone",
  "client_tier",
  "penalty_risk",
  "value",
  "contract_no",
  "contract_date",
  "payment_term",
  "payment_note",
  "tax_type",
  "sales_fee",
  "operational_cost",
  "start_date",
  "deadline",
  "owner_id",
  "updated_at",
];

function isiProject(p: Omit<Project, "id">): unknown[] {
  return [
    p.name,
    p.description,
    p.type,
    p.status,
    p.priority,
    p.priorityMode,
    p.progressMode,
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
    p.updatedAt,
  ];
}

export const projects = {
  all(): Project[] {
    return getDb().prepare("SELECT * FROM projects ORDER BY id").all().map(keProject);
  },

  byId(id: number): Project | null {
    const r = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return r ? keProject(r as Row) : null;
  },

  insert(input: Omit<Project, "id">): Project {
    const db = getDb();
    const tanya = KOLOM_PROJECT.map(() => "?").join(", ");
    db.prepare(`INSERT INTO projects (${KOLOM_PROJECT.join(", ")}) VALUES (${tanya})`).run(
      ...(isiProject(input) as never[])
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return projects.byId(id)!;
  },

  update(id: number, input: Omit<Project, "id">): Project | null {
    const set = KOLOM_PROJECT.map((k) => `${k} = ?`).join(", ");
    const hasil = getDb()
      .prepare(`UPDATE projects SET ${set} WHERE id = ?`)
      .run(...(isiProject(input) as never[]), id);
    return hasil.changes === 0 ? null : projects.byId(id);
  },

  /** Hanya kolom yang berubah, supaya updatedAt tidak ikut tertimpa tanpa sengaja. */
  patch(id: number, kolom: Record<string, unknown>, updatedAt: string): Project | null {
    const kunci = Object.keys(kolom);
    if (kunci.length === 0) return projects.byId(id);

    const set = [...kunci.map((k) => `${k} = ?`), "updated_at = ?"].join(", ");
    const hasil = getDb()
      .prepare(`UPDATE projects SET ${set} WHERE id = ?`)
      .run(...(Object.values(kolom) as never[]), updatedAt, id);
    return hasil.changes === 0 ? null : projects.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  },
};

/* --- activity_templates & project_activities -------------------------------- */

function keTemplate(r: Row): ActivityTemplate {
  return {
    id: angka(r.id),
    typeCode: teks(r.type_code),
    name: teks(r.name),
    weight: angka(r.weight),
    status: teks(r.status) as ActivityTemplate["status"],
    slaDays: angkaAtauNull(r.sla_days),
    sortOrder: angka(r.sort_order),
  };
}

export const activityTemplates = {
  all(): ActivityTemplate[] {
    return getDb()
      .prepare("SELECT * FROM activity_templates ORDER BY type_code, sort_order, id")
      .all()
      .map((r) => keTemplate(r as Row));
  },

  byType(typeCode: string): ActivityTemplate[] {
    return getDb()
      .prepare("SELECT * FROM activity_templates WHERE type_code = ? ORDER BY sort_order, id")
      .all(typeCode)
      .map((r) => keTemplate(r as Row));
  },

  byId(id: number): ActivityTemplate | null {
    const r = getDb().prepare("SELECT * FROM activity_templates WHERE id = ?").get(id);
    return r ? keTemplate(r as Row) : null;
  },

  insert(input: Omit<ActivityTemplate, "id">): ActivityTemplate {
    const db = getDb();
    db.prepare(
      `INSERT INTO activity_templates (type_code, name, weight, status, sla_days, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(input.typeCode, input.name, input.weight, input.status, input.slaDays, input.sortOrder);
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },

  update(id: number, input: Omit<ActivityTemplate, "id" | "typeCode">): ActivityTemplate | null {
    const hasil = getDb()
      .prepare(
        `UPDATE activity_templates
           SET name = ?, weight = ?, status = ?, sla_days = ?, sort_order = ?
         WHERE id = ?`
      )
      .run(input.name, input.weight, input.status, input.slaDays, input.sortOrder, id);
    return hasil.changes === 0 ? null : activityTemplates.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM activity_templates WHERE id = ?").run(id).changes > 0;
  },

  nextSortOrder(typeCode: string): number {
    const r = getDb()
      .prepare(
        "SELECT COALESCE(MAX(sort_order) + 1, 0) AS n FROM activity_templates WHERE type_code = ?"
      )
      .get(typeCode) as Row;
    return angka(r.n);
  },
};

function keActivity(r: Row): ProjectActivity {
  return {
    id: angka(r.id),
    projectId: angka(r.project_id),
    name: teks(r.name),
    weight: angka(r.weight),
    status: teks(r.status) as ProjectActivity["status"],
    slaDays: angkaAtauNull(r.sla_days),
    targetDate: teksAtauNull(r.target_date),
    doneDate: teksAtauNull(r.done_date),
    doneBy: angkaAtauNull(r.done_by),
    sortOrder: angka(r.sort_order),
  };
}

export const projectActivities = {
  all(): ProjectActivity[] {
    return getDb()
      .prepare("SELECT * FROM project_activities ORDER BY project_id, sort_order, id")
      .all()
      .map((r) => keActivity(r as Row));
  },

  byProject(projectId: number): ProjectActivity[] {
    return getDb()
      .prepare("SELECT * FROM project_activities WHERE project_id = ? ORDER BY sort_order, id")
      .all(projectId)
      .map((r) => keActivity(r as Row));
  },

  byId(id: number): ProjectActivity | null {
    const r = getDb().prepare("SELECT * FROM project_activities WHERE id = ?").get(id);
    return r ? keActivity(r as Row) : null;
  },

  insert(input: Omit<ProjectActivity, "id">): ProjectActivity {
    const db = getDb();
    db.prepare(
      `INSERT INTO project_activities
         (project_id, name, weight, status, sla_days, target_date, done_date, done_by, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.projectId,
      input.name,
      input.weight,
      input.status,
      input.slaDays,
      input.targetDate,
      input.doneDate,
      input.doneBy,
      input.sortOrder
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },

  update(id: number, input: Omit<ProjectActivity, "id" | "projectId">): ProjectActivity | null {
    const hasil = getDb()
      .prepare(
        `UPDATE project_activities SET
           name = ?, weight = ?, status = ?, sla_days = ?, target_date = ?,
           done_date = ?, done_by = ?, sort_order = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        input.name,
        input.weight,
        input.status,
        input.slaDays,
        input.targetDate,
        input.doneDate,
        input.doneBy,
        input.sortOrder,
        id
      );
    return hasil.changes === 0 ? null : projectActivities.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM project_activities WHERE id = ?").run(id).changes > 0;
  },

  nextSortOrder(projectId: number): number {
    const r = getDb()
      .prepare(
        "SELECT COALESCE(MAX(sort_order) + 1, 0) AS n FROM project_activities WHERE project_id = ?"
      )
      .get(projectId) as Row;
    return angka(r.n);
  },

  /**
   * Salin template sebuah jenis ke satu proyek — semua atau tidak sama sekali.
   *
   * Disalin, bukan dirujuk: mengubah template kelak tidak boleh menggeser
   * progres proyek yang sudah berjalan.
   */
  copyTemplateTo(projectId: number, typeCode: string): number {
    const template = activityTemplates.byType(typeCode);
    if (template.length === 0) return 0;

    const db = getDb();
    db.exec("BEGIN");
    try {
      const insert = db.prepare(
        `INSERT INTO project_activities
           (project_id, name, weight, status, sla_days, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const t of template) {
        insert.run(projectId, t.name, t.weight, t.status, t.slaDays, t.sortOrder);
      }
      db.exec("COMMIT");
      return template.length;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  },

  /** Simpan progres dan status hasil hitungan checklist dalam satu tulisan. */
  terapkanProgres(projectId: number, progressPct: number, status: string): void {
    getDb()
      .prepare(
        "UPDATE projects SET progress_pct = ?, status = ?, updated_at = ? WHERE id = ?"
      )
      .run(progressPct, status, new Date().toISOString().slice(0, 10), projectId);
  },
};

/* --- project_types --------------------------------------------------------- */

function keType(r: Row): ProjectTypeInfo {
  return {
    code: teks(r.code) as ProjectTypeInfo["code"],
    label: teks(r.label),
    description: teks(r.description),
    sortOrder: angka(r.sort_order),
  };
}

export const projectTypes = {
  all(): ProjectTypeInfo[] {
    return getDb().prepare("SELECT * FROM project_types ORDER BY sort_order").all().map(keType);
  },

  byCode(code: string): ProjectTypeInfo | null {
    const r = getDb().prepare("SELECT * FROM project_types WHERE code = ?").get(code);
    return r ? keType(r as Row) : null;
  },

  update(code: string, input: Omit<ProjectTypeInfo, "code">): ProjectTypeInfo | null {
    const hasil = getDb()
      .prepare("UPDATE project_types SET label = ?, description = ?, sort_order = ? WHERE code = ?")
      .run(input.label, input.description, input.sortOrder, code);
    return hasil.changes === 0 ? null : projectTypes.byCode(code);
  },
};

/* --- progress_history ------------------------------------------------------ */

function keProgress(r: Row): ProgressEntry {
  return {
    id: angka(r.id),
    projectId: angka(r.project_id),
    userId: angka(r.user_id),
    progressPct: angka(r.progress_pct),
    note: teks(r.note),
    createdAt: teks(r.created_at),
    recordedAt: teks(r.recorded_at),
  };
}

export const progress = {
  all(): ProgressEntry[] {
    return getDb().prepare("SELECT * FROM progress_history ORDER BY id").all().map(keProgress);
  },

  /** Terbaru dulu; recorded_at memisahkan catatan di hari yang sama. */
  byProject(projectId: number): ProgressEntry[] {
    return getDb()
      .prepare(
        "SELECT * FROM progress_history WHERE project_id = ? ORDER BY created_at DESC, recorded_at DESC, id DESC"
      )
      .all(projectId)
      .map(keProgress);
  },

  insert(input: Omit<ProgressEntry, "id">): ProgressEntry {
    const db = getDb();
    db.prepare(
      `INSERT INTO progress_history (project_id, user_id, progress_pct, note, created_at, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      input.projectId,
      input.userId,
      input.progressPct,
      input.note,
      input.createdAt,
      input.recordedAt
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },
};

/* --- reminders ------------------------------------------------------------- */

function keReminder(r: Row): Reminder {
  return {
    id: angka(r.id),
    projectId: angka(r.project_id),
    toUserId: angka(r.to_user_id),
    fromUserId: angka(r.from_user_id),
    message: teks(r.message),
    channel: teks(r.channel) as Reminder["channel"],
    createdAt: teks(r.created_at),
    sentAt: teks(r.sent_at),
  };
}

export const reminders = {
  all(): Reminder[] {
    return getDb().prepare("SELECT * FROM reminders ORDER BY id").all().map(keReminder);
  },

  byProject(projectId: number): Reminder[] {
    return getDb()
      .prepare("SELECT * FROM reminders WHERE project_id = ? ORDER BY sent_at DESC, id DESC")
      .all(projectId)
      .map(keReminder);
  },

  insert(input: Omit<Reminder, "id">): Reminder {
    const db = getDb();
    db.prepare(
      `INSERT INTO reminders
         (project_id, to_user_id, from_user_id, message, channel, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.projectId,
      input.toUserId,
      input.fromUserId,
      input.message,
      input.channel,
      input.createdAt,
      input.sentAt
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },
};

/* --- reminder_schedules ---------------------------------------------------- */

function keSchedule(r: Row): ReminderSchedule {
  return {
    id: angka(r.id),
    projectId: angka(r.project_id),
    toUserId: angka(r.to_user_id),
    frequency: teks(r.frequency),
    nextAt: teks(r.next_at),
    isActive: boolDb(r.is_active),
    createdAt: teks(r.created_at),
  };
}

export const schedules = {
  all(): ReminderSchedule[] {
    return getDb().prepare("SELECT * FROM reminder_schedules ORDER BY id").all().map(keSchedule);
  },

  byProject(projectId: number): ReminderSchedule | null {
    const r = getDb().prepare("SELECT * FROM reminder_schedules WHERE project_id = ?").get(projectId);
    return r ? keSchedule(r as Row) : null;
  },

  /** Satu proyek satu jadwal — ditegakkan UNIQUE, jadi upsert bukan insert. */
  save(input: Omit<ReminderSchedule, "id">): ReminderSchedule {
    getDb()
      .prepare(
        `INSERT INTO reminder_schedules
           (project_id, to_user_id, frequency, next_at, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           to_user_id = excluded.to_user_id,
           frequency = excluded.frequency,
           next_at = excluded.next_at,
           is_active = excluded.is_active,
           updated_at = datetime('now')`
      )
      .run(
        input.projectId,
        input.toUserId,
        input.frequency,
        input.nextAt,
        input.isActive ? 1 : 0,
        input.createdAt
      );
    return schedules.byProject(input.projectId)!;
  },

  setActive(id: number, aktif: boolean): ReminderSchedule | null {
    const db = getDb();
    const hasil = db
      .prepare("UPDATE reminder_schedules SET is_active = ?, updated_at = datetime('now') WHERE id = ?")
      .run(aktif ? 1 : 0, id);
    if (hasil.changes === 0) return null;

    const r = db.prepare("SELECT * FROM reminder_schedules WHERE id = ?").get(id);
    return r ? keSchedule(r as Row) : null;
  },

  setNextAt(id: number, nextAt: string): void {
    getDb()
      .prepare("UPDATE reminder_schedules SET next_at = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nextAt, id);
  },
};

/* --- comments -------------------------------------------------------------- */

function keComment(r: Row): ProjectComment {
  return {
    id: angka(r.id),
    projectId: angka(r.project_id),
    userId: angka(r.user_id),
    body: teks(r.body),
    createdAt: teks(r.created_at),
    postedAt: teks(r.posted_at),
  };
}

export const comments = {
  all(): ProjectComment[] {
    return getDb().prepare("SELECT * FROM comments ORDER BY id").all().map(keComment);
  },

  /** Terlama dulu — komentar dibaca sebagai percakapan. */
  byProject(projectId: number): ProjectComment[] {
    return getDb()
      .prepare("SELECT * FROM comments WHERE project_id = ? ORDER BY posted_at, id")
      .all(projectId)
      .map(keComment);
  },

  insert(input: Omit<ProjectComment, "id">): ProjectComment {
    const db = getDb();
    db.prepare(
      "INSERT INTO comments (project_id, user_id, body, created_at, posted_at) VALUES (?, ?, ?, ?, ?)"
    ).run(input.projectId, input.userId, input.body, input.createdAt, input.postedAt);
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },
};

/* --- project_dependencies -------------------------------------------------- */

export const dependencies = {
  all(): ProjectDependency[] {
    return getDb()
      .prepare("SELECT blocker_id, blocked_id FROM project_dependencies")
      .all()
      .map((r) => ({
        blockerId: angka((r as Row).blocker_id),
        blockedId: angka((r as Row).blocked_id),
      }));
  },

  /** Ganti seluruh relasi milik satu penahan sekaligus — semua atau tidak sama sekali. */
  replaceFor(blockerId: number, blockedIds: number[]): void {
    const db = getDb();
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM project_dependencies WHERE blocker_id = ?").run(blockerId);
      const insert = db.prepare(
        "INSERT INTO project_dependencies (blocker_id, blocked_id) VALUES (?, ?)"
      );
      for (const id of blockedIds) insert.run(blockerId, id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  },
};

/* --- agenda ---------------------------------------------------------------- */

function keAgenda(r: Row): AgendaEntry {
  return {
    id: angka(r.id),
    userId: angka(r.user_id),
    projectId: angkaAtauNull(r.project_id),
    kind: teks(r.kind) as AgendaEntry["kind"],
    startDate: teks(r.start_date),
    endDate: teks(r.end_date),
    locationCity: teks(r.location_city),
    locationProvince: teks(r.location_province),
    note: teks(r.note),
    createdBy: angka(r.created_by),
    updatedAt: teks(r.updated_at),
  };
}

export const agenda = {
  all(): AgendaEntry[] {
    return getDb().prepare("SELECT * FROM agenda ORDER BY start_date, id").all().map(keAgenda);
  },

  byId(id: number): AgendaEntry | null {
    const r = getDb().prepare("SELECT * FROM agenda WHERE id = ?").get(id);
    return r ? keAgenda(r as Row) : null;
  },

  insert(input: Omit<AgendaEntry, "id">): AgendaEntry {
    const db = getDb();
    db.prepare(
      `INSERT INTO agenda
         (user_id, project_id, kind, start_date, end_date,
          location_city, location_province, note, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.userId,
      input.projectId,
      input.kind,
      input.startDate,
      input.endDate,
      input.locationCity,
      input.locationProvince,
      input.note,
      input.createdBy,
      input.updatedAt
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },

  update(id: number, input: Omit<AgendaEntry, "id">): AgendaEntry | null {
    const hasil = getDb()
      .prepare(
        `UPDATE agenda SET
           user_id = ?, project_id = ?, kind = ?, start_date = ?, end_date = ?,
           location_city = ?, location_province = ?, note = ?, created_by = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.userId,
        input.projectId,
        input.kind,
        input.startDate,
        input.endDate,
        input.locationCity,
        input.locationProvince,
        input.note,
        input.createdBy,
        input.updatedAt,
        id
      );
    return hasil.changes === 0 ? null : agenda.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM agenda WHERE id = ?").run(id).changes > 0;
  },

  /**
   * Pindahkan beberapa agenda sekaligus — semua atau tidak sama sekali.
   *
   * Satu transaksi, bukan perulangan update(): menggeser bar berisi tiga entri
   * yang gagal di tengah akan meninggalkan bar terbelah dua tanggal, dan itu
   * justru keadaan yang tidak bisa dibentuk lewat UI mana pun.
   */
  moveMany(
    perubahan: { id: number; userId: number; startDate: string; endDate: string }[]
  ): number {
    if (perubahan.length === 0) return 0;

    const db = getDb();
    db.exec("BEGIN");
    try {
      const ubah = db.prepare(
        `UPDATE agenda
           SET user_id = ?, start_date = ?, end_date = ?, updated_at = datetime('now')
         WHERE id = ?`
      );
      let n = 0;
      for (const p of perubahan) {
        n += Number(ubah.run(p.userId, p.startDate, p.endDate, p.id).changes);
      }
      db.exec("COMMIT");
      return n;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  },

  /** Hapus beberapa agenda sekaligus, dalam satu transaksi. */
  removeMany(ids: number[]): number {
    if (ids.length === 0) return 0;

    const db = getDb();
    db.exec("BEGIN");
    try {
      const hapus = db.prepare("DELETE FROM agenda WHERE id = ?");
      let n = 0;
      for (const id of ids) n += Number(hapus.run(id).changes);
      db.exec("COMMIT");
      return n;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  },
};

/* --- strategic_plans -------------------------------------------------------- */

function kePlan(r: Row): StrategicPlan {
  return {
    id: angka(r.id),
    title: teks(r.title),
    summary: teks(r.summary),
    kind: teks(r.kind) as StrategicPlan["kind"],
    goal: teks(r.goal) as StrategicPlan["goal"],
    segment: teks(r.segment) as StrategicPlan["segment"],
    region: teks(r.region),
    partner: teks(r.partner),
    status: teks(r.status) as StrategicPlan["status"],
    priority: teks(r.priority) as StrategicPlan["priority"],
    ownerId: angka(r.owner_id),
    startDate: teksAtauNull(r.start_date),
    targetDate: teksAtauNull(r.target_date),
    outcome: teks(r.outcome),
    createdBy: angka(r.created_by),
    updatedAt: teks(r.updated_at),
  };
}

/** Kolom yang bisa ditulis, urut sama dengan nilai di isiPlan(). */
const KOLOM_PLAN = [
  "title",
  "summary",
  "kind",
  "goal",
  "segment",
  "region",
  "partner",
  "status",
  "priority",
  "owner_id",
  "start_date",
  "target_date",
  "outcome",
  "updated_at",
];

function isiPlan(p: Omit<StrategicPlan, "id" | "createdBy">): unknown[] {
  return [
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
    p.updatedAt,
  ];
}

export const plans = {
  all(): StrategicPlan[] {
    return getDb()
      .prepare("SELECT * FROM strategic_plans ORDER BY id")
      .all()
      .map(kePlan);
  },

  byId(id: number): StrategicPlan | null {
    const r = getDb().prepare("SELECT * FROM strategic_plans WHERE id = ?").get(id);
    return r ? kePlan(r as Row) : null;
  },

  insert(input: Omit<StrategicPlan, "id">): StrategicPlan {
    const db = getDb();
    const kolom = [...KOLOM_PLAN, "created_by"];
    const tanya = kolom.map(() => "?").join(", ");
    db.prepare(`INSERT INTO strategic_plans (${kolom.join(", ")}) VALUES (${tanya})`).run(
      ...([...isiPlan(input), input.createdBy] as never[])
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return plans.byId(id)!;
  },

  /** created_by tidak ikut diubah: itu jejak siapa yang pertama menyusun. */
  update(id: number, input: Omit<StrategicPlan, "id" | "createdBy">): StrategicPlan | null {
    const set = KOLOM_PLAN.map((k) => `${k} = ?`).join(", ");
    const hasil = getDb()
      .prepare(`UPDATE strategic_plans SET ${set} WHERE id = ?`)
      .run(...(isiPlan(input) as never[]), id);
    return hasil.changes === 0 ? null : plans.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM strategic_plans WHERE id = ?").run(id).changes > 0;
  },
};

/* --- plan_steps ------------------------------------------------------------- */

function keStep(r: Row): PlanStep {
  return {
    id: angka(r.id),
    planId: angka(r.plan_id),
    title: teks(r.title),
    ownerId: angkaAtauNull(r.owner_id),
    targetDate: teksAtauNull(r.target_date),
    status: teks(r.status) as PlanStep["status"],
    note: teks(r.note),
    sortOrder: angka(r.sort_order),
  };
}

export const planSteps = {
  all(): PlanStep[] {
    return getDb()
      .prepare("SELECT * FROM plan_steps ORDER BY plan_id, sort_order, id")
      .all()
      .map(keStep);
  },

  byPlan(planId: number): PlanStep[] {
    return getDb()
      .prepare("SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY sort_order, id")
      .all(planId)
      .map(keStep);
  },

  byId(id: number): PlanStep | null {
    const r = getDb().prepare("SELECT * FROM plan_steps WHERE id = ?").get(id);
    return r ? keStep(r as Row) : null;
  },

  insert(input: Omit<PlanStep, "id">): PlanStep {
    const db = getDb();
    db.prepare(
      `INSERT INTO plan_steps (plan_id, title, owner_id, target_date, status, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.planId,
      input.title,
      input.ownerId,
      input.targetDate,
      input.status,
      input.note,
      input.sortOrder
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },

  update(id: number, input: Omit<PlanStep, "id" | "planId">): PlanStep | null {
    const hasil = getDb()
      .prepare(
        `UPDATE plan_steps SET
           title = ?, owner_id = ?, target_date = ?, status = ?, note = ?, sort_order = ?,
           updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        input.title,
        input.ownerId,
        input.targetDate,
        input.status,
        input.note,
        input.sortOrder,
        id
      );
    return hasil.changes === 0 ? null : planSteps.byId(id);
  },

  /** Ubah status saja — jalur tersering, dan tidak menyentuh kolom lain. */
  setStatus(id: number, status: PlanStep["status"]): PlanStep | null {
    const hasil = getDb()
      .prepare("UPDATE plan_steps SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
    return hasil.changes === 0 ? null : planSteps.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM plan_steps WHERE id = ?").run(id).changes > 0;
  },

  /** Nomor urut berikutnya dalam satu rencana. */
  nextSortOrder(planId: number): number {
    const r = getDb()
      // COALESCE membungkus MAX+1, bukan MAX: rencana tanpa langkah mulai dari
      // 0, sama dengan data awal. sort_order adalah kunci urut, bukan nomor
      // yang ditampilkan — yang ditampilkan dihitung dari posisinya.
      .prepare("SELECT COALESCE(MAX(sort_order) + 1, 0) AS n FROM plan_steps WHERE plan_id = ?")
      .get(planId) as Row;
    return angka(r.n);
  },
};

/* --- plan_prospects --------------------------------------------------------- */

function keProspect(r: Row): PlanProspect {
  return {
    id: angka(r.id),
    planId: angka(r.plan_id),
    name: teks(r.name),
    contact: teks(r.contact),
    region: teks(r.region),
    status: teks(r.status) as PlanProspect["status"],
    note: teks(r.note),
    updatedAt: teks(r.updated_at),
  };
}

export const planProspects = {
  all(): PlanProspect[] {
    return getDb()
      .prepare("SELECT * FROM plan_prospects ORDER BY plan_id, id")
      .all()
      .map(keProspect);
  },

  byPlan(planId: number): PlanProspect[] {
    return getDb()
      .prepare("SELECT * FROM plan_prospects WHERE plan_id = ? ORDER BY id")
      .all(planId)
      .map(keProspect);
  },

  byId(id: number): PlanProspect | null {
    const r = getDb().prepare("SELECT * FROM plan_prospects WHERE id = ?").get(id);
    return r ? keProspect(r as Row) : null;
  },

  insert(input: Omit<PlanProspect, "id">): PlanProspect {
    const db = getDb();
    db.prepare(
      `INSERT INTO plan_prospects (plan_id, name, contact, region, status, note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.planId,
      input.name,
      input.contact,
      input.region,
      input.status,
      input.note,
      input.updatedAt
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },

  update(id: number, input: Omit<PlanProspect, "id" | "planId">): PlanProspect | null {
    const hasil = getDb()
      .prepare(
        `UPDATE plan_prospects SET
           name = ?, contact = ?, region = ?, status = ?, note = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(input.name, input.contact, input.region, input.status, input.note, input.updatedAt, id);
    return hasil.changes === 0 ? null : planProspects.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM plan_prospects WHERE id = ?").run(id).changes > 0;
  },
};

/* --- plan_projects ---------------------------------------------------------- */

function kePlanOutput(r: Row): PlanOutput {
  return {
    id: angka(r.id),
    planId: angka(r.plan_id),
    kind: teks(r.kind) as PlanOutput["kind"],
    title: teks(r.title),
    projectId: angkaAtauNull(r.project_id),
    url: teks(r.url),
    achievedAt: teksAtauNull(r.achieved_at),
    note: teks(r.note),
    sortOrder: angka(r.sort_order),
  };
}

export const planOutputs = {
  all(): PlanOutput[] {
    return getDb()
      .prepare("SELECT * FROM plan_outputs ORDER BY plan_id, sort_order, id")
      .all()
      .map((r) => kePlanOutput(r as Row));
  },

  byPlan(planId: number): PlanOutput[] {
    return getDb()
      .prepare("SELECT * FROM plan_outputs WHERE plan_id = ? ORDER BY sort_order, id")
      .all(planId)
      .map((r) => kePlanOutput(r as Row));
  },

  byId(id: number): PlanOutput | null {
    const r = getDb().prepare("SELECT * FROM plan_outputs WHERE id = ?").get(id);
    return r ? kePlanOutput(r as Row) : null;
  },

  insert(input: Omit<PlanOutput, "id">): PlanOutput {
    const db = getDb();
    db.prepare(
      `INSERT INTO plan_outputs
         (plan_id, kind, title, project_id, url, achieved_at, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.planId,
      input.kind,
      input.title,
      input.projectId,
      input.url,
      input.achievedAt,
      input.note,
      input.sortOrder
    );
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },

  update(id: number, input: Omit<PlanOutput, "id" | "planId">): PlanOutput | null {
    const hasil = getDb()
      .prepare(
        `UPDATE plan_outputs SET
           kind = ?, title = ?, project_id = ?, url = ?, achieved_at = ?, note = ?,
           sort_order = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        input.kind,
        input.title,
        input.projectId,
        input.url,
        input.achievedAt,
        input.note,
        input.sortOrder,
        id
      );
    return hasil.changes === 0 ? null : planOutputs.byId(id);
  },

  remove(id: number): boolean {
    return getDb().prepare("DELETE FROM plan_outputs WHERE id = ?").run(id).changes > 0;
  },

  nextSortOrder(planId: number): number {
    const r = getDb()
      .prepare("SELECT COALESCE(MAX(sort_order) + 1, 0) AS n FROM plan_outputs WHERE plan_id = ?")
      .get(planId) as Row;
    return angka(r.n);
  },
};

/* --- plan_comments ---------------------------------------------------------- */

function kePlanComment(r: Row): PlanComment {
  return {
    id: angka(r.id),
    planId: angka(r.plan_id),
    userId: angka(r.user_id),
    body: teks(r.body),
    createdAt: teks(r.created_at),
    postedAt: teks(r.posted_at),
  };
}

export const planComments = {
  /** Terlama dulu — komentar dibaca sebagai percakapan. */
  byPlan(planId: number): PlanComment[] {
    return getDb()
      .prepare("SELECT * FROM plan_comments WHERE plan_id = ? ORDER BY posted_at, id")
      .all(planId)
      .map(kePlanComment);
  },

  insert(input: Omit<PlanComment, "id">): PlanComment {
    const db = getDb();
    db.prepare(
      "INSERT INTO plan_comments (plan_id, user_id, body, created_at, posted_at) VALUES (?, ?, ?, ?, ?)"
    ).run(input.planId, input.userId, input.body, input.createdAt, input.postedAt);
    const id = angka((db.prepare("SELECT last_insert_rowid() AS id").get() as Row).id);
    return { ...input, id };
  },
};

/* --- sessions -------------------------------------------------------------- */

export const sessions = {
  /** `null` kalau token tidak dikenal atau sudah kedaluwarsa. */
  userId(token: string): number | null {
    const r = getDb()
      .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')")
      .get(token) as Row | undefined;
    return r ? angka(r.user_id) : null;
  },

  insert(token: string, userId: number, expiresAt: string): void {
    getDb()
      .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
      .run(token, userId, expiresAt);
  },

  revoke(token: string): boolean {
    return getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token).changes > 0;
  },

  revokeAllForUser(userId: number): number {
    // changes bertipe number | bigint; jumlah sesi satu orang tidak pernah
    // sebesar itu, jadi aman dipersempit.
    return Number(getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId).changes);
  },

  purgeExpired(): number {
    return Number(
      getDb().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run().changes
    );
  },

  clear(): void {
    getDb().exec("DELETE FROM sessions");
  },
};
