use rodio::{Decoder, OutputStream, Sink};
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

const COPY_OGG: &[u8] = include_bytes!("../../assets/sounds/copy.ogg");

pub struct SoundPlayer {
    enabled: Arc<AtomicBool>,
}

impl SoundPlayer {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(enabled)),
        }
    }
    pub fn set_enabled(&self, v: bool) {
        self.enabled.store(v, Ordering::Relaxed);
    }
    pub fn play_copy(&self) {
        if !self.enabled.load(Ordering::Relaxed) {
            return;
        }
        std::thread::spawn(|| {
            let Ok((_stream, handle)) = OutputStream::try_default() else { return };
            let Ok(sink) = Sink::try_new(&handle) else { return };
            if let Ok(decoder) = Decoder::new(Cursor::new(COPY_OGG)) {
                sink.append(decoder);
                sink.sleep_until_end();
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn toggle_enabled_does_not_panic() {
        let p = SoundPlayer::new(true);
        p.set_enabled(false);
        p.play_copy();
    }
}
