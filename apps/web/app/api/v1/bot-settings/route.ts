import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { getBotSettings, updateBotSettings } from '@/lib/db/botSettings';

const patchSchema = z.object({
  mode: z.enum(['DISABLED', 'PAPER', 'LIVE']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  maxActiveTrades: z.number().optional(),
  maxTradeSize: z.number().optional(),
  riskPerTradePct: z.number().optional(),
  defaultStopPct: z.number().optional(),
  defaultTakeProfitPct: z.number().optional(),
  maxDailyLoss: z.number().optional(),
  tradingHoursStart: z.string().optional(),
  tradingHoursEnd: z.string().optional(),
  minConfidence: z.number().optional(),
  timeframes: z.array(z.string()).optional(),
  strategies: z.array(z.string()).optional(),
  stockStrategies: z.array(z.string()).optional(),
  cryptoStrategies: z.array(z.string()).optional(),
  includeExperimental: z.boolean().optional(),
  disabledStrategies: z.array(z.string()).optional(),
  scanIntervalSeconds: z.number().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getBotSettings(user.clerkId));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await req.json());
    return ok(await updateBotSettings(user.clerkId, body));
  } catch (err) {
    return handleError(err);
  }
}
