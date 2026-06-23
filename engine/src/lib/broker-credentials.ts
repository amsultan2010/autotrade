import { prisma } from './prisma';
import { decryptSecret } from './crypto';
import { env } from '../config/env';
import { AlpacaBroker } from '../services/execution/alpaca.broker';
import type { BrokerProvider } from '../services/execution/broker.types';

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
