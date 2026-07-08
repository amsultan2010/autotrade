import { NotFoundError } from '@autotrade/engine/public';
import { getSupabaseServer } from '@/lib/supabase-server';
import { mapTrade, mapUser, toMsFromTimestamptz, type TradeRow, type UserRow } from './row-mappers';
import { getSubscriptionByClerkId } from './subscriptions';

async function formatUserSummary(user: UserRow) {
  const sub = await getSubscriptionByClerkId(user.clerk_id);
  const { count } = await getSupabaseServer()
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_id', user.clerk_id);
  return {
    id: user.clerk_id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: new Date(toMsFromTimestamptz(user.created_at) ?? Date.now()).toISOString(),
    subscription: sub
      ? {
          status: sub.status,
          tier: sub.tier ?? null,
          currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
        }
      : null,
    _count: { trades: count ?? 0 },
  };
}

export async function writeAudit(args: {
  actorClerkId: string;
  action: string;
  target?: string;
  meta?: unknown;
  ip?: string;
}): Promise<void> {
  const { error } = await getSupabaseServer().from('audit_logs').insert({
    actor_clerk_id: args.actorClerkId,
    action: args.action,
    target: args.target,
    meta: args.meta,
    ip: args.ip,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function listUsers(opts: { q?: string; limit?: number } = {}) {
  const { q, limit = 50 } = opts;
  const { data, error } = await getSupabaseServer().from('users').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as UserRow[];
  const needle = q?.trim().toLowerCase();
  const filtered = needle ? all.filter((u) => u.email.toLowerCase().includes(needle)) : all;
  const page = filtered.slice(0, Math.min(Math.max(limit, 1), 200));
  return Promise.all(page.map(formatUserSummary));
}

export async function getUser(clerkId: string) {
  const { data, error } = await getSupabaseServer().from('users').select('*').eq('clerk_id', clerkId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const user = data as UserRow;
  const sub = await getSubscriptionByClerkId(clerkId);
  const sb = getSupabaseServer();
  const [tradesCount, botSettings, paperAccount, signalsCount] = await Promise.all([
    sb.from('trades').select('id', { count: 'exact', head: true }).eq('clerk_id', clerkId),
    sb.from('bot_settings').select('*').eq('clerk_id', clerkId).maybeSingle(),
    sb.from('paper_accounts').select('*').eq('clerk_id', clerkId).maybeSingle(),
    sb.from('signals').select('id', { count: 'exact', head: true }).eq('clerk_id', clerkId),
  ]);
  return {
    id: user.clerk_id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: new Date(toMsFromTimestamptz(user.created_at) ?? Date.now()).toISOString(),
    subscription: sub
      ? {
          status: sub.status,
          tier: sub.tier ?? null,
          currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
          stripeCustomerId: sub.stripeCustomerId ?? null,
          stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
        }
      : null,
    botSettings: botSettings.data ?? null,
    paperAccount: paperAccount.data ?? null,
    _count: { trades: tradesCount.count ?? 0, signals: signalsCount.count ?? 0 },
  };
}

export async function setUserStatus(actorClerkId: string, clerkId: string, status: 'ACTIVE' | 'DISABLED') {
  const { data } = await getSupabaseServer().from('users').select('clerk_id').eq('clerk_id', clerkId).maybeSingle();
  if (!data) throw new NotFoundError('User not found');
  const { error } = await getSupabaseServer().from('users').update({ status }).eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);
  await writeAudit({ actorClerkId, action: 'USER_STATUS_CHANGE', target: clerkId, meta: { status } });
  return { id: clerkId, status };
}

export async function setUserRole(actorClerkId: string, clerkId: string, role: 'USER' | 'ADMIN' | 'DEVELOPER') {
  const { data } = await getSupabaseServer().from('users').select('clerk_id').eq('clerk_id', clerkId).maybeSingle();
  if (!data) throw new NotFoundError('User not found');
  const { error } = await getSupabaseServer().from('users').update({ role }).eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);

  // Keep Clerk publicMetadata in sync so UI and analytics match Supabase (source of truth for APIs).
  try {
    const { createClerkClient } = await import('@clerk/nextjs/server');
    const { env } = await import('@autotrade/engine/public');
    if (env.CLERK_SECRET_KEY) {
      const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
      await clerk.users.updateUser(clerkId, { publicMetadata: { role } });
    }
  } catch (err) {
    console.error('Failed to sync Clerk role metadata', err);
  }

  await writeAudit({ actorClerkId, action: 'USER_ROLE_CHANGE', target: clerkId, meta: { role } });
  return { id: clerkId, role };
}

export async function metrics() {
  const sb = getSupabaseServer();
  const [usersRes, subsRes, tradesRes] = await Promise.all([
    sb.from('users').select('id', { count: 'exact', head: true }),
    sb.from('subscriptions').select('status'),
    sb.from('trades').select('result'),
  ]);
  const subs = subsRes.data ?? [];
  const trades = tradesRes.data ?? [];
  return {
    users: usersRes.count ?? 0,
    activeSubs: subs.filter((s) => s.status === 'ACTIVE').length,
    openTrades: trades.filter((t) => t.result === 'OPEN').length,
    signals24h: 0,
  };
}

export async function listTrades(limit = 100) {
  const take = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await getSupabaseServer()
    .from('trades')
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(take);
  if (error) throw new Error(error.message);
  return ((data ?? []) as TradeRow[]).map(mapTrade);
}

export async function listAudit(limit = 100) {
  const take = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await getSupabaseServer()
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(take);
  if (error) throw new Error(error.message);
  const logs = data ?? [];
  const actorIds = [...new Set(logs.map((l) => l.actor_clerk_id).filter(Boolean))] as string[];
  const actors = new Map<string, string>();
  for (const id of actorIds) {
    const { data: user } = await getSupabaseServer().from('users').select('email').eq('clerk_id', id).maybeSingle();
    if (user) actors.set(id, user.email as string);
  }
  return logs.map((log) => ({
    _id: log.id,
    _creationTime: typeof log.created_at === 'number' ? log.created_at : Date.parse(log.created_at as string),
    actorClerkId: log.actor_clerk_id,
    actorEmail: log.actor_clerk_id ? (actors.get(log.actor_clerk_id as string) ?? null) : null,
    action: log.action,
    target: log.target,
    meta: log.meta,
    ip: log.ip,
    createdAt: typeof log.created_at === 'number' ? log.created_at : Date.parse(log.created_at as string),
  }));
}
