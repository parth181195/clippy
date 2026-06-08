# Clippy

A LAN-only, peer-to-peer clipboard manager + small-file sharer for Ubuntu (GNOME / Wayland) and Android. It remembers every clip, searches them all, and syncs to your phone — no cloud, no account.

**Status:** open beta, `v0.3.0` · GPLv3 · Linux + Android stable; Mac + Windows are unsigned beta (Gatekeeper / SmartScreen warning on first launch, signing lands in `v0.3.1`). Downloads on the [Releases page](https://github.com/parth181195/clippy/releases).

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

### Mac + Windows code signing (optional, opt-in)

Mac and Windows builds default to **unsigned** — first-launch Gatekeeper / SmartScreen warnings are expected and the landing page documents the workaround. To produce signed builds, add the secrets below; the workflow flips signing on for the next tag-push.

**macOS** — Apple Developer Program enrollment ($99/yr). After enrolling:

1. Create a **Developer ID Application** certificate in the Apple Developer portal, export the `.p12` (set a strong password).
2. Generate an [app-specific password](https://appleid.apple.com) for your Apple ID.
3. Note your **Team ID** (10 chars, top-right of the Apple Developer portal).

```bash
gh secret set MAC_CSC_LINK < <(base64 path/to/developer-id-application.p12)
gh secret set MAC_CSC_KEY_PASSWORD --body 'your-p12-password'
gh secret set APPLE_ID --body 'you@example.com'
gh secret set APPLE_APP_SPECIFIC_PASSWORD --body 'xxxx-xxxx-xxxx-xxxx'
gh secret set APPLE_TEAM_ID --body 'XXXXXXXXXX'
```

The workflow auto-enables Hardened-Runtime signing + `notarytool` notarization when `MAC_CSC_LINK` is present. App Sandbox stays **off** (configured in `desktop/build/entitlements.mac.plist`) so clipboard reads + paste injection + global hotkeys keep working.

**Windows** — OV code-signing cert (~$100/yr from Sectigo, SSL.com, etc.). After procurement:

1. If you got a `.pfx`, you're done. If you got an HSM token (newer Sectigo/SSL.com deliveries mandate this), HSM signing isn't supported by this workflow yet — see issue #6.

```bash
gh secret set WIN_CSC_LINK < <(base64 path/to/codesign.pfx)
gh secret set WIN_CSC_KEY_PASSWORD --body 'your-pfx-password'
```

The signed installer signs SHA-256 by default. SmartScreen reputation takes ~2 weeks to build with an OV cert — during that window, Win users still see the "publisher: Parth Jansari" prompt (not the unsigned-app warning).

For a dry-run that doesn't ship to the public, tag a pre-release: `git tag v0.3.0-rc1 && git push origin v0.3.0-rc1`. The release is created as a draft until all four artifacts succeed, then flipped to non-draft; delete the draft if a job fails.

## License

GPLv3 — see [`LICENSE`](LICENSE).
