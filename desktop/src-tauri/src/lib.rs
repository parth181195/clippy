use tracing_subscriber::EnvFilter;

pub mod actions;
pub mod clipboard;
pub mod db;
pub mod dbus_app;
pub mod excluded_apps;
pub mod incognito;
pub mod link_preview;
pub mod notifications;
pub mod settings;
pub mod sound;
pub mod thumb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,clippy=debug")),
        )
        .with_target(false)
        .init();
    tracing::info!("clippy starting");
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
