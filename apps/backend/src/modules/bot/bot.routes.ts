import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { requireEntitled } from '../../middleware/guards.js';
import { runCycleForUser } from '../../workers/scanLoop.js';

export async function botRoutes(app: FastifyInstance): Promise<void> {
  // Bot status: current mode, open trades, paper account.
  app.get('/bot/status', requireEntitled, async (req) => {
    const user = req.authUser!;
    const [settings, paper, openTrades] = await Promise.all([
      prisma.botSettings.findUnique({ where: { userId: user.id } }),
      prisma.paperAccount.findUnique({ where: { userId: user.id } }),
      prisma.trade.count({ where: { userId: user.id, result: 'OPEN' } }),
    ]);
    const mode = settings?.mode ?? 'DISABLED';
    return {
      mode,
      running: mode === 'PAPER' || mode === 'LIVE',
      openTrades,
      paperAccount: paper,
    };
  });

  // Start the bot. Defaults to PAPER; LIVE requires a connected broker.
  app.post('/bot/start', requireEntitled, async (req) => {
    const user = req.authUser!;
    const cred = await prisma.brokerCredential.findUnique({
      where: { userId: user.id },
      select: { paper: true },
    });
    // Use LIVE only if a live (non-paper) broker is connected.
    const mode = cred && !cred.paper ? 'LIVE' : 'PAPER';
    return prisma.botSettings.update({ where: { userId: user.id }, data: { mode } });
  });

  // Stop = kill-switch (DISABLED).
  app.post('/bot/stop', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.botSettings.update({ where: { userId: user.id }, data: { mode: 'DISABLED' } });
  });

  // Trigger one scan cycle immediately (useful for testing / manual refresh).
  // Tight per-user rate limit: prevents resource exhaustion via repeated triggers.
  const runNowLimit = { ...requireEntitled, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } };
  app.post('/bot/run-now', runNowLimit, async (req, reply) => {
    const user = req.authUser!;
    await runCycleForUser(user.id);
    return reply.send({ ok: true });
  });

  app.get('/paper-account', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.paperAccount.findUnique({ where: { userId: user.id } });
  });
}
