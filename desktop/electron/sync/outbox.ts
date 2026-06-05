import type { Db } from '../db';

/** One row of the desktop outbox table (schema in db.ts SCHEMA_V1). */
export interface OutboxEntry {
  id: number;
  targetDeviceId: string;
  /** 'text' | 'image' | 'file' | 'resend' — resend points at clip_id. */
  kind: string;
  clipId: number | null;
  payloadBlob: Buffer | null;
  metaJson: string | null;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

const TTL_MS = 24 * 60 * 60 * 1000;

export function enqueueResend(db: Db, targetDeviceId: string, clipId: number): number {
  const info = db
    .raw()
    .prepare(
      `INSERT INTO outbox(target_device_id, kind, clip_id, created_at)
       VALUES (?, 'resend', ?, ?)`
    )
    .run(targetDeviceId, clipId, Date.now());
  return Number(info.lastInsertRowid);
}

export function readForDevice(db: Db, targetDeviceId: string): OutboxEntry[] {
  const rows = db
    .raw()
    .prepare(
      `SELECT id, target_device_id, kind, clip_id, payload_blob, meta_json,
              created_at, attempts, last_error
         FROM outbox
        WHERE target_device_id = ?
        ORDER BY created_at ASC`
    )
    .all(targetDeviceId) as Array<{
    id: number;
    target_device_id: string;
    kind: string;
    clip_id: number | null;
    payload_blob: Buffer | null;
    meta_json: string | null;
    created_at: number;
    attempts: number;
    last_error: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    targetDeviceId: r.target_device_id,
    kind: r.kind,
    clipId: r.clip_id,
    payloadBlob: r.payload_blob,
    metaJson: r.meta_json,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
  }));
}

export function countForDevice(db: Db, targetDeviceId: string): number {
  const row = db
    .raw()
    .prepare('SELECT COUNT(*) AS n FROM outbox WHERE target_device_id = ?')
    .get(targetDeviceId) as { n: number };
  return row.n;
}

export function removeEntry(db: Db, id: number): void {
  db.raw().prepare('DELETE FROM outbox WHERE id = ?').run(id);
}

export function bumpAttempts(db: Db, id: number, error: string | null): void {
  db.raw()
    .prepare('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?')
    .run(error, id);
}

/** Drop entries older than 24 h. Call on app launch. */
export function purgeStale(db: Db): number {
  const cutoff = Date.now() - TTL_MS;
  const info = db
    .raw()
    .prepare('DELETE FROM outbox WHERE created_at < ?')
    .run(cutoff);
  return Number(info.changes);
}
