# Clippy — Design Spec

| | |
|---|---|
| **Status** | Draft, pending review |
| **Owner** | Parth |
| **Date** | 2026-05-27 |
| **Source PRD** | [/PRD.md](../../../PRD.md) |

This spec is the buildable engineering reference for Clippy v1. It assumes the PRD as context. Where the two disagree, this spec wins for engineering decisions and the PRD wins for product intent.

---

## 1. What we're building

A LAN-only, peer-to-peer clipboard manager and small-file sharer for one user with one Ubuntu (GNOME Wayland) desktop and one Android phone. Inspired by Paste, Pano, and Copyous; positioned to replace the user's current Pano usage by combining Pano-quality UX with KDE-Connect-style cross-device sync.

Three phases, all bundled in this one spec:

| Phase | Deliverable | Independently usable? |
|---|---|---|
| **1** | Desktop standalone app + GNOME extension | Yes — a complete local clipboard manager |
| **2** | Android app, mDNS, encrypted WebSocket sync, tags | Yes — pair + sync clips and tags |
| **3** | File transfer (HTTP file endpoint, share-sheet target) | Yes — full v1 |

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
       │                   │    │    └─ ClipboardPlugin              │
       └───────────────────┘    │    └─ FileTransferPlugin           │
                                │    └─ TagsPlugin                   │
                                └────────────────────────────────────┘
```

**Why four:** Wayland clipboard + focused-window detection has no good cross-app API. A GNOME shell extension is the only reliable source. Treating it as a sibling artifact (not internal to Tauri) lets the Tauri app subscribe via D-Bus and fall back to polling when the extension is absent.

---

## 3. Key design decisions (and why)

Each row resolves an item that was either open in the original PRD section 12 or surfaced during brainstorming.

| # | Decision | Why |
|---|---|---|
| D1 | **GNOME extension ships in Phase 1** (was Phase 4) | Polling fallback is the fallback. The extension is the primary clipboard + focused-window source. Pulling it forward makes F1 (capture) and F6 (exclusion list) actually work well on Wayland from day one. |
| D2 | **Image storage = original bytes + `mime` + separate PNG thumbnail** | Original preserved for round-trip fidelity (no JPEG re-encode artefacts); thumbnail kept in a sibling table so list views don't pay the BLOB scan. |
| D3 | **Code detection = source-app first, content heuristic fallback** | Source-app (via the extension's `FocusedWindowChanged`) gives high-confidence tagging for clips from IDEs/terminals. Heuristic catches the rest. Cheaper and more accurate than ML. |
| D4 | **Store every clipboard representation** | Browsers and doc editors put `text/html` + `text/plain`; preserve both so "Paste as plain" / "Paste as HTML" actually works. Card preview uses `text/plain`. |
| D5 | **Tags: 9 colored groups, sync to phone** | Copyous's tag axis on top of binary favorite. Tags are user-meaningful organization — they belong with the clip identity, hence sync. |
| D6 | **Customizable per-type actions** | Generalizes the link-open-in-browser affordance. Per-device preference; does NOT sync. Pre-seeded so the user gets sensible defaults without configuring anything. |
| D7 | **Pluggable transports + plugins (KDE Connect style)** | `SyncTransport` and `SyncPlugin` interfaces on both sides. Only one transport ships (`LanWebSocketTransport`); the interface exists so adding Bluetooth/USB later is a slot-in, not a rewrite. Plugins (clipboard/files/tags) make the protocol modular. |
| D8 | **Android: foreground service + battery exemption + ConnectivityManager** | Matches KDE Connect's reliability. Low-priority persistent notification shows live connection state. First-run prompts for battery whitelist. WiFi changes trigger immediate reconnect, not waiting for backoff. |
| D9 | **Sound on copy, single sound, ON by default** | Pano/Copyous ship it; user wants it. Single short bundled OGG via `rodio` (cross-distro) or `gsound` (where present). Settings toggle. |
| D10 | **Two D-Bus interfaces** | `org.gnome.Shell.Extensions.Clippy` (extension, Copyous-style namespace) exposes shell ops + signals. `io.clippy.App` (Tauri app) exposes panel/history ops for CLI scripting. Different layers, different responsibilities. |
| D11 | **Settings split** | Extension prefs (via `gnome-extensions prefs`) hold extension-only settings (signal verbosity, fallback toggle). Everything else lives in the app's Svelte settings panel. Documented boundary prevents drift. |
| D12 | **Rich link previews are opt-in** | They're the only outbound HTTP. Opt-in respects the "no data leaves your network" property; opt-out preserves Pano-quality link cards for users who want them. Fetcher refuses private IPs / localhost. |

### Deliberately deferred (will NOT ship in v1)

- **Ctrl+1..9 quick-paste hotkeys** — useful, not promoted.
- **Open panel at mouse / text-cursor position** — Copyous-only, pleasant but cosmetic.
- **Multiple paired phones** — single-pair only in v1; the schema supports more rows in `paired_devices` so adding it later is non-breaking.
- **Forward secrecy / traffic-analysis resistance** — out of threat model.
- **Resumable file transfer** — 100 MB on LAN is fast enough; complexity not worth it.
- **Tag conflict resolution beyond last-write-wins** — document the limitation.

---

## 4. Data model

Full final schema is in [PRD.md §6.2](../../../PRD.md). Summary of tables and their roles:

| Table | Role | Phase |
|---|---|---|
| `clips` | Primary clip record (one row per dedup'd capture) | 1 |
| `clip_representations` | Additional mime reps for the same clip | 1 |
| `clip_thumbnails` | Decoded PNG thumbnail, separate to avoid scan cost | 1 |
| `clips_fts` | FTS5 virtual table over `preview` | 1 |
| `tags` | Named, colored tag definitions | 1 (UI) / 2 (sync) |
| `clip_tags` | Many-to-many clip ↔ tag | 1 / 2 |
| `clip_actions` | User-defined per-type actions | 1 |
| `link_previews` | Cached OG/favicon for `link` clips | 1 |
| `settings` | KV store for app settings | 1 |
| `excluded_apps` | App ids that suppress capture | 1 |
| `paired_devices` | Phone(s) pubkey + PSK + identity | 2 |

`content_hash` is the cross-device clip identity. It's a SHA-256 of the primary representation, so the same text/image hashed identically on both sides. Sync messages reference clips by `content_hash`, not by local `id`.

---

## 5. Sync protocol

Full message catalog in [PRD.md §7.2](../../../PRD.md). Two protocol invariants worth restating here because they shape the code:

- **All payloads encrypted with `crypto_secretbox` (PSK) before transport.** The WebSocket carries opaque base64 frames; the JSON envelope only exists post-decrypt. No exceptions, including `HELLO`.
- **Envelopes carry a `plugin` field.** The dispatcher routes by `plugin`, not by `type`. Adding a future plugin (e.g., `NotificationsPlugin`) is a slot-in.

```
nonce           = randombytes(24)                      # crypto_secretbox nonce, fresh per message
ciphertext      = secretbox(psk, nonce, utf8(json(envelope)))
ws_frame_text   = base64(nonce || ciphertext)          # sent as a WebSocket text frame
```

The receiver splits the first 24 bytes as nonce and feeds the rest to `secretbox_open`. There is no plaintext header — message framing is the WebSocket frame itself.

### Inline-vs-request rule (restated, since it's load-bearing)

| Payload kind | Where it goes |
|---|---|
| Text under 4 KB | Inline in `CLIP_NEW.content_inline` |
| Multi-representations under 8 KB total | Inline in `CLIP_NEW.reps` |
| Images (any size) | `FILE_OFFER` |
| Files (any size) | `FILE_OFFER` |
| Anything else over 4 KB | `CLIP_NEW.hash` + separate `CLIP_REQUEST` round trip |

---

## 6. Repo structure

Final layout in [PRD.md §5](../../../PRD.md). The new directories vs the original PRD:

- `extension/` — GNOME shell extension (was implied "Phase 4")
- `desktop/src-tauri/src/clipboard/` — split into `source_extension.rs` + `source_polling.rs` + `detect.rs`
- `desktop/src-tauri/src/sync/transport/` and `desktop/src-tauri/src/sync/plugins/` — pluggable architecture (D7)
- `desktop/src-tauri/src/dbus_app.rs` — the `io.clippy.App` interface (D10)
- `desktop/src-tauri/src/actions.rs`, `notifications.rs`, `sound.rs`, `link_preview.rs` — features added in brainstorming
- `desktop/assets/sounds/copy.ogg` — bundled sound asset
- `mobile/lib/services/sync/transport/` + `mobile/lib/services/sync/plugins/` — mirror of desktop's pluggable architecture
- `mobile/lib/services/foreground_service.dart` + `battery_optimization.dart` — Android-specific (D8)

---

## 7. Phase-1 acceptance (the moment Phase 1 is "done")

Phase 1 ships when [PRD §6.4](../../../PRD.md) acceptance criteria pass AND:

- The Clippy GNOME extension is installable as a ZIP via `gnome-extensions install`, and the Tauri app correctly switches between extension and polling source on the fly when the extension is enabled/disabled.
- Two settings surfaces exist (extension prefs + app settings) with the boundary from D11 enforced — no setting appears in both.
- `busctl --user call ... org.gnome.Shell.Extensions.Clippy.Toggle` toggles the panel.
- `busctl --user call ... io.clippy.App.TogglePanel` also toggles the panel (independent code path).

## Phase-2 acceptance

[PRD §7.7](../../../PRD.md), plus:

- The dispatcher uses the `plugin` field — verified by adding a no-op stub plugin and routing a message to it in a test.
- The `SyncTransport` interface has the stub `BluetoothTransport` impl committed even if it returns `unimplemented!()`.

## Phase-3 acceptance

[PRD §8.5](../../../PRD.md). No additional spec-level gates.

---

## 8. Risks and how we'll respond

| Risk | Likelihood | Response |
|---|---|---|
| `webkit2gtk` Wayland font/accent rendering looks off | Medium | Hard-code fallback colors in CSS; smoke-test on first build |
| `clipboard-master` polling fallback is unreliable on Wayland | High | Treat extension as required for non-degraded UX; document polling as "best-effort" in README |
| Android foreground service is killed by aggressive OEMs (Xiaomi/Samsung/OnePlus) despite battery exemption | Medium | Document per-OEM steps in README; surface "connection lost" state clearly in the UI so users know to re-open the app |
| Tag rename conflicts (offline on both sides) | Low | Last-write-wins by `created_at`; document. v2 can do OT/CRDT if it becomes painful |
| Custom `shell_command` action is a foot-gun | Low | First-time confirmation dialog when a `shell_command` action runs on a clip from a new source app |
| Two settings surfaces confuse the user | Medium | Extension prefs pane includes a "Most settings are in the Clippy app — click here to open" link |
| Link-preview fetcher leaks browsing history to whoever runs DNS | Low | Opt-in; document; encourage running a local resolver. Don't pre-fetch on capture — only fetch when the URL is first viewed in the panel |

---

## 9. What this spec does NOT decide

These need to be resolved during implementation (good defaults exist; no design call is required first):

- Exact Svelte component decomposition beyond the names in PRD §5
- CSS variable naming for the Clippy theme
- Specific WAV/OGG file for the copy sound (any short tasteful click works)
- The exact GJS module layout inside `extension/`
- Whether tag colors are fixed (9 hand-picked Material-ish colors) or user-pickable (probably fixed in v1, user-pickable v2)

---

## 10. Out-of-scope

Per [PRD §2](../../../PRD.md). Notable explicit exclusions: no cloud, no cross-network, no Windows/macOS/iOS, no multi-phone pairing in v1, no analytics, no app stores.

---

*Next step after spec approval:* invoke the `superpowers:writing-plans` skill to produce a phase-by-phase implementation plan covering desktop core, GNOME extension, Android app, sync protocol, and file transfer.
