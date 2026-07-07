/** AES-256-GCM helpers for broker credential encryption (no native deps). */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

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
  const ivHex = parts[0] as string;
  const tagHex = parts[1] as string;
  const ctHex = parts[2] as string;
  const decipher = createDecipheriv(AES_ALGO, keyBuf(hexKey), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8');
}
