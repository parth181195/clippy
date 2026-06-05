import { randomBytes } from 'node:crypto';

function uuid(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type PluginName = 'core' | 'clipboard' | 'file_transfer';

export interface Envelope {
  type: string;
  id: string;
  ts: number;
  plugin: PluginName;
  payload: Record<string, any>;
  /** Sender identity attached at send time (multi-pair attribution). Optional
   *  for backward compatibility with v0.1 peers. */
  from?: { device_id: string; name: string };
}

export function makeEnvelope(plugin: PluginName, type: string, payload: Record<string, any>): Envelope {
  return { type, id: uuid(), ts: Date.now(), plugin, payload };
}

// Common envelope type constants for type-safety at call sites.
export const TYPES = {
  HELLO: 'HELLO',
  ACK: 'ACK',
  CLIP_NEW: 'CLIP_NEW',
  CLIP_REQUEST: 'CLIP_REQUEST',
  CLIP_LIST: 'CLIP_LIST',
  SYNC_REQUEST: 'SYNC_REQUEST',
  // core: best-effort notification that the sender has unpaired (multi-pair).
  UNPAIR: 'UNPAIR',
  // file_transfer plugin
  FILE_OFFER: 'FILE_OFFER',
  FILE_ACCEPT: 'FILE_ACCEPT',
  FILE_CHUNK: 'FILE_CHUNK',
  FILE_DONE: 'FILE_DONE',
  FILE_CANCEL: 'FILE_CANCEL',
} as const;

/** Allowed clock skew for signed HELLO timestamps (see PRD P4). */
export const HELLO_SKEW_MS = 300 * 1000;

export const FILE_TRANSFER = {
  CHUNK_SIZE: 32 * 1024, // 32 KB raw per chunk; base64 framing ~43 KB
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB v1 cap (inline storage in clips.content)
} as const;
