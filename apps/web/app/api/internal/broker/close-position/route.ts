/**
 * Internal endpoint — closes an open Alpaca position for a user.
 * Called when closing broker-backed trades (paper or live).
 * Protected by BOT_INTERNAL_SECRET — never exposed to clients.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { loadBrokerForClerkId } from '@/lib/broker-server';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.BOT_INTERNAL_SECRET;
  return !!secret && req.headers.get('x-internal-secret') === secret;
}

/** POST { clerkId, symbol } .  close position in Alpaca, return exit price. */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { clerkId?: string; symbol?: string; paper?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { clerkId, symbol, paper } = body;
  if (!clerkId || !symbol) {
    return NextResponse.json({ error: 'Missing clerkId or symbol' }, { status: 400 });
  }

  const broker = await loadBrokerForClerkId(clerkId, paper);
  if (!broker) {
    return NextResponse.json({ error: 'No broker credentials configured' }, { status: 422 });
  }

  const exitPrice = await broker.closePosition(symbol);
  return NextResponse.json({ ok: true, exitPrice });
}
