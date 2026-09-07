/**
 * Siapkan database: `npx tsx lib/db/setup.ts`
 * Membuat file `data/dashboard.db`, menerapkan migrasi, lalu mengisi data awal.
 * Boleh dijalankan berulang kali.
 */
import { DB_PATH, openDb } from "./index";
import { runMigrations } from "./migrate";
import { seed } from "./seed";

/* Migrasi selalu dijalankan — skema harus mengikuti kode.
   Seed hanya mengisi database kosong; lihat catatan di lib/db/seed.ts. */
const paksa = process.argv.includes("--force");

const db = openDb(DB_PATH);
const baru = runMigrations(db);
const jumlah = seed(db, { force: paksa });
db.close();

console.log(
  baru.length === 0 ? "Migrasi: tidak ada yang baru" : `Migrasi baru:\n  ${baru.join("\n  ")}`
);
console.log(
  jumlah.dilewati
    ? "Seed: dilewati — database sudah berisi data. Pakai --force untuk menimpanya."
    : `Seed: ${jumlah.users} anggota, ${jumlah.projects} proyek, ${jumlah.types} jenis, ` +
      `${jumlah.progress} riwayat, ${jumlah.reminders} pengingat, ${jumlah.schedules} jadwal, ` +
      `${jumlah.comments} komentar, ${jumlah.dependencies} ketergantungan, ${jumlah.agenda} agenda, ` +
      `${jumlah.plans} rencana, ${jumlah.planSteps} langkah, ${jumlah.planProspects} prospek, ` +
      `${jumlah.planProjects} kaitan proyek`
);
console.log(`Database: ${DB_PATH}`);
