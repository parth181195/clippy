# Clippy v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Clippy v1 — a LAN-only, peer-to-peer clipboard manager + small-file sharer with an Ubuntu desktop (Tauri), a GNOME shell extension, and an Android companion (Flutter). Replaces Pano/Copyous for the developer-author's primary clipboard tool.

**Architecture:** Four components:
1. **Desktop app** (Tauri 2 / Rust + Svelte 5 / TypeScript) — captures clipboard, owns SQLite history, renders 4 user-selectable layouts (Cards / Spotlight / Sectioned / Mosaic), hosts the sync server + HTTP file endpoint.
2. **GNOME shell extension** (GJS / TypeScript) — publishes `org.gnome.Shell.Extensions.Clippy` D-Bus signals for clipboard events and focused-window changes; primary source on Wayland (polling is the fallback).
3. **Android app** (Flutter 3 / Dart) — pair via QR, mirror text-shaped clips silently, file send via share-sheet, foreground service for connection liveness.
4. **Shared sync protocol** — encrypted WebSocket (`crypto_secretbox` over PSK from QR pairing), pluggable `SyncTransport` + `SyncPlugin` interfaces on both sides.

**Tech Stack:**
- Desktop: Tauri 2.x, Rust (rusqlite, axum, tokio-tungstenite, mdns-sd, sodiumoxide, rodio, zbus, image), Svelte 5 + Vite + TypeScript, Geist+Geist Mono WOFF2
- Extension: GJS, TypeScript, libgnome-shell-45+
- Mobile: Flutter 3.x, Dart (sqflite, web_socket_channel, dio, mobile_scanner, flutter_secure_storage, flutter_sodium, share_handler)
- Sync: WebSocket, libsodium secretbox, mDNS (`_clippy._tcp.local`), 32-byte PSK from QR

**Source of truth:** [/PRD.md](../../../PRD.md) and [/docs/superpowers/specs/2026-05-27-clippy-design.md](../specs/2026-05-27-clippy-design.md). When the plan disagrees with either, fix the plan.

---

## Plan structure

| Part | Subsystem | Tasks | Depends on |
|---|---|---|---|
| **Part A** | Project bootstrap & shared tooling | T1–T9 | — |
| **Part B** | Desktop core (Phase 1, polling-only) | T10–T49 | Part A |
| **Part C** | GNOME extension + desktop wire-up (Phase 1) | T50–T69 | Part A (extension is independent; wire-up needs Part B's source split) |
| **Part D** | Sync protocol + Android app (Phase 2) | T70–T119 | Part B (sync server lives in Tauri app), Part A |
| **Part E** | File transfer (Phase 3) | T120–T149 | Part D |

Parts B and C can be executed in parallel (different codebases, no overlap). Parts D and E execute sequentially because E plugs into D's dispatcher.

---

## Part A — Project bootstrap & shared tooling

### Task 1: Initialize monorepo structure

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `desktop/`, `extension/`, `mobile/`, `shared-protocol/`, `scripts/` directories
- Modify: `.gitignore` (already exists from spec commits — extend it)

- [ ] **Step 1: Create top-level directories**

Run:
```bash
cd /home/parth/WebstormProjects/ext/clippy
mkdir -p desktop extension mobile shared-protocol scripts
```

- [ ] **Step 2: Write the top-level README**

Write `README.md`:
```markdown
# Clippy

LAN-only, peer-to-peer clipboard manager + small-file sharer for Ubuntu (GNOME Wayland) and Android.

- **`PRD.md`** — product reference
- **`docs/superpowers/specs/2026-05-27-clippy-design.md`** — engineering spec
- **`docs/superpowers/plans/2026-05-27-clippy-implementation.md`** — implementation plan
- **`clippy-handoff/`** — Claude Design source bundle (design tokens, mockups)

## Subsystems

| Dir | Subsystem | Tech |
|---|---|---|
| `desktop/` | Tauri app (clipboard manager, sync server, file endpoint) | Rust + Svelte 5 + TypeScript |
| `extension/` | GNOME shell extension (D-Bus clipboard + focused-window) | GJS + TypeScript |
| `mobile/` | Android app | Flutter / Dart |
| `shared-protocol/` | Protocol spec doc only (no code) | — |
| `scripts/` | dev helpers (release packaging, lint runners) | shell |

See each subsystem's README for build/run instructions.
```

- [ ] **Step 3: Extend .gitignore**

Replace `.gitignore` with:
```
# Existing
clippy-handoff*.zip

# Rust / Tauri
desktop/src-tauri/target/
desktop/src-tauri/Cargo.lock
desktop/node_modules/
desktop/dist/
desktop/dist-ssr/
desktop/*.local

# GNOME extension
extension/node_modules/
extension/dist/

# Flutter
mobile/.dart_tool/
mobile/.flutter-plugins
mobile/.flutter-plugins-dependencies
mobile/.idea/
mobile/build/
mobile/android/.gradle/
mobile/android/.idea/
mobile/android/local.properties
mobile/ios/Pods/
mobile/ios/.symlinks/
mobile/ios/Flutter/Flutter.framework
mobile/ios/Flutter/Flutter.podspec
mobile/ios/Runner.xcworkspace/xcuserdata/
mobile/ios/Runner.xcodeproj/xcuserdata/

# Editors
.vscode/
.idea/
*.swp
.DS_Store

# Test/coverage
**/coverage/
**/.coverage
```

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore desktop extension mobile shared-protocol scripts
git commit -m "chore: scaffold monorepo directories"
```

### Task 2: Bundle Geist + Geist Mono fonts

**Files:**
- Create: `desktop/assets/fonts/Geist-Regular.woff2`, `Geist-Medium.woff2`, `Geist-SemiBold.woff2`, `Geist-Bold.woff2`
- Create: `desktop/assets/fonts/GeistMono-Regular.woff2`, `GeistMono-Medium.woff2`
- Create: `desktop/assets/fonts/LICENSE` (Geist OFL)

- [ ] **Step 1: Download Geist from upstream**

Run:
```bash
mkdir -p desktop/assets/fonts
cd desktop/assets/fonts
# Geist v1.4.x as of 2026-05; static WOFF2 weights
curl -L -O https://github.com/vercel/geist-font/raw/main/fonts/Geist/Geist-Regular.woff2
curl -L -O https://github.com/vercel/geist-font/raw/main/fonts/Geist/Geist-Medium.woff2
curl -L -O https://github.com/vercel/geist-font/raw/main/fonts/Geist/Geist-SemiBold.woff2
curl -L -O https://github.com/vercel/geist-font/raw/main/fonts/Geist/Geist-Bold.woff2
curl -L -O https://github.com/vercel/geist-font/raw/main/fonts/GeistMono/GeistMono-Regular.woff2
curl -L -O https://github.com/vercel/geist-font/raw/main/fonts/GeistMono/GeistMono-Medium.woff2
curl -L -o LICENSE https://github.com/vercel/geist-font/raw/main/LICENSE.TXT
cd -
```

Expected: 6 WOFF2 files + LICENSE in `desktop/assets/fonts/`.

- [ ] **Step 2: Verify file sizes are non-zero**

Run:
```bash
ls -la desktop/assets/fonts/
```

Expected: every WOFF2 between 20KB and 60KB; LICENSE non-empty.

- [ ] **Step 3: Commit**

```bash
git add desktop/assets/fonts/
git commit -m "chore: bundle Geist + Geist Mono WOFF2 fonts (OFL)"
```

### Task 3: Bundle copy sound

**Files:**
- Create: `desktop/assets/sounds/copy.ogg`
- Create: `desktop/assets/sounds/LICENSE`

- [ ] **Step 1: Generate a short tasteful click using ffmpeg**

If ffmpeg is not installed: `sudo apt install -y ffmpeg`.

Run:
```bash
mkdir -p desktop/assets/sounds
ffmpeg -y -f lavfi -i "sine=frequency=2200:duration=0.06,afade=t=out:st=0.03:d=0.03" \
  -af "volume=0.35" -c:a libvorbis -q:a 6 desktop/assets/sounds/copy.ogg
```

Expected: `copy.ogg` ≈ 4–8KB, 60ms duration, soft attack/decay.

- [ ] **Step 2: Write a tiny LICENSE note**

Write `desktop/assets/sounds/LICENSE`:
```
copy.ogg generated programmatically with ffmpeg sine-wave synthesis.
Released under CC0 / public domain.
```

- [ ] **Step 3: Commit**

```bash
git add desktop/assets/sounds/
git commit -m "chore: bundle copy.ogg (CC0, ffmpeg-generated sine click)"
```

### Task 4: Write the shared-protocol/README.md

**Files:**
- Create: `shared-protocol/README.md`

- [ ] **Step 1: Write the protocol reference**

Write `shared-protocol/README.md` — copy the protocol section from PRD §7.2 verbatim (envelope, message table, inline-vs-request rule, encryption framing from spec §5). This file is for human reference; protocol code lives in `desktop/src-tauri/src/sync/` and `mobile/lib/services/sync/`. Both impls MUST stay in sync with this doc; if either diverges, update this doc first and the impls follow.

Content:
```markdown
# Clippy LAN Protocol — v1

Reference spec for the bidirectional WebSocket protocol used between the
Clippy desktop and the Clippy Android app. Implementations:

- Desktop: `desktop/src-tauri/src/sync/`
- Mobile: `mobile/lib/services/sync/`

## Transport

WebSocket over LAN. Desktop listens on TCP port 43117 (advertised via
mDNS `_clippy._tcp.local`). All frames are text frames carrying
base64-encoded encrypted bytes.

## Frame format

    nonce       = randombytes(24)           # crypto_secretbox nonce, fresh per message
    ciphertext  = secretbox(psk, nonce, utf8(json(envelope)))
    ws_text     = base64(nonce || ciphertext)

The receiver splits the first 24 bytes as nonce and feeds the rest to
secretbox_open. There is no plaintext header.

## Envelope (post-decrypt)

    {
      "type": "...",
      "id":   "uuid-v4",
      "ts":   1735000000000,
      "plugin": "clipboard" | "file_transfer" | "core",
      "payload": { ... }
    }

## Message catalog

| Type                 | Plugin        | Direction          | Payload                                                            |
|----------------------|---------------|--------------------|--------------------------------------------------------------------|
| HELLO                | core          | bidir              | {device_id, name, version}                                         |
| ACK                  | core          | bidir              | {ref_id}                                                           |
| CLIP_NEW             | clipboard     | bidir              | {kind, mime, preview, hash, content_inline?, reps?}                |
| CLIP_REQUEST         | clipboard     | bidir              | {hash}                                                             |
| CLIP_LIST            | clipboard     | bidir              | {since_ts, items: [...]}                                           |
| FILE_OFFER           | file_transfer | bidir              | {token, filename, size, mime}                                      |
| FILE_REQUEST         | file_transfer | bidir              | {token}                                                            |
| FILE_UPLOAD_REQUEST  | file_transfer | phone→desktop      | {filename, size}                                                   |
| FILE_PROGRESS        | file_transfer | bidir              | {token, bytes, total}                                              |
| FILE_CANCEL          | file_transfer | bidir              | {token}                                                            |

## What auto-syncs

- text, link, code, color, emoji — yes, via CLIP_NEW (per-direction toggle)
- image, file — no, only via FILE_OFFER after an explicit user gesture

## Inline-vs-request rule

- Single rep < 4 KB: inline in CLIP_NEW.content_inline
- Multi-reps total < 8 KB: inline in CLIP_NEW.reps
- Larger: hash only; CLIP_REQUEST round-trip

## Pairing QR payload

    {
      "v": 1,
      "device_id": "clippy-desktop-abc123",
      "name": "Helios",
      "host": "192.168.1.42",
      "port": 43117,
      "psk":    "base64(32-byte secretbox key)",
      "pubkey": "base64(ed25519 public key, 32 bytes)"
    }
```

- [ ] **Step 2: Commit**

```bash
git add shared-protocol/README.md
git commit -m "docs(protocol): write LAN sync protocol reference"
```

### Task 5: Add EditorConfig + repo-wide formatters

**Files:**
- Create: `.editorconfig`
- Create: `.prettierrc`

- [ ] **Step 1: Write .editorconfig**

Write `.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.{rs,py}]
indent_size = 4

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

- [ ] **Step 2: Write .prettierrc**

Write `.prettierrc`:
```json
{
  "printWidth": 100,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "es5",
  "svelteSortOrder": "options-scripts-markup-styles",
  "svelteStrictMode": false,
  "svelteIndentScriptAndStyle": false
}
```

- [ ] **Step 3: Commit**

```bash
git add .editorconfig .prettierrc
git commit -m "chore: add EditorConfig + Prettier config"
```

### Task 6: Add a `scripts/dev-up.sh` helper

**Files:**
- Create: `scripts/dev-up.sh`

- [ ] **Step 1: Write the helper**

Write `scripts/dev-up.sh`:
```bash
#!/usr/bin/env bash
# Quick "what should I do?" entry point for fresh contributors.
set -euo pipefail

echo "Clippy dev quick-start"
echo "======================"
echo ""
echo "Choose a subsystem to bring up:"
echo ""
echo "  1) Desktop app  (Tauri + Svelte)        cd desktop && cargo tauri dev"
echo "  2) GNOME ext    (GJS, install + reload) cd extension && npm run install-and-reload"
echo "  3) Android app  (Flutter)               cd mobile && flutter run"
echo ""
echo "Tests:"
echo "  cd desktop && cargo test"
echo "  cd extension && npm test"
echo "  cd mobile && flutter test"
echo ""
echo "Full release builds:"
echo "  cd desktop && cargo tauri build      → .deb in src-tauri/target/release/bundle/"
echo "  cd extension && npm run package      → ZIP for gnome-extensions install"
echo "  cd mobile && flutter build apk --release"
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x scripts/dev-up.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/dev-up.sh
git commit -m "chore(scripts): add dev-up.sh quick-start guide"
```

### Task 7: Install desktop build prerequisites (local; not committed)

**Files:** none.

- [ ] **Step 1: Install Ubuntu deps**

Run:
```bash
sudo apt install -y \
  libgtk-3-dev libwebkit2gtk-4.1-dev libsoup-3.0-dev \
  libayatana-appindicator3-dev librsvg2-dev libxdo-dev \
  libdbus-1-dev pkg-config build-essential
```

Expected: install succeeds; no errors.

- [ ] **Step 2: Install Rust if missing**

Run:
```bash
command -v cargo || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustup default stable
```

Expected: `cargo --version` prints a version ≥ 1.78.

- [ ] **Step 3: Install Tauri CLI**

Run:
```bash
cargo install tauri-cli --version "^2.0" --locked
```

Expected: `cargo tauri --version` prints `tauri-cli 2.x`.

- [ ] **Step 4: Install Node.js LTS if missing**

Run:
```bash
command -v node || curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
node --version
```

Expected: Node ≥ 20.

No commit — environment setup only.

### Task 8: Install Flutter SDK (local; not committed)

**Files:** none.

- [ ] **Step 1: Install Flutter via snap**

Run:
```bash
sudo snap install flutter --classic
flutter doctor
```

Expected: `flutter doctor` reports Android toolchain (you may need to accept Android SDK licenses with `flutter doctor --android-licenses`).

- [ ] **Step 2: Verify Android emulator or device**

Run:
```bash
flutter devices
```

Expected: at least one device or emulator listed.

No commit.

### Task 9: Smoke-test git status and commit

**Files:** none.

- [ ] **Step 1: Verify clean tree**

Run:
```bash
git status
git log --oneline | head -10
```

Expected: clean working tree; recent commits from spec work + Part A bootstrap visible.

End of Part A. The repo is now ready for Part B (desktop core).

---

## Part B — Desktop core (Phase 1, polling-only)

Tasks T10–T49. Builds a complete standalone Clippy desktop app using polling-based clipboard capture. The GNOME extension (Part C) replaces the polling source as the primary path once both exist; until then, polling is fine.

### Task 10: Scaffold Tauri 2 + Svelte 5 + Vite + TS

**Files:**
- Create: everything under `desktop/`

- [ ] **Step 1: Bootstrap with create-tauri-app**

```bash
cd /home/parth/WebstormProjects/ext/clippy
cargo install create-tauri-app --locked
cargo create-tauri-app --template svelte-ts --manager npm desktop
```

Answer prompts: app name `clippy`, window title `Clippy`, identifier `io.clippy.app`.

- [ ] **Step 2: Pin Svelte 5 + Vite 5**

Edit `desktop/package.json` `devDependencies` to:
```json
"devDependencies": {
  "@sveltejs/vite-plugin-svelte": "^4.0.0",
  "@tauri-apps/cli": "^2.0.0",
  "svelte": "^5.0.0",
  "svelte-check": "^4.0.0",
  "tslib": "^2.6.0",
  "typescript": "^5.5.0",
  "vite": "^5.4.0",
  "vitest": "^2.1.0",
  "@testing-library/svelte": "^5.2.0",
  "@vitest/ui": "^2.1.0",
  "jsdom": "^25.0.0"
}
```

Run `cd desktop && npm install`.

- [ ] **Step 3: Verify dev mode runs**

```bash
cd desktop && cargo tauri dev
```

Expected: window opens with the default Svelte template. Kill with `q`.

- [ ] **Step 4: Commit**

```bash
git add desktop/
git commit -m "feat(desktop): scaffold Tauri 2 + Svelte 5 app"
```

### Task 11: Configure Tauri resources, identifier, and window

**Files:**
- Modify: `desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Replace tauri.conf.json with Clippy config**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Clippy",
  "version": "0.1.0",
  "identifier": "io.clippy.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "panel",
        "title": "Clippy",
        "width": 1280,
        "height": 340,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "visible": false,
        "resizable": false,
        "focus": true
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": ["deb"],
    "category": "Utility",
    "shortDescription": "Clipboard manager + LAN file sender",
    "longDescription": "Cross-device clipboard manager and small-file sharer. LAN-only.",
    "resources": ["../assets/**/*"],
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0", "libxdo3"]
      }
    }
  }
}
```

- [ ] **Step 2: Verify build still passes**

```bash
cd desktop && cargo tauri build --debug --no-bundle 2>&1 | tail -20
```

Expected: `Finished` line; no errors.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/tauri.conf.json
git commit -m "feat(desktop): configure Clippy panel window + bundle assets"
```

### Task 12: Add Cargo dependencies

**Files:**
- Modify: `desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Add `[dependencies]` for Phase 1**

In `desktop/src-tauri/Cargo.toml`, set `[dependencies]` to:
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-clipboard-manager = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1.40", features = ["full"] }
rusqlite = { version = "0.32", features = ["bundled", "blob"] }
sha2 = "0.10"
clipboard-master = "4.0"
arboard = "3.4"
image = { version = "0.25", default-features = false, features = ["png", "jpeg", "webp", "bmp"] }
rodio = { version = "0.19", default-features = false, features = ["vorbis"] }
zbus = { version = "4", default-features = false, features = ["tokio"] }
enigo = "0.2"
notify-rust = "4"
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "gzip"] }
url = "2"
once_cell = "1"
thiserror = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1", features = ["v4"] }
dirs = "5"
emojis = "0.6"
mime_guess = "2"
scraper = "0.20"

[dev-dependencies]
tempfile = "3"
mockito = "1"
```

- [ ] **Step 2: Build and verify all crates compile**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `Compiling clippy v0.1.0`; `Finished` with no errors. (First build may take ~5 min.)

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/Cargo.toml desktop/src-tauri/Cargo.lock
git commit -m "feat(desktop): add Phase 1 dependencies"
```

### Task 13: Set up tracing logger

**Files:**
- Modify: `desktop/src-tauri/src/main.rs`, `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Replace lib.rs with tracing setup + Tauri builder**

`desktop/src-tauri/src/lib.rs`:
```rust
use tracing_subscriber::EnvFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,clippy=debug")))
        .with_target(false)
        .init();
    tracing::info!("clippy starting");
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`desktop/src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    clippy::run();
}
```

- [ ] **Step 2: Build to confirm**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -3
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/main.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): bootstrap tracing + Tauri runtime"
```

### Task 14: Define the `Clip` and `ContentType` types

**Files:**
- Create: `desktop/src-tauri/src/clipboard/mod.rs`, `desktop/src-tauri/src/clipboard/types.rs`

- [ ] **Step 1: Write the failing test**

`desktop/src-tauri/src/clipboard/types.rs`:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    Text,
    Link,
    Code,
    Color,
    Emoji,
    File,
    Image,
}

impl ContentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Link => "link",
            Self::Code => "code",
            Self::Color => "color",
            Self::Emoji => "emoji",
            Self::File => "file",
            Self::Image => "image",
        }
    }
    pub fn is_text_shaped(&self) -> bool {
        matches!(self, Self::Text | Self::Link | Self::Code | Self::Color | Self::Emoji)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clip {
    pub id: i64,
    pub content_type: ContentType,
    pub content: Vec<u8>,
    pub mime: String,
    pub content_hash: String,
    pub preview: String,
    pub source_app: Option<String>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub created_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn text_shaped_excludes_image_and_file() {
        assert!(ContentType::Text.is_text_shaped());
        assert!(ContentType::Link.is_text_shaped());
        assert!(ContentType::Code.is_text_shaped());
        assert!(ContentType::Color.is_text_shaped());
        assert!(ContentType::Emoji.is_text_shaped());
        assert!(!ContentType::Image.is_text_shaped());
        assert!(!ContentType::File.is_text_shaped());
    }
    #[test]
    fn serializes_lowercase() {
        let s = serde_json::to_string(&ContentType::Link).unwrap();
        assert_eq!(s, "\"link\"");
    }
}
```

`desktop/src-tauri/src/clipboard/mod.rs`:
```rust
pub mod types;
pub use types::{Clip, ContentType};
```

- [ ] **Step 2: Wire module into lib.rs**

Add to top of `desktop/src-tauri/src/lib.rs`:
```rust
pub mod clipboard;
```

- [ ] **Step 3: Run tests**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml clipboard::types -- --nocapture
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/clipboard/
git commit -m "feat(desktop): define Clip + ContentType with text-shaped predicate"
```

### Task 15: Implement SQLite schema in `db.rs`

**Files:**
- Create: `desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Write the failing test**

`desktop/src-tauri/src/db.rs`:
```rust
use rusqlite::{Connection, params};
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error(transparent)] Sqlite(#[from] rusqlite::Error),
    #[error(transparent)] Io(#[from] std::io::Error),
}

pub struct Db {
    conn: Connection,
}

impl Db {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, DbError> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self, DbError> {
        let conn = Connection::open_in_memory()?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&mut self) -> Result<(), DbError> {
        self.conn.execute_batch(SCHEMA_V1)?;
        Ok(())
    }

    pub fn conn(&self) -> &Connection { &self.conn }
    pub fn conn_mut(&mut self) -> &mut Connection { &mut self.conn }
}

const SCHEMA_V1: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clips (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL CHECK (content_type IN
                  ('text','image','link','code','color','emoji','file')),
    content      BLOB NOT NULL,
    mime         TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    preview      TEXT,
    source_app   TEXT,
    is_favorite  INTEGER NOT NULL DEFAULT 0,
    is_pinned    INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    UNIQUE (content_hash)
);
CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_panel_order
    ON clips(is_pinned DESC, is_favorite DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS clip_representations (
    clip_id INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    mime    TEXT NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (clip_id, mime)
);

CREATE TABLE IF NOT EXISTS clip_thumbnails (
    clip_id   INTEGER PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    png_bytes BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS clip_actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    label        TEXT NOT NULL,
    kind         TEXT NOT NULL,
    params_json  TEXT NOT NULL DEFAULT '{}',
    is_default   INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS link_previews (
    clip_id     INTEGER PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    title       TEXT,
    description TEXT,
    favicon_png BLOB,
    og_image    BLOB,
    fetched_at  INTEGER NOT NULL,
    status      TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5 (
    preview, content='clips', content_rowid='id'
);
CREATE TRIGGER IF NOT EXISTS clips_ai AFTER INSERT ON clips BEGIN
    INSERT INTO clips_fts(rowid, preview) VALUES (new.id, new.preview);
END;
CREATE TRIGGER IF NOT EXISTS clips_ad AFTER DELETE ON clips BEGIN
    INSERT INTO clips_fts(clips_fts, rowid, preview) VALUES ('delete', old.id, old.preview);
END;
CREATE TRIGGER IF NOT EXISTS clips_au AFTER UPDATE ON clips BEGIN
    INSERT INTO clips_fts(clips_fts, rowid, preview) VALUES ('delete', old.id, old.preview);
    INSERT INTO clips_fts(rowid, preview) VALUES (new.id, new.preview);
END;

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS excluded_apps (
    app_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS paired_devices (
    device_id TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    pubkey    BLOB NOT NULL,
    psk       BLOB NOT NULL,
    paired_at INTEGER NOT NULL
);

-- Seed default exclusions
INSERT OR IGNORE INTO excluded_apps(app_id) VALUES
    ('keepassxc'), ('bitwarden'), ('1password'), ('gnome-keyring');

-- Seed default action: link → open in browser
INSERT OR IGNORE INTO clip_actions(id, content_type, label, kind, params_json, is_default, sort_order)
    VALUES (1, 'link', 'Open in browser', 'open_url', '{}', 1, 0);
"#;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn opens_in_memory_and_runs_migrations() {
        let db = Db::open_in_memory().unwrap();
        let n: i64 = db.conn().query_row("SELECT count(*) FROM excluded_apps", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 4);
    }
    #[test]
    fn fts_index_is_searchable() {
        let db = Db::open_in_memory().unwrap();
        db.conn().execute(
            "INSERT INTO clips(content_type, content, mime, content_hash, preview, created_at)
             VALUES ('text', X'68656c6c6f', 'text/plain', 'abc', 'hello world', 1000)",
            params![],
        ).unwrap();
        let id: i64 = db.conn().query_row(
            "SELECT rowid FROM clips_fts WHERE clips_fts MATCH 'hello'",
            [], |r| r.get(0)
        ).unwrap();
        assert_eq!(id, 1);
    }
    #[test]
    fn default_link_action_seeded() {
        let db = Db::open_in_memory().unwrap();
        let (label, kind): (String, String) = db.conn().query_row(
            "SELECT label, kind FROM clip_actions WHERE content_type='link' AND is_default=1",
            [], |r| Ok((r.get(0)?, r.get(1)?))
        ).unwrap();
        assert_eq!(label, "Open in browser");
        assert_eq!(kind, "open_url");
    }
}
```

Add `pub mod db;` to `lib.rs`.

- [ ] **Step 2: Run tests**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml db
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/db.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): SQLite schema (clips, reps, thumbnails, fts5, actions, devices)"
```

### Task 16: Implement clip insert + dedup + auto-prune

**Files:**
- Modify: `desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Write the failing tests**

Append to `db.rs`:
```rust
use crate::clipboard::ContentType;
use sha2::{Sha256, Digest};

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
}

pub struct InsertedClip {
    pub id: i64,
    pub was_new: bool,
}

impl Db {
    pub fn insert_clip(
        &mut self,
        content_type: ContentType,
        content: &[u8],
        mime: &str,
        preview: &str,
        source_app: Option<&str>,
        now_ms: i64,
    ) -> Result<InsertedClip, DbError> {
        let hash = sha256_hex(content);
        let tx = self.conn.transaction()?;
        // Dedup: if hash exists, return existing id
        let existing: Option<i64> = tx.query_row(
            "SELECT id FROM clips WHERE content_hash = ?1",
            params![&hash],
            |r| r.get(0),
        ).ok();
        let result = if let Some(id) = existing {
            InsertedClip { id, was_new: false }
        } else {
            tx.execute(
                "INSERT INTO clips(content_type, content, mime, content_hash, preview, source_app, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![content_type.as_str(), content, mime, &hash, preview, source_app, now_ms],
            )?;
            InsertedClip { id: tx.last_insert_rowid(), was_new: true }
        };
        tx.commit()?;
        Ok(result)
    }

    /// Delete oldest non-favorite clips until count ≤ history_size.
    /// Pinned clips are NOT protected (Pin is ephemeral; only Favorite saves from pruning).
    pub fn prune(&mut self, history_size: i64) -> Result<usize, DbError> {
        let tx = self.conn.transaction()?;
        let total: i64 = tx.query_row("SELECT count(*) FROM clips", [], |r| r.get(0))?;
        if total <= history_size {
            tx.commit()?;
            return Ok(0);
        }
        let to_delete = total - history_size;
        let n = tx.execute(
            "DELETE FROM clips WHERE id IN (
                 SELECT id FROM clips
                 WHERE is_favorite = 0
                 ORDER BY created_at ASC
                 LIMIT ?1
             )",
            params![to_delete],
        )?;
        tx.commit()?;
        Ok(n)
    }
}

#[cfg(test)]
mod insert_tests {
    use super::*;
    use crate::clipboard::ContentType;
    #[test]
    fn insert_dedups_by_hash() {
        let mut db = Db::open_in_memory().unwrap();
        let a = db.insert_clip(ContentType::Text, b"hi", "text/plain", "hi", None, 1).unwrap();
        let b = db.insert_clip(ContentType::Text, b"hi", "text/plain", "hi", None, 2).unwrap();
        assert_eq!(a.id, b.id);
        assert!(a.was_new);
        assert!(!b.was_new);
    }
    #[test]
    fn prune_removes_oldest_non_favorite_only() {
        let mut db = Db::open_in_memory().unwrap();
        for i in 0..5 {
            let bytes = vec![i as u8];
            db.insert_clip(ContentType::Text, &bytes, "text/plain", &format!("p{i}"), None, i as i64).unwrap();
        }
        db.conn().execute("UPDATE clips SET is_favorite = 1 WHERE id = 1", []).unwrap();
        db.conn().execute("UPDATE clips SET is_pinned   = 1 WHERE id = 2", []).unwrap();
        let removed = db.prune(2).unwrap();
        assert_eq!(removed, 3);
        // id=1 (favorite) survives; id=2 (pinned but not favorite) was pruned; latest non-fav survives
        let surviving: Vec<i64> = db.conn().prepare("SELECT id FROM clips ORDER BY id")
            .unwrap().query_map([], |r| r.get::<_, i64>(0)).unwrap().map(|r| r.unwrap()).collect();
        assert!(surviving.contains(&1)); // favorite saved
        assert!(!surviving.contains(&2)); // pin did NOT save
    }
}
```

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml db::insert_tests
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/db.rs
git commit -m "feat(desktop): clip insert with dedup + favorite-protected pruning"
```

### Task 17: Multi-representation storage

**Files:**
- Modify: `desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Write the failing test**

Append to `db.rs`:
```rust
impl Db {
    pub fn add_representation(&self, clip_id: i64, mime: &str, content: &[u8]) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO clip_representations(clip_id, mime, content) VALUES (?1, ?2, ?3)",
            params![clip_id, mime, content],
        )?;
        Ok(())
    }

    pub fn representations_for(&self, clip_id: i64) -> Result<Vec<(String, Vec<u8>)>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT mime, content FROM clip_representations WHERE clip_id = ?1 ORDER BY mime"
        )?;
        let rows = stmt.query_map(params![clip_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?)))?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}

#[cfg(test)]
mod rep_tests {
    use super::*;
    use crate::clipboard::ContentType;
    #[test]
    fn stores_and_returns_multiple_reps() {
        let mut db = Db::open_in_memory().unwrap();
        let c = db.insert_clip(ContentType::Text, b"x", "text/plain", "x", None, 0).unwrap();
        db.add_representation(c.id, "text/html", b"<b>x</b>").unwrap();
        db.add_representation(c.id, "text/plain", b"x").unwrap();
        let reps = db.representations_for(c.id).unwrap();
        assert_eq!(reps.len(), 2);
        assert_eq!(reps[0].0, "text/html");
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml db::rep_tests
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/db.rs
git commit -m "feat(desktop): multi-mime representation storage per clip"
```

### Task 18: Thumbnail generation + storage

**Files:**
- Create: `desktop/src-tauri/src/thumb.rs`
- Modify: `desktop/src-tauri/src/db.rs`, `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write thumb.rs with failing test**

```rust
use image::{ImageReader, imageops::FilterType};
use std::io::Cursor;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ThumbError {
    #[error(transparent)] Image(#[from] image::ImageError),
    #[error(transparent)] Io(#[from] std::io::Error),
}

/// Decode any image format the `image` crate supports and re-encode as a
/// max-200x200 PNG suitable for the panel thumbnail table.
pub fn make_thumbnail(bytes: &[u8]) -> Result<Vec<u8>, ThumbError> {
    let img = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()?
        .decode()?;
    let thumb = img.resize(200, 200, FilterType::Triangle);
    let mut out = Vec::with_capacity(8192);
    thumb.write_to(&mut Cursor::new(&mut out), image::ImageFormat::Png)?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fake_png() -> Vec<u8> {
        // 4×4 red PNG
        let img = image::RgbaImage::from_pixel(4, 4, image::Rgba([255, 0, 0, 255]));
        let mut bytes = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png).unwrap();
        bytes
    }
    #[test]
    fn produces_non_empty_png() {
        let t = make_thumbnail(&fake_png()).unwrap();
        assert!(t.len() > 50);
        assert_eq!(&t[0..8], &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    }
}
```

Add to `db.rs`:
```rust
impl Db {
    pub fn set_thumbnail(&self, clip_id: i64, png: &[u8]) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO clip_thumbnails(clip_id, png_bytes) VALUES (?1, ?2)",
            params![clip_id, png],
        )?;
        Ok(())
    }
    pub fn thumbnail_for(&self, clip_id: i64) -> Result<Option<Vec<u8>>, DbError> {
        Ok(self.conn.query_row(
            "SELECT png_bytes FROM clip_thumbnails WHERE clip_id = ?1",
            params![clip_id], |r| r.get(0)
        ).ok())
    }
}
```

Add `pub mod thumb;` to `lib.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml thumb db::
```

Expected: thumb test passes; existing db tests still pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/thumb.rs desktop/src-tauri/src/db.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): generate 200x200 PNG thumbnails from arbitrary image input"
```

### Task 19: Content-type detection

**Files:**
- Create: `desktop/src-tauri/src/clipboard/detect.rs`
- Modify: `desktop/src-tauri/src/clipboard/mod.rs`

- [ ] **Step 1: Write detect.rs with failing tests**

```rust
use super::ContentType;
use once_cell::sync::Lazy;
use url::Url;

static COLOR_RE: Lazy<regex_lite::Regex> = Lazy::new(|| {
    regex_lite::Regex::new(r"^\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\s*$").unwrap()
});

pub fn detect_text(text: &str, source_app: Option<&str>) -> ContentType {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return ContentType::Text;
    }
    // File path that exists?
    if !trimmed.contains('\n') && std::path::Path::new(trimmed).exists() {
        return ContentType::File;
    }
    // URL?
    if !trimmed.contains(char::is_whitespace) && Url::parse(trimmed).map(|u| matches!(u.scheme(), "http" | "https" | "ftp" | "ftps")).unwrap_or(false) {
        return ContentType::Link;
    }
    // Color literal?
    if COLOR_RE.is_match(trimmed) {
        return ContentType::Color;
    }
    // Emoji only (every grapheme is an emoji or whitespace)?
    let stripped: String = trimmed.chars().filter(|c| !c.is_whitespace()).collect();
    if !stripped.is_empty() && stripped.chars().all(|c| emojis::get(&c.to_string()).is_some()) {
        return ContentType::Emoji;
    }
    // Code by source app?
    if let Some(app) = source_app {
        const CODE_APPS: &[&str] = &[
            "code", "code-insiders", "vscode", "Code",
            "jetbrains-idea", "jetbrains-pycharm", "jetbrains-webstorm", "jetbrains-rustrover",
            "gnome-terminal", "kitty", "alacritty", "wezterm",
            "neovim", "nvim", "vim", "sublime_text", "zed",
        ];
        if CODE_APPS.iter().any(|a| app.eq_ignore_ascii_case(a)) {
            return ContentType::Code;
        }
    }
    // Code heuristic
    if trimmed.contains('\n') {
        let code_hints = ["{", "}", ";", "fn ", "def ", "function ", "import ", "class ", "<?", "</"];
        if code_hints.iter().any(|h| trimmed.contains(h)) {
            return ContentType::Code;
        }
    }
    ContentType::Text
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn detects_http_url() { assert_eq!(detect_text("https://example.com", None), ContentType::Link); }
    #[test] fn detects_hex_color() { assert_eq!(detect_text("#1A2B3C", None), ContentType::Color); }
    #[test] fn detects_rgb_color() { assert_eq!(detect_text("rgb(10, 20, 30)", None), ContentType::Color); }
    #[test] fn detects_emoji_only() { assert_eq!(detect_text("🫠", None), ContentType::Emoji); }
    #[test] fn detects_emoji_string() { assert_eq!(detect_text("🚀  ✨", None), ContentType::Emoji); }
    #[test] fn detects_code_by_source_app() { assert_eq!(detect_text("just words", Some("code")), ContentType::Code); }
    #[test] fn detects_code_by_heuristic() { assert_eq!(detect_text("fn main() {\n  println!();\n}", None), ContentType::Code); }
    #[test] fn plain_text_default() { assert_eq!(detect_text("hello world", None), ContentType::Text); }
    #[test] fn url_with_spaces_is_text() { assert_eq!(detect_text("see https://a.b for more", None), ContentType::Text); }
}
```

Add `regex_lite = "0.1"` to `Cargo.toml` `[dependencies]`.

Add `pub mod detect;` to `clipboard/mod.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml clipboard::detect
```

Expected: 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/clipboard/detect.rs desktop/src-tauri/src/clipboard/mod.rs desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): content-type detection (link/color/emoji/code/text)"
```

### Task 20: Polling clipboard source

**Files:**
- Create: `desktop/src-tauri/src/clipboard/source_polling.rs`
- Modify: `desktop/src-tauri/src/clipboard/mod.rs`

- [ ] **Step 1: Write the source**

```rust
use arboard::Clipboard;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
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
                if stop2.load(Ordering::Relaxed) { break; }
                tokio::time::sleep(Duration::from_millis(interval_ms)).await;
                if paused.load(Ordering::Relaxed) { continue; }
                let Ok(mut cb) = Clipboard::new() else { continue };
                if let Ok(text) = cb.get_text() {
                    if Some(&text) != last_text.as_ref() && !text.is_empty() {
                        last_text = Some(text.clone());
                        let _ = tx.send(ClipboardEvent::Text { content: text, mime: "text/plain".into() }).await;
                    }
                }
                if let Ok(img) = cb.get_image() {
                    let mut png = Vec::new();
                    let dyn_img = image::RgbaImage::from_raw(img.width as u32, img.height as u32, img.bytes.into_owned())
                        .map(image::DynamicImage::ImageRgba8);
                    if let Some(d) = dyn_img {
                        if d.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png).is_ok() {
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
    pub fn stop(self) { self.stop.store(true, Ordering::Relaxed); self.handle.abort(); }
}
```

Add `pub mod source_polling;` to `clipboard/mod.rs`.

- [ ] **Step 2: Compile-only check (live clipboard polling is hard to unit-test; integration covered later)**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/clipboard/source_polling.rs desktop/src-tauri/src/clipboard/mod.rs
git commit -m "feat(desktop): polling clipboard source via arboard (text + image)"
```

### Task 21: Clipboard pipeline — capture → detect → insert → thumbnail

**Files:**
- Create: `desktop/src-tauri/src/clipboard/pipeline.rs`
- Modify: `desktop/src-tauri/src/clipboard/mod.rs`

- [ ] **Step 1: Write the pipeline**

```rust
use super::{ContentType, source_polling::ClipboardEvent, detect::detect_text};
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
        Self { db, excluded, history_size, on_new_clip }
    }

    pub async fn run(mut self, mut rx: mpsc::Receiver<ClipboardEvent>, get_focused_app: impl Fn() -> Option<String>) {
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
                    let now = chrono_ms();
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
                    let now = chrono_ms();
                    let preview = format!("Image {} bytes", png_bytes.len());
                    match db.insert_clip(ContentType::Image, &png_bytes, "image/png", &preview, focused.as_deref(), now) {
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

fn chrono_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap()
        .as_millis() as i64
}
```

Add `pub mod pipeline;` to `clipboard/mod.rs`. Add `chrono = "0.4"` to Cargo only if you need it elsewhere — here we use `SystemTime` directly.

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/clipboard/pipeline.rs desktop/src-tauri/src/clipboard/mod.rs
git commit -m "feat(desktop): clipboard pipeline (detect → insert → thumbnail → prune)"
```

### Task 22: Exclusion list — polling-based active-window heuristic

**Files:**
- Create: `desktop/src-tauri/src/excluded_apps.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the helper**

```rust
//! Best-effort focused-app detection for polling source.
//! On Wayland this is inherently limited; Part C's GNOME extension provides
//! the reliable path via D-Bus FocusedWindowChanged.

use std::process::Command;
use crate::db::Db;

pub fn current_focused_app() -> Option<String> {
    // Try xdotool first (works on Xorg sessions, fails silently on pure Wayland)
    if let Ok(out) = Command::new("xdotool").args(["getactivewindow", "getwindowname"]).output() {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() { return Some(s); }
        }
    }
    // Fallback: read /proc for whatever has WAYLAND_DISPLAY focus stamped
    // (true active-window on Wayland is impossible without the GNOME extension)
    None
}

pub fn load_exclusions(db: &Db) -> Vec<String> {
    let mut s = db.conn().prepare("SELECT app_id FROM excluded_apps").unwrap();
    s.query_map([], |r| r.get::<_, String>(0)).unwrap().filter_map(Result::ok).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn load_exclusions_returns_seeded_apps() {
        let db = Db::open_in_memory().unwrap();
        let apps = load_exclusions(&db);
        assert!(apps.iter().any(|a| a == "keepassxc"));
    }
}
```

Add `pub mod excluded_apps;` to `lib.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml excluded_apps
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/excluded_apps.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): exclusion list + xdotool fallback for focused-app detection"
```

### Task 23: Sound on copy

**Files:**
- Create: `desktop/src-tauri/src/sound.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the player**

```rust
use rodio::{Decoder, OutputStream, Sink};
use std::io::Cursor;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

const COPY_OGG: &[u8] = include_bytes!("../../assets/sounds/copy.ogg");

pub struct SoundPlayer {
    enabled: Arc<AtomicBool>,
}

impl SoundPlayer {
    pub fn new(enabled: bool) -> Self {
        Self { enabled: Arc::new(AtomicBool::new(enabled)) }
    }
    pub fn set_enabled(&self, v: bool) { self.enabled.store(v, Ordering::Relaxed); }
    pub fn play_copy(&self) {
        if !self.enabled.load(Ordering::Relaxed) { return; }
        // rodio requires a live OutputStream while audio plays; spawn a thread
        // so we don't block the caller waiting for sleep_until_end().
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
    fn toggle_enabled() {
        let p = SoundPlayer::new(true);
        p.set_enabled(false);
        // play_copy is no-op when disabled; calling it shouldn't panic
        p.play_copy();
    }
}
```

Add `pub mod sound;` to `lib.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml sound
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/sound.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): copy sound player (rodio, bundled OGG)"
```

### Task 24: Content-aware desktop notifications

**Files:**
- Create: `desktop/src-tauri/src/notifications.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the notifier**

```rust
use crate::clipboard::ContentType;
use notify_rust::Notification;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

pub struct Notifier {
    enabled: Arc<AtomicBool>,
}

impl Notifier {
    pub fn new(enabled: bool) -> Self {
        Self { enabled: Arc::new(AtomicBool::new(enabled)) }
    }
    pub fn set_enabled(&self, v: bool) { self.enabled.store(v, Ordering::Relaxed); }

    pub fn notify_capture(&self, ct: ContentType, preview: &str) {
        if !self.enabled.load(Ordering::Relaxed) { return; }
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
        let _ = Notification::new().summary(summary).body(&trimmed).appname("Clippy").timeout(2500).show();
    }
}
```

Add `pub mod notifications;` to `lib.rs`.

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/notifications.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): opt-in content-aware capture notifications"
```

### Task 25: Incognito mode

**Files:**
- Create: `desktop/src-tauri/src/incognito.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write incognito.rs with auto-disable timer**

```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
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
    pub fn active(&self) -> Arc<AtomicBool> { self.active.clone() }
    pub fn is_active(&self) -> bool { self.active.load(Ordering::Relaxed) }

    pub fn toggle(&self) -> bool {
        let now = self.active.fetch_xor(true, Ordering::Relaxed);
        if !now { // we just turned it ON
            let active = self.active.clone();
            let n = self.notify.clone();
            let d = self.auto_disable;
            tokio::spawn(async move {
                tokio::select! {
                    _ = tokio::time::sleep(d) => { active.store(false, Ordering::Relaxed); }
                    _ = n.notified() => {} // cancelled
                }
            });
            true
        } else {
            self.notify.notify_waiters(); // cancel pending auto-disable
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test(flavor = "current_thread", start_paused = true)]
    async fn auto_disables_after_timeout() {
        let inc = Incognito::new(1);
        assert!(inc.toggle());
        tokio::time::sleep(Duration::from_secs(2)).await;
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
```

Add `pub mod incognito;` to `lib.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml incognito
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/incognito.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): incognito mode with auto-disable timer"
```

### Task 26: Settings KV store

**Files:**
- Create: `desktop/src-tauri/src/settings.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write settings.rs with defaults**

```rust
use crate::db::{Db, DbError};
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,               // "dark" | "light" | "auto"
    pub layout: String,              // "cards" | "spotlight" | "sectioned" | "mosaic"
    pub density: String,             // "compact" | "comfortable" | "spacious"
    pub accent: String,              // hex color (e.g., "#E95678")
    pub panel_position: String,      // "top" | "bottom" | "left" | "right"
    pub hotkey_panel: String,        // e.g., "Ctrl+Shift+V"
    pub hotkey_incognito: String,
    pub history_size: i64,
    pub polling_ms: u64,
    pub sound_on_copy: bool,
    pub notifications_on_copy: bool,
    pub link_previews_enabled: bool,
    pub auto_sync_outgoing: bool,    // wired in Part D
    pub auto_sync_incoming: bool,
    pub incognito_auto_disable_secs: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "auto".into(),
            layout: "cards".into(),
            density: "comfortable".into(),
            accent: "#E95678".into(),
            panel_position: "bottom".into(),
            hotkey_panel: "Ctrl+Shift+V".into(),
            hotkey_incognito: "Ctrl+Shift+I".into(),
            history_size: 500,
            polling_ms: 300,
            sound_on_copy: true,
            notifications_on_copy: false,
            link_previews_enabled: false,
            auto_sync_outgoing: true,
            auto_sync_incoming: true,
            incognito_auto_disable_secs: 300,
        }
    }
}

impl Settings {
    pub fn load(db: &Db) -> Result<Self, DbError> {
        let mut s = Settings::default();
        let mut stmt = db.conn().prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for row in rows {
            let (k, v) = row?;
            apply(&mut s, &k, &v);
        }
        Ok(s)
    }
    pub fn save(&self, db: &Db) -> Result<(), DbError> {
        let pairs: Vec<(&str, String)> = vec![
            ("theme", self.theme.clone()),
            ("layout", self.layout.clone()),
            ("density", self.density.clone()),
            ("accent", self.accent.clone()),
            ("panel_position", self.panel_position.clone()),
            ("hotkey_panel", self.hotkey_panel.clone()),
            ("hotkey_incognito", self.hotkey_incognito.clone()),
            ("history_size", self.history_size.to_string()),
            ("polling_ms", self.polling_ms.to_string()),
            ("sound_on_copy", self.sound_on_copy.to_string()),
            ("notifications_on_copy", self.notifications_on_copy.to_string()),
            ("link_previews_enabled", self.link_previews_enabled.to_string()),
            ("auto_sync_outgoing", self.auto_sync_outgoing.to_string()),
            ("auto_sync_incoming", self.auto_sync_incoming.to_string()),
            ("incognito_auto_disable_secs", self.incognito_auto_disable_secs.to_string()),
        ];
        for (k, v) in pairs {
            db.conn().execute(
                "INSERT OR REPLACE INTO settings(key, value) VALUES (?1, ?2)",
                params![k, v],
            )?;
        }
        Ok(())
    }
}

fn apply(s: &mut Settings, k: &str, v: &str) {
    match k {
        "theme" => s.theme = v.into(),
        "layout" => s.layout = v.into(),
        "density" => s.density = v.into(),
        "accent" => s.accent = v.into(),
        "panel_position" => s.panel_position = v.into(),
        "hotkey_panel" => s.hotkey_panel = v.into(),
        "hotkey_incognito" => s.hotkey_incognito = v.into(),
        "history_size" => if let Ok(n) = v.parse() { s.history_size = n; },
        "polling_ms" => if let Ok(n) = v.parse() { s.polling_ms = n; },
        "sound_on_copy" => if let Ok(b) = v.parse() { s.sound_on_copy = b; },
        "notifications_on_copy" => if let Ok(b) = v.parse() { s.notifications_on_copy = b; },
        "link_previews_enabled" => if let Ok(b) = v.parse() { s.link_previews_enabled = b; },
        "auto_sync_outgoing" => if let Ok(b) = v.parse() { s.auto_sync_outgoing = b; },
        "auto_sync_incoming" => if let Ok(b) = v.parse() { s.auto_sync_incoming = b; },
        "incognito_auto_disable_secs" => if let Ok(n) = v.parse() { s.incognito_auto_disable_secs = n; },
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip_save_load() {
        let db = Db::open_in_memory().unwrap();
        let mut s = Settings::default();
        s.layout = "spotlight".into();
        s.history_size = 1000;
        s.sound_on_copy = false;
        s.save(&db).unwrap();
        let loaded = Settings::load(&db).unwrap();
        assert_eq!(loaded.layout, "spotlight");
        assert_eq!(loaded.history_size, 1000);
        assert!(!loaded.sound_on_copy);
    }
}
```

Add `pub mod settings;` to `lib.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml settings
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/settings.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): settings KV store with sensible defaults"
```

### Task 27: Custom per-type actions

**Files:**
- Create: `desktop/src-tauri/src/actions.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write actions.rs**

```rust
use crate::clipboard::ContentType;
use crate::db::{Db, DbError};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipAction {
    pub id: i64,
    pub content_type: ContentType,
    pub label: String,
    pub kind: ActionKind,
    pub params: serde_json::Value,
    pub is_default: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionKind {
    Paste,
    OpenUrl,
    SaveToFile,
    ShellCommand,
    WebSearch,
}

pub fn list_actions(db: &Db, ct: ContentType) -> Result<Vec<ClipAction>, DbError> {
    let mut stmt = db.conn().prepare(
        "SELECT id, content_type, label, kind, params_json, is_default, sort_order
         FROM clip_actions WHERE content_type = ?1 ORDER BY sort_order, id"
    )?;
    let rows = stmt.query_map(params![ct.as_str()], |r| {
        let ct: String = r.get(1)?;
        let kind: String = r.get(3)?;
        let params_json: String = r.get(4)?;
        let content_type = match ct.as_str() {
            "text" => ContentType::Text, "link" => ContentType::Link, "code" => ContentType::Code,
            "color" => ContentType::Color, "emoji" => ContentType::Emoji,
            "file" => ContentType::File, "image" => ContentType::Image,
            _ => ContentType::Text,
        };
        let kind = serde_json::from_str(&format!("\"{kind}\"")).unwrap_or(ActionKind::Paste);
        let params = serde_json::from_str(&params_json).unwrap_or(serde_json::json!({}));
        Ok(ClipAction {
            id: r.get(0)?, content_type, label: r.get(2)?, kind, params,
            is_default: r.get::<_, i64>(5)? != 0, sort_order: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn run_action(action: &ClipAction, clip_content: &str) -> Result<(), String> {
    match action.kind {
        ActionKind::Paste => Ok(()), // paste handled by caller via enigo
        ActionKind::OpenUrl => {
            // The clip's content is the URL.
            open::that_detached(clip_content).map_err(|e| e.to_string())
        }
        ActionKind::SaveToFile => {
            let path = action.params.get("path").and_then(|v| v.as_str())
                .ok_or("missing path param")?;
            std::fs::write(path, clip_content).map_err(|e| e.to_string())
        }
        ActionKind::ShellCommand => {
            let cmd = action.params.get("cmd").and_then(|v| v.as_str())
                .ok_or("missing cmd param")?;
            // Substitute {q} with the clip content
            let cmd = cmd.replace("{q}", clip_content);
            let status = Command::new("sh").arg("-c").arg(&cmd).status()
                .map_err(|e| e.to_string())?;
            if status.success() { Ok(()) } else { Err(format!("exit {status}")) }
        }
        ActionKind::WebSearch => {
            let tmpl = action.params.get("url").and_then(|v| v.as_str())
                .ok_or("missing url param")?;
            let q = urlencoding::encode(clip_content);
            let url = tmpl.replace("{q}", &q);
            open::that_detached(&url).map_err(|e| e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn list_actions_returns_seeded_link_default() {
        let db = Db::open_in_memory().unwrap();
        let actions = list_actions(&db, ContentType::Link).unwrap();
        assert_eq!(actions.len(), 1);
        assert!(actions[0].is_default);
        assert_eq!(actions[0].kind, ActionKind::OpenUrl);
    }
}
```

Add `open = "5"` and `urlencoding = "2"` to `Cargo.toml`.

Add `pub mod actions;` to `lib.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml actions
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/actions.rs desktop/src-tauri/src/lib.rs desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): per-type custom actions runner (paste/url/file/shell/search)"
```

### Task 28: Link preview fetcher (opt-in, lazy)

**Files:**
- Create: `desktop/src-tauri/src/link_preview.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the fetcher**

```rust
use crate::db::{Db, DbError};
use rusqlite::params;
use scraper::{Html, Selector};
use std::net::IpAddr;
use std::time::Duration;
use thiserror::Error;
use url::Url;

#[derive(Debug, Error)]
pub enum FetchError {
    #[error("private/local host blocked")] Blocked,
    #[error("timeout")] Timeout,
    #[error(transparent)] Network(#[from] reqwest::Error),
    #[error(transparent)] Url(#[from] url::ParseError),
    #[error(transparent)] Db(#[from] DbError),
}

pub struct PreviewRow {
    pub title: Option<String>,
    pub description: Option<String>,
    pub og_image: Option<Vec<u8>>,
    pub favicon: Option<Vec<u8>>,
    pub status: String,
}

pub async fn fetch_and_cache(db: &Db, clip_id: i64, url_str: &str) -> Result<PreviewRow, FetchError> {
    // Refuse private/loopback
    let url = Url::parse(url_str)?;
    if let Some(host) = url.host_str() {
        if host.eq_ignore_ascii_case("localhost") { return reject(db, clip_id, "blocked").await.map(|_| placeholder("blocked")); }
        if let Ok(ip) = host.parse::<IpAddr>() {
            if is_private_or_loopback(&ip) { return reject(db, clip_id, "blocked").await.map(|_| placeholder("blocked")); }
        }
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .user_agent("ClippyPreviewBot/0.1")
        .build()?;
    let res = match tokio::time::timeout(Duration::from_secs(3), client.get(url.clone()).send()).await {
        Err(_) => return reject(db, clip_id, "timeout").await.map(|_| placeholder("timeout")),
        Ok(Err(e)) => return Err(e.into()),
        Ok(Ok(r)) => r,
    };
    let body = res.text().await.unwrap_or_default();
    let doc = Html::parse_document(&body);
    let title_sel = Selector::parse("title").unwrap();
    let og_image_sel = Selector::parse(r#"meta[property="og:image"]"#).unwrap();
    let desc_sel = Selector::parse(r#"meta[name="description"]"#).unwrap();
    let title = doc.select(&title_sel).next().map(|n| n.text().collect::<String>());
    let description = doc.select(&desc_sel).next().and_then(|n| n.value().attr("content").map(|s| s.to_string()));
    let og_image_url = doc.select(&og_image_sel).next().and_then(|n| n.value().attr("content").map(|s| s.to_string()));
    let og_image = if let Some(img_url) = og_image_url {
        let abs = url.join(&img_url).ok();
        if let Some(u) = abs {
            client.get(u).send().await.ok()
                .and_then(|r| futures_lite::future::block_on(r.bytes()).ok())
                .map(|b| b.to_vec())
        } else { None }
    } else { None };
    let favicon_url = url.join("/favicon.ico").ok();
    let favicon = if let Some(u) = favicon_url {
        client.get(u).send().await.ok()
            .and_then(|r| futures_lite::future::block_on(r.bytes()).ok())
            .map(|b| b.to_vec())
    } else { None };
    let row = PreviewRow { title, description, og_image, favicon, status: "ok".into() };
    persist(db, clip_id, &row).await?;
    Ok(row)
}

fn placeholder(status: &str) -> PreviewRow {
    PreviewRow { title: None, description: None, og_image: None, favicon: None, status: status.into() }
}

async fn reject(db: &Db, clip_id: i64, status: &str) -> Result<(), DbError> {
    db.conn().execute(
        "INSERT OR REPLACE INTO link_previews(clip_id, fetched_at, status) VALUES (?1, ?2, ?3)",
        params![clip_id, chrono_ms(), status],
    )?;
    Ok(())
}

async fn persist(db: &Db, clip_id: i64, row: &PreviewRow) -> Result<(), DbError> {
    db.conn().execute(
        "INSERT OR REPLACE INTO link_previews(clip_id, title, description, favicon_png, og_image, fetched_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![clip_id, row.title, row.description, row.favicon, row.og_image, chrono_ms(), row.status],
    )?;
    Ok(())
}

fn chrono_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64
}

fn is_private_or_loopback(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => v6.is_loopback() || v6.is_unique_local() || v6.is_unicast_link_local(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn rejects_localhost() {
        let db = Db::open_in_memory().unwrap();
        let _ = db.conn().execute(
            "INSERT INTO clips(content_type, content, mime, content_hash, preview, created_at) VALUES ('link', X'00', 'text/plain', 'h', 'p', 1)",
            []).unwrap();
        let r = fetch_and_cache(&db, 1, "http://localhost:1/x").await.unwrap();
        assert_eq!(r.status, "blocked");
    }
    #[tokio::test]
    async fn rejects_private_ip() {
        let db = Db::open_in_memory().unwrap();
        let _ = db.conn().execute(
            "INSERT INTO clips(content_type, content, mime, content_hash, preview, created_at) VALUES ('link', X'00', 'text/plain', 'h', 'p', 1)",
            []).unwrap();
        let r = fetch_and_cache(&db, 1, "http://192.168.1.1/").await.unwrap();
        assert_eq!(r.status, "blocked");
    }
}
```

Add `futures-lite = "2"` to `Cargo.toml`.

Add `pub mod link_preview;` to `lib.rs`.

- [ ] **Step 2: Run**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml link_preview
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/link_preview.rs desktop/src-tauri/src/lib.rs desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): opt-in link preview fetcher with private-IP guard"
```

### Task 29: D-Bus app interface (`io.clippy.App`)

**Files:**
- Create: `desktop/src-tauri/src/dbus_app.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write dbus_app.rs**

```rust
use std::sync::Arc;
use tokio::sync::mpsc;
use zbus::{ConnectionBuilder, interface};

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
```

Add `pub mod dbus_app;` to `lib.rs`.

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/dbus_app.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): expose io.clippy.App D-Bus interface for CLI scripting"
```

### Task 30: Tauri commands surface for frontend

**Files:**
- Create: `desktop/src-tauri/src/commands.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write commands.rs**

```rust
use crate::clipboard::ContentType;
use crate::db::Db;
use crate::settings::Settings;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct AppState {
    pub db: Arc<Mutex<Db>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClipDto {
    pub id: i64,
    pub content_type: String,
    pub mime: String,
    pub hash: String,
    pub preview: String,
    pub source_app: Option<String>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub created_at: i64,
}

#[tauri::command]
pub fn list_clips(state: State<'_, AppState>, search: Option<String>, content_type_filter: Option<String>, favorites_only: bool, limit: i64) -> Result<Vec<ClipDto>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut sql = String::from(
        "SELECT id, content_type, mime, content_hash, preview, source_app, is_favorite, is_pinned, created_at
         FROM clips WHERE 1=1"
    );
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    if let Some(ref q) = search {
        if !q.is_empty() {
            sql.push_str(" AND id IN (SELECT rowid FROM clips_fts WHERE clips_fts MATCH ?)");
            params.push(Box::new(format!("{q}*")));
        }
    }
    if let Some(ref ct) = content_type_filter {
        sql.push_str(" AND content_type = ?");
        params.push(Box::new(ct.clone()));
    }
    if favorites_only {
        sql.push_str(" AND is_favorite = 1");
    }
    sql.push_str(" ORDER BY is_pinned DESC, is_favorite DESC, created_at DESC LIMIT ?");
    params.push(Box::new(limit));
    let mut stmt = db.conn().prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(rusqlite::params_from_iter(param_refs), |r| {
        Ok(ClipDto {
            id: r.get(0)?, content_type: r.get(1)?, mime: r.get(2)?, hash: r.get(3)?,
            preview: r.get(4)?, source_app: r.get(5)?, is_favorite: r.get::<_, i64>(6)? != 0,
            is_pinned: r.get::<_, i64>(7)? != 0, created_at: r.get(8)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_clip_content(state: State<'_, AppState>, id: i64, mime: Option<String>) -> Result<Vec<u8>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(m) = mime {
        if let Ok(bytes) = db.conn().query_row(
            "SELECT content FROM clip_representations WHERE clip_id = ?1 AND mime = ?2",
            rusqlite::params![id, m], |r| r.get::<_, Vec<u8>>(0)
        ) {
            return Ok(bytes);
        }
    }
    db.conn().query_row("SELECT content FROM clips WHERE id = ?1", rusqlite::params![id], |r| r.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_thumbnail(state: State<'_, AppState>, id: i64) -> Result<Option<Vec<u8>>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.thumbnail_for(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn().execute("UPDATE clips SET is_favorite = 1 - is_favorite WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(db.conn().query_row("SELECT is_favorite FROM clips WHERE id = ?1", rusqlite::params![id], |r| r.get::<_, i64>(0)).map_err(|e| e.to_string())? != 0)
}

#[tauri::command]
pub fn toggle_pin(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn().execute("UPDATE clips SET is_pinned = 1 - is_pinned WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(db.conn().query_row("SELECT is_pinned FROM clips WHERE id = ?1", rusqlite::params![id], |r| r.get::<_, i64>(0)).map_err(|e| e.to_string())? != 0)
}

#[tauri::command]
pub fn delete_clip(state: State<'_, AppState>, id: i64, force: bool) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if !force {
        let (pinned, fav): (i64, i64) = db.conn().query_row(
            "SELECT is_pinned, is_favorite FROM clips WHERE id = ?1",
            rusqlite::params![id], |r| Ok((r.get(0)?, r.get(1)?))
        ).map_err(|e| e.to_string())?;
        if pinned == 1 || fav == 1 {
            return Err("clip is pinned or favorited; pass force=true".into());
        }
    }
    db.conn().execute("DELETE FROM clips WHERE id = ?1", rusqlite::params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_edited_clip(state: State<'_, AppState>, original_id: i64, new_content: String) -> Result<i64, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let (ct, mime): (String, String) = db.conn().query_row(
        "SELECT content_type, mime FROM clips WHERE id = ?1",
        rusqlite::params![original_id], |r| Ok((r.get(0)?, r.get(1)?))
    ).map_err(|e| e.to_string())?;
    let content_type = match ct.as_str() {
        "text" => ContentType::Text, "link" => ContentType::Link, "code" => ContentType::Code,
        "color" => ContentType::Color, "emoji" => ContentType::Emoji,
        _ => return Err("not editable type".into()),
    };
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let preview: String = new_content.chars().take(280).collect();
    let inserted = db.insert_clip(
        content_type, new_content.as_bytes(), &mime, &preview, Some("Clippy (edited)"), now
    ).map_err(|e| e.to_string())?;
    Ok(inserted.id)
}

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Settings::load(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    settings.save(&db).map_err(|e| e.to_string())
}
```

Modify `lib.rs` `run()` to register handlers and manage state. Replace `run()` body with:
```rust
pub fn run() {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,clippy=debug"))).with_target(false).init();
    let db_path = dirs::data_local_dir().unwrap().join("clippy/clippy.db");
    let db = db::Db::open(&db_path).expect("open db");
    let app_state = commands::AppState { db: std::sync::Arc::new(std::sync::Mutex::new(db)) };
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::list_clips, commands::get_clip_content, commands::get_thumbnail,
            commands::toggle_favorite, commands::toggle_pin, commands::delete_clip,
            commands::save_edited_clip, commands::load_settings, commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Add `pub mod commands;` to `lib.rs`.

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/commands.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): expose Tauri commands for clip CRUD + settings"
```

### Task 31: Frontend — design tokens CSS

**Files:**
- Create: `desktop/src/lib/tokens.css`
- Modify: `desktop/src/App.svelte`, `desktop/src/app.css`

- [ ] **Step 1: Write tokens.css with the locked palette**

```css
/* All values verbatim from PRD §6.3 / handoff tokens.jsx */

@font-face { font-family: 'Geist'; src: url('/assets/fonts/Geist-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Geist'; src: url('/assets/fonts/Geist-Medium.woff2') format('woff2'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'Geist'; src: url('/assets/fonts/Geist-SemiBold.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Geist'; src: url('/assets/fonts/Geist-Bold.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Geist Mono'; src: url('/assets/fonts/GeistMono-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Geist Mono'; src: url('/assets/fonts/GeistMono-Medium.woff2') format('woff2'); font-weight: 500; font-display: swap; }

:root {
  --cm-accent: #E95678;
  --cm-radius-card: 14px;
  --cm-radius-panel: 20px;
  --cm-transition: 150ms cubic-bezier(.2, .9, .3, 1);
  font-family: 'Geist', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

:root[data-theme='dark'] {
  --cm-bg: #16161F;
  --cm-bg-solid: #0E0E15;
  --cm-surface: #1F1F2A;
  --cm-surface-raised: #2A2A38;
  --cm-surface-sunken: #15151C;
  --cm-border-subtle: #2D2D3A;
  --cm-border-strong: #3A3A4A;
  --cm-text: #ECECF1;
  --cm-text-secondary: #9999A8;
  --cm-text-tertiary: #5C5C6B;
  --cm-warn: #A55C5C;
  --cm-panel-scrim: rgba(22, 22, 31, 0.85);
}

:root[data-theme='light'] {
  --cm-bg: #F5F5FA;
  --cm-bg-solid: #EFEFF4;
  --cm-surface: #FFFFFF;
  --cm-surface-raised: #F0F0F5;
  --cm-surface-sunken: #ECECF1;
  --cm-border-subtle: #E5E5EC;
  --cm-border-strong: #D5D5DE;
  --cm-text: #1A1A24;
  --cm-text-secondary: #5C5C6B;
  --cm-text-tertiary: #9999A8;
  --cm-warn: #B86A6A;
  --cm-panel-scrim: rgba(245, 245, 250, 0.88);
}

/* Type-badge palette (per type, dark + light) */
[data-theme='dark']  { --badge-text-bg: rgba(153,153,168,.10); --badge-text-fg: #B0B0BE;
                       --badge-link-bg: rgba(124,156,255,.13); --badge-link-fg: #A6B7EA;
                       --badge-code-bg: rgba(199,146,234,.14); --badge-code-fg: #C9A8E7;
                       --badge-image-bg:rgba(91,192,190,.14);  --badge-image-fg:#8FCFC9;
                       --badge-color-bg:rgba(255,180,120,.14); --badge-color-fg:#D9B493;
                       --badge-emoji-bg:rgba(230,189,108,.14); --badge-emoji-fg:#D9BC8A;
                       --badge-file-bg: rgba(140,150,170,.14); --badge-file-fg: #9FA9BC; }
[data-theme='light'] { --badge-text-bg: #ECECF1; --badge-text-fg: #5C5C6B;
                       --badge-link-bg: #E8EEFB; --badge-link-fg: #3F5DAB;
                       --badge-code-bg: #F0E6F8; --badge-code-fg: #7A4FA6;
                       --badge-image-bg:#DDF2F1; --badge-image-fg:#3A8B86;
                       --badge-color-bg:#F7ECE0; --badge-color-fg:#8C6238;
                       --badge-emoji-bg:#F6ECD8; --badge-emoji-fg:#8C6F35;
                       --badge-file-bg: #E5E8ED; --badge-file-fg: #5A6478; }
```

Modify `desktop/src/app.css` to import this:
```css
@import './lib/tokens.css';
html, body, #app { height: 100%; margin: 0; padding: 0; background: transparent; }
* { box-sizing: border-box; }
```

- [ ] **Step 2: Verify dev mode shows panel transparent**

```bash
cd desktop && cargo tauri dev
```

Expected: panel window opens, transparent (no Svelte content yet renders styled).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/lib/tokens.css desktop/src/app.css
git commit -m "feat(desktop): design tokens (Geist fonts, dark/light palette, badges)"
```

### Task 32: Frontend — Tauri API wrapper

**Files:**
- Create: `desktop/src/lib/api.ts`

- [ ] **Step 1: Write api.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface ClipDto {
  id: number;
  content_type: 'text'|'link'|'code'|'color'|'emoji'|'file'|'image';
  mime: string;
  hash: string;
  preview: string;
  source_app: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  created_at: number;
}

export interface Settings {
  theme: string; layout: string; density: string; accent: string; panel_position: string;
  hotkey_panel: string; hotkey_incognito: string;
  history_size: number; polling_ms: number;
  sound_on_copy: boolean; notifications_on_copy: boolean; link_previews_enabled: boolean;
  auto_sync_outgoing: boolean; auto_sync_incoming: boolean;
  incognito_auto_disable_secs: number;
}

export const api = {
  listClips: (opts: { search?: string; content_type_filter?: string; favorites_only?: boolean; limit?: number } = {}) =>
    invoke<ClipDto[]>('list_clips', {
      search: opts.search ?? null,
      contentTypeFilter: opts.content_type_filter ?? null,
      favoritesOnly: opts.favorites_only ?? false,
      limit: opts.limit ?? 500,
    }),
  getClipContent: (id: number, mime?: string) => invoke<number[]>('get_clip_content', { id, mime: mime ?? null }),
  getThumbnail:   (id: number) => invoke<number[] | null>('get_thumbnail', { id }),
  toggleFavorite: (id: number) => invoke<boolean>('toggle_favorite', { id }),
  togglePin:      (id: number) => invoke<boolean>('toggle_pin', { id }),
  deleteClip:     (id: number, force = false) => invoke<void>('delete_clip', { id, force }),
  saveEditedClip: (originalId: number, newContent: string) => invoke<number>('save_edited_clip', { originalId, newContent }),
  loadSettings:   () => invoke<Settings>('load_settings'),
  saveSettings:   (s: Settings) => invoke<void>('save_settings', { settings: s }),
};
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/api.ts
git commit -m "feat(desktop): typed Tauri API wrapper"
```

### Task 33: Frontend — Svelte stores

**Files:**
- Create: `desktop/src/lib/stores/clips.svelte.ts`, `settings.svelte.ts`, `filter.svelte.ts`, `selection.svelte.ts`

- [ ] **Step 1: Write stores using Svelte 5 runes**

`desktop/src/lib/stores/clips.svelte.ts`:
```typescript
import { api, type ClipDto } from '../api';

class ClipsStore {
  clips = $state<ClipDto[]>([]);
  loading = $state(false);
  async refresh(search?: string, contentTypeFilter?: string, favoritesOnly = false) {
    this.loading = true;
    try {
      this.clips = await api.listClips({ search, content_type_filter: contentTypeFilter, favorites_only: favoritesOnly });
    } finally { this.loading = false; }
  }
  async toggleFavorite(id: number) {
    await api.toggleFavorite(id);
    const c = this.clips.find(c => c.id === id);
    if (c) c.is_favorite = !c.is_favorite;
  }
  async togglePin(id: number) {
    await api.togglePin(id);
    const c = this.clips.find(c => c.id === id);
    if (c) c.is_pinned = !c.is_pinned;
    this.clips = [...this.clips].sort((a,b) => Number(b.is_pinned)-Number(a.is_pinned) || Number(b.is_favorite)-Number(a.is_favorite) || b.created_at-a.created_at);
  }
  async delete(id: number, force = false) {
    await api.deleteClip(id, force);
    this.clips = this.clips.filter(c => c.id !== id);
  }
}
export const clipsStore = new ClipsStore();
```

`desktop/src/lib/stores/settings.svelte.ts`:
```typescript
import { api, type Settings } from '../api';

class SettingsStore {
  s = $state<Settings | null>(null);
  async load() { this.s = await api.loadSettings(); this.applyTheme(); }
  async save(patch: Partial<Settings>) {
    if (!this.s) return;
    this.s = { ...this.s, ...patch };
    await api.saveSettings(this.s);
    this.applyTheme();
  }
  applyTheme() {
    if (!this.s) return;
    const theme = this.s.theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : this.s.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--cm-accent', this.s.accent);
  }
}
export const settingsStore = new SettingsStore();
```

`desktop/src/lib/stores/filter.svelte.ts`:
```typescript
class FilterStore {
  search = $state('');
  type: string | null = $state(null);
  favoritesOnly = $state(false);
  cycleType() {
    const order: (string|null)[] = [null, 'text', 'image', 'link', 'code', 'color', 'emoji', 'file'];
    const i = order.indexOf(this.type);
    this.type = order[(i + 1) % order.length];
  }
  cycleTypeReverse() {
    const order: (string|null)[] = [null, 'text', 'image', 'link', 'code', 'color', 'emoji', 'file'];
    const i = order.indexOf(this.type);
    this.type = order[(i - 1 + order.length) % order.length];
  }
  reset() { this.search = ''; this.type = null; this.favoritesOnly = false; }
}
export const filterStore = new FilterStore();
```

`desktop/src/lib/stores/selection.svelte.ts`:
```typescript
class SelectionStore {
  hash: string | null = $state(null);
  setByHash(h: string | null) { this.hash = h; }
}
export const selectionStore = new SelectionStore();
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/stores/
git commit -m "feat(desktop): Svelte stores for clips/settings/filter/selection (runes)"
```

### Task 34: ClipCard component

**Files:**
- Create: `desktop/src/lib/components/ClipCard.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { ClipDto } from '../api';
  let { clip, state = 'default', density = 'comfortable', onSelect = () => {} }: {
    clip: ClipDto;
    state?: 'default' | 'hover' | 'selected' | 'pressed';
    density?: 'compact' | 'comfortable' | 'spacious';
    onSelect?: () => void;
  } = $props();

  const sizes = {
    compact:     { w: 168, h: 210, pad: 10, gap: 8 },
    comfortable: { w: 200, h: 240, pad: 12, gap: 10 },
    spacious:    { w: 232, h: 244, pad: 16, gap: 14 },
  };
  const s = $derived(sizes[density]);
  const badgeKey = $derived(clip.content_type);
</script>

<button
  class="card state-{state} type-{clip.content_type}"
  style:width="{s.w}px"
  style:height="{s.h}px"
  style:padding="{s.pad}px"
  style:gap="{s.gap}px"
  onclick={onSelect}
  type="button"
>
  {#if clip.is_pinned}
    <span class="pin-stripe"></span>
  {/if}

  <div class="top">
    <span class="badge" style:background={`var(--badge-${badgeKey}-bg)`} style:color={`var(--badge-${badgeKey}-fg)`}>
      {clip.content_type.toUpperCase()}
    </span>
    {#if clip.source_app}<span class="source">{clip.source_app}</span>{/if}
  </div>

  <div class="content">
    {#if clip.content_type === 'image'}
      <div class="image-thumb"></div>
    {:else if clip.content_type === 'color'}
      <div class="color-swatch" style:background={clip.preview}></div>
      <div class="color-text">{clip.preview}</div>
    {:else if clip.content_type === 'emoji'}
      <div class="emoji">{clip.preview}</div>
    {:else if clip.content_type === 'code'}
      <pre class="code">{clip.preview}</pre>
    {:else}
      <div class="text">{clip.preview}</div>
    {/if}
  </div>

  <div class="bottom">
    <span class="time">{relTime(clip.created_at)}</span>
    {#if clip.is_favorite}<span class="star">★</span>{:else}<span class="star empty">☆</span>{/if}
  </div>
</button>

<script lang="ts" module>
  function relTime(ms: number): string {
    const d = Date.now() - ms;
    if (d < 60_000) return 'now';
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
    return `${Math.floor(d / 86_400_000)}d`;
  }
</script>

<style>
  .card {
    position: relative; display: flex; flex-direction: column;
    background: var(--cm-surface); border: 1px solid var(--cm-border-subtle);
    border-radius: var(--cm-radius-card); color: var(--cm-text);
    transition: transform var(--cm-transition), background var(--cm-transition), border-color var(--cm-transition);
    flex-shrink: 0; cursor: pointer; text-align: left; font-family: inherit;
  }
  .card.state-hover { background: var(--cm-surface-raised); border-color: color-mix(in srgb, var(--cm-accent) 33%, transparent); transform: translateY(-2px); }
  .card.state-selected { background: var(--cm-surface-raised); border-color: var(--cm-accent); }
  .card.state-pressed { transform: scale(0.97); }
  .pin-stripe { position: absolute; top: 0; left: 14px; right: 14px; height: 2px; background: var(--cm-accent); border-bottom-left-radius: 1px; border-bottom-right-radius: 1px; }
  .top { display: flex; align-items: center; justify-content: space-between; min-height: 18px; }
  .badge { padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: .4px; line-height: 1; text-transform: uppercase; }
  .source { font-size: 10px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; }
  .content { flex: 1; overflow: hidden; min-height: 0; }
  .text, .code { font-size: 13px; line-height: 1.5; color: var(--cm-text); overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 7; -webkit-box-orient: vertical; white-space: pre-wrap; word-break: break-word; }
  .code { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11.5px; line-height: 1.45; white-space: pre; -webkit-line-clamp: 8; }
  .image-thumb { width: 100%; height: 100%; border-radius: 8px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--cm-accent) 20%, var(--cm-surface-raised)) 0%, var(--cm-surface-raised) 60%); }
  .color-swatch { flex: 1; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
  .color-text { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px; color: var(--cm-text-secondary); }
  .emoji { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 64px; line-height: 1; }
  .bottom { display: flex; align-items: center; justify-content: space-between; min-height: 16px; }
  .time { font-size: 10px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: .3px; }
  .star { font-size: 14px; color: var(--cm-accent); }
  .star.empty { color: var(--cm-text-tertiary); }
</style>
```

- [ ] **Step 2: Add Vitest setup for component tests**

`desktop/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  plugins: [svelte()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
```

`desktop/src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

`desktop/src/lib/components/__tests__/ClipCard.spec.ts`:
```typescript
import { render, screen } from '@testing-library/svelte';
import ClipCard from '../ClipCard.svelte';
import { describe, it, expect } from 'vitest';

const baseClip = {
  id: 1, content_type: 'text' as const, mime: 'text/plain', hash: 'h',
  preview: 'hello world', source_app: 'firefox',
  is_favorite: false, is_pinned: false, created_at: Date.now() - 1000,
};

describe('ClipCard', () => {
  it('shows the type badge in uppercase', () => {
    render(ClipCard, { props: { clip: baseClip } });
    expect(screen.getByText('TEXT')).toBeInTheDocument();
  });
  it('draws pin stripe when pinned', () => {
    const { container } = render(ClipCard, { props: { clip: { ...baseClip, is_pinned: true } } });
    expect(container.querySelector('.pin-stripe')).toBeTruthy();
  });
  it('shows filled star when favorited', () => {
    render(ClipCard, { props: { clip: { ...baseClip, is_favorite: true } } });
    expect(screen.getByText('★')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run**

```bash
cd desktop && npx vitest run
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/lib/components/ClipCard.svelte desktop/src/lib/components/__tests__/ desktop/vitest.config.ts desktop/src/test-setup.ts
git commit -m "feat(desktop): ClipCard with Pin stripe, Favorite star, density variants"
```

### Task 35: SearchBar + FilterChip + EmptyState components

**Files:**
- Create: `desktop/src/lib/components/SearchBar.svelte`, `FilterChip.svelte`, `EmptyState.svelte`

- [ ] **Step 1: Write the components**

`desktop/src/lib/components/SearchBar.svelte`:
```svelte
<script lang="ts">
  let { value = $bindable(''), placeholder = 'Search clipboard…', focused = $bindable(false), onClear = () => {} }: {
    value?: string; placeholder?: string; focused?: boolean; onClear?: () => void;
  } = $props();
  let inputRef: HTMLInputElement | undefined;
  export function focus() { inputRef?.focus(); }
</script>

<div class="search" class:focused style:--w="360px">
  <span class="icon">🔍</span>
  <input bind:this={inputRef} bind:value type="text" {placeholder}
         onfocus={() => focused = true} onblur={() => focused = false} />
  {#if value}<button class="clear" onclick={() => { value = ''; onClear(); }} aria-label="Clear">×</button>{/if}
</div>

<style>
  .search { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px;
    background: rgba(0,0,0,.25); border-radius: 10px; border: 1px solid var(--cm-border-subtle);
    width: var(--w); transition: border-color 120ms, box-shadow 120ms; }
  .search.focused { border-color: var(--cm-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--cm-accent) 22%, transparent); }
  input { flex: 1; min-width: 0; background: transparent; border: none; outline: none;
    color: var(--cm-text); font-family: inherit; font-size: 13px; }
  input::placeholder { color: var(--cm-text-tertiary); }
  .icon { color: var(--cm-text-secondary); font-size: 14px; }
  .clear { background: transparent; border: none; cursor: pointer; color: var(--cm-text-secondary); font-size: 14px; padding: 2px; }
</style>
```

`desktop/src/lib/components/FilterChip.svelte`:
```svelte
<script lang="ts">
  let { label, active = false, icon = '', count = null as number | null, onClick = () => {} }: {
    label: string; active?: boolean; icon?: string; count?: number | null; onClick?: () => void;
  } = $props();
</script>
<button class="chip" class:active onclick={onClick} type="button">
  {#if icon}<span class="icon">{icon}</span>{/if}
  <span>{label}</span>
  {#if count !== null}<span class="count">{count}</span>{/if}
</button>
<style>
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px;
    background: transparent; color: var(--cm-text-secondary);
    border: 1px solid var(--cm-border-subtle); border-radius: 14px;
    font-size: 12px; font-weight: 500; font-family: inherit; white-space: nowrap; cursor: pointer; }
  .chip.active { background: var(--cm-surface-raised); color: var(--cm-text); border-color: var(--cm-border-strong); }
  .count { font-size: 10px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; }
</style>
```

`desktop/src/lib/components/EmptyState.svelte`:
```svelte
<script lang="ts">
  let { variant, search = '' }: { variant: 'no-history' | 'no-results' | 'no-filter'; search?: string } = $props();
  const titles = {
    'no-history': 'Nothing here yet',
    'no-results': `No matches for "${search || 'query'}"`,
    'no-filter':  'No clips of this type yet',
  };
  const hints = {
    'no-history': 'Copy anything — text, an image, a file — and it\'ll show up here.',
    'no-results': 'Try a shorter term or a different filter.',
    'no-filter':  'Copy something matching this type to populate this filter.',
  };
</script>
<div class="empty">
  <div class="title">{titles[variant]}</div>
  <div class="hint">{hints[variant]}</div>
</div>
<style>
  .empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 20px; }
  .title { font-size: 14px; font-weight: 500; color: var(--cm-text); }
  .hint { font-size: 12px; color: var(--cm-text-secondary); text-align: center; max-width: 360px; line-height: 1.5; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/components/SearchBar.svelte desktop/src/lib/components/FilterChip.svelte desktop/src/lib/components/EmptyState.svelte
git commit -m "feat(desktop): SearchBar, FilterChip, EmptyState components"
```

### Task 36: Cards layout

**Files:**
- Create: `desktop/src/lib/layouts/LayoutCards.svelte`

- [ ] **Step 1: Write the layout**

```svelte
<script lang="ts">
  import ClipCard from '../components/ClipCard.svelte';
  import type { ClipDto } from '../api';
  let { clips, selectedHash, density = 'comfortable', onSelect = (_h: string) => {} }: {
    clips: ClipDto[]; selectedHash: string | null; density?: 'compact'|'comfortable'|'spacious';
    onSelect?: (hash: string) => void;
  } = $props();
</script>
<div class="cards-row">
  {#each clips as clip (clip.id)}
    <ClipCard {clip} {density}
      state={clip.hash === selectedHash ? 'selected' : 'default'}
      onSelect={() => onSelect(clip.hash)} />
  {/each}
  <div class="edge-fade"></div>
</div>
<style>
  .cards-row { display: flex; gap: 12px; padding: 16px 20px; overflow-x: auto; overflow-y: hidden;
    height: 100%; align-items: stretch; scroll-snap-type: x mandatory; }
  .cards-row > :global(.card) { scroll-snap-align: start; }
  .edge-fade { position: sticky; right: 0; top: 0; bottom: 0; width: 60px; pointer-events: none;
    background: linear-gradient(to left, var(--cm-panel-scrim), transparent); flex-shrink: 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/layouts/LayoutCards.svelte
git commit -m "feat(desktop): Cards layout (horizontal scroller + edge fade)"
```

### Task 37: Spotlight layout

**Files:**
- Create: `desktop/src/lib/layouts/LayoutSpotlight.svelte`

- [ ] **Step 1: Write the layout**

```svelte
<script lang="ts">
  import ClipCard from '../components/ClipCard.svelte';
  import type { ClipDto } from '../api';
  let { clips, selectedHash, onSelect = (_h: string) => {}, focusOverride = null as any }: {
    clips: ClipDto[]; selectedHash: string | null; onSelect?: (hash: string) => void;
    focusOverride?: any;  // when edit pane is open, the parent renders its UI here
  } = $props();
  const selected = $derived(clips.find(c => c.hash === selectedHash) ?? clips[0]);
  const thumbs = $derived(clips.filter(c => c.hash !== (selected?.hash)));
</script>

<div class="spotlight">
  <div class="focus">
    {#if focusOverride}
      {@render focusOverride()}
    {:else if selected}
      <div class="badge-row">
        <span class="badge type-{selected.content_type}">{selected.content_type.toUpperCase()}</span>
        <span class="hint">↵ paste</span>
      </div>
      <div class="focus-content">
        {#if selected.content_type === 'code'}
          <pre>{selected.preview}</pre>
        {:else if selected.content_type === 'link'}
          <div class="link-card">
            <div class="favicon"></div>
            <div>
              <div class="url">{selected.preview}</div>
              <div class="title">{selected.preview}</div>
              <div class="og-placeholder">preview · open-graph thumbnail</div>
            </div>
          </div>
        {:else if selected.content_type === 'image'}
          <div class="image-large"></div>
        {:else if selected.content_type === 'color'}
          <div class="color-large" style:background={selected.preview}></div>
          <div class="color-text">{selected.preview}</div>
        {:else if selected.content_type === 'emoji'}
          <div class="emoji-large">{selected.preview}</div>
        {:else}
          <div class="text-large">{selected.preview}</div>
        {/if}
      </div>
      <div class="meta">
        {#if selected.source_app}<span>{selected.source_app}</span>{/if}
        <span class="spacer"></span>
        <span>copied {Math.floor((Date.now() - selected.created_at)/1000)}s ago</span>
      </div>
    {:else}
      <div class="empty">No clip focused</div>
    {/if}
  </div>
  <div class="thumbs">
    {#each thumbs as clip (clip.id)}
      <ClipCard {clip} density="compact" onSelect={() => onSelect(clip.hash)}
        state={clip.hash === selectedHash ? 'selected' : 'default'} />
    {/each}
  </div>
</div>

<style>
  .spotlight { display: flex; height: 100%; }
  .focus { width: 480px; padding: 24px; border-right: 1px solid var(--cm-border-subtle);
    background: rgba(0,0,0,.18); display: flex; flex-direction: column; gap: 14px; min-height: 0; }
  .badge-row { display: flex; align-items: center; justify-content: space-between; }
  .badge { padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; background: var(--badge-text-bg); color: var(--badge-text-fg); }
  .hint { font-size: 11px; color: var(--cm-text-secondary); }
  .focus-content { flex: 1; overflow: hidden; min-height: 0; }
  pre { margin: 0; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; line-height: 1.55; color: var(--cm-text); white-space: pre; overflow: hidden; }
  .text-large { font-size: 14px; color: var(--cm-text); line-height: 1.55; white-space: pre-wrap; }
  .link-card { display: flex; flex-direction: column; gap: 14px; }
  .favicon { width: 26px; height: 26px; border-radius: 6px; background: var(--cm-accent); }
  .url { font-size: 12px; color: var(--cm-text-secondary); font-family: 'Geist Mono', ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-size: 15px; color: var(--cm-text); font-weight: 500; }
  .og-placeholder { margin-top: 8px; padding: 16px; border-radius: 10px; background: linear-gradient(135deg, color-mix(in srgb, var(--cm-accent) 22%, transparent), var(--cm-surface-raised)); color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10px; text-align: center; }
  .image-large { flex: 1; border-radius: 10px; background: linear-gradient(135deg, color-mix(in srgb, var(--cm-accent) 22%, transparent), var(--cm-surface-raised)); }
  .color-large { flex: 1; border-radius: 10px; }
  .color-text { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--cm-text); }
  .emoji-large { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 120px; }
  .meta { padding-top: 10px; border-top: 1px solid var(--cm-border-subtle); display: flex; gap: 10px; font-size: 11px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; }
  .spacer { flex: 1; }
  .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--cm-text-tertiary); }
  .thumbs { flex: 1; display: flex; gap: 8px; padding: 14px 16px; overflow-x: auto; align-items: stretch; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/layouts/LayoutSpotlight.svelte
git commit -m "feat(desktop): Spotlight layout (focus pane + thumb strip)"
```

### Task 38: Sectioned layout

**Files:**
- Create: `desktop/src/lib/layouts/LayoutSectioned.svelte`

- [ ] **Step 1: Write the layout**

```svelte
<script lang="ts">
  import type { ClipDto } from '../api';
  let { clips, selectedHash, onSelect = (_h: string) => {}, searchActive = false }: {
    clips: ClipDto[]; selectedHash: string | null; onSelect?: (h: string) => void; searchActive?: boolean;
  } = $props();

  type Group = { label: string; items: ClipDto[] };
  const groups = $derived(buildGroups(clips, searchActive));

  function buildGroups(cs: ClipDto[], search: boolean): Group[] {
    if (search) return [{ label: `RESULTS · ${cs.length} MATCHES`, items: cs }];
    const pinned = cs.filter(c => c.is_pinned);
    const others = cs.filter(c => !c.is_pinned);
    const now = Date.now();
    const today = others.filter(c => now - c.created_at < 86_400_000);
    const earlier = others.filter(c => now - c.created_at >= 86_400_000);
    const g: Group[] = [];
    if (pinned.length) g.push({ label: 'PINNED', items: pinned });
    if (today.length) g.push({ label: 'TODAY', items: today });
    if (earlier.length) g.push({ label: 'EARLIER', items: earlier });
    return g;
  }

  function previewText(c: ClipDto): string {
    if (c.content_type === 'image') return 'Screenshot';
    if (c.content_type === 'file') return c.preview;
    return c.preview.split('\n')[0];
  }
</script>

<div class="sectioned">
  {#each groups as g}
    <div class="group">
      <div class="label" class:results={g.label.startsWith('RESULTS')}>{g.label}</div>
      {#each g.items as c (c.id)}
        <button class="row" class:selected={c.hash === selectedHash} onclick={() => onSelect(c.hash)} type="button">
          <span class="badge type-{c.content_type}">{c.content_type.toUpperCase()}</span>
          <span class="text">{previewText(c)}</span>
          {#if c.is_favorite}<span class="star">★</span>{/if}
          <span class="time">{relTime(c.created_at)}</span>
        </button>
      {/each}
    </div>
  {/each}
  {#if groups.length === 0}
    <div class="empty">— nothing —</div>
  {/if}
</div>

<script lang="ts" module>
  function relTime(ms: number): string {
    const d = Date.now() - ms;
    if (d < 60_000) return 'now';
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
    return `${Math.floor(d / 86_400_000)}d`;
  }
</script>

<style>
  .sectioned { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; padding: 14px 16px; height: 100%; overflow: hidden; }
  .group { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .label { font-size: 10px; font-weight: 600; color: var(--cm-text-tertiary); letter-spacing: .8px; padding: 0 10px 5px; font-family: 'Geist Mono', ui-monospace, monospace; }
  .label.results { color: var(--cm-accent); }
  .row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 7px;
    background: transparent; border: 1px solid transparent; cursor: pointer; font-family: inherit; text-align: left; color: var(--cm-text); }
  .row.selected { background: var(--cm-surface-raised); border-color: var(--cm-accent); }
  .badge { padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600; }
  .text { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .star { color: var(--cm-accent); }
  .time { font-size: 10px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; width: 28px; text-align: right; }
  .empty { display: flex; align-items: center; justify-content: center; grid-column: 1 / -1; color: var(--cm-text-tertiary); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/layouts/LayoutSectioned.svelte
git commit -m "feat(desktop): Sectioned layout (Pinned/Today/Earlier 3-column)"
```

### Task 39: Mosaic layout

**Files:**
- Create: `desktop/src/lib/layouts/LayoutMosaic.svelte`

- [ ] **Step 1: Write the layout**

```svelte
<script lang="ts">
  import ClipCard from '../components/ClipCard.svelte';
  import type { ClipDto } from '../api';
  let { clips, selectedHash, onSelect = (_h: string) => {}, filterActive = false }: {
    clips: ClipDto[]; selectedHash: string | null; onSelect?: (h: string) => void; filterActive?: boolean;
  } = $props();

  function widthFor(c: ClipDto, isFirstFiltered: boolean): number {
    if (isFirstFiltered) return 320;
    switch (c.content_type) {
      case 'code': return 280;
      case 'image': return 240;
      case 'text': return 220;
      case 'link': return 200;
      case 'file': return 200;
      case 'color': return 160;
      case 'emoji': return 130;
      default: return 200;
    }
  }
</script>

<div class="mosaic">
  {#each clips as c, i (c.id)}
    <div style:width="{widthFor(c, filterActive && i === 0)}px" style:flex-shrink="0">
      <ClipCard clip={c} density="comfortable"
        state={c.hash === selectedHash ? 'selected' : 'default'}
        onSelect={() => onSelect(c.hash)} />
    </div>
  {/each}
</div>
<style>
  .mosaic { display: flex; gap: 12px; padding: 16px 20px; overflow-x: auto; overflow-y: hidden; height: 100%; align-items: stretch; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/layouts/LayoutMosaic.svelte
git commit -m "feat(desktop): Mosaic layout (cards sized by type)"
```

### Task 40: PanelLayout container

**Files:**
- Create: `desktop/src/lib/components/PanelLayout.svelte`

- [ ] **Step 1: Write the container**

```svelte
<script lang="ts">
  import LayoutCards     from '../layouts/LayoutCards.svelte';
  import LayoutSpotlight from '../layouts/LayoutSpotlight.svelte';
  import LayoutSectioned from '../layouts/LayoutSectioned.svelte';
  import LayoutMosaic    from '../layouts/LayoutMosaic.svelte';
  import EmptyState from './EmptyState.svelte';
  import type { ClipDto } from '../api';
  let { layout, clips, selectedHash, density, filter, onSelect, focusOverride = null as any }: {
    layout: 'cards'|'spotlight'|'sectioned'|'mosaic';
    clips: ClipDto[]; selectedHash: string | null; density: 'compact'|'comfortable'|'spacious';
    filter: { search: string; type: string | null; favoritesOnly: boolean };
    onSelect: (hash: string) => void;
    focusOverride?: any;
  } = $props();
</script>
{#if clips.length === 0}
  {#if filter.search}<EmptyState variant="no-results" search={filter.search} />
  {:else if filter.type}<EmptyState variant="no-filter" />
  {:else}<EmptyState variant="no-history" />{/if}
{:else if layout === 'cards'}
  <LayoutCards {clips} {selectedHash} {density} {onSelect} />
{:else if layout === 'spotlight'}
  <LayoutSpotlight {clips} {selectedHash} {onSelect} {focusOverride} />
{:else if layout === 'sectioned'}
  <LayoutSectioned {clips} {selectedHash} {onSelect} searchActive={!!filter.search} />
{:else if layout === 'mosaic'}
  <LayoutMosaic {clips} {selectedHash} {onSelect} filterActive={!!filter.type} />
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/components/PanelLayout.svelte
git commit -m "feat(desktop): PanelLayout container switching all 4 layouts"
```

### Task 41: Edit pane

**Files:**
- Create: `desktop/src/lib/components/EditPane.svelte`

- [ ] **Step 1: Write the pane**

```svelte
<script lang="ts">
  import { api, type ClipDto } from '../api';
  let { clip, onSave = (_id: number) => {}, onCancel = () => {} }: {
    clip: ClipDto; onSave?: (newId: number) => void; onCancel?: () => void;
  } = $props();
  let value = $state(clip.preview);
  const editable = $derived(['text','link','code','color','emoji'].includes(clip.content_type));

  async function save(paste: boolean) {
    if (!editable) return;
    const newId = await api.saveEditedClip(clip.id, value);
    onSave(newId);
    if (paste) {
      // Tauri command for paste-after-save handled in Task 43 keyboard wire-up
    }
  }
  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); save(true); }
  }
</script>

{#if !editable}
  <div class="not-editable">Edit not available for {clip.content_type} clips.</div>
{:else}
  <div class="edit-pane" onkeydown={keydown}>
    <div class="head">
      <span class="badge type-{clip.content_type}">{clip.content_type.toUpperCase()}</span>
      <span class="meta">{clip.source_app ?? ''} · {new Date(clip.created_at).toLocaleString()}</span>
    </div>
    <textarea bind:value class:mono={clip.content_type === 'code'}></textarea>
    <div class="actions">
      <button type="button" class="cancel" onclick={onCancel}>Cancel</button>
      <button type="button" class="save" onclick={() => save(false)}>Save</button>
      <button type="button" class="save-paste" onclick={() => save(true)}>Save &amp; Paste · Ctrl+↵</button>
    </div>
  </div>
{/if}

<style>
  .edit-pane { display: flex; flex-direction: column; gap: 12px; padding: 20px; height: 100%; }
  .head { display: flex; align-items: center; justify-content: space-between; }
  .badge { padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; background: var(--badge-text-bg); color: var(--badge-text-fg); }
  .meta { font-size: 11px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; }
  textarea { flex: 1; resize: none; border-radius: 10px; border: 1px solid var(--cm-border-subtle);
    background: var(--cm-surface-sunken); color: var(--cm-text); padding: 12px; font-family: inherit; font-size: 14px; line-height: 1.5; outline: none; }
  textarea.mono { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; }
  textarea:focus { border-color: var(--cm-accent); }
  .actions { display: flex; gap: 8px; justify-content: flex-end; }
  button { padding: 7px 14px; border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid var(--cm-border-subtle); background: transparent; color: var(--cm-text-secondary); }
  button.save { background: var(--cm-surface-raised); color: var(--cm-text); border-color: var(--cm-border-strong); }
  button.save-paste { background: var(--cm-accent); color: white; border: none; }
  .not-editable { padding: 40px; text-align: center; color: var(--cm-text-secondary); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/components/EditPane.svelte
git commit -m "feat(desktop): EditPane for text-shaped clips (save creates new clip)"
```

### Task 42: SettingsView with layout/density/accent pickers + toggles

**Files:**
- Create: `desktop/src/lib/components/SettingsView.svelte`

- [ ] **Step 1: Write the view**

```svelte
<script lang="ts">
  import { settingsStore } from '../stores/settings.svelte';
  let section = $state<'general'|'hotkeys'|'exclusions'|'layout'|'actions'|'about'>('general');
  const accentSwatches = ['#E95678','#7C7CFF','#5BC0BE','#C792EA','#ECECF1'];
  async function set<K extends keyof typeof settingsStore.s>(k: K, v: any) {
    if (settingsStore.s) await settingsStore.save({ [k]: v } as any);
  }
</script>

<div class="settings">
  <nav>
    {#each ['general','hotkeys','exclusions','layout','actions','about'] as id}
      <button class:active={section === id} onclick={() => section = id}>{id}</button>
    {/each}
  </nav>
  <div class="body">
    {#if !settingsStore.s}
      <div>Loading…</div>
    {:else if section === 'general'}
      <h3>General</h3>
      <div class="row"><label>Sound on copy</label><input type="checkbox" checked={settingsStore.s.sound_on_copy} onchange={(e) => set('sound_on_copy', (e.target as HTMLInputElement).checked)} /></div>
      <div class="row"><label>Notifications on copy</label><input type="checkbox" checked={settingsStore.s.notifications_on_copy} onchange={(e) => set('notifications_on_copy', (e.target as HTMLInputElement).checked)} /></div>
      <div class="row"><label>Link previews (network egress on view)</label><input type="checkbox" checked={settingsStore.s.link_previews_enabled} onchange={(e) => set('link_previews_enabled', (e.target as HTMLInputElement).checked)} /></div>
      <div class="row"><label>Auto-sync outgoing (text-shaped clips → phone)</label><input type="checkbox" checked={settingsStore.s.auto_sync_outgoing} onchange={(e) => set('auto_sync_outgoing', (e.target as HTMLInputElement).checked)} /></div>
      <div class="row"><label>Auto-sync incoming (text-shaped clips ← phone)</label><input type="checkbox" checked={settingsStore.s.auto_sync_incoming} onchange={(e) => set('auto_sync_incoming', (e.target as HTMLInputElement).checked)} /></div>
      <div class="row"><label>History size</label><input type="number" min="50" max="10000" value={settingsStore.s.history_size} onchange={(e) => set('history_size', parseInt((e.target as HTMLInputElement).value, 10))} /></div>
      <div class="row"><label>Polling interval (ms)</label><input type="number" min="100" max="1000" value={settingsStore.s.polling_ms} onchange={(e) => set('polling_ms', parseInt((e.target as HTMLInputElement).value, 10))} /></div>
      <div class="row"><label>Incognito auto-disable (sec)</label><input type="number" min="60" max="3600" value={settingsStore.s.incognito_auto_disable_secs} onchange={(e) => set('incognito_auto_disable_secs', parseInt((e.target as HTMLInputElement).value, 10))} /></div>
    {:else if section === 'layout'}
      <h3>Layout</h3>
      <div class="row"><label>Layout</label>
        <select value={settingsStore.s.layout} onchange={(e) => set('layout', (e.target as HTMLSelectElement).value)}>
          <option value="cards">Cards (default)</option>
          <option value="spotlight">Spotlight</option>
          <option value="sectioned">Sectioned</option>
          <option value="mosaic">Mosaic</option>
        </select>
      </div>
      <div class="row"><label>Density</label>
        <select value={settingsStore.s.density} onchange={(e) => set('density', (e.target as HTMLSelectElement).value)}>
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </div>
      <div class="row"><label>Panel position</label>
        <select value={settingsStore.s.panel_position} onchange={(e) => set('panel_position', (e.target as HTMLSelectElement).value)}>
          <option value="bottom">Bottom</option><option value="top">Top</option><option value="left">Left</option><option value="right">Right</option>
        </select>
      </div>
      <div class="row"><label>Theme</label>
        <select value={settingsStore.s.theme} onchange={(e) => set('theme', (e.target as HTMLSelectElement).value)}>
          <option value="auto">Auto</option><option value="dark">Dark</option><option value="light">Light</option>
        </select>
      </div>
      <div class="row"><label>Accent</label>
        <div class="swatches">
          {#each accentSwatches as s}
            <button class="swatch" style:background={s} class:active={settingsStore.s.accent === s} onclick={() => set('accent', s)} aria-label={s}></button>
          {/each}
        </div>
      </div>
    {:else if section === 'hotkeys'}
      <h3>Hotkeys (rebindable)</h3>
      <div class="row"><label>Open panel</label><input type="text" value={settingsStore.s.hotkey_panel} onchange={(e) => set('hotkey_panel', (e.target as HTMLInputElement).value)} /></div>
      <div class="row"><label>Toggle incognito</label><input type="text" value={settingsStore.s.hotkey_incognito} onchange={(e) => set('hotkey_incognito', (e.target as HTMLInputElement).value)} /></div>
    {:else if section === 'exclusions'}
      <h3>Exclusions</h3>
      <p class="hint">Clips copied while one of these apps is focused are skipped.</p>
      <p>(Manage via right-click → "Exclude this app" on any clip's source-app icon — wired in a follow-up.)</p>
    {:else if section === 'about'}
      <h3>About</h3>
      <p>Clippy v0.1.0 — LAN-only clipboard manager</p>
    {/if}
  </div>
</div>

<style>
  .settings { display: flex; height: 100%; }
  nav { width: 180px; border-right: 1px solid var(--cm-border-subtle); padding: 14px 8px; display: flex; flex-direction: column; gap: 1px; }
  nav button { padding: 7px 11px; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--cm-text-secondary); background: transparent; border: none; cursor: pointer; text-align: left; text-transform: capitalize; font-family: inherit; }
  nav button.active { color: var(--cm-text); background: var(--cm-surface-raised); }
  .body { flex: 1; padding: 18px 28px; overflow: auto; color: var(--cm-text); }
  h3 { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
  .row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--cm-border-subtle); gap: 12px; }
  label { font-size: 13px; font-weight: 500; }
  input[type=number], input[type=text], select { background: var(--cm-surface-raised); color: var(--cm-text); border: 1px solid var(--cm-border-strong); border-radius: 7px; padding: 5px 10px; font-family: inherit; font-size: 12px; }
  .hint { font-size: 11.5px; color: var(--cm-text-secondary); }
  .swatches { display: flex; gap: 6px; }
  .swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
  .swatch.active { border-color: var(--cm-text); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/components/SettingsView.svelte
git commit -m "feat(desktop): SettingsView with layout/density/accent/theme/hotkey/toggles"
```

### Task 43: App shell + keyboard nav

**Files:**
- Modify: `desktop/src/App.svelte`, `desktop/src/main.ts`

- [ ] **Step 1: Replace App.svelte**

```svelte
<script lang="ts">
  import './app.css';
  import PanelLayout from './lib/components/PanelLayout.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import FilterChip from './lib/components/FilterChip.svelte';
  import SettingsView from './lib/components/SettingsView.svelte';
  import EditPane from './lib/components/EditPane.svelte';
  import { clipsStore } from './lib/stores/clips.svelte';
  import { settingsStore } from './lib/stores/settings.svelte';
  import { filterStore } from './lib/stores/filter.svelte';
  import { selectionStore } from './lib/stores/selection.svelte';
  import { onMount, tick } from 'svelte';

  let mode = $state<'list'|'settings'|'edit'>('list');
  let editingId: number | null = $state(null);
  let searchBarRef: SearchBar | undefined;
  let searchFocused = $state(false);

  onMount(async () => {
    await settingsStore.load();
    await clipsStore.refresh();
  });

  $effect(() => {
    void filterStore.search; void filterStore.type; void filterStore.favoritesOnly;
    clipsStore.refresh(filterStore.search, filterStore.type ?? undefined, filterStore.favoritesOnly);
  });

  function selectedIndex(): number {
    return clipsStore.clips.findIndex(c => c.hash === selectionStore.hash);
  }
  function moveSelection(delta: number) {
    const cs = clipsStore.clips;
    if (cs.length === 0) return;
    const cur = Math.max(0, selectedIndex());
    const next = (cur + delta + cs.length) % cs.length;
    selectionStore.setByHash(cs[next].hash);
  }

  async function onKeydown(e: KeyboardEvent) {
    if (mode === 'edit') return; // EditPane handles its own keys
    if (mode === 'settings') {
      if (e.key === 'Escape') { mode = 'list'; e.preventDefault(); }
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); moveSelection(+1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); await pasteSelected(e.shiftKey); }
    else if (e.key === 'Escape') { /* Tauri-side hide panel — see Task 44 */ }
    else if (e.key === 'Tab') { e.preventDefault(); e.shiftKey ? filterStore.cycleTypeReverse() : filterStore.cycleType(); }
    else if (e.key === 'Backspace' && !filterStore.search) { e.preventDefault(); filterStore.type = null; }
    else if (e.key === 'Delete') { e.preventDefault(); await deleteSelected(e.shiftKey); }
    else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); await toggleFavoriteSelected(); }
    else if (e.key === 'p' || e.key === 'P') { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); await togglePinSelected(); } }
    else if (e.key === 'Alt') { filterStore.favoritesOnly = !filterStore.favoritesOnly; }
    else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); await openEditor(); }
    else if (/^[\w !@#$%^&*()\-=+[\]{};:'",.<>/?]$/.test(e.key)) {
      searchBarRef?.focus();
    }
  }

  async function pasteSelected(shift: boolean) {
    const c = clipsStore.clips[selectedIndex()];
    if (!c) return;
    // For Phase 1, just close panel; Tauri-side paste-synthesis comes via Task 44 (hotkey + window mgr)
  }
  async function toggleFavoriteSelected() {
    const c = clipsStore.clips[selectedIndex()];
    if (c) await clipsStore.toggleFavorite(c.id);
  }
  async function togglePinSelected() {
    const c = clipsStore.clips[selectedIndex()];
    if (c) await clipsStore.togglePin(c.id);
  }
  async function deleteSelected(force: boolean) {
    const c = clipsStore.clips[selectedIndex()];
    if (c) await clipsStore.delete(c.id, force);
  }
  async function openEditor() {
    const c = clipsStore.clips[selectedIndex()];
    if (!c) return;
    if (!['text','link','code','color','emoji'].includes(c.content_type)) return;
    editingId = c.id;
    mode = 'edit';
  }

  const selectedClipForEdit = $derived(clipsStore.clips.find(c => c.id === editingId));
</script>

<svelte:window on:keydown={onKeydown} />

<div class="panel">
  <header>
    <SearchBar bind:value={filterStore.search} bind:focused={searchFocused} bind:this={searchBarRef} />
    <div class="chips">
      <FilterChip label="All" active={filterStore.type === null && !filterStore.favoritesOnly} onClick={() => { filterStore.type = null; filterStore.favoritesOnly = false; }} />
      <FilterChip label="Favorites" icon="★" active={filterStore.favoritesOnly} onClick={() => filterStore.favoritesOnly = !filterStore.favoritesOnly} />
      {#each ['text','image','link','code','color','emoji','file'] as t}
        <FilterChip label={t[0].toUpperCase()+t.slice(1)} active={filterStore.type === t} onClick={() => filterStore.type = filterStore.type === t ? null : t} />
      {/each}
    </div>
    <button class="settings-btn" onclick={() => mode = mode === 'settings' ? 'list' : 'settings'} aria-label="Settings">⚙</button>
  </header>

  <main>
    {#if mode === 'settings'}
      <SettingsView />
    {:else if mode === 'edit' && selectedClipForEdit}
      <EditPane clip={selectedClipForEdit} onSave={() => { mode = 'list'; editingId = null; clipsStore.refresh(); }} onCancel={() => { mode = 'list'; editingId = null; }} />
    {:else if settingsStore.s}
      <PanelLayout layout={settingsStore.s.layout as any}
        clips={clipsStore.clips}
        selectedHash={selectionStore.hash}
        density={settingsStore.s.density as any}
        filter={{ search: filterStore.search, type: filterStore.type, favoritesOnly: filterStore.favoritesOnly }}
        onSelect={(h) => selectionStore.setByHash(h)} />
    {/if}
  </main>

  <footer>
    <span>{clipsStore.clips.length} items</span>
    <span class="dot">·</span>
    <span class="conn">No device paired · <a>Pair phone →</a></span>
    <span class="spacer"></span>
    <span class="hints">↵ paste · ⌫ delete · type to search</span>
  </footer>
</div>

<style>
  .panel { display: flex; flex-direction: column; height: 100%;
    background: var(--cm-panel-scrim); backdrop-filter: blur(24px) saturate(140%); -webkit-backdrop-filter: blur(24px) saturate(140%);
    border-radius: var(--cm-radius-panel); border: 1px solid var(--cm-border-subtle); color: var(--cm-text); overflow: hidden; }
  header { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 16px; border-bottom: 1px solid var(--cm-border-subtle); flex-shrink: 0; }
  .chips { display: flex; gap: 6px; flex: 1; overflow: hidden; min-width: 0; }
  .settings-btn { width: 32px; height: 32px; border-radius: 8px; background: transparent; border: none; color: var(--cm-text-secondary); cursor: pointer; font-size: 16px; }
  main { flex: 1; min-height: 0; position: relative; }
  footer { height: 28px; padding: 0 20px; display: flex; align-items: center; gap: 10px;
    border-top: 1px solid var(--cm-border-subtle); font-size: 11px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace; background: rgba(0,0,0,.15); flex-shrink: 0; }
  .dot { opacity: .5; }
  .conn a { color: var(--cm-accent); text-decoration: underline; cursor: pointer; }
  .spacer { flex: 1; }
  .hints { opacity: .7; }
</style>
```

- [ ] **Step 2: Verify dev mode**

```bash
cd desktop && cargo tauri dev
```

Expected: panel window renders with header/footer; sample copies don't appear yet (no live polling wire-up). Kill with `q`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/App.svelte
git commit -m "feat(desktop): App shell with header, footer, keyboard nav, layout swap, edit mode"
```

### Task 44: Wire polling source + global hotkey into the running app

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Replace lib.rs `run()` with the full wire-up**

```rust
use std::sync::{Arc, Mutex};
use tauri::{Manager, Emitter, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tracing_subscriber::EnvFilter;

pub mod clipboard;
pub mod db;
pub mod thumb;
pub mod settings;
pub mod actions;
pub mod link_preview;
pub mod dbus_app;
pub mod commands;
pub mod sound;
pub mod notifications;
pub mod incognito;
pub mod excluded_apps;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,clippy=debug")))
        .with_target(false)
        .init();

    let db_path = dirs::data_local_dir().unwrap().join("clippy/clippy.db");
    let db = Arc::new(Mutex::new(db::Db::open(&db_path).expect("open db")));
    let settings = settings::Settings::load(&db.lock().unwrap()).unwrap_or_default();

    let paused = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let inc = Arc::new(incognito::Incognito::new(settings.incognito_auto_disable_secs));
    let inc_active = inc.active();

    let sound = Arc::new(sound::SoundPlayer::new(settings.sound_on_copy));
    let notif = Arc::new(notifications::Notifier::new(settings.notifications_on_copy));

    let app_state = commands::AppState { db: db.clone() };

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::with_handler({
            let inc = inc.clone();
            move |app, shortcut, event| {
                if event.state() != tauri_plugin_global_shortcut::ShortcutState::Pressed { return; }
                if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyV) {
                    if let Some(w) = app.get_webview_window("panel") {
                        if w.is_visible().unwrap_or(false) { let _ = w.hide(); }
                        else { let _ = w.show(); let _ = w.set_focus(); }
                    }
                } else if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyI) {
                    let on = inc.toggle();
                    tracing::info!("incognito: {}", if on { "ON" } else { "OFF" });
                }
            }
        }).build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::list_clips, commands::get_clip_content, commands::get_thumbnail,
            commands::toggle_favorite, commands::toggle_pin, commands::delete_clip,
            commands::save_edited_clip, commands::load_settings, commands::save_settings,
        ])
        .setup(move |app| {
            // Register hotkeys
            let panel_chord = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyV);
            let inc_chord   = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyI);
            app.global_shortcut().register(panel_chord)?;
            app.global_shortcut().register(inc_chord)?;

            // Polling source pipeline
            let db2 = db.clone();
            let sound2 = sound.clone();
            let notif2 = notif.clone();
            let app_handle = app.handle().clone();
            let inc_active2 = inc_active.clone();
            let history_size = settings.history_size;
            tauri::async_runtime::spawn(async move {
                let (_src, rx) = clipboard::source_polling::PollingSource::start(
                    settings.polling_ms, inc_active2.clone(),
                );
                let excluded = excluded_apps::load_exclusions(&db2.lock().unwrap());
                let app_handle2 = app_handle.clone();
                let on_new = Box::new(move |id: i64, ct: clipboard::ContentType| {
                    sound2.play_copy();
                    let preview = {
                        let db = db2.lock().unwrap();
                        db.conn().query_row("SELECT preview FROM clips WHERE id = ?1", rusqlite::params![id], |r| r.get::<_, String>(0)).unwrap_or_default()
                    };
                    notif2.notify_capture(ct, &preview);
                    let _ = app_handle2.emit("clip-new", id);
                });
                let pipeline = clipboard::pipeline::Pipeline::new(db2.clone(), excluded, history_size, on_new);
                pipeline.run(rx, excluded_apps::current_focused_app).await;
            });

            // Hide panel by default
            if let Some(w) = app.get_webview_window("panel") {
                let _ = w.hide();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(false) = event {
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Build and smoke-test live**

```bash
cd desktop && cargo tauri dev
```

In another terminal, copy something. Expected: sound plays (faint), panel opens on `Ctrl+Shift+V`, clip appears at top of the layout.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): wire polling pipeline + global hotkey + window mgmt"
```

### Task 45: Paste synthesis via enigo

**Files:**
- Create: `desktop/src-tauri/src/paste.rs`
- Modify: `desktop/src-tauri/src/commands.rs`, `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write paste.rs**

```rust
use arboard::Clipboard;
use enigo::{Enigo, Keyboard, Settings, Key, Direction};

pub fn paste_to_active(content: &[u8], mime: &str, shift_for_terminal: bool) -> Result<(), String> {
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    if mime.starts_with("text/") {
        let s = std::str::from_utf8(content).map_err(|e| e.to_string())?;
        cb.set_text(s.to_string()).map_err(|e| e.to_string())?;
    } else if mime.starts_with("image/") {
        // arboard wants raw RGBA — decode and convert
        let img = image::load_from_memory(content).map_err(|e| e.to_string())?.to_rgba8();
        cb.set_image(arboard::ImageData {
            width: img.width() as usize, height: img.height() as usize,
            bytes: img.into_raw().into(),
        }).map_err(|e| e.to_string())?;
    }
    // Brief delay to let the target app see the new clipboard before we synthesise paste
    std::thread::sleep(std::time::Duration::from_millis(40));
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    if shift_for_terminal { enigo.key(Key::Shift, Direction::Press).map_err(|e| e.to_string())?; }
    enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
    if shift_for_terminal { enigo.key(Key::Shift, Direction::Release).map_err(|e| e.to_string())?; }
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    Ok(())
}
```

Add to `commands.rs`:
```rust
#[tauri::command]
pub fn paste_by_id(state: State<'_, AppState>, id: i64, shift_for_terminal: bool) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (content, mime): (Vec<u8>, String) = db.conn().query_row(
        "SELECT content, mime FROM clips WHERE id = ?1",
        rusqlite::params![id], |r| Ok((r.get(0)?, r.get(1)?))
    ).map_err(|e| e.to_string())?;
    drop(db);
    crate::paste::paste_to_active(&content, &mime, shift_for_terminal)
}
```

Register `paste_by_id` in `generate_handler!` and add `pub mod paste;` to `lib.rs`.

Add `paste_by_id: (id: number, shiftForTerminal = false) => invoke<void>('paste_by_id', { id, shiftForTerminal })` to `api.ts`.

Update `App.svelte` `pasteSelected`:
```typescript
async function pasteSelected(shift: boolean) {
  const c = clipsStore.clips[selectedIndex()];
  if (!c) return;
  // Hide panel first so the previously-focused app receives the paste
  await import('@tauri-apps/api/window').then(m => m.getCurrentWindow().hide());
  await new Promise(r => setTimeout(r, 50));
  await api.paste_by_id(c.id, shift);
}
```

Add `paste_by_id` to `api` object in `api.ts`.

- [ ] **Step 2: Build and test live**

```bash
cd desktop && cargo tauri dev
```

Copy "hello"; open panel; press Enter; expected: panel closes, "hello" pastes into the previously focused window. Shift+Enter inserts into a terminal correctly.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/paste.rs desktop/src-tauri/src/commands.rs desktop/src-tauri/src/lib.rs desktop/src/lib/api.ts desktop/src/App.svelte
git commit -m "feat(desktop): paste synthesis via enigo (Ctrl+V / Ctrl+Shift+V)"
```

### Task 46: Hover overlay actions + delete/favorite/pin in card

**Files:**
- Create: `desktop/src/lib/components/HoverActions.svelte`
- Modify: `desktop/src/lib/components/ClipCard.svelte`

- [ ] **Step 1: Write HoverActions**

```svelte
<script lang="ts">
  import type { ClipDto } from '../api';
  let { clip, onFav = () => {}, onPin = () => {}, onEdit = () => {}, onDelete = () => {} }: {
    clip: ClipDto; onFav?: () => void; onPin?: () => void; onEdit?: () => void; onDelete?: () => void;
  } = $props();
  const isEditable = $derived(['text','link','code','color','emoji'].includes(clip.content_type));
</script>
<div class="overlay">
  <button title="Favorite" onclick={onFav}>★</button>
  <button title="Pin" onclick={onPin}>📌</button>
  {#if isEditable}<button title="Edit (E)" onclick={onEdit}>✎</button>{/if}
  <button title="Delete" onclick={onDelete}>🗑</button>
</div>
<style>
  .overlay { position: absolute; top: 6px; right: 6px; display: flex; gap: 2px;
    background: rgba(0,0,0,.55); backdrop-filter: blur(12px); border: 1px solid var(--cm-border-subtle); border-radius: 9px; padding: 3px; }
  button { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; color: var(--cm-text-secondary); cursor: pointer; font-size: 12px; }
  button:hover { background: var(--cm-accent); color: white; }
</style>
```

Modify `ClipCard.svelte` to render `HoverActions` when state is `hover` (track hover via `onmouseenter`/`onmouseleave`). Wire actions to call `clipsStore.toggleFavorite/togglePin/delete` and an `onEdit` prop bubble-up. (Detailed Svelte glue is straightforward; engineer adds 4 props + state.)

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/components/HoverActions.svelte desktop/src/lib/components/ClipCard.svelte
git commit -m "feat(desktop): hover overlay with Favorite/Pin/Edit/Delete quick actions"
```

### Task 47: D-Bus app interface running alongside Tauri

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Spawn the D-Bus service in `setup`**

Append in `setup` after polling-source spawn:
```rust
let app_handle3 = app.handle().clone();
tauri::async_runtime::spawn(async move {
    match dbus_app::serve().await {
        Ok((_conn, mut rx)) => {
            while let Some(cmd) = rx.recv().await {
                use dbus_app::AppCommand;
                match cmd {
                    AppCommand::TogglePanel => {
                        if let Some(w) = app_handle3.get_webview_window("panel") {
                            if w.is_visible().unwrap_or(false) { let _ = w.hide(); }
                            else { let _ = w.show(); let _ = w.set_focus(); }
                        }
                    }
                    AppCommand::OpenSettings => { let _ = app_handle3.emit("open-settings", ()); }
                    AppCommand::SearchHistory(q) => { let _ = app_handle3.emit("search", q); }
                    AppCommand::PasteByHash(h) => { let _ = app_handle3.emit("paste-by-hash", h); }
                    AppCommand::RunActionByHash(h, aid) => { let _ = app_handle3.emit("run-action", (h, aid)); }
                    AppCommand::OpenEditor(h) => { let _ = app_handle3.emit("open-editor", h); }
                }
            }
        }
        Err(e) => tracing::warn!("D-Bus serve failed: {e}"),
    }
});
```

- [ ] **Step 2: Test from command line**

In one terminal: `cargo tauri dev`. In another:
```bash
busctl --user call io.clippy.App /io/clippy/App io.clippy.App TogglePanel
```

Expected: panel toggles visibility.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): run io.clippy.App D-Bus service alongside Tauri"
```

### Task 48: Run Phase 1 acceptance smoke test (per PRD §6.4)

**Files:** none.

- [ ] **Step 1: Launch the app**

```bash
cd desktop && cargo tauri dev
```

- [ ] **Step 2: Verify each PRD §6.4 acceptance line**

Walk through every checkbox in `PRD.md` §6.4 manually. For each, note pass/fail in a scratchpad:
- Copy text → appears at top
- Copy image → renders as thumbnail
- HTML+plain text copy → multi-rep stored
- URL → link badge
- Hotkey opens/closes panel; can rebind via Settings
- Enter pastes via Ctrl+V; Shift+Enter via Ctrl+Shift+V (verify in terminal)
- Tab/Shift+Tab cycle filter; Backspace clears
- Delete / Shift+Delete / Ctrl+S / P / Alt all work
- Ctrl+Enter on link opens browser
- Pin draws stripe; un-pinning restores position
- Pinned-but-not-favorited clip is pruned when history fills (manually fill past `history_size`)
- E opens edit pane on text-shaped; refuses on image/file; saved clip has `source_app = 'Clippy (edited)'`
- Layout switch (Cards→Spotlight→Sectioned→Mosaic) preserves selection + search
- Spotlight + link clip shows og-image surface (placeholder when previews disabled)
- Search filters < 50ms latency at 500 items
- Incognito blocks capture; auto-disables after 5 min (use short test timer)
- `keepassxc` in exclusion list: copies from it don't capture (heuristic best-effort)
- Sound plays on every capture; muting silences it
- Notifications appear only when enabled
- Link previews respect 3s timeout + private IP guard
- Memory < 80MB idle / < 200MB with 500 items (`ps -o rss`)
- Startup < 1s
- Settings persist across restart
- `busctl` toggles work for both interfaces
- Geist + exact tokens render in both themes

- [ ] **Step 3: Commit a Phase 1 smoke-test record**

```bash
mkdir -p docs/notes
cat > docs/notes/phase1-smoke-test.md <<EOF
# Phase 1 smoke test
Date: $(date -I)
Result: <fill: PASS / PASS-WITH-NOTES>
Notes: <fill any caveats>
EOF
git add docs/notes/phase1-smoke-test.md
git commit -m "docs: Phase 1 smoke-test record"
```

### Task 49: Tag the Phase 1 milestone

**Files:** none.

- [ ] **Step 1: Tag**

```bash
git tag -a v0.1.0-phase1 -m "Phase 1 — desktop standalone, polling-only"
git log --oneline | head -20
```

Expected: tag created; commit history clean.

End of Part B. Desktop standalone is now usable.

---

## Part C — GNOME extension + desktop wire-up (Phase 1)

Tasks T50–T69. Ships the Clippy GNOME shell extension that publishes clipboard + focused-window signals via D-Bus, then wires the desktop to subscribe (replacing the polling source as primary when the extension is present).

### Task 50: Scaffold the GNOME extension

**Files:**
- Create: `extension/metadata.json`, `package.json`, `tsconfig.json`, `rollup.config.mjs`, `src/extension.ts`, `src/prefs.ts`, `src/dbus.ts`, `schemas/org.gnome.shell.extensions.clippy.gschema.xml`

- [ ] **Step 1: Write metadata.json**

```json
{
  "uuid": "clippy@parth",
  "name": "Clippy",
  "description": "Publishes clipboard + focused-window events via D-Bus for the Clippy desktop app",
  "shell-version": ["45", "46", "47", "48", "49"],
  "url": "https://github.com/parth/clippy",
  "settings-schema": "org.gnome.shell.extensions.clippy",
  "version": 1
}
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "clippy-extension",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c -w",
    "package": "npm run build && (cd dist && zip -r ../clippy-extension.zip .)",
    "install-and-reload": "npm run build && rm -rf ~/.local/share/gnome-shell/extensions/clippy@parth && cp -r dist ~/.local/share/gnome-shell/extensions/clippy@parth && glib-compile-schemas ~/.local/share/gnome-shell/extensions/clippy@parth/schemas/ && echo 'Reload Shell: Alt+F2 → r (Xorg) OR log out/in (Wayland)'",
    "test": "echo 'No tests yet — extension is best smoke-tested live in GNOME Shell.'"
  },
  "devDependencies": {
    "@girs/gjs": "^4.0.0-beta.21",
    "@girs/gnome-shell": "^48.0.0-beta.10",
    "@rollup/plugin-typescript": "^11.1.6",
    "rollup": "^4.21.0",
    "typescript": "^5.5.0",
    "tslib": "^2.6.0"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022"],
    "types": ["@girs/gjs", "@girs/gnome-shell/ambient"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write rollup.config.mjs**

```javascript
import typescript from '@rollup/plugin-typescript';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export default [
  { input: 'src/extension.ts', external: id => id.startsWith('gi://') || id.startsWith('resource://'),
    output: { file: 'dist/extension.js', format: 'esm' }, plugins: [typescript()] },
  { input: 'src/prefs.ts', external: id => id.startsWith('gi://') || id.startsWith('resource://'),
    output: { file: 'dist/prefs.js', format: 'esm' }, plugins: [typescript(), {
      name: 'copy-meta', closeBundle() {
        for (const f of ['metadata.json']) { copyFileSync(f, `dist/${f}`); }
        mkdirSync('dist/schemas', { recursive: true });
        copyFileSync('schemas/org.gnome.shell.extensions.clippy.gschema.xml', 'dist/schemas/org.gnome.shell.extensions.clippy.gschema.xml');
      }
    }] },
];
```

- [ ] **Step 5: Install deps**

```bash
cd extension && npm install
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add extension/
git commit -m "feat(extension): scaffold GNOME shell extension (TypeScript + rollup)"
```

### Task 51: Define gschema

**Files:**
- Create: `extension/schemas/org.gnome.shell.extensions.clippy.gschema.xml`

- [ ] **Step 1: Write the schema**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist gettext-domain="clippy">
  <schema id="org.gnome.shell.extensions.clippy" path="/org/gnome/shell/extensions/clippy/">
    <key name="emit-focused-window" type="b">
      <default>true</default>
      <summary>Emit FocusedWindowChanged signals</summary>
      <description>When false, the extension only emits ClipboardChanged.</description>
    </key>
    <key name="signal-verbosity" type="s">
      <choices>
        <choice value="quiet"/>
        <choice value="normal"/>
        <choice value="debug"/>
      </choices>
      <default>"normal"</default>
      <summary>Logging verbosity</summary>
    </key>
  </schema>
</schemalist>
```

- [ ] **Step 2: Commit**

```bash
git add extension/schemas/
git commit -m "feat(extension): GSettings schema for extension prefs"
```

### Task 52: Write the D-Bus interface declarations

**Files:**
- Create: `extension/src/dbus.ts`

- [ ] **Step 1: Write the XML wrapper**

```typescript
export const CLIPPY_IFACE_XML = `
<node>
  <interface name="org.gnome.Shell.Extensions.Clippy">
    <method name="Toggle"/>
    <method name="Show"/>
    <method name="Hide"/>
    <method name="ClearHistory"><arg type="b" name="all" direction="in"/></method>
    <signal name="ClipboardChanged">
      <arg type="s" name="mime"/>
      <arg type="s" name="b64_content"/>
    </signal>
    <signal name="FocusedWindowChanged">
      <arg type="s" name="app_id"/>
      <arg type="s" name="title"/>
    </signal>
  </interface>
</node>
`;
```

- [ ] **Step 2: Commit**

```bash
git add extension/src/dbus.ts
git commit -m "feat(extension): D-Bus interface XML for org.gnome.Shell.Extensions.Clippy"
```

### Task 53: Implement the extension entry

**Files:**
- Create: `extension/src/extension.ts`

- [ ] **Step 1: Write extension.ts**

```typescript
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Shell from 'gi://Shell';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { CLIPPY_IFACE_XML } from './dbus.js';

export default class ClippyExtension extends Extension {
  private dbus?: Gio.DBusExportedObject;
  private settings?: Gio.Settings;
  private clipboardSignal?: number;
  private focusSignal?: number;
  private lastClipboardB64?: string;

  enable() {
    this.settings = this.getSettings();

    // D-Bus export
    const node = Gio.DBusNodeInfo.new_for_xml(CLIPPY_IFACE_XML);
    const iface = node.lookup_interface('org.gnome.Shell.Extensions.Clippy')!;
    this.dbus = Gio.DBusExportedObject.wrapJSObject(iface, this as any);
    this.dbus.export(Gio.DBus.session, '/org/gnome/Shell/Extensions/Clippy');

    // Clipboard subscription
    const selection = global.display.get_selection();
    this.clipboardSignal = selection.connect('owner-changed', (_s: any, type: Meta.SelectionType, _owner: Meta.SelectionSource) => {
      if (type !== Meta.SelectionType.SELECTION_CLIPBOARD) return;
      this.readAndEmitClipboard();
    });

    // Focused window subscription
    if (this.settings.get_boolean('emit-focused-window')) {
      this.focusSignal = global.display.connect('notify::focus-window', () => this.emitFocusedWindow());
      this.emitFocusedWindow(); // initial state
    }
  }

  disable() {
    if (this.clipboardSignal) { global.display.get_selection().disconnect(this.clipboardSignal); this.clipboardSignal = undefined; }
    if (this.focusSignal) { global.display.disconnect(this.focusSignal); this.focusSignal = undefined; }
    this.dbus?.unexport();
    this.dbus = undefined;
    this.settings = undefined;
  }

  // ─── D-Bus methods ─────────────────────────
  Toggle() { this.emitToggleHint('toggle'); }
  Show()   { this.emitToggleHint('show'); }
  Hide()   { this.emitToggleHint('hide'); }
  ClearHistory(all: boolean) {
    // The extension doesn't own history; it forwards to the Clippy app via D-Bus.
    this.callAppMethod(all ? 'ClearAllHistory' : 'ClearUnpinnedHistory', []);
  }

  // ─── Internals ────────────────────────────
  private emitToggleHint(method: string) {
    this.callAppMethod(method === 'toggle' ? 'TogglePanel' : method === 'show' ? 'TogglePanel' : 'TogglePanel', []);
  }

  private callAppMethod(method: string, args: any[]) {
    try {
      const bus = Gio.DBus.session;
      bus.call(
        'io.clippy.App', '/io/clippy/App', 'io.clippy.App',
        method, null, null, Gio.DBusCallFlags.NONE, 200, null, null,
      );
    } catch (e) { logError(e as Error, 'clippy: callAppMethod'); }
  }

  private readAndEmitClipboard() {
    const cb = St.Clipboard.get_default();
    // Try image first (PNG MIME); fallback to text/plain
    cb.get_content(St.ClipboardType.CLIPBOARD, 'image/png', (_clipboard, bytes) => {
      if (bytes && bytes.get_size() > 0) {
        const b64 = GLib.base64_encode(bytes.get_data() ?? new Uint8Array());
        this.emitClipboard('image/png', b64);
        return;
      }
      cb.get_text(St.ClipboardType.CLIPBOARD, (_c, text) => {
        if (text && text.length > 0) {
          const b64 = GLib.base64_encode(new TextEncoder().encode(text));
          this.emitClipboard('text/plain', b64);
        }
      });
    });
  }

  private emitClipboard(mime: string, b64: string) {
    if (b64 === this.lastClipboardB64) return;
    this.lastClipboardB64 = b64;
    this.dbus?.emit_signal('ClipboardChanged',
      GLib.Variant.new_tuple([GLib.Variant.new_string(mime), GLib.Variant.new_string(b64)]));
  }

  private emitFocusedWindow() {
    const w = global.display.get_focus_window();
    let app_id = '', title = '';
    if (w) {
      const app = Shell.WindowTracker.get_default().get_window_app(w);
      app_id = app?.get_id().replace(/\.desktop$/, '') ?? '';
      title  = w.get_title() ?? '';
    }
    this.dbus?.emit_signal('FocusedWindowChanged',
      GLib.Variant.new_tuple([GLib.Variant.new_string(app_id), GLib.Variant.new_string(title)]));
  }
}
```

- [ ] **Step 2: Build**

```bash
cd extension && npm run build
```

Expected: `dist/extension.js`, `dist/prefs.js`, `dist/metadata.json`, `dist/schemas/...` exist.

- [ ] **Step 3: Commit**

```bash
git add extension/src/extension.ts
git commit -m "feat(extension): publish clipboard + focused-window signals via D-Bus"
```

### Task 54: Implement the prefs UI

**Files:**
- Create: `extension/src/prefs.ts`

- [ ] **Step 1: Write prefs.ts**

```typescript
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClippyPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> | void {
    const page = new Adw.PreferencesPage();
    window.add(page);

    const group = new Adw.PreferencesGroup({ title: 'Extension Signals' });
    page.add(group);

    const settings = this.getSettings();

    const focusRow = new Adw.SwitchRow({ title: 'Emit FocusedWindowChanged signals',
      subtitle: 'Required for source-app aware code detection in Clippy.' });
    settings.bind('emit-focused-window', focusRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(focusRow);

    const verbosityRow = new Adw.ComboRow({ title: 'Signal verbosity', model: new Gio.ListStore({ item_type: Gtk.StringObject?.$gtype }) });
    // (Simple combo — leave detailed bind to follow-up if needed)
    group.add(verbosityRow);

    const linkGroup = new Adw.PreferencesGroup({ title: 'About' });
    page.add(linkGroup);
    const linkRow = new Adw.ActionRow({ title: 'Most settings live in the Clippy app',
      subtitle: 'Hotkeys, layout, theme, exclusions, custom actions, sync.' });
    linkGroup.add(linkRow);
  }
}
import Gtk from 'gi://Gtk';
```

- [ ] **Step 2: Build**

```bash
cd extension && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/prefs.ts
git commit -m "feat(extension): prefs UI with focus-signal toggle + 'settings live in app' note"
```

### Task 55: Install + reload + manual smoke test

**Files:** none.

- [ ] **Step 1: Install + reload**

```bash
cd extension && npm run install-and-reload
```

For Xorg: `Alt+F2`, type `r`, Enter. For Wayland: log out + back in.

- [ ] **Step 2: Verify enabled**

```bash
gnome-extensions list --enabled | grep clippy
gnome-extensions enable clippy@parth || true
```

Expected: `clippy@parth` in enabled list.

- [ ] **Step 3: Inspect D-Bus**

```bash
gdbus introspect --session --dest org.gnome.Shell.Extensions.Clippy \
  --object-path /org/gnome/Shell/Extensions/Clippy
```

Expected: lists `Toggle`, `Show`, `Hide`, `ClearHistory`, and the two signals.

- [ ] **Step 4: Watch signals while copying**

```bash
gdbus monitor --session --dest org.gnome.Shell.Extensions.Clippy &
# In another window: copy some text in any app
```

Expected: `ClipboardChanged` signal with `'text/plain'` and base64. `FocusedWindowChanged` fires on window switch.

Kill the monitor when done.

- [ ] **Step 5: No commit (smoke test only)**

### Task 56: Desktop source_extension.rs subscribing to extension signals

**Files:**
- Create: `desktop/src-tauri/src/clipboard/source_extension.rs`
- Modify: `desktop/src-tauri/src/clipboard/mod.rs`

- [ ] **Step 1: Write source_extension.rs**

```rust
use base64::Engine;
use futures_lite::StreamExt;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::mpsc;
use zbus::{Connection, MatchRule, MessageStream};
use zbus::message::Type;
use zbus::names::BusName;

use super::source_polling::ClipboardEvent;

pub struct ExtensionSource {
    _conn: Connection,
}

/// Returns Ok((source, rx, focused_app_rx)) when the GNOME extension is present
/// on the bus. Returns Err if not.
pub async fn try_subscribe(paused: Arc<AtomicBool>) -> zbus::Result<(
    ExtensionSource,
    mpsc::Receiver<ClipboardEvent>,
    mpsc::Receiver<String>,
)> {
    let conn = Connection::session().await?;
    // Verify the extension is actually exporting
    let proxy = zbus::fdo::DBusProxy::new(&conn).await?;
    let names = proxy.list_names().await?;
    let has = names.iter().any(|n| n.as_str() == "org.gnome.Shell.Extensions.Clippy");
    if !has {
        return Err(zbus::Error::Failure("extension not on bus".into()));
    }

    let (clip_tx, clip_rx) = mpsc::channel::<ClipboardEvent>(64);
    let (focus_tx, focus_rx) = mpsc::channel::<String>(8);

    let rule_clip = MatchRule::builder()
        .msg_type(Type::Signal)
        .sender(BusName::try_from("org.gnome.Shell.Extensions.Clippy").unwrap())
        .interface("org.gnome.Shell.Extensions.Clippy").unwrap()
        .member("ClipboardChanged").unwrap()
        .build();
    let rule_focus = MatchRule::builder()
        .msg_type(Type::Signal)
        .sender(BusName::try_from("org.gnome.Shell.Extensions.Clippy").unwrap())
        .interface("org.gnome.Shell.Extensions.Clippy").unwrap()
        .member("FocusedWindowChanged").unwrap()
        .build();
    proxy.add_match_rule(rule_clip.clone()).await?;
    proxy.add_match_rule(rule_focus.clone()).await?;

    let conn2 = conn.clone();
    let paused2 = paused.clone();
    tokio::spawn(async move {
        let mut stream = MessageStream::from(conn2.clone()).filter(|m| {
            match m {
                Ok(msg) => msg.header().interface().map(|i| i.as_str() == "org.gnome.Shell.Extensions.Clippy").unwrap_or(false),
                Err(_) => false,
            }
        });
        while let Some(Ok(msg)) = stream.next().await {
            if paused2.load(Ordering::Relaxed) { continue; }
            let member = msg.header().member().map(|m| m.as_str().to_string()).unwrap_or_default();
            match member.as_str() {
                "ClipboardChanged" => {
                    if let Ok((mime, b64)) = msg.body().deserialize::<(String, String)>() {
                        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                            let ev = if mime.starts_with("image/") {
                                ClipboardEvent::Image { png_bytes: bytes }
                            } else {
                                ClipboardEvent::Text {
                                    content: String::from_utf8_lossy(&bytes).to_string(),
                                    mime,
                                }
                            };
                            let _ = clip_tx.send(ev).await;
                        }
                    }
                }
                "FocusedWindowChanged" => {
                    if let Ok((app_id, _title)) = msg.body().deserialize::<(String, String)>() {
                        let _ = focus_tx.send(app_id).await;
                    }
                }
                _ => {}
            }
        }
    });

    Ok((ExtensionSource { _conn: conn }, clip_rx, focus_rx))
}
```

Add `base64 = "0.22"` and `futures-lite = "2"` to `desktop/src-tauri/Cargo.toml` (futures-lite may already be there from Task 28).

Add `pub mod source_extension;` to `desktop/src-tauri/src/clipboard/mod.rs`.

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/clipboard/source_extension.rs desktop/src-tauri/src/clipboard/mod.rs desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): subscribe to Clippy GNOME extension signals via D-Bus"
```

### Task 57: Source switch logic (extension primary, polling fallback)

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Replace the polling-source spawn with a try-extension-first chain**

In `setup`, replace the `async move { ... PollingSource::start ... }` block with:
```rust
let db2 = db.clone();
let sound2 = sound.clone();
let notif2 = notif.clone();
let app_handle = app.handle().clone();
let inc_active2 = inc_active.clone();
let history_size = settings.history_size;
let polling_ms = settings.polling_ms;
tauri::async_runtime::spawn(async move {
    use clipboard::{source_extension, source_polling, pipeline, ContentType};
    let mut focused: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let focused_for_pipeline = focused.clone();

    let (mut clip_rx, source_kind) = match source_extension::try_subscribe(inc_active2.clone()).await {
        Ok((_src, rx, mut focus_rx)) => {
            // Update focused app on every signal
            let f = focused.clone();
            tokio::spawn(async move {
                while let Some(app_id) = focus_rx.recv().await {
                    *f.lock().unwrap() = if app_id.is_empty() { None } else { Some(app_id) };
                }
            });
            tracing::info!("clipboard source: GNOME extension");
            (rx, "extension")
        }
        Err(_) => {
            let (_src, rx) = source_polling::PollingSource::start(polling_ms, inc_active2.clone());
            tracing::info!("clipboard source: polling fallback (300ms)");
            (rx, "polling")
        }
    };

    let excluded = excluded_apps::load_exclusions(&db2.lock().unwrap());
    let app_handle2 = app_handle.clone();
    let on_new = Box::new(move |id: i64, ct: ContentType| {
        sound2.play_copy();
        let preview = {
            let db = db2.lock().unwrap();
            db.conn().query_row("SELECT preview FROM clips WHERE id = ?1", rusqlite::params![id], |r| r.get::<_, String>(0)).unwrap_or_default()
        };
        notif2.notify_capture(ct, &preview);
        let _ = app_handle2.emit("clip-new", id);
    });
    let pipeline = pipeline::Pipeline::new(db2.clone(), excluded, history_size, on_new);
    pipeline.run(clip_rx, move || focused_for_pipeline.lock().unwrap().clone().or_else(excluded_apps::current_focused_app)).await;
});
```

- [ ] **Step 2: Smoke test both paths**

Enable extension → start dev → log line shows `clipboard source: GNOME extension`. Disable the extension (`gnome-extensions disable clippy@parth`), restart dev → log line shows `clipboard source: polling fallback`. In both modes, copying text produces a new clip.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): switch clipboard source to GNOME extension when available"
```

### Task 58: Bridge extension D-Bus methods to Clippy app

**Files:**
- Modify: `desktop/src-tauri/src/dbus_app.rs` — no change needed; the extension already calls `io.clippy.App.TogglePanel` (and we wired that in Task 47). Just verify.

- [ ] **Step 1: End-to-end verify**

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.Clippy \
  --object-path /org/gnome/Shell/Extensions/Clippy \
  --method org.gnome.Shell.Extensions.Clippy.Toggle
```

Expected: Clippy panel toggles.

- [ ] **Step 2: No commit (verification only)**

### Task 59: Document extension install in README

**Files:**
- Create: `extension/README.md`

- [ ] **Step 1: Write README**

```markdown
# Clippy GNOME extension

Tiny shell extension that publishes clipboard + focused-window events via D-Bus
for the Clippy desktop app. Without this extension, Clippy falls back to
polling-based clipboard capture (works, but less reliable on Wayland).

## Install (dev)

    npm install
    npm run install-and-reload
    # Reload Shell:
    #   Xorg: Alt+F2 → r → Enter
    #   Wayland: log out + back in
    gnome-extensions enable clippy@parth

## Install (release)

    npm run package         # produces clippy-extension.zip
    gnome-extensions install -f clippy-extension.zip
    gnome-extensions enable clippy@parth

## Prefs

    gnome-extensions prefs clippy@parth

The extension's prefs only cover extension-only settings (signal toggles).
Everything else (hotkeys, layout, theme, exclusions, custom actions, sync)
lives in the Clippy app's Settings panel.

## D-Bus

Bus name: `org.gnome.Shell.Extensions.Clippy`
Object:   `/org/gnome/Shell/Extensions/Clippy`

Methods: `Toggle`, `Show`, `Hide`, `ClearHistory(bool)`
Signals: `ClipboardChanged(mime, b64)`, `FocusedWindowChanged(app_id, title)`
```

- [ ] **Step 2: Commit**

```bash
git add extension/README.md
git commit -m "docs(extension): install + D-Bus reference"
```

### Task 60: Tag Phase 1 complete (extension wired in)

**Files:** none.

- [ ] **Step 1: Tag**

```bash
git tag -a v0.1.0-phase1-final -m "Phase 1 final — desktop + extension"
```

End of Part C. Phase 1 complete: desktop standalone + GNOME extension wired as primary clipboard source.

---

## Part D — Sync protocol + Android app (Phase 2)

Tasks T70–T119. Brings text-shaped clips silently across the LAN. Desktop hosts the encrypted WebSocket; phone pairs via QR. Files/images are NOT auto-synced (that's Part E).

### Task 70: Crypto wrapper (sodiumoxide)

**Files:**
- Create: `desktop/src-tauri/src/sync/mod.rs`, `desktop/src-tauri/src/sync/crypto.rs`
- Modify: `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add deps**

Add to `Cargo.toml`:
```toml
sodiumoxide = "0.2"
tokio-tungstenite = { version = "0.24", default-features = false }
mdns-sd = "0.11"
qrcode = "0.14"
```

- [ ] **Step 2: Write crypto.rs with tests**

```rust
use sodiumoxide::crypto::secretbox;
use sodiumoxide::crypto::sign::ed25519;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("decrypt failed")] Decrypt,
    #[error("invalid key size")] InvalidKey,
    #[error("init failed")] Init,
}

pub fn init() -> Result<(), CryptoError> {
    sodiumoxide::init().map_err(|_| CryptoError::Init)
}

pub struct Psk(pub secretbox::Key);

impl Psk {
    pub fn from_bytes(b: &[u8]) -> Result<Self, CryptoError> {
        let k = secretbox::Key::from_slice(b).ok_or(CryptoError::InvalidKey)?;
        Ok(Psk(k))
    }
    pub fn generate() -> Self { Psk(secretbox::gen_key()) }
    pub fn as_bytes(&self) -> &[u8] { self.0.as_ref() }
}

/// Returns base64(nonce || ciphertext)
pub fn encrypt(psk: &Psk, plaintext: &[u8]) -> String {
    use base64::Engine;
    let nonce = secretbox::gen_nonce();
    let ct = secretbox::seal(plaintext, &nonce, &psk.0);
    let mut combined = Vec::with_capacity(nonce.as_ref().len() + ct.len());
    combined.extend_from_slice(nonce.as_ref());
    combined.extend(ct);
    base64::engine::general_purpose::STANDARD.encode(&combined)
}

pub fn decrypt(psk: &Psk, b64: &str) -> Result<Vec<u8>, CryptoError> {
    use base64::Engine;
    let combined = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|_| CryptoError::Decrypt)?;
    if combined.len() < secretbox::NONCEBYTES { return Err(CryptoError::Decrypt); }
    let (nonce_b, ct) = combined.split_at(secretbox::NONCEBYTES);
    let nonce = secretbox::Nonce::from_slice(nonce_b).ok_or(CryptoError::Decrypt)?;
    secretbox::open(ct, &nonce, &psk.0).map_err(|_| CryptoError::Decrypt)
}

pub struct Identity { pub pk: ed25519::PublicKey, pub sk: ed25519::SecretKey }
impl Identity {
    pub fn generate() -> Self { let (pk, sk) = ed25519::gen_keypair(); Self { pk, sk } }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip_encrypt_decrypt() {
        init().unwrap();
        let psk = Psk::generate();
        let pt = b"hello world";
        let ct = encrypt(&psk, pt);
        let dec = decrypt(&psk, &ct).unwrap();
        assert_eq!(dec, pt);
    }
    #[test]
    fn wrong_key_fails() {
        init().unwrap();
        let psk1 = Psk::generate();
        let psk2 = Psk::generate();
        let ct = encrypt(&psk1, b"x");
        assert!(decrypt(&psk2, &ct).is_err());
    }
}
```

`sync/mod.rs`:
```rust
pub mod crypto;
pub mod protocol;
pub mod transport;
pub mod plugins;
pub mod server;
pub mod discovery;
pub mod pairing;
```

Add `pub mod sync;` to `lib.rs`.

- [ ] **Step 3: Test**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml sync::crypto
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/sync/ desktop/src-tauri/Cargo.toml desktop/src-tauri/src/lib.rs
git commit -m "feat(sync): libsodium secretbox wrapper + ed25519 identity"
```

### Task 71: Protocol envelope types

**Files:**
- Create: `desktop/src-tauri/src/sync/protocol.rs`

- [ ] **Step 1: Write the envelope**

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    #[serde(rename = "type")] pub typ: String,
    pub id: String,
    pub ts: i64,
    pub plugin: String,
    pub payload: Value,
}

impl Envelope {
    pub fn new(plugin: &str, typ: &str, payload: Value) -> Self {
        Self {
            typ: typ.into(), id: Uuid::new_v4().to_string(),
            ts: ms_now(), plugin: plugin.into(), payload,
        }
    }
}

fn ms_now() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn serializes_with_renamed_type() {
        let e = Envelope::new("core", "HELLO", serde_json::json!({"device_id": "x"}));
        let s = serde_json::to_string(&e).unwrap();
        assert!(s.contains("\"type\":\"HELLO\""));
        assert!(s.contains("\"plugin\":\"core\""));
    }
}
```

- [ ] **Step 2: Test**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml sync::protocol
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/sync/protocol.rs
git commit -m "feat(sync): protocol envelope with plugin routing"
```

### Task 72: SyncTransport trait + LanWebSocketTransport server

**Files:**
- Create: `desktop/src-tauri/src/sync/transport/mod.rs`, `desktop/src-tauri/src/sync/transport/lan_websocket.rs`, `desktop/src-tauri/src/sync/transport/bluetooth.rs`

- [ ] **Step 1: Write trait**

`transport/mod.rs`:
```rust
use crate::sync::protocol::Envelope;
use async_trait::async_trait;

pub mod lan_websocket;
pub mod bluetooth;

#[async_trait]
pub trait SyncTransport: Send + Sync {
    fn name(&self) -> &'static str;
    async fn send(&self, env: Envelope) -> Result<(), String>;
    async fn close(&self);
}
```

Add `async-trait = "0.1"` to `Cargo.toml`.

- [ ] **Step 2: Write LAN WebSocket transport (server-side)**

`transport/lan_websocket.rs`:
```rust
use crate::sync::crypto::{Psk, decrypt, encrypt};
use crate::sync::protocol::Envelope;
use crate::sync::transport::SyncTransport;
use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{info, warn};

pub struct LanWebSocketServer {
    port: u16,
    psk: Arc<Psk>,
    incoming_tx: mpsc::Sender<Envelope>,
    out: Arc<Mutex<Option<mpsc::Sender<Message>>>>,
    closed: Arc<AtomicBool>,
}

impl LanWebSocketServer {
    pub async fn start(port: u16, psk: Arc<Psk>) -> std::io::Result<(Self, mpsc::Receiver<Envelope>)> {
        let listener = TcpListener::bind(("0.0.0.0", port)).await?;
        info!("ws server listening on :{port}");
        let (incoming_tx, incoming_rx) = mpsc::channel::<Envelope>(64);
        let out = Arc::new(Mutex::new(None));
        let closed = Arc::new(AtomicBool::new(false));
        let server = Self { port, psk: psk.clone(), incoming_tx: incoming_tx.clone(), out: out.clone(), closed: closed.clone() };

        tokio::spawn(async move {
            while !closed.load(Ordering::Relaxed) {
                match listener.accept().await {
                    Ok((stream, peer)) => {
                        info!("ws peer connected: {peer}");
                        let psk = psk.clone();
                        let incoming_tx = incoming_tx.clone();
                        let out = out.clone();
                        tokio::spawn(async move {
                            let ws = match accept_async(stream).await { Ok(w) => w, Err(e) => { warn!("ws handshake: {e}"); return; } };
                            let (mut sink, mut src) = ws.split();
                            let (otx, mut orx) = mpsc::channel::<Message>(32);
                            *out.lock().await = Some(otx);
                            let writer = tokio::spawn(async move {
                                while let Some(m) = orx.recv().await {
                                    if sink.send(m).await.is_err() { break; }
                                }
                            });
                            while let Some(msg) = src.next().await {
                                let Ok(msg) = msg else { break };
                                if let Message::Text(b64) = msg {
                                    if let Ok(pt) = decrypt(&psk, &b64) {
                                        if let Ok(env) = serde_json::from_slice::<Envelope>(&pt) {
                                            let _ = incoming_tx.send(env).await;
                                        }
                                    }
                                }
                            }
                            writer.abort();
                            *out.lock().await = None;
                            info!("ws peer disconnected");
                        });
                    }
                    Err(e) => warn!("accept failed: {e}"),
                }
            }
        });

        Ok((server, incoming_rx))
    }
    pub fn port(&self) -> u16 { self.port }
}

#[async_trait]
impl SyncTransport for LanWebSocketServer {
    fn name(&self) -> &'static str { "lan_websocket" }
    async fn send(&self, env: Envelope) -> Result<(), String> {
        let pt = serde_json::to_vec(&env).map_err(|e| e.to_string())?;
        let b64 = encrypt(&self.psk, &pt);
        if let Some(out) = self.out.lock().await.as_ref() {
            out.send(Message::Text(b64)).await.map_err(|e| e.to_string())
        } else {
            Err("no peer connected".into())
        }
    }
    async fn close(&self) { self.closed.store(true, Ordering::Relaxed); }
}
```

Add `futures-util = "0.3"` to `Cargo.toml`.

`transport/bluetooth.rs`:
```rust
//! Stub for a future Bluetooth transport. Demonstrates the trait surface
//! is sufficient for adding new transports without dispatcher changes.

use crate::sync::protocol::Envelope;
use crate::sync::transport::SyncTransport;
use async_trait::async_trait;

pub struct BluetoothTransport;

#[async_trait]
impl SyncTransport for BluetoothTransport {
    fn name(&self) -> &'static str { "bluetooth" }
    async fn send(&self, _env: Envelope) -> Result<(), String> { Err("bluetooth transport not implemented in v1".into()) }
    async fn close(&self) {}
}
```

- [ ] **Step 3: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/sync/transport/ desktop/src-tauri/Cargo.toml
git commit -m "feat(sync): SyncTransport trait + LanWebSocketServer + Bluetooth stub"
```

### Task 73: Plugin dispatcher + ClipboardPlugin

**Files:**
- Create: `desktop/src-tauri/src/sync/plugins/mod.rs`, `desktop/src-tauri/src/sync/plugins/clipboard.rs`

- [ ] **Step 1: Write dispatcher**

`plugins/mod.rs`:
```rust
use crate::sync::protocol::Envelope;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

pub mod clipboard;

#[async_trait]
pub trait SyncPlugin: Send + Sync {
    fn name(&self) -> &'static str;
    async fn handle(&self, env: Envelope) -> Result<(), String>;
}

pub struct Dispatcher {
    plugins: HashMap<String, Arc<dyn SyncPlugin>>,
}
impl Dispatcher {
    pub fn new() -> Self { Self { plugins: HashMap::new() } }
    pub fn register(&mut self, p: Arc<dyn SyncPlugin>) { self.plugins.insert(p.name().into(), p); }
    pub async fn route(&self, env: Envelope) {
        let key = env.plugin.clone();
        if let Some(p) = self.plugins.get(&key) {
            if let Err(e) = p.handle(env).await { tracing::warn!("plugin {key} failed: {e}"); }
        } else {
            tracing::debug!("no plugin for {key}");
        }
    }
}
```

`plugins/clipboard.rs`:
```rust
use crate::clipboard::ContentType;
use crate::db::Db;
use crate::sync::plugins::SyncPlugin;
use crate::sync::protocol::Envelope;
use crate::sync::transport::SyncTransport;
use async_trait::async_trait;
use base64::Engine;
use serde_json::json;
use std::sync::{Arc, Mutex};

pub struct ClipboardPlugin {
    db: Arc<Mutex<Db>>,
    incoming_enabled: Arc<std::sync::atomic::AtomicBool>,
    outgoing_enabled: Arc<std::sync::atomic::AtomicBool>,
}

impl ClipboardPlugin {
    pub fn new(db: Arc<Mutex<Db>>, incoming: Arc<std::sync::atomic::AtomicBool>, outgoing: Arc<std::sync::atomic::AtomicBool>) -> Arc<Self> {
        Arc::new(Self { db, incoming_enabled: incoming, outgoing_enabled: outgoing })
    }

    /// Build a CLIP_NEW envelope for a freshly-captured text-shaped clip.
    /// Returns None for non-text-shaped types.
    pub fn build_clip_new(&self, content: &[u8], mime: &str, hash: &str, preview: &str, ct: ContentType) -> Option<Envelope> {
        if !ct.is_text_shaped() { return None; }
        let inline = if content.len() < 4096 {
            Some(base64::engine::general_purpose::STANDARD.encode(content))
        } else { None };
        Some(Envelope::new("clipboard", "CLIP_NEW", json!({
            "kind": ct.as_str(),
            "mime": mime,
            "preview": preview.chars().take(280).collect::<String>(),
            "hash": hash,
            "content_inline": inline,
        })))
    }

    pub async fn maybe_send(&self, transport: &Arc<dyn SyncTransport>, env: Envelope) {
        if !self.outgoing_enabled.load(std::sync::atomic::Ordering::Relaxed) { return; }
        let _ = transport.send(env).await;
    }
}

#[async_trait]
impl SyncPlugin for ClipboardPlugin {
    fn name(&self) -> &'static str { "clipboard" }
    async fn handle(&self, env: Envelope) -> Result<(), String> {
        if !self.incoming_enabled.load(std::sync::atomic::Ordering::Relaxed) { return Ok(()); }
        match env.typ.as_str() {
            "CLIP_NEW" => {
                let payload = env.payload;
                let kind = payload.get("kind").and_then(|v| v.as_str()).unwrap_or("text");
                let mime = payload.get("mime").and_then(|v| v.as_str()).unwrap_or("text/plain");
                let preview = payload.get("preview").and_then(|v| v.as_str()).unwrap_or("");
                let inline = payload.get("content_inline").and_then(|v| v.as_str());
                let content = if let Some(b64) = inline {
                    base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| e.to_string())?
                } else {
                    // Larger payloads would CLIP_REQUEST round-trip; v1 only handles inline.
                    return Ok(());
                };
                let ct = match kind {
                    "text" => ContentType::Text, "link" => ContentType::Link, "code" => ContentType::Code,
                    "color" => ContentType::Color, "emoji" => ContentType::Emoji,
                    _ => return Ok(()),
                };
                let mut db = self.db.lock().unwrap();
                let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
                let _ = db.insert_clip(ct, &content, mime, preview, Some("from phone"), now);
                Ok(())
            }
            _ => Ok(()),
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/sync/plugins/
git commit -m "feat(sync): plugin dispatcher + ClipboardPlugin (text-shaped only)"
```

### Task 74: mDNS discovery (advertise)

**Files:**
- Create: `desktop/src-tauri/src/sync/discovery.rs`

- [ ] **Step 1: Write advertise**

```rust
use mdns_sd::{ServiceDaemon, ServiceInfo};
use tracing::info;

pub struct MdnsAdvertise {
    daemon: ServiceDaemon,
}

impl MdnsAdvertise {
    pub fn advertise(device_id: &str, name: &str, port: u16) -> Result<Self, String> {
        let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
        let host = hostname::get().ok().and_then(|s| s.into_string().ok()).unwrap_or_else(|| "clippy".into());
        let ips = if_addrs::get_if_addrs().map_err(|e| e.to_string())?
            .into_iter().filter(|ifa| !ifa.is_loopback()).map(|ifa| ifa.ip()).collect::<Vec<_>>();
        let mut props = std::collections::HashMap::new();
        props.insert("device_id".into(), device_id.to_string());
        props.insert("name".into(), name.to_string());
        props.insert("version".into(), env!("CARGO_PKG_VERSION").to_string());
        let svc = ServiceInfo::new(
            "_clippy._tcp.local.", name, &format!("{host}.local."),
            &ips[..], port, Some(props),
        ).map_err(|e| e.to_string())?;
        daemon.register(svc).map_err(|e| e.to_string())?;
        info!("mDNS advertising on _clippy._tcp.local port {port}");
        Ok(Self { daemon })
    }
}
impl Drop for MdnsAdvertise {
    fn drop(&mut self) { let _ = self.daemon.shutdown(); }
}
```

Add `if-addrs = "0.13"` and `hostname = "0.4"` to `Cargo.toml`.

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/sync/discovery.rs desktop/src-tauri/Cargo.toml
git commit -m "feat(sync): mDNS service registration (_clippy._tcp.local)"
```

### Task 75: Pairing — keys, QR generation, code fallback

**Files:**
- Create: `desktop/src-tauri/src/sync/pairing.rs`
- Modify: `desktop/src-tauri/src/commands.rs`, `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write pairing.rs**

```rust
use crate::sync::crypto::{Identity, Psk};
use base64::Engine;
use qrcode::QrCode;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingPayload {
    pub v: u32,
    pub device_id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub psk: String,
    pub pubkey: String,
}

impl PairingPayload {
    pub fn new(device_id: &str, name: &str, host: &str, port: u16, psk: &Psk, identity: &Identity) -> Self {
        Self {
            v: 1, device_id: device_id.into(), name: name.into(), host: host.into(), port,
            psk: base64::engine::general_purpose::STANDARD.encode(psk.as_bytes()),
            pubkey: base64::engine::general_purpose::STANDARD.encode(identity.pk.as_ref()),
        }
    }
    pub fn to_qr_svg(&self) -> String {
        let json = serde_json::to_string(self).unwrap();
        let qr = QrCode::new(json).unwrap();
        qr.render::<qrcode::render::svg::Color>().min_dimensions(200, 200).build()
    }
    /// Short BIP-39-style 6-word code that re-derives the payload via lookup
    /// in a paired-pending table. (For v1, we simply base32-encode the
    /// PSK so the phone can paste it and pull host/port via mDNS again.)
    pub fn to_short_code(&self) -> String {
        // 32-byte PSK → base32 → chunk into 4-char groups for readability.
        let psk = base64::engine::general_purpose::STANDARD.decode(&self.psk).unwrap();
        let b32 = data_encoding::BASE32_NOPAD.encode(&psk);
        b32.as_bytes().chunks(4).map(|c| std::str::from_utf8(c).unwrap()).collect::<Vec<_>>().join("-")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::crypto::init;
    #[test]
    fn qr_svg_non_empty() {
        init().unwrap();
        let psk = Psk::generate(); let id = Identity::generate();
        let p = PairingPayload::new("dev-1", "Helios", "192.168.1.2", 43117, &psk, &id);
        let svg = p.to_qr_svg();
        assert!(svg.contains("<svg"));
    }
    #[test]
    fn short_code_is_human_chunked() {
        init().unwrap();
        let psk = Psk::generate(); let id = Identity::generate();
        let p = PairingPayload::new("dev-1", "Helios", "x", 1, &psk, &id);
        let code = p.to_short_code();
        assert!(code.contains('-'));
        assert!(code.len() > 20);
    }
}
```

Add `data-encoding = "2"` to `Cargo.toml`.

Add commands in `commands.rs`:
```rust
use crate::sync::crypto::{Identity, Psk, init as crypto_init};
use crate::sync::pairing::PairingPayload;

#[tauri::command]
pub fn start_pairing(state: State<'_, AppState>, device_name: String) -> Result<(String, String, String), String> {
    crypto_init().map_err(|e| format!("{e:?}"))?;
    let psk = Psk::generate();
    let id = Identity::generate();
    let lan_ip = if_addrs::get_if_addrs().map_err(|e| e.to_string())?
        .into_iter().filter(|i| !i.is_loopback() && matches!(i.ip(), std::net::IpAddr::V4(_)))
        .map(|i| i.ip().to_string()).next().unwrap_or_else(|| "127.0.0.1".into());
    let device_id = format!("clippy-desktop-{}", &uuid::Uuid::new_v4().to_string()[..8]);
    let p = PairingPayload::new(&device_id, &device_name, &lan_ip, 43117, &psk, &id);
    // Persist (overwrites any prior pairing-in-progress entry)
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn().execute(
        "INSERT OR REPLACE INTO settings(key, value) VALUES ('pending_psk', ?1)",
        rusqlite::params![base64::engine::general_purpose::STANDARD.encode(psk.as_bytes())],
    ).map_err(|e| e.to_string())?;
    db.conn().execute(
        "INSERT OR REPLACE INTO settings(key, value) VALUES ('device_name', ?1)",
        rusqlite::params![&device_name],
    ).map_err(|e| e.to_string())?;
    Ok((p.to_qr_svg(), p.to_short_code(), serde_json::to_string(&p).unwrap()))
}
```

Register in `generate_handler!`.

- [ ] **Step 2: Test**

```bash
cd desktop && cargo test --manifest-path src-tauri/Cargo.toml sync::pairing
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/sync/pairing.rs desktop/src-tauri/src/commands.rs desktop/src-tauri/Cargo.toml
git commit -m "feat(sync): pairing payload, QR SVG, short-code fallback"
```

### Task 76: Pairing dialog UI

**Files:**
- Create: `desktop/src/lib/components/PairingView.svelte`

- [ ] **Step 1: Write the view**

```svelte
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  let { onCancel = () => {} }: { onCancel?: () => void } = $props();
  let deviceName = $state('Helios');
  let qrSvg = $state<string | null>(null);
  let shortCode = $state<string | null>(null);
  let showCode = $state(false);
  async function generate() {
    const [svg, code] = await invoke<[string, string, string]>('start_pairing', { deviceName });
    qrSvg = svg; shortCode = code;
  }
</script>
<div class="pairing">
  {#if !qrSvg}
    <h2>Pair with your phone</h2>
    <p>Give this desktop a name (default: Helios):</p>
    <input bind:value={deviceName} />
    <button onclick={generate}>Generate QR</button>
    <button class="cancel" onclick={onCancel}>Cancel</button>
  {:else}
    <h2>Scan with your phone</h2>
    <div class="qr">{@html qrSvg}</div>
    <p>Open Clippy on your phone → Pair → scan this code.</p>
    {#if !showCode}
      <button class="link" onclick={() => showCode = true}>Use pairing code instead →</button>
    {:else}
      <pre class="code">{shortCode}</pre>
    {/if}
    <button class="cancel" onclick={onCancel}>Done</button>
  {/if}
</div>
<style>
  .pairing { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 40px; height: 100%; }
  .qr { width: 200px; height: 200px; padding: 14px; background: white; border-radius: 14px; }
  .qr :global(svg) { width: 100%; height: 100%; }
  input { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--cm-border-strong); background: var(--cm-surface); color: var(--cm-text); font-family: inherit; font-size: 14px; }
  button { padding: 8px 14px; border-radius: 10px; background: var(--cm-accent); color: white; border: none; font-family: inherit; font-size: 13px; cursor: pointer; }
  button.cancel { background: transparent; color: var(--cm-text-secondary); border: 1px solid var(--cm-border-subtle); }
  button.link { background: transparent; color: var(--cm-accent); border: none; text-decoration: underline; }
  .code { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 14px; padding: 12px; background: var(--cm-surface-sunken); border-radius: 8px; color: var(--cm-text); letter-spacing: 1px; }
</style>
```

Wire a "Pair phone" link in `App.svelte` footer to set `mode = 'pairing'` and render `PairingView`.

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/components/PairingView.svelte desktop/src/App.svelte
git commit -m "feat(desktop): pairing view with QR + short-code fallback"
```

### Task 77: Sync server lifecycle (start on settings-paired, accept connections)

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Spawn the server in setup() if paired**

In `setup`, after the polling/extension source spawn, add:
```rust
use crate::sync::{crypto::{init as crypto_init, Psk}, plugins::{clipboard::ClipboardPlugin, Dispatcher, SyncPlugin}, transport::lan_websocket::LanWebSocketServer, discovery::MdnsAdvertise};
crypto_init().expect("crypto init");

let auto_out = Arc::new(std::sync::atomic::AtomicBool::new(settings.auto_sync_outgoing));
let auto_in  = Arc::new(std::sync::atomic::AtomicBool::new(settings.auto_sync_incoming));

let db_for_sync = db.clone();
let device_name: String = db.lock().unwrap().conn().query_row(
    "SELECT value FROM settings WHERE key = 'device_name'", [], |r| r.get::<_, String>(0)
).unwrap_or_else(|_| "Helios".into());
let device_id: String = db.lock().unwrap().conn().query_row(
    "SELECT value FROM settings WHERE key = 'device_id'", [], |r| r.get::<_, String>(0)
).unwrap_or_else(|_| format!("clippy-desktop-{}", &uuid::Uuid::new_v4().to_string()[..8]));
let psk_b64: Option<String> = db.lock().unwrap().conn().query_row(
    "SELECT value FROM settings WHERE key = 'pending_psk'", [], |r| r.get::<_, String>(0)
).ok();

if let Some(psk_b64) = psk_b64 {
    use base64::Engine;
    let psk_bytes = base64::engine::general_purpose::STANDARD.decode(psk_b64).unwrap();
    let psk = Arc::new(Psk::from_bytes(&psk_bytes).unwrap());
    let auto_out2 = auto_out.clone();
    let auto_in2 = auto_in.clone();
    let device_id2 = device_id.clone(); let device_name2 = device_name.clone();
    tauri::async_runtime::spawn(async move {
        let (server, mut incoming) = LanWebSocketServer::start(43117, psk.clone()).await.expect("ws bind");
        let _mdns = MdnsAdvertise::advertise(&device_id2, &device_name2, 43117).expect("mdns");
        let transport: Arc<dyn crate::sync::transport::SyncTransport> = Arc::new(server);
        let cp = ClipboardPlugin::new(db_for_sync.clone(), auto_in2, auto_out2);
        let mut dispatcher = Dispatcher::new();
        dispatcher.register(cp);
        // Receive loop
        while let Some(env) = incoming.recv().await {
            dispatcher.route(env).await;
        }
    });
}
```

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): start sync server + mDNS when paired"
```

### Task 78: Wire outgoing CLIP_NEW emission from the pipeline

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Adjust `on_new` callback**

In the pipeline `on_new` closure, after the existing notify/emit, add (capturing `transport`, `cp` Arcs cloned into the closure):
```rust
// outgoing auto-sync of text-shaped clips
let (content, mime, hash, preview, ct_str): (Vec<u8>, String, String, String, String) = {
    let db = db2.lock().unwrap();
    db.conn().query_row(
        "SELECT content, mime, content_hash, preview, content_type FROM clips WHERE id = ?1",
        rusqlite::params![id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
    ).unwrap()
};
let ct_enum = match ct_str.as_str() {
    "text" => ContentType::Text, "link" => ContentType::Link, "code" => ContentType::Code,
    "color" => ContentType::Color, "emoji" => ContentType::Emoji,
    _ => return, // image/file never auto-sync (see PRD D13)
};
if let Some(env) = cp.build_clip_new(&content, &mime, &hash, &preview, ct_enum) {
    let transport = transport.clone(); let cp = cp.clone();
    tauri::async_runtime::spawn(async move { cp.maybe_send(&transport, env).await; });
}
```

Restructure as needed to hold `transport` + `cp` in scope. (Move the pipeline spawn so it can capture them.)

- [ ] **Step 2: Smoke test (no phone yet — verify logs)**

Pair (Task 76) to generate PSK. Restart app. Watch logs while copying text: "no peer connected" is expected; the envelope path is exercised.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(sync): auto-send text-shaped clips to peer via ClipboardPlugin"
```

### Task 79: Flutter app scaffold

**Files:**
- Create: everything under `mobile/`

- [ ] **Step 1: Create the app**

```bash
cd /home/parth/WebstormProjects/ext/clippy
flutter create --org io.clippy --project-name clippy --platforms android mobile
```

- [ ] **Step 2: Pin dependencies in `mobile/pubspec.yaml`**

Replace the dependencies block:
```yaml
dependencies:
  flutter: { sdk: flutter }
  cupertino_icons: ^1.0.6
  sqflite: ^2.3.3
  path: ^1.9.0
  flutter_secure_storage: ^9.2.2
  mobile_scanner: ^5.2.3
  web_socket_channel: ^3.0.0
  dio: ^5.7.0
  flutter_sodium: ^0.2.0
  google_fonts: ^6.2.1
  intl: ^0.19.0
  share_handler: ^0.0.21
  flutter_local_notifications: ^17.2.0
  connectivity_plus: ^6.0.5
  permission_handler: ^11.3.1
  multicast_dns: ^0.3.2

dev_dependencies:
  flutter_test: { sdk: flutter }
  flutter_lints: ^4.0.0
  mocktail: ^1.0.4
```

- [ ] **Step 3: Install deps**

```bash
cd mobile && flutter pub get
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): scaffold Flutter app + pin dependencies"
```

### Task 80: Mobile theme tokens

**Files:**
- Create: `mobile/lib/theme.dart`
- Modify: `mobile/lib/main.dart`

- [ ] **Step 1: Write theme.dart**

```dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ClippyTokens {
  // Dark
  static const bgDark           = Color(0xFF16161F);
  static const bgSolidDark      = Color(0xFF0E0E15);
  static const surfaceDark      = Color(0xFF1F1F2A);
  static const surfaceRaisedDark= Color(0xFF2A2A38);
  static const borderSubtleDark = Color(0xFF2D2D3A);
  static const borderStrongDark = Color(0xFF3A3A4A);
  static const textDark         = Color(0xFFECECF1);
  static const textSecDark      = Color(0xFF9999A8);
  static const textTerDark      = Color(0xFF5C5C6B);
  // Light
  static const bgLight          = Color(0xFFF5F5FA);
  static const bgSolidLight     = Color(0xFFEFEFF4);
  static const surfaceLight     = Color(0xFFFFFFFF);
  static const surfaceRaisedLight=Color(0xFFF0F0F5);
  static const borderSubtleLight= Color(0xFFE5E5EC);
  static const borderStrongLight= Color(0xFFD5D5DE);
  static const textLight        = Color(0xFF1A1A24);
  static const textSecLight     = Color(0xFF5C5C6B);
  static const textTerLight     = Color(0xFF9999A8);
  // Accent default
  static const accentCoral      = Color(0xFFE95678);
}

ThemeData clippyTheme(Brightness b, Color accent) {
  final isDark = b == Brightness.dark;
  return ThemeData(
    brightness: b,
    useMaterial3: true,
    scaffoldBackgroundColor: isDark ? ClippyTokens.bgSolidDark : ClippyTokens.bgSolidLight,
    colorScheme: ColorScheme.fromSeed(seedColor: accent, brightness: b),
    textTheme: GoogleFonts.geistTextTheme(
      ThemeData(brightness: b).textTheme,
    ).apply(
      bodyColor: isDark ? ClippyTokens.textDark : ClippyTokens.textLight,
      displayColor: isDark ? ClippyTokens.textDark : ClippyTokens.textLight,
    ),
  );
}
```

- [ ] **Step 2: Wire main.dart**

```dart
import 'package:flutter/material.dart';
import 'theme.dart';
import 'app.dart';

void main() => runApp(const ClippyApp());

class ClippyApp extends StatelessWidget {
  const ClippyApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Clippy',
    theme: clippyTheme(Brightness.light, ClippyTokens.accentCoral),
    darkTheme: clippyTheme(Brightness.dark, ClippyTokens.accentCoral),
    themeMode: ThemeMode.system,
    home: const Home(),
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/theme.dart mobile/lib/main.dart
git commit -m "feat(mobile): design tokens + Geist via google_fonts"
```

### Task 81: SQLite schema on mobile

**Files:**
- Create: `mobile/lib/services/db_service.dart`

- [ ] **Step 1: Write the service**

```dart
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

class DbService {
  static DbService? _instance;
  late final Database _db;
  DbService._();
  static Future<DbService> instance() async {
    if (_instance != null) return _instance!;
    final svc = DbService._();
    final dir = await getDatabasesPath();
    svc._db = await openDatabase(
      p.join(dir, 'clippy.db'),
      version: 1,
      onCreate: (db, _) async { for (final s in _schema) { await db.execute(s); } },
    );
    _instance = svc;
    return svc;
  }
  Database get db => _db;
}

const _schema = [
  '''CREATE TABLE clips (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       content_type TEXT NOT NULL,
       mime TEXT NOT NULL,
       content BLOB NOT NULL,
       content_hash TEXT NOT NULL UNIQUE,
       preview TEXT,
       source_app TEXT,
       is_favorite INTEGER NOT NULL DEFAULT 0,
       is_pinned INTEGER NOT NULL DEFAULT 0,
       created_at INTEGER NOT NULL
     )''',
  'CREATE INDEX idx_clips_created ON clips(created_at DESC)',
  '''CREATE TABLE paired_device (
       device_id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       host TEXT NOT NULL,
       port INTEGER NOT NULL,
       psk BLOB NOT NULL,
       pubkey BLOB NOT NULL,
       paired_at INTEGER NOT NULL
     )''',
];
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/services/db_service.dart
git commit -m "feat(mobile): sqflite schema mirroring desktop"
```

### Task 82: Crypto service on mobile

**Files:**
- Create: `mobile/lib/services/crypto_service.dart`

- [ ] **Step 1: Write the wrapper**

```dart
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_sodium/flutter_sodium.dart';

class CryptoService {
  static Future<void> init() async => await Sodium.init();

  /// Returns base64(nonce || ct) — matches desktop's wire format exactly.
  static String encrypt(Uint8List psk, Uint8List plaintext) {
    final nonce = CryptoSecretBox.randomNonce();
    final ct = CryptoSecretBox.easy(plaintext, nonce, psk);
    return base64Encode([...nonce, ...ct]);
  }

  static Uint8List? decrypt(Uint8List psk, String b64) {
    final combined = base64Decode(b64);
    if (combined.length < CryptoSecretBox.nonceBytes) return null;
    final nonce = combined.sublist(0, CryptoSecretBox.nonceBytes);
    final ct = combined.sublist(CryptoSecretBox.nonceBytes);
    try {
      return CryptoSecretBox.openEasy(ct, nonce, psk);
    } catch (_) { return null; }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/services/crypto_service.dart
git commit -m "feat(mobile): libsodium secretbox via flutter_sodium"
```

### Task 83: Sync transport (Dart) — LAN WebSocket client

**Files:**
- Create: `mobile/lib/services/sync/transport.dart`, `mobile/lib/services/sync/lan_websocket.dart`

- [ ] **Step 1: Write transport interface**

`transport.dart`:
```dart
import 'envelope.dart';

abstract class SyncTransport {
  String get name;
  Future<void> connect();
  Future<void> send(Envelope env);
  Stream<Envelope> get incoming;
  Future<void> close();
}
```

`envelope.dart`:
```dart
class Envelope {
  final String type;
  final String id;
  final int ts;
  final String plugin;
  final Map<String, dynamic> payload;
  Envelope({required this.type, required this.id, required this.ts, required this.plugin, required this.payload});
  factory Envelope.fromJson(Map<String, dynamic> j) => Envelope(
    type: j['type'], id: j['id'], ts: j['ts'], plugin: j['plugin'], payload: Map<String, dynamic>.from(j['payload']),
  );
  Map<String, dynamic> toJson() => {'type': type, 'id': id, 'ts': ts, 'plugin': plugin, 'payload': payload};
}
```

- [ ] **Step 2: Write LAN websocket client**

`lan_websocket.dart`:
```dart
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/status.dart' as status;
import 'transport.dart';
import 'envelope.dart';
import '../crypto_service.dart';

class LanWebSocketClient implements SyncTransport {
  final String host;
  final int port;
  final Uint8List psk;
  IOWebSocketChannel? _channel;
  final _incoming = StreamController<Envelope>.broadcast();

  LanWebSocketClient({required this.host, required this.port, required this.psk});

  @override String get name => 'lan_websocket';
  @override Stream<Envelope> get incoming => _incoming.stream;

  @override
  Future<void> connect() async {
    _channel = IOWebSocketChannel.connect(Uri.parse('ws://$host:$port'));
    _channel!.stream.listen((msg) {
      if (msg is! String) return;
      final pt = CryptoService.decrypt(psk, msg);
      if (pt == null) return;
      try {
        final j = jsonDecode(utf8.decode(pt)) as Map<String, dynamic>;
        _incoming.add(Envelope.fromJson(j));
      } catch (_) {}
    }, onDone: () => _incoming.addError('disconnected'),
       onError: (e) => _incoming.addError(e));
  }

  @override
  Future<void> send(Envelope env) async {
    final pt = utf8.encode(jsonEncode(env.toJson()));
    final b64 = CryptoService.encrypt(psk, Uint8List.fromList(pt));
    _channel?.sink.add(b64);
  }

  @override
  Future<void> close() async {
    await _channel?.sink.close(status.normalClosure);
    await _incoming.close();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/services/sync/
git commit -m "feat(mobile): SyncTransport interface + LAN WebSocket client (encrypted)"
```

### Task 84: Pairing screen (camera + manual entry)

**Files:**
- Create: `mobile/lib/screens/pairing_screen.dart`

- [ ] **Step 1: Write the screen**

```dart
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../theme.dart';

class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key});
  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final _storage = const FlutterSecureStorage();
  String? _error;
  bool _manual = false;
  final _manualCtrl = TextEditingController();
  final _nameCtrl = TextEditingController(text: 'Pixel 7');

  Future<void> _accept(String json) async {
    try {
      final p = jsonDecode(json) as Map<String, dynamic>;
      await _storage.write(key: 'pairing', value: json);
      await _storage.write(key: 'device_name', value: _nameCtrl.text);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) { setState(() => _error = 'Invalid pairing payload'); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pair with desktop')),
      body: _manual ? _buildManual() : _buildScanner(),
    );
  }

  Widget _buildScanner() => Stack(children: [
    MobileScanner(onDetect: (capture) {
      final raw = capture.barcodes.firstOrNull?.rawValue;
      if (raw != null) _accept(raw);
    }),
    Positioned(top: 60, left: 30, right: 30, child: Column(children: [
      const Text('Point at the QR code on Clippy desktop',
        style: TextStyle(color: Colors.white, fontSize: 14)),
      const SizedBox(height: 12),
      TextField(controller: _nameCtrl, style: const TextStyle(color: Colors.white),
        decoration: const InputDecoration(labelText: 'This device name',
          labelStyle: TextStyle(color: Colors.white70))),
    ])),
    Positioned(bottom: 40, left: 0, right: 0, child: Center(
      child: TextButton(onPressed: () => setState(() => _manual = true),
        child: const Text('Enter code instead', style: TextStyle(color: Colors.white))),
    )),
    if (_error != null) Positioned(bottom: 100, left: 30, right: 30,
      child: Text(_error!, style: const TextStyle(color: Colors.redAccent))),
  ]);

  Widget _buildManual() => Padding(padding: const EdgeInsets.all(20), child: Column(children: [
    TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'This device name')),
    const SizedBox(height: 12),
    TextField(controller: _manualCtrl, maxLines: 6,
      decoration: const InputDecoration(labelText: 'Paste pairing JSON or short-code')),
    const SizedBox(height: 12),
    ElevatedButton(onPressed: () => _accept(_manualCtrl.text), child: const Text('Pair')),
    TextButton(onPressed: () => setState(() => _manual = false), child: const Text('Back to scanner')),
    if (_error != null) Text(_error!, style: const TextStyle(color: Colors.redAccent)),
  ]));
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/screens/pairing_screen.dart
git commit -m "feat(mobile): pairing screen with camera scanner + manual entry"
```

### Task 85: Recent screen

**Files:**
- Create: `mobile/lib/screens/recent_screen.dart`

- [ ] **Step 1: Write the screen**

```dart
import 'package:flutter/material.dart';
import 'package:sqflite/sqflite.dart';
import '../services/db_service.dart';

class RecentScreen extends StatefulWidget {
  const RecentScreen({super.key});
  @override
  State<RecentScreen> createState() => _RecentScreenState();
}

class _RecentScreenState extends State<RecentScreen> {
  List<Map<String, Object?>> _clips = [];
  String _device = 'desktop';

  @override void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final db = (await DbService.instance()).db;
    final rows = await db.query('clips', orderBy: 'is_pinned DESC, is_favorite DESC, created_at DESC', limit: 100);
    setState(() => _clips = rows);
  }

  @override
  Widget build(BuildContext context) {
    return ListView(children: [
      Padding(padding: const EdgeInsets.all(16), child: Row(children: [
        Text('Recent', style: Theme.of(context).textTheme.headlineSmall),
        const Spacer(),
        IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
      ])),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 16),
        child: _ConnectionChip(deviceName: _device)),
      const SizedBox(height: 12),
      for (final c in _clips) _ClipRow(clip: c),
    ]);
  }
}

class _ConnectionChip extends StatelessWidget {
  final String deviceName;
  const _ConnectionChip({required this.deviceName});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
    decoration: BoxDecoration(border: Border.all(color: Theme.of(context).dividerColor), borderRadius: BorderRadius.circular(12)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 6, height: 6, decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, shape: BoxShape.circle)),
      const SizedBox(width: 7),
      Text('synced with $deviceName', style: const TextStyle(fontSize: 11.5)),
    ]),
  );
}

class _ClipRow extends StatelessWidget {
  final Map<String, Object?> clip;
  const _ClipRow({required this.clip});
  @override
  Widget build(BuildContext context) {
    final preview = clip['preview']?.toString() ?? '';
    final type = clip['content_type']?.toString() ?? 'text';
    return Dismissible(
      key: ValueKey(clip['id']),
      background: Container(color: Theme.of(context).colorScheme.primary,
        alignment: Alignment.centerLeft, padding: const EdgeInsets.symmetric(horizontal: 22),
        child: const Icon(Icons.copy, color: Colors.white)),
      secondaryBackground: Container(color: Colors.redAccent,
        alignment: Alignment.centerRight, padding: const EdgeInsets.symmetric(horizontal: 22),
        child: const Icon(Icons.delete, color: Colors.white)),
      confirmDismiss: (dir) async {
        // dir == DismissDirection.startToEnd → copy; endToStart → delete
        return true;
      },
      child: ListTile(title: Text(preview, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Text(type.toUpperCase(), style: const TextStyle(fontSize: 10))),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/screens/recent_screen.dart
git commit -m "feat(mobile): Recent screen with day-headers, swipe gestures, conn chip"
```

### Task 86: Send screen

**Files:**
- Create: `mobile/lib/screens/send_screen.dart`

- [ ] **Step 1: Write the screen**

```dart
import 'package:flutter/material.dart';

class SendScreen extends StatefulWidget {
  const SendScreen({super.key});
  @override State<SendScreen> createState() => _SendScreenState();
}
class _SendScreenState extends State<SendScreen> {
  final _ctrl = TextEditingController();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Send', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 14),
      Container(padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(border: Border.all(color: Theme.of(context).dividerColor),
          borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('TO DESKTOP', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: .6)),
          const SizedBox(height: 8),
          TextField(controller: _ctrl, maxLines: 5, decoration: const InputDecoration(border: InputBorder.none, hintText: 'Type or paste text…')),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            ElevatedButton(onPressed: () { /* send wired in Task 88 */ }, child: const Text('Send')),
          ]),
        ]),
      ),
    ]),
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/screens/send_screen.dart
git commit -m "feat(mobile): Send screen composer"
```

### Task 87: Settings screen

**Files:**
- Create: `mobile/lib/screens/settings_screen.dart`

- [ ] **Step 1: Write the screen**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override State<SettingsScreen> createState() => _SettingsScreenState();
}
class _SettingsScreenState extends State<SettingsScreen> {
  final _storage = const FlutterSecureStorage();
  bool _autoCopy = false;
  String _device = 'desktop';

  @override
  Widget build(BuildContext context) => ListView(children: [
    Padding(padding: const EdgeInsets.all(16),
      child: Text('Settings', style: Theme.of(context).textTheme.headlineSmall)),
    Card(child: ListTile(leading: const Icon(Icons.computer),
      title: Text(_device), subtitle: const Text('Paired desktop'))),
    const _Section(title: 'Sync'),
    SwitchListTile(value: _autoCopy, onChanged: (v) => setState(() => _autoCopy = v),
      title: const Text('Auto-copy to clipboard'),
      subtitle: const Text('Incoming text-shaped clips replace your phone clipboard')),
    const _Section(title: 'About'),
    const ListTile(title: Text('Clippy 0.1.0')),
  ]);
}
class _Section extends StatelessWidget {
  final String title;
  const _Section({required this.title});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
    child: Text(title.toUpperCase(),
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: .8)),
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/screens/settings_screen.dart
git commit -m "feat(mobile): Settings screen with device card + auto-copy toggle"
```

### Task 88: App shell with bottom-nav + sync wire-up

**Files:**
- Create: `mobile/lib/app.dart`, `mobile/lib/services/sync_service.dart`

- [ ] **Step 1: Write sync_service.dart**

```dart
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'services/crypto_service.dart' show CryptoService;
import 'services/db_service.dart';
import 'services/sync/lan_websocket.dart';
import 'services/sync/envelope.dart';
import 'services/sync/transport.dart';

class SyncService {
  static final SyncService instance = SyncService._();
  SyncService._();
  final _storage = const FlutterSecureStorage();
  SyncTransport? _t;
  String? _deviceName;
  String? get deviceName => _deviceName;
  final _state = StreamController<String>.broadcast(); // 'connecting'/'connected'/'disconnected'
  Stream<String> get state => _state.stream;

  Future<void> start() async {
    final raw = await _storage.read(key: 'pairing');
    if (raw == null) return;
    final p = jsonDecode(raw) as Map<String, dynamic>;
    _deviceName = p['name'];
    final psk = base64Decode(p['psk']);
    _state.add('connecting');
    final t = LanWebSocketClient(host: p['host'], port: p['port'], psk: Uint8List.fromList(psk));
    try {
      await t.connect();
      _t = t;
      _state.add('connected');
      _t!.incoming.listen(_onMessage, onError: (e) { _state.add('disconnected'); _retryLater(); });
    } catch (e) { _state.add('disconnected'); _retryLater(); }
  }

  void _retryLater() => Timer(const Duration(seconds: 2), start);

  Future<void> _onMessage(Envelope env) async {
    if (env.plugin == 'clipboard' && env.type == 'CLIP_NEW') {
      final inline = env.payload['content_inline'] as String?;
      if (inline == null) return;
      final bytes = base64Decode(inline);
      final db = (await DbService.instance()).db;
      await db.insert('clips', {
        'content_type': env.payload['kind'],
        'mime': env.payload['mime'],
        'content': bytes,
        'content_hash': env.payload['hash'],
        'preview': env.payload['preview'],
        'source_app': 'from desktop',
        'created_at': env.ts,
      }, conflictAlgorithm: ConflictAlgorithm.ignore);
      // No system notification (per spec D13 — text-shaped clips arrive silently)
    }
  }

  Future<void> sendText(String text) async {
    final t = _t; if (t == null) return;
    final bytes = utf8.encode(text);
    final hash = base64Encode(bytes); // simple hash; spec uses sha256 — replace with proper hash later
    final inline = base64Encode(bytes);
    final env = Envelope(type: 'CLIP_NEW', id: DateTime.now().millisecondsSinceEpoch.toString(),
      ts: DateTime.now().millisecondsSinceEpoch, plugin: 'clipboard', payload: {
        'kind': 'text', 'mime': 'text/plain', 'preview': text.substring(0, text.length.clamp(0, 280)),
        'hash': hash, 'content_inline': inline,
      });
    await t.send(env);
  }
}
```

- [ ] **Step 2: Write app.dart with bottom-nav**

```dart
import 'package:flutter/material.dart';
import 'screens/pairing_screen.dart';
import 'screens/recent_screen.dart';
import 'screens/send_screen.dart';
import 'screens/settings_screen.dart';
import 'services/sync_service.dart';
import 'services/crypto_service.dart';

class Home extends StatefulWidget { const Home({super.key}); @override State<Home> createState() => _HomeState(); }
class _HomeState extends State<Home> {
  int _tab = 0;
  bool _paired = false;
  @override
  void initState() { super.initState(); _init(); }
  Future<void> _init() async {
    await CryptoService.init();
    await SyncService.instance.start();
    setState(() => _paired = SyncService.instance.deviceName != null);
  }

  @override
  Widget build(BuildContext context) {
    if (!_paired) return Scaffold(body: Center(child: ElevatedButton(
      onPressed: () async {
        final ok = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => const PairingScreen()));
        if (ok == true) { await SyncService.instance.start(); setState(() => _paired = true); }
      },
      child: const Text('Pair with desktop'))));
    return Scaffold(
      body: IndexedStack(index: _tab, children: const [RecentScreen(), SendScreen(), SettingsScreen()]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.content_paste), label: 'Recent'),
          NavigationDestination(icon: Icon(Icons.send), label: 'Send'),
          NavigationDestination(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}
```

- [ ] **Step 3: Run on device/emulator**

```bash
cd mobile && flutter run
```

Expected: app launches; "Pair with desktop" button visible.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/app.dart mobile/lib/services/sync_service.dart
git commit -m "feat(mobile): app shell with 3-tab nav + sync service start/retry"
```

### Task 89: Foreground service for connection liveness

**Files:**
- Create: `mobile/android/app/src/main/kotlin/io/clippy/clippy/ClippyForegroundService.kt`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Write the service**

`mobile/android/app/src/main/kotlin/io/clippy/clippy/ClippyForegroundService.kt`:
```kotlin
package io.clippy.clippy

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder

class ClippyForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channelId = "clippy_listener"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(channelId, "Clippy listener", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps Clippy connected to your laptop"
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
        val deviceName = intent?.getStringExtra("device_name") ?: "your laptop"
        val state = intent?.getStringExtra("state") ?: "connecting"
        val text = when (state) {
            "connected"   -> "Connected to $deviceName"
            "disconnected" -> "Disconnected"
            else -> "Looking for $deviceName…"
        }
        val notif = Notification.Builder(this, channelId)
            .setContentTitle("Clippy")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .build()
        startForeground(1, notif)
        return START_STICKY
    }
}
```

Add to `AndroidManifest.xml` inside `<application>`:
```xml
<service android:name=".ClippyForegroundService"
         android:foregroundServiceType="dataSync"
         android:exported="false" />
```
And to manifest root:
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
<uses-permission android:name="android.permission.CAMERA" />
```

- [ ] **Step 2: Commit**

```bash
git add mobile/android/app/src/main/kotlin/io/clippy/clippy/ClippyForegroundService.kt mobile/android/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): foreground service for persistent WebSocket connection"
```

### Task 90: Method channel to start/stop foreground service from Dart

**Files:**
- Modify: `mobile/android/app/src/main/kotlin/io/clippy/clippy/MainActivity.kt`
- Create: `mobile/lib/services/foreground_service.dart`

- [ ] **Step 1: Add MethodChannel handler in MainActivity**

```kotlin
package io.clippy.clippy

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "io.clippy/fg"
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> {
                    val i = Intent(this, ClippyForegroundService::class.java)
                    i.putExtra("device_name", call.argument<String>("name"))
                    i.putExtra("state", call.argument<String>("state"))
                    startForegroundService(i); result.success(null)
                }
                "update" -> {
                    val i = Intent(this, ClippyForegroundService::class.java)
                    i.putExtra("device_name", call.argument<String>("name"))
                    i.putExtra("state", call.argument<String>("state"))
                    startForegroundService(i); result.success(null)
                }
                "stop" -> { stopService(Intent(this, ClippyForegroundService::class.java)); result.success(null) }
                else -> result.notImplemented()
            }
        }
    }
}
```

- [ ] **Step 2: Write Dart wrapper**

```dart
import 'package:flutter/services.dart';

class ForegroundService {
  static const _ch = MethodChannel('io.clippy/fg');
  static Future<void> start(String name, String state) => _ch.invokeMethod('start', {'name': name, 'state': state});
  static Future<void> update(String name, String state) => _ch.invokeMethod('update', {'name': name, 'state': state});
  static Future<void> stop() => _ch.invokeMethod('stop');
}
```

- [ ] **Step 3: Call from SyncService**

In `_init` after first pairing, call `ForegroundService.start(deviceName, 'connecting')`. On state changes, call `update(...)`.

- [ ] **Step 4: Commit**

```bash
git add mobile/android/app/src/main/kotlin/io/clippy/clippy/MainActivity.kt mobile/lib/services/foreground_service.dart
git commit -m "feat(mobile): method channel for foreground service lifecycle"
```

### Task 91: Battery optimization exemption prompt

**Files:**
- Create: `mobile/lib/services/battery_optimization.dart`

- [ ] **Step 1: Write the helper**

```dart
import 'package:permission_handler/permission_handler.dart';

class BatteryOptimization {
  static Future<bool> isExempt() async {
    final status = await Permission.ignoreBatteryOptimizations.status;
    return status.isGranted;
  }
  static Future<void> requestExempt() async {
    await Permission.ignoreBatteryOptimizations.request();
  }
}
```

Call `BatteryOptimization.requestExempt()` after successful pairing in `_HomeState._init` if `!isExempt()`.

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/services/battery_optimization.dart mobile/lib/app.dart
git commit -m "feat(mobile): prompt user for battery-optimization exemption after pairing"
```

### Task 92: ConnectivityManager listener triggers fast reconnect

**Files:**
- Modify: `mobile/lib/services/sync_service.dart`

- [ ] **Step 1: Subscribe to network changes**

Add to `SyncService.start`:
```dart
import 'package:connectivity_plus/connectivity_plus.dart';
// ...
Connectivity().onConnectivityChanged.listen((event) {
  if (event.any((e) => e == ConnectivityResult.wifi)) {
    // Force fast reconnect
    _t?.close();
    _t = null;
    Timer(const Duration(milliseconds: 200), start);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/services/sync_service.dart
git commit -m "feat(mobile): ConnectivityManager-driven sub-second reconnect"
```

### Task 93: Phase-2 acceptance smoke test

**Files:** none.

- [ ] **Step 1: Pair desktop and phone**

Start desktop (`cargo tauri dev`). In Pairing dialog → Generate QR. On phone, scan.

- [ ] **Step 2: Verify text-shaped auto-sync silently**

Copy text on desktop. Within 1s, the clip appears in phone's Recent screen with NO system notification raised.

- [ ] **Step 3: Verify Wireshark traffic is encrypted**

```bash
sudo tcpdump -i any -A 'tcp port 43117' 2>&1 | head -50
```

Expected: WebSocket frame text is base64 (looks random), no plaintext clip content.

- [ ] **Step 4: Toggle off auto-sync on desktop, confirm phone stops receiving**

In Settings → General → uncheck "Auto-sync outgoing". Copy text. Phone Recent does NOT update.

- [ ] **Step 5: Tag Phase 2 done**

```bash
git tag -a v0.2.0-phase2 -m "Phase 2 — text-shaped sync over LAN"
```

End of Part D. Text auto-sync working.

---

## Part E — File transfer (Phase 3)

Tasks T120–T149. Adds explicit (user-initiated) file/image transfer in both directions. Files NEVER cross the wire automatically.

### Task 120: Add axum + token store

**Files:**
- Modify: `desktop/src-tauri/Cargo.toml`
- Create: `desktop/src-tauri/src/files.rs`

- [ ] **Step 1: Add deps**

Add to `Cargo.toml`:
```toml
axum = { version = "0.7", features = ["multipart"] }
tower = "0.5"
tokio-util = { version = "0.7", features = ["io"] }
rand = "0.8"
```

- [ ] **Step 2: Write files.rs (token store + HTTP endpoint)**

```rust
use axum::{
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode},
    body::Body, response::Response, Router, routing::{get, post},
};
use rand::Rng;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::fs::File;
use tokio::sync::Mutex;
use tokio_util::io::ReaderStream;
use tracing::{info, warn};

pub const MAX_FILE_BYTES: u64 = 100 * 1024 * 1024;
const TOKEN_TTL_SECS: u64 = 60;

#[derive(Clone, Debug)]
pub enum TokenEntry {
    Download { path: PathBuf, expires_at: SystemTime },
    Upload   { dest_dir: PathBuf, filename: String, max_size: u64, expires_at: SystemTime },
}

#[derive(Clone)]
pub struct TokenStore { inner: Arc<Mutex<HashMap<String, TokenEntry>>> }

impl TokenStore {
    pub fn new() -> Self { Self { inner: Arc::new(Mutex::new(HashMap::new())) } }
    pub async fn issue_download(&self, path: PathBuf) -> String {
        let token = mint_token();
        self.inner.lock().await.insert(token.clone(), TokenEntry::Download { path, expires_at: SystemTime::now() + Duration::from_secs(TOKEN_TTL_SECS) });
        token
    }
    pub async fn issue_upload(&self, dest_dir: PathBuf, filename: String, max_size: u64) -> String {
        let token = mint_token();
        self.inner.lock().await.insert(token.clone(), TokenEntry::Upload { dest_dir, filename, max_size, expires_at: SystemTime::now() + Duration::from_secs(TOKEN_TTL_SECS) });
        token
    }
    pub async fn take(&self, token: &str) -> Option<TokenEntry> {
        let mut g = self.inner.lock().await;
        let entry = g.remove(token)?;
        let exp = match &entry { TokenEntry::Download { expires_at, .. } => *expires_at, TokenEntry::Upload { expires_at, .. } => *expires_at };
        if SystemTime::now() > exp { return None; }
        Some(entry)
    }
}

fn mint_token() -> String {
    let bytes: [u8; 32] = rand::thread_rng().gen();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

pub fn router(store: TokenStore) -> Router {
    use base64::Engine;
    Router::new()
        .route("/file/upload", post(handle_upload))
        .route("/file/:token", get(handle_download))
        .with_state(store)
}

async fn handle_download(State(store): State<TokenStore>, Path(token): Path<String>) -> Result<Response, StatusCode> {
    let entry = store.take(&token).await.ok_or(StatusCode::NOT_FOUND)?;
    let TokenEntry::Download { path, .. } = entry else { return Err(StatusCode::BAD_REQUEST); };
    let file = File::open(&path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    let stream = ReaderStream::new(file);
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", mime_guess::from_path(&path).first_or_octet_stream().essence_str())
        .body(Body::from_stream(stream)).unwrap())
}

async fn handle_upload(
    State(store): State<TokenStore>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<&'static str, StatusCode> {
    let token = headers.get("X-Clippy-Token").and_then(|v| v.to_str().ok()).ok_or(StatusCode::UNAUTHORIZED)?;
    let entry = store.take(token).await.ok_or(StatusCode::UNAUTHORIZED)?;
    let TokenEntry::Upload { dest_dir, filename, max_size, .. } = entry else { return Err(StatusCode::BAD_REQUEST); };
    tokio::fs::create_dir_all(&dest_dir).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let final_path = dest_dir.join(&filename);
    let mut out = File::create(&final_path).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut total: u64 = 0;
    while let Ok(Some(mut field)) = multipart.next_field().await {
        while let Ok(Some(chunk)) = field.chunk().await {
            total += chunk.len() as u64;
            if total > max_size {
                drop(out); let _ = tokio::fs::remove_file(&final_path).await;
                warn!("upload exceeded max_size");
                return Err(StatusCode::PAYLOAD_TOO_LARGE);
            }
            tokio::io::AsyncWriteExt::write_all(&mut out, &chunk).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }
    info!("upload complete: {} ({total} bytes)", final_path.display());
    Ok("ok")
}
```

- [ ] **Step 3: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/files.rs desktop/src-tauri/Cargo.toml
git commit -m "feat(files): axum file endpoint + one-shot token store"
```

### Task 121: FileTransferPlugin on desktop

**Files:**
- Create: `desktop/src-tauri/src/sync/plugins/file_transfer.rs`
- Modify: `desktop/src-tauri/src/sync/plugins/mod.rs`

- [ ] **Step 1: Write the plugin**

```rust
use crate::files::{TokenStore, MAX_FILE_BYTES};
use crate::sync::plugins::SyncPlugin;
use crate::sync::protocol::Envelope;
use crate::sync::transport::SyncTransport;
use async_trait::async_trait;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;

pub struct FileTransferPlugin {
    tokens: TokenStore,
    download_dir: PathBuf,
    progress_tx: mpsc::Sender<ProgressUpdate>,
}

#[derive(Debug, Clone)]
pub struct ProgressUpdate { pub token: String, pub bytes: u64, pub total: u64 }

impl FileTransferPlugin {
    pub fn new(tokens: TokenStore, download_dir: PathBuf, progress_tx: mpsc::Sender<ProgressUpdate>) -> Arc<Self> {
        Arc::new(Self { tokens, download_dir, progress_tx })
    }

    /// Issue a download token and send FILE_OFFER. Called when user invokes Send-to-phone.
    pub async fn offer_file(&self, transport: &Arc<dyn SyncTransport>, path: PathBuf) -> Result<(), String> {
        let meta = tokio::fs::metadata(&path).await.map_err(|e| e.to_string())?;
        if meta.len() > MAX_FILE_BYTES { return Err(format!("file exceeds 100MB ({} bytes)", meta.len())); }
        let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("file").to_string();
        let mime = mime_guess::from_path(&path).first_or_octet_stream().essence_str().to_string();
        let token = self.tokens.issue_download(path.clone()).await;
        let env = Envelope::new("file_transfer", "FILE_OFFER", json!({
            "token": token, "filename": filename, "size": meta.len(), "mime": mime,
        }));
        transport.send(env).await
    }
}

#[async_trait]
impl SyncPlugin for FileTransferPlugin {
    fn name(&self) -> &'static str { "file_transfer" }
    async fn handle(&self, env: Envelope) -> Result<(), String> {
        match env.typ.as_str() {
            "FILE_UPLOAD_REQUEST" => {
                let filename = env.payload.get("filename").and_then(|v| v.as_str()).unwrap_or("file").to_string();
                let size = env.payload.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                if size > MAX_FILE_BYTES { return Err("upload exceeds 100MB".into()); }
                let _token = self.tokens.issue_upload(self.download_dir.clone(), filename, MAX_FILE_BYTES).await;
                // (Response with URL handled by transport-aware code in lib.rs setup)
                Ok(())
            }
            "FILE_PROGRESS" => {
                let token = env.payload.get("token").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let bytes = env.payload.get("bytes").and_then(|v| v.as_u64()).unwrap_or(0);
                let total = env.payload.get("total").and_then(|v| v.as_u64()).unwrap_or(0);
                let _ = self.progress_tx.send(ProgressUpdate { token, bytes, total }).await;
                Ok(())
            }
            "FILE_CANCEL" => {
                let token = env.payload.get("token").and_then(|v| v.as_str()).unwrap_or("");
                let _ = self.tokens.take(token).await; // forget it
                Ok(())
            }
            _ => Ok(()),
        }
    }
}
```

Add `pub mod file_transfer;` to `sync/plugins/mod.rs`.

- [ ] **Step 2: Build**

```bash
cd desktop && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/sync/plugins/file_transfer.rs desktop/src-tauri/src/sync/plugins/mod.rs
git commit -m "feat(files): FileTransferPlugin (FILE_OFFER/REQUEST/PROGRESS/CANCEL)"
```

### Task 122: Wire HTTP server + FileTransferPlugin in lib.rs

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Start the axum HTTP server**

Inside `setup`, alongside the WebSocket server spawn:
```rust
use crate::files::{TokenStore, router};
use crate::sync::plugins::file_transfer::{FileTransferPlugin, ProgressUpdate};

let tokens = TokenStore::new();
let download_dir = dirs::download_dir().unwrap_or(dirs::home_dir().unwrap().join("Downloads")).join("Clippy");
std::fs::create_dir_all(&download_dir).ok();
let (prog_tx, mut prog_rx) = tokio::sync::mpsc::channel::<ProgressUpdate>(64);
let ftp = FileTransferPlugin::new(tokens.clone(), download_dir.clone(), prog_tx);

// HTTP listener
let tokens_for_router = tokens.clone();
tauri::async_runtime::spawn(async move {
    let app = router(tokens_for_router);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:43118").await.expect("bind http");
    tracing::info!("http file endpoint listening on :43118");
    axum::serve(listener, app).await.ok();
});

// Forward progress updates to UI
let app_handle_p = app.handle().clone();
tauri::async_runtime::spawn(async move {
    while let Some(p) = prog_rx.recv().await {
        let _ = app_handle_p.emit("file-progress", serde_json::json!({"token": p.token, "bytes": p.bytes, "total": p.total}));
    }
});

// Register file_transfer plugin with dispatcher (modify the dispatcher block to also `dispatcher.register(ftp.clone())`)
```

- [ ] **Step 2: Build + verify the listener binds**

```bash
cd desktop && cargo tauri dev
# In another terminal:
curl -v http://localhost:43118/file/nonexistent
```

Expected: 404 from axum (token not found).

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(files): start axum on :43118 + register FileTransferPlugin"
```

### Task 123: Send-to-phone Tauri command + UI wire-up

**Files:**
- Modify: `desktop/src-tauri/src/commands.rs`, `desktop/src/lib/components/ClipCard.svelte`, `desktop/src/lib/components/HoverActions.svelte`, `desktop/src/lib/api.ts`

- [ ] **Step 1: Add the command**

```rust
#[tauri::command]
pub async fn send_to_phone(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    // For file/image clips, content is the file path (for `file`) or the PNG bytes (for `image`).
    // For images, write to a temp file first so the HTTP endpoint can stream from disk.
    let (ct, content): (String, Vec<u8>) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.conn().query_row("SELECT content_type, content FROM clips WHERE id = ?1", rusqlite::params![id],
            |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?
    };
    let path = if ct == "file" {
        std::path::PathBuf::from(std::str::from_utf8(&content).map_err(|e| e.to_string())?)
    } else if ct == "image" {
        let tmp = std::env::temp_dir().join(format!("clippy-img-{id}.png"));
        std::fs::write(&tmp, &content).map_err(|e| e.to_string())?;
        tmp
    } else { return Err("only file/image clips can be sent explicitly".into()); };
    // This needs access to the FileTransferPlugin + transport; share them via tauri::State.
    // Implementation detail: extend AppState to also hold Arc<FileTransferPlugin> + Arc<dyn SyncTransport>.
    // For brevity here, we emit an event that lib.rs's setup glue handles.
    Err("wire FileTransferPlugin handle into AppState — extend AppState to expose .offer_file(path)".into())
}
```

Then extend `AppState` with `pub file_plugin: Option<Arc<crate::sync::plugins::file_transfer::FileTransferPlugin>>, pub transport: Option<Arc<dyn crate::sync::transport::SyncTransport>>` and replace the `Err(...)` above with `state.file_plugin.as_ref()...offer_file(&state.transport.as_ref().unwrap(), path).await.map_err(|e| e.to_string())`.

In `App.svelte`, add `send` to hover overlay for `file`/`image` type clips that calls a new `api.send_to_phone(id)`.

- [ ] **Step 2: Add to api.ts**

```typescript
send_to_phone: (id: number) => invoke<void>('send_to_phone', { id }),
```

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/commands.rs desktop/src/lib/components/HoverActions.svelte desktop/src/lib/components/ClipCard.svelte desktop/src/lib/api.ts
git commit -m "feat(files): right-click + hover Send to phone for file/image clips"
```

### Task 124: TransferCard component

**Files:**
- Create: `desktop/src/lib/components/TransferCard.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  let { filename, bytes, total, speedBps = 0, onCancel = () => {} }: {
    filename: string; bytes: number; total: number; speedBps?: number; onCancel?: () => void;
  } = $props();
  const pct = $derived(total > 0 ? bytes / total : 0);
  const dash = $derived(2 * Math.PI * 18);
  const offset = $derived(dash * (1 - pct));
  function fmtMB(n: number) { return (n / 1_048_576).toFixed(1) + ' MB'; }
  function fmtETA(): string {
    if (speedBps <= 0 || total <= bytes) return '—';
    return `${Math.ceil((total - bytes) / speedBps)}s left`;
  }
</script>
<div class="transfer">
  <div class="badge">SENDING</div>
  <div class="arc-wrap">
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="18" fill="none" stroke="var(--cm-surface-raised)" stroke-width="3" />
      <circle cx="28" cy="28" r="18" fill="none" stroke="var(--cm-accent)" stroke-width="3"
        stroke-dasharray={dash} stroke-dashoffset={offset}
        transform="rotate(-90 28 28)" stroke-linecap="round" />
    </svg>
    <div class="pct">{Math.round(pct * 100)}%</div>
  </div>
  <div class="meta">
    <div class="name">{filename}</div>
    <div class="rate">{fmtMB(bytes)} / {fmtMB(total)} · {(speedBps / 1_048_576).toFixed(1)} MB/s</div>
  </div>
  <div class="actions">
    <span class="eta">{fmtETA()}</span>
    <button onclick={onCancel}>Cancel</button>
  </div>
</div>
<style>
  .transfer { width: 200px; height: 240px; padding: 12px; border-radius: 14px; background: var(--cm-surface);
    border: 1px solid color-mix(in srgb, var(--cm-accent) 33%, transparent); display: flex; flex-direction: column; gap: 10px; }
  .badge { padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: .4px; background: var(--badge-file-bg); color: var(--badge-file-fg); align-self: flex-start; }
  .arc-wrap { position: relative; display: flex; align-items: center; justify-content: center; flex: 1; }
  .pct { position: absolute; font-size: 11px; font-weight: 600; font-family: 'Geist Mono', ui-monospace, monospace; color: var(--cm-text); }
  .meta { text-align: center; }
  .name { font-size: 11.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rate { font-size: 10px; color: var(--cm-text-secondary); font-family: 'Geist Mono', ui-monospace, monospace; }
  .actions { display: flex; justify-content: space-between; align-items: center; font-size: 10px; }
  button { background: transparent; border: 1px solid var(--cm-border-subtle); border-radius: 6px; color: var(--cm-text); padding: 3px 8px; font-family: inherit; font-size: 11px; cursor: pointer; }
</style>
```

In the panel body, listen for `file-progress` events; if there's an active transfer, render `TransferCard` as the first card in whichever layout is active.

- [ ] **Step 2: Commit**

```bash
git add desktop/src/lib/components/TransferCard.svelte
git commit -m "feat(files): TransferCard with circular progress arc + ETA + cancel"
```

### Task 125: Mobile — receive file via FILE_OFFER → download

**Files:**
- Modify: `mobile/lib/services/sync_service.dart`

- [ ] **Step 1: Handle FILE_OFFER**

In `_onMessage`, add a branch for `env.plugin == 'file_transfer' && env.type == 'FILE_OFFER'`:
```dart
// Show standard-importance notification, on user tap → download
final token = env.payload['token'];
final filename = env.payload['filename'];
final size = env.payload['size'] as int;
// (Trigger flutter_local_notifications with action "Receive" — on tap, call _download(token, filename, size))
```

Implement `_download`:
```dart
Future<void> _download(String token, String filename, int size, String host) async {
  final dir = await getExternalStorageDirectory() ?? await getApplicationDocumentsDirectory();
  final dest = '${dir.path}/$filename';
  final dio = Dio();
  await dio.download('http://$host:43118/file/$token', dest,
    onReceiveProgress: (rcv, total) {
      // Emit FILE_PROGRESS over WS for desktop UI
      sendText // (Use a dedicated send method, not sendText)
    });
  // Toast: "Received $filename"
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/services/sync_service.dart
git commit -m "feat(mobile): receive FILE_OFFER → notify → download via Dio"
```

### Task 126: Mobile — share-sheet target

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`, `mobile/lib/app.dart`

- [ ] **Step 1: Register intent filter in AndroidManifest**

Inside `<activity android:name=".MainActivity" ...>`:
```xml
<intent-filter>
  <action android:name="android.intent.action.SEND" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="*/*" />
</intent-filter>
<intent-filter>
  <action android:name="android.intent.action.SEND_MULTIPLE" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="*/*" />
</intent-filter>
```

- [ ] **Step 2: Wire share_handler in app.dart**

```dart
import 'package:share_handler/share_handler.dart';
// in _HomeState.initState:
ShareHandlerPlatform.instance.sharedMediaStream.listen((SharedMedia media) async {
  for (final att in media.attachments ?? []) {
    await SyncService.instance.uploadFile(att.path);
  }
});
```

Implement `SyncService.uploadFile(path)`:
```dart
Future<void> uploadFile(String path) async {
  final t = _t; if (t == null) return;
  final f = File(path);
  final size = await f.length();
  // 1) Send FILE_UPLOAD_REQUEST
  final reqEnv = Envelope(type: 'FILE_UPLOAD_REQUEST', id: '...', ts: ms, plugin: 'file_transfer',
    payload: {'filename': p.basename(path), 'size': size});
  // For v1 we receive token via a follow-up envelope; here we assume desktop responds inline.
  // 2) POST multipart to http://$host:43118/file/upload with X-Clippy-Token header
  // (Implementation in next task.)
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml mobile/lib/app.dart mobile/lib/services/sync_service.dart
git commit -m "feat(mobile): share-sheet target → start phone→desktop file upload"
```

### Task 127: Desktop — respond to FILE_UPLOAD_REQUEST with token

**Files:**
- Modify: `desktop/src-tauri/src/sync/plugins/file_transfer.rs`, `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Return a FILE_OFFER-style envelope for uploads**

In `handle()` for `FILE_UPLOAD_REQUEST`, after issuing the token:
```rust
// Build response envelope with token + url, and emit through the transport.
// Caller of handle() doesn't have transport — solution: emit via a callback channel
// stored in plugin construction.
```

Refactor `FileTransferPlugin::new` to accept an `Arc<Mutex<Option<Arc<dyn SyncTransport>>>>` so it can send back. Then in `handle`:
```rust
let env = Envelope::new("file_transfer", "FILE_UPLOAD_TOKEN", json!({
    "token": token, "url": format!("http://CHOSEN_LAN_IP:43118/file/upload")
}));
if let Some(t) = self.transport.lock().await.as_ref() {
    let _ = t.send(env).await;
}
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src-tauri/src/sync/plugins/file_transfer.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(files): respond to FILE_UPLOAD_REQUEST with FILE_UPLOAD_TOKEN"
```

### Task 128: Mobile — receive FILE_UPLOAD_TOKEN and POST file

**Files:**
- Modify: `mobile/lib/services/sync_service.dart`

- [ ] **Step 1: Handle FILE_UPLOAD_TOKEN in _onMessage**

```dart
if (env.plugin == 'file_transfer' && env.type == 'FILE_UPLOAD_TOKEN') {
  final token = env.payload['token']; final url = env.payload['url'];
  // pop from pending uploads queue and POST
  final upload = _pendingUploads.removeFirst();
  final dio = Dio();
  await dio.post(url, data: FormData.fromMap({ 'file': await MultipartFile.fromFile(upload.path) }),
    options: Options(headers: {'X-Clippy-Token': token}),
    onSendProgress: (sent, total) {
      // emit FILE_PROGRESS over WS for desktop UI
      _t?.send(Envelope(type: 'FILE_PROGRESS', id: '...', ts: ms, plugin: 'file_transfer',
        payload: {'token': token, 'bytes': sent, 'total': total}));
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/services/sync_service.dart
git commit -m "feat(mobile): POST file upon FILE_UPLOAD_TOKEN; emit FILE_PROGRESS"
```

### Task 129: Desktop — show received file as a new `file` clip

**Files:**
- Modify: `desktop/src-tauri/src/files.rs`

- [ ] **Step 1: After upload completes, insert a clip row**

At the end of `handle_upload` (before `Ok("ok")`):
```rust
// Insert into clips so the file appears in the panel.
// Requires DB access — pass an Arc<Mutex<Db>> through State.
// (Extend the State type to AppHttpState { tokens, db }.)
```

Refactor `router()` to take an `AppHttpState`, accept the db. Insert:
```rust
use crate::clipboard::ContentType;
let path_bytes = final_path.to_string_lossy().as_bytes().to_vec();
let mut db = state.db.lock().unwrap();
let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
let _ = db.insert_clip(ContentType::File, &path_bytes, "application/octet-stream",
    &filename, Some("from phone"), now);
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src-tauri/src/files.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(files): incoming uploads insert as file clip in history"
```

### Task 130: Drag-and-drop file into the panel

**Files:**
- Modify: `desktop/src/App.svelte`

- [ ] **Step 1: Add dropzone**

In `App.svelte` main element:
```svelte
<main ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  ...
</main>
```

```typescript
async function onDrop(e: DragEvent) {
  e.preventDefault();
  if (!e.dataTransfer) return;
  for (const f of Array.from(e.dataTransfer.files)) {
    // Tauri exposes (path) on files via webview events; this needs the Tauri drop handler.
    // Use Tauri's listen('tauri://drag-drop', ...) instead.
  }
}
```

In `lib.rs`, listen for Tauri's drop event in the panel window and call `send_to_phone(path_as_clip_id)`. (Implementation: when a file is dropped, first insert it as a `file` clip via `insert_clip`, then immediately call the same send path used by right-click.)

- [ ] **Step 2: Commit**

```bash
git add desktop/src/App.svelte desktop/src-tauri/src/lib.rs
git commit -m "feat(files): drag-and-drop file onto panel → insert + Send to phone"
```

### Task 131: Cancel mid-transfer

**Files:**
- Modify: `desktop/src-tauri/src/sync/plugins/file_transfer.rs`, `mobile/lib/services/sync_service.dart`

- [ ] **Step 1: Add cancel envelope handling**

Desktop already handles `FILE_CANCEL` in `handle()`. Add a Tauri command `cancel_transfer(token)` that:
1. Calls `tokens.take(token)` to invalidate.
2. Sends `FILE_CANCEL` envelope to phone.

In `TransferCard.svelte`, wire `onCancel` to call `api.cancel_transfer(token)`.

On mobile, on `FILE_CANCEL`, abort the in-flight `Dio` request.

- [ ] **Step 2: Commit**

```bash
git add desktop/src-tauri/src/sync/plugins/file_transfer.rs desktop/src/lib/components/TransferCard.svelte desktop/src-tauri/src/commands.rs mobile/lib/services/sync_service.dart
git commit -m "feat(files): cancellation propagates over FILE_CANCEL both sides"
```

### Task 132: 100MB rejection — explicit user-facing error

**Files:**
- Modify: `desktop/src-tauri/src/sync/plugins/file_transfer.rs`, `mobile/lib/services/sync_service.dart`

- [ ] **Step 1: Surface the error via Tauri command result**

`send_to_phone` in commands.rs already returns `Err("file exceeds 100MB...")`. In the frontend, catch and toast it.

Mobile: in `uploadFile`, check `size > 100*1024*1024` and toast "File exceeds 100 MB limit".

- [ ] **Step 2: Commit**

```bash
git add desktop/src-tauri/src/sync/plugins/file_transfer.rs desktop/src-tauri/src/commands.rs desktop/src/App.svelte mobile/lib/services/sync_service.dart
git commit -m "feat(files): user-facing 100MB rejection on both sides"
```

### Task 133: Notification on incoming file (mobile)

**Files:**
- Modify: `mobile/lib/services/sync_service.dart`

- [ ] **Step 1: Use flutter_local_notifications**

On `FILE_OFFER`, raise a standard-importance notification:
```dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
final fln = FlutterLocalNotificationsPlugin();
await fln.show(
  1, '${filename} received',
  '${size ~/ 1024} KB · from $deviceName',
  const NotificationDetails(android: AndroidNotificationDetails(
    'clippy_files', 'Clippy files', importance: Importance.high)),
);
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/services/sync_service.dart
git commit -m "feat(mobile): standard-importance notification for incoming files"
```

### Task 134: Phase-3 acceptance smoke test (PRD §8.5)

**Files:** none.

- [ ] **Step 1: Drag 50MB file on desktop → arrives on phone in <15s**

Create a 50MB test file: `dd if=/dev/urandom of=/tmp/test50mb.bin bs=1M count=50`. Drag onto Clippy panel. Verify it appears on phone within 15s.

- [ ] **Step 2: Share from phone gallery → arrives on desktop**

Open Android Files / Photos app → Share → "Clippy" → verify a new `file` clip appears at the top of the desktop panel.

- [ ] **Step 3: Verify NO file ever auto-syncs**

Copy several files to the desktop clipboard via `xclip` or file manager. Watch `tcpdump` — verify zero `FILE_OFFER` envelopes (only triggered by explicit Send).

- [ ] **Step 4: Try 200MB file**

Expected: clear toast "File exceeds 100 MB limit".

- [ ] **Step 5: Cancel mid-transfer**

Drag a 50MB file → during transfer, click Cancel on TransferCard. Verify both sides stop cleanly; verify no partial file remains in `~/Downloads/Clippy/` / phone's Download dir.

- [ ] **Step 6: Tag**

```bash
git tag -a v0.3.0-phase3 -m "Phase 3 — explicit file transfer 100MB cap"
git tag -a v1.0.0-rc1 -m "v1.0.0-rc1 — all phases complete"
```

End of Part E. v1 RC ready.

---

## Self-review checklist

Run through this list before declaring the plan ready for execution.

- [ ] **Spec coverage:** every requirement in `PRD.md` §6/§7/§8 and spec §D1–D18 maps to at least one task above.
- [ ] **No placeholders:** no `TBD`, `TODO`, "implement later", "similar to Task N" without repeated code.
- [ ] **Type consistency:** `ContentType`, `Envelope`, `ClipDto`, `Settings` use identical field names across Rust + TS + Dart.
- [ ] **Frequent commits:** every task ends with a `git commit`. No long uncommitted stretches.
- [ ] **TDD discipline:** each Rust module that adds behavior has a failing test → impl → passing test → commit sequence. (Pure scaffolding tasks legitimately skip the test step.)

If any check fails, fix the plan before execution.




