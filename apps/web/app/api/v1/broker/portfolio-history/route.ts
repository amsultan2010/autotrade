import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { loadBrokerForSession } from '@/lib/broker-server';
import { ok, handleError } from '@/lib/api-response';
import { parse } from '@autotrade/engine/public';
import { alpacaPeriodForTab, type EquityTab } from '@/lib/dashboard-charts';

const TAB_VALUES = ['1D', '1W', '1M', '3M', '1Y'] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const broker = await loadBrokerForSession(user.clerkId);
    if (!broker) return ok(null);

    const { tab } = parse(
      z.object({ tab: z.enum(TAB_VALUES).default('1D') }),
      Object.fromEntries(new URL(req.url).searchParams),
    );

    const history = await broker.getPortfolioHistory(alpacaPeriodForTab(tab as EquityTab));
    return ok({
      tab,
      equity: history.equity,
      timestamp: history.timestamp,
    });
  } catch (err) {
    return handleError(err);
  }
}
