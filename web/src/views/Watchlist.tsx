'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { SymbolSearchResult } from '@autotrade/shared';
import { api } from '../api/client';

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

export function Watchlist() {
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  interface WatchlistItem { _id: Id<'watchedSymbols'>; symbol: string; exchange: string }
  const watchlistItems = useQuery(convexApi.watchlist.list) as WatchlistItem[] | undefined;
  const addSymbol      = useMutation(convexApi.watchlist.add);
  const removeSymbol   = useMutation(convexApi.watchlist.remove);

  const [prices, setPrices]     = useState<Record<string, PriceData>>({});
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused]   = useState(false);
  const [popular, setPopular]   = useState<Popular[]>([]);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);

  const timer      = useRef<number | null>(null);
  const blurTimer  = useRef<number | null>(null);

  // Fetch prices whenever the watchlist symbols change.
  const symbolsKey = watchlistItems?.map((w) => w.symbol).join(',') ?? '';
  useEffect(() => {
    if (!symbolsKey) { setPrices({}); return; }

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
    // Always refetch so the live % change stats are fresh each time it opens.
    try {
      const p = await api.getPopular();
      setPopular(p.items);
      setMarketOpen(p.marketOpen);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (query.trim().length < 1) { setResults([]); return; }
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
    await addSymbol({ symbol, exchange });
    setQuery('');
    setResults([]);
  }

  async function remove(id: Id<'watchedSymbols'>) {
    await removeSymbol({ id });
  }

  const rows = (watchlistItems ?? []).map((w) => {
    const p = prices[w.symbol] ?? { price: null, changePct: null, live: false };
    return { _id: w._id, symbol: w.symbol, exchange: w.exchange, price: p.price, changePct: p.changePct, live: p.live };
  });

  const showPopular = focused && query.trim().length === 0 && popular.length > 0;
  const showSearch  = query.trim().length > 0 && (results.length > 0 || searching);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Watchlist</h1>
        <span className="muted">{rows.length} symbols · live prices · no limit</span>
      </header>

      <div className="search-wrap">
        <input
          className="search"
          placeholder="Click to browse, or search any symbol (AAPL, SPY, BTC/USD)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); void loadPopular(); }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setFocused(false), 150);
          }}
        />

        {showSearch && (
          <div className="search-results">
            {searching && <div className="muted pad">Searching…</div>}
            {results.map((r) => (
              <button
                key={`${r.symbol}-${r.exchange}`}
                className="search-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void add(r.symbol, r.exchange)}
              >
                <span className="mono">{r.symbol}</span>
                <span className="muted truncate">{r.name}</span>
                <span className="tag">{r.exchange}</span>
              </button>
            ))}
          </div>
        )}

        {showPopular && (
          <div className="search-results">
            <div className="pop-head">
              Popular tickers
              <span className="muted">
                {' · '}US market {marketOpen ? 'open' : 'closed'} · crypto 24/7
              </span>
            </div>
            {popular.map((p) => {
              const already = ownedSymbols.has(p.symbol.toUpperCase());
              return (
                <button
                  key={p.symbol}
                  className="search-item"
                  disabled={already}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void add(p.symbol, p.exchange)}
                >
                  <span className="mono">{p.symbol}</span>
                  <span className="muted truncate">{p.name}</span>
                  <span className="mono muted">{p.price != null ? money(p.price) : ''}</span>
                  <span className={p.changePct == null ? 'muted' : p.changePct >= 0 ? 'pos' : 'neg'}>
                    {p.changePct == null ? '' : `${p.changePct >= 0 ? '+' : ''}${p.changePct}%`}
                  </span>
                  {p.kind === 'crypto' ? (
                    <span className="dot-badge open">24/7</span>
                  ) : (
                    <span className={`dot-badge ${p.open ? 'open' : 'closed'}`}>{p.open ? 'Open' : 'Closed'}</span>
                  )}
                  <span className="add-hint">{already ? 'added' : '+ add'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <section className="panel">
        {convexAuthLoading || (isAuthenticated && watchlistItems === undefined) ? (
          <p className="muted">Loading your watchlist…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Your watchlist is empty. Click the search bar to browse popular tickers.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Exchange</th>
                <th className="right">Price</th>
                <th className="right">Change</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w._id}>
                  <td className="mono">
                    {w.live && <span className="live-dot" title="Live" />}
                    {w.symbol}
                  </td>
                  <td className="muted">{w.exchange}</td>
                  <td className="right mono">{money(w.price)}</td>
                  <td className={`right ${w.changePct == null ? 'muted' : w.changePct >= 0 ? 'pos' : 'neg'}`}>
                    {w.changePct == null ? '--' : `${w.changePct >= 0 ? '+' : ''}${w.changePct}%`}
                  </td>
                  <td className="right">
                    <button className="btn-text danger" onClick={() => void remove(w._id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
