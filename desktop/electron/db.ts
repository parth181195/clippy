import Database from 'better-sqlite3';
import { app } from 'electron';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ContentType } from './ipc-types.js';

const SCHEMA_V1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clips (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL CHECK (content_type IN
                  ('text','image','link','code','color','emoji','file')),
    content      BLOB NOT NULL,
    mime         TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    preview      TEXT,
    source_app   TEXT,
    is_favorite  INTEGER NOT NULL DEFAULT 0,
    is_pinned    INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    UNIQUE (content_hash)
);
CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_panel_order
    ON clips(is_pinned DESC, is_favorite DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS clip_representations (
    clip_id INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    mime    TEXT NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (clip_id, mime)
);

CREATE TABLE IF NOT EXISTS clip_thumbnails (
    clip_id   INTEGER PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    png_bytes BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS clip_actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    label        TEXT NOT NULL,
    kind         TEXT NOT NULL,
    params_json  TEXT NOT NULL DEFAULT '{}',
    is_default   INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS link_previews (
    clip_id     INTEGER PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    title       TEXT,
    description TEXT,
    favicon_png BLOB,
    og_image    BLOB,
    fetched_at  INTEGER NOT NULL,
    status      TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5 (
    preview, content='clips', content_rowid='id'
);
CREATE TRIGGER IF NOT EXISTS clips_ai AFTER INSERT ON clips BEGIN
    INSERT INTO clips_fts(rowid, preview) VALUES (new.id, new.preview);
END;
CREATE TRIGGER IF NOT EXISTS clips_ad AFTER DELETE ON clips BEGIN
    INSERT INTO clips_fts(clips_fts, rowid, preview) VALUES ('delete', old.id, old.preview);
END;
CREATE TRIGGER IF NOT EXISTS clips_au AFTER UPDATE ON clips BEGIN
    INSERT INTO clips_fts(clips_fts, rowid, preview) VALUES ('delete', old.id, old.preview);
    INSERT INTO clips_fts(rowid, preview) VALUES (new.id, new.preview);
END;

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS excluded_apps (
    app_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS paired_devices (
    device_id TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    pubkey    BLOB NOT NULL,
    psk       BLOB NOT NULL,
    paired_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO excluded_apps(app_id) VALUES
    ('keepassxc'), ('bitwarden'), ('1password'), ('gnome-keyring');

INSERT OR IGNORE INTO clip_actions(id, content_type, label, kind, params_json, is_default, sort_order)
    VALUES (1, 'link', 'Open in browser', 'open_url', '{}', 1, 0);
`;

export function sha256Hex(bytes: Buffer | string): string {
  const h = createHash('sha256');
  h.update(bytes);
  return h.digest('hex');
}

export function nowMs(): number {
  return Date.now();
}

export class Db {
  private db: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.exec(SCHEMA_V1);
  }

  static openDefault(): Db {
    const dir = join(app.getPath('userData'), 'clippy');
    return new Db(join(dir, 'clippy.db'));
  }

  static openInMemory(): Db {
    const d = new Db(':memory:');
    return d;
  }

  raw(): Database.Database {
    return this.db;
  }

  insertClip(
    contentType: ContentType,
    content: Buffer,
    mime: string,
    preview: string,
    sourceApp: string | null,
    nowMillis: number
  ): { id: number; wasNew: boolean } {
    const hash = sha256Hex(content);
    const existing = this.db
      .prepare('SELECT id FROM clips WHERE content_hash = ?')
      .get(hash) as { id: number } | undefined;
    if (existing) return { id: existing.id, wasNew: false };
    const info = this.db
      .prepare(
        `INSERT INTO clips(content_type, content, mime, content_hash, preview, source_app, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(contentType, content, mime, hash, preview, sourceApp, nowMillis);
    return { id: Number(info.lastInsertRowid), wasNew: true };
  }

  /** Pin is ephemeral; only is_favorite saves clips from auto-pruning. */
  prune(historySize: number): number {
    const total = (this.db.prepare('SELECT count(*) as n FROM clips').get() as { n: number }).n;
    if (total <= historySize) return 0;
    const toDelete = total - historySize;
    const info = this.db
      .prepare(
        `DELETE FROM clips WHERE id IN (
           SELECT id FROM clips WHERE is_favorite = 0 ORDER BY created_at ASC LIMIT ?
         )`
      )
      .run(toDelete);
    return Number(info.changes);
  }

  addRepresentation(clipId: number, mime: string, content: Buffer): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO clip_representations(clip_id, mime, content) VALUES (?, ?, ?)'
      )
      .run(clipId, mime, content);
  }

  representationsFor(clipId: number): Array<{ mime: string; content: Buffer }> {
    return this.db
      .prepare(
        'SELECT mime, content FROM clip_representations WHERE clip_id = ? ORDER BY mime'
      )
      .all(clipId) as Array<{ mime: string; content: Buffer }>;
  }

  setThumbnail(clipId: number, png: Buffer): void {
    this.db
      .prepare('INSERT OR REPLACE INTO clip_thumbnails(clip_id, png_bytes) VALUES (?, ?)')
      .run(clipId, png);
  }

  thumbnailFor(clipId: number): Buffer | null {
    const row = this.db
      .prepare('SELECT png_bytes FROM clip_thumbnails WHERE clip_id = ?')
      .get(clipId) as { png_bytes: Buffer } | undefined;
    return row ? row.png_bytes : null;
  }
}
