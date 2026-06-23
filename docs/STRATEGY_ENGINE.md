# Strategy Engine

A modular, additive decision layer in `engine/src/services/strategy-engine`.
It gives the bot multiple **comparable** strategy options, a **market-regime
filter**, layered **risk controls**, and a **plain-English explanation** for every
decision — traded or not.

> It does **not** guarantee profit. It is designed to **reject bad trades often**
> and to make every decision auditable and paper-testable.

## What it does NOT change

The original engines are **preserved unchanged**:

- `services/decision/strategies.ts` (the 4 original strategies) — untouched
- `services/decision/index.ts` (`decide()`) — untouched
- `services/risk/index.ts` (`evaluateRisk()`) — untouched

They are **wrapped** as `source: 'legacy'` options so the bot can still pick them:

| Original | Exposed as | internalName |
|---|---|---|
| `TrendBreakout` | `LegacyTrendStrategy` | `legacy_trend_breakout` |
| `PullbackContinuation` | `LegacyPullbackStrategy` | `legacy_pullback_continuation` |
| `MeanReversion` | `LegacyMeanReversionStrategy` | `legacy_mean_reversion` |
| `CryptoMomentum` | `LegacyMomentumStrategy` | `legacy_crypto_momentum` |
| the whole `decide()` engine | `LegacyDecisionStrategy` | `legacy_decision_engine` |
| `evaluateRisk()` | `LegacyRiskManager` | (risk) |

## Architecture

```
runStrategyEngine(input)            index.ts        — one-call entry point
  ├─ detectRegime(...)              regime.ts       — identify regime FIRST
  ├─ resolveConfig(config)          config.ts       — mode presets + overrides
  ├─ strategiesForConfig(...)       registry.ts     — which strategies are active
  └─ selectStrategy(ctx, opts)      selector.ts     — score, agree, conflict, pick
        ├─ strategy.evaluate(ctx)   strategies/*.ts — one file per strategy
        └─ assessRisk(...)          risk.ts         — new gates + LEGACY sizing
  → StrategyDecision + DecisionLog  logging.ts      — auditable record
```

Everything is **pure** (no DB, network, or money) so it unit-tests and backtests
cleanly, and the **same** selector path is used for live, paper, and backtest.

## Decision flow (pseudocode)

```
detect regime (liquidity & risk-off first, then trend/volatility/breakout)

run OVERLAY strategies (e.g. Market-Regime Risk-On/Off)
  if any overlay vetoes → NO_TRADE (blocked, with reasons)

for each entry strategy suited to the regime:
    ev = strategy.evaluate(context)
    skip if not applicable / has a do-not-trade flag / no side
    score = ev.score  (minus an off-regime penalty if firing outside its bestRegimes)
    add to candidates

if a strong LONG and a strong SHORT both exist → NO_TRADE (conflict)
if no candidates → HOLD

best = highest-scoring candidate
confidence = best.score + agreementBonus(other strategies on the same side)

stop/target = strategy hint, else ATR-based fallback
risk = assessRisk(...)   # confidence floor, R:R, liquidity, spread, volatility,
                         # then LEGACY evaluateRisk() for hours/caps/sizing
if risk fails → NO_TRADE (blocked, with reasons)

→ BUY (long) | SHORT (short), with riskPlan + reasoning + rejected list
```

## Market regimes (detected first)

`STRONG_UPTREND`, `STRONG_DOWNTREND`, `RANGING`, `HIGH_VOLATILITY`,
`LOW_VOLATILITY`, `NEWS_EVENT`, `BREAKOUT_SETUP`, `LOW_LIQUIDITY`, `RISK_OFF`,
`CONFLICTING`. Liquidity and market-wide risk-off are checked first because the
cheapest way to avoid a bad trade is to recognise an untradeable tape early.

## The 10 new strategies

| # | Strategy | internalName | source | best regimes |
|---|---|---|---|---|
| 1 | Trend-Following | `trend_following_v2` | new | strong up/down trend |
| 2 | Momentum | `momentum_v2` | new | trend / high-vol / breakout |
| 3 | Mean-Reversion | `mean_reversion_v2` | new | ranging / low-vol |
| 4 | Breakout | `breakout_v1` | new | breakout setup / trend |
| 5 | Pullback-in-Trend | `pullback_in_trend_v1` | new | strong trend |
| 6 | News/Event-Driven | `news_event_v1` | experimental | news event |
| 7 | Sentiment-Based | `sentiment_v1` | experimental | news / trend |
| 8 | Stat-Arb / Pairs | `stat_arb_pairs_v1` | experimental | ranging / low-vol |
| 9 | VWAP Intraday | `vwap_intraday_v1` | experimental | intraday |
| 10 | Market-Regime Overlay | `market_regime_overlay_v1` | new (overlay) | all — master filter |

**Experimental** strategies need data the core engine doesn't yet provide (news,
sentiment, pairs, intraday VWAP/microstructure). They **abstain safely** when
that data is absent — they never fabricate a signal — and are excluded from
selection unless `includeExperimental: true`.

## Scoring

- Each strategy returns a raw `score` 0–100 with the specific reasons that fired.
- Firing **outside** its `bestRegimes` costs an `offRegimePenalty` (default 15).
- Each additional strategy agreeing on the **same side** adds an agreement bonus
  (default +5 each, capped +15).
- Final `confidence` = best adjusted score + agreement bonus, capped at 100.

## Risk controls (every entry passes these)

New gates (in `risk.ts`) run first, then the **original** `evaluateRisk()` does
trading-hours, max-active-trades, daily-loss, and final **position sizing**:

- confidence ≥ minConfidence
- stop **and** target required, on the correct side of entry
- reward:risk ≥ `minRR`
- spread ≤ `maxSpreadPct`, relative volume ≥ `minRelativeVolume` (when provided)
- extreme volatility blocked unless `highRiskMode`
- max risk per trade, max daily loss, max open trades, trading hours (legacy)

## Modes

`conservative`, `balanced`, `aggressive` (risk-appetite presets),
`paper_only` (forces paper execution), `strategy_specific` (pin one strategy via
`manualStrategy`), `auto` (bot chooses — balanced defaults). See
[`strategy-engine.config.example.json`](../engine/src/services/strategy-engine/strategy-engine.config.example.json).

## Logging

`buildDecisionLog()` produces a `DecisionLog` for **every** decision (traded or
not): timestamp, market snapshot, regime, chosen strategy + source, confidence,
reasoning, stop/target, R:R, size, rejected strategies, and an `outcome` slot to
fill in when the trade closes. Persist these to your `signals` / `auditLogs`
tables. `formatDecisionLogLine()` gives a one-line human summary.

## Backtesting

Because strategies are pure, `runBacktest(steps)` replays pre-built contexts
through the **same** selector and resolves each entry against the bars that
follow (stop/target/last-close). It returns per-trade results + a summary
(win rate, total PnL, no-trade count). The skeleton in `backtest.ts` is the seed
for a fuller portfolio-aware backtester.

## Adding a new strategy (the whole checklist)

1. Create `strategies/myStrategy.ts` exporting a `Strategy` object (copy any of
   the new ones as a template — fill in `internalName`, `displayName`,
   `description`, `source`, `bestRegimes`, `requiredInputs`, `indicators`,
   `supports`, and `evaluate()`).
2. Add it to `NEW_STRATEGIES` in `registry.ts`.
3. That's it — selector, config, logging, and backtester pick it up automatically.

## How to wire it into the live bot (optional, non-breaking)

The engine is exported but **not yet** swapped into the live `scanLoop` — the
original `decide()` path still runs so nothing changes until you choose to switch.
To trial it, in `evaluateSymbolEntry()` call `runStrategyEngine(...)` with the
analysis already fetched there, persist the `log`, and route `decision.riskPlan`
to the existing execution engine. Run it in **paper mode** first.
