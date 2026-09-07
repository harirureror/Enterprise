import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  isActiveStatus,
  type AccessLevel,
  type AgendaEntry,
  type PlanComment,
  type PlanProspect,
  type PlanStep,
  type ProgressEntry,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectType,
  type ProjectTypeInfo,
  type ProjectComment,
  type ProjectDependency,
  type Reminder,
  type ReminderSchedule,
  type StrategicPlan,
  type User,
} from "./types";
import { type ProjectFilter, filterProjects } from "./filters";
import * as store from "./db/store";
import {
  type Coverage,
  type PlanProgress,
  coverage,
  needsAttention,
  planProgress,
  prospectWins,
} from "./strategy";
import {
  type Notification,
  type NotificationSeverity,
  buildNotifications,
  countBySeverity,
} from "./notifications";
import {
  type PriorityScore,
  compareByPriority,
  ownerClashCounts,
  scoreAll,
  wouldCycle,
} from "./priority";
import { sortByPriority } from "./ui";
import {
  type ReminderFrequency,
  advancePast,
  autoReminderMessage,
  isDue,
  nextOccurrence,
} from "./reminder-schedule";
import { type ProjectSummary, type TypeStats, projectSummary, typeBreakdown } from "./summary";
import {
  type MonthOverlap,
  type OverlapPair,
  type OverlapStats,
  type OwnerConflict,
  type TimelineRange,
  overlapInfo,
  overlapPairsList,
  overlapPerMonth,
  overlapStats,
  ownerConflicts,
  timelineRange,
} from "./timeline";

/**
 * Satu-satunya pintu data dashboard.
 *
 * Penyimpanannya SQLite lewat lib/db/store.ts; berkas ini yang menyusun bentuk
 * yang dipakai layar — prioritas diterapkan, relasi dilengkapi, angka
 * diringkas. Pembagian itu disengaja: SQL terkumpul di satu tempat, aturan
 * bisnis di tempat lain, dan keduanya bisa diuji sendiri-sendiri.
 */

/**
 * Terapkan prioritas otomatis. Proyek ber-`priorityMode: "auto"` kolom
 * `priority`-nya diisi hasil hitungan; yang "manual" dibiarkan apa adanya.
 *
 * Sengaja dikerjakan di sini, bukan di tiap komponen: dengan begitu filter,
 * ringkasan, tabel, kartu, dan pengurutan semuanya melihat angka yang sama
 * tanpa perlu tahu prioritasnya dari mana.
 *
 * Skornya dihitung atas daftar penuh sebelum disaring, supaya bentrok jadwal
 * PIC tidak berubah hanya karena pengguna sedang memfilter tampilannya.
 */
function terapkanPrioritas(projects: Project[]): Project[] {
  const skor = scoreAll(projects, store.dependencies.all());
  return projects.map((p) =>
    p.priorityMode === "auto" ? { ...p, priority: skor.get(p.id)!.level } : p
  );
}

/** Daftar proyek, opsional disaring. Tanpa argumen = seluruh proyek. */
export async function getProjects(filter?: Partial<ProjectFilter>): Promise<Project[]> {
  const semua = terapkanPrioritas(store.projects.all());
  return filter ? filterProjects(semua, filter) : semua;
}

/** Satu proyek berdasarkan id. `null` kalau tidak ada. */
export async function getProject(id: number): Promise<Project | null> {
  return (await getProjects()).find((p) => p.id === id) ?? null;
}

export type FocusItem = {
  project: Project;
  owner: User | null;
  score: PriorityScore;
};

/**
 * Proyek yang paling perlu dikerjakan lebih dulu, urut dari skor tertinggi.
 * Yang sudah selesai tidak ikut — skornya nol dan tidak ada yang perlu dikejar.
 */
export async function getFocusProjects(limit = 5): Promise<FocusItem[]> {
  const projects = await getProjects();
  // Skor dan bentrok dihitung atas daftar penuh, bukan hasil saring — kalau
  // tidak, urutannya berubah hanya karena tampilannya sedang difilter.
  const semua = store.projects.all();
  const skor = scoreAll(semua, store.dependencies.all());
  const users = await getUsers();
  // Bentrok jadwal PIC bukan lagi penyumbang skor, hanya pemecah seri.
  const clash = ownerClashCounts(semua);

  return projects
    .filter((p) => isActiveStatus(p.status))
    .map((p) => ({
      project: p,
      owner: users.find((u) => u.id === p.ownerId) ?? null,
      score: skor.get(p.id)!,
    }))
    .sort((a, b) => compareByPriority(a, b, clash))
    .slice(0, limit);
}

export type DependencyView = {
  /** Proyek lain yang ditahan proyek ini. */
  blocking: Project[];
  /** Proyek lain yang menahan proyek ini. */
  blockedBy: Project[];
};

/** Ketergantungan satu proyek, dua arah. */
export async function getDependencies(projectId: number): Promise<DependencyView> {
  const projects = await getProjects();
  const cari = (id: number) => projects.find((p) => p.id === id);

  const relasi = store.dependencies.all();

  return {
    blocking: relasi
      .filter((d) => d.blockerId === projectId)
      .map((d) => cari(d.blockedId))
      .filter((p): p is Project => p !== undefined),
    blockedBy: relasi
      .filter((d) => d.blockedId === projectId)
      .map((d) => cari(d.blockerId))
      .filter((p): p is Project => p !== undefined),
  };
}

export type DependencyError = "diri-sendiri" | "melingkar" | "tidak-ada" | "sudah-ada";

/**
 * Tetapkan proyek mana saja yang ditahan `blockerId`, menggantikan daftar lama.
 *
 * Menolak relasi ke diri sendiri dan relasi yang membentuk lingkaran — dua
 * proyek yang saling menunggu tidak akan pernah bisa jalan, dan SQLite tidak
 * bisa menjaganya lewat constraint.
 */
export async function setDependencies(
  blockerId: number,
  blockedIds: number[]
): Promise<{ ok: true } | { ok: false; error: DependencyError; projectId?: number }> {
  const projects = await getProjects();
  if (!projects.some((p) => p.id === blockerId)) return { ok: false, error: "tidak-ada" };

  const diminta = [...new Set(blockedIds)];

  for (const id of diminta) {
    if (id === blockerId) return { ok: false, error: "diri-sendiri", projectId: id };
    if (!projects.some((p) => p.id === id)) {
      return { ok: false, error: "tidak-ada", projectId: id };
    }
  }

  // Relasi lama milik blocker ini dibuang dulu, supaya pemeriksaan lingkaran
  // menilai keadaan sesudah perubahan — bukan keadaan lama yang sudah usang.
  const lainnya = store.dependencies.all().filter((d) => d.blockerId !== blockerId);
  const calon: ProjectDependency[] = [];

  for (const id of diminta) {
    if (wouldCycle([...lainnya, ...calon], blockerId, id)) {
      return { ok: false, error: "melingkar", projectId: id };
    }
    calon.push({ blockerId, blockedId: id });
  }

  // Diganti sekaligus dalam satu transaksi: relasi setengah tersimpan akan
  // membuat skor prioritas salah tanpa ada yang menyadarinya.
  store.dependencies.replaceFor(blockerId, diminta);
  return { ok: true };
}

export type ConflictDetail = {
  project: Project;
  owner: User | null;
  /** Masa bentrok antara kedua proyek. */
  startDate: string;
  endDate: string;
  days: number;
  /** PIC-nya sama — satu orang dijadwalkan di dua proyek sekaligus. */
  sameOwner: boolean;
};

export type ProgressEntryView = ProgressEntry & {
  /** Anggota yang mencatat; `null` kalau akunnya sudah tidak ada. */
  user: User | null;
  /** Selisih dari catatan sebelumnya; `null` untuk catatan paling awal. */
  delta: number | null;
};

export type ProjectDetail = {
  project: Project;
  owner: User | null;
  /** Proyek lain yang jadwalnya beririsan, terlama dulu. */
  conflicts: ConflictDetail[];
  /** Riwayat progres, terbaru dulu. */
  history: ProgressEntryView[];
  /** Skor prioritas berikut rincian alasannya. */
  priority: PriorityScore;
  /** Pengingat yang pernah dikirim untuk proyek ini, terbaru dulu. */
  reminders: ReminderView[];
  /** Jadwal pengingat berulang; kosong kalau belum pernah diatur. */
  schedule: ReminderSchedule | null;
  /** Ringkasan status pengingat proyek ini. */
  reminderStatus: ReminderStatus;
  /** Komentar diskusi, terlama dulu. */
  comments: CommentView[];
  /** Ketergantungan dua arah dengan proyek lain. */
  dependencies: DependencyView;
  /** Proyek lain yang boleh ditahan proyek ini (semua kecuali dirinya sendiri). */
  dependencyCandidates: Project[];
};

/** Isi halaman detail proyek: proyeknya, PIC-nya, dan bentrok jadwalnya. */
export async function getProjectDetail(id: number): Promise<ProjectDetail | null> {
  const project = await getProject(id);
  if (!project) return null;

  const projects = await getProjects();
  const users = await getUsers();
  const cariUser = (uid: number) => users.find((u) => u.id === uid) ?? null;

  const conflicts = overlapPairsList(projects)
    .filter((pair) => pair.a === id || pair.b === id)
    .map((pair) => {
      const lawan = projects.find((p) => p.id === (pair.a === id ? pair.b : pair.a))!;
      return {
        project: lawan,
        owner: cariUser(lawan.ownerId),
        startDate: pair.startDate,
        endDate: pair.endDate,
        days: pair.days,
        sameOwner: pair.sameOwner,
      };
    });

  const history = await getProgressHistoryView(id);

  return {
    project,
    owner: cariUser(project.ownerId),
    conflicts,
    history,
    priority: scoreAll(store.projects.all(), store.dependencies.all()).get(id)!,
    reminders: await getReminders(id),
    schedule: (await getSchedules(id))[0] ?? null,
    reminderStatus: await getReminderStatus(id),
    comments: await getComments(id),
    dependencies: await getDependencies(id),
    dependencyCandidates: projects.filter((p) => p.id !== id),
  };
}

/** Simpan proyek baru. Id-nya diberikan database, bukan dihitung pemanggil. */
export async function createProject(input: Omit<Project, "id">): Promise<Project> {
  return store.projects.insert(input);
}

/** Perbarui proyek yang sudah ada. `null` kalau id-nya tidak ketemu. */
export async function updateProject(
  id: number,
  input: Omit<Project, "id">
): Promise<Project | null> {
  return store.projects.update(id, input);
}

/** Riwayat progres satu proyek, terbaru dulu. */
export async function getProgressHistory(projectId: number): Promise<ProgressEntry[]> {
  return store.progress
    .byProject(projectId)
    // Stempel waktu penuh dipakai lebih dulu supaya catatan di hari yang sama
    // tetap berurutan; id hanya jadi penentu terakhir.
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id - a.id);
}

/**
 * Riwayat progres yang sudah dilengkapi nama pencatat dan selisih dari catatan
 * sebelumnya. Dipakai halaman detail sekaligus GET /api/projects/{id}/history,
 * jadi keduanya tidak bisa memberi angka yang berbeda.
 */
export async function getProgressHistoryView(projectId: number): Promise<ProgressEntryView[]> {
  const riwayat = await getProgressHistory(projectId);
  const users = await getUsers();

  // Urutannya terbaru dulu, jadi pembanding selisih ada di indeks berikutnya.
  return riwayat.map((e, i) => ({
    ...e,
    user: users.find((u) => u.id === e.userId) ?? null,
    delta: i + 1 < riwayat.length ? e.progressPct - riwayat[i + 1].progressPct : null,
  }));
}

/**
 * Catat progres baru: satu baris riwayat, sekaligus memperbarui persentase di
 * proyeknya. Status sengaja tidak ikut berubah — itu keputusan terpisah.
 * ponytail: fase database jadi INSERT progress_history + UPDATE projects dalam satu transaksi.
 */
export async function addProgress(input: {
  projectId: number;
  userId: number;
  progressPct: number;
  note: string;
}): Promise<ProgressEntry | null> {
  if (store.projects.byId(input.projectId) === null) return null;

  const sekarang = new Date().toISOString();
  const hariIni = sekarang.slice(0, 10);

  const entry = store.progress.insert({
    projectId: input.projectId,
    userId: input.userId,
    progressPct: input.progressPct,
    note: input.note,
    createdAt: hariIni,
    recordedAt: `${hariIni} ${sekarang.slice(11, 19)}`,
  });

  // Progres proyeknya ikut disamakan dengan catatan terbaru.
  store.projects.patch(input.projectId, { progress_pct: input.progressPct }, hariIni);
  return entry;
}

/**
 * Ubah status satu proyek tanpa menyentuh kolom lain. Progres sengaja tidak
 * ikut diubah — itu urusan pencatatan progres, bukan efek samping ganti status.
 */
export async function updateProjectStatus(
  id: number,
  status: ProjectStatus
): Promise<Project | null> {
  return store.projects.patch(id, { status }, new Date().toISOString().slice(0, 10));
}

/**
 * Hapus proyek. `false` kalau id-nya tidak ketemu.
 *
 * Relasi ketergantungan dan riwayatnya ikut terhapus lewat ON DELETE CASCADE;
 * agenda yang menunjuknya diputus jadi NULL, karena orangnya tetap pernah
 * pergi ke sana.
 */
export async function deleteProject(id: number): Promise<boolean> {
  if (!store.projects.remove(id)) return false;
  return true;
}

/**
 * Daftar anggota. `activeOnly` dipakai tempat yang menawarkan pilihan orang
 * (mis. dropdown PIC): akun nonaktif tidak boleh dipilih lagi, tapi tetap harus
 * muncul di proyek lama yang dia pegang — jadi penyaringannya di pemanggil,
 * bukan di sini secara diam-diam.
 */
export async function getUsers(options: { activeOnly?: boolean } = {}): Promise<User[]> {
  const semua = store.users.all();
  return options.activeOnly ? semua.filter((u) => u.isActive) : semua;
}

/**
 * Identitas cadangan saat REQUIRE_AUTH=0 — dipakai hanya oleh jalan pintas
 * dev-fallback di lib/auth.ts, bukan oleh kode yang butuh "siapa yang sedang
 * masuk". Yang itu memakai getSessionUser().
 */
export async function getCurrentUser(): Promise<User> {
  const semua = store.users.all();
  return semua.find((u) => u.isActive) ?? semua[0];
}

/** Angka-angka kartu ringkasan di dashboard utama. */
export async function getSummary(): Promise<ProjectSummary> {
  return projectSummary(await getProjects());
}

/** Rincian per jenis proyek untuk halaman kelola jenis. */
/** Keterangan seluruh jenis proyek, urut sesuai `sortOrder`. */
export async function getProjectTypes(): Promise<ProjectTypeInfo[]> {
  return store.projectTypes
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** Satu jenis berdasarkan kodenya. `null` kalau kodenya tidak dikenal. */
export async function getProjectType(code: string): Promise<ProjectTypeInfo | null> {
  return store.projectTypes.byCode(code);
}

/**
 * Ubah keterangan satu jenis. `code` tidak ikut bisa diubah: nilainya terkunci
 * di union `ProjectType` dan CHECK kolom `projects.type`, jadi menggantinya
 * akan memutus proyek yang sudah memakai kode lama.
 * ponytail: fase database jadi UPDATE ke tabel project_types.
 */
export async function updateProjectType(
  code: string,
  input: { label: string; description: string; sortOrder: number }
): Promise<ProjectTypeInfo | null> {
  const index = store.projectTypes.byCode(code) === null ? -1 : 0;
  if (index === -1) return null;

  const info = store.projectTypes.update(code, input);
  if (info === null) return null;
  return info;
}

export async function getTypeBreakdown(): Promise<TypeStats[]> {
  return typeBreakdown(await getProjects());
}

export type TimelinePayload = {
  projects: Project[];
  /** Anggota pemilik proyek, supaya klien bisa menulis nama PIC tanpa request lain. */
  users: User[];
  range: TimelineRange | null;
  /** Jumlah pasangan proyek yang jadwalnya bentrok. */
  overlapPairs: number;
  /** id proyek → jumlah proyek lain yang bentrok dengannya. */
  overlapByProject: Record<number, number>;
  /** Pasangan yang bentrok berikut masa irisannya, terlama dulu. */
  overlaps: OverlapPair[];
  /** Anggota yang jadwal proyeknya tumpang tindih dengan dirinya sendiri. */
  ownerConflicts: OwnerConflict[];
  perMonth: MonthOverlap[];
  /** Jumlah proyek sebelum disaring, untuk teks "menampilkan X dari Y". */
  total: number;
};

/**
 * Data siap pakai untuk halaman timeline: proyek plus ringkasan bentroknya.
 * Bentrok dihitung setelah penyaringan — kalau satu anggota disaring, yang
 * ditampilkan adalah bentrok di antara proyek yang tersisa saja.
 */
export async function getTimeline(filter?: Partial<ProjectFilter>): Promise<TimelinePayload> {
  const projects = await getProjects(filter);
  const { counts, pairs } = overlapInfo(projects);

  return {
    projects,
    users: await getUsers(),
    range: timelineRange(projects),
    overlapPairs: pairs,
    overlapByProject: Object.fromEntries(counts),
    overlaps: overlapPairsList(projects),
    ownerConflicts: ownerConflicts(projects),
    perMonth: overlapPerMonth(projects),
    total: (await getProjects()).length,
  };
}

/** Statistik bentrok saja, tanpa membawa data proyeknya. */
export async function getOverlapStats(filter?: Partial<ProjectFilter>): Promise<OverlapStats> {
  return overlapStats(await getProjects(filter));
}

export type ReminderView = Reminder & {
  /** Penerima dan pengirim; `null` kalau akunnya sudah tidak ada. */
  to: User | null;
  from: User | null;
};

/** Pengingat sebuah proyek, terbaru dulu. */
export async function getReminders(projectId: number): Promise<ReminderView[]> {
  const users = await getUsers();
  const cari = (uid: number) => users.find((u) => u.id === uid) ?? null;

  return store.reminders
    .byProject(projectId)
    .map((r) => ({ ...r, to: cari(r.toUserId), from: cari(r.fromUserId) }));
}

/**
 * Kirim pengingat manual ke PIC proyek. Sementara hanya tercatat in-app.
 * ponytail: fase notifikasi email tinggal menambah pengiriman surel di sini —
 * barisnya tetap disimpan supaya ada jejak siapa mengingatkan siapa.
 */
export async function createReminder(input: {
  projectId: number;
  fromUserId: number;
  message: string;
  /**
   * Tanggal pencatatan. Hanya diisi penjadwal otomatis supaya jejaknya sesuai
   * tanggal jalannya; form manual membiarkannya kosong dan memakai hari ini.
   */
  onDate?: string;
}): Promise<Reminder | null> {
  const project = await getProject(input.projectId);
  if (!project) return null;

  const sekarang = new Date().toISOString();
  const tanggal = input.onDate ?? sekarang.slice(0, 10);
  const reminder = store.reminders.insert({
    projectId: input.projectId,
    // Pengingat selalu ditujukan ke PIC proyek saat ini.
    toUserId: project.ownerId,
    fromUserId: input.fromUserId,
    message: input.message,
    channel: "in-app",
    createdAt: tanggal,
    sentAt: `${tanggal} ${sekarang.slice(11, 19)}`,
  });

  return reminder;
}

/** Jadwal pengingat sebuah proyek, yang aktif lebih dulu. */
export async function getSchedules(projectId: number): Promise<ReminderSchedule[]> {
  const jadwal = store.schedules.byProject(projectId);
  return jadwal === null ? [] : [jadwal];
}

/**
 * Buat atau perbarui jadwal. Satu proyek cukup satu jadwal aktif — mengatur
 * ulang berarti menimpa yang lama, bukan menumpuk pengingat baru di atasnya.
 * Ditegakkan UNIQUE(project_id) di skema, jadi ini benar-benar upsert.
 */
export async function saveSchedule(input: {
  projectId: number;
  frequency: ReminderFrequency;
  startDate: string;
}): Promise<ReminderSchedule | null> {
  const project = await getProject(input.projectId);
  if (!project) return null;

  const hariIni = new Date().toISOString().slice(0, 10);
  const lama = store.schedules.byProject(input.projectId);

  return store.schedules.save({
    projectId: input.projectId,
    toUserId: project.ownerId,
    frequency: input.frequency,
    nextAt: input.startDate,
    isActive: true,
    // Tanggal pembuatan yang lama dipertahankan; mengatur ulang jadwal bukan
    // berarti jadwalnya baru dibuat hari ini.
    createdAt: lama?.createdAt ?? hariIni,
  });
}

/** Hidupkan atau matikan jadwal tanpa menghapus setelannya. */
export async function setScheduleActive(
  projectId: number,
  isActive: boolean
): Promise<ReminderSchedule | null> {
  const lama = store.schedules.byProject(projectId);
  if (lama === null) return null;

  // Dihidupkan lagi setelah lama mati: tanggalnya dimajukan supaya tidak
  // langsung mengirim pengingat untuk periode yang sudah lewat.
  const hariIni = new Date().toISOString().slice(0, 10);
  if (isActive) {
    store.schedules.setNextAt(
      lama.id,
      advancePast(lama.nextAt, lama.frequency as ReminderFrequency, hariIni)
    );
  }
  return store.schedules.setActive(lama.id, isActive);
}

/** Pratinjau beberapa tanggal pengiriman berikutnya, untuk ditampilkan di form. */
export function previewSchedule(
  nextAt: string,
  frequency: ReminderFrequency,
  jumlah = 3
): string[] {
  const hasil: string[] = [];
  let kursor = nextAt;
  for (let i = 0; i < jumlah; i++) {
    hasil.push(kursor);
    kursor = nextOccurrence(kursor, frequency);
  }
  return hasil;
}

export type ReminderStatus = {
  projectId: number;
  /** Berapa kali pengingat manual pernah dikirim. */
  sentCount: number;
  /** Tanggal pengingat terakhir; `null` kalau belum pernah. */
  lastSentAt: string | null;
  /** Frekuensi jadwal yang aktif; `null` kalau tidak ada atau sedang dimatikan. */
  frequency: string | null;
  /** Tanggal kiriman terjadwal berikutnya; `null` kalau jadwalnya tidak aktif. */
  nextAt: string | null;
  /** Jadwalnya sudah lewat tanggal dan belum terkirim. */
  overdue: boolean;
};

function susunStatus(
  projectId: number,
  hariIni: string
): ReminderStatus {
  const terkirim = store.reminders
    .byProject(projectId)
    .map((r) => r.createdAt)
    .sort();
  const jadwal = store.schedules.byProject(projectId);
  const aktif = jadwal?.isActive === true;

  return {
    projectId,
    sentCount: terkirim.length,
    lastSentAt: terkirim.at(-1) ?? null,
    frequency: aktif ? jadwal!.frequency : null,
    nextAt: aktif ? jadwal!.nextAt : null,
    // Hanya berarti kalau jadwalnya memang sedang aktif.
    overdue: aktif ? isDue(jadwal!.nextAt, hariIni) : false,
  };
}

/** Ringkasan status pengingat satu proyek: sudah dikirim apa belum, terjadwal apa tidak. */
export async function getReminderStatus(projectId: number): Promise<ReminderStatus> {
  return susunStatus(projectId, new Date().toISOString().slice(0, 10));
}

/**
 * Status pengingat seluruh proyek sekaligus, dikunci id. Dipakai halaman
 * notifikasi supaya bisa menandai proyek yang sudah pernah diingatkan —
 * tanpa perlu satu panggilan per baris.
 */
export async function getReminderStatusMap(): Promise<Record<number, ReminderStatus>> {
  const hariIni = new Date().toISOString().slice(0, 10);
  const projects = await getProjects();
  return Object.fromEntries(projects.map((p) => [p.id, susunStatus(p.id, hariIni)]));
}

export type TeamMember = {
  user: User;
  /** Proyek yang dipegang, prioritas tertinggi dulu. */
  projects: Project[];
  activeCount: number;
  doneCount: number;
  highPriorityActive: number;
  /** Total nilai proyek aktif yang dipegang. */
  pipelineValue: number;
  avgProgress: number;
  overdue: number;
  /** Pasangan proyek miliknya sendiri yang jadwalnya beririsan. */
  clashPairs: number;
  /** Tenggat terdekat yang belum selesai; `null` kalau semuanya beres. */
  nextDeadline: string | null;
};

/**
 * Beban kerja tiap anggota. Dipakai halaman kolaborasi tim untuk melihat siapa
 * yang menumpuk dan siapa yang masih longgar — angkanya diturunkan dari proyek,
 * bukan disimpan terpisah, jadi tidak bisa basi.
 */
export async function getTeam(): Promise<TeamMember[]> {
  const [projects, users] = await Promise.all([getProjects(), getUsers()]);
  const bentrok = ownerConflicts(projects);

  return users
    .map((user) => {
      const milik = sortByPriority(projects.filter((p) => p.ownerId === user.id));
      const aktif = milik.filter((p) => isActiveStatus(p.status));
      const ringkas = projectSummary(milik);

      return {
        user,
        projects: milik,
        activeCount: aktif.length,
        doneCount: milik.length - aktif.length,
        highPriorityActive: ringkas.highPriorityActive,
        pipelineValue: ringkas.pipelineValue,
        avgProgress: ringkas.avgProgress,
        overdue: ringkas.overdue,
        clashPairs: bentrok.find((b) => b.ownerId === user.id)?.pairs.length ?? 0,
        nextDeadline:
          aktif
            .map((p) => p.deadline)
            .sort()
            .at(0) ?? null,
      };
    })
    // Yang paling padat di atas: proyek aktif terbanyak, lalu yang telat.
    .sort(
      (a, b) =>
        b.activeCount - a.activeCount ||
        b.overdue - a.overdue ||
        a.user.name.localeCompare(b.user.name, "id")
    );
}

export type MemberProfile = {
  member: TeamMember;
  /** Catatan progres yang pernah ditulis anggota ini, terbaru dulu. */
  contributions: ProgressEntry[];
  /** Pengingat yang ditujukan kepadanya, terbaru dulu. */
  reminders: ReminderView[];
  /** Bentrok jadwal antar proyeknya sendiri. */
  clashes: OwnerConflict | null;
};

/** Isi halaman profil satu anggota. `null` kalau id-nya tidak ada. */
export async function getMemberProfile(userId: number): Promise<MemberProfile | null> {
  const member = (await getTeam()).find((m) => m.user.id === userId);
  if (!member) return null;

  const users = await getUsers();
  const cari = (uid: number) => users.find((u) => u.id === uid) ?? null;

  return {
    member,
    contributions: store.progress
      .all()
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id - a.id),
    reminders: store.reminders
      .all()
      .filter((r) => r.toUserId === userId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id - a.id)
      .map((r) => ({ ...r, to: cari(r.toUserId), from: cari(r.fromUserId) })),
    clashes: ownerConflicts(await getProjects()).find((c) => c.ownerId === userId) ?? null,
  };
}

export type CommentView = ProjectComment & {
  /** Penulis; `null` kalau akunnya sudah tidak ada. */
  user: User | null;
};

/** Komentar sebuah proyek, terlama dulu supaya terbaca sebagai percakapan. */
export async function getComments(projectId: number): Promise<CommentView[]> {
  const users = await getUsers();
  return store.comments
    .byProject(projectId)
    .map((c) => ({ ...c, user: users.find((u) => u.id === c.userId) ?? null }));
}

/** Tambah komentar. `null` kalau proyeknya tidak ada. */
export async function createComment(input: {
  projectId: number;
  userId: number;
  body: string;
}): Promise<ProjectComment | null> {
  if (!(await getProject(input.projectId))) return null;

  const sekarang = new Date().toISOString();
  return store.comments.insert({
    projectId: input.projectId,
    userId: input.userId,
    body: input.body,
    createdAt: sekarang.slice(0, 10),
    postedAt: `${sekarang.slice(0, 10)} ${sekarang.slice(11, 19)}`,
  });
}

export type AutoReminderRun = {
  /** Tanggal acuan yang dipakai saat menjalankan. */
  asOf: string;
  /** Jadwal yang jatuh tempo dan pengingatnya benar-benar dikirim. */
  sent: { scheduleId: number; projectId: number; projectName: string; nextAt: string }[];
  /** Jadwal jatuh tempo yang dilewati, berikut alasannya. */
  skipped: { scheduleId: number; projectId: number; reason: string }[];
};

/**
 * Jalankan pengingat terjadwal yang sudah jatuh tempo.
 *
 * Idempoten per hari: setelah jalan, `nextAt` dimajukan melewati hari ini, jadi
 * pemanggilan kedua di hari yang sama tidak mengirim ulang. Jadwal yang lama
 * terlewat juga hanya menghasilkan satu pengingat, bukan setumpuk tunggakan.
 *
 * ponytail: dipanggil cron/scheduler di produksi; sekarang lewat
 * POST /api/reminders/run supaya bisa diuji tanpa infrastruktur tambahan.
 */
export async function runDueReminders(today?: string): Promise<AutoReminderRun> {
  const asOf = today ?? new Date().toISOString().slice(0, 10);
  const hasil: AutoReminderRun = { asOf, sent: [], skipped: [] };

  for (const jadwal of store.schedules.all()) {
    if (!jadwal.isActive || !isDue(jadwal.nextAt, asOf)) continue;

    const project = await getProject(jadwal.projectId);
    if (!project) {
      hasil.skipped.push({
        scheduleId: jadwal.id,
        projectId: jadwal.projectId,
        reason: "Proyek sudah tidak ada.",
      });
      continue;
    }

    // Proyek selesai tidak perlu diingatkan lagi; jadwalnya sekalian dimatikan
    // supaya tidak terus jatuh tempo tiap kali runner jalan.
    if (!isActiveStatus(project.status)) {
      jadwal.isActive = false;
      hasil.skipped.push({
        scheduleId: jadwal.id,
        projectId: jadwal.projectId,
        reason: "Proyek sudah selesai, jadwal dimatikan.",
      });
      continue;
    }

    const frequency = jadwal.frequency as ReminderFrequency;
    await createReminder({
      projectId: jadwal.projectId,
      // Pengingat otomatis dikirim atas nama PIC sendiri — belum ada akun sistem.
      fromUserId: project.ownerId,
      message: autoReminderMessage(project.name, frequency),
      // Jejaknya bertanggal sesuai hari jalannya, bukan jam server saat dipanggil.
      onDate: asOf,
    });

    jadwal.nextAt = advancePast(jadwal.nextAt, frequency, asOf);
    jadwal.toUserId = project.ownerId;

    hasil.sent.push({
      scheduleId: jadwal.id,
      projectId: jadwal.projectId,
      projectName: project.name,
      nextAt: jadwal.nextAt,
    });
  }

  return hasil;
}

/**
 * Perbarui profil pengguna. `null` kalau id-nya tidak ada.
 * ponytail: fase database jadi UPDATE ke tabel users.
 */
export async function updateUser(
  id: number,
  input: { name: string; avatarUrl: string | null }
): Promise<User | null> {
  // Peran sengaja tidak ikut: itu urusan admin, bukan swalayan.
  return store.users.updateProfile(id, input.name, input.avatarUrl);
}

/**
 * Perbaiki nama dan email sebuah akun.
 *
 * Email adalah identitas login, jadi keunikannya diperiksa DI SINI, bukan
 * hanya di formulir: dua akun dengan email sama membuat byIdentity() memilih
 * salah satunya secara sewenang-wenang saat login.
 */
export async function updateUserIdentity(
  id: number,
  input: { name: string; email: string; avatarUrl?: string | null }
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const email = input.email.trim();

  if (await emailTerpakai(email, id)) {
    return { ok: false, error: "Email sudah dipakai akun lain." };
  }

  const user = store.users.updateIdentity(id, { ...input, email });
  return user === null ? { ok: false, error: "Akun tidak ditemukan." } : { ok: true, user };
}

export type NotificationFeed = {
  items: Notification[];
  counts: Record<NotificationSeverity, number>;
  /** Total yang perlu ditindaklanjuti, dipakai lencana di navigasi. */
  total: number;
};

/**
 * Notifikasi tindak lanjut, diturunkan dari keadaan proyek terkini.
 * ponytail: fase database tinggal ganti sumbernya jadi query, aturannya tetap.
 */
export async function getNotifications(): Promise<NotificationFeed> {
  const items = buildNotifications(await getProjects(), store.progress.all());
  return { items, counts: countBySeverity(items), total: items.length };
}

export type FilterOptions = {
  statuses: ProjectStatus[];
  priorities: ProjectPriority[];
  types: ProjectType[];
  /** Hanya anggota yang benar-benar punya proyek, berikut jumlahnya. */
  owners: { id: number; name: string; projects: number }[];
};

/** Pilihan yang sah untuk dropdown filter, supaya klien tidak menebak sendiri. */
export async function getFilterOptions(): Promise<FilterOptions> {
  const projects = await getProjects();
  const users = await getUsers();

  const jumlah = new Map<number, number>();
  for (const p of projects) jumlah.set(p.ownerId, (jumlah.get(p.ownerId) ?? 0) + 1);

  return {
    statuses: PROJECT_STATUSES,
    priorities: PROJECT_PRIORITIES,
    types: PROJECT_TYPES,
    owners: users
      .filter((u) => jumlah.has(u.id))
      .map((u) => ({ id: u.id, name: u.name, projects: jumlah.get(u.id)! }))
      .sort((a, b) => a.name.localeCompare(b.name, "id")),
  };
}


/* --- Kelola pengguna (Admin) ---------------------------------------------- */

export type UserInput = {
  name: string;
  email: string;
  role: string;
  accessLevel: AccessLevel;
};

/** Email sudah dipakai? Tanpa memandang huruf besar-kecil, sejalan dengan
    idx_users_email_lower di skema. `kecuali` untuk mengabaikan diri sendiri. */
export async function emailTerpakai(email: string, kecuali?: number): Promise<boolean> {
  const alamat = email.trim().toLowerCase();
  return store.users.emailTaken(alamat, kecuali);
}

/** Berapa admin yang masih aktif. Dipakai menjaga admin terakhir. */
export async function jumlahAdminAktif(): Promise<number> {
  return store.users.activeAdminCount();
}

export async function createUser(input: UserInput, passwordHash: string): Promise<User | null> {
  if (await emailTerpakai(input.email)) return null;

  return store.users.insert(
    {
      name: input.name.trim(),
      email: input.email.trim(),
      avatarUrl: null,
      role: input.role.trim(),
      accessLevel: input.accessLevel,
      isActive: true,
    },
    passwordHash
  );
}

export async function setUserAccessLevel(id: number, level: AccessLevel): Promise<User | null> {
  return store.users.setAccessLevel(id, level);
}

export async function setUserActive(id: number, aktif: boolean): Promise<User | null> {
  return store.users.setActive(id, aktif);
}

/** Ganti hash sandi. Hash disimpan di kolom users.password_hash. */
export async function setUserPassword(id: number, passwordHash: string): Promise<boolean> {
  return store.users.setPassword(id, passwordHash);
}

/* --- Agenda tim ------------------------------------------------------------ */

export type AgendaView = AgendaEntry & {
  /** Orang yang menjalani; `null` kalau akunnya sudah tidak ada. */
  user: User | null;
  /** Proyek terkait; `null` untuk agenda non-proyek atau proyek yang dihapus. */
  project: Project | null;
};

function lengkapiAgenda(entry: AgendaEntry, users: User[], projects: Project[]): AgendaView {
  return {
    ...entry,
    user: users.find((u) => u.id === entry.userId) ?? null,
    project: entry.projectId === null ? null : projects.find((p) => p.id === entry.projectId) ?? null,
  };
}

/**
 * Agenda, terurut dari yang paling awal. Rentang tanggalnya opsional; tanpa itu
 * seluruh agenda dikembalikan.
 */
export async function getAgenda(
  filter: { start?: string; end?: string; userId?: number } = {}
): Promise<AgendaView[]> {
  const users = await getUsers();
  const projects = await getProjects();

  return store.agenda
    .all()
    .filter((a) => {
      if (filter.userId !== undefined && a.userId !== filter.userId) return false;
      // Beririsan, bukan termuat seluruhnya: agenda yang mulai pekan lalu dan
      // berakhir pekan ini tetap harus terlihat di pekan ini.
      if (filter.end !== undefined && a.startDate > filter.end) return false;
      if (filter.start !== undefined && a.endDate < filter.start) return false;
      return true;
    })
    .map((a) => lengkapiAgenda(a, users, projects))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
}

export async function createAgenda(input: Omit<AgendaEntry, "id">): Promise<AgendaEntry> {
  return store.agenda.insert(input);
}

export async function updateAgenda(
  id: number,
  input: Omit<AgendaEntry, "id">
): Promise<AgendaEntry | null> {
  return store.agenda.update(id, input);
}

export async function getAgendaEntry(id: number): Promise<AgendaEntry | null> {
  return store.agenda.byId(id);
}

export async function deleteAgenda(id: number): Promise<boolean> {
  return store.agenda.remove(id);
}

export type AgendaMove = {
  id: number;
  /** Pemilik baru; sama dengan yang lama kalau agendanya tidak berpindah orang. */
  userId: number;
  startDate: string;
  endDate: string;
};

/**
 * Pindahkan beberapa agenda sekaligus.
 *
 * Menolak seluruh permintaan kalau ada satu id yang tidak dikenal — memindahkan
 * sebagian bar lalu melapor sukses akan meninggalkan bar terbelah dua tanggal.
 */
export async function moveAgendaEntries(
  perubahan: AgendaMove[]
): Promise<{ ok: true; jumlah: number } | { ok: false; error: string }> {
  for (const p of perubahan) {
    if (store.agenda.byId(p.id) === null) {
      return { ok: false, error: "Ada agenda yang sudah tidak ada." };
    }
  }
  return { ok: true, jumlah: store.agenda.moveMany(perubahan) };
}

/** Hapus beberapa agenda sekaligus; menolak seluruhnya kalau ada yang tidak ada. */
export async function deleteAgendaEntries(
  ids: number[]
): Promise<{ ok: true; jumlah: number } | { ok: false; error: string }> {
  for (const id of ids) {
    if (store.agenda.byId(id) === null) {
      return { ok: false, error: "Ada agenda yang sudah dihapus." };
    }
  }
  return { ok: true, jumlah: store.agenda.removeMany(ids) };
}


/* --- Rencana strategis ----------------------------------------------------- */

export type PlanView = StrategicPlan & {
  owner: User | null;
  /** Diturunkan dari langkah — tidak pernah disimpan; lihat lib/strategy.ts. */
  progress: PlanProgress;
  perluPerhatian: boolean;
  /** Berapa prospek yang sudah jadi klien. */
  prospekMenang: number;
  prospekTotal: number;
};

function lengkapiPlan(
  plan: StrategicPlan,
  steps: PlanStep[],
  prospects: PlanProspect[],
  users: User[],
  today?: string
): PlanView {
  const miliknya = steps.filter((s) => s.planId === plan.id);
  const prospekNya = prospects.filter((p) => p.planId === plan.id);

  return {
    ...plan,
    owner: users.find((u) => u.id === plan.ownerId) ?? null,
    progress: planProgress(miliknya, today),
    perluPerhatian: needsAttention(plan, miliknya, today),
    prospekMenang: prospectWins(prospekNya),
    prospekTotal: prospekNya.length,
  };
}

export type PlanFilter = {
  kind?: string;
  goal?: string;
  segment?: string;
  status?: string;
  ownerId?: number;
};

/** Seluruh rencana, sudah dilengkapi progres dan penanda perhatian. */
export async function getPlans(filter: PlanFilter = {}): Promise<PlanView[]> {
  const users = await getUsers();
  const steps = store.planSteps.all();
  const prospects = store.planProspects.all();

  return store.plans
    .all()
    .filter(
      (p) =>
        (filter.kind === undefined || p.kind === filter.kind) &&
        (filter.goal === undefined || p.goal === filter.goal) &&
        (filter.segment === undefined || p.segment === filter.segment) &&
        (filter.status === undefined || p.status === filter.status) &&
        (filter.ownerId === undefined || p.ownerId === filter.ownerId)
    )
    .map((p) => lengkapiPlan(p, steps, prospects, users));
}

export type PlanStepView = PlanStep & { owner: User | null };
export type PlanCommentView = PlanComment & { user: User | null };

export type PlanDetail = {
  plan: PlanView;
  steps: PlanStepView[];
  prospects: PlanProspect[];
  /** Proyek nyata yang lahir dari rencana ini. */
  projects: Project[];
  /** Proyek yang bisa dipilih; seluruhnya kecuali yang sudah tertaut. */
  projectCandidates: Project[];
  comments: PlanCommentView[];
};

export async function getPlanDetail(id: number): Promise<PlanDetail | null> {
  const plan = store.plans.byId(id);
  if (!plan) return null;

  const users = await getUsers();
  const projects = await getProjects();
  const steps = store.planSteps.byPlan(id);
  const prospects = store.planProspects.byPlan(id);
  const tertaut = store.planProjects.byPlan(id);

  return {
    plan: lengkapiPlan(plan, steps, prospects, users),
    steps: steps.map((s) => ({
      ...s,
      owner: s.ownerId === null ? null : users.find((u) => u.id === s.ownerId) ?? null,
    })),
    prospects,
    projects: projects.filter((p) => tertaut.includes(p.id)),
    projectCandidates: projects,
    comments: store.planComments
      .byPlan(id)
      .map((c) => ({ ...c, user: users.find((u) => u.id === c.userId) ?? null })),
  };
}

export async function createPlan(input: Omit<StrategicPlan, "id">): Promise<StrategicPlan> {
  return store.plans.insert(input);
}

export async function updatePlan(
  id: number,
  input: Omit<StrategicPlan, "id" | "createdBy">
): Promise<StrategicPlan | null> {
  return store.plans.update(id, input);
}

export async function deletePlan(id: number): Promise<boolean> {
  return store.plans.remove(id);
}

/** Langkah, prospek, kaitan proyek, dan komentarnya ikut terhapus lewat CASCADE. */
export async function getPlan(id: number): Promise<StrategicPlan | null> {
  return store.plans.byId(id);
}

export async function getPlanSteps(planId: number): Promise<PlanStep[]> {
  return store.planSteps.byPlan(planId);
}

export async function getPlanStep(id: number): Promise<PlanStep | null> {
  return store.planSteps.byId(id);
}

/** Nomor urut ditentukan di sini, bukan dikirim klien. */
export async function createPlanStep(
  planId: number,
  input: Omit<PlanStep, "id" | "planId" | "sortOrder">
): Promise<PlanStep | null> {
  if (store.plans.byId(planId) === null) return null;
  return store.planSteps.insert({
    ...input,
    planId,
    sortOrder: store.planSteps.nextSortOrder(planId),
  });
}

export async function updatePlanStep(
  id: number,
  input: Omit<PlanStep, "id" | "planId">
): Promise<PlanStep | null> {
  return store.planSteps.update(id, input);
}

export async function setPlanStepStatus(
  id: number,
  status: PlanStep["status"]
): Promise<PlanStep | null> {
  return store.planSteps.setStatus(id, status);
}

export async function deletePlanStep(id: number): Promise<boolean> {
  return store.planSteps.remove(id);
}

export async function getPlanProspects(planId: number): Promise<PlanProspect[]> {
  return store.planProspects.byPlan(planId);
}

export async function getPlanProspect(id: number): Promise<PlanProspect | null> {
  return store.planProspects.byId(id);
}

export async function createPlanProspect(
  input: Omit<PlanProspect, "id">
): Promise<PlanProspect | null> {
  if (store.plans.byId(input.planId) === null) return null;
  return store.planProspects.insert(input);
}

export async function updatePlanProspect(
  id: number,
  input: Omit<PlanProspect, "id" | "planId">
): Promise<PlanProspect | null> {
  return store.planProspects.update(id, input);
}

export async function deletePlanProspect(id: number): Promise<boolean> {
  return store.planProspects.remove(id);
}

/**
 * Tetapkan proyek mana saja yang lahir dari rencana ini, menggantikan daftar
 * lama. Proyek yang tidak ada diabaikan diam-diam? Tidak — ditolak, supaya
 * kaitan yang salah ketik tidak hilang tanpa jejak.
 */
export async function setPlanProjects(
  planId: number,
  projectIds: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (store.plans.byId(planId) === null) {
    return { ok: false, error: "Rencana tidak ditemukan." };
  }

  const diminta = [...new Set(projectIds)];
  const semua = await getProjects();
  for (const id of diminta) {
    if (!semua.some((p) => p.id === id)) {
      return { ok: false, error: "Ada proyek yang tidak ditemukan." };
    }
  }

  store.planProjects.replaceFor(planId, diminta);
  return { ok: true };
}

export async function createPlanComment(input: {
  planId: number;
  userId: number;
  body: string;
}): Promise<PlanComment | null> {
  if (store.plans.byId(input.planId) === null) return null;

  const sekarang = new Date().toISOString();
  return store.planComments.insert({
    planId: input.planId,
    userId: input.userId,
    body: input.body,
    createdAt: sekarang.slice(0, 10),
    postedAt: `${sekarang.slice(0, 10)} ${sekarang.slice(11, 19)}`,
  });
}

/** Jangkauan wilayah: yang sudah ada proyeknya vs yang baru jadi sasaran. */
export async function getCoverage(): Promise<Coverage[]> {
  return coverage(await getProjects(), store.plans.all(), store.planProspects.all());
}
