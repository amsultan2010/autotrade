import { AlpacaBroker, type BrokerProvider } from '@autotrade/engine/public';
import { brokerStatus, getDecryptedKeys } from '@/lib/db/broker';

/** Load the signed-in user's Alpaca broker for their active execution mode. */
export async function loadBrokerForSession(clerkId: string): Promise<BrokerProvider | null> {
  const status = await brokerStatus(clerkId);
  const paper = status.paper ?? true;
  const keys = await getDecryptedKeys(clerkId, paper);
  if (!keys) return null;
  return new AlpacaBroker({ keyId: keys.keyId, secret: keys.secret, paper: keys.paper });
}

/** Load live Alpaca broker for an internal route (close-position) by clerkId. */
export async function loadBrokerForClerkId(clerkId: string): Promise<BrokerProvider | null> {
  const keys = await getDecryptedKeys(clerkId, false);
  if (!keys) return null;
  return new AlpacaBroker({ keyId: keys.keyId, secret: keys.secret, paper: keys.paper });
}
