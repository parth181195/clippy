use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

#[derive(Debug, Clone)]
pub enum ClipboardEvent {
    Text { content: String, mime: String },
    Image { png_bytes: Vec<u8> },
}

pub struct PollingSource {
    handle: JoinHandle<()>,
    stop: Arc<AtomicBool>,
}

impl PollingSource {
    pub fn start(interval_ms: u64, paused: Arc<AtomicBool>) -> (Self, mpsc::Receiver<ClipboardEvent>) {
        let (tx, rx) = mpsc::channel(64);
        let stop = Arc::new(AtomicBool::new(false));
        let stop2 = stop.clone();
        let handle = tokio::spawn(async move {
            let mut last_text: Option<String> = None;
            let mut last_img_hash: Option<String> = None;
            loop {
                if stop2.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(interval_ms)).await;
                if paused.load(Ordering::Relaxed) {
                    continue;
                }
                let Ok(mut cb) = Clipboard::new() else { continue };
                if let Ok(text) = cb.get_text() {
                    if Some(&text) != last_text.as_ref() && !text.is_empty() {
                        last_text = Some(text.clone());
                        let _ = tx
                            .send(ClipboardEvent::Text {
                                content: text,
                                mime: "text/plain".into(),
                            })
                            .await;
                    }
                }
                if let Ok(img) = cb.get_image() {
                    let dyn_img = image::RgbaImage::from_raw(
                        img.width as u32,
                        img.height as u32,
                        img.bytes.into_owned(),
                    )
                    .map(image::DynamicImage::ImageRgba8);
                    if let Some(d) = dyn_img {
                        let mut png = Vec::new();
                        if d.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
                            .is_ok()
                        {
                            let hash = crate::db::sha256_hex(&png);
                            if Some(&hash) != last_img_hash.as_ref() {
                                last_img_hash = Some(hash);
                                let _ = tx.send(ClipboardEvent::Image { png_bytes: png }).await;
                            }
                        }
                    }
                }
            }
        });
        (Self { handle, stop }, rx)
    }
    pub fn stop(self) {
        self.stop.store(true, Ordering::Relaxed);
        self.handle.abort();
    }
}
