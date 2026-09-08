// Pembantu skrip cadangan. Dipanggil backup-db.sh, tidak untuk dipakai langsung.
//
//   node backup-db.mjs salin  <sumber.db> <tujuan.db>
//   node backup-db.mjs periksa <berkas.db>
//
// VACUUM INTO dipakai, bukan penyalinan berkas biasa: perintah itu meminta
// SQLite sendiri menuliskan salinan yang konsisten, jadi aman dijalankan saat
// aplikasi sedang melayani permintaan.
import { DatabaseSync } from "node:sqlite";

const [perintah, ...arg] = process.argv.slice(2);

if (perintah === "salin") {
  const [sumber, tujuan] = arg;
  const db = new DatabaseSync(sumber, { readOnly: true });
  // Kutip tunggal digandakan sesuai aturan literal SQL. Nama berkas kita memang
  // aman, tapi menyusun SQL dengan cara yang hanya kebetulan benar itu utang.
  db.exec(`VACUUM INTO '${tujuan.replaceAll("'", "''")}'`);
  db.close();
} else if (perintah === "periksa") {
  const [berkas] = arg;
  const db = new DatabaseSync(berkas, { readOnly: true });
  // Integritas dulu, baru isinya: berkas yang terbaca belum tentu utuh.
  const utuh = db.prepare("PRAGMA integrity_check").get();
  const status = Object.values(utuh)[0];
  if (status !== "ok") {
    console.error(`integrity_check: ${status}`);
    process.exit(1);
  }
  const jumlah = ["users", "projects", "strategic_plans", "agenda"]
    .map((t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n)
    .join("/");
  db.close();
  console.log(jumlah);
} else {
  console.error("perintah tidak dikenal");
  process.exit(2);
}
