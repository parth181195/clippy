# Multi-Device Pairing — PRD

**Status:** spec, not yet implemented.
**Scope:** symmetric N:N pairing — a phone can be paired to N desktops, and a desktop can be paired to N phones.
**Out of scope (v1):** desktop ↔ desktop sync; phone ↔ phone sync; relaying clips between phones via a shared desktop.

---

## 1. Background

Clippy v0.1 is hard-wired single-peer on the phone:

- The phone stores **one** `pairing` blob in secure storage and runs **one** WebSocket.
- The desktop schema (`paired_devices`) already permits multiple rows, but the running code treats the WS server as single-purpose, with no UI for managing multiple phones.

Users with two desktops (e.g., personal + work) can't see clips from both on their phone. Users with two phones can't see clips on both. This PRD specifies the change.

## 2. Goals & non-goals

**Goals**

- A phone can pair with N desktops and receive clips from any of them.
- A desktop can pair with N phones and push clips to any of them.
- Each paired device is independently visible, manageable, and removable.
- Each clip on the recipient is labeled with its source device.
- The user can choose which device to **send** a file/clip to.
- Existing single-pair installs upgrade silently — no re-pairing forced.

**Non-goals**

- Cross-device routing (desktop relays phone-A's clip to phone-B). Optional in v2.
- Group/role management beyond a per-device "primary" flag.
- Cross-account or remote (non-LAN) pairing.

## 3. User stories

1. *"I have a work laptop and a personal desktop. I want my phone to mirror clipboard from both."*
2. *"I have a Pixel and an old Galaxy. I want both phones to receive clips from my desktop."*
3. *"When I see a clip on my phone, I want to know which machine it came from."*
4. *"When I send a screenshot from my phone, I want to pick which laptop receives it."*
5. *"If I retire one of my machines, I want to unpair just that one without losing the others."*

## 4. Functional requirements

### 4.1 Mobile (phone)

| # | Requirement |
|---|---|
| M1 | Phone stores **N** pairings, each with its own `device_id`, name, host, port, PSK, pubkey, `paired_at`, `last_seen`. |
| M2 | Phone runs **N parallel WebSocket connections**, one per paired desktop, each gated by the foreground/background handoff. |
| M3 | Each incoming frame is decrypted with the PSK of the connection it arrived on. Failed decrypt drops the frame and surfaces a one-time toast (debug). |
| M4 | Each incoming `CLIP_NEW` is written to the local DB tagged with `source_device_id` and `source_device_name`. |
| M5 | The Settings screen shows a **list** of paired desktops with name, connection state, last-seen, and a per-row Unpair action. |
| M6 | The Pair flow supports "Pair another desktop" — adding to the list rather than replacing. |
| M7 | The Send flow lets the user choose a target desktop. If only one is paired, no picker. Default target = last active (configurable). |
| M8 | The Recent list shows the source device name on each clip row; a per-device filter is available. |
| M9 | mDNS rescue runs **per pairing** when that connection has failed N times. |
| M10 | A **per-target outbox** queues sends to offline desktops. Entries flush in FIFO order on reconnect; entries older than **24 h** are purged on next app open. UI shows queued count per device. |
| M11 | Every clip in history has a **"Send to…"** action that re-sends it (text/file/image) to any paired desktop. If the target is offline, the send goes through the outbox. |
| M12 | Phone signs every `HELLO` with its **ed25519 private key** (generated and stored in secure storage at pairing). Replays are prevented by including `ts` + a fresh `nonce` in the signed payload. |
| M13 | **Pairing cap**: soft-warn the user at **4** pairings, hard-block at **8** (UI prevents scanning a 9th QR). |
| M14 | **Idle suspend**: a non-primary connection that has been quiet (no inbound + no outbound) for **30 min** is dropped to save battery. It reconnects on the next outbound send or on the next foreground resume. The primary connection is never auto-suspended. |
| M15 | **Settings → Diagnostics** screen exposes, per connection: name, host:port, state, last-connected, reconnect-count today, last decrypt-fail timestamp, signature-verify count. Copy-as-text button for bug reports. |
| M16 | **Rename a paired device** in-place from the Settings row's `…` menu — local label only, doesn't change `device_id`. |
| M17 | A **Primary device** flag (mobile-side: the desktop the user marks as primary) is the default Send target and the only connection exempt from idle-suspend. Exactly one or zero per phone. |
| M18 | **Encrypted export/import of pairings**: the user can export their pairings as an encrypted file (sealed-box with a user passphrase) and import it on a replacement phone. |
| M19 | **Per-device Do-Not-Disturb / quiet hours**: a schedule per paired desktop that suppresses inbound notifications (but still queues incoming clips). |

### 4.2 Desktop

| # | Requirement |
|---|---|
| D1 | The WS server accepts and tracks N concurrent inbound connections, one per paired phone. *(Schema already permits this.)* |
| D2 | Each session is keyed by HELLO's `device_id`; the server looks up the matching PSK in `paired_devices`. |
| D3 | Outbound `CLIP_NEW` (text-shaped auto-sync) is **broadcast** to every connected paired phone unless that phone is muted (per-device `auto_sync_outgoing`). |
| D4 | Outbound file/image sends require an explicit target phone picker. |
| D5 | The Settings → Devices view lists all paired phones with last-seen, connection state, unpair, and a "Mute auto-sync" per-device toggle. |
| D6 | Stored clips received from a phone are tagged with `source_device_id` and rendered with a small device chip in the panel. |
| D7 | The pairing QR can be generated any time, multiple times, without invalidating existing pairings. |
| D8 | Desktop has a **per-target outbox** symmetric to M10 — queues sends to offline phones, flushes FIFO on reconnect, purges entries older than 24 h on next launch. |
| D9 | Right-click on a panel clip exposes **"Send to → `<phone>`"** for every connected paired phone, mirroring the phone's M11. |
| D10 | Desktop **verifies the ed25519 signature** on every inbound HELLO against the stored `pubkey` for that `device_id`. A row whose `is_revoked = 1` is rejected regardless. The Devices UI exposes a **Revoke** action that flips the flag immediately. |
| D11 | Desktop enforces the **soft-warn-at-4, hard-block-at-8** pairing cap symmetric to M13 and refuses to generate a new QR past the hard cap. |
| D12 | **Settings → Diagnostics** screen mirrors M15 for each connected phone. |
| D13 | **Rename a paired phone** in-place from the row's `…` menu (local label only). |
| D14 | **Primary phone** flag — the default target for explicit sends and a tie-breaker for broadcast-to-all when one needs to be chosen. |
| D15 | **Per-device Do-Not-Disturb / quiet hours** on outbound auto-sync to a phone (queues but doesn't push during the window). |

### 4.3 Shared protocol

| # | Requirement |
|---|---|
| P1 | Envelope gains an optional `from`: `{ device_id, name }` populated by the sender for clips and file events. |
| P2 | `HELLO` is unchanged but mandatory on every reconnect. |
| P3 | A new `core/UNPAIR` envelope notifies the peer to forget the pairing on its side (best-effort, fire-and-forget). |
| P4 | `HELLO` payload gains `signature` (base64 ed25519) and `nonce` (16 random bytes). The signed material is `device_id ‖ ts ‖ nonce`. Receivers reject HELLOs that fail verification, are older than **300 s** (cross-device clock-drift allowance), or whose nonce repeats within the last 10 minutes. |
| P5 | The pairing QR carries a `valid_until` timestamp (60 s window) and a `qr_id` (UUID). The QR is **single-use**: the desktop forgets the QR's PSK/nonce after the first successful HELLO using it. Scanning an expired or already-consumed QR shows "QR expired — generate a new one." |
| P4 | Pairing-QR payload `v` bumps to `2` if any structural change is needed; otherwise stays at `v=1`. Initial spec keeps `v=1`. |

## 5. Data model changes

### 5.1 Mobile (sqflite + secure storage)

**Secure storage**: replace `pairing` (single JSON blob) with a JSON array, OR add a `pairings` key and migrate on first read.

```jsonc
[
  { "v": 1, "device_id": "clippy-desk-abc", "name": "Helios",
    "host": "192.168.1.42", "port": 43117, "psk": "<base64>", "pubkey": "<base64>",
    "paired_at": 1735000000000, "last_seen": 1735090000000, "primary": true }
]
```

**`clips` table**: add `source_device_id TEXT`, `source_device_name TEXT`. Existing rows are NULL.

**`settings`** (or shared prefs): `default_send_target_device_id` (nullable; null means "last active"), `primary_device_id` (nullable).

**Secure storage adds**:
- `private_key` (base64 ed25519 private key, generated on first launch and never exported except via M18).
- `pairings[].primary` (bool) and `pairings[].dnd_window` (`HH:MM-HH:MM` local) per pairing.

**`outbox` table (sqflite)**:

```sql
CREATE TABLE outbox (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_device_id TEXT NOT NULL,
  kind         TEXT NOT NULL,         -- 'text' | 'image' | 'file' | 'resend'
  clip_id      INTEGER,                -- nullable; for resend points at clips.id
  payload_blob BLOB,                  -- inline content for non-resend sends
  meta_json    TEXT,                   -- {mime, name, size, ...}
  created_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT
);
CREATE INDEX idx_outbox_target ON outbox(target_device_id, created_at);
```

### 5.2 Desktop (sqlite, `paired_devices`)

Existing schema:

```sql
paired_devices (device_id PK, name, pubkey, psk, paired_at)
```

Add columns (one migration):

```sql
ALTER TABLE paired_devices ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE paired_devices ADD COLUMN auto_sync_outgoing INTEGER NOT NULL DEFAULT 1;
ALTER TABLE paired_devices ADD COLUMN device_kind TEXT NOT NULL DEFAULT 'phone';
ALTER TABLE paired_devices ADD COLUMN primary_device INTEGER NOT NULL DEFAULT 0;
ALTER TABLE paired_devices ADD COLUMN is_revoked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE paired_devices ADD COLUMN dnd_window TEXT;          -- 'HH:MM-HH:MM' local
ALTER TABLE paired_devices ADD COLUMN local_label TEXT;          -- D13 in-place rename

-- One-time outbox table, symmetric to mobile.
CREATE TABLE outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  clip_id INTEGER REFERENCES clips(id) ON DELETE SET NULL,
  payload_blob BLOB,
  meta_json TEXT,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX idx_outbox_target ON outbox(target_device_id, created_at);

-- Desktop ed25519 private key (single row, kept in app userData, never exported).
CREATE TABLE IF NOT EXISTS device_identity (
  k TEXT PRIMARY KEY,                  -- always 'self'
  private_key BLOB NOT NULL,
  public_key  BLOB NOT NULL,
  device_id   TEXT NOT NULL
);
```

**`clips` table**: add `source_device_id TEXT` (nullable). The existing `source_app` field stays for desktop-app provenance; `source_device_id` is for network provenance.

## 6. Architecture

### 6.1 Mobile — `SyncService` → `SyncPool`

`SyncService` becomes `SyncPool` managing a list of `SyncConnection` objects, one per pairing. Each `SyncConnection` owns:

- its own `IOWebSocketChannel`, PSK, retry timer, exponential backoff, mDNS rescue, and connectivity listener
- a `ConnState` per connection
- the foreground/background handoff fires on the **pool** (suspend-all / resume-all), not per-connection

The background isolate runs **one** foreground service that internally manages the same pool. The fg ↔ bg invokes (`app_foreground` / `app_background`) stay pool-level.

Inbound dispatch: a connection's `_onMessage` decrypts with its own PSK, then forwards the envelope to a shared `MessageRouter` that does the DB write + UI notify. `MessageRouter` is agnostic of which connection delivered the frame; the connection's `device_id` is attached to the envelope before routing.

Outbound dispatch:

- Auto-sync (text-shaped on copy): send to every connected, non-muted desktop.
- Explicit send (file/image): send only to the chosen target.

`requestSync()` (manual sync) is broadcast to all.

### 6.2 Desktop — already multi-peer

`SyncService` already accepts multiple inbound connections via WebSocket server. Required changes:

- Track active sessions in a map `Map<deviceId, Session>` rather than a single peer.
- Broadcast outbound clips to all sessions whose `auto_sync_outgoing` is true.
- Targeted file sends accept a `target_device_id` from the renderer.
- `EVT_CONN_STATE` event payload becomes a list of `{ deviceId, name, state }` rather than a single status; renderer renders a list.

### 6.3 Foreground service (mobile)

Pool semantics:

- On `app_foreground`: foreground UI's `SyncPool` connects all; bg isolate's pool suspends all.
- On `app_background`: foreground pool suspends; bg isolate pool resumes all.
- Each pool connects N WS in parallel; reconnects are per-connection so a flaky desktop doesn't stall the others.

Battery considerations:

- bg isolate uses the same exp-backoff per connection but caps total active reconnects (e.g., max 3 attempts in flight at once).
- Optional: a "sync paused" master toggle to drop the entire pool when on cellular.

## 7. UI requirements

### 7.1 Mobile

**Settings → Devices** (new, replaces single device card)

- Header: "Paired desktops" + Pair-another button.
- Rows: device name, last-seen, connection chip (green/orange/grey), `…` menu (Unpair, Rename, Set as default send target).
- Empty state ("No desktops paired") with prominent Pair button.

**Recent screen**

- Each clip row gets a small chip "from `<device-name>`" right of the type badge.
- New filter pill "Source" → dropdown of paired devices.

**Send screen**

- If 0 devices: disabled with "Pair a desktop to send".
- If 1 device: show "Sending to `<name>`".
- If 2+: a `To` dropdown (default = last active or user-pinned).

**Pair screen**

- Scan QR → if `device_id` already in list, replace it (re-pair); else append. Confirm dialog when replacing.

### 7.2 Desktop

**Settings → Devices**

- List of paired phones; per row: name, last-seen, connection chip, mute auto-sync toggle, Unpair button, Set primary.
- Pair new device button generates a new QR each time.

**Panel (history)**

- Clip cards from phones get a tiny device chip next to the source-app icon (e.g., `↘ Pixel 7`).
- Sending: in Send/Share menu, when 2+ phones are connected, show a "To" picker; default to primary or last-active.

## 8. Pairing flow (multi-pair)

1. User taps **Pair new device** on desktop A → QR with desktop A's `{device_id, name, host, port, psk, pubkey}`.
2. User scans on phone → phone appends pairing to list, opens WS to A.
3. On HELLO, phone sends its `{device_id, name}`. Desktop A inserts/updates `paired_devices` row keyed by the phone's `device_id`.
4. Repeat with desktop B. Now phone has two pairings; runs two WS in parallel.
5. Conversely, desktop A can pair with phone-2; the same QR can be reused **only until phone-1 scans** — new pairing = new PSK per session. Desktop generates a fresh QR per pair-add (PSK is single-use).

## 9. Send semantics

| Action | Behavior |
|---|---|
| Phone copies text → auto-sync to desktop | broadcast to all paired desktops with `auto_sync_outgoing=true` |
| Desktop copies text → auto-sync to phone | broadcast to all connected paired phones with `auto_sync_outgoing=true` |
| Phone explicit file send | requires a target device picker (or default) |
| Desktop explicit file send | requires a target device picker (or default) |
| Manual "Sync now" on phone | sends `SYNC_REQUEST` to every connected desktop |

A user-set **primary device** (per side) is the default target for explicit sends and the implied "this is my main machine" for tie-breaks.

## 10. Migration

- **Phone**: first launch on the new build reads the legacy `pairing` key; if present, wraps into a single-entry list under `pairings` and deletes the old key. `paired_at` is copied; `last_seen` defaults to 0.
- **Desktop**: SQLite migration adds the four new columns with safe defaults. Existing rows become non-muted, non-primary phones.
- **Backward compatibility**: a v0.1 phone connecting to a v0.2 desktop sees no breaking change (envelope `from` is optional, `UNPAIR` is ignored). A v0.2 phone connecting to a v0.1 desktop: clips arrive without `source_device_id` (graceful fallback in UI).

## 11. Security

- **Per-pairing PSK** — never reused across pairs. PSK is generated at QR-build time on the desktop and committed to `paired_devices` only after a successful first HELLO (so an aborted scan doesn't pollute the DB).
- **Device identity** — every device generates a long-lived ed25519 keypair on first launch. The pubkey is exchanged in the QR and HELLO; HELLO is signed with the private key and verified by the receiver. PSK gives encryption; signed HELLO gives device-bound identity.
- **QR exposure** — the QR is **single-use** with a 60 s `valid_until`. A QR left visible past the window is useless. If a second device tries to scan a consumed QR, it fails.
- **Revocation** — `paired_devices.is_revoked = 1` causes the desktop to reject every future HELLO from that `device_id`, even when frames decrypt. Set instantly from the Devices UI's *Revoke* button. There is no "un-revoke" — re-pair to restore.
- **Unpair** — local-only by default. `UNPAIR` is sent best-effort; the receiver removes the row if it arrives. If lost, the orphan pairing on the other side eventually shows as "Offline" and the user can unpair (or revoke) manually.
- **Same-device re-pair** — replacing a `device_id` is allowed (new PSK + new pubkey supersedes); UI confirms before overwriting.
- **Encrypted backup (M18)** — the export blob is sealed with `crypto_secretbox` using `Argon2id(passphrase, salt)`. Import requires the passphrase. The blob contains pairings (PSKs, hosts, names, primary flags) and the phone's ed25519 private key. Losing the passphrase is unrecoverable by design.

## 12. Edge cases & open questions

| Topic | Notes |
|---|---|
| Two desktops with the same `name` ("MacBook") | Allowed; UI shows last 4 chars of `device_id` to disambiguate. |
| Same phone shows up twice in `paired_devices` | Shouldn't happen — keyed by `device_id`. Re-pair updates the row in place. |
| Phone is connected to A but B is offline | A's clips flow normally; B retries with backoff; UI shows mixed states per device. |
| User unpaired on phone but desktop still has the row | Desktop will see the WS not reconnect; row stays until user unpairs there or after a configurable stale-after timeout (default 30 days). |
| ~~Open~~ **Resolved**: Send when target is offline | Queue locally in a **per-device outbox**; flush in order on reconnect. Each entry expires **24 hours** after creation and is purged on next app open. No hard size cap; UI shows queued count per device. |
| ~~Open~~ **Resolved**: Re-send any existing clip | Any clip in history (text, code, link, color, file, image) can be re-sent from its action menu: *Send to…* → device picker → fires immediately or enqueues if the target is offline. Works regardless of which device originally produced the clip. |
| ~~Open~~ **Resolved**: does the desktop relay phone-A's clip to phone-B? | **No** — not in v1, not planned. The primary axis is *one phone ↔ N desktops*; phone is the aggregator. Desktop-side multi-phone is incidental (schema/protocol allow it) but not the UX focus. |
| **Open**: do paired desktops see *each other's* clips via the phone? | No, phone is a sink, not a hub. |
| Same `content_hash` arrives from multiple sources | Dedup by hash on the recipient; record all source devices in a join table (optional). |
| Battery on multi-WS phone | Sum of N WS is acceptable for ≤4 desktops; consider a "low-power" mode that suspends non-primary connections after 30 min idle. |
| ~~Open~~ **Resolved**: pubkey-signed HELLO for explicit device auth + revocation | **Yes, in v1.** Each device generates a long-lived ed25519 keypair at pairing. Every HELLO carries a signature over `{device_id, ts, nonce}` made with the private key; the receiver verifies it with the stored pubkey for that `device_id`. Adds device-bound identity (PSK leak ≠ device takeover) and per-device **revocation** (kill-switch from the Devices UI). |

## 13. Phasing

**v1 (single plan — no deferred phases).** Everything in this PRD ships together:

- Multi-pair core: phone `SyncPool` (N parallel WS, per-PSK decrypt, per-conn backoff + mDNS rescue), desktop multi-session map, broadcast auto-sync, envelope `from`, `UNPAIR`, pairing cap (4 soft / 8 hard), pairing-QR TTL + single-use.
- Outbox + re-send: per-target outbox on both sides (24 h purge), per-clip *Send to…* action.
- Identity & security: ed25519 keypair per device, signed HELLO with 300 s skew + nonce replay window, `is_revoked` + Revoke UI.
- Device management: rename, primary, per-device DnD/quiet hours, per-device auto-sync mute.
- Operability: Diagnostics screen on both sides.
- Migration: encrypted export/import of pairings (M18).
- Quality: explicit test matrix (§14) gated on release.

**Explicitly out of scope** (won't ship and won't be deferred either):

- Desktop relaying clips between phones.
- Desktop ↔ desktop or phone ↔ phone direct sync.
- Cross-LAN / remote pairing.

## 14. Acceptance criteria

v1 is accepted if **every** row of the test matrix below passes on a fresh install of both clients.

### Functional matrix

| # | Topology | Scenario | Pass condition |
|---|---|---|---|
| 1 | 1↔1 | Pair, copy text on desktop | Appears on phone <1 s, labeled with source |
| 2 | 1↔N (N=2) | Pair phone with two desktops; copy on each | Both clips land on phone, correctly labeled, in order |
| 3 | 1↔N (N=4) | Same with 4 desktops | All four arrive; phone Settings shows 4 rows with live state |
| 4 | 1↔N | Try to pair a 9th | UI blocks before QR scan with the hard-cap message; soft warning visible from 5th onwards |
| 5 | N↔1 | Two phones paired to one desktop; copy on desktop | Both phones receive within 1 s |
| 6 | N↔M (2↔2) | Cross product: copy on each desktop | Each clip reaches both phones with correct source label |
| 7 | Send to offline | Phone send-to-desktop-B while B is unreachable | Outbox shows queued; B comes online → flushes in order; entry >24 h purged on next launch |
| 8 | Re-send | Pick a clip from history → *Send to → A* | Lands on A (or queues if offline) regardless of original source |
| 9 | Network partition | Kill desktop-A's Wi-Fi mid-stream | Desktop-B keeps flowing; A reconnects on its own; queued items drain in order |
| 10 | Clock skew | Set phone clock +4 min relative to desktop | Sign-HELLO still accepted (300 s window); +6 min rejects |
| 11 | Revocation | Revoke phone-A on desktop | A's reconnect attempts are rejected; A's diagnostics screen surfaces "revoked"; A's outbox to that desktop is dropped |
| 12 | QR replay | Scan a QR twice from different phones | Second scan rejected; "QR consumed — generate a new one" |
| 13 | QR expiry | Wait 90 s after QR generation, scan | Rejected with "QR expired" |
| 14 | Backup/restore | Export pairings → import on a clean phone | All pairings + primary flag + DnD windows restored; first reconnects succeed |
| 15 | Idle suspend | Leave non-primary desktop idle 30 min | Connection drops; primary stays up; new send wakes the dropped one |
| 16 | Migration | Open v0.2 build on a v0.1 single-pair install | Pairing carried forward; no re-pair prompt; clips continue to flow |

### Non-functional gates

- Cold-start on the phone with N=4 pairings within **1.2×** single-pair baseline.
- Decrypt failure logged as a non-fatal Sentry breadcrumb tagged `decrypt_failed_psk_mismatch` (unless no matching pairing exists, in which case dropped silently).
- Sign-verify failure tagged `hello_signature_invalid` with `device_id`.
- No Sentry events fired for normal idle-suspend disconnects.
