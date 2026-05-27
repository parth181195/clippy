use crate::clipboard::ContentType;
use notify_rust::Notification;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct Notifier {
    enabled: Arc<AtomicBool>,
}

impl Notifier {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(enabled)),
        }
    }
    pub fn set_enabled(&self, v: bool) {
        self.enabled.store(v, Ordering::Relaxed);
    }

    pub fn notify_capture(&self, ct: ContentType, preview: &str) {
        if !self.enabled.load(Ordering::Relaxed) {
            return;
        }
        let summary = match ct {
            ContentType::Text => "Text captured",
            ContentType::Link => "Link captured",
            ContentType::Code => "Code captured",
            ContentType::Color => "Color captured",
            ContentType::Emoji => "Emoji captured",
            ContentType::Image => "Image captured",
            ContentType::File => "File path captured",
        };
        let trimmed: String = preview.chars().take(140).collect();
        let _ = Notification::new()
            .summary(summary)
            .body(&trimmed)
            .appname("Clippy")
            .timeout(2500)
            .show();
    }
}
