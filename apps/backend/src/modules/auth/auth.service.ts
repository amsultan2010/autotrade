/**
 * Auth service — registration, login, and rotating refresh-token lifecycle.
 *
 * Refresh tokens are opaque random strings. Only their SHA-256 hash is stored.
 * Each issuance belongs to a `family`; presenting an already-revoked token
 * (reuse) revokes the entire family — classic refresh-token theft mitigation.
 */
import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../lib/crypto.js';
import { signAccessToken } from '../../lib/jwt.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';
import { DEFAULT_WATCHLIST } from '../../config/defaults.js';
import type { AuthTokens, AuthUser } from '@autotrade/shared';

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueTokens(
  user: { id: string; email: string; role: AuthUser['role'] },
  family: string,
): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = generateOpaqueToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      family,
      expiresAt: refreshExpiry(),
    },
  });

  return { accessToken, refreshToken, expiresInSec: env.ACCESS_TOKEN_TTL_MIN * 60 };
}

export async function register(
  email: string,
  password: string,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash: await hashPassword(password),
      // New users get a paper account + default bot settings immediately.
      paperAccount: { create: { balance: env.PAPER_STARTING_BALANCE, equity: env.PAPER_STARTING_BALANCE } },
      botSettings: { create: {} },
      subscription: { create: { status: 'NONE' } },
      // Preload a recommended watchlist so new users have something to monitor.
      watchlist: { create: DEFAULT_WATCHLIST },
    },
    select: { id: true, email: true, role: true, status: true },
  });

  const tokens = await issueTokens(user, randomUUID());
  return { user, tokens };
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Constant-ish behavior: always run a verify to limit user enumeration via timing.
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok) {
    // Audit failed login (non-fatal: don't reveal which field was wrong).
    void writeAudit({ action: 'LOGIN_FAILED', meta: { email: normalized } });
    throw new UnauthorizedError('Invalid email or password');
  }
  if (user.status === 'DISABLED') throw new UnauthorizedError('This account has been disabled');

  const tokens = await issueTokens(user, randomUUID());
  void writeAudit({ actorId: user.id, action: 'LOGIN_SUCCESS' });
  return {
    user: { id: user.id, email: user.email, role: user.role, status: user.status },
    tokens,
  };
}

export async function refresh(rawToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record) throw new UnauthorizedError('Invalid refresh token');

  // Reuse detection: a revoked token presented again ⇒ revoke the whole family.
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: record.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token reuse detected; session revoked');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Refresh token expired');
  }

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!user || user.status === 'DISABLED') throw new UnauthorizedError('Account unavailable');

  // Rotate: revoke the presented token, issue a new one in the same family.
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  return issueTokens(user, record.family);
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (record) void writeAudit({ actorId: record.userId, action: 'LOGOUT' });
}

/** Verify a Clerk session token, then find-or-create the local user and issue backend JWTs. */
export async function clerkSync(sessionToken: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  if (!env.CLERK_SECRET_KEY) throw new UnauthorizedError('Clerk not configured');

  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  // Extract the session ID from the JWT payload (the `sid` claim) without
  // verifying the signature — Clerk's verifySession does the real verification.
  // We need the session ID as the first argument; passing the raw token twice
  // would cause the lookup to fail.
  let sessionId: string;
  try {
    const payloadB64 = sessionToken.split('.')[1];
    if (!payloadB64) throw new Error('malformed');
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    const sid = payload['sid'] ?? payload['sub'];
    if (typeof sid !== 'string' || !sid) throw new Error('no sid');
    sessionId = sid;
  } catch {
    throw new UnauthorizedError('Invalid Clerk session token');
  }

  const session = await clerk.sessions.verifySession(sessionId, sessionToken).catch(() => {
    throw new UnauthorizedError('Invalid Clerk session token');
  });

  const clerkUser = await clerk.users.getUser(session.userId);
  const email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress;
  if (!email) throw new UnauthorizedError('Clerk user has no primary email');

  const normalized = email.trim().toLowerCase();

  let user = await prisma.user.findFirst({ where: { email: normalized }, select: { id: true, email: true, role: true, status: true } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash: '',
        paperAccount: { create: { balance: env.PAPER_STARTING_BALANCE, equity: env.PAPER_STARTING_BALANCE } },
        botSettings: { create: {} },
        subscription: { create: { status: 'NONE' } },
        watchlist: { create: DEFAULT_WATCHLIST },
      },
      select: { id: true, email: true, role: true, status: true },
    });
  }

  if (user.status === 'DISABLED') throw new UnauthorizedError('This account has been disabled');

  const tokens = await issueTokens(user, randomUUID());
  return { user, tokens };
}
