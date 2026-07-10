import { PAPER_STARTING_BALANCE } from '@autotrade/shared';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getCachedQuotes } from '@/lib/quote-cache';
import { buildSimulatorEquityCurve } from '@/lib/dashboard-charts';
import { getBotStatus } from './botSettings';
import { brokerStatus, getSnapshot } from './broker';
import { mapTrade, type TradeRecord, type TradeRow } from './row-mappers';
import {
  performanceBreakdownsFromTrades,
  performanceSummaryFromTrades,
} from './trades';
import { listWatchlist } from './watchlist';

/** Cap rows used for dashboard performance math to bound Active CPU. */
const PERF_TRADE_CAP = 2000;

function signalCreatedAtMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 1e11) return asNum;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

type PerfTradeRow = {
  symbol: string;
  strategy: string;
  result: TradeRecord['result'];
  pnl: number | null;
  closed_at: number | null;
  opened_at: number;
};

function mapPerfTrade(row: PerfTradeRow) {
  return {
    symbol: row.symbol,
    strategy: row.strategy,
    result: row.result,
    pnl: row.pnl ?? undefined,
    closedAt: typeof row.closed_at === 'number' ? row.closed_at : undefined,
    openedAt: row.opened_at,
  };
}

async function ensurePaperAccount(clerkId: string): Promise<{ balance: number; equity: number }> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('paper_accounts')
    .select('balance, equity')
    .eq('clerk_id', clerkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    return { balance: data.balance as number, equity: data.equity as number };
  }

  const { error: insertError } = await sb.from('paper_accounts').insert({
    clerk_id: clerkId,
    balance: PAPER_STARTING_BALANCE,
    equity: PAPER_STARTING_BALANCE,
  });
  if (insertError) {
    // Concurrent bootstrap/dashboard can race on unique clerk_id.
    if (insertError.code === '23505') {
      const { data: again, error: againError } = await sb
        .from('paper_accounts')
        .select('balance, equity')
        .eq('clerk_id', clerkId)
        .maybeSingle();
      if (againError) throw new Error(againError.message);
      if (again) {
        return { balance: again.balance as number, equity: again.equity as number };
      }
    }
    throw new Error(insertError.message);
  }
  return { balance: PAPER_STARTING_BALANCE, equity: PAPER_STARTING_BALANCE };
}

export async function getDashboardFeed(
  clerkId: string,
  opts: { signalsLimit?: number; tradesLimit?: number; openLimit?: number; closedLimit?: number } = {},
) {
  const signalsLimit = opts.signalsLimit ?? 12;
  const tradesLimit = opts.tradesLimit ?? 200;
  const openLimit = opts.openLimit ?? 100;
  const closedLimit = opts.closedLimit ?? 200;
  const sb = getSupabaseServer();

  const [
    botStatus,
    watchlist,
    brokerStatusData,
    brokerSnapshot,
    signalsRes,
    openRes,
    closedRes,
    recentRes,
    perfRes,
    paperAccount,
  ] = await Promise.all([
    getBotStatus(clerkId),
    listWatchlist(clerkId),
    brokerStatus(clerkId),
    getSnapshot(clerkId),
    sb
      .from('signals')
      .select('id, ticker, action, strategy, confidence, entry_reason, created_at')
      .eq('clerk_id', clerkId)
      .order('created_at', { ascending: false })
      .limit(signalsLimit),
    sb
      .from('trades')
      .select('*')
      .eq('clerk_id', clerkId)
      .eq('result', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(openLimit),
    sb
      .from('trades')
      .select('*')
      .eq('clerk_id', clerkId)
      .neq('result', 'OPEN')
      .order('closed_at', { ascending: false })
      .limit(closedLimit),
    sb
      .from('trades')
      .select('*')
      .eq('clerk_id', clerkId)
      .order('opened_at', { ascending: false })
      .limit(tradesLimit),
    sb
      .from('trades')
      .select('symbol, strategy, result, pnl, closed_at, opened_at')
      .eq('clerk_id', clerkId)
      .order('opened_at', { ascending: false })
      .limit(PERF_TRADE_CAP),
    ensurePaperAccount(clerkId),
  ]);

  if (signalsRes.error) throw new Error(`signals feed failed: ${signalsRes.error.message}`);
  if (openRes.error) throw new Error(`open trades feed failed: ${openRes.error.message}`);
  if (closedRes.error) throw new Error(`closed trades feed failed: ${closedRes.error.message}`);
  if (recentRes.error) throw new Error(`trades feed failed: ${recentRes.error.message}`);
  if (perfRes.error) throw new Error(`performance feed failed: ${perfRes.error.message}`);

  const openTrades = ((openRes.data ?? []) as TradeRow[]).map(mapTrade);
  const closedTrades = ((closedRes.data ?? []) as TradeRow[]).map(mapTrade);
  const trades = ((recentRes.data ?? []) as TradeRow[]).map(mapTrade);
  const perfTrades = ((perfRes.data ?? []) as PerfTradeRow[]).map(mapPerfTrade);

  const quoteSymbols = [
    ...new Set([
      ...watchlist.map((w) => w.symbol.toUpperCase()),
      ...openTrades.map((t) => t.symbol.toUpperCase()),
      ...(brokerSnapshot?.positions ?? []).map((p) => p.symbol.toUpperCase()),
    ]),
  ];

  const [quotes, performanceSummary, performanceBreakdowns] = await Promise.all([
    getCachedQuotes(clerkId, quoteSymbols),
    Promise.resolve(performanceSummaryFromTrades(perfTrades)),
    Promise.resolve(performanceBreakdownsFromTrades(perfTrades)),
  ]);

  // Prefer live open-count from status over the capped performance sample.
  performanceSummary.openTrades = botStatus.openTrades ?? openTrades.length;

  const signals = (signalsRes.data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    ticker: row.ticker as string,
    action: row.action as string,
    strategy: row.strategy as string,
    confidence: row.confidence as number,
    entryReason: row.entry_reason as string,
    createdAt: signalCreatedAtMs(row.created_at),
  }));

  const equity = brokerSnapshot?.equity ?? botStatus.paperAccount?.equity ?? paperAccount.equity;
  const equityCurve = buildSimulatorEquityCurve(
    equity,
    perfTrades
      .filter((t) => t.result !== 'OPEN' && t.pnl != null && t.closedAt != null)
      .map((t) => ({ closedAt: t.closedAt, pnl: t.pnl })),
    '1M',
  );

  return {
    botStatus: {
      ...botStatus,
      paperAccount: botStatus.paperAccount ?? paperAccount,
    },
    performance: {
      summary: performanceSummary,
      breakdowns: {
        byStrategy: [...performanceBreakdowns.byStrategy].sort(
          (a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl),
        ),
        bySymbol: [...performanceBreakdowns.bySymbol].sort(
          (a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl),
        ),
      },
    },
    signals,
    watchlist,
    trades,
    openTrades,
    closedTrades,
    brokerStatus: brokerStatusData,
    brokerSnapshot,
    quotes,
    equityCurve,
  };
}
