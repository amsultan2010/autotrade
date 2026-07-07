import { getSupabaseServer } from '@/lib/supabase-server';
import { isFounderEmail } from '@/lib/billing';
import { getEffectiveTier } from '@/lib/entitlements';
import { mapUser, type UserRow, type UserRecord } from './row-mappers';
import { ensureUserRecords } from './bootstrap';
import { getSubscriptionByClerkId } from './subscriptions';

export async function me(clerkId: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseServer()
    .from('users')
    .select('*')
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) throw new Error(`users.me failed: ${error.message}`);
  return data ? mapUser(data as UserRow) : null;
}

export async function ensureExists(
  clerkId: string,
  email: string,
): Promise<{ userId: string; shouldSendWelcome: boolean }> {
  const existing = await me(clerkId);
  if (existing) {
    await ensureUserRecords(clerkId, email);
    return {
      userId: existing.id,
      shouldSendWelcome: existing.welcomeEmailSentAt === undefined,
    };
  }

  const { data, error } = await getSupabaseServer()
    .from('users')
    .insert({
      clerk_id: clerkId,
      email,
      role: 'USER',
      status: 'ACTIVE',
      alpaca_guide_completed: false,
      product_tour_completed: false,
      weekly_digest_enabled: true,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`users.ensureExists failed: ${error?.message}`);

  await ensureUserRecords(clerkId, email);
  return { userId: data.id as string, shouldSendWelcome: true };
}

export async function syncFromClerk(args: {
  clerkId: string;
  email: string;
  role?: 'USER' | 'ADMIN' | 'DEVELOPER';
}): Promise<{ userId: string; shouldSendWelcome: boolean }> {
  const existing = await me(args.clerkId);
  if (existing) {
    await getSupabaseServer().from('users').update({ email: args.email }).eq('clerk_id', args.clerkId);
    await ensureUserRecords(args.clerkId, args.email);
    return {
      userId: existing.id,
      shouldSendWelcome: existing.welcomeEmailSentAt === undefined,
    };
  }

  const { data, error } = await getSupabaseServer()
    .from('users')
    .insert({
      clerk_id: args.clerkId,
      email: args.email,
      role: args.role ?? 'USER',
      status: 'ACTIVE',
      alpaca_guide_completed: false,
      product_tour_completed: false,
      weekly_digest_enabled: true,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`users.syncFromClerk failed: ${error?.message}`);

  await ensureUserRecords(args.clerkId, args.email);
  return { userId: data.id as string, shouldSendWelcome: true };
}

export async function claimWelcomeEmail(clerkId: string): Promise<boolean> {
  const user = await me(clerkId);
  if (!user || user.welcomeEmailSentAt !== undefined) return false;
  const { error } = await getSupabaseServer()
    .from('users')
    .update({ welcome_email_sent_at: Date.now() })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(`claimWelcomeEmail failed: ${error.message}`);
  return true;
}

export async function disableFromClerk(clerkId: string): Promise<string | null> {
  const user = await me(clerkId);
  if (!user) return null;
  const { error } = await getSupabaseServer()
    .from('users')
    .update({ status: 'DISABLED' })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(`disableFromClerk failed: ${error.message}`);
  return user.email;
}

export async function setWeeklyDigestEnabled(clerkId: string, enabled: boolean): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('users')
    .update({ weekly_digest_enabled: enabled })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);
}

export async function completeAlpacaGuide(clerkId: string): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('users')
    .update({ alpaca_guide_completed: true })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);
}

export async function completeProductTour(clerkId: string): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('users')
    .update({ product_tour_completed: true })
    .eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);
}

export async function patchUser(
  clerkId: string,
  patch: Partial<{
    alpacaGuideCompleted: boolean;
    productTourCompleted: boolean;
    weeklyDigestEnabled: boolean;
    founderPlanOverride: 'free' | 'essential' | 'pro' | 'unlimited' | null;
  }>,
): Promise<UserRecord> {
  const row: Record<string, unknown> = {};
  if (patch.alpacaGuideCompleted !== undefined) row.alpaca_guide_completed = patch.alpacaGuideCompleted;
  if (patch.productTourCompleted !== undefined) row.product_tour_completed = patch.productTourCompleted;
  if (patch.weeklyDigestEnabled !== undefined) row.weekly_digest_enabled = patch.weeklyDigestEnabled;
  if (patch.founderPlanOverride !== undefined) row.founder_plan_override = patch.founderPlanOverride;

  const { error } = await getSupabaseServer().from('users').update(row).eq('clerk_id', clerkId);
  if (error) throw new Error(error.message);
  const user = await me(clerkId);
  if (!user) throw new Error('User not found');
  return user;
}

export async function getFounderSettings(clerkId: string) {
  const user = await me(clerkId);
  if (!user || !isFounderEmail(user.email)) return null;
  const sub = await getSubscriptionByClerkId(clerkId);
  return {
    email: user.email,
    planOverride: user.founderPlanOverride ?? null,
    effectiveTier: getEffectiveTier(user.role, sub, user.email, user.founderPlanOverride ?? null),
    billingTier: sub?.tier ?? null,
  };
}

export async function getByClerkId(clerkId: string) {
  const user = await me(clerkId);
  if (!user) return null;
  return {
    role: user.role,
    email: user.email,
    founderPlanOverride: user.founderPlanOverride,
  };
}

export async function listActiveUsers(): Promise<Array<{ clerkId: string; email: string }>> {
  const { data, error } = await getSupabaseServer().from('users').select('clerk_id, email, status, weekly_digest_enabled');
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((u) => u.status === 'ACTIVE' && u.weekly_digest_enabled !== false)
    .map((u) => ({ clerkId: u.clerk_id as string, email: u.email as string }));
}
