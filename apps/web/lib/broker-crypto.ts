import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function getBrokerEncryptionKey(): Buffer {
  const raw = process.env.BROKER_ENCRYPTION_KEY;
  if (!raw) throw new Error('BROKER_ENCRYPTION_KEY is not set in environment variables');
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return Buffer.from(raw, 'base64');
}

export function decryptBrokerSecret(stored: string): string {
  const key = getBrokerEncryptionKey();
  const parts = stored.split(':');
  const ivB64 = parts[0];
  const tagB64 = parts[1];
  const cipherB64 = parts[2];
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Invalid encrypted broker secret format');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

export function encryptBrokerSecret(plaintext: string): string {
  const key = getBrokerEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}
