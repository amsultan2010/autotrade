/** Paid tiers that unlock live trading when billing is enabled. */
export const LIVE_TRADING_TIERS = ['starter', 'pro', 'elite'] as const;
export type LiveTradingTier = (typeof LIVE_TRADING_TIERS)[number];

/** Dev/founder bypass tier — not sold via Stripe. */
export const FOUNDER_TIER = 'founder' as const;

const DEFAULT_FOUNDER_EMAIL = 'abdullahmsultan1@gmail.com';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when Stripe checkout and paid tiers are active. */
export function isBillingEnabledEnv(): boolean {
  return process.env.BILLING_ENABLED === 'true';
}

export function founderLiveEmailEnv(): string {
  return normalizeEmail(process.env.FOUNDER_LIVE_EMAIL ?? DEFAULT_FOUNDER_EMAIL);
}

export function isLiveTradingTier(tier: string | null | undefined): boolean {
  if (!tier) return false;
  return (
    (LIVE_TRADING_TIERS as readonly string[]).includes(tier) || tier === FOUNDER_TIER
  );
}
