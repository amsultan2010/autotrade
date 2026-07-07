import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { quoteForUser } from '@/lib/market-data-server';

const SYMBOL_RE = /^[A-Z0-9./-]{1,20}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const user = await requireUser();
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    if (!SYMBOL_RE.test(upper)) {
      return NextResponse.json({ error: { code: 'INVALID_SYMBOL', message: 'Invalid symbol' } }, { status: 400 });
    }
    return ok(await quoteForUser(user.clerkId, upper));
  } catch (err) {
    return handleError(err);
  }
}
