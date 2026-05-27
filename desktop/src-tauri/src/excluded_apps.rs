//! Best-effort focused-app detection for the polling clipboard source.
//! On Wayland this is inherently limited; the GNOME extension (Part C) provides
//! the reliable path via D-Bus `FocusedWindowChanged`.

use crate::db::Db;
use std::process::Command;

pub fn current_focused_app() -> Option<String> {
    if let Ok(out) = Command::new("xdotool")
        .args(["getactivewindow", "getwindowname"])
        .output()
    {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                return Some(s);
            }
        }
    }
    None
}

pub fn load_exclusions(db: &Db) -> Vec<String> {
    let mut s = db.conn().prepare("SELECT app_id FROM excluded_apps").unwrap();
    s.query_map([], |r| r.get::<_, String>(0))
        .unwrap()
        .filter_map(Result::ok)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn load_exclusions_returns_seeded_apps() {
        let db = Db::open_in_memory().unwrap();
        let apps = load_exclusions(&db);
        assert!(apps.iter().any(|a| a == "keepassxc"));
    }
}
