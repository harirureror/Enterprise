/**
 * Siapkan database: `npx tsx lib/db/setup.ts`
 * Membuat file `data/dashboard.db`, menerapkan migrasi, lalu mengisi data awal.
 * Boleh dijalankan berulang kali.
 */
import { DB_PATH, openDb } from "./index";
import { runMigrations } from "./migrate";
import { seed } from "./seed";

const db = openDb(DB_PATH);
const baru = runMigrations(db);
const jumlah = seed(db);
db.close();

console.log(
  baru.length === 0 ? "Migrasi: tidak ada yang baru" : `Migrasi baru:\n  ${baru.join("\n  ")}`
);
console.log(
  `Seed: ${jumlah.users} anggota, ${jumlah.projects} proyek, ${jumlah.types} jenis, ` +
    `${jumlah.progress} riwayat, ${jumlah.reminders} pengingat, ${jumlah.schedules} jadwal, ` +
    `${jumlah.comments} komentar, ${jumlah.dependencies} ketergantungan, ${jumlah.agenda} agenda`
);
console.log(`Database: ${DB_PATH}`);
