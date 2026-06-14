import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { closeTradeAtMarket, BadRequestError } from '@autotrade/engine';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await closeTradeAtMarket(id, user.id);
    if (!result.closed) throw new BadRequestError(result.reason ?? 'Could not close trade');
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
