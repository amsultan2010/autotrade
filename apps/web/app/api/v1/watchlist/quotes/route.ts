import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCachedQuotes } from '@/lib/quote-cache';
import { ok, handleError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get('symbols') ?? '';
    const symbols = symbolsParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (symbols.length === 0) return ok([]);

    return ok(await getCachedQuotes(userId, symbols));
  } catch (err) {
    return handleError(err);
  }
}
