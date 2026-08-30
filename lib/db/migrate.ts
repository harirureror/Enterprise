/**
 * Penerap migrasi. Dipanggil dari `lib/db/setup.ts` (`npx tsx lib/db/setup.ts`).
 * Aman diulang — migrasi yang sudah tercatat di `_migrations` dilewati.
 */
import type { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations";

/** Terapkan semua migrasi yang belum jalan, kembalikan yang baru saja diterapkan. */
export function runMigrations(db: DatabaseSync): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const sudah = new Set(
    db
      .prepare("SELECT id FROM _migrations")
      .all()
      .map((row) => Number(row.id))
  );

  const catat = db.prepare("INSERT INTO _migrations (id, name) VALUES (?, ?)");
  const baru: string[] = [];

  for (const m of [...migrations].sort((a, b) => a.id - b.id)) {
    if (sudah.has(m.id)) continue;

    // Satu migrasi = satu transaksi, biar tidak berhenti setengah jalan.
    db.exec("BEGIN");
    try {
      db.exec(m.up);
      catat.run(m.id, m.name);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migrasi ${m.id} (${m.name}) gagal: ${(err as Error).message}`);
    }

    baru.push(`${m.id}-${m.name}`);
  }

  return baru;
}
