# Clippy desktop

Tauri 2 + Svelte 5 + TypeScript clipboard manager.

## Dev

    npm install        # frontend deps
    npm run tauri dev  # or `cargo tauri dev` from src-tauri's dir

Tests:

    cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit tests
    npm test                                          # Svelte component tests via vitest

## Hotkeys (default; rebindable in Settings)

| Chord | Action |
|---|---|
| `Ctrl+Shift+F11` | Toggle panel (open / focus / hide) |
| `Ctrl+F11` | Paste the most-recent clip without opening panel |
| `Ctrl+Shift+I` | Toggle incognito mode (5-min auto-disable) |

## Known limitations on Wayland (Mutter / GNOME)

- **Window positioning** — Wayland's xdg-shell protocol forbids client-side
  position requests. The bottom-anchor positioning code in `lib.rs` is a no-op
  on pure Wayland. Drag the panel into place once; Tauri persists position.
  Reliable bottom-anchoring lands when the Clippy GNOME extension ships
  (Part C of the plan).
- **Transparency** — WebKit2GTK 4.1's transparent surface support on Mutter
  has a known hang (the surface waits indefinitely for alpha buffer commits).
  Default build runs **opaque** for stability.

  **To get transparency**, run under XWayland:

      GDK_BACKEND=x11 cargo tauri dev

  Then re-enable `transparent: true` in `src-tauri/tauri.conf.json`. X11 mode
  honors transparency and positioning reliably; the trade-off is X11 input
  latency and slightly worse HiDPI behavior.
- **Active-window detection** — falls back to `xdotool` which only works in
  X11 sessions. The GNOME extension (Part C) provides the reliable Wayland
  path via `FocusedWindowChanged` D-Bus signal.

## Architecture

- `src-tauri/src/` — Rust core: SQLite, clipboard polling, sound, notifications,
  D-Bus interfaces, paste synthesis (enigo), link preview fetcher.
- `src/` — Svelte 5 frontend: 4 user-selectable layouts (Cards / Spotlight /
  Sectioned / Mosaic), edit pane, settings, ClipCard with all 7 content types.
- `assets/fonts/` — bundled Geist + Geist Mono WOFF2.
- `assets/sounds/copy.ogg` — bundled copy sound (CC0).

See `/PRD.md` and `/docs/superpowers/specs/2026-05-27-clippy-design.md` for
the full design.
