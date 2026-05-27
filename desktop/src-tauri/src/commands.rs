use crate::clipboard::ContentType;
use crate::db::Db;
use crate::settings::Settings;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct AppState {
    pub db: Arc<Mutex<Db>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClipDto {
    pub id: i64,
    pub content_type: String,
    pub mime: String,
    pub hash: String,
    pub preview: String,
    pub source_app: Option<String>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub created_at: i64,
}

#[tauri::command]
pub fn list_clips(
    state: State<'_, AppState>,
    search: Option<String>,
    content_type_filter: Option<String>,
    favorites_only: bool,
    limit: i64,
) -> Result<Vec<ClipDto>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut sql = String::from(
        "SELECT id, content_type, mime, content_hash, preview, source_app, is_favorite, is_pinned, created_at
         FROM clips WHERE 1=1",
    );
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    if let Some(ref q) = search {
        if !q.is_empty() {
            sql.push_str(" AND id IN (SELECT rowid FROM clips_fts WHERE clips_fts MATCH ?)");
            params.push(Box::new(format!("{q}*")));
        }
    }
    if let Some(ref ct) = content_type_filter {
        sql.push_str(" AND content_type = ?");
        params.push(Box::new(ct.clone()));
    }
    if favorites_only {
        sql.push_str(" AND is_favorite = 1");
    }
    sql.push_str(" ORDER BY is_pinned DESC, is_favorite DESC, created_at DESC LIMIT ?");
    params.push(Box::new(limit));
    let mut stmt = db.conn().prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(param_refs), |r| {
            Ok(ClipDto {
                id: r.get(0)?,
                content_type: r.get(1)?,
                mime: r.get(2)?,
                hash: r.get(3)?,
                preview: r.get(4)?,
                source_app: r.get(5)?,
                is_favorite: r.get::<_, i64>(6)? != 0,
                is_pinned: r.get::<_, i64>(7)? != 0,
                created_at: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_clip_content(
    state: State<'_, AppState>,
    id: i64,
    mime: Option<String>,
) -> Result<Vec<u8>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(m) = mime {
        if let Ok(bytes) = db.conn().query_row(
            "SELECT content FROM clip_representations WHERE clip_id = ?1 AND mime = ?2",
            rusqlite::params![id, m],
            |r| r.get::<_, Vec<u8>>(0),
        ) {
            return Ok(bytes);
        }
    }
    db.conn()
        .query_row(
            "SELECT content FROM clips WHERE id = ?1",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_thumbnail(state: State<'_, AppState>, id: i64) -> Result<Option<Vec<u8>>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.thumbnail_for(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn()
        .execute(
            "UPDATE clips SET is_favorite = 1 - is_favorite WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
    Ok(db
        .conn()
        .query_row(
            "SELECT is_favorite FROM clips WHERE id = ?1",
            rusqlite::params![id],
            |r| r.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?
        != 0)
}

#[tauri::command]
pub fn toggle_pin(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn()
        .execute(
            "UPDATE clips SET is_pinned = 1 - is_pinned WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
    Ok(db
        .conn()
        .query_row(
            "SELECT is_pinned FROM clips WHERE id = ?1",
            rusqlite::params![id],
            |r| r.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?
        != 0)
}

#[tauri::command]
pub fn delete_clip(state: State<'_, AppState>, id: i64, force: bool) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if !force {
        let (pinned, fav): (i64, i64) = db
            .conn()
            .query_row(
                "SELECT is_pinned, is_favorite FROM clips WHERE id = ?1",
                rusqlite::params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|e| e.to_string())?;
        if pinned == 1 || fav == 1 {
            return Err("clip is pinned or favorited; pass force=true".into());
        }
    }
    db.conn()
        .execute("DELETE FROM clips WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_edited_clip(
    state: State<'_, AppState>,
    original_id: i64,
    new_content: String,
) -> Result<i64, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let (ct, mime): (String, String) = db
        .conn()
        .query_row(
            "SELECT content_type, mime FROM clips WHERE id = ?1",
            rusqlite::params![original_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let content_type = match ct.as_str() {
        "text" => ContentType::Text,
        "link" => ContentType::Link,
        "code" => ContentType::Code,
        "color" => ContentType::Color,
        "emoji" => ContentType::Emoji,
        _ => return Err("not editable type".into()),
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let preview: String = new_content.chars().take(280).collect();
    let inserted = db
        .insert_clip(
            content_type,
            new_content.as_bytes(),
            &mime,
            &preview,
            Some("Clippy (edited)"),
            now,
        )
        .map_err(|e| e.to_string())?;
    Ok(inserted.id)
}

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Settings::load(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    settings.save(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn paste_by_id(
    state: State<'_, AppState>,
    id: i64,
    shift_for_terminal: bool,
) -> Result<(), String> {
    let (content, mime): (Vec<u8>, String) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.conn()
            .query_row(
                "SELECT content, mime FROM clips WHERE id = ?1",
                rusqlite::params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|e| e.to_string())?
    };
    crate::paste::paste_to_active(&content, &mime, shift_for_terminal)
}
