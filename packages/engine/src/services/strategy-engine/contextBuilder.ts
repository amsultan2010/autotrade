/**
 * Builds market / crypto / liquidity context for strategy-engine overlays.
 * Cached per market-data provider for the duration of a scan cycle (~60s).
 */
import type { MultiTimeframeAnalysis } from '../analysis/index';
import type { MarketDataProvider, ExtendedSymbolSnapshot } from '../marketdata/types';
import { isCryptoSymbol } from '../marketdata/alpaca.provider';
import { relVolume } from './helpers';
import type { CryptoContext, LiquidityContext, MarketContext } from './types';

/** Master-filter strategy ids that users can disable in bot settings. */
export const OVERLAY_STRATEGY_IDS = [
  'market_regime_overlay_v1',
  'crypto_btc_eth_leader',
  'crypto_liquidity_guard',
] as const;

export interface ScanOverlayContext {
  market?: MarketContext;
  crypto?: CryptoContext;
  liquidity?: LiquidityContext;
}

interface BaseScanContext {
  market?: MarketContext;
  cryptoLeaders?: CryptoContext;
  snapshots: Record<string, ExtendedSymbolSnapshot>;
}

const CACHE_TTL_MS = 55_000;
const baseCache = new WeakMap<MarketDataProvider, { ts: number; data: BaseScanContext }>();

function trendFromChangePct(changePct: number | null | undefined): 'UP' | 'DOWN' | 'FLAT' {
  if (changePct == null) return 'FLAT';
  if (changePct > 0.25) return 'UP';
  if (changePct < -0.25) return 'DOWN';
  return 'FLAT';
}

async function fetchSnapshots(
  md: MarketDataProvider,
  symbols: string[],
): Promise<Record<string, ExtendedSymbolSnapshot>> {
  if (symbols.length === 0) return {};
  if (md.getExtendedSnapshots) {
    return md.getExtendedSnapshots(symbols);
  }
  if (!md.getSnapshots) return {};
  const basic = await md.getSnapshots(symbols);
  const out: Record<string, ExtendedSymbolSnapshot> = {};
  for (const [sym, snap] of Object.entries(basic)) {
    out[sym] = { ...snap };
  }
  return out;
}

function buildMarketContext(snapshots: Record<string, ExtendedSymbolSnapshot>): MarketContext | undefined {
  const spy = snapshots.SPY;
  const qqq = snapshots.QQQ;
  const vixProxy = snapshots.VIXY ?? snapshots.VIX;
  if (!spy && !qqq) return undefined;

  const spyTrend = trendFromChangePct(spy?.changePct);
  const qqqTrend = trendFromChangePct(qqq?.changePct);

  let breadthPct: number | undefined;
  if (spy?.changePct != null && qqq?.changePct != null) {
    const avg = (spy.changePct + qqq.changePct) / 2;
    breadthPct = Math.max(0, Math.min(100, 50 + avg * 8));
  }

  const vix = vixProxy?.changePct != null ? Math.min(30, 16 + Math.abs(vixProxy.changePct) * 2) : undefined;
  const riskOff =
    spyTrend === 'DOWN' &&
    qqqTrend === 'DOWN' &&
    ((vix != null && vix >= 32) || (breadthPct != null && breadthPct < 22));

  return {
    spyTrend,
    qqqTrend,
    vix,
    vixChangePct: vixProxy?.changePct ?? undefined,
    breadthPct,
    riskOff,
  };
}

function buildCryptoLeaders(snapshots: Record<string, ExtendedSymbolSnapshot>): CryptoContext | undefined {
  const btc = snapshots['BTC/USD'];
  const eth = snapshots['ETH/USD'];
  if (!btc && !eth) return undefined;

  const btcTrend = trendFromChangePct(btc?.changePct);
  const ethTrend = trendFromChangePct(eth?.changePct);

  let ethBtcRatioTrend: 'UP' | 'DOWN' | 'FLAT' | undefined;
  if (btc?.changePct != null && eth?.changePct != null) {
    ethBtcRatioTrend = trendFromChangePct(eth.changePct - btc.changePct);
  }

  let btcDominanceTrend: 'UP' | 'DOWN' | 'FLAT' | undefined;
  if (btc?.changePct != null && eth?.changePct != null) {
    btcDominanceTrend = trendFromChangePct(btc.changePct - eth.changePct);
  }

  return {
    btcTrend,
    ethTrend,
    ethBtcRatioTrend,
    btcDominanceTrend,
    totalMarketCapTrend: btcTrend,
  };
}

async function loadBaseContext(md: MarketDataProvider): Promise<BaseScanContext> {
  const hit = baseCache.get(md);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const symbols = ['SPY', 'QQQ', 'VIXY', 'BTC/USD', 'ETH/USD'];
  const snapshots = await fetchSnapshots(md, symbols);
  const data: BaseScanContext = {
    snapshots,
    market: buildMarketContext(snapshots),
    cryptoLeaders: buildCryptoLeaders(snapshots),
  };
  baseCache.set(md, { ts: Date.now(), data });
  return data;
}

function buildLiquidityFromAnalysis(analysis: MultiTimeframeAnalysis): LiquidityContext {
  const entry = analysis['15m'] ?? analysis['5m'] ?? analysis['1h'] ?? analysis['1d'];
  if (!entry) return {};
  const snap = entry.snapshot;
  const relVol = relVolume(entry);
  const avgDollarVolume =
    snap.avgVolume > 0 && snap.price > 0 ? snap.avgVolume * snap.price : undefined;
  return {
    relativeVolume: relVol,
    avgDollarVolume,
  };
}

function buildCryptoContextForSymbol(
  base: BaseScanContext,
  symbol: string,
): CryptoContext | undefined {
  const leaders = base.cryptoLeaders;
  const symSnap = base.snapshots[symbol];
  if (!leaders && !symSnap) return undefined;

  const crypto: CryptoContext = { ...leaders };

  if (symSnap) {
    const orderBook = {
      spreadPct: symSnap.spreadPct,
      depthUsdNearTouch: symSnap.depthUsdNearTouch,
      slippageEstPct: symSnap.slippageEstPct,
      volume24hUsd: symSnap.volume24hUsd,
      relativeVolume: symSnap.relativeVolume,
    };
    if (Object.values(orderBook).some((v) => v != null)) {
      crypto.orderBook = orderBook;
    }

    const btcChange = base.snapshots['BTC/USD']?.changePct;
    if (btcChange != null && symSnap.changePct != null) {
      crypto.strengthVsBtc = Math.max(-1, Math.min(1, (symSnap.changePct - btcChange) / 5));
    }
  }

  return crypto;
}

/** Load overlay context for one symbol within a scan cycle. */
export async function loadScanOverlayContext(
  md: MarketDataProvider,
  symbol: string,
  analysis: MultiTimeframeAnalysis,
): Promise<ScanOverlayContext> {
  const base = await loadBaseContext(md);
  const cryptoSymbol = isCryptoSymbol(symbol);

  let snapshots = base.snapshots;
  if (cryptoSymbol && !snapshots[symbol]) {
    const extra = await fetchSnapshots(md, [symbol]);
    snapshots = { ...snapshots, ...extra };
    base.snapshots = snapshots;
  }

  const liquidity = buildLiquidityFromAnalysis(analysis);
  if (cryptoSymbol) {
    const symSnap = snapshots[symbol];
    if (symSnap?.spreadPct != null) {
      liquidity.spreadPct = symSnap.spreadPct;
    }
  }

  return {
    market: base.market,
    crypto: cryptoSymbol ? buildCryptoContextForSymbol(base, symbol) : base.cryptoLeaders,
    liquidity,
  };
}
