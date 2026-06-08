# Clippy

A LAN-only, peer-to-peer clipboard manager + small-file sharer for Ubuntu (GNOME / Wayland) and Android. It remembers every clip, searches them all, and syncs to your phone — no cloud, no account.

**Status:** open beta, `v0.2.0` · GPLv3 · Linux + Android stable, Mac + Windows landing in `v0.3.0`. Downloads on the [Releases page](https://github.com/parth181195/clippy/releases).

## Subsystems

| Dir | Subsystem | Tech |
|---|---|---|
| `desktop/` | Desktop app — clipboard capture, SQLite history, panel UI, sync server | Electron + React + TypeScript |
| `extension/` | GNOME Shell extension — top-bar indicator, D-Bus trigger, source-app capture | GJS (GNOME 47–50) |
| `mobile/` | Android client — pair via QR, mirror clips, file send, foreground sync | Flutter / Dart |
| `landing/` | Marketing site | Astro (static) |
| `shared-protocol/` | LAN sync protocol reference (doc only) | — |
| `scripts/` | dev helpers | — |

## How it works

Desktop and phone pair by scanning a QR code, then talk directly over the local network on a WebSocket (port 43117), discovered via mDNS. Every frame is encrypted with libsodium `secretbox` (XSalsa20-Poly1305) using a 32-byte key exchanged in the pairing QR. Text-shaped clips sync automatically; images and files (up to 10 MB) are sent on an explicit gesture. Your clipboard contents never leave your network — the only data Clippy sends off-device is optional, opt-out crash reports (Sentry) to help fix beta bugs.

## Build & run

```bash
# Desktop (Electron)
cd desktop && npm install && npm run electron:dev      # dev
cd desktop && npm run package                          # → .deb in release/

# Android (Flutter)
cd mobile && flutter run                               # dev on a connected device
cd mobile && flutter build apk --release               # release APK

# GNOME extension
cd extension && make install                           # symlink + reload instructions

# Landing site (Astro)
cd landing && npm install && npm run dev               # dev server
cd landing && npm run build                            # → dist/
```

## Releasing

Releases are cut by pushing a `v*` tag — `.github/workflows/release.yml` builds Linux `.deb`, macOS `.dmg`, Windows `.exe`, and Android `.apk` in parallel and attaches them to a GitHub Release.

```bash
git tag v0.3.0 && git push origin v0.3.0
```

Required repository secrets (set once via `gh secret set`):

| Secret | Source |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 mobile/android/app/clippy-release.jks` |
| `ANDROID_KEY_PROPERTIES` | verbatim contents of `mobile/android/key.properties` |

```bash
gh secret set ANDROID_KEYSTORE_BASE64 < <(base64 mobile/android/app/clippy-release.jks)
gh secret set ANDROID_KEY_PROPERTIES --body-file mobile/android/key.properties
```

Mac and Windows builds are unsigned until [#5](https://github.com/parth181195/clippy/issues/5) / [#6](https://github.com/parth181195/clippy/issues/6) — first-launch Gatekeeper / SmartScreen warnings are expected; the landing page documents the workaround.

For a dry-run that doesn't ship to the public, tag a pre-release: `git tag v0.3.0-rc1 && git push origin v0.3.0-rc1`. The release is created as a draft until all four artifacts succeed, then flipped to non-draft; delete the draft if a job fails.

## License

GPLv3 — see [`LICENSE`](LICENSE).
