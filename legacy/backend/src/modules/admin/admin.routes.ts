/**
 * Admin / developer backend (req #3, #7). Every route is gated by
 * roleGuard(['ADMIN','DEVELOPER']) via `requireAdmin`. Mutations are audit-logged.
 * Normal users can never reach these routes.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROLES, USER_STATUSES } from '@autotrade/shared';
import { prisma } from '../../lib/prisma.js';
import { parse } from '../../lib/validate.js';
import { requireAdmin } from '../../middleware/guards.js';
import { writeAudit } from '../../lib/audit.js';
import { NotFoundError } from '../../lib/errors.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // ── Users ──
  app.get('/admin/users', requireAdmin, async (req) => {
    const { q, limit } = parse(
      z.object({ q: z.string().max(255).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
      req.query,
    );
    return prisma.user.findMany({
      where: q ? { email: { contains: q, mode: 'insensitive' } } : undefined,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        subscription: { select: { status: true, tier: true, currentPeriodEnd: true } },
        _count: { select: { trades: true } },
      },
    });
  });

  app.get('/admin/users/:id', requireAdmin, async (req) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        subscription: true,
        botSettings: true,
        paperAccount: true,
        _count: { select: { trades: true, signals: true } },
      },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  });

  // Enable / disable an account.
  app.post('/admin/users/:id/status', requireAdmin, async (req) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const { status } = parse(z.object({ status: z.enum(USER_STATUSES) }), req.body);
    const updated = await prisma.user.update({ where: { id }, data: { status } });
    await writeAudit({ actorId: req.authUser!.id, action: 'USER_STATUS_CHANGE', target: id, meta: { status }, ip: req.ip });
    if (status === 'DISABLED') {
      // Revoke active sessions of a disabled user.
      await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return { id: updated.id, status: updated.status };
  });

  // Change a user's role (e.g. grant DEVELOPER access without payment).
  app.post('/admin/users/:id/role', requireAdmin, async (req) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const { role } = parse(z.object({ role: z.enum(ROLES) }), req.body);
    const updated = await prisma.user.update({ where: { id }, data: { role } });
    await writeAudit({ actorId: req.authUser!.id, action: 'USER_ROLE_CHANGE', target: id, meta: { role }, ip: req.ip });
    return { id: updated.id, role: updated.role };
  });

  // ── Bot activity / trade logs across all users ──
  app.get('/admin/trades', requireAdmin, async (req) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
    return prisma.trade.findMany({
      take: limit,
      orderBy: { openedAt: 'desc' },
      include: { user: { select: { email: true } } },
    });
  });

  app.get('/admin/signals', requireAdmin, async (req) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
    return prisma.signal.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });
  });

  // ── Audit / security log ──
  app.get('/admin/audit', requireAdmin, async (req) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { email: true } } },
    });
  });

  // ── App version management ──
  const versionSchema = z.object({
    version: z.string().min(1).max(40),
    channel: z.enum(['stable', 'beta']).default('stable'),
    notes: z.string().max(5000).optional(),
    downloadUrl: z.string().url().optional(),
    mandatory: z.boolean().default(false),
  });

  app.get('/admin/app-versions', requireAdmin, async () =>
    prisma.appVersion.findMany({ orderBy: { publishedAt: 'desc' } }),
  );

  app.post('/admin/app-versions', requireAdmin, async (req, reply) => {
    const data = parse(versionSchema, req.body);
    const created = await prisma.appVersion.create({ data });
    await writeAudit({ actorId: req.authUser!.id, action: 'APP_VERSION_PUBLISH', target: created.id, meta: data, ip: req.ip });
    return reply.code(201).send(created);
  });

  // ── Provider / API settings (selection + non-secret options; secrets stay in env) ──
  app.get('/admin/provider-settings', requireAdmin, async () =>
    prisma.providerSetting.findMany({ orderBy: { key: 'asc' } }),
  );

  app.put('/admin/provider-settings/:key', requireAdmin, async (req) => {
    const { key } = parse(z.object({ key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/) }), req.params);
    const { value } = parse(z.object({ value: z.string().max(2000) }), req.body);
    const saved = await prisma.providerSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    await writeAudit({ actorId: req.authUser!.id, action: 'PROVIDER_SETTING_CHANGE', target: key, meta: { value }, ip: req.ip });
    return saved;
  });

  // ── Lightweight system metrics ──
  app.get('/admin/metrics', requireAdmin, async () => {
    const [users, activeSubs, openTrades, signals24h] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.trade.count({ where: { result: 'OPEN' } }),
      prisma.signal.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return { users, activeSubs, openTrades, signals24h };
  });
}
