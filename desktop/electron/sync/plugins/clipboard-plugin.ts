import type { Db } from '../../db';
import { isTextShaped, type ContentType } from '../../ipc-types';
import { makeEnvelope, type Envelope, TYPES } from '../protocol';
import { b64ToBytes, bytesToB64 } from '../crypto';

export interface ClipboardPluginDeps {
  db: Db;
  /** Whether to send local CLIP_NEW events to the peer. */
  isOutgoingEnabled: () => boolean;
  /** Whether to accept CLIP_NEW envelopes from the peer. */
  isIncomingEnabled: () => boolean;
  /** Send an envelope back over the transport (set after wiring). */
  send: (env: Envelope) => Promise<void>;
}

const INLINE_LIMIT = 4096;

/**
 * Auto-syncs text-shaped clips between peers. text/link/code/color/emoji only.
 * image and file NEVER cross the wire here — they go through FileTransfer in Phase 3
 * after an explicit user gesture.
 */
export class ClipboardPlugin {
  constructor(private deps: ClipboardPluginDeps) {}

  /**
   * Called by the main clipboard pipeline when a new clip is captured locally.
   * Sends CLIP_NEW for text-shaped clips if outgoing-sync is enabled.
   */
  async onLocalClip(clipId: number, contentType: ContentType): Promise<void> {
    if (!this.deps.isOutgoingEnabled()) return;
    if (!isTextShaped(contentType)) return;
    const row = this.deps.db
      .raw()
      .prepare('SELECT content, mime, content_hash, preview FROM clips WHERE id = ?')
      .get(clipId) as { content: Buffer; mime: string; content_hash: string; preview: string } | undefined;
    if (!row) return;
    const payload: Record<string, any> = {
      kind: contentType,
      mime: row.mime,
      preview: row.preview.slice(0, 280),
      hash: row.content_hash,
    };
    if (row.content.length <= INLINE_LIMIT) {
      payload.content_inline = bytesToB64(new Uint8Array(row.content));
    }
    await this.deps.send(makeEnvelope('clipboard', TYPES.CLIP_NEW, payload));
  }

  /** Called by the dispatcher when an envelope arrives from the peer. */
  async handle(env: Envelope): Promise<void> {
    if (!this.deps.isIncomingEnabled()) return;
    if (env.type === TYPES.CLIP_NEW) {
      const inline = env.payload['content_inline'] as string | undefined;
      if (!inline) return; // for v1, only inlined clips are accepted; CLIP_REQUEST round-trip is Phase 2.5
      const kind = env.payload['kind'] as ContentType;
      const mime = (env.payload['mime'] as string) || 'text/plain';
      const preview = (env.payload['preview'] as string) || '';
      let bytes: Uint8Array;
      try {
        bytes = b64ToBytes(inline);
      } catch {
        return;
      }
      this.deps.db.insertClip(
        kind,
        Buffer.from(bytes),
        mime,
        preview,
        'from phone',
        Date.now()
      );
    }
  }
}
