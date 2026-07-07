/** Legacy password hashing — worker/desktop only; not used by the web app. */
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';

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

/** Deterministic SHA-256 of a token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
