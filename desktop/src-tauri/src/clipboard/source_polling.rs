use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc;

#[derive(Debug, Clone)]
pub enum ClipboardEvent {
    Text { content: String, mime: String },
    Image { png_bytes: Vec<u8> },
}

pub struct PollingSource {
    stop: Arc<AtomicBool>,
}

impl PollingSource {
    /// Runs the clipboard poll loop on a **dedicated OS thread** (not the tokio runtime).
    /// arboard's clipboard API is synchronous and on Wayland can block for hundreds of
    /// ms; running it on tokio would starve the Tauri webview event loop. The mpsc::Sender
    /// is non-blocking from the thread side via `try_send` / `blocking_send`.
    pub fn start(interval_ms: u64, paused: Arc<AtomicBool>) -> (Self, mpsc::Receiver<ClipboardEvent>) {
        let (tx, rx) = mpsc::channel(64);
        let stop = Arc::new(AtomicBool::new(false));
        let stop2 = stop.clone();
        thread::Builder::new()
            .name("clippy-clipboard-poll".into())
            .spawn(move || {
                let mut last_text: Option<String> = None;
                let mut last_img_hash: Option<String> = None;
                while !stop2.load(Ordering::Relaxed) {
                    thread::sleep(Duration::from_millis(interval_ms));
                    if paused.load(Ordering::Relaxed) {
                        continue;
                    }
                    // Re-create the clipboard handle each tick; some Wayland compositors
                    // invalidate it on focus changes.
                    let Ok(mut cb) = Clipboard::new() else { continue };
                    if let Ok(text) = cb.get_text() {
                        if Some(&text) != last_text.as_ref() && !text.is_empty() {
                            last_text = Some(text.clone());
                            let _ = tx.blocking_send(ClipboardEvent::Text {
                                content: text,
                                mime: "text/plain".into(),
                            });
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
                            if d.write_to(
                                &mut std::io::Cursor::new(&mut png),
                                image::ImageFormat::Png,
                            )
                            .is_ok()
                            {
                                let hash = crate::db::sha256_hex(&png);
                                if Some(&hash) != last_img_hash.as_ref() {
                                    last_img_hash = Some(hash);
                                    let _ = tx.blocking_send(ClipboardEvent::Image { png_bytes: png });
                                }
                            }
                        }
                    }
                }
            })
            .expect("spawn clipboard poll thread");
        (Self { stop }, rx)
    }
    pub fn stop(self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}
