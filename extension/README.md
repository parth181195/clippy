# Clippy GNOME Shell Extension

v1: A lightweight top-bar indicator that triggers the running Clippy desktop
app via D-Bus. The extension does **not** render the clip list itself
(yet) — it just gives Clippy a native, always-visible entry point in the
shell.

## Why

The Electron panel is positioned via the XWayland fallback (Wayland
forbids client-side positioning). A real GNOME extension can replace
that with a Clutter actor inside `gnome-shell` itself, matching what
Pano does. **Phase 2** is to render the clip list as Clutter actors.
**This v1** just adds the tray button + D-Bus trigger so users can open
the existing panel without a hotkey.

## What it does

- Adds a clipboard icon to the top-bar status area.
- **Left-click** the icon → calls `io.clippy.App.TogglePanel` over the
  session bus. Equivalent to pressing the Clippy hotkey.
- **Popup menu** exposes `Toggle panel`, `Paste last clip`, and
  `Toggle incognito` — same three D-Bus methods we already expose from
  `desktop/electron/dbus.ts`.
- Status row shows whether the `io.clippy.App` service is currently
  owned on the session bus, polled every 5s.

## Install (development)

```sh
make -C extension install   # symlinks to ~/.local/share/gnome-shell/extensions/
```

Then **log out and back in** (Wayland; X11 can `Alt+F2` → `r`), and:

```sh
gnome-extensions enable clippy@io.clippy
```

## Compatible with

- GNOME Shell **47, 48, 49, 50** (ESM extension API)

## Phase 2 (later)

- Render the clip list as Clutter actors directly in the shell, replacing
  the Electron panel entirely.
- Read clips via either:
  - a D-Bus `ListClips()` method we add to `io.clippy.App`, or
  - direct sqflite read from the Clippy DB at
    `~/.config/clippy/clippy/clippy.db` (needs gjs sqlite binding).
- Paste action via shell-level keyboard injection (`Clutter.InputDevice`).
