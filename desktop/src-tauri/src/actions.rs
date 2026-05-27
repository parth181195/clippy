use crate::clipboard::ContentType;
use crate::db::{Db, DbError};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipAction {
    pub id: i64,
    pub content_type: ContentType,
    pub label: String,
    pub kind: ActionKind,
    pub params: serde_json::Value,
    pub is_default: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionKind {
    Paste,
    OpenUrl,
    SaveToFile,
    ShellCommand,
    WebSearch,
}

pub fn list_actions(db: &Db, ct: ContentType) -> Result<Vec<ClipAction>, DbError> {
    let mut stmt = db.conn().prepare(
        "SELECT id, content_type, label, kind, params_json, is_default, sort_order
         FROM clip_actions WHERE content_type = ?1 ORDER BY sort_order, id",
    )?;
    let rows = stmt.query_map(params![ct.as_str()], |r| {
        let ct: String = r.get(1)?;
        let kind: String = r.get(3)?;
        let params_json: String = r.get(4)?;
        let content_type = match ct.as_str() {
            "text" => ContentType::Text,
            "link" => ContentType::Link,
            "code" => ContentType::Code,
            "color" => ContentType::Color,
            "emoji" => ContentType::Emoji,
            "file" => ContentType::File,
            "image" => ContentType::Image,
            _ => ContentType::Text,
        };
        let kind = serde_json::from_str(&format!("\"{kind}\"")).unwrap_or(ActionKind::Paste);
        let params = serde_json::from_str(&params_json).unwrap_or(serde_json::json!({}));
        Ok(ClipAction {
            id: r.get(0)?,
            content_type,
            label: r.get(2)?,
            kind,
            params,
            is_default: r.get::<_, i64>(5)? != 0,
            sort_order: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn run_action(action: &ClipAction, clip_content: &str) -> Result<(), String> {
    match action.kind {
        ActionKind::Paste => Ok(()),
        ActionKind::OpenUrl => open::that_detached(clip_content).map_err(|e| e.to_string()),
        ActionKind::SaveToFile => {
            let path = action
                .params
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or("missing path param")?;
            std::fs::write(path, clip_content).map_err(|e| e.to_string())
        }
        ActionKind::ShellCommand => {
            let cmd = action
                .params
                .get("cmd")
                .and_then(|v| v.as_str())
                .ok_or("missing cmd param")?;
            let cmd = cmd.replace("{q}", clip_content);
            let status = Command::new("sh")
                .arg("-c")
                .arg(&cmd)
                .status()
                .map_err(|e| e.to_string())?;
            if status.success() { Ok(()) } else { Err(format!("exit {status}")) }
        }
        ActionKind::WebSearch => {
            let tmpl = action
                .params
                .get("url")
                .and_then(|v| v.as_str())
                .ok_or("missing url param")?;
            let q = urlencoding::encode(clip_content);
            let url = tmpl.replace("{q}", &q);
            open::that_detached(&url).map_err(|e| e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn list_actions_returns_seeded_link_default() {
        let db = Db::open_in_memory().unwrap();
        let actions = list_actions(&db, ContentType::Link).unwrap();
        assert_eq!(actions.len(), 1);
        assert!(actions[0].is_default);
        assert_eq!(actions[0].kind, ActionKind::OpenUrl);
    }
}
