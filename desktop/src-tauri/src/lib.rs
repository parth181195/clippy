use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tracing_subscriber::EnvFilter;

pub mod actions;
pub mod clipboard;
pub mod commands;
pub mod db;
pub mod dbus_app;
pub mod excluded_apps;
pub mod incognito;
pub mod link_preview;
pub mod notifications;
pub mod paste;
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

    let db_path = dirs::data_local_dir().unwrap().join("clippy/clippy.db");
    let db = Arc::new(Mutex::new(db::Db::open(&db_path).expect("open db")));
    let settings = settings::Settings::load(&db.lock().unwrap()).unwrap_or_default();
    let history_size = settings.history_size;
    let polling_ms = settings.polling_ms;

    let inc = Arc::new(incognito::Incognito::new(settings.incognito_auto_disable_secs));
    let inc_active = inc.active();

    let sound = Arc::new(sound::SoundPlayer::new(settings.sound_on_copy));
    let notif = Arc::new(notifications::Notifier::new(settings.notifications_on_copy));

    let app_state = commands::AppState { db: db.clone() };

    let inc_for_handler = inc.clone();
    let db_for_paste = db.clone();
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut: &Shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::F11) {
                        if let Some(w) = app.get_webview_window("panel") {
                            let visible = w.is_visible().unwrap_or(false);
                            let focused = w.is_focused().unwrap_or(false);
                            if visible && focused {
                                let _ = w.hide();
                            } else {
                                // Hide-then-show-then-focus is the most reliable on Mutter:
                                // a fresh map_request gets the compositor to give focus.
                                let _ = w.hide();
                                std::thread::sleep(std::time::Duration::from_millis(20));
                                let _ = w.show();
                                let _ = w.set_always_on_top(true);
                                let _ = w.set_focus();
                                let w2 = w.clone();
                                std::thread::spawn(move || {
                                    std::thread::sleep(std::time::Duration::from_millis(150));
                                    let _ = w2.set_always_on_top(false);
                                });
                            }
                        }
                    } else if shortcut.matches(Modifiers::CONTROL, Code::F11) {
                        let db_clone = db_for_paste.clone();
                        // Hide the panel first so the previously-focused app receives the paste,
                        // then synthesise Ctrl+V to that app.
                        if let Some(w) = app.get_webview_window("panel") {
                            let _ = w.hide();
                        }
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(50));
                            let row: Option<(i64, Vec<u8>, String)> = db_clone
                                .lock()
                                .unwrap()
                                .conn()
                                .query_row(
                                    "SELECT id, content, mime FROM clips ORDER BY created_at DESC LIMIT 1",
                                    [],
                                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                                )
                                .ok();
                            if let Some((id, content, mime)) = row {
                                match crate::paste::paste_to_active(&content, &mime, false) {
                                    Ok(()) => tracing::info!("Ctrl+F11: pasted clip id={id}"),
                                    Err(e) => tracing::warn!("paste failed: {e}"),
                                }
                            } else {
                                tracing::info!("Ctrl+F11: no clip to paste");
                            }
                        });
                    } else if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyI) {
                        let on = inc_for_handler.toggle();
                        tracing::info!("incognito: {}", if on { "ON" } else { "OFF" });
                    }
                })
                .build(),
        )
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::list_clips,
            commands::get_clip_content,
            commands::get_thumbnail,
            commands::toggle_favorite,
            commands::toggle_pin,
            commands::delete_clip,
            commands::save_edited_clip,
            commands::load_settings,
            commands::save_settings,
            commands::paste_by_id,
        ])
        .setup(move |app| {
            // Register hotkeys
            let panel_chord = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::F11);
            let paste_chord = Shortcut::new(Some(Modifiers::CONTROL), Code::F11);
            let inc_chord = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyI);
            app.global_shortcut().register(panel_chord)?;
            app.global_shortcut().register(paste_chord)?;
            app.global_shortcut().register(inc_chord)?;

            // Bottom-align the panel on the primary monitor.
            if let Some(w) = app.get_webview_window("panel") {
                if let Ok(Some(monitor)) = w.current_monitor() {
                    let scale = monitor.scale_factor();
                    let monitor_size = monitor.size();
                    let monitor_pos = monitor.position();
                    let window_size = w.outer_size().unwrap_or(tauri::PhysicalSize { width: 1280, height: 340 });
                    let margin: i32 = (16.0 * scale) as i32;
                    let x = monitor_pos.x + ((monitor_size.width as i32 - window_size.width as i32) / 2);
                    let y = monitor_pos.y + (monitor_size.height as i32 - window_size.height as i32 - margin);
                    let _ = w.set_position(tauri::PhysicalPosition { x, y });
                }
            }

            // Spawn clipboard polling pipeline
            let db2 = db.clone();
            let sound2 = sound.clone();
            let notif2 = notif.clone();
            let app_handle = app.handle().clone();
            let inc_active2 = inc_active.clone();
            tauri::async_runtime::spawn(async move {
                let (_src, rx) = clipboard::source_polling::PollingSource::start(
                    polling_ms,
                    inc_active2.clone(),
                );
                let excluded = excluded_apps::load_exclusions(&db2.lock().unwrap());
                let db_for_callback = db2.clone();
                let app_handle2 = app_handle.clone();
                let sound3 = sound2.clone();
                let notif3 = notif2.clone();
                let on_new = Box::new(move |id: i64, ct: clipboard::ContentType| {
                    sound3.play_copy();
                    let preview = db_for_callback
                        .lock()
                        .unwrap()
                        .conn()
                        .query_row(
                            "SELECT preview FROM clips WHERE id = ?1",
                            rusqlite::params![id],
                            |r| r.get::<_, String>(0),
                        )
                        .unwrap_or_default();
                    notif3.notify_capture(ct, &preview);
                    let _ = app_handle2.emit("clip-new", id);
                });
                let pipeline = clipboard::pipeline::Pipeline::new(
                    db2.clone(),
                    excluded,
                    history_size,
                    on_new,
                );
                pipeline.run(rx, excluded_apps::current_focused_app).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(false) = event {
                // Auto-hide on blur once Ctrl+F10 wiring is the primary toggle.
                // For dev convenience, keep visible while we iterate.
                let _ = window;
                let _ = event;
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
