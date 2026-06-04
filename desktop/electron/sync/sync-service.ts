import sodium from 'libsodium-wrappers';
import type { Db } from '../db';
import type { ContentType } from '../ipc-types';
import { initCrypto, generatePsk, generateIdentity, b64ToBytes, bytesToB64 } from './crypto';
import { LanWebSocketServer } from './transport';
import { ClipboardPlugin } from './plugins/clipboard-plugin';
import { FileTransferPlugin, type TransferProgress } from './plugins/file-transfer-plugin';
import { MdnsAdvertise } from './discovery';
import { makePairingPayload, payloadToQrSvg, payloadToShortCode, PAIRING_QR_TTL_MS, type PairingPayload } from './pairing';
import { makeEnvelope, type Envelope, TYPES, HELLO_SKEW_MS } from './protocol';
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
    // If a paired device exists, bring up the server immediately.
    const paired = this.loadPairedDevice();
    if (!paired) {
      this.setState('unpaired', null);
      return;
    }
    this.deviceName = paired.name;
    this.deviceId = paired.deviceId;
    await this.bringUp(paired.psk);
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
    // Spin up the transport in unpaired-but-listening mode so the phone's
    // HELLO completes the pairing.
    if (!this.transport) await this.bringUp(psk);
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

  private async bringUp(psk: Uint8Array): Promise<void> {
    if (this.transport) return;
    const transport = new LanWebSocketServer(SYNC_PORT, psk, {
      onConnect: (peer) => {
        log(`peer connected from ${peer}`);
        this.setState('connected');
      },
      onDisconnect: () => {
        log('peer disconnected');
        if (this.loadPairedDevice()) this.setState('disconnected');
        else this.setState('unpaired');
      },
      onEnvelope: (env) => this.dispatch(env).catch((e) => log(`dispatch: ${e}`)),
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

  private async dispatch(env: Envelope): Promise<void> {
    log(`recv ${env.plugin}/${env.type}`);
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
        this.deps.db.raw()
          .prepare('UPDATE paired_devices SET last_seen = ? WHERE device_id = ?')
          .run(Date.now(), deviceId);
      }

      this.deviceName = name;
      this.deviceId = deviceId;
      this.setState('connected', name);
      await this.transport?.send(makeEnvelope('core', TYPES.ACK, { ref_id: env.id }));
      // Backfill recent history on every HELLO. Receiver UNIQUE(content_hash)
      // drops dupes and the bump-on-conflict path keeps existing rows on top,
      // so re-sending is cheap and survives re-installs.
      this.clipPlugin?.sendHistory().catch((e) => log(`sendHistory: ${e}`));
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

  /** Push the current theme mode + accent hex to the phone. */
  async sendTheme(mode: string, accent: string): Promise<void> {
    if (!this.transport) return;
    try { await this.transport.send(makeEnvelope('core', 'THEME', { mode, accent })); } catch {}
  }

  private loadPairedDevice(): { deviceId: string; name: string; psk: Uint8Array } | null {
    try {
      const row = this.deps.db
        .raw()
        .prepare('SELECT device_id, name, psk FROM paired_devices LIMIT 1')
        .get() as { device_id: string; name: string; psk: Buffer } | undefined;
      if (!row) return null;
      return { deviceId: row.device_id, name: row.name, psk: new Uint8Array(row.psk) };
    } catch {
      return null;
    }
  }
}

export type { PairingPayload } from './pairing';
