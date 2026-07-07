import { getSupabaseServer } from '@/lib/supabase-server';
import { getCachedQuotes } from '@/lib/quote-cache';
import { getBotStatus } from './botSettings';
import { brokerStatus, getSnapshot } from './broker';
import { mapTrade, type TradeRecord, type TradeRow } from './row-mappers';
import {
  performanceBreakdownsFromTrades,
  performanceSummaryFromTrades,
} from './trades';
import { listWatchlist } from './watchlist';

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

function sliceTrades(
  trades: TradeRecord[],
  opts: { tradesLimit: number; openLimit: number; closedLimit: number },
) {
  const openTrades = trades.filter((t) => t.result === 'OPEN').slice(0, opts.openLimit);
  const closedTrades = trades
    .filter((t) => t.result !== 'OPEN')
    .sort((a, b) => (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt))
    .slice(0, opts.closedLimit);
  const recentTrades = trades.slice(0, opts.tradesLimit);
  return { trades: recentTrades, openTrades, closedTrades };
}

export async function getDashboardFeed(
  clerkId: string,
  opts: { signalsLimit?: number; tradesLimit?: number; openLimit?: number; closedLimit?: number } = {},
) {
  const signalsLimit = opts.signalsLimit ?? 12;
  const tradesLimit = opts.tradesLimit ?? 200;
  const openLimit = opts.openLimit ?? 100;
  const closedLimit = opts.closedLimit ?? 200;

  const [botStatus, watchlist, brokerStatusData, brokerSnapshot, signalsRes, tradesRes] =
    await Promise.all([
      getBotStatus(clerkId),
      listWatchlist(clerkId),
      brokerStatus(clerkId),
      getSnapshot(clerkId),
      getSupabaseServer()
        .from('signals')
        .select('id, ticker, action, strategy, confidence, entry_reason, created_at')
        .eq('clerk_id', clerkId)
        .order('created_at', { ascending: false })
        .limit(signalsLimit),
      getSupabaseServer()
        .from('trades')
        .select('*')
        .eq('clerk_id', clerkId)
        .order('opened_at', { ascending: false }),
    ]);

  if (signalsRes.error) throw new Error(`signals feed failed: ${signalsRes.error.message}`);
  if (tradesRes.error) throw new Error(`trades feed failed: ${tradesRes.error.message}`);

  const allTrades = ((tradesRes.data ?? []) as TradeRow[]).map(mapTrade);
  const { trades, openTrades, closedTrades } = sliceTrades(allTrades, {
    tradesLimit,
    openLimit,
    closedLimit,
  });

  const quoteSymbols = [
    ...new Set([
      ...watchlist.map((w) => w.symbol.toUpperCase()),
      ...openTrades.map((t) => t.symbol.toUpperCase()),
      ...(brokerSnapshot?.positions ?? []).map((p) => p.symbol.toUpperCase()),
    ]),
  ];

  const [quotes, performanceSummary, performanceBreakdowns] = await Promise.all([
    getCachedQuotes(clerkId, quoteSymbols),
    Promise.resolve(performanceSummaryFromTrades(allTrades)),
    Promise.resolve(performanceBreakdownsFromTrades(allTrades)),
  ]);

  const signals = (signalsRes.data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    ticker: row.ticker as string,
    action: row.action as string,
    strategy: row.strategy as string,
    confidence: row.confidence as number,
    entryReason: row.entry_reason as string,
    createdAt: signalCreatedAtMs(row.created_at),
  }));

  return {
    botStatus,
    performance: {
      summary: performanceSummary,
      breakdowns: performanceBreakdowns,
    },
    signals,
    watchlist,
    trades,
    openTrades,
    closedTrades,
    brokerStatus: brokerStatusData,
    brokerSnapshot,
    quotes,
  };
}
