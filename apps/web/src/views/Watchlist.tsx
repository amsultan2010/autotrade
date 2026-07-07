'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWatchlist, dataApi } from '@/src/hooks/data';
import type { SymbolSearchResult } from '@autotrade/shared';
import { cn } from '@/lib/utils';
import {
  PageShell,
  PageHeader,
  Panel,
  StatCard,
  Badge,
  DataTable,
  EmptyState,
} from '@/src/components/layout/PageShell';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { api } from '../api/client';
import { TableSkeleton } from '../components/Skeleton';

interface PriceData {
  symbol: string;
  price: number | null;
  changePct: number | null;
  live: boolean;
}

interface Popular {
  symbol: string;
  name: string;
  kind: 'stock' | 'crypto';
  exchange: string;
  open: boolean;
  price: number | null;
  changePct: number | null;
}

function money(n: number | null): string {
  if (n == null) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function changeClass(pct: number | null): string {
  if (pct == null) return 'text-ink-muted';
  return pct >= 0 ? 'text-positive' : 'text-negative';
}

function formatChange(pct: number | null): string {
  if (pct == null) return '--';
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

export function Watchlist() {
  const { isLoaded: authLoaded } = useAuth();
  const convexAuthLoading = !authLoaded;
  const { data: watchlistItems, loading: watchlistLoading } = useWatchlist();

  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [popular, setPopular] = useState<Popular[]>([]);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);

  const timer = useRef<number | null>(null);
  const blurTimer = useRef<number | null>(null);

  const symbolsKey = watchlistItems?.map((w) => w.symbol).join(',') ?? '';
  useEffect(() => {
    if (!symbolsKey) {
      setPrices({});
      return;
    }

    const fetchPrices = () => {
      fetch(`/api/v1/watchlist/quotes?symbols=${encodeURIComponent(symbolsKey)}`)
        .then((r) => r.json())
        .then((data: PriceData[]) => {
          const map: Record<string, PriceData> = {};
          for (const item of data) map[item.symbol] = item;
          setPrices(map);
        })
        .catch(() => {});
    };

    fetchPrices();
    timer.current = window.setInterval(fetchPrices, 4000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [symbolsKey]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    };
  }, []);

  async function loadPopular() {
    try {
      const p = await api.getPopular();
      setPopular(p.items);
      setMarketOpen(p.marketOpen);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await api.searchSymbols(query.trim()));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const ownedSymbols = new Set((watchlistItems ?? []).map((r) => r.symbol.toUpperCase()));

  async function add(symbol: string, exchange: string) {
    await dataApi.addWatchlist(symbol, exchange);
    setQuery('');
    setResults([]);
  }

  async function remove(id: string) {
    await dataApi.removeWatchlist(id);
  }

  const rows = (watchlistItems ?? []).map((w) => {
    const p = prices[w.symbol] ?? { price: null, changePct: null, live: false };
    return {
      _id: w._id,
      symbol: w.symbol,
      exchange: w.exchange,
      price: p.price,
      changePct: p.changePct,
      live: p.live,
    };
  });

  const liveCount = rows.filter((r) => r.live).length;
  const showPopular = focused && query.trim().length === 0 && popular.length > 0;
  const showSearch = query.trim().length > 0;
  const dropdownOpen = showPopular || showSearch;

  return (
    <PageShell>
      <PageHeader
        title="Watchlist"
        description={`${rows.length} symbols · stocks trade US hours · crypto (BTC/USD) 24/7`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Symbols" value={rows.length} />
        <StatCard
          label="Live quotes"
          value={liveCount}
          hint={liveCount > 0 ? 'Updating every 4s' : 'No live feeds yet'}
          trend={liveCount > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          label="US market"
          value={marketOpen == null ? '--' : marketOpen ? 'Open' : 'Closed'}
          hint="Crypto trades 24/7"
        />
      </div>

      <div className="relative mb-6" data-tour="watchlist-search">
        <Input
          placeholder="Click to browse, or search any symbol (AAPL, SPY, BTC/USD)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true);
            void loadPopular();
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setFocused(false), 150);
          }}
          aria-expanded={dropdownOpen}
          aria-controls="watchlist-search-dropdown"
          aria-autocomplete="list"
        />

        {dropdownOpen && (
          <div
            id="watchlist-search-dropdown"
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface-raised shadow-[var(--shadow-card)]"
            role="listbox"
            aria-label={showSearch ? 'Symbol search results' : 'Popular symbols'}
          >
            {showSearch && (
              <>
                {searching && (
                  <p className="px-4 py-3 text-sm text-ink-secondary">Searching…</p>
                )}
                {!searching && results.length === 0 && (
                  <p className="px-4 py-3 text-sm text-ink-secondary">
                    No symbols found. Try BTC/USD for crypto
                  </p>
                )}
                {results.map((r) => (
                  <button
                    key={`${r.symbol}-${r.exchange}`}
                    type="button"
                    role="option"
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-overlay"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void add(r.symbol, r.exchange)}
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-semibold text-ink">{r.symbol}</span>
                      <span className="ml-2 truncate text-sm text-ink-secondary">{r.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="muted">{r.exchange}</Badge>
                      <span className="text-xs font-semibold text-accent">+ add</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {showPopular && (
              <>
                <div className="border-b border-border px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Popular tickers
                    <span className="ml-1 normal-case tracking-normal text-ink-secondary">
                      · US market {marketOpen ? 'open' : 'closed'} · crypto 24/7
                    </span>
                  </p>
                </div>
                {popular.map((p) => {
                  const already = ownedSymbols.has(p.symbol.toUpperCase());
                  return (
                    <button
                      key={p.symbol}
                      type="button"
                      role="option"
                      disabled={already}
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void add(p.symbol, p.exchange)}
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-sm font-semibold text-ink">{p.symbol}</span>
                        <span className="ml-2 truncate text-sm text-ink-secondary">{p.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm tabular-nums text-ink">
                          {p.price != null ? money(p.price) : '--'}
                        </span>
                        <span className={cn('font-mono text-xs tabular-nums', changeClass(p.changePct))}>
                          {formatChange(p.changePct)}
                        </span>
                        {p.kind === 'crypto' ? (
                          <Badge variant="success">24/7</Badge>
                        ) : (
                          <Badge variant={p.open ? 'success' : 'muted'}>
                            {p.open ? 'Open' : 'Closed'}
                          </Badge>
                        )}
                        <span className="text-xs font-semibold text-accent">
                          {already ? 'added' : '+ add'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      <Panel className="[&>div:last-child]:p-0">
        {convexAuthLoading || watchlistLoading ? (
          <div className="p-5">
            <TableSkeleton rows={6} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Your watchlist is empty"
            description="Search above to add tickers. Try NVDA, AAPL, or SPY…"
          />
        ) : (
          <DataTable>
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3">Symbol</th>
                <th className="px-5 py-3">Exchange</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-right">Change</th>
                <th className="px-5 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr
                  key={w._id}
                  className="border-b border-border last:border-b-0 transition-colors hover:bg-surface-overlay/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {w.live && (
                        <Badge variant="success" pulse>
                          Live
                        </Badge>
                      )}
                      <span className="font-mono font-semibold text-ink">{w.symbol}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-secondary">{w.exchange}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-ink">
                    {money(w.price)}
                  </td>
                  <td
                    className={cn(
                      'px-5 py-3 text-right font-mono tabular-nums',
                      changeClass(w.changePct),
                    )}
                  >
                    {formatChange(w.changePct)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-negative hover:text-negative"
                      onClick={() => void remove(w._id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </PageShell>
  );
}
