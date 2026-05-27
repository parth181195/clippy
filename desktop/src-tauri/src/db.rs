use rusqlite::{params, Connection};
use std::path::Path;
use thiserror::Error;

use crate::clipboard::ContentType;
use sha2::{Digest, Sha256};

#[derive(Debug, Error)]
pub enum DbError {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

pub struct Db {
    conn: Connection,
}

impl Db {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, DbError> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self, DbError> {
        let conn = Connection::open_in_memory()?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&mut self) -> Result<(), DbError> {
        self.conn.execute_batch(SCHEMA_V1)?;
        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }
    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
}

pub struct InsertedClip {
    pub id: i64,
    pub was_new: bool,
}

impl Db {
    pub fn insert_clip(
        &mut self,
        content_type: ContentType,
        content: &[u8],
        mime: &str,
        preview: &str,
        source_app: Option<&str>,
        now_ms: i64,
    ) -> Result<InsertedClip, DbError> {
        let hash = sha256_hex(content);
        let tx = self.conn.transaction()?;
        let existing: Option<i64> = tx
            .query_row(
                "SELECT id FROM clips WHERE content_hash = ?1",
                params![&hash],
                |r| r.get(0),
            )
            .ok();
        let result = if let Some(id) = existing {
            InsertedClip { id, was_new: false }
        } else {
            tx.execute(
                "INSERT INTO clips(content_type, content, mime, content_hash, preview, source_app, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![content_type.as_str(), content, mime, &hash, preview, source_app, now_ms],
            )?;
            InsertedClip {
                id: tx.last_insert_rowid(),
                was_new: true,
            }
        };
        tx.commit()?;
        Ok(result)
    }

    /// Pin is ephemeral; only is_favorite saves clips from auto-pruning.
    pub fn prune(&mut self, history_size: i64) -> Result<usize, DbError> {
        let tx = self.conn.transaction()?;
        let total: i64 = tx.query_row("SELECT count(*) FROM clips", [], |r| r.get(0))?;
        if total <= history_size {
            tx.commit()?;
            return Ok(0);
        }
        let to_delete = total - history_size;
        let n = tx.execute(
            "DELETE FROM clips WHERE id IN (
                 SELECT id FROM clips
                 WHERE is_favorite = 0
                 ORDER BY created_at ASC
                 LIMIT ?1
             )",
            params![to_delete],
        )?;
        tx.commit()?;
        Ok(n)
    }

    pub fn add_representation(&self, clip_id: i64, mime: &str, content: &[u8]) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO clip_representations(clip_id, mime, content) VALUES (?1, ?2, ?3)",
            params![clip_id, mime, content],
        )?;
        Ok(())
    }

    pub fn representations_for(&self, clip_id: i64) -> Result<Vec<(String, Vec<u8>)>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT mime, content FROM clip_representations WHERE clip_id = ?1 ORDER BY mime",
        )?;
        let rows = stmt.query_map(params![clip_id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?))
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn set_thumbnail(&self, clip_id: i64, png: &[u8]) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO clip_thumbnails(clip_id, png_bytes) VALUES (?1, ?2)",
            params![clip_id, png],
        )?;
        Ok(())
    }
    pub fn thumbnail_for(&self, clip_id: i64) -> Result<Option<Vec<u8>>, DbError> {
        Ok(self
            .conn
            .query_row(
                "SELECT png_bytes FROM clip_thumbnails WHERE clip_id = ?1",
                params![clip_id],
                |r| r.get(0),
            )
            .ok())
    }
}

const SCHEMA_V1: &str = r#"
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
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clipboard::ContentType;

    #[test]
    fn opens_in_memory_and_runs_migrations() {
        let db = Db::open_in_memory().unwrap();
        let n: i64 = db
            .conn()
            .query_row("SELECT count(*) FROM excluded_apps", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 4);
    }

    #[test]
    fn fts_index_is_searchable() {
        let db = Db::open_in_memory().unwrap();
        db.conn()
            .execute(
                "INSERT INTO clips(content_type, content, mime, content_hash, preview, created_at)
             VALUES ('text', X'68656c6c6f', 'text/plain', 'abc', 'hello world', 1000)",
                params![],
            )
            .unwrap();
        let id: i64 = db
            .conn()
            .query_row(
                "SELECT rowid FROM clips_fts WHERE clips_fts MATCH 'hello'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(id, 1);
    }

    #[test]
    fn default_link_action_seeded() {
        let db = Db::open_in_memory().unwrap();
        let (label, kind): (String, String) = db
            .conn()
            .query_row(
                "SELECT label, kind FROM clip_actions WHERE content_type='link' AND is_default=1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(label, "Open in browser");
        assert_eq!(kind, "open_url");
    }

    #[test]
    fn insert_dedups_by_hash() {
        let mut db = Db::open_in_memory().unwrap();
        let a = db
            .insert_clip(ContentType::Text, b"hi", "text/plain", "hi", None, 1)
            .unwrap();
        let b = db
            .insert_clip(ContentType::Text, b"hi", "text/plain", "hi", None, 2)
            .unwrap();
        assert_eq!(a.id, b.id);
        assert!(a.was_new);
        assert!(!b.was_new);
    }

    #[test]
    fn prune_removes_oldest_non_favorite_only() {
        let mut db = Db::open_in_memory().unwrap();
        for i in 0..5 {
            let bytes = vec![i as u8];
            db.insert_clip(
                ContentType::Text,
                &bytes,
                "text/plain",
                &format!("p{i}"),
                None,
                i as i64,
            )
            .unwrap();
        }
        db.conn()
            .execute("UPDATE clips SET is_favorite = 1 WHERE id = 1", [])
            .unwrap();
        db.conn()
            .execute("UPDATE clips SET is_pinned = 1 WHERE id = 2", [])
            .unwrap();
        let removed = db.prune(2).unwrap();
        assert_eq!(removed, 3);
        let surviving: Vec<i64> = db
            .conn()
            .prepare("SELECT id FROM clips ORDER BY id")
            .unwrap()
            .query_map([], |r| r.get::<_, i64>(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert!(surviving.contains(&1)); // favorite saved
        assert!(!surviving.contains(&2)); // pin did NOT save
    }

    #[test]
    fn stores_and_returns_multiple_reps() {
        let mut db = Db::open_in_memory().unwrap();
        let c = db
            .insert_clip(ContentType::Text, b"x", "text/plain", "x", None, 0)
            .unwrap();
        db.add_representation(c.id, "text/html", b"<b>x</b>").unwrap();
        db.add_representation(c.id, "text/plain", b"x").unwrap();
        let reps = db.representations_for(c.id).unwrap();
        assert_eq!(reps.len(), 2);
        assert_eq!(reps[0].0, "text/html");
    }
}
