import type { MutationCtx } from '../_generated/server';
import { FOUNDER_TIER, isFounderEmail } from './billing';

export async function ensureFounderSubscription(
  ctx: MutationCtx,
  clerkId: string,
  email: string,
): Promise<void> {
  if (!isFounderEmail(email)) return;
  const existing = await ctx.db
    .query('subscriptions')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .unique();
  if (existing) {
    await ctx.db.patch('subscriptions', existing._id, { status: 'ACTIVE', tier: FOUNDER_TIER });
    return;
  }
  await ctx.db.insert('subscriptions', {
    clerkId,
    status: 'ACTIVE',
    tier: FOUNDER_TIER,
  });
}
