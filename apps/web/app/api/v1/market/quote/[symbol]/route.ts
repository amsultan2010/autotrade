import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getMarketData } from '@autotrade/engine';

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    await requireUser();
    const { symbol } = await params;
    return ok(await getMarketData().getQuote(symbol.toUpperCase()));
  } catch (err) {
    return handleError(err);
  }
}
