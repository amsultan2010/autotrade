import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { EXECUTION_MODES, RISK_LEVELS, STRATEGIES, TIMEFRAMES } from '@autotrade/shared';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api-response';
import { prisma, parse, isProEntitled } from '@autotrade/engine';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
const updateSchema = z.object({
  mode: z.enum(EXECUTION_MODES),
  riskLevel: z.enum(RISK_LEVELS),
  maxActiveTrades: z.number().int().min(1).max(100),
  maxTradeSize: z.number().positive().max(10_000_000),
  riskPerTradePct: z.number().min(0.1).max(20),
  defaultStopPct: z.number().min(0.1).max(50),
  defaultTakeProfitPct: z.number().min(0.1).max(100),
  maxDailyLoss: z.number().min(0).max(10_000_000),
  tradingHoursStart: hhmm,
  tradingHoursEnd: hhmm,
  minConfidence: z.number().int().min(0).max(100),
  timeframes: z.array(z.enum(TIMEFRAMES)).min(1),
  strategies: z.array(z.enum(STRATEGIES)).min(1),
}).partial();

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await prisma.botSettings.findUnique({ where: { userId: user.id } }));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json() as unknown;
    const data = parse(updateSchema, body);

    if (data.mode === 'LIVE') {
      const [cred, sub] = await Promise.all([
        prisma.brokerCredential.findUnique({ where: { userId: user.id } }),
        prisma.subscription.findUnique({ where: { userId: user.id } }),
      ]);
      if (!cred) {
        return new Response(
          JSON.stringify({ error: { code: 'NO_BROKER', message: 'Connect an Alpaca account before enabling live trading.' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (!isProEntitled(user.role, sub)) {
        return new Response(
          JSON.stringify({ error: { code: 'UPGRADE_REQUIRED', message: 'Live trading requires a Pro subscription.' } }),
          { status: 402, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    return ok(await prisma.botSettings.update({ where: { userId: user.id }, data }));
  } catch (err) {
    return handleError(err);
  }
}
