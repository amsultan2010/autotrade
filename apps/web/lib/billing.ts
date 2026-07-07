/** Billing flags read from Vercel environment variables. */

import { isFounderTestEmail, normalizePlanTier } from '@autotrade/shared';

export const LIVE_TRADING_TIERS = ['essential', 'pro', 'unlimited'] as const;
export const FOUNDER_TIER = 'founder' as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true';
}

export function useLaunchPrices(): boolean {
  return process.env.STRIPE_USE_LAUNCH_PRICES !== 'false';
}

export function isFounderEmail(email: string): boolean {
  return isFounderTestEmail(email);
}

export function isLiveTradingTier(tier: string | null | undefined): boolean {
  if (!tier) return false;
  if (tier === FOUNDER_TIER) return true;
  const normalized = normalizePlanTier(tier);
  return normalized != null && (LIVE_TRADING_TIERS as readonly string[]).includes(normalized);
}

export function stripePriceIdForTier(tier: 'essential' | 'pro' | 'unlimited'): string | undefined {
  const useLaunch = useLaunchPrices();
  switch (tier) {
    case 'essential':
      return process.env.STRIPE_PRICE_ESSENTIAL ?? process.env.STRIPE_PRICE_STARTER ?? undefined;
    case 'pro':
      return useLaunch
        ? (process.env.STRIPE_PRICE_PRO_LAUNCH ?? process.env.STRIPE_PRICE_PRO ?? undefined)
        : (process.env.STRIPE_PRICE_PRO ?? undefined);
    case 'unlimited':
      return useLaunch
        ? (process.env.STRIPE_PRICE_UNLIMITED_LAUNCH ?? process.env.STRIPE_PRICE_UNLIMITED ?? process.env.STRIPE_PRICE_ELITE ?? undefined)
        : (process.env.STRIPE_PRICE_UNLIMITED ?? process.env.STRIPE_PRICE_ELITE ?? undefined);
    default:
      return undefined;
  }
}
