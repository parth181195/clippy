# What's testable on return

This session shipped a lot — here's the punch-list for verification.

## Desktop (already running — Ctrl+Alt+Shift+V to open panel)

- [ ] **Card type-specific rendering** — copy a URL, a code snippet, a color (`#E95678`), an emoji, a file path. Each card type should render distinctly (favicon for links, syntax highlight for code, large swatch + hex/rgb for color, big emoji, file glyph with extension badge for files).
- [ ] **Pinned coral stripe** — right-click a card → Pin. A 2px coral stripe should paint at the card's top edge.
- [ ] **Filter chip counts** — each chip in the header now shows its count (e.g. `Text 12`).
- [ ] **Connection indicator** — footer shows `Smartphone` + device name + `Zap` icon when paired (was just a green dot before).
- [ ] **Footer keyboard hints** — `↵ paste · ⌫ delete · ⇧⌃S send` rendered with styled key chips.
- [ ] **Search bar `/` chip** — when empty + unfocused, the search bar shows a `/` chip on the right.
- [ ] **Settings → Devices** — new tab in Settings sidebar. Shows paired device card with live state dot + Unpair button.
- [ ] **Settings → Exclusions** — chip-list editor. Type a name, hit Add (or Enter), it appears as a removable chip.
- [ ] **Right-click context menu** — Send to phone (image/file only when connected), Edit (text-shaped), Favorite, Pin, Delete with keyboard shortcut hints.

## GNOME extension (requires log-out + log-back-in on Wayland)

- [ ] `gnome-extensions enable clippy@io.clippy` after re-login.
- [ ] Clipboard icon appears in the top bar.
- [ ] **Left-click the icon** → Clippy panel toggles.
- [ ] **Popup menu** → Toggle panel / Paste last / Toggle incognito → all three trigger Clippy.
- [ ] **Status row** in the popup shows "Status: connected" when Clippy is running.
- [ ] **Source-app capture on Wayland** — copy from Firefox → the clip card top-right shows the Firefox icon. Copy from a terminal → terminal icon. Without the extension, only X11/XWayland windows would be captured.

## Phone (re-`flutter run` to pick up changes)

- [ ] **Recent screen redesigned**: 56px thumbnail + type badge + `FROM DESKTOP` chip + relative time. Swipe row-end to delete (with trash icon backdrop).
- [ ] **Background sync** — close the app (swipe away from recents). The notification "Clippy sync · Paired with <name>" should remain. Copy something on desktop → wait a few seconds → reopen app → new clip is in Recent. (May need Settings → Background sync → Disable battery optimization for reliability.)
- [ ] **Battery optimization card** in Settings → status + button to open system settings.
- [ ] **mDNS rescue** — change your laptop's Wi-Fi (different DHCP). After two failed reconnects (~6s), phone queries mDNS for `_clippy._tcp.local`, finds the new IP, persists it, and reconnects. No re-pairing.
- [ ] **Exponential backoff** — sustained disconnect retries 2/4/8/16/32/60s instead of flat 5s. Watch flutter logs.
- [ ] **Instant Wi-Fi reconnect** — toggle airplane mode briefly. Phone reconnects within ~1s of network returning (not waiting for backoff).

## What's NOT built (per session decisions)

- Cancel button on in-flight transfers — current 10MB cap makes it unnecessary.
- Per-type Actions UI in Settings → still stubbed.
- GNOME extension Phase 2 (native Clutter actor panel) — Phase 1 (tray + D-Bus) is enough for now; native panel is its own project.

## How to relaunch things

- Desktop: `cd desktop && npx cross-env ELECTRON_OZONE_PLATFORM_HINT=x11 electron . --no-sandbox --disable-gpu-sandbox --ozone-platform-hint=x11`
- Phone: `cd mobile && flutter run -d <device-id>`
- GNOME extension: `make -C extension install && gnome-extensions enable clippy@io.clippy` (after re-login on Wayland)
