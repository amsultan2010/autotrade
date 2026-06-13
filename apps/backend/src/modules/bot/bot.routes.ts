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
    return {
      mode: settings?.mode ?? 'DISABLED',
      running: settings?.mode === 'PAPER',
      openTrades,
      paperAccount: paper,
    };
  });

  // Start the bot in paper mode (live requires a connected broker — future).
  app.post('/bot/start', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.botSettings.update({ where: { userId: user.id }, data: { mode: 'PAPER' } });
  });

  // Stop = kill-switch (DISABLED).
  app.post('/bot/stop', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.botSettings.update({ where: { userId: user.id }, data: { mode: 'DISABLED' } });
  });

  // Trigger one scan cycle immediately (useful for testing / manual refresh).
  app.post('/bot/run-now', requireEntitled, async (req, reply) => {
    const user = req.authUser!;
    await runCycleForUser(user.id);
    return reply.send({ ok: true });
  });

  app.get('/paper-account', requireEntitled, async (req) => {
    const user = req.authUser!;
    return prisma.paperAccount.findUnique({ where: { userId: user.id } });
  });
}
