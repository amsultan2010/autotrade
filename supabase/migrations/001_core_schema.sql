-- Autotrade core schema (mirrors web/convex/schema.ts)
-- UUID primary keys, snake_case columns, Clerk subject on clerk_id

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION attach_updated_at_trigger(tbl regclass)
RETURNS void AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS set_updated_at ON %s',
    tbl
  );
  EXECUTE format(
    'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
    tbl
  );
END;
$$ LANGUAGE plpgsql;

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('USER', 'ADMIN', 'DEVELOPER')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  alpaca_guide_completed BOOLEAN,
  product_tour_completed BOOLEAN,
  welcome_email_sent_at BIGINT,
  weekly_digest_enabled BOOLEAN,
  founder_plan_override TEXT CHECK (
    founder_plan_override IS NULL
    OR founder_plan_override IN ('free', 'essential', 'pro', 'unlimited')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_clerk_id_unique UNIQUE (clerk_id)
);

CREATE INDEX users_by_clerk_id ON users (clerk_id);
CREATE INDEX users_by_email ON users (email);

SELECT attach_updated_at_trigger('users'::regclass);

-- ── subscriptions ────────────────────────────────────────────────────────────

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  tier TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'UNPAID')
  ),
  current_period_end BIGINT,
  cancel_at_period_end BOOLEAN,
  legacy_tier TEXT,
  legacy_tier_until BIGINT,
  trials_used TEXT[] DEFAULT '{}',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX subscriptions_by_clerk_id ON subscriptions (clerk_id);
CREATE INDEX subscriptions_by_stripe_customer_id ON subscriptions (stripe_customer_id);

SELECT attach_updated_at_trigger('subscriptions'::regclass);

-- ── watched_symbols ──────────────────────────────────────────────────────────

CREATE TABLE watched_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  mic TEXT,
  added_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX watched_symbols_by_clerk_id ON watched_symbols (clerk_id);
CREATE UNIQUE INDEX watched_symbols_by_clerk_symbol_exchange
  ON watched_symbols (clerk_id, symbol, exchange);

SELECT attach_updated_at_trigger('watched_symbols'::regclass);

-- ── bot_settings ─────────────────────────────────────────────────────────────

CREATE TABLE bot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('DISABLED', 'PAPER', 'LIVE')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  max_active_trades INTEGER NOT NULL,
  max_trade_size DOUBLE PRECISION NOT NULL,
  risk_per_trade_pct DOUBLE PRECISION NOT NULL,
  default_stop_pct DOUBLE PRECISION NOT NULL,
  default_take_profit_pct DOUBLE PRECISION NOT NULL,
  max_daily_loss DOUBLE PRECISION NOT NULL,
  trading_hours_start TEXT NOT NULL,
  trading_hours_end TEXT NOT NULL,
  min_confidence DOUBLE PRECISION NOT NULL,
  timeframes TEXT[] NOT NULL DEFAULT '{}',
  strategies TEXT[] NOT NULL DEFAULT '{}',
  stock_strategies TEXT[],
  crypto_strategies TEXT[],
  include_experimental BOOLEAN,
  disabled_strategies TEXT[],
  scan_interval_seconds INTEGER,
  last_scan_at BIGINT,
  preset_switches_this_week INTEGER,
  preset_week_started_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bot_settings_clerk_id_unique UNIQUE (clerk_id)
);

CREATE INDEX bot_settings_by_clerk_id ON bot_settings (clerk_id);

SELECT attach_updated_at_trigger('bot_settings'::regclass);

-- ── signals ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  exchange TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  timeframe TEXT NOT NULL,
  strategy TEXT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN ('BUY', 'SELL', 'HOLD', 'AVOID', 'CLOSE')
  ),
  confidence DOUBLE PRECISION NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  entry_reason TEXT NOT NULL,
  stop_loss DOUBLE PRECISION,
  take_profit DOUBLE PRECISION,
  rr_ratio DOUBLE PRECISION,
  explanation TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signals_by_clerk_id ON signals (clerk_id);
CREATE INDEX IF NOT EXISTS signals_by_ticker ON signals (ticker);

SELECT attach_updated_at_trigger('signals'::regclass);

-- ── trades ───────────────────────────────────────────────────────────────────

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  signal_id UUID REFERENCES signals (id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  mode TEXT NOT NULL CHECK (mode IN ('DISABLED', 'PAPER', 'LIVE')),
  qty DOUBLE PRECISION NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION,
  stop_loss DOUBLE PRECISION,
  take_profit DOUBLE PRECISION,
  pnl DOUBLE PRECISION,
  result TEXT NOT NULL CHECK (result IN ('OPEN', 'WIN', 'LOSS', 'BREAKEVEN')),
  strategy TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  entry_reason TEXT NOT NULL,
  exit_reason TEXT,
  mistake_tags TEXT[] NOT NULL DEFAULT '{}',
  entry_snapshot JSONB,
  exit_snapshot JSONB,
  reasoning_correct BOOLEAN,
  broker_order_id TEXT,
  opened_at BIGINT NOT NULL,
  closed_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX trades_by_clerk_id ON trades (clerk_id);
CREATE INDEX trades_by_clerk_result ON trades (clerk_id, result);
CREATE INDEX trades_by_symbol ON trades (symbol);

SELECT attach_updated_at_trigger('trades'::regclass);

-- ── paper_accounts ───────────────────────────────────────────────────────────

CREATE TABLE paper_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  balance DOUBLE PRECISION NOT NULL,
  equity DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT paper_accounts_clerk_id_unique UNIQUE (clerk_id)
);

CREATE INDEX paper_accounts_by_clerk_id ON paper_accounts (clerk_id);

SELECT attach_updated_at_trigger('paper_accounts'::regclass);

-- ── strategy_stats ───────────────────────────────────────────────────────────

CREATE TABLE strategy_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  strategy TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  trades INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  total_pnl DOUBLE PRECISION NOT NULL,
  expectancy DOUBLE PRECISION NOT NULL,
  weighted_confidence DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX strategy_stats_by_clerk_id ON strategy_stats (clerk_id);
CREATE UNIQUE INDEX strategy_stats_by_clerk_strategy_symbol
  ON strategy_stats (clerk_id, strategy, symbol);

SELECT attach_updated_at_trigger('strategy_stats'::regclass);

-- ── broker_credentials (service role only; no client RLS) ─────────────────────

CREATE TABLE broker_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key_id TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  paper BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX broker_credentials_by_clerk_id ON broker_credentials (clerk_id);
CREATE UNIQUE INDEX broker_credentials_by_clerk_id_and_paper
  ON broker_credentials (clerk_id, paper);

SELECT attach_updated_at_trigger('broker_credentials'::regclass);

-- ── broker_snapshots ─────────────────────────────────────────────────────────

CREATE TABLE broker_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL,
  equity DOUBLE PRECISION NOT NULL,
  cash DOUBLE PRECISION NOT NULL,
  buying_power DOUBLE PRECISION NOT NULL,
  last_equity DOUBLE PRECISION,
  mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
  positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at BIGINT NOT NULL,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT broker_snapshots_clerk_id_unique UNIQUE (clerk_id)
);

CREATE INDEX broker_snapshots_by_clerk_id ON broker_snapshots (clerk_id);

SELECT attach_updated_at_trigger('broker_snapshots'::regclass);

-- ── audit_logs (service role only; no client RLS) ────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_clerk_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  meta JSONB,
  ip TEXT,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_by_actor ON audit_logs (actor_clerk_id);
CREATE INDEX IF NOT EXISTS audit_logs_by_action ON audit_logs (action);

SELECT attach_updated_at_trigger('audit_logs'::regclass);

-- ── Supabase Realtime ────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'subscriptions',
    'watched_symbols',
    'bot_settings',
    'signals',
    'trades',
    'paper_accounts',
    'strategy_stats',
    'broker_snapshots'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN undefined_object THEN
        RAISE NOTICE 'Publication supabase_realtime not found; skip %', tbl;
    END;
  END LOOP;
END $$;
