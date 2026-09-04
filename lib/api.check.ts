/**
 * Cek mandiri pintu data: `npx tsx lib/api.check.ts`
 * Fokus ke perilaku gerbang (penyaringan, hitung ulang bentrok), bukan isi mock-data.
 */
import assert from "node:assert/strict";
import {
  addProgress,
  createProject,
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
import { hashPassword } from "./password";
import { verifyCredentials } from "./auth";
import {
  progressHistory as mockProgress,
  projectDependencies as mockDependencies,
  projects as mockProjects,
} from "./mock-data";
import { scoreAll } from "./priority";
import { PROJECT_TYPES, isActiveStatus } from "./types";

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
  const idRiwayat = mockProgress[0]?.projectId;
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
  const skor = scoreAll(mockProjects, mockDependencies);
  for (const p of semua) {
    const tersimpan = mockProjects.find((m) => m.id === p.id)!;
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
  const dikunci = mockProjects[0];
  const modeAsli = dikunci.priorityMode;
  const prioritasAsli = dikunci.priority;

  dikunci.priorityMode = "manual";
  // Dikunci ke level yang berbeda dari hasil hitungan, supaya "tidak ditimpa"
  // benar-benar terlihat bedanya.
  const hitung = skor.get(dikunci.id)!.level;
  dikunci.priority = hitung === "Tinggi" ? "Rendah" : "Tinggi";
  const terkunci = dikunci.priority;

  assert.equal((await getProject(dikunci.id))!.priority, terkunci);
  assert.notEqual(terkunci, hitung, "penguncian harus diuji pada level yang berbeda");
  assert.equal(
    (await getProjects()).find((p) => p.id === dikunci.id)!.priority,
    terkunci,
    "kunci manual harus bertahan di daftar, bukan cuma saat diambil satuan"
  );

  // Kembali ke otomatis: sekarang justru harus ikut hasil hitungan.
  dikunci.priorityMode = "auto";
  assert.equal((await getProject(dikunci.id))!.priority, hitung);

  dikunci.priorityMode = modeAsli;
  dikunci.priority = prioritasAsli;

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

  const relasiSemula = mockDependencies.map((d) => ({ ...d }));
  // Mulai dari nol supaya yang diuji perilaku gerbangnya, bukan isi mock-data.
  mockDependencies.length = 0;
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
  mockDependencies.length = 0;
  mockDependencies.push(...relasiSemula);

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

  console.log("ok: api");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
