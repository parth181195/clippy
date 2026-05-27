use crate::db::{Db, DbError};
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub layout: String,
    pub density: String,
    pub accent: String,
    pub panel_position: String,
    pub hotkey_panel: String,
    pub hotkey_paste_last: String,
    pub hotkey_incognito: String,
    pub history_size: i64,
    pub polling_ms: u64,
    pub sound_on_copy: bool,
    pub notifications_on_copy: bool,
    pub link_previews_enabled: bool,
    pub auto_sync_outgoing: bool,
    pub auto_sync_incoming: bool,
    pub incognito_auto_disable_secs: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "auto".into(),
            layout: "cards".into(),
            density: "comfortable".into(),
            accent: "#E95678".into(),
            panel_position: "bottom".into(),
            hotkey_panel: "Ctrl+F10".into(),
            hotkey_paste_last: "Ctrl+F11".into(),
            hotkey_incognito: "Ctrl+Shift+I".into(),
            history_size: 500,
            polling_ms: 300,
            sound_on_copy: true,
            notifications_on_copy: false,
            link_previews_enabled: false,
            auto_sync_outgoing: true,
            auto_sync_incoming: true,
            incognito_auto_disable_secs: 300,
        }
    }
}

impl Settings {
    pub fn load(db: &Db) -> Result<Self, DbError> {
        let mut s = Settings::default();
        let mut stmt = db.conn().prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (k, v) = row?;
            apply(&mut s, &k, &v);
        }
        Ok(s)
    }
    pub fn save(&self, db: &Db) -> Result<(), DbError> {
        let pairs: Vec<(&str, String)> = vec![
            ("theme", self.theme.clone()),
            ("layout", self.layout.clone()),
            ("density", self.density.clone()),
            ("accent", self.accent.clone()),
            ("panel_position", self.panel_position.clone()),
            ("hotkey_panel", self.hotkey_panel.clone()),
            ("hotkey_paste_last", self.hotkey_paste_last.clone()),
            ("hotkey_incognito", self.hotkey_incognito.clone()),
            ("history_size", self.history_size.to_string()),
            ("polling_ms", self.polling_ms.to_string()),
            ("sound_on_copy", self.sound_on_copy.to_string()),
            ("notifications_on_copy", self.notifications_on_copy.to_string()),
            ("link_previews_enabled", self.link_previews_enabled.to_string()),
            ("auto_sync_outgoing", self.auto_sync_outgoing.to_string()),
            ("auto_sync_incoming", self.auto_sync_incoming.to_string()),
            ("incognito_auto_disable_secs", self.incognito_auto_disable_secs.to_string()),
        ];
        for (k, v) in pairs {
            db.conn().execute(
                "INSERT OR REPLACE INTO settings(key, value) VALUES (?1, ?2)",
                params![k, v],
            )?;
        }
        Ok(())
    }
}

fn apply(s: &mut Settings, k: &str, v: &str) {
    match k {
        "theme" => s.theme = v.into(),
        "layout" => s.layout = v.into(),
        "density" => s.density = v.into(),
        "accent" => s.accent = v.into(),
        "panel_position" => s.panel_position = v.into(),
        "hotkey_panel" => s.hotkey_panel = v.into(),
        "hotkey_paste_last" => s.hotkey_paste_last = v.into(),
        "hotkey_incognito" => s.hotkey_incognito = v.into(),
        "history_size" => if let Ok(n) = v.parse() { s.history_size = n; }
        "polling_ms" => if let Ok(n) = v.parse() { s.polling_ms = n; }
        "sound_on_copy" => if let Ok(b) = v.parse() { s.sound_on_copy = b; }
        "notifications_on_copy" => if let Ok(b) = v.parse() { s.notifications_on_copy = b; }
        "link_previews_enabled" => if let Ok(b) = v.parse() { s.link_previews_enabled = b; }
        "auto_sync_outgoing" => if let Ok(b) = v.parse() { s.auto_sync_outgoing = b; }
        "auto_sync_incoming" => if let Ok(b) = v.parse() { s.auto_sync_incoming = b; }
        "incognito_auto_disable_secs" => if let Ok(n) = v.parse() { s.incognito_auto_disable_secs = n; }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip_save_load() {
        let db = Db::open_in_memory().unwrap();
        let mut s = Settings::default();
        s.layout = "spotlight".into();
        s.history_size = 1000;
        s.sound_on_copy = false;
        s.hotkey_panel = "Ctrl+F10".into();
        s.save(&db).unwrap();
        let loaded = Settings::load(&db).unwrap();
        assert_eq!(loaded.layout, "spotlight");
        assert_eq!(loaded.history_size, 1000);
        assert!(!loaded.sound_on_copy);
        assert_eq!(loaded.hotkey_panel, "Ctrl+F10");
    }
    #[test]
    fn defaults_use_ctrl_f10_and_f11() {
        let s = Settings::default();
        assert_eq!(s.hotkey_panel, "Ctrl+F10");
        assert_eq!(s.hotkey_paste_last, "Ctrl+F11");
    }
}
