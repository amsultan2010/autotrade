/**
 * Internal endpoint — closes an open Alpaca position for a user.
 * Called by the Convex tradeActions.closeAtMarket when mode === 'LIVE'.
 * Loads the user's broker credentials from Postgres, calls Alpaca's
 * close-position endpoint, and returns the exit price.
 * Protected by BOT_INTERNAL_SECRET — never exposed to clients.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { prisma, loadUserBroker } from '@autotrade/engine';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.BOT_INTERNAL_SECRET;
  return !!secret && req.headers.get('x-internal-secret') === secret;
}

/** POST { clerkId, symbol } — close position in Alpaca, return exit price. */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { clerkId?: string; symbol?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { clerkId, symbol } = body;
  if (!clerkId || !symbol) {
    return NextResponse.json({ error: 'Missing clerkId or symbol' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const broker = await loadUserBroker(user.id);
  if (!broker) {
    return NextResponse.json({ error: 'No broker credentials configured' }, { status: 422 });
  }

  const exitPrice = await broker.closePosition(symbol);
  return NextResponse.json({ ok: true, exitPrice });
}
