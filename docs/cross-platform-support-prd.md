# Cross-Platform Support (macOS + Windows) — PRD

**Status:** spec, not yet implemented.
**Scope:** Bring the Clippy desktop app to macOS and Windows at functional parity with the Linux build that shipped in v0.2.0 (multi-pair).
**Distribution:** Direct download only — DMG for Mac, NSIS for Windows. Hosted on GitHub Releases + linked from the landing page.
**Out of scope:** Mac App Store and Microsoft Store; iOS phone app (separate track); Linux distro packaging beyond `.deb` (rpm/snap/flatpak); ARM Windows; mobile-on-desktop scenarios.

---

## 1. Background

The desktop app is currently Linux-only. The codebase has Linux assumptions woven into the runtime path:

- **GNOME D-Bus exports** (`io.clippy.App`) for the panel indicator + accelerators.
- **GNOME extension** bundled as `extraResources`, installed at first launch.
- **xdotool fallback** for focused-app + paste-as-keystroke.
- **XDG color picker** via `org.freedesktop.portal.Screenshot`.
- **libcanberra/canberra-gtk-play** for the optional click sound.
- **Avahi** for mDNS (via `bonjour-service` npm — works cross-OS, but Avahi-flavoured).
- `--ozone-platform-hint=x11` baked into the start scripts.
- `xdg-open` for opening URLs.

The sync layer, clipboard pipeline, DB, renderer UI, sentry wiring, and settings are all platform-agnostic. The Flutter mobile client doesn't change — Android stays as-is, iOS is explicitly out of scope.

## 2. Goals & non-goals

**Goals**

- Native `.dmg` for macOS (Apple Silicon + Intel) and `.exe`/NSIS for Windows x64.
- Tray/menu-bar indicator on both, with the same panel toggle UX as Linux.
- Global hotkey works out of the box per-OS convention (`⌘⇧V` on Mac, `Ctrl+Shift+V` on Win).
- Clipboard capture (text/image/link) with the same content-type detection.
- Source-app capture (which app produced the clip), best-effort.
- Paste-as-keystroke for the "paste-last" hotkey.
- LAN sync (multi-pair) "just works" without changes — phone connects to the desktop's WS on any OS.
- Autostart on login per-OS convention.
- Sentry crash reporting works on both.
- One CI workflow that produces all three OS artifacts.

**Non-goals**

- iOS Flutter port (separate effort).
- Code signing for v0.3.0 ship (see §4 phasing — first ship is intentionally unsigned beta).
- **Mac App Store distribution.** Direct-download DMG only. This dodges App Sandbox restrictions on clipboard reads, paste injection, and global hotkeys, and skips App Store review entirely. (We still notarize at M2 — that's the Gatekeeper-bypass step for direct downloads, not App Store.)
- **Microsoft Store distribution.** Same reasoning — direct NSIS install only.
- Per-OS native UI shells — we keep the Electron renderer everywhere.
- Touch Bar (Mac) / Live Tiles (Win) integrations.
- Wayland-specific features (color picker, source-app push) ported to Mac/Win equivalents in the first ship — graceful degrade is acceptable for v0.3.

## 3. User stories

1. *"I downloaded the Mac DMG, dragged Clippy to Applications, paired my phone, copied something — it syncs. I never thought about my OS."*
2. *"I'm on Windows. Tray icon shows, `Ctrl+Shift+V` opens the panel, pairing works exactly like the videos."*
3. *"I have three machines (Linux desk, Mac laptop, Win laptop) all paired with my phone. Each one syncs independently."*
4. *"I copy from VS Code on my Mac — the clip on my phone shows `from Code`."* (Stretch — best-effort source-app.)

## 4. Phasing

The signing/notarization question is the biggest fork. We split it:

- **M0 — Refactor (1–2 weeks).** Pull all Linux assumptions behind a `PlatformAdapter` interface. Build still produces a Linux `.deb` identical to v0.2.0; no functional regression.
- **M1 — Mac/Win unsigned beta → v0.3.0 (2–3 weeks after M0).** First ship of `.dmg` + `.exe`, unsigned. Mac users right-click → Open; Win users click past SmartScreen. Landing page gains Mac/Win download tiles with a "first-run install note" tooltip.
- **M2 — Signing + notarization → v0.3.1 (parallel, ~3 weeks of clock-time for paperwork).** Apple Developer Program ($99/yr) + Apple Developer ID cert. Windows EV cert OR self-attestation via a signed installer. CI signs both. Landing page drops the install-note tooltip.
- **M3 — Auto-update (after M2).** electron-updater with GitHub Releases as the feed (already where artifacts live). Auto-update only ships AFTER signing — unsigned auto-updates trigger fresh SmartScreen warnings each time.

M0 lands in v0.2.1 (Linux-only artifact, but the abstraction is in). M1 ships v0.3.0 (all three OSes). M2 ships v0.3.1 (same artifacts, signed). M3 ships v0.4.0.

## 5. Architecture: PlatformAdapter

All current Linux-specific code consolidates behind one interface:

```ts
// desktop/electron/platform/index.ts
export interface PlatformAdapter {
  registerGlobalHotkeys(handlers: HotkeyHandlers): Promise<void>;
  getFocusedAppName(): Promise<string | null>;
  pasteText(text: string, withShift: boolean): Promise<void>;
  openExternal(url: string): Promise<void>;
  playClickSound(): Promise<void>;
  installAutostart(): Promise<void>;
  uninstallAutostart(): Promise<void>;
  trayIcon(): NativeImage;
  /** Optional: only Linux returns the GNOME-extension bridge. */
  initShellIntegration?(): Promise<void>;
}
```

Three impls:

- `desktop/electron/platform/linux.ts` — current code (D-Bus, GNOME extension, xdotool, canberra, xdg-open, x11 ozone hint).
- `desktop/electron/platform/mac.ts` — new.
- `desktop/electron/platform/win.ts` — new.

`main.ts` picks via `process.platform` at startup. The renderer doesn't change.

### 5.1 macOS adapter

| Capability | Implementation |
| -- | -- |
| Global hotkeys | `globalShortcut.register('Cmd+Shift+V', ...)`. Default panel hotkey `⌘⇧V`, paste-last `⌘⌥V`. |
| Focused-app name | `child_process` calls AppleScript: `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`. Cached, debounced. |
| Paste-as-keystroke | Send `Cmd+V` via `osascript -e 'tell application "System Events" to keystroke "v" using command down'`. Accessibility permission gate — surface a settings panel asking the user to grant. |
| Open external | `shell.openExternal(url)` (electron built-in works everywhere). |
| Click sound | `afplay` on the bundled OGG, or `NSSound`. |
| Autostart | `app.setLoginItemSettings({ openAtLogin: true })`. |
| Tray icon | Template image (`*Template.png` naming) — Electron auto-recolors for dark/light menu bar. |
| mDNS | Bonjour native (no extra service install). `bonjour-service` npm should just work. |
| First-run | `.app` quarantine attribute — see §6 notarization. |

### 5.2 Windows adapter

| Capability | Implementation |
| -- | -- |
| Global hotkeys | `globalShortcut.register('Ctrl+Shift+V', ...)`. Default paste-last `Ctrl+Alt+V`. |
| Focused-app name | `child_process` shells `powershell -c "Get-Process \| Where-Object MainWindowHandle -eq (Get-Process \| ...)"` — or a tiny native node-addon using `GetForegroundWindow` + `GetWindowText`. Prefer the addon; PowerShell is slow. |
| Paste-as-keystroke | Use the `nut-tree/nut.js` keyboard module, or a small native addon calling `SendInput(VK_CONTROL+V)`. |
| Open external | `shell.openExternal`. |
| Click sound | `electron-shell.beep()` or play the bundled OGG via `node-wav-player`. |
| Autostart | Registry write under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` via `app.setLoginItemSettings`. |
| Tray icon | Standard `.ico` (16/32/48 multi-res). |
| mDNS | `bonjour-service` npm works on Win10+ via WinSocket multicast. We don't require Apple Bonjour Print Services installed. |
| Defender | Submit to Microsoft for false-positive review once signed (M2). |

### 5.3 Linux adapter (no net change)

All existing code moves under `platform/linux.ts` unchanged. The GNOME extension keeps shipping as `extraResources` and auto-installs.

## 6. Build & distribution

`desktop/package.json` `build` block gains `mac` and `win` targets:

```jsonc
"mac": {
  "target": ["dmg"],
  "icon": "assets/icons/mac/icon.icns",
  "category": "public.app-category.productivity",
  "hardenedRuntime": true,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "extendInfo": {
    "LSUIElement": false,
    "NSAppleEventsUsageDescription": "Clippy uses Accessibility to paste your last clip into the active app."
  }
},
"win": {
  "target": ["nsis"],
  "icon": "assets/icons/win/icon.ico"
},
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "perMachine": false
}
```

### 6.1 CI

GitHub Actions workflow `.github/workflows/release.yml`:

- Triggered on `v*` tag push.
- Three parallel jobs: `ubuntu-latest`, `macos-latest`, `windows-latest`.
- Each runs `npm ci`, `flutter build apk --release` (only on ubuntu), `npm run package`.
- All upload artifacts to the GitHub release for the tag.

Roughly 25 min total wall clock, with Mac being slowest.

### 6.2 Signing (M2)

- **macOS:** Apple Developer Program enrolment ($99/yr) → Developer ID Application cert imported into the runner keychain via `apple-actions/import-codesign-certs`. Hardened Runtime entitlements (clipboard read, Apple events) declared; **App Sandbox NOT enabled** — we'd lose paste-as-keystroke and source-app capture. Notarization via `notarytool` post-build; staple the ticket to the DMG. App-specific password as secret. ~3 working days to clear Apple's setup + first notarization.
- **Windows:** Either an EV code-signing cert (~$300/yr, immediate SmartScreen trust) or OV cert ($100/yr, needs reputation build-up). Recommend OV for cost; accept ~2 weeks of SmartScreen warnings while reputation builds.

## 7. Hotkey & UX conventions

Per-OS defaults:

| Action | Linux | macOS | Windows |
| -- | -- | -- | -- |
| Toggle panel | `Ctrl+Alt+Shift+V` | `⌘⇧V` | `Ctrl+Shift+V` |
| Paste last | `Ctrl+Alt+V` | `⌘⌥V` | `Ctrl+Alt+V` |
| Toggle incognito | `Ctrl+Shift+I` | `⌘⇧I` | `Ctrl+Shift+I` |

Stored in the existing settings table; first-run on each OS seeds the OS-appropriate defaults if the row is absent. Users can rebind from the Hotkeys screen (already exists).

## 8. Renderer adjustments

Minor, mostly cosmetic:

- Modifier glyph rendering (`⌘`, `⌥`, `⌃` on Mac; `Ctrl`, `Alt`, `Win` text on Win/Linux) in the Hotkeys screen.
- Window chrome: Mac frameless with traffic lights kept; Windows native title bar; Linux current.
- Panel positioning: keep the bottom-anchor on Linux; on Mac/Win the panel could open from the tray click position instead — defer to M1+ polish.

## 9. Phone app (no change)

The mobile Flutter app stays as-is. Multi-pair already supports pairing with N desktops, so adding Mac/Win desktops to a phone's pairing list works the day those desktops can generate QRs. Diagnostics will show e.g. `clippy-desktop-mac-<id>` alongside the Linux peer.

## 10. Test matrix

| # | Test | Linux | macOS | Windows |
| -- | -- | -- | -- | -- |
| 1 | First-run install opens panel | ✓ | ✓ | ✓ |
| 2 | Clipboard text → captured | ✓ | ✓ | ✓ |
| 3 | Clipboard image → captured | ✓ | ✓ | ✓ |
| 4 | Global hotkey opens panel | ✓ | ✓ | ✓ |
| 5 | Paste-last hotkey types into active app | ✓ | ✓ (accessibility prompt) | ✓ |
| 6 | Source-app name appears on captured clip | ✓ | ✓ (best-effort) | ✓ (best-effort) |
| 7 | Tray icon visible + clickable | ✓ | ✓ (template image) | ✓ |
| 8 | Autostart on login | ✓ | ✓ | ✓ |
| 9 | Pair with phone via QR | ✓ | ✓ | ✓ |
| 10 | Receives clip from phone | ✓ | ✓ | ✓ |
| 11 | Sends clip to phone (auto-sync) | ✓ | ✓ | ✓ |
| 12 | Sentry captures forced crash | ✓ | ✓ | ✓ |
| 13 | Survives wifi off → on | ✓ | ✓ | ✓ |
| 14 | Two-desktop multi-pair (Mac + Linux to one phone) | n/a | ✓ | ✓ |
| 15 | Quit → relaunch keeps history | ✓ | ✓ | ✓ |
| 16 | Uninstall is clean | ✓ | ✓ | ✓ |

## 11. Open questions

1. **mDNS on Windows without Bonjour Print Services.** `bonjour-service` claims to work; need to validate on a stock Win10 box without Bonjour installed.
2. **Win accessibility for paste-as-keystroke.** No permission gate on Windows, but UAC-elevated targets won't receive synthetic input. Document the limitation; don't try to fix in v0.3.
3. **Mac arm64 vs x64 packaging.** Ship a universal2 binary (one DMG) vs two separate. Universal2 is +50 MB but one download tile. Recommend universal2.
4. **Windows installer scope.** Per-user (no admin) vs per-machine (UAC prompt). Recommend per-user — matches Linux/Mac feel.
5. **Tray-icon-only mode.** On Mac, should Clippy be `LSUIElement: true` (no Dock icon) like Magnet/Rectangle? Recommend yes for v0.3.

## 12. Risks & cost estimate

| Risk | Mitigation |
| -- | -- |
| Native addon (paste-as-keystroke) bundling per-OS adds CI complexity | Use pure-JS where possible (`osascript`, `nut-tree`) before reaching for native addons. |
| Apple notarization rejections | Hardened runtime + entitlements done up front; dry-run on a personal Apple ID before paid enrolment. |
| Win Defender false positives on unsigned NSIS | Document the "More info → Run anyway" path on the landing page during M1; resolve at M2 with signing. |
| mDNS regressions across OSes | Add an explicit fallback to manual host:port pairing if discovery fails (already in code path). |
| Two-OS testing burden per release | CI matrix above + a 16-row manual sanity pass per OS per release tag. |

**Effort estimate (one engineer):**
- M0 refactor: 1–2 weeks.
- M1 Mac + Win unsigned beta: 2–3 weeks.
- M2 signing/notarization: 1 week eng + 2 weeks calendar (Apple paperwork, Windows reputation).
- M3 auto-update: 1 week.

Total ~7–10 weeks of work for full M0–M3, with v0.3.0 shippable at ~5 weeks.

## 13. Files touched (M0 + M1 sketch)

```
desktop/electron/
  platform/
    index.ts                 (new — PlatformAdapter interface)
    linux.ts                 (new — wraps existing code)
    mac.ts                   (new — osascript + setLoginItemSettings)
    win.ts                   (new — registry + nut.js or native addon)
  main.ts                    (gut Linux-specific imports; delegate to adapter)
  paste.ts                   (move into platform/linux.ts)
  focused-app.ts             (move into platform/linux.ts)
  gnome-shortcut.ts          (move into platform/linux.ts)
  gnome-extension.ts         (stays — only invoked by linux adapter)
  dbus-app.ts                (move into platform/linux.ts)
  color-picker.ts            (linux-only for v0.3; mac/win → no-op)
  sound.ts                   (split into per-OS impls)
desktop/package.json         (mac/win build targets, deps)
desktop/assets/icons/
  mac/icon.icns              (new)
  win/icon.ico               (new)
.github/workflows/release.yml (new — 3-OS matrix on tag push)
landing/src/components/
  Hero.astro                 (Mac/Win download tiles)
  Mac.astro                  (new — Mac install card mirroring Ubuntu.astro)
  Win.astro                  (new — Win install card)
docs/
  cross-platform-support-prd.md  (this file)
```
