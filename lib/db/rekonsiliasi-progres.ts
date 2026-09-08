/**
 * Rapikan checklist sebelum progres jadi sepenuhnya otomatis.
 *
 *   npx tsx lib/db/rekonsiliasi-progres.ts
 *
 * HANYA MEMBACA. Penulisannya dikerjakan migrasi 19, bukan di sini: langkah
 * manual yang harus diingat orang akan terlewat persis pada deploy yang
 * membutuhkannya — itu sudah pernah terjadi di proyek ini. Alat ini ada untuk
 * MELIHAT apa yang akan berubah sebelum migrasinya jalan, dan memeriksa
 * hasilnya sesudah.
 *
 * Checklist ke-17 proyek lama diisi migrasi 17 dengan menandai selesai SEMUA
 * aktivitas sampai tahap statusnya. Itu tebakan, dan tebakan itu hampir selalu
 * lebih tinggi daripada angka progres yang ditulis orang — proyek berstatus
 * "Berjalan" jarang sudah menyelesaikan seluruh pekerjaan tahap Berjalan.
 *
 * Melepas mode manual tanpa merapikannya lebih dulu akan membuat sejumlah
 * proyek melompat naik pada hari yang sama, tanpa ada yang mengerjakan apa pun.
 *
 * Caranya: di antara semua AWALAN checklist yang status turunannya SAMA dengan
 * status proyek sekarang, pilih yang jumlah bobotnya paling dekat dengan angka
 * tersimpan. Kebebasannya nyata — alur Jasa punya tiga aktivitas berstatus
 * "Berjalan", jadi progres bisa disetel 45%, 60%, atau 70% tanpa menggeser
 * statusnya sedikit pun.
 *
 * Status diperlakukan sebagai data keras: ia disepakati orang, jadi progres
 * yang menyesuaikan, bukan sebaliknya.
 */
import { DB_PATH, openDb, pakaiDb } from "./index";
import * as store from "./store";
import { progresDariAktivitas } from "../activities";
import type { ProjectActivity, ProjectStatus } from "../types";

type Usulan = {
  projectId: number;
  nama: string;
  status: ProjectStatus;
  semula: number;
  menjadi: number;
  /** Berapa aktivitas pertama yang ditandai selesai. */
  centang: number;
  /** Status turunannya tidak bisa disamakan dengan status proyek. */
  meleset: boolean;
};

/**
 * Awalan terbaik: jumlah bobotnya paling dekat ke `target`, dan aktivitas
 * terakhirnya berstatus sama dengan status proyek.
 *
 * Awalan kosong sengaja tidak ikut dipertimbangkan. Ia memang "tidak mengubah
 * status" menurut `statusDariAktivitas`, tapi artinya "belum ada apa pun yang
 * dikerjakan" — dan itu jelas salah untuk proyek yang sudah berjalan.
 */
function awalanTerbaik(
  aktivitas: ProjectActivity[],
  status: ProjectStatus,
  target: number
): { centang: number; progres: number; meleset: boolean } {
  const total = aktivitas.reduce((n, a) => n + a.weight, 0);
  if (total <= 0) return { centang: 0, progres: 0, meleset: true };

  let terbaik: { centang: number; progres: number } | null = null;
  let jumlah = 0;

  for (let k = 1; k <= aktivitas.length; k++) {
    jumlah += aktivitas[k - 1].weight;
    if (aktivitas[k - 1].status !== status) continue;

    const progres = Math.round((jumlah / total) * 100);
    if (terbaik === null || Math.abs(progres - target) < Math.abs(terbaik.progres - target)) {
      terbaik = { centang: k, progres };
    }
  }

  if (terbaik !== null) return { ...terbaik, meleset: false };

  // Tidak ada satu pun aktivitas yang mengaku berstatus ini — misalnya proyek
  // "Tertunda", yang memang bukan hasil pekerjaan. Biarkan apa adanya dan
  // laporkan, jangan diam-diam memindahkan statusnya.
  const sudah = aktivitas.filter((a) => a.doneDate !== null).length;
  return { centang: sudah, progres: progresDariAktivitas(aktivitas), meleset: true };
}

function main(): void {
  const db = openDb(process.env.DASHBOARD_DB_PATH ?? DB_PATH);
  pakaiDb(db);

  const usulan: Usulan[] = [];

  for (const p of store.projects.all()) {
    const aktivitas = store.projectActivities.byProject(p.id);
    if (aktivitas.length === 0) continue;

    const { centang, progres, meleset } = awalanTerbaik(aktivitas, p.status, p.progressPct);
    usulan.push({
      projectId: p.id,
      nama: p.name,
      status: p.status,
      semula: p.progressPct,
      menjadi: progres,
      centang,
      meleset,
    });
  }

  const lebar = Math.min(38, Math.max(...usulan.map((u) => u.nama.length), 10));
  console.log(
    `${"Proyek".padEnd(lebar)}  ${"Status".padEnd(10)}  Semula  Menjadi  Selisih  Centang`
  );
  console.log("-".repeat(lebar + 46));

  for (const u of usulan) {
    const selisih = u.menjadi - u.semula;
    console.log(
      `${u.nama.slice(0, lebar).padEnd(lebar)}  ${u.status.padEnd(10)}  ` +
        `${String(u.semula).padStart(6)}  ${String(u.menjadi).padStart(7)}  ` +
        `${(selisih > 0 ? `+${selisih}` : String(selisih)).padStart(7)}  ` +
        `${String(u.centang).padStart(7)}${u.meleset ? "  <- status tidak ada di checklist" : ""}`
    );
  }

  const bergeser = usulan.filter((u) => u.menjadi !== u.semula);
  const besar = usulan.filter((u) => Math.abs(u.menjadi - u.semula) > 10);
  console.log(
    `\n${usulan.length} proyek, ${bergeser.length} bergeser, ` +
      `${besar.length} bergeser lebih dari 10 poin.`
  );

  console.log(
    "\nAlat ini tidak menulis apa pun. Perubahannya diterapkan migrasi 19" +
      " (progres-sepenuhnya-otomatis) lewat `npm run db:setup`."
  );
  db.close();
}

main();
