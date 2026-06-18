import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getMarketData, parse } from '@autotrade/engine';

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const { q } = parse(z.object({ q: z.string().min(1).max(50) }), Object.fromEntries(new URL(req.url).searchParams));
    return ok(await getMarketData().searchSymbols(q));
  } catch (err) {
    return handleError(err);
  }
}
