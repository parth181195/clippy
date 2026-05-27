import sodium from 'libsodium-wrappers';

let ready = false;
export async function initCrypto(): Promise<void> {
  if (ready) return;
  await sodium.ready;
  ready = true;
}

/** 32-byte pre-shared key (secretbox). Generated at pairing time. */
export function generatePsk(): Uint8Array {
  return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
}

/** 32-byte ed25519 keypair. */
export function generateIdentity(): { pk: Uint8Array; sk: Uint8Array } {
  const kp = sodium.crypto_sign_keypair();
  return { pk: kp.publicKey, sk: kp.privateKey };
}

/**
 * Wire format: base64(nonce || ciphertext). One ws text frame per envelope.
 * The receiver splits the first NONCEBYTES as nonce and calls open on the rest.
 */
export function encryptEnvelope(psk: Uint8Array, plaintext: Uint8Array): string {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ct = sodium.crypto_secretbox_easy(plaintext, nonce, psk);
  const combined = new Uint8Array(nonce.length + ct.length);
  combined.set(nonce, 0);
  combined.set(ct, nonce.length);
  return sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
}

export function decryptEnvelope(psk: Uint8Array, b64: string): Uint8Array | null {
  try {
    const combined = sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);
    if (combined.length < sodium.crypto_secretbox_NONCEBYTES) return null;
    const nonce = combined.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
    const ct = combined.subarray(sodium.crypto_secretbox_NONCEBYTES);
    return sodium.crypto_secretbox_open_easy(ct, nonce, psk);
  } catch {
    return null;
  }
}

export function bytesToB64(b: Uint8Array): string {
  return sodium.to_base64(b, sodium.base64_variants.ORIGINAL);
}
export function b64ToBytes(s: string): Uint8Array {
  return sodium.from_base64(s, sodium.base64_variants.ORIGINAL);
}
