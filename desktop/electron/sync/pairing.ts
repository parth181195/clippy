import { networkInterfaces, hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { bytesToB64 } from './crypto';

function shortId(): string {
  return randomBytes(4).toString('hex');
}

/** QRs are valid for this window from generation; desktop enforces it
 *  authoritatively. Mobile may use the embedded `ts` for an early reject toast. */
export const PAIRING_QR_TTL_MS = 60 * 1000;

export interface PairingPayload {
  v: number;
  device_id: string;
  name: string;
  host: string;
  port: number;
  psk: string;
  pubkey: string;
  /** When the QR was generated (epoch ms). `ts + PAIRING_QR_TTL_MS` is the deadline. */
  ts?: number;
  /** Unique-per-QR id. Desktop tracks consumed ones to enforce single-use. */
  qr_id?: string;
}

/**
 * Pick the first non-loopback LAN IPv4 address. Prefers RFC1918 ranges
 * (192.168, 10.0, 172.16-31) — those are reachable from a phone on the
 * same WiFi network.
 */
export function pickLanIp(): string {
  const ifaces = networkInterfaces();
  const candidates: string[] = [];
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const a of list) {
      if (a.family !== 'IPv4' || a.internal) continue;
      candidates.push(a.address);
    }
  }
  const isPrivate = (ip: string) =>
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip);
  const priv = candidates.find(isPrivate);
  return priv ?? candidates[0] ?? '127.0.0.1';
}

export function makePairingPayload(opts: {
  deviceName: string;
  deviceId?: string;
  port: number;
  psk: Uint8Array;
  pubkey: Uint8Array;
}): PairingPayload {
  return {
    v: 1,
    device_id: opts.deviceId ?? `clippy-desktop-${shortId()}`,
    name: opts.deviceName || hostname() || 'desktop',
    host: pickLanIp(),
    port: opts.port,
    psk: bytesToB64(opts.psk),
    pubkey: bytesToB64(opts.pubkey),
    ts: Date.now(),
    qr_id: randomBytes(16).toString('hex'),
  };
}

export async function payloadToQrSvg(payload: PairingPayload): Promise<string> {
  const json = JSON.stringify(payload);
  return QRCode.toString(json, {
    type: 'svg',
    margin: 1,
    color: { dark: '#16161F', light: '#FFFFFF' },
    width: 240,
  });
}

/**
 * BIP39-ish short code for QR-camera-failure fallback. We base32 the PSK
 * and chunk into 4-char groups. User types this on the phone.
 */
export function payloadToShortCode(payload: PairingPayload): string {
  // Base32 of PSK bytes (no padding, lowercased) — chunked into 4-char groups.
  const ALPHA = 'abcdefghijklmnopqrstuvwxyz234567';
  const bytes = Buffer.from(payload.psk, 'base64');
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += ALPHA[(value >> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 0x1f];
  return out.match(/.{1,4}/g)?.join('-') ?? out;
}
