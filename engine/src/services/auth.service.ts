/**
 * Auth service — legacy JWT registration/login removed in favor of Clerk.
 * User provisioning lives in Convex (web/convex/users.ts).
 */
import type { AuthTokens, AuthUser } from '@autotrade/shared';

const clerkAuthMessage = 'Use Clerk authentication';

export async function register(
  _email: string,
  _password: string,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  throw new Error(clerkAuthMessage);
}

export async function login(
  _email: string,
  _password: string,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  throw new Error(clerkAuthMessage);
}

export async function refresh(_rawToken: string): Promise<AuthTokens> {
  throw new Error(clerkAuthMessage);
}

export async function logout(_rawToken: string): Promise<void> {
  throw new Error(clerkAuthMessage);
}

export async function clerkSync(_sessionToken: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  throw new Error(clerkAuthMessage);
}
