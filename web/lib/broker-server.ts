import { fetchAction } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { AlpacaBroker, type BrokerProvider } from '@autotrade/engine/public';
import { convexToken } from './convex-auth-token';
import { convexServer } from './convex-server';

/** Load the signed-in user's Alpaca broker from Convex-stored credentials. */
export async function loadBrokerForSession(): Promise<BrokerProvider | null> {
  const token = await convexToken();
  const keys = await fetchAction(api.brokerCredentialActions.getDecryptedKeys, {}, { token });
  if (!keys) return null;
  return new AlpacaBroker({ keyId: keys.keyId, secret: keys.secret, paper: keys.paper });
}

/** Load Alpaca broker for an internal route (bot / close-position) by clerkId. */
export async function loadBrokerForClerkId(clerkId: string): Promise<BrokerProvider | null> {
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret) return null;

  const keys = await convexServer.action(api.brokerCredentialActions.getDecryptedKeysInternal, {
    clerkId,
    secret,
  });
  if (!keys) return null;
  return new AlpacaBroker({ keyId: keys.keyId, secret: keys.secret, paper: keys.paper });
}
