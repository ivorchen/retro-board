/**
 * Lazily-opened SQLite database singleton.
 *
 * The path comes from `SQLITE_PATH` (default: `<cwd>/data/retro-board.db`).
 * Migrations run once, on first open. The instance is cached on `globalThis`
 * so Next.js dev-mode HMR doesn't open a second connection to the same file.
 */

import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrate";
import { SqliteDb } from "./sqlite";
import type { Db } from "./types";
import * as path from "node:path";
import * as fs from "node:fs";

const globalForDb = globalThis as unknown as { __rb_db?: Db };

function resolveDbPath(): string {
  if (process.env.SQLITE_PATH) return path.resolve(process.env.SQLITE_PATH);
  return path.join(process.cwd(), "data", "retro-board.db");
}

/** Open (or reuse) the database, running pending migrations on first open. */
export function getDb(): Db {
  if (!globalForDb.__rb_db) {
    const dbPath = resolveDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const raw = new DatabaseSync(dbPath);
    runMigrations(raw);
    globalForDb.__rb_db = new SqliteDb(raw);
  }
  return globalForDb.__rb_db;
}

export type { Db };
