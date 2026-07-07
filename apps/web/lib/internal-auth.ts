import { UnauthorizedError } from '@autotrade/engine/public';

/** Verify BOT_INTERNAL_SECRET for engine ↔ web server calls. */
export function verifyBotSecret(secret: string | null | undefined): void {
  const expected = process.env.BOT_INTERNAL_SECRET;
  if (!expected || secret !== expected) {
    throw new UnauthorizedError('Unauthorized');
  }
}

/**
 * Verify cron or internal automation auth.
 * Accepts CRON_SECRET or BOT_INTERNAL_SECRET via x-internal-secret header.
 */
export function verifyCronAuth(req: Request): void {
  const incoming = req.headers.get('x-internal-secret');
  const cronSecret = process.env.CRON_SECRET;
  const botSecret = process.env.BOT_INTERNAL_SECRET;

  const authHeader = req.headers.get('authorization');
  const bearer =
    authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (cronSecret && (incoming === cronSecret || bearer === cronSecret)) return;
  if (botSecret && (incoming === botSecret || bearer === botSecret)) return;

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
