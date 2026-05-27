import { createHash } from 'node:crypto';
import type { Db } from '../../db';
import { makeEnvelope, FILE_TRANSFER, TYPES, type Envelope } from '../protocol';
import { b64ToBytes, bytesToB64 } from '../crypto';

export interface FileTransferDeps {
  db: Db;
  send: (env: Envelope) => Promise<void>;
  /** Called after a fully-received file lands in the DB as a clip. */
  onRemoteClipInserted?: (clipId: number) => void;
  /** Progress hook for both inbound (direction='in') and outbound ('out'). */
  onProgress?: (p: TransferProgress) => void;
}

export interface TransferProgress {
  transferId: string;
  direction: 'in' | 'out';
  name: string;
  kind: 'image' | 'file';
  sent: number;
  total: number;
  done: boolean;
  failed?: string;
}

interface InboundTransfer {
  offer: {
    transferId: string;
    name: string;
    mime: string;
    size: number;
    hash: string;
    kind: 'image' | 'file';
    chunkCount: number;
    chunkSize: number;
  };
  received: Buffer[];
  receivedBytes: number;
  cancelled: boolean;
}

interface OutboundTransfer {
  transferId: string;
  content: Buffer;
  chunkSize: number;
  cancelled: boolean;
  name: string;
  kind: 'image' | 'file';
}

export class FileTransferPlugin {
  private inbound = new Map<string, InboundTransfer>();
  private outbound = new Map<string, OutboundTransfer>();

  constructor(private deps: FileTransferDeps) {}

  /** Send a clip's bytes to the peer. Returns the transfer_id (for cancel/progress). */
  async sendClip(clipId: number): Promise<string | null> {
    const row = this.deps.db
      .raw()
      .prepare('SELECT content_type, content, mime FROM clips WHERE id = ?')
      .get(clipId) as { content_type: string; content: Buffer; mime: string } | undefined;
    if (!row) return null;
    return this.sendBytes(row.content, row.mime, row.content_type === 'image' ? 'image' : 'file');
  }

  /** Send raw bytes (used by clip send + arbitrary file picker). */
  async sendBytes(
    content: Buffer,
    mime: string,
    kind: 'image' | 'file',
    name?: string
  ): Promise<string> {
    if (content.length > FILE_TRANSFER.MAX_FILE_SIZE) {
      throw new Error(`file too large (${content.length}B > ${FILE_TRANSFER.MAX_FILE_SIZE}B v1 cap)`);
    }
    const hash = createHash('sha256').update(content).digest('hex');
    const chunkSize = FILE_TRANSFER.CHUNK_SIZE;
    const chunkCount = Math.ceil(content.length / chunkSize);
    const transferId = `${Date.now().toString(16)}-${hash.slice(0, 12)}`;
    const finalName = name ?? `clip-${transferId}.${mimeToExt(mime)}`;
    const offer = makeEnvelope('file_transfer', TYPES.FILE_OFFER, {
      transfer_id: transferId,
      name: finalName,
      mime,
      kind,
      size: content.length,
      hash,
      chunk_count: chunkCount,
      chunk_size: chunkSize,
    });
    this.outbound.set(transferId, { transferId, content, chunkSize, cancelled: false, name: finalName, kind });
    await this.deps.send(offer);
    this.deps.onProgress?.({
      transferId, direction: 'out', name: finalName, kind,
      sent: 0, total: content.length, done: false,
    });
    return transferId;
  }

  cancel(transferId: string, reason = 'user_cancelled'): void {
    const out = this.outbound.get(transferId);
    if (out) out.cancelled = true;
    const inb = this.inbound.get(transferId);
    if (inb) inb.cancelled = true;
    this.deps.send(makeEnvelope('file_transfer', TYPES.FILE_CANCEL, { transfer_id: transferId, reason })).catch(() => {});
    this.outbound.delete(transferId);
    this.inbound.delete(transferId);
  }

  async handle(env: Envelope): Promise<void> {
    if (env.type === TYPES.FILE_OFFER) return this.onOffer(env);
    if (env.type === TYPES.FILE_ACCEPT) return this.onAccept(env);
    if (env.type === TYPES.FILE_CHUNK) return this.onChunk(env);
    if (env.type === TYPES.FILE_DONE) return this.onDone(env);
    if (env.type === TYPES.FILE_CANCEL) return this.onCancel(env);
  }

  private async onOffer(env: Envelope): Promise<void> {
    const p = env.payload;
    const transferId = p['transfer_id'] as string;
    const size = p['size'] as number;
    if (size > FILE_TRANSFER.MAX_FILE_SIZE) {
      await this.deps.send(makeEnvelope('file_transfer', TYPES.FILE_CANCEL, {
        transfer_id: transferId, reason: 'too_large',
      }));
      return;
    }
    this.inbound.set(transferId, {
      offer: {
        transferId,
        name: p['name'] as string,
        mime: p['mime'] as string,
        size,
        hash: p['hash'] as string,
        kind: (p['kind'] as 'image' | 'file') ?? 'file',
        chunkCount: p['chunk_count'] as number,
        chunkSize: p['chunk_size'] as number,
      },
      received: new Array(p['chunk_count'] as number),
      receivedBytes: 0,
      cancelled: false,
    });
    await this.deps.send(makeEnvelope('file_transfer', TYPES.FILE_ACCEPT, {
      transfer_id: transferId, start_chunk: 0,
    }));
  }

  private async onAccept(env: Envelope): Promise<void> {
    const transferId = env.payload['transfer_id'] as string;
    const startChunk = (env.payload['start_chunk'] as number) ?? 0;
    const out = this.outbound.get(transferId);
    if (!out) return;
    const total = out.content.length;
    for (let i = startChunk; i < Math.ceil(total / out.chunkSize); i++) {
      if (out.cancelled) return;
      const start = i * out.chunkSize;
      const slice = out.content.subarray(start, Math.min(start + out.chunkSize, total));
      await this.deps.send(makeEnvelope('file_transfer', TYPES.FILE_CHUNK, {
        transfer_id: transferId,
        chunk_index: i,
        data: bytesToB64(new Uint8Array(slice)),
      }));
      this.deps.onProgress?.({
        transferId, direction: 'out', name: out.name, kind: out.kind,
        sent: Math.min(start + slice.length, total), total, done: false,
      });
    }
    await this.deps.send(makeEnvelope('file_transfer', TYPES.FILE_DONE, {
      transfer_id: transferId, ok: true,
    }));
    this.deps.onProgress?.({
      transferId, direction: 'out', name: out.name, kind: out.kind,
      sent: total, total, done: true,
    });
    this.outbound.delete(transferId);
  }

  private onChunk(env: Envelope): void {
    const transferId = env.payload['transfer_id'] as string;
    const t = this.inbound.get(transferId);
    if (!t || t.cancelled) return;
    const idx = env.payload['chunk_index'] as number;
    const bytes = Buffer.from(b64ToBytes(env.payload['data'] as string));
    t.received[idx] = bytes;
    t.receivedBytes += bytes.length;
    this.deps.onProgress?.({
      transferId, direction: 'in', name: t.offer.name, kind: t.offer.kind,
      sent: t.receivedBytes, total: t.offer.size, done: false,
    });
  }

  private onDone(env: Envelope): void {
    const transferId = env.payload['transfer_id'] as string;
    const t = this.inbound.get(transferId);
    if (!t) return;
    this.inbound.delete(transferId);
    if (t.cancelled) return;
    const full = Buffer.concat(t.received.filter(Boolean) as Buffer[]);
    if (full.length !== t.offer.size) return;
    const actualHash = createHash('sha256').update(full).digest('hex');
    if (actualHash !== t.offer.hash) return; // integrity check
    const now = Date.now();
    const { id, wasNew } = this.deps.db.insertClip(
      t.offer.kind,
      full,
      t.offer.mime,
      t.offer.name,
      'from phone',
      now
    );
    if (!wasNew) {
      // Duplicate content_hash — bump created_at so the row sorts to top
      // and the renderer notices it as a "new" arrival.
      this.deps.db.raw()
        .prepare('UPDATE clips SET created_at = ? WHERE id = ?')
        .run(now, id);
    }
    this.deps.onRemoteClipInserted?.(id);
    this.deps.onProgress?.({
      transferId, direction: 'in', name: t.offer.name, kind: t.offer.kind,
      sent: t.offer.size, total: t.offer.size, done: true,
    });
  }

  private onCancel(env: Envelope): void {
    const transferId = env.payload['transfer_id'] as string;
    this.inbound.delete(transferId);
    this.outbound.delete(transferId);
  }
}

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return 'bin';
}
