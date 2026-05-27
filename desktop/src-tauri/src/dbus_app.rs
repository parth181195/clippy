use std::sync::Arc;
use tokio::sync::mpsc;
use zbus::{interface, ConnectionBuilder};

#[derive(Debug, Clone)]
pub enum AppCommand {
    TogglePanel,
    OpenSettings,
    SearchHistory(String),
    PasteByHash(String),
    RunActionByHash(String, i64),
    OpenEditor(String),
}

pub struct AppInterface {
    tx: Arc<mpsc::Sender<AppCommand>>,
}

#[interface(name = "io.clippy.App")]
impl AppInterface {
    async fn toggle_panel(&self) {
        let _ = self.tx.send(AppCommand::TogglePanel).await;
    }
    async fn open_settings(&self) {
        let _ = self.tx.send(AppCommand::OpenSettings).await;
    }
    async fn search_history(&self, query: &str) {
        let _ = self.tx.send(AppCommand::SearchHistory(query.into())).await;
    }
    async fn paste_by_hash(&self, hash: &str) {
        let _ = self.tx.send(AppCommand::PasteByHash(hash.into())).await;
    }
    async fn run_action_by_hash(&self, hash: &str, action_id: i64) {
        let _ = self.tx.send(AppCommand::RunActionByHash(hash.into(), action_id)).await;
    }
    async fn open_editor(&self, hash: &str) {
        let _ = self.tx.send(AppCommand::OpenEditor(hash.into())).await;
    }
}

pub async fn serve() -> zbus::Result<(zbus::Connection, mpsc::Receiver<AppCommand>)> {
    let (tx, rx) = mpsc::channel(32);
    let interface = AppInterface { tx: Arc::new(tx) };
    let conn = ConnectionBuilder::session()?
        .name("io.clippy.App")?
        .serve_at("/io/clippy/App", interface)?
        .build()
        .await?;
    Ok((conn, rx))
}
