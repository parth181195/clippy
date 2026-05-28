# Clippy

A LAN-only, peer-to-peer clipboard manager + small-file sharer for Ubuntu (GNOME / Wayland) and Android. It remembers every clip, searches them all, and syncs to your phone — no cloud, no account.

**Status:** open beta, `v0.1.0` · GPLv3 · downloads on the [Releases page](https://github.com/parth181195/clippy/releases).

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

Desktop and phone pair by scanning a QR code, then talk directly over the local network on a WebSocket (port 43117), discovered via mDNS. Every frame is encrypted with libsodium `secretbox` (XSalsa20-Poly1305) using a 32-byte key exchanged in the pairing QR. Text-shaped clips sync automatically; images and files (up to 10 MB) are sent on an explicit gesture. Nothing leaves your network.

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

## License

GPLv3 — see [`LICENSE`](LICENSE).
