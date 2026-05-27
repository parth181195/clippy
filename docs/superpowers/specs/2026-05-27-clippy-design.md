# Clippy — Design Spec

| | |
|---|---|
| **Status** | Draft, pending review |
| **Owner** | Parth |
| **Date** | 2026-05-27 |
| **Source PRD** | [/PRD.md](../../../PRD.md) |
| **Design handoff** | [/clippy-handoff/](../../../clippy-handoff/) (Claude Design export, two revisions) |

This spec is the buildable engineering reference for Clippy v1. It assumes the PRD as context. Where the two disagree, this spec wins for engineering decisions and the PRD wins for product intent.

---

## 1. What we're building

A LAN-only, peer-to-peer clipboard manager and small-file sharer for one user with one Ubuntu (GNOME Wayland) desktop and one Android phone. Inspired by Paste, Pano, and Copyous; positioned to replace the user's current Pano usage by combining Pano-quality UX with KDE-Connect-style cross-device sync.

Three phases, all bundled in this one spec:

| Phase | Deliverable | Independently usable? |
|---|---|---|
| **1** | Desktop standalone app + GNOME extension | Yes — a complete local clipboard manager in all four layouts |
| **2** | Android app, mDNS, encrypted WebSocket, auto-sync of text-shaped clips | Yes — pair + see typed-content mirror on phone |
| **3** | File transfer (HTTP file endpoint, share-sheet target, explicit Send) | Yes — full v1 |

---

## 2. System shape

Four components, not three:

```
┌──────────────────────────────────────┐    ┌────────────────────────────┐
│  Clippy desktop (Tauri 2.x)          │    │  Clippy GNOME extension    │
│  • Svelte 5 + TS UI                  │◀──▶│  (GJS / TypeScript)        │
│  • Rust core (rusqlite, axum,        │D-B │  • Clipboard listener      │
│    tokio-tungstenite, mdns-sd,       │ us │  • Focused-window signal   │
│    sodiumoxide, rodio)               │    │  • Toggle/Show/Hide/Clear  │
└──────────────────┬───────────────────┘    └────────────────────────────┘
                   │
        LAN (encrypted secretbox over WebSocket)
                   ▼
       ┌───────────────────┐    ┌────────────────────────────────────┐
       │  Clippy mobile    │    │  Shared sync architecture (both    │
       │  (Flutter 3.x)    │◀──▶│  sides):                           │
       │  • Foreground svc │    │  • SyncTransport interface         │
       │  • Battery exempt │    │    └─ LanWebSocketTransport (v1)   │
       │  • ConnectivityMgr│    │    └─ BluetoothTransport (stub)    │
       │    listener       │    │  • SyncPlugin interface            │
       │                   │    │    └─ ClipboardPlugin (auto, text) │
       └───────────────────┘    │    └─ FileTransferPlugin (explicit)│
                                └────────────────────────────────────┘
```

**Why four:** Wayland clipboard + focused-window detection has no good cross-app API. A GNOME shell extension is the only reliable source. Treating it as a sibling artifact (not internal to Tauri) lets the Tauri app subscribe via D-Bus and fall back to polling when the extension is absent.

---

## 3. Key design decisions (and why)

Each row resolves an item that was either open in the original PRD section 12 or surfaced during brainstorming + design ingest.

| # | Decision | Why |
|---|---|---|
| D1 | **GNOME extension ships in Phase 1** (was Phase 4) | Polling fallback is the fallback. The extension is the primary clipboard + focused-window source. Pulling it forward makes F1 (capture) and F6 (exclusion list) actually work well on Wayland from day one. |
| D2 | **Image storage = original bytes + `mime` + separate PNG thumbnail** | Original preserved for round-trip fidelity (no JPEG re-encode artefacts); thumbnail kept in a sibling table so list views don't pay the BLOB scan. |
| D3 | **Code detection = source-app first, content heuristic fallback** | Source-app (via the extension's `FocusedWindowChanged`) gives high-confidence tagging for clips from IDEs/terminals. Heuristic catches the rest. Cheaper and more accurate than ML. |
| D4 | **Store every clipboard representation** | Browsers and doc editors put `text/html` + `text/plain`; preserve both so "Paste as plain" / "Paste as HTML" actually works. Card preview uses `text/plain`. |
| D5 | **Pin and Favorite are two orthogonal axes with split semantics** (from design handoff + second-pass) | **Pin** = **ephemeral** position discipline. Accent top stripe, always-first ordering, `P` key. Subject to auto-pruning. Mental model: browser tab pin (transient, task-scoped). **Favorite** = **permanent** retention discipline. Star icon, `Ctrl+S`. **Never auto-pruned.** Mental model: browser bookmark. To keep something forever AND on top, the user pins AND favorites. Tags were considered but deferred — these two axes plus type filters cover the same use cases visually without the schema/sync burden. |
| D6 | **Customizable per-type actions** | Generalises the link-open-in-browser affordance. Per-device preference; does NOT sync. Pre-seeded so the user gets sensible defaults without configuring anything. |
| D7 | **Pluggable transports + plugins (KDE Connect style)** | `SyncTransport` and `SyncPlugin` interfaces on both sides. Only one transport ships (`LanWebSocketTransport`); the interface exists so adding Bluetooth/USB later is a slot-in, not a rewrite. v1 plugins: `ClipboardPlugin` and `FileTransferPlugin`. (TagsPlugin dropped with the tags decision.) |
| D8 | **Android: foreground service + battery exemption + ConnectivityManager** | Matches KDE Connect's reliability. Low-priority persistent notification shows live connection state. First-run prompts for battery whitelist. WiFi changes trigger immediate reconnect, not waiting for backoff. |
| D9 | **Sound on copy, single sound, ON by default** | Pano/Copyous ship it; user wants it. Single short bundled OGG via `rodio` (cross-distro) or `gsound` (where present). Settings toggle. |
| D10 | **Two D-Bus interfaces** | `org.gnome.Shell.Extensions.Clippy` (extension, Copyous-style namespace) exposes shell ops + signals. `io.clippy.App` (Tauri app) exposes panel/history ops for CLI scripting. |
| D11 | **Settings split** | Extension prefs (via `gnome-extensions prefs`) hold extension-only settings (signal verbosity, fallback toggle). Everything else lives in the app's Svelte settings panel. Documented boundary prevents drift. |
| D12 | **Rich link previews are opt-in** | They're the only outbound HTTP. Opt-in respects "no data leaves your network"; opt-out preserves Pano-quality link cards for users who want them. Fetcher refuses private IPs / localhost, hard 3 s timeout, single-shot per URL. Spotlight layout renders the OG image inline in its focus pane. |
| D13 | **Sync model split: text auto and silent; files explicit and notified** (from user direction + second-pass) | `text/link/code/color/emoji` auto-sync via `CLIP_NEW` and arrive **silently** on the other side (no notification — they just appear in the panel/Recent list). Per-direction toggle to disable. `image/file` NEVER cross the wire without an explicit user gesture (right-click "Send to phone", hover-overlay phone button, or drag onto the panel); arriving files DO raise notifications with Open/Share actions. Edited clips (D15) are text-shaped → silent. Foreground-service notification on Android remains (it's the service indicator, not per-clip). |
| D14 | **Four user-selectable layouts** (from design handoff) | Cards (default horizontal scroller), Spotlight (focused clip + thumbnails), Sectioned (vertical time-grouped 3-column), Mosaic (cards sized to content). Each handles every panel state (default/search/filter/empty) plus layout-specific states (Spotlight's link-focused, Mosaic's transfer-in-progress). One data model, four renderers. |
| D15 | **View + Edit pane for text-shaped clips** (from user direction) | `E` opens an edit pane on any `text/link/code/color/emoji` clip. Save creates a **new** clip with `source_app = 'Clippy (edited)'`; original preserved. `Ctrl+Enter` saves AND pastes. In Spotlight, edit renders in the focus pane; in other layouts, it's a body-override modal. |
| D16 | **Locked design tokens** (from design handoff) | Geist + Geist Mono fonts (bundled as WOFF2); precise dark/light colour palettes; coral default accent + 4 user-selectable swatches; 3 densities (compact/comfortable/spacious); specific card and panel geometry; 150 ms transition timing; backdrop-blur 24px + saturate 140%. PRD §6.3 has the exact values. |
| D17 | **Device naming during pairing** (from design handoff) | Both desktop and phone prompt for a device name at pairing (defaults: hostname / `Build.MODEL`). Name shows up in connection indicator, notifications, "Send to {name}" buttons. Renameable later from Settings → Devices. |
| D18 | **Hotkey defaults Ctrl-based; everything rebindable** (from user direction) | PRD's `Ctrl+Shift+V` opens the panel. Every chord (panel, incognito, in-panel ops) is rebindable in Settings. The design handoff happens to use Super-based shortcuts; that's a valid rebind, not the default. |

### Deliberately deferred (will NOT ship in v1)

- **Tags (Copyous 9-colored groups)** — Pin + Favorite + type filters cover the organization need.
- **Ctrl+1..9 quick-paste hotkeys** — useful, not promoted.
- **Open panel at mouse / text-cursor position** — Copyous-only, pleasant but cosmetic.
- **Multiple paired phones** — single-pair only in v1; the schema supports more rows in `paired_devices` so adding it later is non-breaking.
- **Forward secrecy / traffic-analysis resistance** — out of threat model.
- **Resumable file transfer** — 100 MB on LAN is fast enough; complexity not worth it.

---

## 4. Data model

Full final schema is in [PRD.md §6.2](../../../PRD.md). Summary of tables and their roles:

| Table | Role | Phase |
|---|---|---|
| `clips` | Primary clip record (one row per dedup'd capture); carries `is_pinned` + `is_favorite` | 1 |
| `clip_representations` | Additional mime reps for the same clip | 1 |
| `clip_thumbnails` | Decoded PNG thumbnail, separate to avoid scan cost | 1 |
| `clips_fts` | FTS5 virtual table over `preview` | 1 |
| `clip_actions` | User-defined per-type actions | 1 |
| `link_previews` | Cached OG/favicon for `link` clips | 1 |
| `settings` | KV store for app settings | 1 |
| `excluded_apps` | App ids that suppress capture | 1 |
| `paired_devices` | Phone(s) pubkey + PSK + identity + name | 2 |

`content_hash` is the cross-device clip identity. It's a SHA-256 of the primary representation, so the same text/image hashed identically on both sides. Sync messages reference clips by `content_hash`, not by local `id`.

Edited clips (D15) get a **new** row with a fresh `content_hash` (computed from edited content) and `source_app = 'Clippy (edited)'`. They auto-sync to the phone like any text-shaped clip.

---

## 5. Sync protocol

Full message catalog in [PRD.md §7.2](../../../PRD.md). Two protocol invariants worth restating because they shape the code:

- **All payloads encrypted with `crypto_secretbox` (PSK) before transport.** The WebSocket carries opaque base64 frames; the JSON envelope only exists post-decrypt. No exceptions, including `HELLO`.
- **Envelopes carry a `plugin` field.** The dispatcher routes by `plugin`, not by `type`. Adding a future plugin is a slot-in.

```
nonce           = randombytes(24)                      # crypto_secretbox nonce, fresh per message
ciphertext      = secretbox(psk, nonce, utf8(json(envelope)))
ws_frame_text   = base64(nonce || ciphertext)          # sent as a WebSocket text frame
```

The receiver splits the first 24 bytes as nonce and feeds the rest to `secretbox_open`. There is no plaintext header — message framing is the WebSocket frame itself.

### What gets auto-synced

| Content type | Auto-sync? | Channel |
|---|---|---|
| `text`, `link`, `code`, `color`, `emoji` | Yes (default; per-direction setting can disable) | `CLIP_NEW` |
| `image`, `file` | **No** — explicit user gesture only | `FILE_OFFER` after user invokes Send |

### Inline-vs-request rule (text-shaped only)

| Payload kind | Where it goes |
|---|---|
| Single representation under 4 KB | Inline in `CLIP_NEW.content_inline` |
| Multi-representations under 8 KB total | Inline in `CLIP_NEW.reps` |
| Anything larger | Hash only; receiver pulls with `CLIP_REQUEST` |

---

## 6. Repo structure

Final layout in [PRD.md §5](../../../PRD.md). The new directories vs the original PRD:

- `extension/` — GNOME shell extension
- `desktop/src-tauri/src/clipboard/` — split into `source_extension.rs` + `source_polling.rs` + `detect.rs`
- `desktop/src-tauri/src/sync/transport/` and `desktop/src-tauri/src/sync/plugins/` — pluggable architecture (D7)
- `desktop/src-tauri/src/dbus_app.rs` — the `io.clippy.App` interface (D10)
- `desktop/src-tauri/src/actions.rs`, `notifications.rs`, `sound.rs`, `link_preview.rs`
- `desktop/assets/sounds/copy.ogg` — bundled sound asset
- `desktop/assets/fonts/Geist*.woff2`, `GeistMono*.woff2` — bundled fonts (D16)
- Svelte components: `ClipCard`, `HoverActions`, `TransferCard`, `FilterChip`, `SearchBar`, `ConnectionIndicator`, `SettingsView`, `ActionsEditor`, `EmptyState`, `PairingView`, plus a layout container (`PanelLayout.svelte`) that switches between `LayoutCards`, `LayoutSpotlight`, `LayoutSectioned`, `LayoutMosaic` subcomponents
- `mobile/lib/services/sync/transport/` + `plugins/` — mirror of desktop's pluggable architecture
- `mobile/lib/services/foreground_service.dart` + `battery_optimization.dart` — Android-specific (D8)

---

## 7. Phase-1 acceptance (the moment Phase 1 is "done")

Phase 1 ships when [PRD §6.4](../../../PRD.md) acceptance criteria pass AND:

- The Clippy GNOME extension is installable as a ZIP via `gnome-extensions install`, and the Tauri app correctly switches between extension and polling source on the fly when the extension is enabled/disabled.
- Two settings surfaces exist (extension prefs + app settings) with the boundary from D11 enforced — no setting appears in both.
- `busctl --user call ... org.gnome.Shell.Extensions.Clippy.Toggle` toggles the panel.
- `busctl --user call ... io.clippy.App.TogglePanel` also toggles the panel (independent code path).
- **All four layouts (Cards / Spotlight / Sectioned / Mosaic) render every panel state** (default / search / filter / empty) at 1280×340 in both themes without overflow.
- **Spotlight + `link` clip focused** renders the og:image preview surface (or placeholder when previews disabled).
- **Mosaic + active transfer** renders the `TransferCard` inline.
- **Edit pane** (D15) refuses to open on `image` and `file` clips; saving creates a new clip with `source_app = 'Clippy (edited)'`.

## Phase-2 acceptance

[PRD §7.7](../../../PRD.md), plus:

- The dispatcher uses the `plugin` field — verified by adding a no-op stub plugin and routing a message to it in a test.
- The `SyncTransport` interface has the stub `BluetoothTransport` impl committed even if it returns `unimplemented!()`.
- **No `FILE_OFFER` envelope is ever emitted without an explicit user gesture** — verified by an integration test that copies several files into the desktop clipboard over a 5-minute idle window and asserts `FILE_OFFER` count remains 0.

## Phase-3 acceptance

[PRD §8.5](../../../PRD.md). No additional spec-level gates.

---

## 8. Risks and how we'll respond

| Risk | Likelihood | Response |
|---|---|---|
| `webkit2gtk` Wayland font/accent rendering looks off | Medium | Bundle Geist as WOFF2; hard-code fallback colour palette in CSS; smoke-test on first build |
| `clipboard-master` polling fallback is unreliable on Wayland | High | Treat extension as required for non-degraded UX; document polling as "best-effort" in README |
| Android foreground service is killed by aggressive OEMs (Xiaomi/Samsung/OnePlus) despite battery exemption | Medium | Document per-OEM steps in README; surface "connection lost" state clearly in the UI |
| Layout switching loses state (search, selection, filter) | Medium | Acceptance test for each layout pair; selection persisted by `content_hash`, not index |
| Custom `shell_command` action is a foot-gun | Low | First-time confirmation dialog when a `shell_command` action runs on a clip from a new source app |
| Two settings surfaces confuse the user | Medium | Extension prefs pane includes a "Most settings are in the Clippy app — click here to open" link |
| Link-preview fetcher leaks browsing history to whoever runs DNS | Low | Opt-in; don't pre-fetch on capture — fetch only when the URL is first viewed in the panel; encourage running a local resolver |
| Edited clip's `source_app = 'Clippy (edited)'` breaks downstream UI that expects a known source-app icon | Low | Render a Clippy logo as the icon for this sentinel value on both desktop and phone |
| User confuses Pin and Favorite (two stars-ish concepts) | Low | Distinct visuals AND distinct semantics: Pin = accent top stripe (no icon), ephemeral; Favorite = star icon (no stripe), permanent. Tooltips read "Pin to top (does not save from pruning — also favorite to keep forever)" and "Favorite (never auto-deleted)" |
| Silent text sync confuses users who don't know clips are arriving | Medium | In-app "Synced N clips" toast on app open after backfill; connection chip on phone shows "synced with {device} · 2s ago" liveness; Recent list visibly updates when foregrounded |

---

## 9. What this spec does NOT decide

The design handoff resolved most of what we'd previously left open. What remains:

- The exact short sound asset for `copy.ogg` (any short tasteful click works; ≤80 ms preferred).
- The exact GJS module layout inside `extension/`.
- Per-OEM battery-exemption documentation copy.
- The exact placeholder copy for Spotlight + `link` focused when previews are disabled.

---

## 10. Out-of-scope

Per [PRD §2](../../../PRD.md). Notable explicit exclusions: no cloud, no cross-network, no Windows/macOS/iOS, no multi-phone pairing in v1, no analytics, no app stores, no tags (deferred), no quick-paste Ctrl+1..9 (deferred).

---

*Next step after spec approval:* invoke the `superpowers:writing-plans` skill to produce a phase-by-phase implementation plan covering desktop core, GNOME extension, Android app, sync protocol, and file transfer.
