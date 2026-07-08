/**
 * Internal endpoint — closes an open Alpaca position for a user.
 * Called when closing broker-backed trades (paper or live).
 * Protected by BOT_INTERNAL_SECRET — never exposed to clients.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { loadBrokerForClerkId } from '@/lib/broker-server';
import { isBotAuth } from '@/lib/internal-auth';

/** POST { clerkId, symbol } — close position in Alpaca, return exit price. */
export async function POST(req: NextRequest) {
  if (!isBotAuth(req)) {
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
