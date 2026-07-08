import { createHash, timingSafeEqual } from 'node:crypto';
import { UnauthorizedError } from '@autotrade/engine/public';

/** Constant-time string compare (hashes first so lengths need not match). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function extractIncomingSecret(req: Request): string | null {
  const header = req.headers.get('x-internal-secret');
  if (header) return header;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length);
  return null;
}

/** Verify BOT_INTERNAL_SECRET for engine ↔ web server calls. */
export function verifyBotSecret(secret: string | null | undefined): void {
  const expected = process.env.BOT_INTERNAL_SECRET;
  if (!expected || !secret || !safeEqual(secret, expected)) {
    throw new UnauthorizedError('Unauthorized');
  }
}

/**
 * Verify cron or internal automation auth.
 * Accepts CRON_SECRET or BOT_INTERNAL_SECRET via x-internal-secret / Bearer.
 */
export function verifyCronAuth(req: Request): void {
  const incoming = extractIncomingSecret(req);
  if (!incoming) throw new UnauthorizedError('Unauthorized');

  const cronSecret = process.env.CRON_SECRET;
  const botSecret = process.env.BOT_INTERNAL_SECRET;

  if (cronSecret && safeEqual(incoming, cronSecret)) return;
  if (botSecret && safeEqual(incoming, botSecret)) return;

  throw new UnauthorizedError('Unauthorized');
}

/** Returns true when the request carries a valid cron/internal secret. */
export function isCronOrBotAuth(req: Request): boolean {
  try {
    verifyCronAuth(req);
    return true;
  } catch {
    return false;
  }
}

/** Returns true when the request carries a valid BOT_INTERNAL_SECRET. */
export function isBotAuth(req: Request): boolean {
  try {
    verifyBotSecret(extractIncomingSecret(req));
    return true;
  } catch {
    return false;
  }
}
