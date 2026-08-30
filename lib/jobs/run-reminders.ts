/**
 * Job pengingat terjadwal: `npx tsx lib/jobs/run-reminders.ts [YYYY-MM-DD]`
 *
 * Dipakai kalau penjadwalnya di luar Vercel (cron Linux, Task Scheduler
 * Windows, atau dijalankan tangan). Di Vercel, jadwalnya didefinisikan di
 * vercel.json dan memanggil POST /api/reminders/run.
 *
 * PERINGATAN selama data masih in-memory: tiap pemanggilan CLI adalah proses
 * baru, jadi jadwalnya kembali ke keadaan awal dan pengingat yang sama akan
 * terkirim lagi. Sifat "aman dijalankan berkali-kali" baru berlaku di dalam
 * satu server yang hidup (lewat POST /api/reminders/run), dan akan berlaku
 * untuk CLI ini juga setelah lib/api.ts membaca SQLite.
 */
import { runDueReminders } from "../api";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function main() {
  const arg = process.argv[2];
  if (arg !== undefined && !ISO_DATE.test(arg)) {
    console.error(`Tanggal harus format YYYY-MM-DD, bukan "${arg}".`);
    process.exit(2);
  }

  const hasil = await runDueReminders(arg);

  console.log(`Pengingat terjadwal — acuan ${hasil.asOf}`);
  if (hasil.sent.length === 0) console.log("  Tidak ada yang jatuh tempo.");
  for (const s of hasil.sent) {
    console.log(`  terkirim: ${s.projectName} (proyek ${s.projectId}) → berikutnya ${s.nextAt}`);
  }
  for (const s of hasil.skipped) {
    console.log(`  dilewati: proyek ${s.projectId} — ${s.reason}`);
  }
  console.log(`Ringkasan: ${hasil.sent.length} terkirim, ${hasil.skipped.length} dilewati.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
