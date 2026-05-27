use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Notify;

pub struct Incognito {
    active: Arc<AtomicBool>,
    notify: Arc<Notify>,
    auto_disable: Duration,
}

impl Incognito {
    pub fn new(auto_disable_secs: u64) -> Self {
        Self {
            active: Arc::new(AtomicBool::new(false)),
            notify: Arc::new(Notify::new()),
            auto_disable: Duration::from_secs(auto_disable_secs),
        }
    }
    pub fn active(&self) -> Arc<AtomicBool> {
        self.active.clone()
    }
    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed)
    }

    pub fn toggle(&self) -> bool {
        let prev = self.active.fetch_xor(true, Ordering::Relaxed);
        if !prev {
            let active = self.active.clone();
            let n = self.notify.clone();
            let d = self.auto_disable;
            tokio::spawn(async move {
                tokio::select! {
                    _ = tokio::time::sleep(d) => { active.store(false, Ordering::Relaxed); }
                    _ = n.notified() => {}
                }
            });
            true
        } else {
            self.notify.notify_waiters();
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test(flavor = "current_thread")]
    async fn auto_disables_after_timeout() {
        // Use millisecond timer for fast test; in production it's seconds.
        let inc = Incognito {
            active: Arc::new(AtomicBool::new(false)),
            notify: Arc::new(Notify::new()),
            auto_disable: Duration::from_millis(100),
        };
        assert!(inc.toggle());
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert!(!inc.is_active());
    }
    #[tokio::test(flavor = "current_thread")]
    async fn manual_toggle_off_cancels_timer() {
        let inc = Incognito::new(60);
        inc.toggle();
        inc.toggle();
        assert!(!inc.is_active());
    }
}
