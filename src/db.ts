// SQLite-backed metadata store. Tracks the last-known content hash for each
// object key so we can skip rewriting unchanged files, and keeps an audit log
// of edits.

import { Database } from "bun:sqlite";
import { config } from "./config.ts";

export const db = new Database(config.dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS file_meta (
    key          TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    size         INTEGER NOT NULL,
    content_type TEXT,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS edit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT NOT NULL,
    action     TEXT NOT NULL,            -- 'upload' | 'edit' | 'skip' | 'delete'
    content_hash TEXT,
    size       INTEGER,
    at         TEXT NOT NULL
  );
`);

export interface FileMeta {
  key: string;
  content_hash: string;
  size: number;
  content_type: string | null;
  updated_at: string;
}

export function getMeta(key: string): FileMeta | null {
  return db
    .query<FileMeta, [string]>("SELECT * FROM file_meta WHERE key = ?")
    .get(key);
}

export function upsertMeta(meta: FileMeta): void {
  db.query(
    `INSERT INTO file_meta (key, content_hash, size, content_type, updated_at)
     VALUES ($key, $hash, $size, $type, $updated)
     ON CONFLICT(key) DO UPDATE SET
       content_hash = excluded.content_hash,
       size         = excluded.size,
       content_type = excluded.content_type,
       updated_at   = excluded.updated_at`,
  ).run({
    $key: meta.key,
    $hash: meta.content_hash,
    $size: meta.size,
    $type: meta.content_type,
    $updated: meta.updated_at,
  });
}

export function deleteMeta(key: string): void {
  db.query("DELETE FROM file_meta WHERE key = ?").run(key);
}

export function logEdit(
  key: string,
  action: "upload" | "edit" | "skip" | "delete",
  contentHash: string | null,
  size: number | null,
): void {
  db.query(
    `INSERT INTO edit_log (key, action, content_hash, size, at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(key, action, contentHash, size, new Date().toISOString());
}

export interface EditLogRow {
  id: number;
  key: string;
  action: string;
  content_hash: string | null;
  size: number | null;
  at: string;
}

export function recentLog(limit = 50): EditLogRow[] {
  return db
    .query<EditLogRow, [number]>(
      "SELECT * FROM edit_log ORDER BY id DESC LIMIT ?",
    )
    .all(limit);
}
