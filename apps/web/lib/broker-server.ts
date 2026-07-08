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

/** Load Alpaca broker for an internal route (close-position) by clerkId and account type. */
export async function loadBrokerForClerkId(
  clerkId: string,
  paper?: boolean,
): Promise<BrokerProvider | null> {
  const usePaper = paper ?? (await brokerStatus(clerkId)).paper ?? true;
  const keys = await getDecryptedKeys(clerkId, usePaper);
  if (!keys) return null;
  return new AlpacaBroker({ keyId: keys.keyId, secret: keys.secret, paper: keys.paper });
}
