import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EXECUTION_MODES, RISK_LEVELS, STRATEGIES, TIMEFRAMES } from '@autotrade/shared';
import { prisma } from '../../lib/prisma.js';
import { parse } from '../../lib/validate.js';
import { requireEntitled } from '../../middleware/guards.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

// All fields optional → partial update of the user's bot/risk controls (req #14).
const updateSchema = z
  .object({
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
  })
  .partial();

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.botSettings.findUnique({ where: { userId: user.id } });
  });

  app.put('/settings', requireEntitled, async (req) => {
    const user = req.authUser!;
    const data = parse(updateSchema, req.body);
    // LIVE mode is intentionally not selectable until a broker is connected.
    if (data.mode === 'LIVE') {
      data.mode = 'PAPER';
    }
    return prisma.botSettings.update({ where: { userId: user.id }, data });
  });
}
