import { BadRequestError, NotFoundError } from '@autotrade/engine/public';
import { getSupabaseServer } from '@/lib/supabase-server';
import { isLiveEntitled } from '@/lib/entitlements';
import { mapTrade, type TradeRow, type TradeRecord } from './row-mappers';
import { getSubscriptionByClerkId } from './subscriptions';
import { me } from './users';

export async function listTrades(
  clerkId: string,
  opts: {
    result?: 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
    mode?: 'DISABLED' | 'PAPER' | 'LIVE';
    symbol?: string;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<{ items: TradeRecord[]; nextCursor: string | null }> {
  const { result, mode, symbol, limit = 100, cursor } = opts;
  const sb = getSupabaseServer();

  let query = sb
    .from('trades')
    .select('*')
    .eq('clerk_id', clerkId)
    .order('opened_at', { ascending: false })
    .limit(limit + 1);

  if (result) query = query.eq('result', result);
  if (mode) query = query.eq('mode', mode);
  if (symbol) query = query.eq('symbol', symbol.toUpperCase());

  if (cursor) {
    const { data: cursorRow, error: cursorError } = await sb
      .from('trades')
      .select('opened_at')
      .eq('id', cursor)
      .eq('clerk_id', clerkId)
      .maybeSingle();
    if (cursorError) throw new Error(cursorError.message);
    if (cursorRow?.opened_at != null) {
      query = query.lt('opened_at', cursorRow.opened_at);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as TradeRow[]).map(mapTrade);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { items: page, nextCursor: hasMore ? page[page.length - 1]?._id ?? null : null };
}

export async function getTrade(clerkId: string, id: string): Promise<TradeRecord | null> {
  const { data, error } = await getSupabaseServer()
    .from('trades')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data as TradeRow).clerk_id !== clerkId) return null;
  return mapTrade(data as TradeRow);
}

export async function closeTrade(
  clerkId: string,
  id: string,
  args: {
    exitPrice: number;
    exitReason?: string;
    mistakeTags?: string[];
    reasoningCorrect?: boolean;
    exitSnapshot?: unknown;
  },
): Promise<{ pnl: number; result: 'WIN' | 'LOSS' | 'BREAKEVEN' }> {
  const trade = await getTrade(clerkId, id);
  if (!trade) throw new NotFoundError('Trade not found');
  if (trade.result !== 'OPEN') throw new BadRequestError('Trade is already closed');

  const rawPnl =
    trade.side === 'LONG'
      ? (args.exitPrice - trade.entryPrice) * trade.qty
      : (trade.entryPrice - args.exitPrice) * trade.qty;
  const pnl = Math.round(rawPnl * 100) / 100;
  const result: 'WIN' | 'LOSS' | 'BREAKEVEN' = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';

  const { error } = await getSupabaseServer()
    .from('trades')
    .update({
      exit_price: args.exitPrice,
      pnl,
      result,
      exit_reason: args.exitReason,
      mistake_tags: args.mistakeTags ?? [],
      reasoning_correct: args.reasoningCorrect,
      exit_snapshot: args.exitSnapshot,
      closed_at: Date.now(),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  if (trade.mode === 'PAPER' && !trade.brokerOrderId) {
    const { data: account } = await getSupabaseServer()
      .from('paper_accounts')
      .select('id, balance, equity')
      .eq('clerk_id', clerkId)
      .maybeSingle();
    if (account) {
      await getSupabaseServer()
        .from('paper_accounts')
        .update({
          balance: (account.balance as number) + pnl,
          equity: (account.equity as number) + pnl,
        })
        .eq('id', account.id);
    }
  }

  return { pnl, result };
}

export async function countTradesOpenedSince(clerkId: string, sinceMs: number): Promise<number> {
  const { data, error } = await getSupabaseServer()
    .from('trades')
    .select('opened_at')
    .eq('clerk_id', clerkId)
    .gte('opened_at', sinceMs);
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function countPaperTrades(clerkId: string): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('clerk_id', clerkId)
    .eq('mode', 'PAPER');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getDigestTrades(
  clerkId: string,
  sinceMs: number,
): Promise<Array<{ symbol: string; pnl?: number; result: 'WIN' | 'LOSS' | 'BREAKEVEN' }>> {
  const { data, error } = await getSupabaseServer()
    .from('trades')
    .select('symbol, pnl, result, closed_at')
    .eq('clerk_id', clerkId)
    .neq('result', 'OPEN')
    .gte('closed_at', sinceMs);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((t) => t.closed_at != null)
    .map((t) => ({
      symbol: t.symbol as string,
      pnl: (t.pnl as number | null) ?? undefined,
      result: t.result as 'WIN' | 'LOSS' | 'BREAKEVEN',
    }));
}

export function performanceSummaryFromTrades(
  trades: Array<Pick<TradeRecord, 'result' | 'pnl' | 'closedAt'>>,
) {
  const closed = trades.filter((t) => t.result !== 'OPEN' && t.pnl !== undefined);
  const open = trades.filter((t) => t.result === 'OPEN');
  const wins = closed.filter((t) => t.result === 'WIN');
  const losses = closed.filter((t) => t.result === 'LOSS');
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const now = Date.now();
  const dayMs = 86_400_000;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const dailyPnl = closed.filter((t) => t.closedAt && now - t.closedAt < dayMs).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const weeklyPnl = closed.filter((t) => t.closedAt && now - t.closedAt < weekMs).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const monthlyPnl = closed.filter((t) => t.closedAt && now - t.closedAt < monthMs).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const pnlValues = closed.map((t) => t.pnl ?? 0);
  const winPnls = wins.map((t) => t.pnl ?? 0);
  const lossPnls = losses.map((t) => t.pnl ?? 0);
  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  for (const t of [...closed].sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0))) {
    cumulative += t.pnl ?? 0;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length > 0 ? wins.length / closed.length : 0,
    totalPnl: Math.round(totalPnl * 100) / 100,
    dailyPnl: Math.round(dailyPnl * 100) / 100,
    weeklyPnl: Math.round(weeklyPnl * 100) / 100,
    monthlyPnl: Math.round(monthlyPnl * 100) / 100,
    openTrades: open.length,
    bestTrade: pnlValues.length > 0 ? Math.max(...pnlValues) : null,
    worstTrade: pnlValues.length > 0 ? Math.min(...pnlValues) : null,
    avgWin: winPnls.length > 0 ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : null,
    avgLoss: lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : null,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
  };
}

export async function performanceSummary(clerkId: string) {
  const { data, error } = await getSupabaseServer()
    .from('trades')
    .select('result, pnl, closed_at')
    .eq('clerk_id', clerkId)
    .order('opened_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return performanceSummaryFromTrades(
    ((data ?? []) as Array<{ result: TradeRecord['result']; pnl: number | null; closed_at: number | null }>).map(
      (row) => ({
        result: row.result,
        pnl: row.pnl ?? undefined,
        closedAt: row.closed_at ?? undefined,
      }),
    ),
  );
}

export function performanceBreakdownsFromTrades(
  trades: Array<Pick<TradeRecord, 'result' | 'pnl' | 'strategy' | 'symbol'>>,
) {
  const closed = trades.filter((t) => t.result !== 'OPEN');
  const byStrategy: Record<string, { trades: number; wins: number; totalPnl: number }> = {};
  const bySymbol: Record<string, { trades: number; wins: number; totalPnl: number }> = {};
  for (const t of closed) {
    byStrategy[t.strategy] ??= { trades: 0, wins: 0, totalPnl: 0 };
    byStrategy[t.strategy].trades++;
    if (t.result === 'WIN') byStrategy[t.strategy].wins++;
    byStrategy[t.strategy].totalPnl += t.pnl ?? 0;
    bySymbol[t.symbol] ??= { trades: 0, wins: 0, totalPnl: 0 };
    bySymbol[t.symbol].trades++;
    if (t.result === 'WIN') bySymbol[t.symbol].wins++;
    bySymbol[t.symbol].totalPnl += t.pnl ?? 0;
  }
  const toArray = (map: typeof byStrategy) =>
    Object.entries(map).map(([key, v]) => ({
      key,
      ...v,
      winRate: v.trades > 0 ? v.wins / v.trades : 0,
      totalPnl: Math.round(v.totalPnl * 100) / 100,
    }));
  return { byStrategy: toArray(byStrategy), bySymbol: toArray(bySymbol) };
}

export async function performanceBreakdowns(clerkId: string) {
  const { data, error } = await getSupabaseServer()
    .from('trades')
    .select('symbol, strategy, result, pnl')
    .eq('clerk_id', clerkId)
    .order('opened_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return performanceBreakdownsFromTrades(
    ((data ?? []) as Array<{
      symbol: string;
      strategy: string;
      result: TradeRecord['result'];
      pnl: number | null;
    }>).map((row) => ({
      symbol: row.symbol,
      strategy: row.strategy,
      result: row.result,
      pnl: row.pnl ?? undefined,
    })),
  );
}

export async function assertLiveEntitled(clerkId: string, mode: string): Promise<void> {
  if (mode !== 'LIVE') return;
  const [user, sub] = await Promise.all([me(clerkId), getSubscriptionByClerkId(clerkId)]);
  if (!isLiveEntitled(user?.role ?? 'USER', sub, user?.email)) {
    throw new BadRequestError('Live trading requires an active subscription.');
  }
}


import { isOpenTradeWinning } from '@/lib/positions';
import { getSnapshot } from './broker';

type BrokerPositionSnap = { symbol: string; currentPrice?: number };

async function fetchInternalQuote(base: string, secret: string, clerkId: string, symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`${base}/api/internal/market/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ clerkId, symbol }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number };
    return data.price ?? null;
  } catch {
    return null;
  }
}

async function closeBrokerPosition(
  base: string,
  secret: string,
  clerkId: string,
  symbol: string,
  paper: boolean,
): Promise<number | null> {
  try {
    const res = await fetch(`${base}/api/internal/broker/close-position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ clerkId, symbol, paper }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { exitPrice?: number | null };
    return data.exitPrice ?? null;
  } catch {
    return null;
  }
}

function appBaseUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!appUrl) return null;
  return appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
}

async function resolveExitPrice(
  trade: TradeRecord,
  brokerPos: BrokerPositionSnap | undefined,
  clerkId: string,
): Promise<number | null> {
  if (brokerPos?.currentPrice != null) return brokerPos.currentPrice;
  const base = appBaseUrl();
  const secret = process.env.BOT_INTERNAL_SECRET ?? null;
  if (base && secret) {
    const quoted = await fetchInternalQuote(base, secret, clerkId, trade.symbol);
    if (quoted != null) return quoted;
  }
  return null;
}


export async function listClosedTrades(clerkId: string, limit = 200) {
  const closedResults = await Promise.all(
    (['WIN', 'LOSS', 'BREAKEVEN'] as const).map((result) =>
      listTrades(clerkId, { result, limit }),
    ),
  );
  const items = closedResults
    .flatMap((r) => r.items)
    .sort((a, b) => (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt))
    .slice(0, limit);
  return { items };
}

export async function closeAtMarket(clerkId: string, id: string) {
  const trade = await getTrade(clerkId, id);
  if (!trade) throw new NotFoundError('Trade not found');

  const snapshot = await getSnapshot(clerkId).catch(() => null);
  const base = appBaseUrl();
  const botSecret = process.env.BOT_INTERNAL_SECRET;
  const sym = trade.symbol.toUpperCase();
  const brokerPos = snapshot?.positions?.find((p) => p.symbol.toUpperCase() === sym);
  const hasBrokerPosition = brokerPos != null;

  let exitPrice: number | null = null;
  const brokerPaper = trade.mode !== 'LIVE';
  if ((trade.brokerOrderId || hasBrokerPosition) && base && botSecret) {
    exitPrice = await closeBrokerPosition(base, botSecret, clerkId, trade.symbol, brokerPaper);
  }
  if (exitPrice == null) {
    exitPrice = await resolveExitPrice(trade, brokerPos, clerkId);
  }
  if (exitPrice == null) throw new BadRequestError('Could not get a market price to close this trade');

  return closeTrade(clerkId, id, { exitPrice, exitReason: 'Manual close' });
}

export async function cashOutWinners(clerkId: string) {
  const openResult = await listTrades(clerkId, { result: 'OPEN', limit: 100 });
  const snapshot = await getSnapshot(clerkId).catch(() => null);
  const base = appBaseUrl();
  const secret = process.env.BOT_INTERNAL_SECRET ?? null;

  let closed = 0;
  let skipped = 0;
  const brokerClosedSymbols = new Set<string>();

  for (const trade of openResult.items) {
    try {
      const sym = trade.symbol.toUpperCase();
      const brokerPos = snapshot?.positions?.find((p) => p.symbol.toUpperCase() === sym);
      const hasBrokerPosition = brokerPos != null;
      const marketPrice = await resolveExitPrice(trade, brokerPos, clerkId);

      if (!isOpenTradeWinning(trade, brokerPos, marketPrice ?? undefined)) {
        skipped += 1;
        continue;
      }

      let exitPrice = marketPrice;
      const needsBrokerClose = (trade.brokerOrderId || hasBrokerPosition) && base && secret;
      if (needsBrokerClose) {
        if (!brokerClosedSymbols.has(sym)) {
          const fillPrice = await closeBrokerPosition(
            base,
            secret,
            clerkId,
            trade.symbol,
            trade.mode !== 'LIVE',
          );
          if (fillPrice == null && hasBrokerPosition) {
            skipped += 1;
            continue;
          }
          if (fillPrice != null) {
            exitPrice = fillPrice;
            brokerClosedSymbols.add(sym);
          }
        } else if (exitPrice == null) {
          skipped += 1;
          continue;
        }
      }

      if (exitPrice == null) {
        skipped += 1;
        continue;
      }

      await closeTrade(clerkId, trade._id, { exitPrice, exitReason: 'Cash out winners' });
      closed += 1;
    } catch {
      skipped += 1;
    }
  }

  return { closed, skipped };
}
