/**
 * Lazy Stripe client. Stripe is optional in dev (so the app boots without
 * billing keys); calling these helpers without configuration throws a clean
 * error rather than crashing at import time.
 */
import Stripe from 'stripe';
import { env } from '../config/env';
import { AppError } from './errors';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, 'BILLING_UNCONFIGURED', 'Billing is not configured on the server');
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  }
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID);
}
