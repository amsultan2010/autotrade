/**
 * Broker credential management routes.
 * Users connect their Alpaca account (paper or live) here.
 * Keys are AES-256-GCM encrypted before storage — only the ciphertext is in DB.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { encryptSecret } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { AlpacaBroker } from '../../services/execution/alpaca.broker.js';
import { requireEntitled } from '../../middleware/guards.js';
import { parse } from '../../lib/validate.js';
import { BadRequestError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';

const connectSchema = z.object({
  keyId: z.string().min(1),
  secret: z.string().min(1),
  paper: z.boolean(),
});

async function verifyAlpacaKeys(keyId: string, secret: string, paper: boolean): Promise<boolean> {
  const broker = new AlpacaBroker({ keyId, secret, paper });
  try {
    await broker.getAccount();
    return true;
  } catch {
    return false;
  }
}

export async function brokerRoutes(app: FastifyInstance): Promise<void> {
  // Get broker connection status (never returns raw keys).
  app.get('/broker/status', requireEntitled, async (req) => {
    const user = req.authUser!;
    const cred = await prisma.brokerCredential.findUnique({ where: { userId: user.id } });
    if (!cred) return { connected: false };
    return { connected: true, provider: cred.provider, paper: cred.paper };
  });

  // Connect an Alpaca account.
  app.post('/broker/connect', requireEntitled, async (req) => {
    const user = req.authUser!;
    const { keyId, secret, paper } = parse(connectSchema, req.body);

    if (!env.BROKER_ENCRYPTION_KEY) {
      throw new BadRequestError('Broker credential storage is not configured on this server.');
    }

    const valid = await verifyAlpacaKeys(keyId, secret, paper);
    if (!valid) throw new BadRequestError('Invalid Alpaca API keys — could not authenticate with Alpaca.');

    const encKeyId = encryptSecret(keyId, env.BROKER_ENCRYPTION_KEY);
    const encSecret = encryptSecret(secret, env.BROKER_ENCRYPTION_KEY);

    await prisma.brokerCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, provider: 'alpaca', keyId: encKeyId, secret: encSecret, paper },
      update: { keyId: encKeyId, secret: encSecret, paper },
    });

    // Switching to paper? Downgrade any active LIVE bot mode.
    if (paper) {
      await prisma.botSettings.updateMany({
        where: { userId: user.id, mode: 'LIVE' },
        data: { mode: 'PAPER' },
      });
    }

    void writeAudit({ actorId: user.id, action: 'BROKER_CONNECT', meta: { provider: 'alpaca', paper }, ip: req.ip });
    return { connected: true, provider: 'alpaca', paper };
  });

  // Disconnect broker and downgrade bot to paper mode.
  app.delete('/broker/connect', requireEntitled, async (req) => {
    const user = req.authUser!;
    await prisma.brokerCredential.deleteMany({ where: { userId: user.id } });
    await prisma.botSettings.updateMany({
      where: { userId: user.id, mode: 'LIVE' },
      data: { mode: 'PAPER' },
    });
    void writeAudit({ actorId: user.id, action: 'BROKER_DISCONNECT', ip: req.ip });
    return { connected: false };
  });

  // Fetch live Alpaca account data (cash, equity, buying power).
  app.get('/broker/account', requireEntitled, async (req) => {
    const user = req.authUser!;
    const { loadUserBroker } = await import('../../lib/broker-credentials.js');
    const broker = await loadUserBroker(user.id);
    if (!broker) return null;
    const account = await broker.getAccount();
    return { ...account, mode: broker.mode };
  });

  // Fetch open Alpaca positions.
  app.get('/broker/positions', requireEntitled, async (req) => {
    const user = req.authUser!;
    const { loadUserBroker } = await import('../../lib/broker-credentials.js');
    const broker = await loadUserBroker(user.id);
    if (!broker) return [];
    return broker.getPositions();
  });
}
