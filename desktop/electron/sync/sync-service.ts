import sodium from 'libsodium-wrappers';
import type { Db } from '../db';
import type { ContentType } from '../ipc-types';
import { initCrypto, generatePsk, generateIdentity, b64ToBytes, bytesToB64 } from './crypto';
import { LanWebSocketServer, type PskCandidate, type TransportSession } from './transport';
import { ClipboardPlugin } from './plugins/clipboard-plugin';
import { FileTransferPlugin, type TransferProgress } from './plugins/file-transfer-plugin';
import { MdnsAdvertise } from './discovery';
import { makePairingPayload, payloadToQrSvg, payloadToShortCode, PAIRING_QR_TTL_MS, type PairingPayload } from './pairing';
import { makeEnvelope, type Envelope, TYPES, HELLO_SKEW_MS } from './protocol';
import { enqueueResend, readForDevice, removeEntry, bumpAttempts } from './outbox';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export const SYNC_PORT = 43117;

function log(msg: string) {
  try {
    appendFileSync(
      join(app.getPath('userData'), 'clippy', 'sync.log'),
      `[${new Date().toISOString()}] [svc] ${msg}\n`
    );
  } catch {}
  console.log('[sync-svc]', msg);
}

export type ConnState = 'unpaired' | 'connecting' | 'connected' | 'disconnected';

export interface SyncServiceDeps {
  db: Db;
  onConnStateChange?: (state: ConnState, deviceName: string | null) => void;
  isOutgoingEnabled: () => boolean;
  isIncomingEnabled: () => boolean;
  onRemoteClipInserted?: (clipId: number) => void;
  onTransferProgress?: (p: TransferProgress) => void;
}

export class SyncService {
  private deps: SyncServiceDeps;
  private transport: LanWebSocketServer | null = null;
  private mdns: MdnsAdvertise | null = null;
  private clipPlugin: ClipboardPlugin | null = null;
  private filePlugin: FileTransferPlugin | null = null;
  private state: ConnState = 'unpaired';
  private deviceName: string | null = null;
  private deviceId: string | null = null;
  private pendingPsk: Uint8Array | null = null; // PSK held during pairing flow
  private pendingPubkey: Uint8Array | null = null;
  private pendingQrId: string | null = null;     // single-use enforcement (P5)
  private pendingQrTs: number = 0;                // QR TTL deadline base
  private consumedQrIds = new Set<string>();     // recently-burned QRs
  private backfilledDevices = new Set<string>();
  /** Active phone sessions keyed by device_id (populated after HELLO). */
  private sessionsByDevice = new Map<string, TransportSession>();

  constructor(deps: SyncServiceDeps) {
    this.deps = deps;
  }

  state_(): ConnState { return this.state; }
  pairedDeviceName(): string | null { return this.deviceName; }

  private setState(s: ConnState, name?: string | null) {
    if (this.state === s && this.deviceName === (name ?? this.deviceName)) return;
    this.state = s;
    if (name !== undefined) this.deviceName = name;
    log(`state → ${s} (${this.deviceName ?? 'no device'})`);
    this.deps.onConnStateChange?.(this.state, this.deviceName);
  }

  /** Called when a new local clip is captured; the sync server (if any) emits CLIP_NEW. */
  onLocalClip(clipId: number, contentType: ContentType): void {
    if (this.clipPlugin) this.clipPlugin.onLocalClip(clipId, contentType).catch((e) => log(`onLocalClip: ${e}`));
  }

  async start(): Promise<void> {
    await initCrypto();
    const all = this.loadAllPaired();
    if (all.length === 0) {
      this.setState('unpaired', null);
      return;
    }
    const primary = all.find((d) => d.is_primary) ?? all[0];
    this.deviceName = primary.name;
    this.deviceId = primary.device_id;
    await this.bringUp();
  }

  async stop(): Promise<void> {
    await this.transport?.close();
    this.transport = null;
    this.mdns?.stop();
    this.mdns = null;
    this.clipPlugin = null;
    this.setState('unpaired');
  }

  /** Generate a fresh pairing payload + QR. Saves the PSK/identity to memory
   *  pending HELLO from the phone. */
  async beginPairing(localDeviceName: string): Promise<{
    qrSvg: string;
    shortCode: string;
    payload: PairingPayload;
  }> {
    await initCrypto();
    const psk = generatePsk();
    const id = generateIdentity();
    this.pendingPsk = psk;
    this.pendingPubkey = id.pk;
    const payload = makePairingPayload({
      deviceName: localDeviceName,
      port: SYNC_PORT,
      psk,
      pubkey: id.pk,
    });
    this.pendingQrId = payload.qr_id ?? null;
    this.pendingQrTs = payload.ts ?? Date.now();
    // Spin up the transport in pairing-mode listening so the phone's HELLO can
    // complete the pairing. The pending PSK is exposed as a candidate via the
    // transport's pskResolver below.
    if (!this.transport) await this.bringUp();
    this.setState('connecting', this.deviceName);
    return {
      qrSvg: await payloadToQrSvg(payload),
      shortCode: payloadToShortCode(payload),
      payload,
    };
  }

  /** Cancel an in-progress pairing (panel closed, etc.). */
  cancelPairing(): void {
    this.pendingPsk = null;
    this.pendingPubkey = null;
    this.pendingQrId = null;
    this.pendingQrTs = 0;
    if (!this.loadPairedDevice()) {
      this.stop().catch(() => {});
    }
  }

  /** Unpair: drop saved device + tear down sync. */
  async unpair(): Promise<void> {
    this.deps.db.raw().prepare('DELETE FROM paired_devices').run();
    await this.stop();
  }

  /** Build the candidate-PSK list for the transport: the pending pairing PSK
   *  (if any) plus every paired_devices row that isn't revoked. */
  private buildCandidatePsks = (): PskCandidate[] => {
    const out: PskCandidate[] = [];
    if (this.pendingPsk) {
      out.push({ psk: this.pendingPsk, source: 'pending-pairing' });
    }
    try {
      const rows = this.deps.db
        .raw()
        .prepare('SELECT device_id, psk FROM paired_devices WHERE is_revoked = 0')
        .all() as Array<{ device_id: string; psk: Buffer }>;
      for (const r of rows) {
        out.push({ psk: new Uint8Array(r.psk), source: 'paired-device', deviceId: r.device_id });
      }
    } catch {}
    return out;
  };

  private async bringUp(): Promise<void> {
    if (this.transport) return;
    const transport = new LanWebSocketServer(SYNC_PORT, this.buildCandidatePsks, {
      onConnect: (s) => {
        log(`session ${s.id} opened from ${s.peerAddr}`);
      },
      onDisconnect: (s) => {
        if (s.deviceId) this.sessionsByDevice.delete(s.deviceId);
        log(`session ${s.id} closed (${s.deviceName ?? s.peerAddr})`);
        this.refreshAggregateState();
      },
      onEnvelope: (env, s) => this.dispatch(env, s).catch((e) => log(`dispatch: ${e}`)),
    });
    await transport.start();
    this.transport = transport;
    this.clipPlugin = new ClipboardPlugin({
      db: this.deps.db,
      isOutgoingEnabled: this.deps.isOutgoingEnabled,
      isIncomingEnabled: this.deps.isIncomingEnabled,
      send: (env) => transport.send(env),
      onRemoteClipInserted: (id) => {
        log(`remote clip inserted #${id}`);
        this.deps.onRemoteClipInserted?.(id);
      },
    });
    this.filePlugin = new FileTransferPlugin({
      db: this.deps.db,
      send: (env) => transport.send(env),
      onRemoteClipInserted: (id) => {
        log(`remote file received → clip #${id}`);
        this.deps.onRemoteClipInserted?.(id);
      },
      onProgress: (p) => this.deps.onTransferProgress?.(p),
    });
    this.mdns = new MdnsAdvertise();
    this.mdns.start({
      name: this.deviceName ?? 'clippy-desktop',
      deviceId: this.deviceId ?? 'clippy-desktop',
      port: SYNC_PORT,
      version: app.getVersion(),
    });
  }

  private refreshAggregateState(): void {
    const liveCount = this.transport?.liveSessionCount() ?? 0;
    const anyPaired = this.loadAllPaired().length > 0;
    if (liveCount > 0) {
      // Use the most-recently-active session's name as the "current" label.
      const lastNamed = Array.from(this.sessionsByDevice.values()).at(-1);
      this.setState('connected', lastNamed?.deviceName ?? this.deviceName);
    } else if (anyPaired) {
      this.setState('disconnected');
    } else {
      this.setState('unpaired');
    }
  }

  private async dispatch(env: Envelope, session: TransportSession): Promise<void> {
    log(`recv ${env.plugin}/${env.type} (sess=${session.id} dev=${session.deviceId ?? '?'})`);
    if (env.type === TYPES.HELLO) {
      const name = (env.payload['name'] as string) || 'phone';
      const deviceId = (env.payload['device_id'] as string) || 'phone';
      const pubkeyB64 = (env.payload['pubkey'] as string) || '';
      const sigB64 = (env.payload['signature'] as string) || '';
      const nonceB64 = (env.payload['nonce'] as string) || '';

      // Pairing path — pendingPsk set means this HELLO is the QR being consumed.
      if (this.pendingPsk) {
        // P5: QR TTL + single-use enforcement.
        const expired = Date.now() - this.pendingQrTs > PAIRING_QR_TTL_MS;
        const consumed = this.pendingQrId !== null && this.consumedQrIds.has(this.pendingQrId);
        if (expired || consumed) {
          log(`pair refused: QR ${expired ? 'expired' : 'already consumed'}`);
          this.pendingPsk = null;
          this.pendingPubkey = null;
          this.pendingQrId = null;
          this.pendingQrTs = 0;
          return; // No ACK — phone gets timeout, shows "QR expired".
        }
        try {
          this.deps.db
            .raw()
            .prepare(
              `INSERT OR REPLACE INTO paired_devices(device_id, name, pubkey, psk, paired_at, last_seen)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(
              deviceId, name,
              Buffer.from(pubkeyB64 ? b64ToBytes(pubkeyB64) : new Uint8Array()),
              Buffer.from(this.pendingPsk), Date.now(), Date.now()
            );
          if (this.pendingQrId) this.consumedQrIds.add(this.pendingQrId);
          this.pendingPsk = null;
          this.pendingPubkey = null;
          this.pendingQrId = null;
          this.pendingQrTs = 0;
          log(`paired with "${name}" (${deviceId})`);
        } catch (e) {
          log(`pair persist failed: ${e}`);
        }
      } else {
        // Reconnect path — phone we already know. Verify revocation + signature.
        // Legacy heal: if the transport pre-keyed this session via a paired_devices
        // PSK match but the HELLO carries a different device_id (a phone upgraded
        // from v0.1 which had a hardcoded 'clippy-phone' id), rewrite the row
        // to the canonical DeviceIdentity id BEFORE the row lookup.
        const preKeyed = session.deviceId;
        if (preKeyed && preKeyed !== deviceId) {
          try {
            const existing = this.deps.db.raw().prepare(
              'SELECT 1 FROM paired_devices WHERE device_id = ?'
            ).get(deviceId) as { 1: number } | undefined;
            if (!existing) {
              this.deps.db.raw().prepare(
                'UPDATE paired_devices SET device_id = ? WHERE device_id = ?'
              ).run(deviceId, preKeyed);
              log(`healed paired_devices.device_id ${preKeyed} → ${deviceId}`);
            }
          } catch (e) {
            log(`heal paired_devices failed: ${e}`);
          }
        }
        const row = this.deps.db.raw().prepare(
          'SELECT pubkey, is_revoked FROM paired_devices WHERE device_id = ?'
        ).get(deviceId) as { pubkey: Buffer; is_revoked: number } | undefined;
        if (row?.is_revoked === 1) {
          log(`HELLO refused: device_id=${deviceId} is revoked`);
          return; // no ACK — phone will see the connection drop.
        }
        if (row && row.pubkey && row.pubkey.length === 32 && sigB64 && nonceB64) {
          await initCrypto();
          const ts = env.ts;
          const skew = Math.abs(Date.now() - ts);
          if (skew > HELLO_SKEW_MS) {
            log(`HELLO refused: clock skew ${Math.round(skew / 1000)}s for ${deviceId}`);
            return;
          }
          const message = Buffer.from(`${deviceId}|${ts}|${nonceB64}`, 'utf8');
          const sig = b64ToBytes(sigB64);
          try {
            const ok = sodium.crypto_sign_verify_detached(sig, message, new Uint8Array(row.pubkey));
            if (!ok) {
              log(`HELLO refused: bad signature from ${deviceId}`);
              return;
            }
          } catch (e) {
            log(`HELLO signature verify error from ${deviceId}: ${e}`);
            return;
          }
        }
        // Once we've accepted this HELLO, store the phone's pubkey if we don't
        // have one yet (legacy v0.1 rows have an empty BLOB). Future HELLOs will
        // then go through signature verification.
        if (pubkeyB64 && (!row || !row.pubkey || row.pubkey.length !== 32)) {
          try {
            const pubBytes = b64ToBytes(pubkeyB64);
            if (pubBytes.length === 32) {
              this.deps.db.raw()
                .prepare('UPDATE paired_devices SET pubkey = ? WHERE device_id = ?')
                .run(Buffer.from(pubBytes), deviceId);
              log(`stored pubkey for ${deviceId} (was empty)`);
            }
          } catch (e) {
            log(`pubkey upgrade failed for ${deviceId}: ${e}`);
          }
        }
        this.deps.db.raw()
          .prepare('UPDATE paired_devices SET last_seen = ? WHERE device_id = ?')
          .run(Date.now(), deviceId);
      }

      // Attach identity to the session + map it for targeted sends.
      session.deviceId = deviceId;
      session.deviceName = name;
      this.sessionsByDevice.set(deviceId, session);
      this.deviceName = name;
      this.deviceId = deviceId;
      this.refreshAggregateState();
      await this.transport?.send(
        makeEnvelope('core', TYPES.ACK, { ref_id: env.id }),
        deviceId
      );
      // Backfill recent history on every HELLO. Receiver UNIQUE(content_hash)
      // drops dupes and the bump-on-conflict path keeps existing rows on top,
      // so re-sending is cheap and survives re-installs.
      this.clipPlugin?.sendHistory().catch((e) => log(`sendHistory: ${e}`));
      // Drain anything queued for this device while it was offline (PRD M10/D8).
      this.flushOutboxFor(deviceId).catch((e) => log(`outbox flush: ${e}`));
      return;
    }
    if (env.type === TYPES.UNPAIR) {
      const peerId = env.from?.device_id ?? this.deviceId ?? '';
      if (peerId) {
        try {
          this.deps.db.raw().prepare('DELETE FROM paired_devices WHERE device_id = ?').run(peerId);
          log(`UNPAIR received → forgot ${peerId}`);
        } catch (e) {
          log(`UNPAIR failed: ${e}`);
        }
      }
      return;
    }
    if (env.type === TYPES.SYNC_REQUEST) {
      log('recv core/SYNC_REQUEST → resending history');
      this.clipPlugin?.sendHistory().catch((e) => log(`sendHistory: ${e}`));
      return;
    }
    if (env.plugin === 'clipboard') {
      await this.clipPlugin?.handle(env);
    }
    if (env.plugin === 'file_transfer') {
      await this.filePlugin?.handle(env);
    }
  }

  /** Send a clip's bytes to the paired peer (used for explicit image/file send). */
  async sendClipToPeer(clipId: number): Promise<string | null> {
    if (!this.filePlugin) return null;
    return this.filePlugin.sendClip(clipId);
  }

  /** Snapshot of paired devices + live connection state for the renderer's
   *  multi-pair UI. */
  listDevices(): Array<{
    deviceId: string;
    name: string;
    isPrimary: boolean;
    isRevoked: boolean;
    isConnected: boolean;
    lastSeen: number;
  }> {
    try {
      const rows = this.deps.db
        .raw()
        .prepare(
          `SELECT device_id, name, primary_device AS is_primary,
                  is_revoked, last_seen, local_label
             FROM paired_devices
            ORDER BY primary_device DESC, last_seen DESC`
        )
        .all() as Array<{
        device_id: string;
        name: string;
        is_primary: number;
        is_revoked: number;
        last_seen: number;
        local_label: string | null;
      }>;
      return rows.map((r) => ({
        deviceId: r.device_id,
        name: r.local_label || r.name,
        isPrimary: r.is_primary === 1,
        isRevoked: r.is_revoked === 1,
        isConnected: this.sessionsByDevice.has(r.device_id),
        lastSeen: r.last_seen,
      }));
    } catch {
      return [];
    }
  }

  /** Send (or enqueue) a clip to a specific paired phone (PRD D9). For
   *  text-shaped clips this fires a targeted CLIP_NEW; for files/images it
   *  reuses the existing file plugin (broadcast at this stage). When the
   *  target is offline the request goes to the outbox and drains on reconnect. */
  async sendClipToDevice(clipId: number, deviceId: string): Promise<void> {
    const connected = this.sessionsByDevice.has(deviceId);
    if (!connected) {
      enqueueResend(this.deps.db, deviceId, clipId);
      return;
    }
    const row = this.deps.db
      .raw()
      .prepare(
        `SELECT content_type, mime, content, content_hash, preview
           FROM clips WHERE id = ?`
      )
      .get(clipId) as
      | { content_type: string; mime: string; content: Buffer; content_hash: string; preview: string }
      | undefined;
    if (!row) return;
    const textShaped =
      row.content_type === 'text' || row.content_type === 'link' ||
      row.content_type === 'code' || row.content_type === 'color' ||
      row.content_type === 'emoji';
    if (textShaped) {
      const env = makeEnvelope('clipboard', TYPES.CLIP_NEW, {
        kind: row.content_type,
        mime: row.mime,
        preview: row.preview,
        hash: row.content_hash,
        content_inline: row.content.toString('base64'),
      });
      await this.transport?.send(env, deviceId);
    } else {
      await this.filePlugin?.sendClip(clipId);
    }
  }

  /** Drain a single device's outbox FIFO. Stops on the first error. */
  private async flushOutboxFor(deviceId: string): Promise<void> {
    const entries = readForDevice(this.deps.db, deviceId);
    for (const e of entries) {
      try {
        if (e.kind === 'resend' && e.clipId != null) {
          await this.sendClipToDevice(e.clipId, deviceId);
        }
        removeEntry(this.deps.db, e.id);
      } catch (err) {
        bumpAttempts(this.deps.db, e.id, String(err));
        break;
      }
    }
  }

  /** Push the current theme mode + accent hex to the phone. */
  async sendTheme(mode: string, accent: string): Promise<void> {
    if (!this.transport) return;
    try { await this.transport.send(makeEnvelope('core', 'THEME', { mode, accent })); } catch {}
  }

  private loadPairedDevice(): { deviceId: string; name: string; psk: Uint8Array } | null {
    try {
      const row = this.deps.db
        .raw()
        .prepare('SELECT device_id, name, psk FROM paired_devices WHERE is_revoked = 0 ORDER BY primary_device DESC, last_seen DESC LIMIT 1')
        .get() as { device_id: string; name: string; psk: Buffer } | undefined;
      if (!row) return null;
      return { deviceId: row.device_id, name: row.name, psk: new Uint8Array(row.psk) };
    } catch {
      return null;
    }
  }

  /** Every non-revoked paired phone. Used by the candidate-PSK builder + the
   *  aggregate state checker. */
  private loadAllPaired(): Array<{ device_id: string; name: string; psk: Buffer; is_primary: number }> {
    try {
      return this.deps.db
        .raw()
        .prepare(
          `SELECT device_id, name, psk, primary_device AS is_primary
             FROM paired_devices
            WHERE is_revoked = 0
            ORDER BY primary_device DESC, last_seen DESC`
        )
        .all() as Array<{ device_id: string; name: string; psk: Buffer; is_primary: number }>;
    } catch {
      return [];
    }
  }
}

export type { PairingPayload } from './pairing';
