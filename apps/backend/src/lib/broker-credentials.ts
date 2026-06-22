import { prisma } from './prisma.js';
import { decryptSecret } from './crypto.js';
import { env } from '../config/env.js';
import { AlpacaBroker } from '../services/execution/alpaca.broker.js';
import type { BrokerProvider } from '../services/execution/broker.types.js';

/** Load a user's decrypted broker credentials and return a ready BrokerProvider, or null. */
export async function loadUserBroker(userId: string): Promise<BrokerProvider | null> {
  const cred = await prisma.brokerCredential.findUnique({ where: { userId } });
  if (!cred) return null;
  if (!env.BROKER_ENCRYPTION_KEY) return null;
  try {
    const keyId = decryptSecret(cred.keyId, env.BROKER_ENCRYPTION_KEY);
    const secret = decryptSecret(cred.secret, env.BROKER_ENCRYPTION_KEY);
    return new AlpacaBroker({ keyId, secret, paper: cred.paper });
  } catch {
    return null;
  }
}
