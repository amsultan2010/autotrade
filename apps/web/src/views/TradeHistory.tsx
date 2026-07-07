'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '../components/Skeleton';
import { countOpenPositions, countWinningOpenTrades, type OpenTradeView } from '@/lib/positions';
import { formatUserError } from '@/lib/error-tracking';
import { useBrokerSnapshot, useBrokerStatus, useTrades, dataApi } from '@/src/hooks/data';
import {
  PageShell,
  PageHeader,
  Panel,
  StatCard,
  Badge,
  DataTable,
  EmptyState,
  SegmentedControl,
  AlertBanner,
} from '@/src/components/layout/PageShell';
import { Button } from '@/src/components/ui/button';

type TradeResult = 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
type FilterValue = 'all' | TradeResult;

interface TradeItem {
  _id: string;
  symbol: string;
  side: string;
  mode: string;
  qty: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  result: TradeResult;
  stopLoss?: number;
  takeProfit?: number;
  strategy: string;
  confidence: number;
  entryReason: string;
  exitReason?: string;
  mistakeTags?: string[];
  reasoningCorrect?: boolean;
  openedAt: number;
  closedAt?: number;
}

const FILTER_OPTIONS = ['all', 'OPEN', 'WIN', 'LOSS'] as const satisfies readonly FilterValue[];

function money(n: number | null | undefined): string {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pnlClass(n: number | null | undefined): string {
  if (n == null) return 'text-ink-muted';
  return n >= 0 ? 'text-positive' : 'text-negative';
}

function resultBadgeVariant(result: TradeResult): 'default' | 'success' | 'warning' | 'danger' | 'muted' {
  switch (result) {
    case 'WIN':
      return 'success';
    case 'LOSS':
      return 'danger';
    case 'OPEN':
      return 'warning';
    case 'BREAKEVEN':
      return 'muted';
    default:
      return 'default';
  }
}

export function TradeHistory() {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [closingId, setClosingId] = useState<string | null>(null);
  const [cashingOut, setCashingOut] = useState(false);
  const [cashOutMessage, setCashOutMessage] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [quoteBySymbol, setQuoteBySymbol] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: brokerStatus } = useBrokerStatus();
  const { data: tradeData, loading: tradesLoading } = useTrades({
    result: filter === 'all' ? undefined : filter,
  });
  const { data: brokerSnapshot } = useBrokerSnapshot();
  const { data: allOpenTrades, loading: openTradesLoading } = useTrades({ result: 'OPEN', limit: 100 });

  useEffect(() => {
    if (brokerStatus?.connected) {
      dataApi.syncBroker().catch(() => {});
    }
  }, [brokerStatus?.connected]);

  const openItems: OpenTradeView[] = (allOpenTrades ?? []) as OpenTradeView[];
  const openSymbolsKey = openItems.map((t) => t.symbol).sort().join(',');

  useEffect(() => {
    if (!openSymbolsKey) {
      setQuoteBySymbol({});
      return;
    }
    const symbols = [...new Set(openSymbolsKey.split(',').filter(Boolean))];
    let cancelled = false;

    Promise.all(
      symbols.map(async (symbol: string) => {
        try {
          const res = await fetch(`/api/v1/market/quote/${encodeURIComponent(symbol)}`);
          if (!res.ok) return null;
          const data = (await res.json()) as { price?: number };
          return data.price != null ? ([symbol.toUpperCase(), data.price] as const) : null;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const row of pairs) {
        if (row) next[row[0]] = row[1];
      }
      setQuoteBySymbol(next);
    });

    return () => {
      cancelled = true;
    };
  }, [openSymbolsKey]);

  const trades = (tradeData ?? []) as TradeItem[];
  const selected = trades.find((t) => t._id === selectedId) ?? null;
  const openPositionCount = countOpenPositions(brokerSnapshot?.positions ?? [], openItems);
  const winningOpenCount = countWinningOpenTrades(
    brokerSnapshot?.positions ?? [],
    openItems,
    quoteBySymbol,
  );
  const canCashOut = !openTradesLoading && winningOpenCount > 0;

  async function cashOut() {
    if (!canCashOut) return;
    setCashingOut(true);
    setCashOutMessage(null);
    try {
      if (brokerStatus?.connected) {
        await dataApi.syncBroker().catch(() => {});
      }
      const result = await dataApi.cashOutWinners();
      setCashOutMessage(
        result.closed > 0
          ? `Closed ${result.closed} winning position${result.closed === 1 ? '' : 's'}`
          : 'No open positions were in profit. Nothing closed',
      );
      if (brokerStatus?.connected) {
        await dataApi.syncBroker().catch(() => {});
      }
    } catch (err) {
      setCashOutMessage(formatUserError(err, 'Cash out failed. Try again.'));
    } finally {
      setCashingOut(false);
    }
  }

  async function closeNow(id: string) {
    setClosingId(id);
    setCloseError(null);
    try {
      await dataApi.closeTrade(id);
    } catch (err) {
      setCloseError(formatUserError(err, 'Failed to close trade.'));
    } finally {
      setClosingId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Trade History"
        description={
          brokerStatus?.connected
            ? `${openPositionCount} open position(s) · ${trades.length} total trade(s) in history${
                brokerStatus.paper ? ' (Alpaca paper)' : ' (Alpaca live)'
              }. Dashboard positions and this list use the same trade records.`
            : 'Review past and open trades. Connect Alpaca in Settings to sync live positions.'
        }
        actions={
          <Button
            disabled={cashingOut || !canCashOut}
            title={
              winningOpenCount > 0
                ? `Close ${winningOpenCount} winning open position${winningOpenCount === 1 ? '' : 's'}`
                : openTradesLoading
                  ? 'Loading open positions…'
                  : 'No open positions are currently in profit'
            }
            onClick={() => void cashOut()}
          >
            {cashingOut ? 'Cashing out…' : 'Cash Out'}
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl options={FILTER_OPTIONS} value={filter} onChange={setFilter} size="sm" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open positions" value={openPositionCount} />
        <StatCard
          label="Winning open"
          value={winningOpenCount}
          trend={winningOpenCount > 0 ? 'up' : 'neutral'}
          hint={canCashOut ? 'Eligible for cash out' : 'None in profit'}
        />
        <StatCard label="In this view" value={trades.length} hint={`Filter: ${filter}`} />
      </div>

      {(closeError || cashOutMessage) && (
        <div className="mb-6 space-y-3">
          {closeError && (
            <AlertBanner variant="error" onDismiss={() => setCloseError(null)}>
              {closeError}
            </AlertBanner>
          )}
          {cashOutMessage && (
            <AlertBanner variant="info" onDismiss={() => setCashOutMessage(null)}>
              {cashOutMessage}
            </AlertBanner>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]" data-tour="trade-history">
        <Panel className="min-w-0 [&>div:last-child]:p-0">
          {tradeData === undefined || tradesLoading ? (
            <div className="p-5">
              <TableSkeleton rows={8} />
            </div>
          ) : trades.length === 0 ? (
            <EmptyState
              title="No trades match this filter"
              description={
                brokerStatus?.connected
                  ? 'Start the bot or tap Scan Now on the dashboard to open trades via Alpaca.'
                  : 'Connect Alpaca in Settings, then start the bot.'
              }
            />
          ) : (
            <DataTable>
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  <th className="px-5 py-3">Opened</th>
                  <th className="px-5 py-3">Symbol</th>
                  <th className="px-5 py-3">Side</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3 text-right">Entry</th>
                  <th className="px-5 py-3 text-right">Exit</th>
                  <th className="px-5 py-3 text-right">P/L</th>
                  <th className="px-5 py-3">Result</th>
                  <th className="px-5 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr
                    key={t._id}
                    className={cn(
                      'cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-surface-overlay/50',
                      selectedId === t._id && 'bg-accent-muted/40',
                    )}
                    onClick={() => setSelectedId(t._id === selectedId ? null : t._id)}
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-ink-secondary">
                      {new Date(t.openedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-mono font-semibold text-ink">{t.symbol}</td>
                    <td className="px-5 py-3 text-ink">{t.side}</td>
                    <td className="px-5 py-3">
                      <Badge variant="muted">{t.mode}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-ink">
                      {money(t.entryPrice)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-ink">
                      {money(t.exitPrice ?? null)}
                    </td>
                    <td className={cn('px-5 py-3 text-right font-mono tabular-nums', pnlClass(t.pnl))}>
                      {money(t.pnl ?? null)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={resultBadgeVariant(t.result)}>{t.result}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {t.result === 'OPEN' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-negative hover:text-negative"
                          disabled={closingId === t._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void closeNow(t._id);
                          }}
                        >
                          {closingId === t._id ? 'Closing…' : 'Close'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>

        {selected && (
          <Panel
            title="Trade details"
            action={
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            }
            className="lg:sticky lg:top-6 lg:self-start"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-ink">{selected.symbol}</span>
              <Badge variant={resultBadgeVariant(selected.result)}>{selected.result}</Badge>
            </div>
            <dl className="space-y-3">
              <Detail label="Strategy" value={selected.strategy} />
              <Detail label="Confidence" value={`${Math.round(selected.confidence)}%`} />
              <Detail label="Side / Mode" value={`${selected.side} · ${selected.mode}`} />
              <Detail label="Qty" value={String(selected.qty)} />
              <Detail
                label="Entry / Exit"
                value={`${money(selected.entryPrice)} → ${money(selected.exitPrice ?? null)}`}
              />
              <Detail
                label="Stop / Target"
                value={`${money(selected.stopLoss ?? null)} / ${money(selected.takeProfit ?? null)}`}
              />
              <Detail
                label="P/L"
                value={money(selected.pnl ?? null)}
                valueClassName={pnlClass(selected.pnl)}
              />
              <Detail label="Entry reason" value={selected.entryReason} />
              <Detail label="Exit reason" value={selected.exitReason ?? '--'} />
              <Detail
                label="Mistake tags"
                value={selected.mistakeTags?.length ? selected.mistakeTags.join(', ') : 'none'}
              />
              <Detail
                label="Reasoning correct?"
                value={
                  selected.reasoningCorrect == null
                    ? '--'
                    : selected.reasoningCorrect
                      ? 'Yes'
                      : 'No'
                }
              />
            </dl>
          </Panel>
        )}
      </div>
    </PageShell>
  );
}

function Detail({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className={cn('text-sm text-ink', valueClassName)}>{value}</dd>
    </div>
  );
}
