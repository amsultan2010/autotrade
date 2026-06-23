/**
 * Internal endpoint — syncs broker credentials from Convex into Postgres so
 * the bot engine can load them via loadUserBroker().
 * Called by the Convex brokerCredentialActions after storing encrypted keys in
 * Convex. This route re-encrypts with the engine's AES-256-GCM hex format.
 * Protected by BOT_INTERNAL_SECRET — never exposed to clients.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { prisma, encryptSecret, env } from '@autotrade/engine/public';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.BOT_INTERNAL_SECRET;
  return !!secret && req.headers.get('x-internal-secret') === secret;
}

/** POST { clerkId, keyId, secret, paper } — upsert BrokerCredential in Postgres. */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encKey = env.BROKER_ENCRYPTION_KEY;
  if (!encKey) {
    return NextResponse.json({ error: 'BROKER_ENCRYPTION_KEY not configured' }, { status: 500 });
  }

  let body: { clerkId?: string; keyId?: string; secret?: string; paper?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { clerkId, keyId, secret, paper } = body;
  if (!clerkId || !keyId || !secret || paper === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const encryptedKeyId = encryptSecret(keyId, encKey);
  const encryptedSecret = encryptSecret(secret, encKey);

  await prisma.brokerCredential.upsert({
    where: { userId: user.id },
    create: { userId: user.id, provider: 'alpaca', keyId: encryptedKeyId, secret: encryptedSecret, paper },
    update: { keyId: encryptedKeyId, secret: encryptedSecret, paper },
  });

  // Switching to paper? Downgrade any active LIVE bot mode.
  if (paper) {
    await prisma.botSettings.updateMany({
      where: { userId: user.id, mode: 'LIVE' },
      data: { mode: 'PAPER' },
    });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE { clerkId } — remove BrokerCredential and downgrade bot mode. */
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { clerkId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { clerkId } = body;
  if (!clerkId) {
    return NextResponse.json({ error: 'Missing clerkId' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ ok: true }); // idempotent
  }

  await prisma.brokerCredential.deleteMany({ where: { userId: user.id } });
  await prisma.botSettings.updateMany({
    where: { userId: user.id, mode: 'LIVE' },
    data: { mode: 'PAPER' },
  });

  return NextResponse.json({ ok: true });
}
