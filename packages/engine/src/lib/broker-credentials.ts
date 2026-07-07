import * as db from './supabase-db';
import { AlpacaBroker } from '../services/execution/alpaca.broker';
import type { BrokerProvider } from '../services/execution/broker.types';

/** Load a user's decrypted broker credentials and return a ready BrokerProvider, or null. */
export async function loadUserBroker(clerkId: string, paper: boolean): Promise<BrokerProvider | null> {
  try {
    const cred = await db.getDecryptedBrokerKeys(clerkId, paper);
    if (!cred) return null;
    return new AlpacaBroker({ keyId: cred.keyId, secret: cred.secret, paper: cred.paper });
  } catch {
    return null;
  }
}
