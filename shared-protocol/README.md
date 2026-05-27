# Clippy LAN Protocol — v1

Reference spec for the bidirectional WebSocket protocol used between the
Clippy desktop and the Clippy Android app. Implementations:

- Desktop: `desktop/src-tauri/src/sync/`
- Mobile: `mobile/lib/services/sync/`

## Transport

WebSocket over LAN. Desktop listens on TCP port 43117 (advertised via
mDNS `_clippy._tcp.local`). All frames are text frames carrying
base64-encoded encrypted bytes.

## Frame format

    nonce       = randombytes(24)           # crypto_secretbox nonce, fresh per message
    ciphertext  = secretbox(psk, nonce, utf8(json(envelope)))
    ws_text     = base64(nonce || ciphertext)

The receiver splits the first 24 bytes as nonce and feeds the rest to
secretbox_open. There is no plaintext header.

## Envelope (post-decrypt)

    {
      "type": "...",
      "id":   "uuid-v4",
      "ts":   1735000000000,
      "plugin": "clipboard" | "file_transfer" | "core",
      "payload": { ... }
    }

## Message catalog

| Type                 | Plugin        | Direction          | Payload                                                            |
|----------------------|---------------|--------------------|--------------------------------------------------------------------|
| HELLO                | core          | bidir              | {device_id, name, version}                                         |
| ACK                  | core          | bidir              | {ref_id}                                                           |
| CLIP_NEW             | clipboard     | bidir              | {kind, mime, preview, hash, content_inline?, reps?}                |
| CLIP_REQUEST         | clipboard     | bidir              | {hash}                                                             |
| CLIP_LIST            | clipboard     | bidir              | {since_ts, items: [...]}                                           |
| FILE_OFFER           | file_transfer | bidir              | {token, filename, size, mime}                                      |
| FILE_REQUEST         | file_transfer | bidir              | {token}                                                            |
| FILE_UPLOAD_REQUEST  | file_transfer | phone→desktop      | {filename, size}                                                   |
| FILE_UPLOAD_TOKEN    | file_transfer | desktop→phone      | {token, url}                                                       |
| FILE_PROGRESS        | file_transfer | bidir              | {token, bytes, total}                                              |
| FILE_CANCEL          | file_transfer | bidir              | {token}                                                            |

## What auto-syncs

- text, link, code, color, emoji — yes, via CLIP_NEW (per-direction toggle)
- image, file — no, only via FILE_OFFER after an explicit user gesture

## Inline-vs-request rule

- Single rep < 4 KB: inline in CLIP_NEW.content_inline
- Multi-reps total < 8 KB: inline in CLIP_NEW.reps
- Larger: hash only; CLIP_REQUEST round-trip

## Pairing QR payload

    {
      "v": 1,
      "device_id": "clippy-desktop-abc123",
      "name": "Helios",
      "host": "192.168.1.42",
      "port": 43117,
      "psk":    "base64(32-byte secretbox key)",
      "pubkey": "base64(ed25519 public key, 32 bytes)"
    }
