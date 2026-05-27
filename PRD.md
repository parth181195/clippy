# Clippy — Product Requirements Document

> Originally drafted as "ClipMate"; finalized as **Clippy**. References to ClipMate in older notes mean Clippy.
> A cross-device clipboard manager + file-sharing tool for personal use.
> Desktop: Ubuntu (GNOME Wayland). Mobile: Android. Sync: LAN only.
> Inspired by [Paste](https://pasteapp.io/) (macOS), [Pano](https://github.com/oae/gnome-shell-pano) (GNOME, archived), and [Copyous](https://github.com/boerdereinar/copyous) (GNOME, Pano successor).

---

## 1. Overview

Clippy is a personal-use clipboard manager that:

1. Captures clipboard history on the desktop with a beautiful, Paste-style horizontal card UI.
2. Syncs clipboard contents in real-time to a paired Android phone over the local network.
3. Allows sharing files up to 100 MB from desktop to phone (and phone to desktop) without going through cloud services.

This is a **personal project**. No accounts, no cloud servers, no billing, no multi-tenant support. Devices pair once via QR code and talk peer-to-peer over LAN.

### Why build this instead of using existing tools?

- **Pano** has the desired desktop UI but no device sync. It's also archived/unmaintained.
- **Copyous** (Pano's successor) is great but GNOME-only and has no sync either.
- **KDE Connect** has device sync but a dated UI and clunky clipboard handling.
- **Paste** doesn't exist on Linux.
- **Clipt, ClipCascade, Pushbullet** are cloud-based — slower, less private, and overkill for personal use.

Clippy combines Pano/Copyous's UI quality with KDE Connect's sync capabilities, in a single cohesive app.

---

## 2. Goals and non-goals

### Goals (in scope)

- Real-time-feeling clipboard capture on Ubuntu GNOME Wayland (GNOME-extension primary, polling fallback)
- Visually rich card-based clipboard history with content-type awareness
- Global hotkey to summon the clipboard panel
- Search, favorites, tags, app exclusion list, incognito mode, customizable per-type actions
- One-time pairing between desktop and Android via QR code
- Bidirectional clipboard + tag sync when both devices are on the same LAN
- File transfer up to 100 MB, initiated from either side
- Encrypted communication between paired devices

### Non-goals (out of scope)

- Cloud sync or relay servers
- Cross-network sync (when phone is on mobile data)
- Multi-user / multi-tenant features
- Windows or macOS support
- iOS support (clipboard restrictions make it not worth the effort)
- Pairing more than one phone in v1
- App store distribution (sideload .deb / APK is fine for personal use)
- Subscription, billing, analytics, telemetry
- Localization (English only)
- Accessibility audit (basic keyboard nav is enough)

---

## 3. Tech stack (locked in)

| Layer | Choice | Why |
|---|---|---|
| Desktop framework | **Tauri 2.x** (Rust + web frontend) | ~5 MB binary, snappy, native feel |
| Desktop frontend | **Svelte 5** + Vite + TypeScript | Lightweight, fast, smooth animations |
| Desktop clipboard | `clipboard-master` + `arboard` crates (fallback only) | Polling fallback when GNOME extension absent |
| GNOME extension | TypeScript + GJS (custom Clippy extension) | Primary clipboard + focused-window source on Wayland |
| Desktop storage | **SQLite** via `rusqlite` (bundled feature) | No external server, file-based, fast |
| Desktop hotkey | `tauri-plugin-global-shortcut` | Built-in support |
| Desktop sound | `rodio` crate (cross-distro), `gsound` where available | Plays the bundled copy sound |
| Encryption | `libsodium` via `sodiumoxide` crate | Battle-tested, simple API |
| LAN discovery | mDNS via `mdns-sd` crate | Zero-config service discovery |
| Sync transport | WebSocket via `tokio-tungstenite` | Bidirectional, lightweight |
| File transfer | Plain HTTP over `axum` (embedded in Tauri) | Standard, resumable, no protocol invention |
| Android framework | **Flutter 3.x** | Faster polished UI than React Native |
| Android storage | `sqflite` | Match desktop pattern |
| Android networking | `web_socket_channel` + `dio` | Standard Flutter choices |
| QR scanning | `mobile_scanner` (Flutter) + `qrcode` (Rust) | Generate on desktop, scan on phone |

**Do not substitute these choices unless there is a compelling reason. If you encounter a blocker with one, surface it before swapping.**

---

## 4. High-level architecture

```
┌──────────────────────────────────────┐    ┌────────────────────────────┐
│  Clippy desktop (Tauri)              │    │  Clippy GNOME extension    │
│  Svelte UI + Rust core               │◀──▶│  (GJS/TypeScript)          │
│  SQLite, sync server,                │    │  D-Bus: clipboard events   │
│  HTTP file endpoint                  │    │  + focused-window signal   │
└──────────────────┬───────────────────┘    └────────────────────────────┘
                   │  LAN (encrypted)
                   ▼
       ┌───────────────────┐    ┌──────────────────────────────┐
       │  Clippy app       │    │  SyncTransport (interface)   │
       │  (Flutter)        │◀──▶│   → LanWebSocketTransport    │
       │  Foreground       │    │   (only impl in v1; stubs    │
       │  service + batt   │    │    for future BT/USB)        │
       │  exemption        │    │  SyncPlugin (interface)      │
       │                   │    │   → ClipboardPlugin          │
       └───────────────────┘    │   → FileTransferPlugin       │
                                │   → TagsPlugin               │
                                └──────────────────────────────┘
```

The system has **four components**, not three: the GNOME extension is a sibling artifact, not internal to Tauri.

---

## 5. Repository structure

Monorepo, single Git root (already at `~/WebstormProjects/ext/clippy/`):

```
clippy/
├── README.md
├── PRD.md                          # this file
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-27-clippy-design.md
├── desktop/                        # Tauri app
│   ├── src-tauri/
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── src/
│   │       ├── main.rs
│   │       ├── clipboard/
│   │       │   ├── mod.rs
│   │       │   ├── source_extension.rs   # subscribes to GNOME ext D-Bus
│   │       │   ├── source_polling.rs     # fallback
│   │       │   └── detect.rs             # content-type classification
│   │       ├── db.rs
│   │       ├── sync/
│   │       │   ├── mod.rs
│   │       │   ├── server.rs
│   │       │   ├── discovery.rs
│   │       │   ├── crypto.rs
│   │       │   ├── protocol.rs
│   │       │   ├── transport/
│   │       │   │   ├── mod.rs            # SyncTransport trait
│   │       │   │   └── lan_websocket.rs  # only impl in v1
│   │       │   └── plugins/
│   │       │       ├── mod.rs            # SyncPlugin trait
│   │       │       ├── clipboard.rs
│   │       │       ├── file_transfer.rs
│   │       │       └── tags.rs
│   │       ├── files.rs                  # HTTP file endpoint
│   │       ├── pairing.rs
│   │       ├── dbus_app.rs               # io.clippy.App
│   │       ├── actions.rs                # custom per-type actions
│   │       ├── notifications.rs          # opt-in copy notifications
│   │       ├── sound.rs                  # bundled copy sound
│   │       ├── link_preview.rs           # async OG fetch
│   │       └── commands.rs               # Tauri commands
│   ├── src/                              # Svelte frontend
│   │   ├── App.svelte
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── CardGrid.svelte
│   │   │   │   ├── ClipCard.svelte
│   │   │   │   ├── SearchBar.svelte
│   │   │   │   ├── TagBar.svelte
│   │   │   │   ├── SettingsPanel.svelte
│   │   │   │   ├── ActionsEditor.svelte
│   │   │   │   └── PairingDialog.svelte
│   │   │   ├── stores/
│   │   │   └── api.ts
│   │   └── main.ts
│   ├── assets/
│   │   └── sounds/copy.ogg               # bundled
│   ├── package.json
│   └── vite.config.ts
├── extension/                            # GNOME Shell extension
│   ├── metadata.json
│   ├── extension.ts
│   ├── prefs.ts
│   ├── dbus.ts
│   ├── schemas/
│   ├── package.json
│   └── tsconfig.json
├── mobile/                               # Flutter app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/
│   │   │   ├── home_screen.dart
│   │   │   ├── pairing_screen.dart
│   │   │   ├── history_screen.dart
│   │   │   └── settings_screen.dart
│   │   ├── services/
│   │   │   ├── sync/
│   │   │   │   ├── transport.dart        # SyncTransport interface
│   │   │   │   ├── lan_websocket.dart
│   │   │   │   └── plugins/
│   │   │   │       ├── plugin.dart
│   │   │   │       ├── clipboard.dart
│   │   │   │       ├── file_transfer.dart
│   │   │   │       └── tags.dart
│   │   │   ├── discovery_service.dart
│   │   │   ├── crypto_service.dart
│   │   │   ├── db_service.dart
│   │   │   ├── foreground_service.dart
│   │   │   └── battery_optimization.dart
│   │   ├── models/
│   │   └── widgets/
│   ├── android/
│   │   └── app/src/main/AndroidManifest.xml
│   └── pubspec.yaml
└── shared-protocol/
    └── README.md
```

**Stick to this structure. If something doesn't fit, raise it before improvising.**

---

## 6. Phase 1 — Desktop standalone + GNOME extension (week 1)

**Goal:** A working local clipboard manager that already feels great to use, with no networking between devices yet. The GNOME extension is part of Phase 1 (previously Phase 4) because it's the only way to get reliable clipboard + active-window events on Wayland.

### 6.1 Features

#### F1. Clipboard capture
- Primary: subscribe to `ClipboardChanged(mime, b64_content)` D-Bus signal from the Clippy GNOME extension
- Fallback: polling-based watcher using `clipboard-master` at 300ms intervals when the extension is not present or not running
- Detect content type: `text`, `image`, `link` (URL), `code` (source-app first via focused-window signal; falls back to content heuristic), `color` (hex/rgb/hsl pattern), `emoji` (only emoji chars), `file` (file path that exists)
- SHA-256 hash for deduplication
- Store last 500 items by default (configurable)
- Multi-representation: store every mime the source offered (e.g. `text/html` + `text/plain`); primary preview uses plain text
- Skip capture if focused app matches exclusion list

#### F2. History UI
- Hidden by default; appears on global hotkey (`Ctrl+Shift+V`, configurable)
- Window position: configurable (top/bottom/left/right), default bottom — matching Pano
- Layout: horizontal-scrolling row of cards, each ~200×280px
- Card shows: preview, source app icon, type badge, tags (colored dots), timestamp on hover
- Keyboard navigation (Pano + Copyous style):
  - Arrow keys move selection
  - Enter pastes (synthesises `Ctrl+V` to previously-focused app)
  - **Shift+Enter** synthesises `Ctrl+Shift+V` instead (for terminals)
  - **Ctrl+Enter** / **Ctrl+Click** on a `link` clip runs the link's default custom action (typically: open in browser)
  - Esc closes
  - **Tab / Shift+Tab** cycles type filter; **Backspace** on empty search clears the filter
  - **Delete** removes the focused item; **Shift+Delete** force-deletes a pinned/tagged item
  - **Ctrl+S** toggles favorite
  - **Alt** toggles favorites-only view
  - Typing anywhere focuses the search bar
- Mouse: click to paste, right-click for context menu (pin, tag, delete, copy raw, **Paste as…** submenu for multi-rep clips, custom actions for the type)

#### F3. Search
- Search bar at top of panel
- Filter as you type
- SQLite FTS5 for text content
- Image/file/color search by metadata

#### F4. Favorites + Tags
- Star icon pins items; pinned never auto-deleted
- **Tags**: up to 9 colored, named groups. Items can have multiple tags. Tag bar above the card grid filters by tag. Tags persist and sync to phone.

#### F5. Incognito mode
- Toggle hotkey: `Ctrl+Shift+I` (configurable)
- Clipboard changes are NOT stored while active
- Visual indicator: subtle red border + tray icon change
- Auto-disable after 5 minutes (configurable)

#### F6. App exclusion list
- Active-window detection via GNOME extension's `FocusedWindowChanged` signal (primary)
- Heuristic fallback (Xorg `xdotool getactivewindow`; `/proc` walk) when extension absent
- Pre-populated: `keepassxc`, `bitwarden`, `1password`, `gnome-keyring`

#### F7. Customizable per-type actions (Copyous-inspired)
- Each content type has a list of user-defined actions
- Action kinds: `paste` (default), `open_url`, `save_to_file`, `shell_command`, `web_search`
- One action per type is marked `is_default` — that's what `Ctrl+Enter` runs
- Settings UI: editor with kind picker + per-kind params
- Pre-seeded: `link` → "Open in browser" as default

#### F8. Content-aware notifications (opt-in)
- Off by default
- When enabled, every captured clip raises a transient desktop notification with type-specific styling (color swatch, image thumbnail, link card with favicon)

#### F9. Rich link previews
- Async fetcher for `link` clips: GET the URL, parse `<title>`, `og:image`, favicon
- 3 s hard timeout, single-shot per URL, refuses private IPs / `localhost`
- Cached in `link_previews` table with status (`ok`/`timeout`/`error`/`blocked`); no retry on failure
- Opt-out toggle in settings — when disabled, no network egress happens at all

#### F10. Sound on copy
- Single bundled short sound (~80 ms) plays on every captured clip
- **On by default**; toggle in settings to mute
- Implementation: `rodio` for cross-distro; tries `gsound` if available (matches Pano/Copyous behaviour on GNOME)

#### F11. Settings
- Hotkey customization (panel, incognito)
- Panel position (top/bottom/left/right)
- Theme: light/dark/auto
- History size limit (50–10,000)
- Polling interval (100–1000ms, advanced; only relevant when extension absent)
- Exclusion list management
- Tags management (add/rename/recolor/delete)
- Custom actions editor
- Sound on copy: on/off
- Notifications: on/off
- Link previews: on/off
- Clear history (with confirmation)

#### F12. Public D-Bus interfaces
- **`org.gnome.Shell.Extensions.Clippy`** (extension, GJS): `Toggle`, `Show`, `Hide`, `ClearHistory(bool all)`; signals `ClipboardChanged(mime, b64)`, `FocusedWindowChanged(app_id, title)`
- **`io.clippy.App`** (Tauri, Rust via `zbus`): `TogglePanel`, `OpenSettings`, `SearchHistory(query)`, `PasteByHash(hash)`, `RunActionByHash(hash, action_id)`

### 6.2 Data model — SQLite schema

DB location: `~/.local/share/clippy/clippy.db`

```sql
CREATE TABLE clips (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL CHECK (content_type IN
                  ('text','image','link','code','color','emoji','file')),
    content      BLOB NOT NULL,           -- primary representation (e.g. text utf-8, original image bytes)
    mime         TEXT NOT NULL,           -- canonical mime for the primary representation
    content_hash TEXT NOT NULL,           -- sha256 of primary content
    preview      TEXT,                    -- short text preview for display/search
    source_app   TEXT,                    -- "firefox", "code", etc.
    is_favorite  INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,        -- unix epoch ms
    UNIQUE (content_hash)
);

CREATE INDEX idx_clips_created ON clips(created_at DESC);
CREATE INDEX idx_clips_favorite ON clips(is_favorite DESC, created_at DESC);

CREATE TABLE clip_representations (
    clip_id INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    mime    TEXT NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (clip_id, mime)
);

CREATE TABLE clip_thumbnails (
    clip_id   INTEGER PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    png_bytes BLOB NOT NULL
);

CREATE TABLE tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    color_idx  INTEGER NOT NULL CHECK (color_idx BETWEEN 0 AND 8),
    sort_order INTEGER NOT NULL
);
CREATE TABLE clip_tags (
    clip_id INTEGER NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (clip_id, tag_id)
);

CREATE TABLE clip_actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    label        TEXT NOT NULL,
    kind         TEXT NOT NULL,            -- paste/open_url/save_file/shell_command/web_search
    params_json  TEXT NOT NULL DEFAULT '{}',
    is_default   INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL
);

CREATE TABLE link_previews (
    clip_id     INTEGER PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    title       TEXT,
    description TEXT,
    favicon_png BLOB,
    og_image    BLOB,
    fetched_at  INTEGER NOT NULL,
    status      TEXT NOT NULL              -- ok/timeout/error/blocked
);

CREATE VIRTUAL TABLE clips_fts USING fts5 (
    preview,
    content='clips',
    content_rowid='id'
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE excluded_apps (
    app_id TEXT PRIMARY KEY
);

CREATE TABLE paired_devices (
    device_id TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    pubkey    BLOB NOT NULL,
    psk       BLOB NOT NULL,
    paired_at INTEGER NOT NULL
);
```

### 6.3 UI requirements (frontend)

- Background: blurred backdrop using `backdrop-filter: blur(20px)` + semi-transparent (`rgba(20,20,28,0.85)` dark; `rgba(245,245,250,0.85)` light)
- Card border-radius: 16px
- Card hover: subtle lift (`transform: translateY(-4px)`) with shadow
- Selected card: 2px accent border (use system accent via Tauri; fall back to a Clippy purple if unavailable on Wayland)
- Horizontal scroll: `scroll-snap-type: x mandatory`
- Animations: 200ms cubic-bezier(0.2, 0.9, 0.3, 1) for everything
- Open animation: slide up from bottom over 250ms
- Settings via gear icon top-right; no hamburger
- Tag bar: small horizontal strip above the card grid showing colored tag chips; clicking filters; long-press to manage

### 6.4 Acceptance criteria for Phase 1

- [ ] Copying text anywhere stores it; appears at the top of the panel
- [ ] Copying an image renders as thumbnail; primary content preserved in original format with mime
- [ ] HTML+plain text copy from a browser stores both reps; "Paste as…" submenu offers both
- [ ] Copying a URL gets a `link` badge; rich preview appears within 3 s when previews enabled
- [ ] Global hotkey opens/closes panel from any focused app
- [ ] Enter pastes via Ctrl+V; Shift+Enter pastes via Ctrl+Shift+V (verify in a terminal)
- [ ] Tab/Shift+Tab cycle the type filter; Backspace clears it
- [ ] Delete removes; Shift+Delete force-deletes pinned/tagged items; Ctrl+S toggles favorite; Alt toggles favorites-only
- [ ] Ctrl+Enter on a `link` clip opens it in the default browser
- [ ] Search filters live with <50ms latency at 500 items
- [ ] Favorites + tags persist across restarts; tags appear as colored dots on cards
- [ ] Incognito mode prevents capture; auto-disables after 5 min
- [ ] App in exclusion list (try `keepassxc`) does not get captured (when the GNOME extension is running)
- [ ] Sound plays on every capture; muting in settings silences it
- [ ] Notifications appear when enabled and only when enabled
- [ ] Link-preview fetcher respects 3 s timeout, refuses private IPs, caches failure
- [ ] App memory under 80 MB idle, under 200 MB with 500 items loaded
- [ ] App starts in under 1 second on a modest laptop
- [ ] Settings persist across restarts
- [ ] `org.gnome.Shell.Extensions.Clippy.Toggle` and `io.clippy.App.TogglePanel` both work via `busctl`

---

## 7. Phase 2 — Android app + LAN sync (week 2)

**Goal:** Phone shows desktop clipboard in real time. Desktop shows last copies from phone. Tags sync.

### 7.1 Pairing flow

1. User opens "Add Device" in desktop settings
2. Desktop generates:
   - 32-byte ed25519 keypair (device identity)
   - 32-byte symmetric key (`secretbox`)
   - Reads its LAN IPs (skip loopback; prefer 192.168.x / 10.x / 172.16.x)
3. Desktop displays QR code encoding:
   ```json
   {
     "v": 1,
     "device_id": "clippy-desktop-abc123",
     "host": "192.168.1.42",
     "port": 43117,
     "psk": "base64(32-byte-symmetric-key)",
     "pubkey": "base64(ed25519-public)"
   }
   ```
4. Phone opens "Pair with Desktop", scans QR
5. Phone stores config in `flutter_secure_storage`
6. Phone connects to WebSocket, sends `HELLO` message signed with its own ed25519 key
7. Desktop verifies, stores phone's pubkey in `paired_devices`
8. Pairing complete; both sides show "Paired with [device name]"
9. Phone prompts user for **battery-optimization exemption** (KDE Connect convention)

### 7.2 Sync protocol

Transport: WebSocket. All payloads JSON, encrypted with `crypto_secretbox` using PSK, base64-encoded.

Message envelope (before encryption):
```json
{ "type": "...", "id": "uuid-v4", "ts": 1735000000000, "plugin": "clipboard|file_transfer|tags|core", "payload": { ... } }
```

| Type | Plugin | Direction | Payload | Purpose |
|---|---|---|---|---|
| `HELLO` | core | bidir | `{device_id, name, version}` | Initial handshake |
| `ACK` | core | bidir | `{ref_id}` | Confirm receipt |
| `CLIP_NEW` | clipboard | bidir | `{kind, mime, preview, hash, content_inline?, file_token?, reps?}` | Notify other side of new clip |
| `CLIP_REQUEST` | clipboard | bidir | `{hash}` | Request full content if not inlined |
| `CLIP_LIST` | clipboard | bidir | `{since_ts, items: [...]}` | Initial sync after reconnect |
| `TAG_LIST` | tags | bidir | `{tags: [{id, name, color_idx}]}` | Initial tag set |
| `TAG_UPSERT` | tags | bidir | `{id, name, color_idx, sort_order}` | Tag created/renamed |
| `TAG_DELETE` | tags | bidir | `{id}` | Tag removed |
| `CLIP_TAG` | tags | bidir | `{clip_hash, tag_id, op}` | Tag attach/detach (op = add/remove) |
| `FILE_OFFER` | file_transfer | bidir | `{token, filename, size, mime}` | File is available |
| `FILE_REQUEST` | file_transfer | bidir | `{token}` | Acknowledge intent to download |
| `FILE_UPLOAD_REQUEST` | file_transfer | phone→desktop | `{filename, size}` | Phone wants to upload |

**Inline vs request rule:**
- Text under 4 KB: inline in `CLIP_NEW.content_inline`
- Multi-representations under 8 KB total: inline in `reps`
- Images: always send as file via `FILE_OFFER`
- Files: always `FILE_OFFER`

### 7.3 Pluggable architecture

On both sides:

- **`SyncTransport`** trait/interface: `connect(addr)`, `send(envelope)`, `on_message(handler)`, `close()`. v1 has only `LanWebSocketTransport`; a stub `BluetoothTransport` documents the interface for later.
- **`SyncPlugin`** trait/interface: `name() -> str`, `handle(envelope)`. v1 ships `ClipboardPlugin`, `FileTransferPlugin`, `TagsPlugin`. The dispatcher routes envelopes by `plugin` field.

### 7.4 Discovery and reconnection

- Desktop advertises mDNS service: `_clippy._tcp.local` with TXT `device_id`, `version`
- Phone browses mDNS when foregrounded; falls back to last-known IP if no result in 3 s
- On disconnect, exponential backoff: 1s, 2s, 4s, 8s, max 30s
- **`ConnectivityManager` listener** on Android triggers immediate reconnect on WiFi/AP change (sub-second), bypassing the backoff
- On reconnect, phone sends `CLIP_LIST` + `TAG_LIST` with `since_ts` to backfill

### 7.5 Android UI

Four screens:

1. **Home / Recent** — vertical list of recent clips, swipe to copy or delete, tap to view detail, long-press to tag
2. **Tags** — list of tags with colored chips; tap to filter recent
3. **Send** — quick text composer; share-sheet target for files/text
4. **Settings** — paired device info, unpair button, theme, notification preferences, battery optimization status

Notifications:
- On new desktop clip: silent notification with preview, tap to copy to phone clipboard
- On file received: regular notification with "Open" action
- Foreground service notification: low-priority, text reflects connection state ("Connected to parth-laptop" / "Looking for parth-laptop…")

### 7.6 Android clipboard limitations

Android 10+ restricts background clipboard reads.

- **Phone → desktop:** user-initiated only — share-sheet "Share to Clippy" or "Send current clipboard" button. No background polling.
- **Desktop → phone:** no restriction. Phone receives, notifies, user taps to copy.

The foreground service keeps the WebSocket alive while the app is backgrounded. Notification text mirrors connection state and is dismissible only via the system notification channel settings (KDE Connect convention).

### 7.7 Acceptance criteria for Phase 2

- [ ] QR pairing completes in under 10 seconds end-to-end
- [ ] Pairing data persists across reboots on both sides
- [ ] Battery-optimization exemption prompt appears on first launch after pairing
- [ ] Copying text on desktop appears as notification on phone within 1 second on same LAN
- [ ] Tapping the notification copies text to phone clipboard
- [ ] Using share-sheet "Share to Clippy" sends text/URL to desktop, where it appears in history
- [ ] Creating a tag on desktop appears on phone within 1 s; tagging a clip on either side reflects on the other
- [ ] If phone leaves WiFi and returns, sync resumes via `ConnectivityManager` callback in under 2 s with backfill
- [ ] Wireshark inspection of WebSocket traffic shows only encrypted bytes
- [ ] Unpair on either side cleanly disconnects and clears paired keys on both
- [ ] `SyncTransport` interface compiles with a second stub impl (`BluetoothTransport`) on both sides without changes to the dispatcher

---

## 8. Phase 3 — File transfer (week 3)

**Goal:** Send files up to 100 MB between desktop and phone over LAN.

### 8.1 HTTP file endpoint (desktop)

Embedded `axum` server on port 43118 (separate from WebSocket).

Endpoints:
- `POST /file/upload` — phone uploads; multipart; auth header `X-Clippy-Token: <one-time-token>`
- `GET /file/:token` — phone downloads; streams response
- Tokens are short-lived (60s) and one-shot (deleted after first successful transfer)
- TLS not required for v1 — file transfer tokens are issued over the encrypted WebSocket so attackers can't learn them passively

### 8.2 Desktop → phone file flow

1. User drags a file onto the Clippy panel, or pastes a file path that's now in clipboard
2. Desktop creates token, registers `(token, filepath, expires_at)` in memory
3. Desktop sends `FILE_OFFER {token, filename, size, mime}` via WebSocket
4. Phone receives, shows notification
5. User taps "Receive" — phone sends `FILE_REQUEST {token}` over WebSocket (for symmetry/logging)
6. Phone GETs `http://<desktop>:43118/file/:token`
7. Desktop streams file, deletes token after completion
8. Phone saves to `/storage/emulated/0/Download/Clippy/`

### 8.3 Phone → desktop file flow

1. User shares a file to Clippy via Android share-sheet
2. Phone requests token via WebSocket: `FILE_UPLOAD_REQUEST {filename, size}`
3. Desktop responds with `{token, url: "http://...:43118/file/upload"}`
4. Phone POSTs the file
5. Desktop saves to `~/Downloads/Clippy/` and adds an entry with type `file`

### 8.4 Constraints

- Reject files > 100 MB on both sides with clear error
- Show transfer progress in UI (both sides)
- Cancellable mid-transfer
- Resume not required for v1

### 8.5 Acceptance criteria for Phase 3

- [ ] Drag a 50 MB file on desktop panel → arrives on phone in under 15 sec
- [ ] Share-sheet from Android photo gallery → arrives on desktop, appears in history with file icon
- [ ] Files > 100 MB rejected with clear, non-cryptic error
- [ ] Cancelling mid-stream cleanly stops both sides, no orphaned tokens or partial files
- [ ] Tokens expire and cannot be reused

---

## 9. Security model

### Threat model

In scope:
- Passive eavesdropper on LAN cannot read clipboard contents
- Unpaired device on LAN cannot inject clipboard items or fetch files

Out of scope:
- Compromised endpoint resistance
- Forward secrecy
- Traffic-analysis resistance

### Crypto choices

- **Pairing:** QR code transmits a 32-byte PSK over the trusted air gap of the user's eyes
- **Identity:** Each device has an ed25519 keypair. Public keys exchanged during pairing
- **Message confidentiality + auth:** `crypto_secretbox` (XSalsa20 + Poly1305) with the PSK; fresh nonce per message
- **File endpoint:** 32-byte one-shot tokens issued over the encrypted WebSocket

### Key storage

- Desktop: `~/.local/share/clippy/keys.json`, mode 0600
- Android: `flutter_secure_storage` (Android Keystore)

---

## 10. Build, packaging, and dev setup

### Desktop

```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libsoup-3.0-dev \
                 libayatana-appindicator3-dev librsvg2-dev libxdo-dev

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install create-tauri-app
cargo install tauri-cli

cd desktop
npm install
cargo tauri dev
cargo tauri build
```

### GNOME extension

```bash
cd extension
npm install
npm run build
ln -s "$PWD/dist" "$HOME/.local/share/gnome-shell/extensions/clippy@parth"
# log out and back in, then:
gnome-extensions enable clippy@parth
gnome-extensions prefs clippy@parth
```

### Mobile

```bash
sudo snap install flutter --classic
flutter doctor

cd mobile
flutter pub get
flutter run
flutter build apk --release
```

### Distribution (personal use)

- Desktop: `.deb` for `apt install ./clippy_0.1.0_amd64.deb`
- Extension: ZIP bundle; install via `gnome-extensions install`
- Android: sideload signed APK

---

## 11. Open items / risks

1. **WebKit2GTK font + accent rendering on Wayland.** Fallback colors hard-coded in CSS to avoid GTK theme leakage.
2. **`clipboard-master` polling fallback may be flaky** on pure Wayland sessions. The GNOME extension is effectively required for non-degraded UX.
3. **Android foreground-service notification importance.** Must be IMPORTANCE_LOW (silent but visible) so users can mute via the channel without killing the service.
4. **Tag sync conflict resolution.** v1 uses last-write-wins by `created_at`. If both sides rename the same tag offline, the later write wins. Document this.
5. **Custom shell-command actions** open the door for users to run arbitrary commands. Guard with a confirmation dialog the first time a `shell_command` action is invoked on a new clip.
6. **Two settings surfaces** (extension prefs + app settings). Settle the boundary in code: extension prefs hold ONLY the extension's own settings; everything else is in the app.

---

## 12. Non-functional requirements

- **Performance:** UI must feel instant. Hotkey-to-panel-visible under 100ms. Card render for 500 items under 16ms (one frame at 60 Hz).
- **Memory:** desktop idle under 80 MB; with 500 items under 200 MB.
- **Battery (mobile):** background WebSocket under 2% battery per hour idle on WiFi.
- **Reliability:** sync auto-recovers from network changes within 10 seconds of network coming back.
- **Privacy:** no data leaves the LAN. No telemetry. The only outbound HTTP is the opt-in link-preview fetcher, which talks only to the URL's own domain.

---

## 13. Definition of done for v1

Clippy v1 ships when all Phase 1, 2, and 3 acceptance criteria pass, AND:

- README with install instructions on all three artifacts (app, extension, mobile)
- Single end-to-end test: install extension → pair → copy text on desktop → see on phone → reply with text on phone → see on desktop → drag file on desktop → receive on phone → tag a clip on desktop → see tag on phone
- The dev has used it for at least 7 days as their primary clipboard tool and not switched back to Pano/Copyous

---

## 14. Future ideas (post-v1)

- Multi-device sync (laptop + phone + tablet)
- Cloud relay for cross-network sync (self-hosted Pi or VPS)
- Cross-network via WireGuard / Tailscale integration
- Windows and macOS support
- Browser extension to push selections from browser context menu
- Snippets / clipboard templates with variable substitution
- AI assist: summarize long text on copy, OCR images on copy
- Quick-paste hotkeys (Ctrl+1..9 — deferred from v1)
- Open panel at mouse / text-cursor position — deferred from v1
- Public release via Flathub + Play Store
