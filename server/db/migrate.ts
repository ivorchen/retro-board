/**
 * Idempotent SQL migration runner for node:sqlite.
 *
 * - Tracks applied migrations in `_migrations(name, applied_at)`.
 * - Reads `db/migrations/*.sql` sorted, relative to the project root
 *   (resolved via `process.cwd()` — the Next.js server cwd).
 * - Applies each not-yet-applied file inside a transaction and records it.
 * - Statements are split naively on `;`; the migrations contain only
 *   CREATE TABLE / CREATE INDEX statements, so this is safe.
 */

import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export function runMigrations(db: DatabaseSync): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((row) => String((row as { name: unknown }).name))
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const rawSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    // Strip full-line `--` comments first: they may contain `;` (e.g. the
    // portability notes in 0001_init.sql), which would corrupt naive
    // statement splitting. (Inline `--` inside string literals doesn't occur
    // in these migrations, which hold only CREATE TABLE/INDEX statements.)
    const sql = rawSql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    db.exec("BEGIN");
    try {
      for (const stmt of sql.split(";")) {
        const trimmed = stmt.trim();
        if (trimmed) db.exec(trimmed);
      }
      db
        .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
        .run(file, new Date().toISOString());
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}
