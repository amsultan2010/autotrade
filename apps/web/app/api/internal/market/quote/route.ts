/**
 * Internal quote endpoint for worker trade actions (no session cookie).
 * Protected by BOT_INTERNAL_SECRET.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { quoteForUser } from '@/lib/market-data-server';
import { isBotAuth } from '@/lib/internal-auth';

/** POST { clerkId, symbol } — latest price for trade close / cash out. */
export async function POST(req: NextRequest) {
  if (!isBotAuth(req)) {
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

  try {
    const quote = await quoteForUser(clerkId, symbol.toUpperCase());
    return NextResponse.json({ price: quote.price });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Quote failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
