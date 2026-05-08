import Database from "better-sqlite3";
import path from "node:path";
import { resolveDataDir, getEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const env = getEnv();
  const dataDir = resolveDataDir(env);
  const dbPath = path.join(dataDir, "app.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  logger.info({ dbPath }, "SQLite 已连接");
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','indexing','ready','failed')),
      chunk_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  `);
}

export type DocumentRow = {
  id: string;
  original_name: string;
  stored_name: string;
  mime: string;
  size: number;
  file_path: string;
  status: "pending" | "indexing" | "ready" | "failed";
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};
