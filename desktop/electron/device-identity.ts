import sodium from 'libsodium-wrappers';
import type { Db } from './db';

/** This desktop's long-lived ed25519 keypair + stable device_id.
 *  Generated lazily on first request and persisted in `device_identity`. */
export interface DeviceIdentity {
  deviceId: string;
  publicKey: Uint8Array;   // 32 bytes
  privateKey: Uint8Array;  // 64 bytes (libsodium ed25519 secret-key form)
}

let cached: DeviceIdentity | null = null;

export async function getDeviceIdentity(db: Db): Promise<DeviceIdentity> {
  if (cached) return cached;
  await sodium.ready;

  const row = db
    .raw()
    .prepare(
      "SELECT device_id, public_key, private_key FROM device_identity WHERE k = 'self'"
    )
    .get() as { device_id: string; public_key: Buffer; private_key: Buffer } | undefined;

  if (row) {
    cached = {
      deviceId: row.device_id,
      publicKey: new Uint8Array(row.public_key),
      privateKey: new Uint8Array(row.private_key),
    };
    return cached;
  }

  // First launch on this desktop — generate + persist.
  const kp = sodium.crypto_sign_keypair();
  const deviceId = `clippy-desktop-${sodium.to_hex(sodium.randombytes_buf(8))}`;
  db.raw()
    .prepare(
      `INSERT INTO device_identity(k, device_id, public_key, private_key, created_at)
       VALUES ('self', ?, ?, ?, ?)`
    )
    .run(deviceId, Buffer.from(kp.publicKey), Buffer.from(kp.privateKey), Date.now());

  cached = { deviceId, publicKey: kp.publicKey, privateKey: kp.privateKey };
  return cached;
}

/** Sign `message` with this device's private key (ed25519 detached). */
export async function signWithDeviceKey(
  db: Db,
  message: Uint8Array
): Promise<Uint8Array> {
  const id = await getDeviceIdentity(db);
  await sodium.ready;
  return sodium.crypto_sign_detached(message, id.privateKey);
}
