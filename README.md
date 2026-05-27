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
