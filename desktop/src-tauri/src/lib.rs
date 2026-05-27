use tracing_subscriber::EnvFilter;

pub mod clipboard;
pub mod db;
pub mod excluded_apps;
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
