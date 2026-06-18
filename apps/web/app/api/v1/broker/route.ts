import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, env, encryptSecret, decryptSecret } from '@autotrade/engine';
import { alpacaTradingBase } from '@autotrade/engine';
import { capture } from '@/lib/analytics';

const connectSchema = z.object({
  keyId: z.string().min(1),
  secret: z.string().min(1),
  paper: z.boolean().default(true),
});

function encKey(): string {
  if (!env.BROKER_ENCRYPTION_KEY) throw new Error('BROKER_ENCRYPTION_KEY is not set');
  return env.BROKER_ENCRYPTION_KEY;
}

async function verifyAlpacaKeys(
  keyId: string,
  secret: string,
  paper: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const base = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  try {
    const res = await fetch(`${base}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secret,
        Accept: 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'Invalid API keys' };
    if (!res.ok) return { ok: false, error: `Alpaca returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach Alpaca — check your internet connection' };
  }
}

/** GET /api/v1/broker — return connection status (never returns raw keys). */
export async function GET() {
  try {
    const user = await requireUser();
    const cred = await prisma.brokerCredential.findUnique({ where: { userId: user.id } });
    if (!cred) return ok({ connected: false });
    return ok({ connected: true, provider: cred.provider, paper: cred.paper });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/v1/broker — validate keys against Alpaca then save encrypted. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json() as unknown;
    const { keyId, secret, paper } = connectSchema.parse(body);

    const check = await verifyAlpacaKeys(keyId, secret, paper);
    if (!check.ok) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_KEYS', message: check.error } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const k = encKey();
    await prisma.brokerCredential.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: 'alpaca',
        keyId: encryptSecret(keyId, k),
        secret: encryptSecret(secret, k),
        paper,
      },
      update: {
        keyId: encryptSecret(keyId, k),
        secret: encryptSecret(secret, k),
        paper,
      },
    });

    // If switching to paper mode, also reset bot mode to PAPER.
    if (paper) {
      await prisma.botSettings.updateMany({
        where: { userId: user.id, mode: 'LIVE' },
        data: { mode: 'PAPER' },
      });
    }

    capture(user.id, { event: 'broker_connected', properties: { userId: user.id, broker: 'alpaca', paper } });
    return ok({ connected: true, provider: 'alpaca', paper });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/v1/broker — disconnect broker and reset to paper mode. */
export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.brokerCredential.deleteMany({ where: { userId: user.id } });
    await prisma.botSettings.updateMany({
      where: { userId: user.id },
      data: { mode: 'PAPER' },
    });
    return ok({ connected: false });
  } catch (err) {
    return handleError(err);
  }
}
