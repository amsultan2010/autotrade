import type {
  BotSettingsDTO,
  Candle,
  PerformanceSummary,
  SubscriptionInfo,
  SymbolSearchResult,
  Timeframe,
  TradeDTO,
} from '@autotrade/shared';

const BASE = '/api/v1';

let tokenGetter: (() => Promise<string | null>) | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function setAccessToken(_token: string | null): void {
  // No-op: Clerk handles tokens via tokenGetter
}

async function getToken(): Promise<string | null> {
  return tokenGetter ? tokenGetter() : null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = await getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let code = 'ERROR';
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code: string; message: string } };
      if (body.error) { code = body.error.code; message = body.error.message; }
    } catch { /* non-JSON */ }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  setTokenGetter(getter: (() => Promise<string | null>) | null): void {
    tokenGetter = getter;
  },

  // Kept for API compatibility — Clerk session is verified server-side automatically
  async clerkSync(_sessionToken: string): Promise<void> {
    await request('/auth/clerk-sync', { method: 'POST', body: JSON.stringify({}) });
  },

  // ── Subscription ──
  subscriptionStatus: () => request<SubscriptionInfo>('/subscription/status'),
  checkout: () => request<{ url: string }>('/subscription/checkout', { method: 'POST' }),

  // ── Watchlist / market ──
  getWatchlist: () => request<Array<{ id: string; symbol: string; exchange: string }>>('/watchlist'),
  getWatchlistQuotes: () =>
    request<Array<{ id: string; symbol: string; exchange: string; price: number | null; changePct: number | null; live: boolean }>>('/watchlist/quotes'),
  addSymbol: (symbol: string, exchange: string) =>
    request('/watchlist', { method: 'POST', body: JSON.stringify({ symbol, exchange }) }),
  removeSymbol: (id: string) => request(`/watchlist/${id}`, { method: 'DELETE' }),
  searchSymbols: (q: string) => request<SymbolSearchResult[]>(`/market/search?q=${encodeURIComponent(q)}`),
  getPopular: () =>
    request<{ marketOpen: boolean; items: Array<{ symbol: string; name: string; kind: 'stock' | 'crypto'; exchange: string; open: boolean }> }>('/market/popular'),

  // ── Settings ──
  getSettings: () => request<BotSettingsDTO>('/settings'),
  updateSettings: (patch: Partial<BotSettingsDTO>) =>
    request<BotSettingsDTO>('/settings', { method: 'PUT', body: JSON.stringify(patch) }),

  // ── Charts ──
  getCandles: (symbol: string, timeframe: Timeframe) =>
    request<{ symbol: string; timeframe: Timeframe; candles: Candle[] }>(`/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`),

  // ── Trades / performance ──
  getTrades: (params = '') => request<{ items: TradeDTO[]; nextCursor: string | null }>(`/trades${params}`),
  closeTrade: (id: string) => request<{ closed: boolean; pnl?: number }>(`/trades/${id}/close`, { method: 'POST' }),
  getPerformance: () => request<PerformanceSummary>('/performance'),
  getSignals: () => request<Array<Record<string, unknown>>>('/signals'),

  // ── Bot ──
  botStatus: () =>
    request<{ mode: string; running: boolean; openTrades: number; paperAccount: { balance: number; equity: number } | null }>('/bot/status'),
  botStart: () => request('/bot/start', { method: 'POST' }),
  botStop: () => request('/bot/stop', { method: 'POST' }),
  botRunNow: () => request('/bot/run-now', { method: 'POST' }),

  // ── Broker ──
  getBrokerStatus: () =>
    request<{ connected: boolean; provider?: string; paper?: boolean }>('/broker'),
  connectBroker: (keyId: string, secret: string, paper: boolean) =>
    request<{ connected: boolean; provider: string; paper: boolean }>('/broker', {
      method: 'POST',
      body: JSON.stringify({ keyId, secret, paper }),
    }),
  disconnectBroker: () => request<{ connected: false }>('/broker', { method: 'DELETE' }),

  // ── Admin ──
  adminMetrics: () => request<{ users: number; activeSubs: number; openTrades: number; signals24h: number }>('/admin/metrics'),
  adminUsers: (q = '') =>
    request<Array<{ id: string; email: string; role: string; status: string; createdAt: string; subscription: { status: string; tier: string | null } | null; _count: { trades: number } }>>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminSetStatus: (id: string, status: 'ACTIVE' | 'DISABLED') =>
    request(`/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
};
