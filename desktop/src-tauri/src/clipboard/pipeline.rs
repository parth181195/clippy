use super::{detect::detect_text, source_polling::ClipboardEvent, ContentType};
use crate::db::Db;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tracing::{debug, warn};

pub struct Pipeline {
    db: Arc<Mutex<Db>>,
    excluded: Vec<String>,
    history_size: i64,
    on_new_clip: Box<dyn Fn(i64, ContentType) + Send + Sync>,
}

impl Pipeline {
    pub fn new(
        db: Arc<Mutex<Db>>,
        excluded: Vec<String>,
        history_size: i64,
        on_new_clip: Box<dyn Fn(i64, ContentType) + Send + Sync>,
    ) -> Self {
        Self {
            db,
            excluded,
            history_size,
            on_new_clip,
        }
    }

    pub async fn run(
        self,
        mut rx: mpsc::Receiver<ClipboardEvent>,
        get_focused_app: impl Fn() -> Option<String>,
    ) {
        while let Some(ev) = rx.recv().await {
            let focused = get_focused_app();
            if let Some(ref app) = focused {
                if self.excluded.iter().any(|e| app.eq_ignore_ascii_case(e)) {
                    debug!("skipping capture from excluded app: {}", app);
                    continue;
                }
            }
            match ev {
                ClipboardEvent::Text { content, mime } => {
                    let ct = detect_text(&content, focused.as_deref());
                    let preview: String = content.chars().take(280).collect();
                    let mut db = self.db.lock().unwrap();
                    let now = ms_now();
                    match db.insert_clip(ct, content.as_bytes(), &mime, &preview, focused.as_deref(), now) {
                        Ok(ins) if ins.was_new => {
                            (self.on_new_clip)(ins.id, ct);
                            let _ = db.prune(self.history_size);
                        }
                        Ok(_) => debug!("dedup hit"),
                        Err(e) => warn!("insert failed: {e}"),
                    }
                }
                ClipboardEvent::Image { png_bytes } => {
                    let mut db = self.db.lock().unwrap();
                    let now = ms_now();
                    let preview = format!("Image {} bytes", png_bytes.len());
                    match db.insert_clip(
                        ContentType::Image,
                        &png_bytes,
                        "image/png",
                        &preview,
                        focused.as_deref(),
                        now,
                    ) {
                        Ok(ins) if ins.was_new => {
                            if let Ok(thumb) = crate::thumb::make_thumbnail(&png_bytes) {
                                let _ = db.set_thumbnail(ins.id, &thumb);
                            }
                            (self.on_new_clip)(ins.id, ContentType::Image);
                            let _ = db.prune(self.history_size);
                        }
                        _ => {}
                    }
                }
            }
        }
    }
}

fn ms_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}
