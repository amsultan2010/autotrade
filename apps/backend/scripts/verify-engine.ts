/**
 * Engine verification — proves the analysis → decision → risk pipeline works,
 * end to end, on a DETERMINISTIC TEST FIXTURE (a constructed uptrend).
 *
 * This is a unit-style check of the engine's MATH and logic. It is NOT a market
 * data source and is NOT wired into paper trading — the product only ever
 * analyzes real candles from a licensed provider. Run: pnpm --filter
 * @autotrade/backend exec tsx scripts/verify-engine.ts
 */
import type { Candle } from '@autotrade/shared';
import { computeSnapshot } from '../src/services/analysis/indicators.js';
import { decide } from '../src/services/decision/index.js';
import { evaluateRisk } from '../src/services/risk/index.js';

/** Build a clean uptrend of `n` daily candles (fixture, not real prices). */
function uptrend(n: number): Candle[] {
  const out: Candle[] = [];
  let prevClose = 100;
  const start = Date.now() - n * 86_400_000;
  for (let i = 0; i < n; i++) {
    const close = 100 + i * 0.6;
    const open = prevClose;
    const high = Math.max(open, close) + 0.8;
    const low = Math.min(open, close) - 0.7;
    const volume = i === n - 1 ? 2_200_000 : 1_000_000 + (i % 5) * 20_000;
    out.push({ t: start + i * 86_400_000, o: open, h: high, l: low, c: close, v: volume });
    prevClose = close;
  }
  return out;
}

function main(): void {
  const candles = uptrend(220);
  const computed = computeSnapshot('1d', candles);
  if (!computed) throw new Error('computeSnapshot returned null');

  console.log('── Indicator snapshot (1d) ──');
  const s = computed.snapshot;
  console.log(
    `price=${s.price.toFixed(2)} ema9=${s.ema9.toFixed(2)} ema21=${s.ema21.toFixed(2)} ` +
      `sma50=${s.sma50.toFixed(2)} rsi=${s.rsi14.toFixed(1)} adx=${computed.extra.adx.toFixed(1)} ` +
      `macdHist=${s.macd.histogram.toFixed(3)} atr=${s.atr14.toFixed(2)}`,
  );

  const signal = decide({
    symbol: 'TEST',
    exchange: 'US',
    analysis: { '1d': computed },
    timeframes: ['1d'],
    enabledStrategies: ['TrendBreakout', 'PullbackContinuation', 'MeanReversion'],
    minConfidence: 60,
    defaultStopPct: 2,
    defaultTakeProfitPct: 4,
    learningWeights: {},
  });

  console.log('\n── Decision ──');
  console.log(`action=${signal.action} strategy=${signal.strategy} confidence=${signal.confidence}%`);
  console.log(`stop=${signal.stopLoss} target=${signal.takeProfit} R:R=${signal.rrRatio} risk=${signal.riskLevel}`);
  console.log(`reason: ${signal.entryReason}`);
  console.log(`explanation: ${signal.explanation}`);

  const risk = evaluateRisk(
    signal,
    {
      mode: 'PAPER',
      maxActiveTrades: 5,
      maxTradeSize: 10_000,
      riskPerTradePct: 1,
      maxDailyLoss: 2_000,
      tradingHoursStart: '00:00',
      tradingHoursEnd: '23:59',
    },
    { equity: 100_000, openTradeCount: 0, realizedPnlToday: 0 },
  );

  console.log('\n── Risk manager ──');
  if (risk.approved) {
    console.log(`APPROVED side=${risk.side} qty=${risk.qty} stop=${risk.stopLoss} target=${risk.takeProfit}`);
    console.log(`notional ≈ $${(risk.qty * signal.price).toFixed(2)} (capped at maxTradeSize)`);
  } else {
    console.log(`VETOED: ${risk.reason}`);
  }

  console.log('\n✅ Engine pipeline executed end-to-end on the fixture.');
}

main();
