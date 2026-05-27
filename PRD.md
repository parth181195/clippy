# Clippy — Product Requirements Document

> Originally drafted as "ClipMate"; finalized as **Clippy**. References to ClipMate in older notes mean Clippy.
> A cross-device clipboard manager + file-sharing tool for personal use.
> Desktop: Ubuntu (GNOME Wayland). Mobile: Android. Sync: LAN only.
> Inspired by [Paste](https://pasteapp.io/) (macOS), [Pano](https://github.com/oae/gnome-shell-pano) (GNOME, archived), and [Copyous](https://github.com/boerdereinar/copyous) (GNOME, Pano successor).

---

## 1. Overview

Clippy is a personal-use clipboard manager that:

1. Captures clipboard history on the desktop with a beautiful, Paste-style horizontal card UI.
2. Syncs **text-shaped clipboard items** (text, links, code, color, emoji) automatically to a paired Android phone over the local network. Auto-sync can be disabled per direction.
3. **For files and images**, the user explicitly chooses what to send via right-click → "Send to phone". Bidirectional, up to 100 MB, no cloud.

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
- Global hotkey to summon the clipboard panel (default `Ctrl+Shift+V`; user-rebindable)
- Search, **pin (always-on-top)**, **favorite (retain-across-pruning)**, app exclusion list, incognito mode, customizable per-type actions
- One-time pairing between desktop and Android via QR code (with paste-a-code fallback)
- **Automatic LAN sync of text-shaped clips** (text/link/code/color/emoji) when both devices are on the same network; can be toggled off per direction
- **Explicit file/image transfer** up to 100 MB, initiated by right-click → "Send to phone" or by Android share-sheet
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
| Desktop typography | **Geist** + **Geist Mono** (bundled WOFF2 in Tauri resources) | Locked design system; matches handoff |
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
│   │       │       └── file_transfer.rs
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
│   │   │   │   ├── HoverActions.svelte    # quick-action overlay on hover (fav/pin/delete/send)
│   │   │   │   ├── TransferCard.svelte    # in-progress transfer w/ circular progress
│   │   │   │   ├── FilterChip.svelte
│   │   │   │   ├── SearchBar.svelte
│   │   │   │   ├── ConnectionIndicator.svelte
│   │   │   │   ├── SettingsView.svelte     # rendered as a body-override of the Panel
│   │   │   │   ├── ActionsEditor.svelte
│   │   │   │   ├── EmptyState.svelte
│   │   │   │   └── PairingView.svelte      # also a body-override; QR + paste-code fallback
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
│   │   │   │       └── file_transfer.dart
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
- Hidden by default; appears on global hotkey (default `Ctrl+Shift+V`; user-rebindable to anything incl. Super-based chords)
- Window position: configurable (top/bottom/left/right), default bottom — matching Pano
- **Layout** is user-selectable in settings (see F13):
  - **Cards** (default) — horizontal-scrolling row of cards, ~200×240px (comfortable); 168×210 (compact); 232×244 (spacious)
  - **Spotlight** — selected clip rendered large on the left, scrollable thumbnail strip on the right; the large pane doubles as the view/edit surface (see F14)
  - **Sectioned** — vertical, time-grouped list (Pinned / Today / Yesterday / Earlier); three columns at desktop widths
  - **Mosaic** — cards sized to content type (wide for code/text, narrow for emoji/color)
- Card shows: preview, source app icon, type badge, **accent top stripe if pinned**, **filled star if favorited**, timestamp on hover
- Keyboard navigation (Pano + Copyous style):
  - Arrow keys move selection
  - Enter pastes (synthesises `Ctrl+V` to previously-focused app)
  - **Shift+Enter** synthesises `Ctrl+Shift+V` instead (for terminals)
  - **Ctrl+Enter** / **Ctrl+Click** on a `link` clip runs the link's default custom action (typically: open in browser)
  - Esc closes
  - **Tab / Shift+Tab** cycles type filter; **Backspace** on empty search clears the filter
  - **Delete** removes the focused item; **Shift+Delete** force-deletes a pinned/favorited item
  - **Ctrl+S** toggles favorite; **P** toggles pin
  - **E** opens the edit pane for the focused text-shaped clip (F14)
  - **Alt** toggles favorites-only view
  - Typing anywhere focuses the search bar
- Hover overlay (quick actions, top-right of card): Favorite, Pin, Edit (text-shaped clips), Delete; for **file/image clips only**, also a "Send to phone" action (see F16)
- Mouse: click to paste, right-click for context menu (Pin, Favorite, Edit, Delete, Copy raw, **Paste as…** submenu for multi-rep clips, **Send to phone** for file/image clips, custom actions for the type)

#### F3. Search
- Search bar at top of panel
- Filter as you type
- SQLite FTS5 for text content
- Image/file/color search by metadata

#### F4. Pin and Favorite (two separate axes, sharper split)
- **Pin** — **ephemeral** position discipline. Pinned clips always render first with an accent-colored top stripe. Toggled with `P` or right-click → Pin. **Pin does NOT protect from auto-pruning** — it's for in-flight task focus ("keep this at the top while I'm working"). Mental model: browser tab pin.
- **Favorite** — **permanent** retention discipline. Favorited clips show a filled star and are **never** auto-deleted, regardless of `history_size` limit. Toggled with `Ctrl+S` or right-click → Favorite. `Alt` toggles a favorites-only view. Mental model: browser bookmark.
- The two are orthogonal: a clip can be pinned, favorited, both, or neither. To keep something forever AND on top, the user pins AND favorites it.
- Auto-pruning query: `DELETE FROM clips WHERE is_favorite = 0 ORDER BY created_at ASC` until count ≤ `history_size`.

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
- **Hotkey customization** — every chord in F2 is rebindable (panel toggle, incognito, in-panel actions). Defaults are Ctrl-based; user can rebind to Super-based or anything else.
- **Layout** — Cards (default) / Spotlight / Sectioned / Mosaic
- **Density** — Compact / Comfortable (default) / Spacious
- **Accent colour** — one of five swatches (Coral default, Indigo, Teal, Violet, Bone) or custom hex
- Panel position (top/bottom/left/right)
- Theme: light/dark/auto
- History size limit (50–10,000)
- Polling interval (100–1000ms, advanced; only relevant when extension absent)
- Exclusion list management
- Custom actions editor
- Sound on copy: on/off
- Notifications: on/off
- Link previews: on/off
- Auto-sync text-shaped clips to phone: on/off (default ON, per direction)
- Clear history (with confirmation)

#### F12. Public D-Bus interfaces
- **`org.gnome.Shell.Extensions.Clippy`** (extension, GJS): `Toggle`, `Show`, `Hide`, `ClearHistory(bool all)`; signals `ClipboardChanged(mime, b64)`, `FocusedWindowChanged(app_id, title)`
- **`io.clippy.App`** (Tauri, Rust via `zbus`): `TogglePanel`, `OpenSettings`, `SearchHistory(query)`, `PasteByHash(hash)`, `RunActionByHash(hash, action_id)`, `OpenEditor(hash)`

#### F13. Layout picker
- All four layouts (Cards / Spotlight / Sectioned / Mosaic) live behind the same data + keybindings; only the render differs.
- Layout is per-user, persisted; chosen in Settings → General.
- Each layout supports both themes, all three densities, incognito, AND every panel state: **default / search / filter / empty**. Plus layout-specific states:
  - **Cards** — default horizontal scroller with edge-fade gradient on the right.
  - **Spotlight** — selected clip rendered large in left pane; supports a `link`-focused state (favicon + URL + title + og:image preview surface, integrated with F9 link previews) and the edit-mode state (F14) renders in this same focus pane.
  - **Sectioned** — vertical, time-grouped 3-column list. Search collapses to a single column with an accent-coloured `RESULTS · N MATCHES` header. Filter mode keeps the time-group structure but only within the filtered type.
  - **Mosaic** — cards sized to content. Filter mode promotes the first card wider (320px) and selected. Transfer-in-progress renders the `TransferCard` at the front of the row.
- Switching layout preserves search query, type filter, selection by `content_hash`, and scroll position (within layout norms).

#### F14. View + Edit pane (text-shaped clips only)
- Triggered by `E` keystroke on a focused clip, hover-overlay Edit button, or right-click → Edit.
- Eligible types: `text`, `link` (the URL string), `code`, `color` (the hex/rgb string), `emoji`. **Not** `image` or `file`.
- In the **Spotlight** layout, the edit pane renders inline in the left "focus" pane. In **Cards / Sectioned / Mosaic**, the edit pane slides in as a body-override modal over the panel (same overlay mechanism used by Settings / Pairing).
- The pane shows: type badge, source app + timestamp at top; an editable textarea (monospace for `code`, hex-validated for `color`); cancel + save buttons; "save and paste" primary action bound to `Ctrl+Enter`.
- **Save semantics** (non-destructive): saving creates a **new** clip with `source_app = 'Clippy (edited)'`, fresh `content_hash`, `created_at = now`. The original clip stays in history untouched. The new clip's `is_pinned`/`is_favorite` start at 0.
- **Paste from the edit pane** is the primary action: saves the new clip AND synthesises paste to the previously-focused app (or Ctrl+Shift+V in Shift mode for terminals).
- `Esc` cancels without saving.
- The edit pane is editor-only — no rich-text formatting, no syntax-highlighting input. Code edits render in mono; the badge keeps the `lang` label.

#### F15. Device naming
- During pairing, both desktop and phone prompt for a device name (defaults: hostname for desktop, `Build.MODEL` for phone). Names are stored in `paired_devices.name` and shown in the connection indicator, notifications, and the "Send to phone" affordances. User can rename later from Settings → Devices.

#### F16. Per-clip "Send to phone" (file/image only)
- Text-shaped clips sync automatically (F2 hover overlay does not show a Send button for them); the auto-sync toggle in F11 controls this.
- File and image clips do **not** auto-sync. The hover overlay on these cards shows a "Send to phone" button; right-click → "Send to phone" is the equivalent menu path. Selecting it generates a one-shot file token, sends a `FILE_OFFER`, and shows the transfer card with progress.

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
    is_favorite  INTEGER NOT NULL DEFAULT 0,  -- permanent retention (star); never auto-pruned
    is_pinned    INTEGER NOT NULL DEFAULT 0,  -- ephemeral position (top stripe); subject to pruning
    created_at   INTEGER NOT NULL,            -- unix epoch ms
    UNIQUE (content_hash)
);

CREATE INDEX idx_clips_created ON clips(created_at DESC);
-- Order for the panel: pinned first, then favorite, then recency
CREATE INDEX idx_clips_panel_order
    ON clips(is_pinned DESC, is_favorite DESC, created_at DESC);

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

### 6.3 UI requirements — design tokens (from handoff)

Locked design system from `clippy-handoff/` (Claude Design export). The Tauri frontend reproduces these pixel-for-pixel; nothing here is up for re-litigation during implementation.

**Typography**
- Family: `Geist` (sans) + `Geist Mono` (mono). Bundled as WOFF2 in Tauri resources; no Google Fonts fetch at runtime.
- Sizes: 10 (mono caption), 11 (body small), 11.5 (mono inline), 12 (label), 13 (body), 14 (heading 4), 15 (heading 3), 22 (heading 2).
- Use Geist Mono for: timestamps, URLs, hex/rgb, file sizes, kbd labels, anything tabular.

**Colours — Dark**
```
bg            #16161F   (with 0xD9 alpha when used as panel scrim)
bgSolid       #0E0E15
surface       #1F1F2A
surfaceRaised #2A2A38
surfaceSunken #15151C
borderSubtle  #2D2D3A
borderStrong  #3A3A4A
text          #ECECF1
textSecondary #9999A8
textTertiary  #5C5C6B
warn          #A55C5C   (incognito border + indicator)
```

**Colours — Light**
```
bg            #F5F5FA   (with 0xE0 alpha as panel scrim)
bgSolid       #EFEFF4
surface       #FFFFFF
surfaceRaised #F0F0F5
surfaceSunken #ECECF1
borderSubtle  #E5E5EC
borderStrong  #D5D5DE
text          #1A1A24
textSecondary #5C5C6B
textTertiary  #9999A8
warn          #B86A6A
```

**Accent swatches** (default Coral; user-selectable in Settings)
- Coral `#E95678` (default) · Indigo `#7C7CFF` · Teal `#5BC0BE` · Violet `#C792EA` · Bone `#ECECF1` · custom hex

**Type-badge palette** — content-type chips with per-type bg/fg pairs (dark + light variants). Exact values: see `clippy-handoff/clippy/project/src/tokens.jsx` `CM_TOKENS.badges`. The `color` badge is special — its bg uses the clip's hex, fg is white.

**Geometry**
- Panel: 1280×340 typical, `border-radius: 20px`, `border: 1px solid borderSubtle` (or 2px `warn` in incognito).
- Backdrop: `backdrop-filter: blur(24px) saturate(140%)`.
- Header: 48px high, 16px horizontal padding, search bar + filter chips + (incognito badge?) + settings gear.
- Footer: 28px high, 20px horizontal padding, "N items · connection · ↵ paste · ⌫ delete · ⌘F search".
- Card border-radius: 14px (corner radii were 16px in the original PRD; design uses 14px — design wins).
- Card dimensions (W × H): compact 168×210, comfortable 200×240 (default), spacious 232×244.
- Card padding: compact 10, comfortable 12, spacious 16. Gap between cards: 9 (compact) / 12 (comfortable+spacious).
- Pinned top stripe: 2px tall, accent colour, inset 14px from card sides.
- Type badge: 3×7 padding, 6px radius, font 10/600 uppercase, 0.4px letter-spacing.

**Motion**
- Hover lift: `translateY(-2px)` + accent border at `${accent}55` opacity. (Original PRD said -4px; design uses -2px.)
- Pressed: `scale(0.97)`.
- Selected: solid accent border (no opacity).
- Default transition: `150ms cubic-bezier(.2, .9, .3, 1)` for transform/background/border-color. (PRD said 200ms; design uses 150ms.)
- Panel open: slide up from bottom, 250ms.
- Spinner: 0.9s linear infinite rotation on connection indicator.

**Chrome**
- Settings open as a **body-override** of the panel itself, not a separate window. Same for Pairing, Empty states, Incognito mode placeholder.
- No hamburger menus. Settings gear in panel header, top-right.
- Edge-fade gradient at the right edge of the horizontal card scroller (60px fade to panel scrim).

**Connection indicator** (footer; four states)
- `connected` — phone-icon + "paired with {device}" + accent zap icon
- `connecting` — spinner + "Connecting to {device}…"
- `disconnected` — wifi-off + "{device} (offline)"
- `unpaired` — phone-icon + "No device paired" + accent "Pair phone →" link

### 6.4 Acceptance criteria for Phase 1

- [ ] Copying text anywhere stores it; appears at the top of the panel
- [ ] Copying an image renders as thumbnail; primary content preserved in original format with mime
- [ ] HTML+plain text copy from a browser stores both reps; "Paste as…" submenu offers both
- [ ] Copying a URL gets a `link` badge; rich preview appears within 3 s when previews enabled
- [ ] Global hotkey opens/closes panel from any focused app; user can rebind it from settings
- [ ] Enter pastes via Ctrl+V; Shift+Enter pastes via Ctrl+Shift+V (verify in a terminal)
- [ ] Tab/Shift+Tab cycle the type filter; Backspace clears it
- [ ] Delete removes; Shift+Delete force-deletes pinned/favorited items; `Ctrl+S` toggles favorite; `P` toggles pin; Alt toggles favorites-only
- [ ] `Ctrl+Enter` on a `link` clip opens it in the default browser
- [ ] Pin draws the accent top stripe AND moves the clip to the front of any layout's ordering; un-pinning restores chronological position; both `is_pinned` and `is_favorite` survive a restart
- [ ] When history exceeds `history_size`, **favorited** clips are never pruned; **pinned-but-not-favorited** clips ARE pruned (verified by pinning a clip, then filling history past the limit, and observing the pinned clip vanish)
- [ ] `E` opens the edit pane for a text/link/code/color/emoji clip; pressing `Ctrl+Enter` in the pane saves a new clip with `source_app = 'Clippy (edited)'` AND pastes it; the original is untouched
- [ ] Edit pane refuses to open on `image` and `file` clips
- [ ] Switching layout (Cards → Spotlight → Sectioned → Mosaic) in settings re-renders with the same selection state and search query; no state loss
- [ ] In Spotlight layout, focusing a clip auto-renders it in the focus pane; pressing `E` upgrades that pane to edit mode in-place
- [ ] Spotlight + `link` clip focused: the focus pane shows favicon, URL, title, and OG image (when link-previews enabled) or a tasteful placeholder when not
- [ ] Sectioned + active search: results render as a single column with `RESULTS · N MATCHES` header in accent colour; empty matches shows "— none —"
- [ ] Mosaic + active file transfer: TransferCard renders at the front of the row, doesn't disrupt the other cards' sizing
- [ ] Each layout × each state (default / search / filter / empty) renders without overflow/visual regression in both dark and light at 1280×340
- [ ] Search filters live with <50ms latency at 500 items
- [ ] Incognito mode prevents capture; auto-disables after 5 min
- [ ] App in exclusion list (try `keepassxc`) does not get captured (when the GNOME extension is running)
- [ ] Sound plays on every capture; muting in settings silences it
- [ ] Notifications appear when enabled and only when enabled
- [ ] Link-preview fetcher respects 3 s timeout, refuses private IPs, caches failure
- [ ] App memory under 80 MB idle, under 200 MB with 500 items loaded
- [ ] App starts in under 1 second on a modest laptop
- [ ] Settings persist across restarts
- [ ] `org.gnome.Shell.Extensions.Clippy.Toggle` and `io.clippy.App.TogglePanel` both work via `busctl`
- [ ] Panel renders with Geist/Geist Mono and the exact tokens from §6.3 in both dark and light modes

---

## 7. Phase 2 — Android app + LAN sync (week 2)

**Goal:** Phone mirrors text-shaped clips from the desktop in real time. Desktop mirrors text-shaped clips from the phone (when the user explicitly sends them via the Send composer or share-sheet). Files and images are NEVER auto-synced — they always require an explicit user action (see Phase 3).

### 7.1 Pairing flow

1. User opens "Add Device" in desktop settings; desktop prompts for a **device name** (defaults to hostname; e.g. "Helios").
2. Desktop generates:
   - 32-byte ed25519 keypair (device identity)
   - 32-byte symmetric key (`secretbox`)
   - Reads its LAN IPs (skip loopback; prefer 192.168.x / 10.x / 172.16.x)
3. Desktop displays QR code encoding:
   ```json
   {
     "v": 1,
     "device_id": "clippy-desktop-abc123",
     "name": "Helios",
     "host": "192.168.1.42",
     "port": 43117,
     "psk": "base64(32-byte-symmetric-key)",
     "pubkey": "base64(ed25519-public)"
   }
   ```
   Below the QR, a "Use pairing code instead" link shows a 6-word BIP39-style code derived from the same payload — for situations where the camera won't focus or the QR is partially occluded.
4. Phone opens "Pair with Desktop", scans QR (or taps "Enter code instead").
5. Phone prompts for its own **device name** (defaults to `Build.MODEL`; e.g. "Pixel 7").
6. Phone stores config in `flutter_secure_storage`.
7. Phone connects to WebSocket, sends `HELLO` message signed with its own ed25519 key.
8. Desktop verifies, stores phone's pubkey + name in `paired_devices`.
9. Pairing complete; both sides show "Paired with [device name]" + accent zap icon.
10. Phone prompts user for **battery-optimization exemption** (KDE Connect convention).

### 7.2 Sync protocol

Transport: WebSocket. All payloads JSON, encrypted with `crypto_secretbox` using PSK, base64-encoded.

Message envelope (before encryption):
```json
{ "type": "...", "id": "uuid-v4", "ts": 1735000000000, "plugin": "clipboard|file_transfer|core", "payload": { ... } }
```

| Type | Plugin | Direction | Payload | Purpose |
|---|---|---|---|---|
| `HELLO` | core | bidir | `{device_id, name, version}` | Initial handshake; carries device name |
| `ACK` | core | bidir | `{ref_id}` | Confirm receipt |
| `CLIP_NEW` | clipboard | bidir | `{kind, mime, preview, hash, content_inline?, reps?}` | Notify other side of a new **text-shaped** clip (auto-sync) |
| `CLIP_REQUEST` | clipboard | bidir | `{hash}` | Request full content if not inlined |
| `CLIP_LIST` | clipboard | bidir | `{since_ts, items: [...]}` | Initial sync after reconnect |
| `FILE_OFFER` | file_transfer | bidir | `{token, filename, size, mime}` | A file is available (issued only on explicit user send / share-sheet) |
| `FILE_REQUEST` | file_transfer | bidir | `{token}` | Acknowledge intent to download |
| `FILE_UPLOAD_REQUEST` | file_transfer | phone→desktop | `{filename, size}` | Phone wants to upload (share-sheet) |
| `FILE_PROGRESS` | file_transfer | bidir | `{token, bytes, total}` | In-progress transfer tick (drives the progress arc) |

**What gets auto-synced via `CLIP_NEW`:**
- Content types `text`, `link`, `code`, `color`, `emoji`. Always.
- Subject to the per-direction "Auto-sync text-shaped clips" setting (F11).
- `image` and `file` are **never** carried by `CLIP_NEW`; they only travel via `FILE_OFFER` after the user invokes Send.

**Inline vs request rule (text-shaped only):**
- Single representation under 4 KB: inline in `CLIP_NEW.content_inline`
- Multi-representations under 8 KB total: inline in `reps`
- Larger text/code clips: send hash only; recipient pulls with `CLIP_REQUEST`

### 7.3 Pluggable architecture

On both sides:

- **`SyncTransport`** trait/interface: `connect(addr)`, `send(envelope)`, `on_message(handler)`, `close()`. v1 has only `LanWebSocketTransport`; a stub `BluetoothTransport` documents the interface for later.
- **`SyncPlugin`** trait/interface: `name() -> str`, `handle(envelope)`. v1 ships `ClipboardPlugin` (auto-sync of text-shaped clips) and `FileTransferPlugin` (explicit file/image sends). The dispatcher routes envelopes by `plugin` field.

### 7.4 Discovery and reconnection

- Desktop advertises mDNS service: `_clippy._tcp.local` with TXT `device_id`, `version`
- Phone browses mDNS when foregrounded; falls back to last-known IP if no result in 3 s
- On disconnect, exponential backoff: 1s, 2s, 4s, 8s, max 30s
- **`ConnectivityManager` listener** on Android triggers immediate reconnect on WiFi/AP change (sub-second), bypassing the backoff
- On reconnect, phone sends `CLIP_LIST` with `since_ts` to backfill missed text-shaped clips. In-flight file transfers from before disconnect are NOT resumed; the user re-initiates.

### 7.5 Android UI

Bottom-nav with **three tabs** (matches handoff):

1. **Recent** — vertical list of synced text-shaped clips. Each row shows: type-preview block + type badge + filled star if favorited, 2-line preview, source-app icon, timestamp. **Swipe right → copy to clipboard**; **swipe left → delete**. Tap opens detail. Long-press toggles favorite. Day headers ("Today", "Yesterday") group the list.
2. **Send** — top: composer for typing/pasting text to push to the desktop; below: "Recent transfers" list of file transfers (in-progress with progress bar; completed with Resend button). Share-sheet target for files lands here and triggers the upload flow.
3. **Settings** — Device card (paired device's name, OS, last-sync) with connected dot; sections: Sync (Auto-copy incoming clips to phone clipboard; Notifications), Appearance (Theme).

A **connection chip** sits at the top of Recent: `● synced with Helios · 2s ago` (accent dot when connected; muted when disconnected; "Tap to pair" when unpaired).

**Pairing screen** is a full-screen camera view with a 220×220 viewfinder, accent-coloured border, white corner markers, and "Point your phone at the QR code…" caption. A "Enter code instead" pill at the bottom triggers a manual-entry sheet. On success, the viewfinder fills with accent + checkmark.

**Notifications (deliberately quiet for text):**
- **Text-shaped clips arriving from the desktop: NO per-clip notification.** They appear silently in the Recent list (and in the phone's clipboard if the user has flipped "Auto-copy to clipboard" on). The same applies to edited clips (`source_app = 'Clippy (edited)'`) — they're text-shaped, so silent.
- **File arrivals: notification.** "{filename} received · {size} · from {device_name}" with **Open** and **Share** actions, standard importance.
- **Foreground-service notification (always present):** low-priority "Listening for clips from {device_name}" / "Looking for {device_name}…" / "Disconnected" depending on state. This is the service indicator, not a per-clip notification — dismissible only via notification-channel settings (KDE Connect convention). Tapping it opens the app.
- A small **toast inside the app** (not a system notification) flashes "Synced {N} clips" when the user opens the app after a backfill, so they know what arrived while they were away.

The same policy applies on the desktop (no toast on every incoming clip from phone — only on incoming files). Both directions are intentionally quiet for text.

### 7.6 Android clipboard limitations

Android 10+ restricts background clipboard reads.

- **Phone → desktop (text-shaped):** strictly user-initiated. Either the Send composer (user types/pastes, taps Send) or the "Share to Clippy" share-sheet target. **No background clipboard polling**, ever.
- **Desktop → phone (text-shaped, auto-sync):** delivered **silently** into the Recent list. No per-clip notification. The user opens the app to see what arrived. There's an opt-in setting ("Auto-copy to clipboard") that, when enabled, also writes the latest arriving text-shaped clip directly into the phone's clipboard so it's pasteable in the next app without opening Clippy.
- **File transfers (both directions):** never automatic. Phone → desktop via share-sheet; desktop → phone via right-click → "Send to phone" or hover-overlay button on a `file`/`image` card.

The foreground service keeps the WebSocket alive while the app is backgrounded. Notification text mirrors connection state (per the connection-state model in §6.3).

### 7.7 Acceptance criteria for Phase 2

- [ ] QR pairing completes in under 10 seconds end-to-end; "Enter code instead" fallback also succeeds
- [ ] Device names entered during pairing show up in connection indicator (desktop) and notification text (phone)
- [ ] Pairing data persists across reboots on both sides
- [ ] Battery-optimization exemption prompt appears on first launch after pairing
- [ ] Copying text/link/code/color/emoji on desktop appears in the phone's Recent list within 1 second on same LAN, with **no system notification raised** (verified by checking notification shade is empty after the copy)
- [ ] With "Auto-copy to clipboard" enabled in phone settings, the arriving text is also written to the phone's clipboard within 1 s, ready to paste in the next app
- [ ] Using share-sheet "Share to Clippy" sends text/URL to desktop, where it appears in history (no desktop notification — just appears at top of panel)
- [ ] Sending a text via the Send composer on phone appears on desktop within 1 second
- [ ] **Receiving a file** raises a standard-importance notification with Open + Share actions; receiving text raises **none**
- [ ] Opening the phone app after a backfill flashes an in-app toast "Synced N clips" so the user knows what arrived silently
- [ ] Copying a **file** on the desktop does NOT auto-sync; the clip appears locally only until the user invokes Send (per §8.5 invariant)
- [ ] If phone leaves WiFi and returns, sync resumes via `ConnectivityManager` callback in under 2 s with backfill via `CLIP_LIST since_ts`
- [ ] Connection indicator on desktop and connection chip on phone reflect all four states (connected / connecting / disconnected / unpaired) within 1 s of state change
- [ ] Wireshark inspection of WebSocket traffic shows only encrypted bytes
- [ ] Unpair on either side cleanly disconnects and clears paired keys on both
- [ ] `SyncTransport` interface compiles with a second stub impl (`BluetoothTransport`) on both sides without changes to the dispatcher
- [ ] Toggling "Auto-sync text-shaped clips" off on either side stops `CLIP_NEW` traffic in that direction within the next captured clip

---

## 8. Phase 3 — File transfer (week 3)

**Goal:** Send files and images up to 100 MB between desktop and phone over LAN, always on explicit user trigger.

### 8.1 HTTP file endpoint (desktop)

Embedded `axum` server on port 43118 (separate from WebSocket).

Endpoints:
- `POST /file/upload` — phone uploads; multipart; auth header `X-Clippy-Token: <one-time-token>`
- `GET /file/:token` — phone downloads; streams response
- Tokens are short-lived (60s) and one-shot (deleted after first successful transfer)
- TLS not required for v1 — file transfer tokens are issued over the encrypted WebSocket so attackers can't learn them passively

### 8.2 Desktop → phone file flow

Trigger paths (any of):
- Right-click on a `file` or `image` clip card → "Send to phone"
- Hover-overlay phone-icon button on a `file`/`image` clip
- Drag a file onto the Clippy panel — equivalent to right-click → Send

Then:

1. Desktop creates token, registers `(token, filepath, expires_at)` in memory.
2. Desktop sends `FILE_OFFER {token, filename, size, mime}` via WebSocket.
3. The card morphs into a **transfer card** (circular progress arc + ETA + speed) — see §6.3 motion.
4. Phone receives, shows notification "File offered — {filename} ({size})".
5. User taps "Receive" — phone sends `FILE_REQUEST {token}` over WebSocket (for symmetry/logging).
6. Phone GETs `http://<desktop>:43118/file/:token`.
7. Both sides emit periodic `FILE_PROGRESS {token, bytes, total}` for UI progress.
8. Desktop streams file, deletes token after completion.
9. Phone saves to `/storage/emulated/0/Download/Clippy/`.

### 8.3 Phone → desktop file flow

1. User shares a file to Clippy via Android share-sheet (or picks files in the Send tab).
2. Phone requests token via WebSocket: `FILE_UPLOAD_REQUEST {filename, size}`.
3. Desktop responds with `{token, url: "http://...:43118/file/upload"}`.
4. Phone POSTs the file with the token in `X-Clippy-Token`.
5. `FILE_PROGRESS` ticks update both UIs.
6. Desktop saves to `~/Downloads/Clippy/` and adds an entry with type `file`. The new clip appears at the top of the panel.

### 8.4 Constraints

- Reject files > 100 MB on both sides with clear error
- Show transfer progress in UI (both sides) — circular arc card (desktop), linear bar in row (mobile)
- Cancellable mid-transfer from either side; cancellation propagates via a `FILE_CANCEL {token}` envelope
- Resume not required for v1
- The transfer card stays in the panel until dismissed or replaced (no auto-collapse), and clicking it shows the destination path on completion

### 8.5 Acceptance criteria for Phase 3

- [ ] Right-click a `file` clip → "Send to phone" → arrives on phone in under 15 sec for a 50 MB file
- [ ] Hover-overlay phone button on an `image` clip → arrives on phone, opens with default viewer
- [ ] Drag a 50 MB file onto the Clippy panel → equivalent flow
- [ ] No `image`/`file` clip ever crosses the wire without an explicit user gesture (verify by watching `FILE_OFFER` traffic during a 5-minute idle window where the user copies several files into the local clipboard — count must remain 0)
- [ ] Share-sheet from Android photo gallery → arrives on desktop, appears in history with file icon
- [ ] Files > 100 MB rejected with clear, non-cryptic error
- [ ] Cancelling mid-stream from either side cleanly stops both, no orphaned tokens or partial files
- [ ] Tokens expire and cannot be reused
- [ ] Transfer card renders the circular progress arc with live percentage and "X.X MB/s · Ys left"

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

1. **WebKit2GTK font + accent rendering on Wayland.** Geist is bundled as WOFF2 in Tauri resources so we don't depend on system fonts; fallback color palette is hard-coded.
2. **`clipboard-master` polling fallback may be flaky** on pure Wayland sessions. The GNOME extension is effectively required for non-degraded UX.
3. **Android foreground-service notification importance.** Must be IMPORTANCE_LOW (silent but visible) so users can mute via the channel without killing the service.
4. **Custom shell-command actions** open the door for users to run arbitrary commands. Guard with a confirmation dialog the first time a `shell_command` action is invoked on a new clip.
5. **Two settings surfaces** (extension prefs + app settings). Settle the boundary in code: extension prefs hold ONLY the extension's own settings; everything else is in the app.
6. **Edited clips and round-trip on the phone.** When a user edits a text clip on the desktop, the resulting "Clippy (edited)" clip auto-syncs to the phone silently (per the no-notification-on-text-clips policy). Render a Clippy logo as the source-app icon for the sentinel `source_app = 'Clippy (edited)'`, on both desktop and phone.
7. **Layout switching state preservation.** Search query, selected clip, scroll position, and filter must survive a layout change. Verify in tests.

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
- Single end-to-end test: install extension → pair (with QR) → name both devices → copy text on desktop → see notification on phone → reply via Send composer on phone → see on desktop → right-click an image clip → "Send to phone" → arrives → edit a text clip on desktop → confirm new clip created with `source_app = 'Clippy (edited)'` → switch layout to Spotlight in settings → confirm selection state preserved
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
- Tags (Copyous-style 9 colored groups) — deferred from v1 in favour of Pin + Favorite for the visual axis
- Quick-paste hotkeys (Ctrl+1..9 — deferred from v1)
- Open panel at mouse / text-cursor position — deferred from v1
- Public release via Flathub + Play Store
