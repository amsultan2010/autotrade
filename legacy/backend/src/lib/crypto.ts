/** Password, token hashing, and symmetric encryption helpers. */
import argon2 from 'argon2';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Opaque, high-entropy token (used as the raw refresh token value). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Deterministic SHA-256 of a token. We store only this hash, never the raw
 * refresh token, so a DB leak does not expose usable tokens.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const AES_ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function keyBuf(hexKey: string): Buffer {
  const buf = Buffer.from(hexKey, 'hex');
  if (buf.length !== 32) throw new Error('BROKER_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return buf;
}

/** AES-256-GCM encrypt. Returns `iv:tag:ciphertext` as hex. */
export function encryptSecret(plain: string, hexKey: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_ALGO, keyBuf(hexKey), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** AES-256-GCM decrypt. Accepts `iv:tag:ciphertext` hex string. */
export function decryptSecret(payload: string, hexKey: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted payload format');
  const [ivHex, tagHex, ctHex] = parts as [string, string, string];
  const decipher = createDecipheriv(AES_ALGO, keyBuf(hexKey), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8');
}
