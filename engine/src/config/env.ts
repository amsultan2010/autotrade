/**
 * Validated environment configuration. Fails fast at boot if a required
 * secret is missing. Nothing in the codebase reads process.env directly —
 * everything imports from here, so there are no hardcoded secrets.
 */
import { z } from 'zod';
import { PAPER_STARTING_BALANCE } from '@autotrade/shared';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  CONVEX_URL: z.string().optional(),
  BOT_INTERNAL_SECRET: z.string().optional(),

  CLERK_SECRET_KEY: z.string().optional(),

  // 64 hex chars = 32 bytes. Generate with: openssl rand -hex 32
  BROKER_ENCRYPTION_KEY: z.string().length(64, 'BROKER_ENCRYPTION_KEY must be 64 hex chars').optional(),

  // Legacy JWT auth — optional; Clerk is the primary auth path for web/Convex.
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be set (>=16 chars)').optional(),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be set (>=16 chars)').optional(),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Billing — disabled until Stripe is configured (see BILLING_ENABLED).
  BILLING_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  FOUNDER_LIVE_EMAIL: z.string().default('abdullahmsultan1@gmail.com'),

  // Stripe — optional unless BILLING_ENABLED=true.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_ELITE: z.string().optional(),
  CHECKOUT_SUCCESS_URL: z.string().default('app://autotrade/billing/success'),
  CHECKOUT_CANCEL_URL: z.string().default('app://autotrade/billing/cancel'),

  // 'alpaca' = free real-time WebSocket + broker (recommended). 'twelvedata' =
  // free REST multi-timeframe. 'finnhub' = paid candles. 'stooq' = anti-bot limited.
  MARKET_DATA_PROVIDER: z.enum(['alpaca', 'twelvedata', 'finnhub', 'stooq']).default('stooq'),
  FINNHUB_API_KEY: z.string().optional(),
  TWELVEDATA_API_KEY: z.string().optional(),

  // Alpaca (data + broker). Free key at https://alpaca.markets (no card).
  ALPACA_API_KEY: z.string().optional(),
  ALPACA_API_SECRET: z.string().optional(),
  ALPACA_FEED: z.enum(['iex', 'sip']).default('iex'), // iex = free real-time
  ALPACA_PAPER: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  // Enable the real-time WebSocket engine (vs the 60s polling scan loop).
  ALPACA_STREAMING: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  // Real-time streaming source (live ticks). Can differ from the REST candle
  // provider above. 'auto' = alpaca if configured, else finnhub if a key is set.
  STREAM_PROVIDER: z.enum(['auto', 'none', 'alpaca', 'finnhub']).default('auto'),

  PAPER_STARTING_BALANCE: z.coerce.number().positive().default(PAPER_STARTING_BALANCE),

  // When true, the backend starts its own embedded Postgres before serving
  // (used by the packaged desktop app so it's a single self-sufficient process).
  EMBEDDED_DB: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`❌ Invalid environment configuration:\n${details}`);
  // Throw rather than process.exit(1): in a serverless / Next.js API-route
  // context, exiting the process tears down the whole function so EVERY route
  // 500s (not just the one with the bad config). Throwing surfaces a clear
  // error for the failing request and lets a standalone process (worker) still
  // crash with a useful stack at startup.
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
