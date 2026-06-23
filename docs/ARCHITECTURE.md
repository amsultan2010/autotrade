# Autotrade — Architecture & Design

> Personalized, subscription-gated AI trading bot. Windows desktop client (`.exe`)
> backed by a secure Node/TS API. This document is the source of truth for the
> system design. Code is built to match it.

---

## 0. Guiding principles

1. **The backend is the source of truth.** Subscription status, roles, secrets,
   market-data keys, and trade ledgers live server-side. The desktop app is a
   client that holds *no* provider secrets.
2. **Everything risky is gated and reversible.** Execution has three modes —
   `DISABLED`, `PAPER`, `LIVE` — and defaults to `PAPER`. Live trading is only
   ever wired through licensed broker APIs, never simulated.
3. **Swap, don't lock.** Market data, broker execution, and the AI explanation
   layer all sit behind interfaces. Default implementations are replaceable.
4. **Explainable decisions.** Every signal carries a human-readable reason,
   the indicators behind it, a confidence score, and a risk assessment.
5. **Honest learning.** "Learning" = per-user, per-strategy realized statistics
   that re-weight confidence over time. No claims of market prediction.

---

## 1. Full product architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DESKTOP CLIENT (Electron .exe)                    │
│  React + TS UI  │  Main process (secure store, IPC, auto-update)      │
│  - Login / subscription gate                                          │
│  - Dashboard, Watchlist, Trade History, Settings, (Admin panel)       │
│  - Talks ONLY to backend over HTTPS with short-lived access token     │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │  HTTPS (JWT access token)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND API (Fastify/TS)                      │
│  Auth ─ Subscription ─ Admin ─ Watchlist ─ Settings ─ Trades ─ Bot    │
│  Middleware: authGuard · subscriptionGuard · roleGuard · rateLimit    │
├─────────────────────────────────────────────────────────────────────┤
│                          DOMAIN SERVICES                              │
│  MarketDataService (provider iface) ─ AnalysisEngine (indicators)     │
│  DecisionEngine (signals+reasons) ─ RiskManager ─ PaperEngine         │
│  LiveExecution (broker iface) ─ LearningService ─ TradeLedger         │
├─────────────────────────────────────────────────────────────────────┤
│  Workers / scheduler: market scan loop, position monitor, billing     │
└───────┬───────────────────────────┬───────────────────────┬─────────┘
        │                           │                       │
        ▼                           ▼                       ▼
  Convex (database)          Market Data Provider      Stripe
  users, subs, trades,       (Finnhub default;         (checkout +
  watchlists, signals,        Polygon/Alpaca/...)       webhooks)
  strategy_stats, audit                                      │
                                                       Broker API (later)
                                                       Alpaca / IBKR / TV
```

**Service responsibilities (your req #7 separation of concerns):**

| Layer | Responsibility | Never does |
|---|---|---|
| MarketData | Quotes, OHLC candles, symbol search | Make decisions |
| Analysis | Compute indicators per timeframe | Place orders |
| Decision | Turn indicator confluence → signal + reason + confidence | Touch money |
| Risk | Position sizing, stop/target, daily-loss cutoff, max-trades | Analyze charts |
| Paper exec | Simulate fills against real prices | Hit a broker |
| Live exec | Route orders to a real broker | Run in paper mode |
| Ledger | Immutable trade history + P/L | Decide trades |
| Learning | Re-weight per-user strategy confidence from outcomes | Override risk caps |

---

## 2. Recommended tech stack

- **Desktop:** Electron + React 18 + TypeScript + Vite, packaged with
  `electron-builder` → NSIS `.exe`. Secure local store via `safeStorage`
  (OS-level encryption) for the refresh token only.
- **Backend:** Node 20+, TypeScript, **Fastify**, Zod for validation,
  Convex for persistence; interval scheduler / Convex cron for the scan loop.
- **DB:** Convex (reactive document store).
- **Auth:** Argon2id password hashing, JWT access (15 min) + rotating refresh
  token (httpOnly / encrypted store), per-route guards.
- **Payments:** Stripe Checkout + Billing, webhook-driven subscription state.
- **Market data:** `MarketDataProvider` interface; **Finnhub** default impl.
- **Broker:** `BrokerProvider` interface; Alpaca (paper+live) first target.

---

## 3. Folder structure

```
autotrade/
├─ package.json                # pnpm workspace root
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ docs/ARCHITECTURE.md        # this file
├─ packages/
│  └─ shared/                  # types shared by desktop + backend
│     └─ src/{enums,dto,index}.ts
└─ apps/
   ├─ backend/
   │  ├─ convex/schema.ts
   │  └─ src/
   │     ├─ index.ts           # server bootstrap
   │     ├─ config/env.ts      # validated env (no hardcoded secrets)
   │     ├─ lib/{logger,errors,crypto}.ts
   │     ├─ middleware/{auth,subscription,role,rateLimit}.ts
   │     ├─ modules/
   │     │  ├─ auth/           # register, login, refresh, logout
   │     │  ├─ subscription/   # Stripe checkout + webhook + status
   │     │  ├─ admin/          # user mgmt, logs, settings (role-gated)
   │     │  ├─ watchlist/      # user-selected symbols (no limit)
   │     │  ├─ settings/       # risk + bot controls
   │     │  ├─ trades/         # history + performance
   │     │  └─ bot/            # start/stop, status, signals feed
   │     ├─ services/
   │     │  ├─ marketdata/     # provider iface + finnhub impl
   │     │  ├─ analysis/       # indicators + multi-timeframe
   │     │  ├─ decision/       # signal generation + reasons
   │     │  ├─ risk/           # sizing, stops, guards
   │     │  ├─ execution/      # paper engine + broker iface
   │     │  └─ learning/       # per-user strategy stats
   │     └─ workers/scanLoop.ts
   └─ desktop/
      ├─ electron/{main,preload}.ts
      └─ src/                  # React app (pages, components, api client)
```

---

## 4. Database schema (summary; canonical form in `web/convex/schema.ts`)

- **User** — `id, email, passwordHash, role(USER|ADMIN|DEVELOPER), status(ACTIVE|DISABLED), createdAt`
- **Subscription** — `userId, stripeCustomerId, stripeSubscriptionId, tier, status(ACTIVE|PAST_DUE|CANCELED|NONE), currentPeriodEnd`
- **Session / RefreshToken** — `userId, tokenHash, expiresAt, revokedAt`
- **Watchlist / WatchedSymbol** — `userId, symbol, exchange, addedAt` (unbounded)
- **BotSettings** — risk level, max active trades, max trade size, stop/target
  defaults, max daily loss, allowed hours, min confidence, mode, timeframes, strategies
- **Signal** — every decision: `ticker, price, timeframe, strategy, action,
  confidence, riskLevel, entryReason, stopLoss, takeProfit, rrRatio, explanation`
- **Trade** — `userId, symbol, exchange, side, mode(PAPER|LIVE), entryPrice,
  exitPrice, qty, pnl, result(WIN|LOSS|BE|OPEN), strategy, confidence, stopLoss,
  takeProfit, entryReason, exitReason, mistakeTags[], entrySnapshot, exitSnapshot,
  reasoningCorrect, openedAt, closedAt`
- **StrategyStat** — per `(userId, strategy, symbol?)`: trades, wins, losses,
  expectancy, weightedConfidence — the learning store
- **PaperAccount** — `userId, balance, equity` (clearly labeled paper)
- **AuditLog** — `actorId, action, target, meta, ip, createdAt`
- **AppVersion / ProviderSetting** — admin-managed config

---

## 5. Authentication flow

```
Register → Zod-validate → argon2id hash → create User(role=USER, status=ACTIVE)
Login    → verify hash → issue accessJWT(15m) + refreshToken(rotating, hashed in DB)
           desktop stores refresh in OS-encrypted safeStorage; access in memory only
Request  → authGuard verifies accessJWT → loads user → attaches to request
Refresh  → validate+rotate refresh token (reuse detection → revoke family)
Logout   → revoke refresh token
```
Passwords never stored or logged. Tokens stored only as hashes server-side.

---

## 6. Subscription verification flow

```
No free tier. One paid tier ("Autotrade Pro").
Checkout: backend creates Stripe Checkout Session → user pays → redirected back.
Webhook: Stripe → backend → upsert Subscription(status, currentPeriodEnd).
Gate:    subscriptionGuard runs on EVERY protected feature route:
         user.role ∈ {ADMIN,DEVELOPER}  → allow (bypass payment)
         OR subscription.status == ACTIVE && currentPeriodEnd > now → allow
         else → 402 Payment Required (desktop shows paywall)
```
The desktop **also** checks status on launch, but the backend is authoritative —
a tampered client still can't call gated routes.

---

## 7. Developer/admin access flow

- Roles: `USER`, `ADMIN`, `DEVELOPER`. Roles are set in the DB, never self-assigned.
- `roleGuard(['ADMIN','DEVELOPER'])` protects `/admin/*`.
- Admins/devs **bypass the subscription gate** (req #3) via the role check in
  `subscriptionGuard`.
- Admin capabilities: list/search users, view subscription status, enable/disable
  accounts, view bot activity + trade logs + system errors, manage app versions,
  manage provider/API settings, view performance & security events.
- Every admin action writes an `AuditLog` row. Admin routes never reachable by `USER`.

---

## 8. Market data flow

```
MarketDataProvider (interface):
  searchSymbols(query)               → [{symbol, name, exchange, mic}]
  getQuote(symbol)                   → {price, ts}
  getCandles(symbol, tf, from, to)   → [{t,o,h,l,c,v}]

Default impl: FinnhubProvider (global coverage, real data, legal API).
Swap via ProviderSetting (admin). No TradingView scraping, ever.
ScanLoop: for each user's watched symbol → fetch candles per chosen timeframe →
AnalysisEngine → DecisionEngine → (Risk) → Paper/Live exec → Ledger + Signal feed.
Rate limits respected via per-provider limiter + caching of candles.
```

---

## 9. Paper trading flow (real market data)

```
Real candles/quotes from the provider — NEVER random prices.
Open:  DecisionEngine BUY + Risk approves → PaperEngine fills at current real bid/ask
       (or next candle open in delayed mode) → create Trade(mode=PAPER, OPEN) →
       deduct from PaperAccount.balance.
Monitor: position monitor checks live price each tick vs stop/target.
Close: stop/target/exit-signal hit → fill at real price → set exitPrice, pnl,
       result, exitReason, mistakeTags, exitSnapshot → credit PaperAccount.
Every paper trade is flagged mode=PAPER and labeled in the UI.
```

---

## 10. Future live trading flow

```
BrokerProvider (interface): submitOrder, cancelOrder, getPositions, getAccount.
First target: Alpaca (paper+live endpoints). IBKR / TradingView-webhook later.
Live only enabled when: mode=LIVE AND broker creds present AND risk guards pass.
Same DecisionEngine + RiskManager; only the execution adapter changes.
A kill-switch (mode=DISABLED) halts all order routing instantly.
```

---

## 11. AI decision engine design

- **Inputs:** multi-timeframe indicator set (1m/5m/15m/1h/1d) from AnalysisEngine:
  trend (EMA/SMA stacks), RSI, MACD, support/resistance, breakout/pullback detection,
  volume profile, momentum, ATR volatility, candlestick patterns.
- **Method:** weighted confluence scoring per registered strategy
  (e.g. `TrendBreakout`, `PullbackContinuation`, `MeanReversion`). Each strategy
  emits a partial score + the specific reasons that fired.
- **Output (per req #9):** `{ticker, price, timeframe, strategy, action
  (BUY|SELL|HOLD|AVOID|CLOSE), confidence 0–100, riskLevel, entryReason,
  stopLoss, takeProfit, rrRatio, explanation}`.
- **Explanation layer is pluggable:** deterministic templated explanation now;
  an LLM adapter can enrich wording later without changing the decision logic.
- Confidence is multiplied by the user's learned weight for that strategy (§12).

---

## 12. Personalized learning system design

- Per user, we maintain `StrategyStat(userId, strategy, symbol?)`:
  trades, wins, losses, sum/avg P/L, expectancy, and a **weightedConfidence**
  multiplier (starts 1.0).
- After each closed trade, `LearningService.update()` recomputes stats and nudges
  the multiplier toward strategies/symbols with positive realized expectancy and
  away from chronic losers (bounded, e.g. 0.5–1.5, with smoothing to avoid
  overfitting to a few trades).
- DecisionEngine multiplies raw confidence by this weight, so each user's bot
  gradually favors what actually works on *their* symbols — without changing
  the shared, auditable strategy logic. Mistake tags feed the same loop.

---

## 13. Risk management design

- Hard caps from `BotSettings`: max active trades, max trade size, max daily loss
  (cuts trading for the day when breached), allowed trading hours, min confidence.
- Per-trade: ATR-based stop, R-multiple target, position size = `risk% * equity / stopDistance`.
- RiskManager can **veto** any signal regardless of confidence. Kill-switch via
  `mode=DISABLED`. Risk runs before every execution, paper or live.

---

## 14. Trade history design

- `Trade` row is immutable once `CLOSED` (append-only ledger philosophy).
- History tab shows every field in req #13: date/time, ticker, market/exchange,
  side, mode, entry/exit, P/L, win/loss, strategy, confidence, stop/target,
  entry & exit reasons, mistake tags, AI notes.
- Performance views (req #12) are computed from the ledger: win%, total/daily/
  weekly/monthly P/L, best/worst, avg win/loss, max drawdown, per-strategy and
  per-symbol breakdowns.

---

## 15. Security plan

- Argon2id hashing; passwords never stored/logged in plaintext.
- JWT access (short-lived) + rotating, hashed refresh tokens with reuse detection.
- All feature routes behind `authGuard` → `subscriptionGuard`; admin behind `roleGuard`.
- **Subscription & role checks are server-side**, never trusted from the client.
- Zod validation on every input; Fastify rate limiting; Helmet-style headers; CORS allowlist.
- Secrets only via env (`config/env.ts` validates presence at boot; nothing hardcoded).
- Desktop stores only the refresh token, in OS-encrypted `safeStorage`.
- Market-data and Stripe keys live exclusively on the backend.
- Audit log for every admin/sensitive action. Generic auth errors (no user enumeration).
```
```
