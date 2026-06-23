/** Billing flags read from Convex environment (mirror Vercel values). */

const DEFAULT_FOUNDER_EMAIL = 'abdullahmsultan1@gmail.com';

export const LIVE_TRADING_TIERS = ['starter', 'pro', 'elite'] as const;
export const FOUNDER_TIER = 'founder' as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true';
}

export function founderLiveEmail(): string {
  return normalizeEmail(process.env.FOUNDER_LIVE_EMAIL ?? DEFAULT_FOUNDER_EMAIL);
}

export function isLiveTradingTier(tier: string | null | undefined): boolean {
  if (!tier) return false;
  return (
    (LIVE_TRADING_TIERS as readonly string[]).includes(tier) || tier === FOUNDER_TIER
  );
}

export function isFounderEmail(email: string): boolean {
  return normalizeEmail(email) === founderLiveEmail();
}
