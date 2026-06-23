import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireAdmin } from './lib/adminAuth';

const userRole = v.union(v.literal('USER'), v.literal('ADMIN'), v.literal('DEVELOPER'));
const userStatus = v.union(v.literal('ACTIVE'), v.literal('DISABLED'));
const subscriptionStatus = v.union(
  v.literal('NONE'),
  v.literal('ACTIVE'),
  v.literal('PAST_DUE'),
  v.literal('CANCELED'),
  v.literal('TRIALING'),
);

const adminUserSummary = v.object({
  id: v.string(),
  email: v.string(),
  role: userRole,
  status: userStatus,
  createdAt: v.string(),
  subscription: v.union(
    v.object({
      status: subscriptionStatus,
      tier: v.union(v.string(), v.null()),
      currentPeriodEnd: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  _count: v.object({ trades: v.number() }),
});

const adminUserDetail = v.object({
  id: v.string(),
  email: v.string(),
  role: userRole,
  status: userStatus,
  createdAt: v.string(),
  subscription: v.union(
    v.object({
      status: subscriptionStatus,
      tier: v.union(v.string(), v.null()),
      currentPeriodEnd: v.union(v.string(), v.null()),
      stripeCustomerId: v.union(v.string(), v.null()),
      stripeSubscriptionId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  botSettings: v.union(v.any(), v.null()),
  paperAccount: v.union(v.any(), v.null()),
  _count: v.object({ trades: v.number(), signals: v.number() }),
});

async function formatUserSummary(ctx: QueryCtx, user: Doc<'users'>) {
  const sub = await ctx.db
    .query('subscriptions')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', user.clerkId))
    .unique();
  const trades = await ctx.db
    .query('trades')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', user.clerkId))
    .collect();

  return {
    id: user.clerkId,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: new Date(user._creationTime).toISOString(),
    subscription: sub
      ? {
          status: sub.status,
          tier: sub.tier ?? null,
          currentPeriodEnd: sub.currentPeriodEnd
            ? new Date(sub.currentPeriodEnd).toISOString()
            : null,
        }
      : null,
    _count: { trades: trades.length },
  };
}

async function writeAudit(
  ctx: { db: import('./_generated/server').MutationCtx['db'] },
  args: {
    actorClerkId: string;
    action: string;
    target?: string;
    meta?: unknown;
  },
) {
  await ctx.db.insert('auditLogs', {
    actorClerkId: args.actorClerkId,
    action: args.action,
    target: args.target,
    meta: args.meta,
    createdAt: Date.now(),
  });
}

export const listUsers = query({
  args: {
    q: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(adminUserSummary),
  handler: async (ctx, { q, limit = 50 }) => {
    await requireAdmin(ctx);

    const all = await ctx.db.query('users').order('desc').collect();
    const needle = q?.trim().toLowerCase();
    const filtered = needle
      ? all.filter((u) => u.email.toLowerCase().includes(needle))
      : all;

    const page = filtered.slice(0, Math.min(Math.max(limit, 1), 200));
    return Promise.all(page.map((user) => formatUserSummary(ctx, user)));
  },
});

export const getUser = query({
  args: { clerkId: v.string() },
  returns: v.union(adminUserDetail, v.null()),
  handler: async (ctx, { clerkId }) => {
    await requireAdmin(ctx);

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (!user) return null;

    const [sub, trades, signals, botSettings, paperAccount] = await Promise.all([
      ctx.db
        .query('subscriptions')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique(),
      ctx.db
        .query('trades')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .collect(),
      ctx.db
        .query('signals')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .collect(),
      ctx.db
        .query('botSettings')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique(),
      ctx.db
        .query('paperAccounts')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique(),
    ]);

    return {
      id: user.clerkId,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: new Date(user._creationTime).toISOString(),
      subscription: sub
        ? {
            status: sub.status,
            tier: sub.tier ?? null,
            currentPeriodEnd: sub.currentPeriodEnd
              ? new Date(sub.currentPeriodEnd).toISOString()
              : null,
            stripeCustomerId: sub.stripeCustomerId ?? null,
            stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
          }
        : null,
      botSettings: botSettings ?? null,
      paperAccount: paperAccount ?? null,
      _count: { trades: trades.length, signals: signals.length },
    };
  },
});

export const setUserStatus = mutation({
  args: {
    clerkId: v.string(),
    status: userStatus,
  },
  returns: v.object({ id: v.string(), status: userStatus }),
  handler: async (ctx, { clerkId, status }) => {
    const actor = await requireAdmin(ctx);

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (!user) throw new Error('User not found');

    await ctx.db.patch(user._id, { status });
    await writeAudit(ctx, {
      actorClerkId: actor.clerkId,
      action: 'USER_STATUS_CHANGE',
      target: clerkId,
      meta: { status },
    });

    return { id: clerkId, status };
  },
});

export const setUserRole = mutation({
  args: {
    clerkId: v.string(),
    role: userRole,
  },
  returns: v.object({ id: v.string(), role: userRole }),
  handler: async (ctx, { clerkId, role }) => {
    const actor = await requireAdmin(ctx);

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique();
    if (!user) throw new Error('User not found');

    await ctx.db.patch(user._id, { role });
    await writeAudit(ctx, {
      actorClerkId: actor.clerkId,
      action: 'USER_ROLE_CHANGE',
      target: clerkId,
      meta: { role },
    });

    return { id: clerkId, role };
  },
});

export const metrics = query({
  args: {},
  returns: v.object({
    users: v.number(),
    activeSubs: v.number(),
    openTrades: v.number(),
    signals24h: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const since = Date.now() - 86_400_000;
    const [users, subs, trades, signals] = await Promise.all([
      ctx.db.query('users').collect(),
      ctx.db.query('subscriptions').collect(),
      ctx.db.query('trades').collect(),
      ctx.db.query('signals').collect(),
    ]);

    return {
      users: users.length,
      activeSubs: subs.filter((s) => s.status === 'ACTIVE').length,
      openTrades: trades.filter((t) => t.result === 'OPEN').length,
      signals24h: signals.filter((s) => s.createdAt >= since).length,
    };
  },
});

export const listTrades = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { limit = 100 }) => {
    await requireAdmin(ctx);
    const take = Math.min(Math.max(limit, 1), 500);
    return ctx.db.query('trades').order('desc').take(take);
  },
});

export const listSignals = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { limit = 100 }) => {
    await requireAdmin(ctx);
    const take = Math.min(Math.max(limit, 1), 500);
    return ctx.db.query('signals').order('desc').take(take);
  },
});

export const listAudit = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id('auditLogs'),
      _creationTime: v.number(),
      actorClerkId: v.optional(v.string()),
      actorEmail: v.union(v.string(), v.null()),
      action: v.string(),
      target: v.optional(v.string()),
      meta: v.optional(v.any()),
      ip: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { limit = 100 }) => {
    await requireAdmin(ctx);
    const take = Math.min(Math.max(limit, 1), 500);
    const logs = await ctx.db.query('auditLogs').order('desc').take(take);

    const actorIds = [...new Set(logs.map((l) => l.actorClerkId).filter(Boolean))] as string[];
    const actors = new Map<string, string>();
    for (const clerkId of actorIds) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .unique();
      if (user) actors.set(clerkId, user.email);
    }

    return logs.map((log) => ({
      ...log,
      actorEmail: log.actorClerkId ? (actors.get(log.actorClerkId) ?? null) : null,
    }));
  },
});
