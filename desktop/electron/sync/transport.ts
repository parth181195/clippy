import { WebSocketServer, WebSocket } from 'ws';
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

export interface TransportEvents {
  onEnvelope: (env: Envelope) => void;
  onConnect: (peer: string) => void;
  onDisconnect: () => void;
}

/**
 * Pluggable transport interface. v1 ships only LanWebSocketServer; the
 * interface exists so a Bluetooth or other transport can slot in later
 * without touching the dispatcher.
 */
export interface SyncTransport {
  name(): string;
  send(env: Envelope): Promise<void>;
  close(): Promise<void>;
}

export class LanWebSocketServer implements SyncTransport {
  private wss: WebSocketServer | null = null;
  private peer: WebSocket | null = null;
  private psk: Uint8Array;
  private port: number;
  private events: TransportEvents;

  constructor(port: number, psk: Uint8Array, events: TransportEvents) {
    this.port = port;
    this.psk = psk;
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
      log(`peer connected: ${peerAddr}`);
      // Single-peer for v1 — newest connection wins.
      if (this.peer) {
        try { this.peer.close(); } catch {}
      }
      this.peer = ws;
      this.events.onConnect(peerAddr);

      ws.on('message', (raw, isBinary) => {
        if (isBinary) return;
        const b64 = raw.toString();
        const pt = decryptEnvelope(this.psk, b64);
        if (!pt) {
          log('decrypt failed; dropping frame');
          return;
        }
        try {
          const env = JSON.parse(new TextDecoder().decode(pt)) as Envelope;
          this.events.onEnvelope(env);
        } catch (e) {
          log(`envelope parse failed: ${e}`);
        }
      });

      ws.on('close', () => {
        log(`peer disconnected: ${peerAddr}`);
        if (this.peer === ws) {
          this.peer = null;
          this.events.onDisconnect();
        }
      });

      ws.on('error', (e) => log(`peer error: ${e}`));
    });
    this.wss.on('error', (e) => log(`wss error: ${e}`));
  }

  async send(env: Envelope): Promise<void> {
    if (!this.peer || this.peer.readyState !== WebSocket.OPEN) return;
    const pt = new TextEncoder().encode(JSON.stringify(env));
    const b64 = encryptEnvelope(this.psk, pt);
    this.peer.send(b64);
  }

  async close(): Promise<void> {
    try { this.peer?.close(); } catch {}
    this.peer = null;
    await new Promise<void>((r) => this.wss?.close(() => r()));
    this.wss = null;
  }

  isConnected(): boolean {
    return this.peer?.readyState === WebSocket.OPEN;
  }
}
