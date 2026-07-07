/**
 * Supabase-backed subscription reads/writes for the engine billing service.
 */
import { getEffectiveTierFromSubscription } from '@autotrade/shared';
import type { PlanTier, SubscriptionStatus } from '@autotrade/shared';
import { getSupabase } from './supabase';
import { AppError } from './errors';

type SubscriptionStatusRow = SubscriptionStatus;

type SubscriptionRow = {
  id: string;
  clerk_id: string;
  tier: string | null;
  status: SubscriptionStatusRow;
  current_period_end: number | null;
  cancel_at_period_end: boolean | null;
  legacy_tier: string | null;
  legacy_tier_until: number | null;
  trials_used: string[] | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function supabaseError(op: string, error: { message: string }): never {
  throw new AppError(502, 'SUPABASE_ERROR', `Supabase ${op} failed: ${error.message}`);
}

export async function getSubscriptionByClerkId(clerkId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('*')
    .eq('clerk_id', clerkId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) supabaseError('getSubscriptionByClerkId', error);
  return data as SubscriptionRow | null;
}

export async function getSubscriptionByStripeCustomerId(
  stripeCustomerId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (error) supabaseError('getSubscriptionByStripeCustomerId', error);
  return data as SubscriptionRow | null;
}

async function ensureSubscriptionRow(clerkId: string): Promise<SubscriptionRow> {
  const existing = await getSubscriptionByClerkId(clerkId);
  if (existing) return existing;

  const { data, error } = await getSupabase()
    .from('subscriptions')
    .insert({ clerk_id: clerkId, status: 'NONE', trials_used: [] })
    .select('*')
    .single();

  if (error) supabaseError('ensureSubscriptionRow', error);
  return data as SubscriptionRow;
}

export async function getCheckoutData(clerkId: string): Promise<{
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  tier: string | null;
  status: SubscriptionStatusRow;
  trialsUsed: string[];
  effectiveTier: 'free' | PlanTier;
}> {
  const sb = getSupabase();
  const [sub, userRes] = await Promise.all([
    getSubscriptionByClerkId(clerkId),
    sb.from('users').select('role, email, founder_plan_override').eq('clerk_id', clerkId).maybeSingle(),
  ]);

  if (userRes.error) supabaseError('getCheckoutData(users)', userRes.error);
  const user = userRes.data;

  const effectiveTier = getEffectiveTierFromSubscription(
    sub?.tier ?? null,
    sub?.status ?? 'NONE',
    sub?.current_period_end ?? null,
    (user?.role as string) ?? 'USER',
    user?.email as string | undefined,
    sub?.legacy_tier ?? null,
    sub?.legacy_tier_until ?? null,
    (user?.founder_plan_override as 'free' | PlanTier | null) ?? null,
  );

  return {
    stripeCustomerId: sub?.stripe_customer_id ?? null,
    stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    tier: sub?.tier ?? null,
    status: sub?.status ?? 'NONE',
    trialsUsed: sub?.trials_used ?? [],
    effectiveTier,
  };
}

export async function setStripeCustomerId(clerkId: string, stripeCustomerId: string): Promise<void> {
  const row = await ensureSubscriptionRow(clerkId);
  const { error } = await getSupabase()
    .from('subscriptions')
    .update({ stripe_customer_id: stripeCustomerId })
    .eq('id', row.id);

  if (error) supabaseError('setStripeCustomerId', error);
}

export async function setLegacyTier(
  clerkId: string,
  legacyTier: string,
  legacyTierUntil: number,
): Promise<void> {
  const sub = await getSubscriptionByClerkId(clerkId);
  if (!sub) throw new AppError(404, 'NOT_FOUND', 'Subscription not found');

  const { error } = await getSupabase()
    .from('subscriptions')
    .update({ legacy_tier: legacyTier, legacy_tier_until: legacyTierUntil })
    .eq('id', sub.id);

  if (error) supabaseError('setLegacyTier', error);
}

export async function getStatusData(clerkId: string): Promise<{
  role: 'USER' | 'ADMIN' | 'DEVELOPER';
  status: SubscriptionStatusRow;
  tier: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean | null;
  legacyTier: string | null;
  legacyTierUntil: number | null;
  trialsUsed: string[];
  paperTradesUsed: number;
  email: string;
}> {
  const sb = getSupabase();
  const [userRes, sub, tradesRes] = await Promise.all([
    sb.from('users').select('role, email').eq('clerk_id', clerkId).maybeSingle(),
    getSubscriptionByClerkId(clerkId),
    sb.from('trades').select('mode').eq('clerk_id', clerkId),
  ]);

  if (userRes.error) supabaseError('getStatusData(users)', userRes.error);
  if (tradesRes.error) supabaseError('getStatusData(trades)', tradesRes.error);

  const paperTradesUsed = (tradesRes.data ?? []).filter((t) => t.mode === 'PAPER').length;

  return {
    role: (userRes.data?.role as 'USER' | 'ADMIN' | 'DEVELOPER') ?? 'USER',
    status: sub?.status ?? 'NONE',
    tier: sub?.tier ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? null,
    legacyTier: sub?.legacy_tier ?? null,
    legacyTierUntil: sub?.legacy_tier_until ?? null,
    trialsUsed: sub?.trials_used ?? [],
    paperTradesUsed,
    email: (userRes.data?.email as string) ?? '',
  };
}

export async function upsertFromStripe(args: {
  clerkId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tier?: string;
  status: SubscriptionStatusRow;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  legacyTier?: string;
  legacyTierUntil?: number;
  trialsUsed?: string[];
}): Promise<void> {
  const existing = await getSubscriptionByClerkId(args.clerkId);
  const patch = {
    stripe_customer_id: args.stripeCustomerId,
    stripe_subscription_id: args.stripeSubscriptionId,
    tier: args.tier,
    status: args.status,
    current_period_end: args.currentPeriodEnd,
    cancel_at_period_end: args.cancelAtPeriodEnd,
    legacy_tier: args.legacyTier,
    legacy_tier_until: args.legacyTierUntil,
    trials_used: args.trialsUsed ?? existing?.trials_used ?? [],
  };

  if (existing) {
    const { error } = await getSupabase().from('subscriptions').update(patch).eq('id', existing.id);
    if (error) supabaseError('upsertFromStripe(update)', error);
    return;
  }

  const { error } = await getSupabase().from('subscriptions').insert({
    clerk_id: args.clerkId,
    ...patch,
  });
  if (error) supabaseError('upsertFromStripe(insert)', error);
}
