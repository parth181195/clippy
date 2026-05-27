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
} as const;
