import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  isActiveStatus,
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
  type User,
} from "./types";
import { type ProjectFilter, filterProjects } from "./filters";
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
import {
  comments as mockComments,
  currentUser as mockCurrentUser,
  progressHistory as mockProgress,
  projectDependencies as mockDependencies,
  projectTypes as mockTypes,
  projects as mockProjects,
  reminderSchedules as mockSchedules,
  reminders as mockReminders,
  users as mockUsers,
} from "./mock-data";
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
 * Satu-satunya pintu data dashboard. Sekarang masih baca mock-data.
 * ponytail: fase backend tinggal ganti isi fungsi ini jadi query SQLite —
 * pemanggilnya (halaman + route handler) tidak perlu berubah.
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
  const skor = scoreAll(projects, mockDependencies);
  return projects.map((p) =>
    p.priorityMode === "auto" ? { ...p, priority: skor.get(p.id)!.level } : p
  );
}

/** Daftar proyek, opsional disaring. Tanpa argumen = seluruh proyek. */
export async function getProjects(filter?: Partial<ProjectFilter>): Promise<Project[]> {
  const semua = terapkanPrioritas(mockProjects);
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
  const skor = scoreAll(mockProjects, mockDependencies);
  const users = await getUsers();
  // Bentrok jadwal PIC bukan lagi penyumbang skor, hanya pemecah seri.
  const clash = ownerClashCounts(mockProjects);

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

  return {
    blocking: mockDependencies
      .filter((d) => d.blockerId === projectId)
      .map((d) => cari(d.blockedId))
      .filter((p): p is Project => p !== undefined),
    blockedBy: mockDependencies
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
  const lainnya = mockDependencies.filter((d) => d.blockerId !== blockerId);
  const calon: ProjectDependency[] = [];

  for (const id of diminta) {
    if (wouldCycle([...lainnya, ...calon], blockerId, id)) {
      return { ok: false, error: "melingkar", projectId: id };
    }
    calon.push({ blockerId, blockedId: id });
  }

  mockDependencies.length = 0;
  mockDependencies.push(...lainnya, ...calon);
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
    priority: scoreAll(mockProjects, mockDependencies).get(id)!,
    reminders: await getReminders(id),
    schedule: (await getSchedules(id))[0] ?? null,
    reminderStatus: await getReminderStatus(id),
    comments: await getComments(id),
    dependencies: await getDependencies(id),
    dependencyCandidates: projects.filter((p) => p.id !== id),
  };
}

/**
 * Simpan proyek baru. Sementara hanya menambah ke array mock-data, jadi isinya
 * hilang saat server dimulai ulang.
 * ponytail: fase database tinggal ganti jadi INSERT ke tabel projects.
 */
export async function createProject(input: Omit<Project, "id">): Promise<Project> {
  const id = mockProjects.reduce((max, p) => Math.max(max, p.id), 0) + 1;
  const project: Project = { ...input, id };
  mockProjects.push(project);
  return project;
}

/**
 * Perbarui proyek yang sudah ada. `null` kalau id-nya tidak ketemu.
 * ponytail: fase database tinggal ganti jadi UPDATE ke tabel projects.
 */
export async function updateProject(
  id: number,
  input: Omit<Project, "id">
): Promise<Project | null> {
  const index = mockProjects.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const project: Project = { ...input, id };
  mockProjects[index] = project;
  return project;
}

/** Riwayat progres satu proyek, terbaru dulu. */
export async function getProgressHistory(projectId: number): Promise<ProgressEntry[]> {
  return mockProgress
    .filter((e) => e.projectId === projectId)
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
  const index = mockProjects.findIndex((p) => p.id === input.projectId);
  if (index === -1) return null;

  const sekarang = new Date().toISOString();
  const hariIni = sekarang.slice(0, 10);
  const entry: ProgressEntry = {
    id: mockProgress.reduce((max, e) => Math.max(max, e.id), 0) + 1,
    projectId: input.projectId,
    userId: input.userId,
    progressPct: input.progressPct,
    note: input.note,
    createdAt: hariIni,
    recordedAt: `${hariIni} ${sekarang.slice(11, 19)}`,
  };

  mockProgress.push(entry);
  mockProjects[index] = {
    ...mockProjects[index],
    progressPct: input.progressPct,
    updatedAt: hariIni,
  };

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
  const index = mockProjects.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const project: Project = {
    ...mockProjects[index],
    status,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  mockProjects[index] = project;
  return project;
}

/**
 * Hapus proyek. `false` kalau id-nya tidak ketemu.
 * ponytail: fase database tinggal ganti jadi DELETE dari tabel projects.
 */
export async function deleteProject(id: number): Promise<boolean> {
  const index = mockProjects.findIndex((p) => p.id === id);
  if (index === -1) return false;

  mockProjects.splice(index, 1);
  return true;
}

export async function getUsers(): Promise<User[]> {
  return mockUsers;
}

export async function getCurrentUser(): Promise<User> {
  // `mockCurrentUser` hanya menandai SIAPA yang aktif; datanya dibaca ulang dari
  // daftar users. Mengembalikan referensi itu langsung membuat perubahan profil
  // tidak terlihat, karena updateUser mengganti isi slot array dengan objek baru.
  return mockUsers.find((u) => u.id === mockCurrentUser.id) ?? mockCurrentUser;
}

/** Angka-angka kartu ringkasan di dashboard utama. */
export async function getSummary(): Promise<ProjectSummary> {
  return projectSummary(await getProjects());
}

/** Rincian per jenis proyek untuk halaman kelola jenis. */
/** Keterangan seluruh jenis proyek, urut sesuai `sortOrder`. */
export async function getProjectTypes(): Promise<ProjectTypeInfo[]> {
  return [...mockTypes].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** Satu jenis berdasarkan kodenya. `null` kalau kodenya tidak dikenal. */
export async function getProjectType(code: string): Promise<ProjectTypeInfo | null> {
  return mockTypes.find((t) => t.code === code) ?? null;
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
  const index = mockTypes.findIndex((t) => t.code === code);
  if (index === -1) return null;

  const info: ProjectTypeInfo = { ...mockTypes[index], ...input };
  mockTypes[index] = info;
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

  return mockReminders
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id - a.id)
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
  const reminder: Reminder = {
    id: mockReminders.reduce((max, r) => Math.max(max, r.id), 0) + 1,
    projectId: input.projectId,
    // Pengingat selalu ditujukan ke PIC proyek saat ini.
    toUserId: project.ownerId,
    fromUserId: input.fromUserId,
    message: input.message,
    channel: "in-app",
    createdAt: tanggal,
    sentAt: `${tanggal} ${sekarang.slice(11, 19)}`,
  };

  mockReminders.push(reminder);
  return reminder;
}

/** Jadwal pengingat sebuah proyek, yang aktif lebih dulu. */
export async function getSchedules(projectId: number): Promise<ReminderSchedule[]> {
  return mockSchedules
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.nextAt.localeCompare(b.nextAt));
}

/**
 * Buat atau perbarui jadwal. Satu proyek cukup satu jadwal aktif — mengatur
 * ulang berarti menimpa yang lama, bukan menumpuk pengingat baru di atasnya.
 * ponytail: fase database jadi UPSERT ke tabel reminders.
 */
export async function saveSchedule(input: {
  projectId: number;
  frequency: ReminderFrequency;
  startDate: string;
}): Promise<ReminderSchedule | null> {
  const project = await getProject(input.projectId);
  if (!project) return null;

  const hariIni = new Date().toISOString().slice(0, 10);
  const index = mockSchedules.findIndex((s) => s.projectId === input.projectId);

  const jadwal: ReminderSchedule = {
    id: index === -1 ? mockSchedules.reduce((max, s) => Math.max(max, s.id), 0) + 1 : mockSchedules[index].id,
    projectId: input.projectId,
    toUserId: project.ownerId,
    frequency: input.frequency,
    nextAt: input.startDate,
    isActive: true,
    createdAt: index === -1 ? hariIni : mockSchedules[index].createdAt,
  };

  if (index === -1) mockSchedules.push(jadwal);
  else mockSchedules[index] = jadwal;

  return jadwal;
}

/** Hidupkan atau matikan jadwal tanpa menghapus setelannya. */
export async function setScheduleActive(
  projectId: number,
  isActive: boolean
): Promise<ReminderSchedule | null> {
  const index = mockSchedules.findIndex((s) => s.projectId === projectId);
  if (index === -1) return null;

  const lama = mockSchedules[index];
  // Dihidupkan lagi setelah lama mati: tanggalnya dimajukan supaya tidak
  // langsung mengirim pengingat untuk periode yang sudah lewat.
  const hariIni = new Date().toISOString().slice(0, 10);
  const nextAt = isActive
    ? advancePast(lama.nextAt, lama.frequency as ReminderFrequency, hariIni)
    : lama.nextAt;

  const jadwal: ReminderSchedule = { ...lama, isActive, nextAt };
  mockSchedules[index] = jadwal;
  return jadwal;
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
  const terkirim = mockReminders
    .filter((r) => r.projectId === projectId)
    .map((r) => r.createdAt)
    .sort();
  const jadwal = mockSchedules.find((s) => s.projectId === projectId) ?? null;
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
    contributions: mockProgress
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id - a.id),
    reminders: mockReminders
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
  return mockComments
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt) || a.id - b.id)
    .map((c) => ({ ...c, user: users.find((u) => u.id === c.userId) ?? null }));
}

/**
 * Tambah komentar. `null` kalau proyeknya tidak ada.
 * ponytail: fase database jadi INSERT ke tabel comments.
 */
export async function createComment(input: {
  projectId: number;
  userId: number;
  body: string;
}): Promise<ProjectComment | null> {
  if (!(await getProject(input.projectId))) return null;

  const sekarang = new Date().toISOString();
  const comment: ProjectComment = {
    id: mockComments.reduce((max, c) => Math.max(max, c.id), 0) + 1,
    projectId: input.projectId,
    userId: input.userId,
    body: input.body,
    createdAt: sekarang.slice(0, 10),
    postedAt: `${sekarang.slice(0, 10)} ${sekarang.slice(11, 19)}`,
  };

  mockComments.push(comment);
  return comment;
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

  for (const jadwal of mockSchedules) {
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
  const index = mockUsers.findIndex((u) => u.id === id);
  if (index === -1) return null;

  // Email dan peran sengaja tidak ikut: keduanya urusan admin, bukan swalayan.
  const user: User = { ...mockUsers[index], name: input.name, avatarUrl: input.avatarUrl };
  mockUsers[index] = user;
  return user;
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
  const items = buildNotifications(await getProjects(), mockProgress);
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
