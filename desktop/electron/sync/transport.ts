import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes } from 'node:crypto';
import { decryptEnvelope, encryptEnvelope } from './crypto';
import { Envelope } from './protocol';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

function log(msg: string) {
  try {
    appendFileSync(
      join(app.getPath('userData'), 'clippy', 'sync.log'),
      `[${new Date().toISOString()}] ${msg}\n`
    );
  } catch {}
  console.log('[sync]', msg);
}

/** Candidate PSKs to try when a fresh session sends its first frame. */
export interface PskCandidate {
  psk: Uint8Array;
  /** Where this PSK came from — useful for logging once matched. */
  source: 'pending-pairing' | 'paired-device';
  deviceId?: string;
}

/** Per-connection state for the multi-peer transport. */
export interface TransportSession {
  readonly id: string;
  readonly peerAddr: string;
  /** Set once the first frame decrypts with one of the candidates. */
  psk: Uint8Array | null;
  /** Set once HELLO is processed by the dispatcher. */
  deviceId: string | null;
  deviceName: string | null;
}

export interface TransportEvents {
  onConnect: (session: TransportSession) => void;
  onEnvelope: (env: Envelope, session: TransportSession) => void;
  onDisconnect: (session: TransportSession) => void;
}

export interface SyncTransport {
  name(): string;
  /** Broadcast unless `targetDeviceId` is given, in which case only matching sessions. */
  send(env: Envelope, targetDeviceId?: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Multi-peer LAN WebSocket server. Tracks one session per inbound connection
 * and decrypts frames using a per-session PSK that gets locked in on the first
 * successful decrypt (picked from `candidatePsks()`). Pairing's pending PSK is
 * one of those candidates until HELLO consumes it.
 */
export class LanWebSocketServer implements SyncTransport {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<WebSocket, TransportSession>();
  private port: number;
  private candidatePsks: () => PskCandidate[];
  private events: TransportEvents;

  constructor(
    port: number,
    candidatePsks: () => PskCandidate[],
    events: TransportEvents
  ) {
    this.port = port;
    this.candidatePsks = candidatePsks;
    this.events = events;
  }

  name(): string {
    return 'lan_websocket';
  }

  async start(): Promise<void> {
    this.wss = new WebSocketServer({ port: this.port, host: '0.0.0.0' });
    log(`ws server listening on :${this.port}`);
    this.wss.on('connection', (ws, req) => {
      const peerAddr = req.socket.remoteAddress ?? 'unknown';
      const session: TransportSession = {
        id: randomBytes(8).toString('hex'),
        peerAddr,
        psk: null,
        deviceId: null,
        deviceName: null,
      };
      this.sessions.set(ws, session);
      log(`peer connected: ${peerAddr} session=${session.id}`);
      this.events.onConnect(session);

      ws.on('message', (raw, isBinary) => {
        if (isBinary) return;
        const b64 = raw.toString();
        let pt: Uint8Array | null = null;
        if (session.psk) {
          pt = decryptEnvelope(session.psk, b64);
        }
        if (!pt) {
          // First frame on this session — try every candidate PSK and lock in
          // the one that matched.
          for (const cand of this.candidatePsks()) {
            const trial = decryptEnvelope(cand.psk, b64);
            if (trial) {
              session.psk = cand.psk;
              if (cand.deviceId) session.deviceId = cand.deviceId;
              pt = trial;
              log(`session ${session.id} keyed via ${cand.source}${cand.deviceId ? ` (${cand.deviceId})` : ''}`);
              break;
            }
          }
        }
        if (!pt) {
          log(`decrypt failed; no PSK matched for session ${session.id}`);
          return;
        }
        try {
          const env = JSON.parse(new TextDecoder().decode(pt)) as Envelope;
          this.events.onEnvelope(env, session);
        } catch (e) {
          log(`envelope parse failed: ${e}`);
        }
      });

      ws.on('close', () => {
        const s = this.sessions.get(ws);
        this.sessions.delete(ws);
        log(`peer disconnected: ${peerAddr} session=${session.id}`);
        if (s) this.events.onDisconnect(s);
      });

      ws.on('error', (e) => log(`peer error (${session.id}): ${e}`));
    });
    this.wss.on('error', (e) => log(`wss error: ${e}`));
  }

  async send(env: Envelope, targetDeviceId?: string): Promise<void> {
    const pt = new TextEncoder().encode(JSON.stringify(env));
    for (const [ws, session] of this.sessions) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (!session.psk) continue;
      if (targetDeviceId && session.deviceId !== targetDeviceId) continue;
      try {
        ws.send(encryptEnvelope(session.psk, pt));
      } catch (e) {
        log(`send failed on session ${session.id}: ${e}`);
      }
    }
  }

  async close(): Promise<void> {
    for (const ws of this.sessions.keys()) {
      try { ws.close(); } catch {}
    }
    this.sessions.clear();
    await new Promise<void>((r) => this.wss?.close(() => r()));
    this.wss = null;
  }

  /** How many sessions currently have an open WS. */
  liveSessionCount(): number {
    let n = 0;
    for (const ws of this.sessions.keys()) {
      if (ws.readyState === WebSocket.OPEN) n++;
    }
    return n;
  }

  /** Snapshot of all sessions (for diagnostics). */
  snapshotSessions(): TransportSession[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }
}
