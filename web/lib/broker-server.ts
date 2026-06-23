import { fetchAction } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { AlpacaBroker, type BrokerProvider } from '@autotrade/engine/public';
import { convexToken } from './convex-auth-token';

/** Load the signed-in user's Alpaca broker from Convex-stored credentials. */
export async function loadBrokerForSession(): Promise<BrokerProvider | null> {
  const token = await convexToken();
  const keys = await fetchAction(api.brokerCredentialActions.getDecryptedKeys, {}, { token });
  if (!keys) return null;
  return new AlpacaBroker({ keyId: keys.keyId, secret: keys.secret, paper: keys.paper });
}
