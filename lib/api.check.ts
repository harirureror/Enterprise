/**
 * Cek mandiri pintu data: `npx tsx lib/api.check.ts`
 * Fokus ke perilaku gerbang (penyaringan, hitung ulang bentrok), bukan isi mock-data.
 */
import assert from "node:assert/strict";
import {
  addProgress,
  createProject,
  deleteAgendaEntries,
  moveAgendaEntries,
  createPlan,
  createPlanComment,
  createPlanProspect,
  createPlanStep,
  deletePlan,
  getCoverage,
  getPlan,
  getPlanDetail,
  getPlanProspects,
  getPlanSteps,
  getPlans,
  setPlanProjects,
  setPlanStepStatus,
  updatePlan,
  updatePlanProspect,
  deleteProject,
  getCurrentUser,
  getFilterOptions,
  getFocusProjects,
  getOverlapStats,
  getProgressHistory,
  getProject,
  getProjectDetail,
  getProjectType,
  getProjectTypes,
  createAgenda,
  createUser,
  deleteAgenda,
  emailTerpakai,
  getAgenda,
  getAgendaEntry,
  getDependencies,
  getProjects,
  jumlahAdminAktif,
  setUserAccessLevel,
  updateUserIdentity,
  setUserActive,
  setUserPassword,
  updateAgenda,
  getSummary,
  setDependencies,
  getTimeline,
  getUsers,
  updateProject,
  updateProjectType,
  updateUser,
} from "./api";
import { SEMUA } from "./filters";
import { openDb, pakaiDb } from "./db/index";
import { runMigrations } from "./db/migrate";
import { seed } from "./db/seed";
import * as store from "./db/store";
import { hashPassword } from "./password";
import { verifyCredentials } from "./auth";
import { scoreAll } from "./priority";
import { PROJECT_TYPES, isActiveStatus } from "./types";

/* Database sendiri di memori, diisi dari mock-data.

   Wajib: sejak lib/api.ts menulis ke SQLite, cek ini akan menyunting dan
   menghapus data kerja yang sesungguhnya kalau dibiarkan memakai
   data/dashboard.db. */
const dbUji = openDb(":memory:");
runMigrations(dbUji);
seed(dbUji, { force: true });
pakaiDb(dbUji);

// Dibungkus fungsi karena tsx mengompilasi berkas ini ke CJS — tidak ada top-level await.
async function main() {
  const semua = await getProjects();
  const users = await getUsers();
  assert.ok(semua.length > 0, "mock-data tidak boleh kosong");

  // Tanpa filter = seluruh proyek; filter "Semua" hasilnya sama.
  assert.equal((await getProjects({ status: SEMUA })).length, semua.length);

  // Filter diteruskan ke daftar proyek.
  const berjalan = await getProjects({ status: "Berjalan" });
  assert.ok(berjalan.every((p) => p.status === "Berjalan"));
  assert.ok(berjalan.length < semua.length);

  // Ringkasan dihitung dari seluruh proyek, bukan sebagian.
  const ringkasan = await getSummary();
  assert.equal(ringkasan.total, semua.length);
  assert.equal(ringkasan.byStatus.Berjalan, berjalan.length);

  // Nilai pipeline dan nilai selesai memilah proyek yang sama tanpa tumpang tindih.
  assert.equal(
    ringkasan.pipelineValue + ringkasan.completedValue,
    semua.reduce((sum, p) => sum + (p.value ?? 0), 0)
  );

  // Timeline tanpa filter memuat semua proyek dan daftar anggota.
  const penuh = await getTimeline();
  assert.equal(penuh.projects.length, semua.length);
  assert.equal(penuh.total, semua.length);
  assert.deepEqual(penuh.users, users);
  assert.ok(penuh.range !== null);
  // Tiap proyek punya entri hitungan bentrok, meski nol.
  assert.equal(Object.keys(penuh.overlapByProject).length, semua.length);

  // Timeline dengan filter: proyek menyusut, `total` tetap jumlah keseluruhan.
  const satuOrang = await getTimeline({ ownerId: semua[0].ownerId });
  assert.ok(satuOrang.projects.every((p) => p.ownerId === semua[0].ownerId));
  assert.equal(satuOrang.total, semua.length);
  assert.equal(Object.keys(satuOrang.overlapByProject).length, satuOrang.projects.length);

  // Bentrok dihitung ulang setelah disaring, jadi tidak boleh lebih banyak.
  assert.ok(satuOrang.overlapPairs <= penuh.overlapPairs);

  // Filter yang tidak cocok apa pun: aman, rentang kosong.
  const nihil = await getTimeline({ q: "proyek yang tidak pernah ada" });
  assert.deepEqual(nihil.projects, []);
  assert.equal(nihil.range, null);
  assert.equal(nihil.overlapPairs, 0);
  assert.deepEqual(nihil.perMonth, []);
  assert.equal(nihil.total, semua.length);

  // Statistik bentrok memakai saringan yang sama dan cocok dengan payload timeline.
  const stats = await getOverlapStats();
  assert.equal(stats.projects, semua.length);
  assert.equal(stats.pairs, penuh.overlapPairs);
  assert.equal(stats.pairs, penuh.overlaps.length);
  assert.deepEqual(stats.perMonth, penuh.perMonth);
  assert.deepEqual(stats.byOwner, penuh.ownerConflicts);
  assert.ok(stats.sameOwnerPairs <= stats.pairs);

  const statsSatuOrang = await getOverlapStats({ ownerId: semua[0].ownerId });
  assert.equal(statsSatuOrang.projects, satuOrang.projects.length);
  assert.equal(statsSatuOrang.pairs, satuOrang.overlapPairs);

  // Pilihan filter: hanya anggota yang punya proyek, dengan jumlah yang benar.
  const opsi = await getFilterOptions();
  assert.deepEqual(opsi.statuses, [
    "Prospect",
    "Penawaran",
    "Negosiasi",
    "Berjalan",
    "Tertunda",
    "Selesai",
  ]);
  assert.deepEqual(opsi.priorities, ["Tinggi", "Sedang", "Rendah"]);
  assert.deepEqual(opsi.types, ["Penjualan", "Jasa", "Training", "Riset"]);
  assert.ok(opsi.owners.length > 0);
  assert.ok(opsi.owners.length <= users.length);
  assert.equal(
    opsi.owners.reduce((sum, o) => sum + o.projects, 0),
    semua.length
  );
  assert.ok(opsi.owners.every((o) => o.projects > 0));
  // Urut menurut nama, supaya dropdown tidak berubah-ubah urutannya.
  assert.deepEqual(
    opsi.owners.map((o) => o.name),
    [...opsi.owners.map((o) => o.name)].sort((a, b) => a.localeCompare(b, "id"))
  );

  /* Riwayat progres: hanya milik proyek yang diminta, terbaru dulu.

     Proyeknya diambil dari riwayat yang benar-benar ada, bukan id tetap, dan
     seluruh blok dilewati kalau riwayatnya memang kosong — mock-data adalah
     data kerja yang boleh saja belum punya catatan progres sama sekali.
     Yang diuji di sini kontrak fungsinya, bukan isi datanya. */
  const idRiwayat = store.progress.all()[0]?.projectId;
  if (idRiwayat !== undefined) {
    const riwayat = await getProgressHistory(idRiwayat);
    assert.ok(riwayat.length > 0);
    assert.ok(riwayat.every((e) => e.projectId === idRiwayat));
    assert.deepEqual(
      riwayat.map((e) => e.createdAt),
      [...riwayat.map((e) => e.createdAt)].sort().reverse()
    );
  }

  // Proyek tanpa riwayat mengembalikan daftar kosong, bukan error.
  const tanpaRiwayat = await getProgressHistory(3);
  assert.deepEqual(tanpaRiwayat, []);

  // Mencatat progres menambah satu baris riwayat sekaligus memperbarui proyeknya.
  // Blok ini membuat datanya sendiri, jadi tidak bergantung pada isi mock-data.
  const sebelum = (await getProgressHistory(1)).length;
  const statusSemula = (await getProject(1))!.status;
  const entri = await addProgress({ projectId: 1, userId: 2, progressPct: 72, note: "Uji catat." });
  assert.ok(entri !== null);
  assert.equal(entri.projectId, 1);
  assert.equal(entri.userId, 2);
  assert.equal(entri.progressPct, 72);
  assert.match(entri.createdAt, /^\d{4}-\d{2}-\d{2}$/);

  const sesudah = await getProgressHistory(1);
  assert.equal(sesudah.length, sebelum + 1);
  assert.equal(sesudah[0].id, entri.id); // entri terbaru di urutan pertama
  assert.equal((await getProject(1))!.progressPct, 72);
  // Status tidak ikut berubah hanya karena progres diperbarui.
  assert.equal((await getProject(1))!.status, statusSemula);

  // Proyek yang tidak ada tidak bisa dicatat progresnya.
  assert.equal(await addProgress({ projectId: 999, userId: 1, progressPct: 10, note: "x" }), null);

  // Detail proyek: riwayat ikut, dengan nama pencatat dan selisih antar catatan.
  const detail = (await getProjectDetail(1))!;
  assert.equal(detail.project.id, 1);
  assert.equal(detail.owner?.id, detail.project.ownerId);
  assert.equal(detail.history.length, sesudah.length);
  assert.ok(detail.history.every((e) => e.user !== null));
  // Catatan paling awal tidak punya pembanding.
  assert.equal(detail.history.at(-1)!.delta, null);
  // Selisih dihitung terhadap catatan sebelumnya, bukan terhadap nol.
  for (let i = 0; i < detail.history.length - 1; i++) {
    assert.equal(
      detail.history[i].delta,
      detail.history[i].progressPct - detail.history[i + 1].progressPct
    );
  }

  // Proyek tanpa riwayat tetap punya detail, hanya riwayatnya kosong.
  assert.deepEqual((await getProjectDetail(3))!.history, []);
  assert.equal(await getProjectDetail(999), null);

  // Prioritas otomatis: proyek "auto" ikut hasil hitungan, "manual" tidak ditimpa.
  // Ketergantungan ikut disertakan: gerbangnya menghitung dengan konteks yang
  // sama, jadi menghilangkannya di sini akan membandingkan dua model berbeda.
  const skor = scoreAll(store.projects.all(), store.dependencies.all());
  for (const p of semua) {
    const tersimpan = store.projects.byId(p.id)!;
    if (p.priorityMode === "auto") {
      assert.equal(p.priority, skor.get(p.id)!.level, `proyek ${p.id} harus ikut skor`);
    } else {
      assert.equal(p.priority, tersimpan.priority, `proyek ${p.id} dikunci, jangan ditimpa`);
    }
  }
  /* Cabang "manual" dibuat sendiri, bukan diharapkan sudah ada di mock-data:
     data kerja boleh saja seluruhnya otomatis, dan cabang ini tetap harus
     teruji. Nilai aslinya dikembalikan supaya assertion berikutnya tidak
     mewarisi keadaan yang sudah diubah. */
  const dikunci = store.projects.all()[0];
  const modeAsli = dikunci.priorityMode;
  const prioritasAsli = dikunci.priority;

  const setMode = (mode: string, prioritas: string) =>
    store.projects.patch(
      dikunci.id,
      { priority_mode: mode, priority: prioritas },
      dikunci.updatedAt
    );

  setMode("manual", dikunci.priority);
  // Dikunci ke level yang berbeda dari hasil hitungan, supaya "tidak ditimpa"
  // benar-benar terlihat bedanya.
  const hitung = skor.get(dikunci.id)!.level;
  const terkunci = hitung === "Tinggi" ? "Rendah" : "Tinggi";
  setMode("manual", terkunci);

  assert.equal((await getProject(dikunci.id))!.priority, terkunci);
  assert.notEqual(terkunci, hitung, "penguncian harus diuji pada level yang berbeda");
  assert.equal(
    (await getProjects()).find((p) => p.id === dikunci.id)!.priority,
    terkunci,
    "kunci manual harus bertahan di daftar, bukan cuma saat diambil satuan"
  );

  // Kembali ke otomatis: sekarang justru harus ikut hasil hitungan.
  setMode("auto", terkunci);
  assert.equal((await getProject(dikunci.id))!.priority, hitung);

  setMode(modeAsli, prioritasAsli);

  // Fokus diurutkan dari skor tertinggi dan tidak memuat proyek selesai.
  const fokus = await getFocusProjects(5);
  assert.ok(fokus.length > 0 && fokus.length <= 5);
  assert.ok(fokus.every((f) => isActiveStatus(f.project.status)));
  assert.deepEqual(
    fokus.map((f) => f.score.score),
    [...fokus.map((f) => f.score.score)].sort((a, b) => b - a)
  );
  // Tiap entri membawa alasan, jadi urutannya bisa dijelaskan.
  assert.ok(fokus.every((f) => f.score.factors.length > 0));
  assert.equal((await getFocusProjects(2)).length, 2);

  // Detail proyek ikut membawa skor prioritasnya.
  const detailSkor = (await getProjectDetail(semua[0].id))!;
  assert.equal(detailSkor.priority.score, skor.get(semua[0].id)!.score);

  // CRUD lengkap: buat, ubah, hapus. Dikerjakan pada proyek buatan sendiri
  // supaya tidak merusak data yang dipakai assertion di atas.
  const contoh = semua[0];
  const dibuat = await createProject({
    ...contoh,
    name: "Proyek Uji CRUD",
    clientOrg: "PT Uji CRUD",
  });
  assert.ok(dibuat.id > contoh.id, "id baru harus lebih besar dari yang ada");
  assert.equal((await getProject(dibuat.id))!.name, "Proyek Uji CRUD");
  assert.equal((await getProjects()).length, semua.length + 1);

  const diubah = await updateProject(dibuat.id, {
    ...contoh,
    name: "Proyek Uji CRUD (diubah)",
    priorityMode: "manual",
    priority: "Rendah",
  });
  assert.equal(diubah!.id, dibuat.id, "id tidak boleh berubah saat update");
  assert.equal((await getProject(dibuat.id))!.name, "Proyek Uji CRUD (diubah)");
  // Dikunci manual, jadi prioritasnya tidak ditimpa hasil hitungan.
  assert.equal((await getProject(dibuat.id))!.priority, "Rendah");

  // Mengubah proyek yang tidak ada bukan berarti membuat yang baru.
  assert.equal(await updateProject(999, { ...contoh }), null);
  assert.equal((await getProjects()).length, semua.length + 1);

  assert.equal(await deleteProject(dibuat.id), true);
  assert.equal(await getProject(dibuat.id), null);
  assert.equal((await getProjects()).length, semua.length);
  // Menghapus dua kali tidak error, cuma mengembalikan false.
  assert.equal(await deleteProject(dibuat.id), false);
  assert.equal(await deleteProject(999), false);

  // Jenis proyek: keempatnya selalu ada dan urut sesuai sortOrder.
  const jenis = await getProjectTypes();
  assert.deepEqual(jenis.map((t) => t.code), PROJECT_TYPES);
  assert.deepEqual(
    jenis.map((t) => t.sortOrder),
    [...jenis.map((t) => t.sortOrder)].sort((a, b) => a - b)
  );
  assert.ok(jenis.every((t) => t.label !== ""));
  assert.equal((await getProjectType("Jasa"))!.code, "Jasa");
  assert.equal(await getProjectType("Konsultasi"), null);

  // Label dan urutan bisa diubah; kodenya tidak ikut berubah.
  const semulaJenis = (await getProjectType("Riset"))!;
  const diubahJenis = await updateProjectType("Riset", {
    label: "Riset & Pengembangan",
    description: "Kajian internal.",
    sortOrder: 0,
  });
  assert.equal(diubahJenis!.code, "Riset", "kode jenis tidak boleh ikut berubah");
  assert.equal(diubahJenis!.label, "Riset & Pengembangan");
  // Urutan baru langsung terpakai: Riset naik dari posisi terakhir.
  const posisiAwal = jenis.findIndex((t) => t.code === "Riset");
  const posisiBaru = (await getProjectTypes()).findIndex((t) => t.code === "Riset");
  assert.ok(posisiBaru < posisiAwal, "Riset harus naik setelah sortOrder-nya dikecilkan");
  // sortOrder kembar dipecah lewat kode, jadi urutannya tetap sama tiap dibaca.
  assert.deepEqual(await getProjectTypes(), await getProjectTypes());
  await updateProjectType("Riset", {
    label: semulaJenis.label,
    description: semulaJenis.description,
    sortOrder: semulaJenis.sortOrder,
  });
  assert.deepEqual((await getProjectTypes()).map((t) => t.code), PROJECT_TYPES);

  // Kode asing tidak bisa dibuat lewat pintu ini.
  assert.equal(
    await updateProjectType("Konsultasi", { label: "x", description: "", sortOrder: 0 }),
    null
  );

  // Perubahan profil harus terlihat lewat getCurrentUser. Dulu tidak:
  // mock-data.currentUser memegang referensi ke objek lama, sedangkan
  // updateUser mengganti isi slot arraynya.
  const akuSemula = await getCurrentUser();
  const namaSemula = akuSemula.name;
  await updateUser(akuSemula.id, { name: "Nama Sesudah Ubah", avatarUrl: null });
  assert.equal((await getCurrentUser()).name, "Nama Sesudah Ubah");
  // Ikut terlihat di daftar anggota, bukan cuma di pengguna aktif.
  assert.equal((await getUsers()).find((u) => u.id === akuSemula.id)!.name, "Nama Sesudah Ubah");
  await updateUser(akuSemula.id, { name: namaSemula, avatarUrl: akuSemula.avatarUrl });
  assert.equal((await getCurrentUser()).name, namaSemula);

  /* --- Ketergantungan antar proyek ---------------------------------------- */

  const relasiSemula = store.dependencies.all();
  // Mulai dari nol supaya yang diuji perilaku gerbangnya, bukan isi data awal.
  for (const id of new Set(relasiSemula.map((d) => d.blockerId))) {
    store.dependencies.replaceFor(id, []);
  }
  const [a, b, c] = (await getProjects()).map((p) => p.id);

  // Menetapkan daftar mengganti relasi lama, bukan menumpuknya.
  assert.deepEqual(await setDependencies(a, [b, c]), { ok: true });
  assert.deepEqual((await getDependencies(a)).blocking.map((p) => p.id).sort(), [b, c].sort());
  assert.deepEqual(await setDependencies(a, [b]), { ok: true });
  assert.deepEqual((await getDependencies(a)).blocking.map((p) => p.id), [b]);

  // Arah relasinya terbaca dari kedua sisi.
  assert.deepEqual((await getDependencies(b)).blockedBy.map((p) => p.id), [a]);
  assert.deepEqual((await getDependencies(b)).blocking, []);

  // Daftar kosong berarti melepas semua relasi milik proyek itu.
  assert.deepEqual(await setDependencies(a, []), { ok: true });
  assert.deepEqual((await getDependencies(a)).blocking, []);
  assert.deepEqual((await getDependencies(b)).blockedBy, []);

  // Menahan diri sendiri, proyek yang tidak ada, dan relasi melingkar ditolak
  // — dan penolakan tidak boleh menyisakan perubahan separuh jalan.
  assert.equal((await setDependencies(a, [a])).ok, false);
  assert.equal((await setDependencies(a, [999_999])).ok, false);
  assert.equal((await setDependencies(999_999, [b])).ok, false);

  await setDependencies(a, [b]);
  const melingkar = await setDependencies(b, [a]);
  assert.equal(melingkar.ok, false);
  assert.equal(melingkar.ok === false && melingkar.error, "melingkar");
  assert.deepEqual((await getDependencies(b)).blocking, []);

  // Id kembar dianggap satu relasi, bukan dua.
  assert.deepEqual(await setDependencies(a, [b, b, c]), { ok: true });
  assert.equal((await getDependencies(a)).blocking.length, 2);

  // Ketergantungan ikut menggeser skor: proyek yang menahan dua proyek lain
  // naik dibanding saat ia mandiri.
  const menahan = (await getProjectDetail(a))!.priority.score;
  await setDependencies(a, []);
  const mandiri = (await getProjectDetail(a))!.priority.score;
  assert.ok(menahan > mandiri, "menahan proyek lain harus menaikkan skor");

  // Kandidat pilihan tidak pernah memuat proyek itu sendiri.
  const detailRelasi = (await getProjectDetail(a))!;
  assert.ok(detailRelasi.dependencyCandidates.every((p) => p.id !== a));

  // Kembalikan relasi awal supaya urutan pemeriksaan tidak saling mengotori.
  for (const id of new Set(relasiSemula.map((d) => d.blockerId))) {
    store.dependencies.replaceFor(
      id,
      relasiSemula.filter((d) => d.blockerId === id).map((d) => d.blockedId)
    );
  }

  /* --- Kelola pengguna ------------------------------------------------------ */

  const penggunaSemula = (await getUsers()).length;

  // Email kembar ditolak, tanpa memandang huruf besar-kecil — kalau lolos, dua
  // baris akan mewakili satu identitas login.
  const akunAdmin = (await getUsers())[0];
  assert.equal(await emailTerpakai(akunAdmin.email), true);
  assert.equal(await emailTerpakai(akunAdmin.email.toUpperCase()), true);
  assert.equal(await emailTerpakai("  " + akunAdmin.email + "  "), true);
  assert.equal(await emailTerpakai("belumada@uji.co.id"), false);
  // Mengabaikan diri sendiri, untuk kasus menyunting akun yang sudah ada.
  assert.equal(await emailTerpakai(akunAdmin.email, akunAdmin.id), false);

  const baru = await createUser(
    { name: "Dewi Uji", email: "dewi.uji@jayasurvey.id", role: "Surveyor", accessLevel: "Anggota" },
    "scrypt$16384$8$1$aa$bb"
  );
  assert.ok(baru);
  assert.equal(baru.isActive, true);
  assert.equal(baru.accessLevel, "Anggota");
  assert.equal((await getUsers()).length, penggunaSemula + 1);

  // Email yang sama ditolak walau kapitalisasinya berbeda.
  assert.equal(
    await createUser(
      { name: "Kembar", email: "DEWI.UJI@jayasurvey.id", role: "", accessLevel: "Anggota" },
      "scrypt$16384$8$1$aa$bb"
    ),
    null
  );
  assert.equal((await getUsers()).length, penggunaSemula + 1);

  // Akun baru langsung bisa masuk dengan sandi yang diberikan admin.
  await setUserPassword(baru.id, hashPassword("sandiAwalUji"));
  assert.ok(await verifyCredentials(baru.email, "sandiAwalUji"));
  assert.equal(await verifyCredentials(baru.email, "salah"), null);

  // Dinonaktifkan: sandinya masih benar, tapi tetap ditolak — dan pesannya
  // seragam supaya tidak bocor akun mana yang dinonaktifkan.
  await setUserActive(baru.id, false);
  assert.equal(await verifyCredentials(baru.email, "sandiAwalUji"), null);
  // Hilang dari daftar aktif, tapi tetap ada di daftar penuh: namanya masih
  // melekat di proyek dan komentar yang pernah dia buat.
  assert.equal((await getUsers({ activeOnly: true })).some((u) => u.id === baru.id), false);
  assert.equal((await getUsers()).some((u) => u.id === baru.id), true);

  // Diaktifkan lagi: bisa masuk kembali tanpa perlu sandi baru.
  await setUserActive(baru.id, true);
  assert.ok(await verifyCredentials(baru.email, "sandiAwalUji"));

  // Tingkat akses bisa dinaikkan dan diturunkan.
  assert.equal((await setUserAccessLevel(baru.id, "Manager"))!.accessLevel, "Manager");
  assert.equal((await getUsers()).find((u) => u.id === baru.id)!.accessLevel, "Manager");
  await setUserAccessLevel(baru.id, "Anggota");

  /* --- Perbaikan identitas (nama & email) ---------------------------------- */

  // Salah ketik nama dan email diperbaiki sekaligus.
  const perbaikan = await updateUserIdentity(baru.id, {
    name: "Nama Diperbaiki",
    email: "diperbaiki@uji.co.id",
  });
  assert.equal(perbaikan.ok, true);
  const sesudahPerbaikan = (await getUsers()).find((u) => u.id === baru.id)!;
  assert.equal(sesudahPerbaikan.name, "Nama Diperbaiki");
  assert.equal(sesudahPerbaikan.email, "diperbaiki@uji.co.id");

  // Menyimpan tanpa mengganti email tidak boleh dianggap bentrok dengan diri
  // sendiri — inilah yang membedakan emailTerpakai(x) dari emailTerpakai(x, id).
  const tanpaGanti = await updateUserIdentity(baru.id, {
    name: "Nama Diperbaiki Lagi",
    email: "diperbaiki@uji.co.id",
  });
  assert.equal(tanpaGanti.ok, true);

  // Email milik akun lain ditolak, tanpa memandang kapitalisasi.
  const bentrok = await updateUserIdentity(baru.id, {
    name: "Nama Diperbaiki Lagi",
    email: akunAdmin.email.toUpperCase(),
  });
  assert.equal(bentrok.ok, false);
  // Dan penolakan itu tidak boleh menyisakan perubahan separuh jalan.
  assert.equal((await getUsers()).find((u) => u.id === baru.id)!.email, "diperbaiki@uji.co.id");

  // Spasi pinggir dirapikan sebelum disimpan.
  assert.equal(
    (await updateUserIdentity(baru.id, { name: "Rapi", email: "  rapi@uji.co.id  " })).ok,
    true
  );
  assert.equal((await getUsers()).find((u) => u.id === baru.id)!.email, "rapi@uji.co.id");

  // Foto opsional: tidak dikirim berarti tidak diubah.
  const fotoSemula = (await getUsers()).find((u) => u.id === baru.id)!.avatarUrl;
  await updateUserIdentity(baru.id, { name: "Rapi", email: "rapi@uji.co.id" });
  assert.equal((await getUsers()).find((u) => u.id === baru.id)!.avatarUrl, fotoSemula);

  // Akun yang tidak ada ditolak, bukan diam-diam membuat baris baru.
  const hantu = await updateUserIdentity(999_999, { name: "Hantu", email: "hantu@uji.co.id" });
  assert.equal(hantu.ok, false);

  // Akun yang tidak ada tidak bisa agendaDiubah diam-diam.
  assert.equal(await setUserAccessLevel(999_999, "Admin"), null);
  assert.equal(await setUserActive(999_999, false), null);
  assert.equal(await setUserPassword(999_999, "x"), false);

  // Hitungan admin aktif dipakai menjaga admin terakhir.
  const adminSemula = await jumlahAdminAktif();
  assert.ok(adminSemula >= 1, "harus selalu ada admin aktif");
  await setUserAccessLevel(baru.id, "Admin");
  assert.equal(await jumlahAdminAktif(), adminSemula + 1);
  // Dinonaktifkan berarti tidak lagi dihitung sebagai admin aktif.
  await setUserActive(baru.id, false);
  assert.equal(await jumlahAdminAktif(), adminSemula);
  await setUserActive(baru.id, true);
  await setUserAccessLevel(baru.id, "Anggota");

  /* --- Agenda --------------------------------------------------------------- */

  const agendaSemula = (await getAgenda()).length;
  const proyekAgenda = (await getProjects())[0];

  const agendaUji = await createAgenda({
    userId: baru.id,
    projectId: proyekAgenda.id,
    kind: "Lapangan",
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    locationCity: "Muara Enim",
    locationProvince: "Sumatera Selatan",
    note: "Uji agenda.",
    createdBy: akunAdmin.id,
    updatedAt: "2026-09-01",
  });
  assert.ok(agendaUji.id > 0);
  assert.equal((await getAgenda()).length, agendaSemula + 1);

  // Dilengkapi nama orang dan proyeknya — berkas dan layar dibaca manusia.
  const terlihat = (await getAgenda()).find((a) => a.id === agendaUji.id)!;
  assert.equal(terlihat.user?.id, baru.id);
  assert.equal(terlihat.project?.id, proyekAgenda.id);
  // createdBy berbeda dari userId: Manager mengisikan untuk anggotanya.
  assert.equal(terlihat.createdBy, akunAdmin.id);
  assert.notEqual(terlihat.createdBy, terlihat.userId);

  // Penyaringan rentang memakai irisan, bukan termuat seluruhnya.
  assert.equal((await getAgenda({ start: "2026-09-03", end: "2026-09-10" })).some((a) => a.id === agendaUji.id), true);
  assert.equal((await getAgenda({ start: "2026-08-01", end: "2026-09-01" })).some((a) => a.id === agendaUji.id), true);
  assert.equal((await getAgenda({ start: "2026-09-04", end: "2026-09-10" })).some((a) => a.id === agendaUji.id), false);
  // Penyaringan per orang.
  assert.ok((await getAgenda({ userId: baru.id })).every((a) => a.userId === baru.id));

  // Terurut dari yang paling awal.
  const urut = (await getAgenda()).map((a) => a.startDate);
  assert.deepEqual(urut, [...urut].sort());

  // Perbarui.
  const agendaDiubah = await updateAgenda(agendaUji.id, {
    ...agendaUji,
    kind: "Cuti",
    projectId: null,
    locationCity: "",
    locationProvince: "",
  });
  assert.equal(agendaDiubah!.kind, "Cuti");
  assert.equal(agendaDiubah!.projectId, null);
  assert.equal((await getAgendaEntry(agendaUji.id))!.kind, "Cuti");
  assert.equal(await updateAgenda(999_999, { ...agendaUji }), null);

  // Hapus.
  assert.equal(await deleteAgenda(agendaUji.id), true);
  assert.equal(await deleteAgenda(agendaUji.id), false); // klik ganda tidak melapor sukses palsu
  assert.equal(await getAgendaEntry(agendaUji.id), null);
  assert.equal((await getAgenda()).length, agendaSemula);

  /* --- Pindah dan hapus massal (papan seret-lepas) --------------------------- */

  const bikinAgenda = (startDate: string, endDate: string) =>
    createAgenda({
      userId: baru.id,
      projectId: proyekAgenda.id,
      kind: "Lapangan",
      startDate,
      endDate,
      locationCity: "Muara Enim",
      locationProvince: "Sumatera Selatan",
      note: "",
      createdBy: akunAdmin.id,
      updatedAt: "2026-09-01",
    });

  // Tiga entri berdampingan — di layar inilah yang menyatu jadi satu bar.
  const s1 = await bikinAgenda("2026-09-01", "2026-09-02");
  const s2 = await bikinAgenda("2026-09-03", "2026-09-03");
  const s3 = await bikinAgenda("2026-09-04", "2026-09-05");
  const trio = [s1.id, s2.id, s3.id];

  // Menggeser bar menggerakkan seluruh isinya sejauh hari yang sama, dan lama
  // tiap entri tidak berubah.
  const geser = await moveAgendaEntries(
    trio.map((id, i) => ({
      id,
      userId: baru.id,
      startDate: [`2026-09-03`, `2026-09-05`, `2026-09-06`][i],
      endDate: [`2026-09-04`, `2026-09-05`, `2026-09-07`][i],
    }))
  );
  assert.equal(geser.ok, true);
  assert.equal((await getAgendaEntry(s1.id))!.startDate, "2026-09-03");
  assert.equal((await getAgendaEntry(s1.id))!.endDate, "2026-09-04");
  assert.equal((await getAgendaEntry(s3.id))!.startDate, "2026-09-06");

  // Pemilik ikut berpindah kalau diminta.
  assert.equal(
    (
      await moveAgendaEntries([
        { id: s2.id, userId: akunAdmin.id, startDate: "2026-09-05", endDate: "2026-09-05" },
      ])
    ).ok,
    true
  );
  assert.equal((await getAgendaEntry(s2.id))!.userId, akunAdmin.id);
  // Dikembalikan supaya sisa cek tetap berpijak pada keadaan yang sama.
  await moveAgendaEntries([
    { id: s2.id, userId: baru.id, startDate: "2026-09-05", endDate: "2026-09-05" },
  ]);

  // Satu id tidak dikenal membatalkan SELURUH pemindahan — bukan memindahkan
  // sebagian lalu melapor gagal, yang akan meninggalkan bar terbelah dua tanggal.
  const sebelumGagal = (await getAgendaEntry(s1.id))!.startDate;
  const gagalGeser = await moveAgendaEntries([
    { id: s1.id, userId: baru.id, startDate: "2026-10-01", endDate: "2026-10-02" },
    { id: 999_999, userId: baru.id, startDate: "2026-10-01", endDate: "2026-10-02" },
  ]);
  assert.equal(gagalGeser.ok, false);
  assert.equal((await getAgendaEntry(s1.id))!.startDate, sebelumGagal, "atomik: tidak ada yang bergeser");

  // Daftar kosong bukan kesalahan, tapi juga tidak mengubah apa pun.
  assert.deepEqual(await moveAgendaEntries([]), { ok: true, jumlah: 0 });

  // Hapus massal: satu id tidak dikenal membatalkan seluruh batch.
  const sebelumHapus = (await getAgenda()).length;
  const gagalHapus = await deleteAgendaEntries([s1.id, 999_999]);
  assert.equal(gagalHapus.ok, false);
  assert.equal((await getAgenda()).length, sebelumHapus, "atomik: tidak ada yang terhapus");
  assert.ok(await getAgendaEntry(s1.id));

  // Yang sah menghapus semuanya sekaligus.
  const hapusTrio = await deleteAgendaEntries(trio);
  assert.deepEqual(hapusTrio, { ok: true, jumlah: 3 });
  assert.equal((await getAgenda()).length, sebelumHapus - 3);
  for (const id of trio) assert.equal(await getAgendaEntry(id), null);

  assert.deepEqual(await deleteAgendaEntries([]), { ok: true, jumlah: 0 });

  /* --- Rencana strategis ----------------------------------------------------- */

  const rencanaSemula = (await getPlans()).length;
  assert.ok(rencanaSemula > 0, "data awal harus memuat rencana contoh");

  // Bikin rencana baru; progres rencana tanpa langkah adalah 0, bukan NaN.
  const rencanaUji = await createPlan({
    title: "Uji rencana API",
    summary: "",
    kind: "Kemitraan",
    goal: "Kapasitas Internal",
    segment: "Energi",
    region: "Riau",
    partner: "Mitra Uji",
    status: "Ide",
    priority: "Sedang",
    ownerId: users[0].id,
    startDate: null,
    targetDate: null,
    outcome: "",
    createdBy: users[0].id,
    updatedAt: "2026-09-01",
  });
  assert.equal((await getPlans()).length, rencanaSemula + 1);

  const kosong = (await getPlans()).find((p) => p.id === rencanaUji.id)!;
  assert.equal(kosong.progress.total, 0);
  assert.equal(kosong.progress.pct, 0);
  assert.equal(kosong.owner!.id, users[0].id, "PIC dilengkapi jadi objek, bukan id saja");

  // Saringan diteruskan ke daftar.
  assert.ok((await getPlans({ goal: "Kapasitas Internal" })).every((p) => p.goal === "Kapasitas Internal"));
  assert.equal((await getPlans({ segment: "Energi" })).some((p) => p.id === rencanaUji.id), true);
  assert.equal((await getPlans({ segment: "Perkebunan" })).some((p) => p.id === rencanaUji.id), false);

  // Langkah: nomor urut ditentukan server, bukan dikirim klien.
  const langkah1 = (await createPlanStep(rencanaUji.id, {
    title: "Langkah pertama",
    ownerId: users[0].id,
    targetDate: "2026-10-01",
    status: "Belum",
    note: "",
  }))!;
  const langkah2 = (await createPlanStep(rencanaUji.id, {
    title: "Langkah kedua",
    ownerId: null,
    targetDate: null,
    status: "Belum",
    note: "",
  }))!;
  assert.equal(langkah1.sortOrder, 0);
  assert.equal(langkah2.sortOrder, 1, "nomor urut menaik walau tanggalnya kosong");
  assert.equal(await createPlanStep(999_999, {
    title: "Rencana hantu",
    ownerId: null,
    targetDate: null,
    status: "Belum",
    note: "",
  }), null, "langkah tanpa rencana induk ditolak");

  // Progres benar-benar diturunkan dari langkah — tidak ada angka yang disimpan.
  await setPlanStepStatus(langkah1.id, "Selesai");
  const separuh = (await getPlans()).find((p) => p.id === rencanaUji.id)!;
  assert.equal(separuh.progress.total, 2);
  assert.equal(separuh.progress.selesai, 1);
  assert.equal(separuh.progress.pct, 50);

  // Langkah yang dibatalkan hilang dari penyebut, bukan dihitung gagal.
  await setPlanStepStatus(langkah2.id, "Batal");
  const tanpaBatal = (await getPlans()).find((p) => p.id === rencanaUji.id)!;
  assert.equal(tanpaBatal.progress.total, 1);
  assert.equal(tanpaBatal.progress.pct, 100);

  // Prospek ikut terhitung di ringkasan rencana.
  const prospekUji = (await createPlanProspect({
    planId: rencanaUji.id,
    name: "PT Uji Prospek",
    contact: "",
    region: "Riau",
    status: "Dihubungi",
    note: "",
    updatedAt: "2026-09-01",
  }))!;
  assert.equal(
    await createPlanProspect({
      planId: 999_999,
      name: "Tanpa induk",
      contact: "",
      region: "",
      status: "Dihubungi",
      note: "",
      updatedAt: "2026-09-01",
    }),
    null
  );

  const denganProspek = (await getPlans()).find((p) => p.id === rencanaUji.id)!;
  assert.equal(denganProspek.prospekTotal, 1);
  assert.equal(denganProspek.prospekMenang, 0);

  await updatePlanProspect(prospekUji.id, {
    ...prospekUji,
    status: "Menjadi Klien",
  });
  assert.equal(
    (await getPlans()).find((p) => p.id === rencanaUji.id)!.prospekMenang,
    1,
    "prospek yang jadi klien ikut terhitung"
  );

  // setPlanProjects MENGGANTI daftar, bukan menumpuk.
  const duaProyek = semua.slice(0, 2).map((p) => p.id);
  assert.deepEqual(await setPlanProjects(rencanaUji.id, duaProyek), { ok: true });
  assert.equal((await getPlanDetail(rencanaUji.id))!.projects.length, 2);

  assert.deepEqual(await setPlanProjects(rencanaUji.id, [duaProyek[0]]), { ok: true });
  const detailRencana = (await getPlanDetail(rencanaUji.id))!;
  assert.equal(detailRencana.projects.length, 1, "daftar diganti, bukan ditambahkan");
  assert.equal(detailRencana.projects[0].id, duaProyek[0]);

  // Proyek yang tidak ada ditolak, dan kaitan lama tidak ikut hilang karenanya.
  const tolakan = await setPlanProjects(rencanaUji.id, [999_999]);
  assert.equal(tolakan.ok, false);
  assert.equal((await getPlanDetail(rencanaUji.id))!.projects.length, 1);
  assert.equal((await setPlanProjects(999_999, [])).ok, false);

  // getPlanDetail melengkapi: nama PIC langkah, dan langkah tanpa PIC tetap null.
  assert.equal(detailRencana.steps.find((s) => s.id === langkah1.id)!.owner!.id, users[0].id);
  assert.equal(detailRencana.steps.find((s) => s.id === langkah2.id)!.owner, null);
  assert.equal(await getPlanDetail(999_999), null);

  // Komentar rencana: tabelnya sendiri, dan menolak rencana yang tidak ada.
  assert.ok(
    await createPlanComment({ planId: rencanaUji.id, userId: users[0].id, body: "Catatan uji" })
  );
  assert.equal(
    await createPlanComment({ planId: 999_999, userId: users[0].id, body: "Ke mana ini" }),
    null
  );
  assert.equal((await getPlanDetail(rencanaUji.id))!.comments.length, 1);

  // Jangkauan: wilayah yang punya rencana tapi belum ada proyeknya muncul
  // sebagai wilayah yang sedang dituju.
  const jangkauan = await getCoverage();
  const riau = jangkauan.find((c) => c.region.toLowerCase() === "riau");
  assert.ok(riau, "wilayah sasaran baru harus muncul di ringkasan jangkauan");
  assert.equal(riau!.projects, 0);
  assert.ok(riau!.plans >= 1);

  // Perbarui; createdBy tidak ikut diubah karena bukan bagian input.
  const rencanaDiubah = await updatePlan(rencanaUji.id, {
    ...rencanaUji,
    title: "Uji rencana API (diubah)",
    status: "Berjalan",
  });
  assert.equal(rencanaDiubah!.title, "Uji rencana API (diubah)");
  assert.equal(rencanaDiubah!.createdBy, users[0].id);
  assert.equal(await updatePlan(999_999, { ...rencanaUji }), null);

  // Hapus: isinya ikut lenyap lewat CASCADE, proyeknya tidak.
  assert.equal(await deletePlan(rencanaUji.id), true);
  assert.equal(await deletePlan(rencanaUji.id), false); // klik ganda tidak melapor sukses palsu
  assert.equal(await getPlan(rencanaUji.id), null);
  assert.equal((await getPlanSteps(rencanaUji.id)).length, 0);
  assert.equal((await getPlanProspects(rencanaUji.id)).length, 0);
  assert.equal((await getPlans()).length, rencanaSemula);
  assert.equal((await getProjects()).length, semua.length, "proyeknya tidak ikut terhapus");

  console.log("ok: api");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
