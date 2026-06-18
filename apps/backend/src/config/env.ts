/**
 * Validated environment configuration. Fails fast at boot if a required
 * secret is missing. Nothing in the codebase reads process.env directly —
 * everything imports from here, so there are no hardcoded secrets.
 */
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  CLERK_SECRET_KEY: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be set (>=16 chars)'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be set (>=16 chars)'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Stripe is required in production but optional in dev so the app can boot
  // without billing configured. Subscription routes guard their own presence.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
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

  PAPER_STARTING_BALANCE: z.coerce.number().positive().default(100_000),

  // When true, the backend starts its own embedded Postgres before serving
  // (used by the packaged desktop app so it's a single self-sufficient process).
  EMBEDDED_DB: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
