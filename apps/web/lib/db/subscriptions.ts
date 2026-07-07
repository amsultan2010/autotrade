import { getSupabaseServer } from '@/lib/supabase-server';
import {
  PLAN_DEFINITIONS,
  PLAN_TIERS,
  TIER_COLORS,
  QUANT_TOOL_LINKS,
  useLaunchPricesEnv,
  trialEligibleTier,
  startOfUtcWeekMs,
  type PlanTier,
} from '@autotrade/shared';
import {
  canUsePaperTrading as sharedCanUsePaperTrading,
  getEffectiveTier,
  getPlanLimits,
  hasLiveTradingAccess,
  isLiveEntitled,
  requiresPaperSimulator,
  maxPresetSwitchesPerWeek,
} from '@/lib/entitlements';
import {
  FREE_PAPER_TRADE_LIMIT,
  FREE_TIER_LIMITS,
} from '@autotrade/shared';
import { isBillingEnabled } from '@/lib/billing';
import {
  mapSubscription,
  type SubscriptionRow,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from './row-mappers';
import { me } from './users';
import { countPaperTrades } from './trades';
import { getBotSettings } from './botSettings';

const VALID_STATUSES = new Set<SubscriptionStatus>([
  'NONE',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'TRIALING',
  'UNPAID',
]);

function subscriptionPriority(sub: SubscriptionRow): number {
  let score = 0;
  if (sub.stripe_subscription_id) score += 8;
  if (sub.stripe_customer_id) score += 4;
  if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') score += 2;
  if (sub.tier) score += 1;
  return score;
}

export function normalizeSubscriptionStatus(status: unknown): SubscriptionStatus {
  if (typeof status === 'string' && VALID_STATUSES.has(status as SubscriptionStatus)) {
    return status as SubscriptionStatus;
  }
  return 'NONE';
}

export function subscriptionForClient(sub: SubscriptionRecord): SubscriptionRecord {
  return { ...sub, status: normalizeSubscriptionStatus(sub.status) };
}

export async function listSubscriptionsByClerkId(clerkId: string): Promise<SubscriptionRow[]> {
  const { data, error } = await getSupabaseServer()
    .from('subscriptions')
    .select('*')
    .eq('clerk_id', clerkId);
  if (error) throw new Error(`subscriptions list failed: ${error.message}`);
  return (data ?? []) as SubscriptionRow[];
}

export async function getSubscriptionByClerkId(clerkId: string): Promise<SubscriptionRecord | null> {
  const rows = await listSubscriptionsByClerkId(clerkId);
  if (rows.length === 0) return null;
  if (rows.length === 1) return mapSubscription(rows[0]!);

  const best = [...rows].sort((a, b) => {
    const byPriority = subscriptionPriority(b) - subscriptionPriority(a);
    if (byPriority !== 0) return byPriority;
    return (toMs(b.created_at) ?? 0) - (toMs(a.created_at) ?? 0);
  })[0]!;
  return mapSubscription(best);
}

function toMs(iso: string): number | undefined {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : undefined;
}

export async function dedupeSubscriptionsForClerk(clerkId: string, keepId: string): Promise<void> {
  const rows = await listSubscriptionsByClerkId(clerkId);
  const toDelete = rows.filter((r) => r.id !== keepId).map((r) => r.id);
  if (toDelete.length === 0) return;
  const { error } = await getSupabaseServer().from('subscriptions').delete().in('id', toDelete);
  if (error) throw new Error(`subscription dedupe failed: ${error.message}`);
}

type SubscriptionPatch = Partial<{
  tier: string;
  status: SubscriptionStatus;
  current_period_end: number;
  cancel_at_period_end: boolean;
  legacy_tier: string;
  legacy_tier_until: number;
  trials_used: string[];
  stripe_customer_id: string;
  stripe_subscription_id: string;
}>;

export async function ensureSubscriptionRecord(
  clerkId: string,
  patch?: SubscriptionPatch,
): Promise<string> {
  const existing = await getSubscriptionByClerkId(clerkId);
  if (existing) {
    if (patch && Object.keys(patch).length > 0) {
      const { error } = await getSupabaseServer()
        .from('subscriptions')
        .update(patch)
        .eq('id', existing._id);
      if (error) throw new Error(`subscription update failed: ${error.message}`);
    }
    await dedupeSubscriptionsForClerk(clerkId, existing._id);
    return existing._id;
  }

  const insert = { clerk_id: clerkId, status: 'NONE' as const, ...patch };
  const { data, error } = await getSupabaseServer()
    .from('subscriptions')
    .insert(insert)
    .select('id')
    .single();
  if (error || !data) throw new Error(`subscription insert failed: ${error?.message}`);
  await dedupeSubscriptionsForClerk(clerkId, data.id as string);
  return data.id as string;
}

export async function upsertFromStripe(args: {
  clerkId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tier?: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  legacyTier?: string;
  legacyTierUntil?: number;
  trialsUsed?: string[];
}): Promise<string> {
  const existing = await getSubscriptionByClerkId(args.clerkId);
  const patch: SubscriptionPatch = {
    stripe_customer_id: args.stripeCustomerId,
    stripe_subscription_id: args.stripeSubscriptionId,
    tier: args.tier,
    status: args.status,
    current_period_end: args.currentPeriodEnd,
    cancel_at_period_end: args.cancelAtPeriodEnd,
    legacy_tier: args.legacyTier,
    legacy_tier_until: args.legacyTierUntil,
    trials_used: args.trialsUsed ?? existing?.trialsUsed,
  };
  return ensureSubscriptionRecord(args.clerkId, patch);
}

export async function getByStripeCustomerId(
  stripeCustomerId: string,
): Promise<SubscriptionRecord | null> {
  const { data, error } = await getSupabaseServer()
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  if (error) throw new Error(`subscription lookup failed: ${error.message}`);
  return data ? mapSubscription(data as SubscriptionRow) : null;
}

function paperTradesLimitForUser(
  role: string,
  sub: SubscriptionRecord | null,
  email?: string | null,
  founderPlanOverride?: string | null,
): number {
  if (requiresPaperSimulator(role, sub, email, founderPlanOverride as never)) {
    return FREE_TIER_LIMITS.maxPaperTrades;
  }
  return FREE_PAPER_TRADE_LIMIT;
}

export async function getSubscriptionInfo(clerkId: string) {
  const user = await me(clerkId);
  const sub = await getSubscriptionByClerkId(clerkId);
  const role = user?.role ?? 'USER';
  const founderOverride = user?.founderPlanOverride ?? null;
  const paperTradesUsed = await countPaperTrades(clerkId);

  return {
    status: sub?.status ?? 'NONE',
    tier: sub?.tier ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toISOString()
      : null,
    entitled: isLiveEntitled(role, sub, user?.email, founderOverride),
    paperTradesUsed,
    paperTradesLimit: paperTradesLimitForUser(role, sub, user?.email, founderOverride),
    canUsePaperTrading: sharedCanUsePaperTrading(
      role,
      sub,
      paperTradesUsed,
      user?.email,
      founderOverride,
    ),
  };
}

export async function getPlanEntitlements(clerkId: string | null) {
  const billingEnabled = isBillingEnabled();
  const useLaunchPrices = useLaunchPricesEnv();
  const plans = PLAN_TIERS.map((id: PlanTier) => {
    const def = PLAN_DEFINITIONS[id];
    return {
      id,
      name: def.name,
      priceMonthly: def.priceMonthly,
      displayPriceMonthly: useLaunchPrices ? def.launchPriceMonthly : def.priceMonthly,
      features: def.features,
      colors: TIER_COLORS[id],
    };
  });
  const quantToolLinks = QUANT_TOOL_LINKS.map((l) => ({ label: l.label, href: l.href }));

  if (!clerkId) {
    return {
      billingEnabled,
      useLaunchPrices,
      effectiveTier: 'free' as const,
      currentPlan: null,
      subscriptionStatus: 'NONE' as const,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      liveEntitled: false,
      canUsePaperTrading: true,
      requiresPaperSimulator: true,
      trialEligibleTier: 'essential' as const,
      presetSwitchesRemaining: null,
      quantToolLinks,
      limits: null,
      plans,
    };
  }

  const user = await me(clerkId);
  const sub = await getSubscriptionByClerkId(clerkId);
  const role = user?.role ?? 'USER';
  const founderOverride = user?.founderPlanOverride ?? null;
  const effectiveTier = getEffectiveTier(role, sub, user?.email, founderOverride);
  const limits = getPlanLimits(role, sub, user?.email, founderOverride);
  const normalizedTier = effectiveTier === 'free' ? null : (effectiveTier as PlanTier);
  const paperUsed = await countPaperTrades(clerkId);
  const trialsUsed = sub?.trialsUsed ?? [];
  const eligible = trialEligibleTier(effectiveTier);
  const trialEligible = eligible && !trialsUsed.includes(eligible) ? eligible : null;

  const settings = await getBotSettings(clerkId);
  const weekStart = startOfUtcWeekMs();
  const used = settings?.presetWeekStartedAt === weekStart ? settings.presetSwitchesThisWeek ?? 0 : 0;
  const max = maxPresetSwitchesPerWeek(role, sub, user?.email, founderOverride);
  const presetSwitchesRemaining = max == null ? null : Math.max(0, max - used);

  return {
    billingEnabled,
    useLaunchPrices,
    effectiveTier,
    currentPlan: normalizedTier,
    subscriptionStatus: sub?.status ?? 'NONE',
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    liveEntitled: hasLiveTradingAccess(role, sub, user?.email, founderOverride),
    canUsePaperTrading: sharedCanUsePaperTrading(role, sub, paperUsed, user?.email, founderOverride),
    requiresPaperSimulator: requiresPaperSimulator(role, sub, user?.email, founderOverride),
    trialEligibleTier: trialEligible,
    presetSwitchesRemaining,
    quantToolLinks,
    limits: limits
      ? {
          maxAccountBalance: limits.maxAccountBalance,
          maxExecutionsPerDay: limits.maxExecutionsPerDay,
          maxActiveStrategies: limits.maxActiveStrategies,
          maxPresetSwitchesPerWeek: limits.maxPresetSwitchesPerWeek,
          scanIntervalMin: limits.scanIntervalMin,
          scanIntervalMax: limits.scanIntervalMax,
          stocks: limits.stocks,
          crypto: limits.crypto,
          liveTrading: limits.liveTrading,
          basicAnalytics: limits.basicAnalytics,
          advancedAnalytics: limits.advancedAnalytics,
          premiumAnalytics: limits.premiumAnalytics,
          quantToolsAccess: limits.quantToolsAccess,
          experimentalStrategies: limits.experimentalStrategies,
        }
      : null,
    plans,
  };
}
