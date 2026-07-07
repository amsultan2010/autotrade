-- Row Level Security: Clerk JWT subject (auth.jwt()->>'sub')

CREATE OR REPLACE FUNCTION auth_clerk_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '');
$$;

-- ── Enable RLS on all tables ─────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- broker_credentials and audit_logs: no policies (service role only)

-- ── users ────────────────────────────────────────────────────────────────────

CREATE POLICY users_select_own ON users
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── subscriptions ────────────────────────────────────────────────────────────

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── bot_settings ─────────────────────────────────────────────────────────────

CREATE POLICY bot_settings_select_own ON bot_settings
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── watched_symbols ──────────────────────────────────────────────────────────

CREATE POLICY watched_symbols_select_own ON watched_symbols
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── trades ───────────────────────────────────────────────────────────────────

CREATE POLICY trades_select_own ON trades
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── paper_accounts ───────────────────────────────────────────────────────────

CREATE POLICY paper_accounts_select_own ON paper_accounts
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── strategy_stats ─────────────────────────────────────────────────────────

CREATE POLICY strategy_stats_select_own ON strategy_stats
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── broker_snapshots ─────────────────────────────────────────────────────────

CREATE POLICY broker_snapshots_select_own ON broker_snapshots
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());

-- ── signals ──────────────────────────────────────────────────────────────────

CREATE POLICY signals_select_own ON signals
  FOR SELECT
  TO authenticated
  USING (clerk_id = auth_clerk_id());
