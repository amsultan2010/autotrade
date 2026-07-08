import { AlpacaBroker, BadRequestError } from '@autotrade/engine/public';
import { getSupabaseServer } from '@/lib/supabase-server';
import { decryptBrokerSecret, encryptBrokerSecret } from '@/lib/broker-crypto';
import { hasLiveTradingAccess } from '@/lib/entitlements';
import {
  mapBrokerSnapshot,
  type BrokerPosition,
  type BrokerSnapshotRow,
} from './row-mappers';
import { getSubscriptionByClerkId } from './subscriptions';
import { getByClerkId as getUserByClerkId } from './users';

type CredentialRow = {
  id: string;
  clerk_id: string;
  provider: string;
  encrypted_key_id: string;
  encrypted_secret: string;
  paper: boolean;
};

export async function getCredentialByPaper(clerkId: string, paper: boolean): Promise<CredentialRow | null> {
  const { data, error } = await getSupabaseServer()
    .from('broker_credentials')
    .select('*')
    .eq('clerk_id', clerkId)
    .eq('paper', paper)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CredentialRow | null;
}

export async function upsertCredential(args: {
  clerkId: string;
  encryptedKeyId: string;
  encryptedSecret: string;
  paper: boolean;
}): Promise<void> {
  const existing = await getCredentialByPaper(args.clerkId, args.paper);
  if (existing) {
    const { error } = await getSupabaseServer()
      .from('broker_credentials')
      .update({
        encrypted_key_id: args.encryptedKeyId,
        encrypted_secret: args.encryptedSecret,
        paper: args.paper,
      })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await getSupabaseServer().from('broker_credentials').insert({
    clerk_id: args.clerkId,
    provider: 'alpaca',
    encrypted_key_id: args.encryptedKeyId,
    encrypted_secret: args.encryptedSecret,
    paper: args.paper,
  });
  if (error) throw new Error(error.message);
}

export async function deleteCredential(clerkId: string, paper: boolean): Promise<void> {
  const cred = await getCredentialByPaper(clerkId, paper);
  if (!cred) return;
  const { error } = await getSupabaseServer().from('broker_credentials').delete().eq('id', cred.id);
  if (error) throw new Error(error.message);
}

export async function getBotMode(clerkId: string): Promise<'DISABLED' | 'PAPER' | 'LIVE' | null> {
  const { data, error } = await getSupabaseServer()
    .from('bot_settings')
    .select('mode')
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.mode as 'DISABLED' | 'PAPER' | 'LIVE' | undefined) ?? null;
}

export async function brokerStatus(clerkId: string) {
  const [paperCred, liveCred, settings] = await Promise.all([
    getCredentialByPaper(clerkId, true),
    getCredentialByPaper(clerkId, false),
    getSupabaseServer().from('bot_settings').select('mode').eq('clerk_id', clerkId).maybeSingle(),
  ]);
  const paperConnected = paperCred != null;
  const liveConnected = liveCred != null;
  const mode = (settings.data?.mode as string | undefined) ?? 'PAPER';
  const activePaper = mode !== 'LIVE';
  const activeCred = activePaper ? paperCred : liveCred;
  return {
    connected: activeCred != null,
    paperConnected,
    liveConnected,
    provider: activeCred?.provider ?? paperCred?.provider ?? liveCred?.provider,
    paper: activeCred?.paper ?? activePaper,
  };
}

export async function getSnapshot(clerkId: string) {
  const { data, error } = await getSupabaseServer()
    .from('broker_snapshots')
    .select('*')
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const snap = mapBrokerSnapshot(data as BrokerSnapshotRow);
  snap.positions = snap.positions.filter(
    (p) =>
      typeof p.symbol === 'string' &&
      typeof p.qty === 'number' &&
      Number.isFinite(p.qty) &&
      typeof p.avgEntryPrice === 'number' &&
      Number.isFinite(p.avgEntryPrice) &&
      (p.side === 'LONG' || p.side === 'SHORT'),
  );
  return snap;
}

async function upsertSnapshot(args: {
  clerkId: string;
  equity: number;
  cash: number;
  buyingPower: number;
  lastEquity?: number;
  mode: 'paper' | 'live';
  positions: BrokerPosition[];
  syncError?: string;
}): Promise<void> {
  const { data: existing } = await getSupabaseServer()
    .from('broker_snapshots')
    .select('id')
    .eq('clerk_id', args.clerkId)
    .maybeSingle();
  const row = {
    clerk_id: args.clerkId,
    equity: args.equity,
    cash: args.cash,
    buying_power: args.buyingPower,
    last_equity: args.lastEquity,
    mode: args.mode,
    positions: args.positions,
    synced_at: Date.now(),
    sync_error: args.syncError ?? null,
  };
  if (existing) {
    const { error } = await getSupabaseServer().from('broker_snapshots').update(row).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await getSupabaseServer().from('broker_snapshots').insert(row);
    if (error) throw new Error(error.message);
  }
}

async function deleteSnapshot(clerkId: string): Promise<void> {
  const { error } = await getSupabaseServer().from('broker_snapshots').delete().eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);
}

export type SyncResult = {
  synced: boolean;
  equity?: number;
  positionCount?: number;
  error?: string;
  rateLimited?: boolean;
};

const SYNC_MIN_INTERVAL_MS = 60_000;

function isAlpacaRateLimitError(message: string): boolean {
  return /\b429\b|rate limit/i.test(message);
}

export async function syncAlpacaForClerk(
  clerkId: string,
  opts?: { force?: boolean; paper?: boolean },
): Promise<SyncResult> {
  const mode = await getBotMode(clerkId);
  const wantPaper = opts?.paper ?? mode !== 'LIVE';
  const cred = await getCredentialByPaper(clerkId, wantPaper);

  if (!cred) {
    await deleteSnapshot(clerkId);
    return { synced: false, error: wantPaper ? 'No paper Alpaca connected' : 'No live Alpaca connected' };
  }

  const existing = await getSnapshot(clerkId);
  const now = Date.now();
  if (!opts?.force && existing?.syncedAt && now - existing.syncedAt < SYNC_MIN_INTERVAL_MS) {
    return {
      synced: true,
      equity: existing.equity,
      positionCount: existing.positions.length,
    };
  }

  try {
    const keyId = decryptBrokerSecret(cred.encrypted_key_id);
    const secret = decryptBrokerSecret(cred.encrypted_secret);
    const broker = new AlpacaBroker({ keyId, secret, paper: cred.paper });
    const [account, positions] = await Promise.all([broker.getAccount(), broker.getPositions()]);
    await upsertSnapshot({
      clerkId,
      equity: account.equity,
      cash: account.cash,
      buyingPower: account.buyingPower,
      lastEquity: account.lastEquity,
      mode: broker.mode,
      positions,
      syncError: undefined,
    });
    return { synced: true, equity: account.equity, positionCount: positions.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Alpaca sync failed';
    if (isAlpacaRateLimitError(message) && existing) {
      return {
        synced: false,
        rateLimited: true,
        error: 'Alpaca rate limit exceeded. Showing your last synced portfolio.',
      };
    }
    if (existing) {
      await upsertSnapshot({
        clerkId,
        equity: existing.equity,
        cash: existing.cash,
        buyingPower: existing.buyingPower,
        lastEquity: existing.lastEquity,
        mode: existing.mode,
        positions: existing.positions,
        syncError: message,
      });
    } else {
      await upsertSnapshot({
        clerkId,
        equity: 0,
        cash: 0,
        buyingPower: 0,
        mode: cred.paper ? 'paper' : 'live',
        positions: [],
        syncError: message,
      });
    }
    return { synced: false, error: message };
  }
}

export async function connectBroker(
  clerkId: string,
  args: { keyId: string; secret: string; paper: boolean },
): Promise<{ connected: boolean; provider: string; paper: boolean }> {
  const trimmedKey = args.keyId.trim();
  const trimmedSecret = args.secret.trim();
  const { verifyAlpacaCredentials } = await import('@autotrade/engine/public');
  const check = await verifyAlpacaCredentials(trimmedKey, trimmedSecret, args.paper);
  if (!check.ok) throw new BadRequestError(check.error ?? 'Invalid Alpaca keys');

  if (!args.paper) {
    const user = await getUserByClerkId(clerkId);
    if (!user) throw new BadRequestError('User not found');
    const sub = await getSubscriptionByClerkId(clerkId);
    if (!hasLiveTradingAccess(user.role, sub, user.email, user.founderPlanOverride ?? null)) {
      throw new BadRequestError('Live Alpaca keys require a paid plan.');
    }
  }

  let encryptedKeyId: string;
  let encryptedSecret: string;
  try {
    encryptedKeyId = encryptBrokerSecret(trimmedKey);
    encryptedSecret = encryptBrokerSecret(trimmedSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Encryption failed';
    if (/BROKER_ENCRYPTION_KEY/i.test(message)) {
      throw new BadRequestError(
        'Broker encryption is not configured on the server. Set BROKER_ENCRYPTION_KEY (openssl rand -hex 32).',
      );
    }
    throw new BadRequestError(message);
  }

  await upsertCredential({
    clerkId,
    encryptedKeyId,
    encryptedSecret,
    paper: args.paper,
  });

  try {
    const { invalidateUserMarketData } = await import('@autotrade/engine/public');
    invalidateUserMarketData(clerkId);
  } catch {
    /* engine optional in some test contexts */
  }

  await syncAlpacaForClerk(clerkId, { force: true, paper: args.paper });
  return { connected: true, provider: 'alpaca', paper: args.paper };
}

export async function disconnectBroker(clerkId: string, paper: boolean): Promise<{ connected: boolean }> {
  await deleteCredential(clerkId, paper);
  try {
    const { invalidateUserMarketData } = await import('@autotrade/engine/public');
    invalidateUserMarketData(clerkId);
  } catch {
    /* engine optional in some test contexts */
  }
  await syncAlpacaForClerk(clerkId);
  return { connected: false };
}

export async function getDecryptedKeys(clerkId: string, paper: boolean) {
  const cred = await getCredentialByPaper(clerkId, paper);
  if (!cred) return null;
  return {
    keyId: decryptBrokerSecret(cred.encrypted_key_id),
    secret: decryptBrokerSecret(cred.encrypted_secret),
    paper: cred.paper,
    provider: cred.provider,
  };
}
