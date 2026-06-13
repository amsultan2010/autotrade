/**
 * API client for the AlphaBot backend. Holds the access token in memory only;
 * the refresh token lives in the OS-encrypted store via the preload bridge.
 * Transparently refreshes on 401 and retries once.
 */
import type {
  AuthTokens,
  AuthUser,
  BotSettingsDTO,
  Candle,
  PerformanceSummary,
  SubscriptionInfo,
  SymbolSearchResult,
  Timeframe,
  TradeDTO,
} from '@alphabot/shared';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

let accessToken: string | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function refreshAccess(): Promise<boolean> {
  const refreshToken = await window.alphabot.getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await window.alphabot.clearRefreshToken();
    return false;
  }
  const tokens = (await res.json()) as AuthTokens;
  accessToken = tokens.accessToken;
  await window.alphabot.setRefreshToken(tokens.refreshToken);
  return true;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry && (await refreshAccess())) {
    return request<T>(path, init, false);
  }

  if (!res.ok) {
    let code = 'ERROR';
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code: string; message: string } };
      if (body.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      /* non-JSON */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Auth ──
export const api = {
  async register(email: string, password: string) {
    const data = await request<{ user: AuthUser } & AuthTokens>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    accessToken = data.accessToken;
    await window.alphabot.setRefreshToken(data.refreshToken);
    return data.user;
  },

  async login(email: string, password: string) {
    const data = await request<{ user: AuthUser } & AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    accessToken = data.accessToken;
    await window.alphabot.setRefreshToken(data.refreshToken);
    return data.user;
  },

  async restoreSession(): Promise<AuthUser | null> {
    if (!(await refreshAccess())) return null;
    try {
      const { user } = await request<{ user: AuthUser }>('/auth/me');
      return user;
    } catch {
      return null;
    }
  },

  async logout() {
    const refreshToken = await window.alphabot.getRefreshToken();
    if (refreshToken) {
      try {
        await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } catch {
        /* ignore */
      }
    }
    accessToken = null;
    await window.alphabot.clearRefreshToken();
  },

  // ── Subscription ──
  subscriptionStatus: () => request<SubscriptionInfo>('/subscription/status'),
  checkout: () => request<{ url: string }>('/subscription/checkout', { method: 'POST' }),

  // ── Watchlist / market ──
  getWatchlist: () => request<Array<{ id: string; symbol: string; exchange: string }>>('/watchlist'),
  getWatchlistQuotes: () =>
    request<
      Array<{ id: string; symbol: string; exchange: string; price: number | null; changePct: number | null; live: boolean }>
    >('/watchlist/quotes'),
  addSymbol: (symbol: string, exchange: string) =>
    request('/watchlist', { method: 'POST', body: JSON.stringify({ symbol, exchange }) }),
  removeSymbol: (id: string) => request(`/watchlist/${id}`, { method: 'DELETE' }),
  searchSymbols: (q: string) => request<SymbolSearchResult[]>(`/market/search?q=${encodeURIComponent(q)}`),
  getPopular: () =>
    request<{
      marketOpen: boolean;
      items: Array<{ symbol: string; name: string; kind: 'stock' | 'crypto'; exchange: string; open: boolean }>;
    }>('/market/popular'),

  // ── Settings ──
  getSettings: () => request<BotSettingsDTO>('/settings'),
  updateSettings: (patch: Partial<BotSettingsDTO>) =>
    request<BotSettingsDTO>('/settings', { method: 'PUT', body: JSON.stringify(patch) }),

  // ── Charts ──
  getCandles: (symbol: string, timeframe: Timeframe) =>
    request<{ symbol: string; timeframe: Timeframe; candles: Candle[] }>(
      `/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
    ),

  // ── Trades / performance ──
  getTrades: (params = '') => request<{ items: TradeDTO[]; nextCursor: string | null }>(`/trades${params}`),
  closeTrade: (id: string) => request<{ closed: boolean; pnl?: number }>(`/trades/${id}/close`, { method: 'POST' }),
  getPerformance: () => request<PerformanceSummary>('/performance'),
  getSignals: () => request<Array<Record<string, unknown>>>('/signals'),

  // ── Bot ──
  botStatus: () =>
    request<{ mode: string; running: boolean; openTrades: number; paperAccount: { balance: number; equity: number } | null }>(
      '/bot/status',
    ),
  botStart: () => request('/bot/start', { method: 'POST' }),
  botStop: () => request('/bot/stop', { method: 'POST' }),
  botRunNow: () => request('/bot/run-now', { method: 'POST' }),

  // ── Admin (role-gated server-side; normal users get 403) ──
  adminMetrics: () =>
    request<{ users: number; activeSubs: number; openTrades: number; signals24h: number }>('/admin/metrics'),
  adminUsers: (q = '') =>
    request<
      Array<{
        id: string;
        email: string;
        role: string;
        status: string;
        createdAt: string;
        subscription: { status: string; tier: string | null } | null;
        _count: { trades: number };
      }>
    >(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminSetStatus: (id: string, status: 'ACTIVE' | 'DISABLED') =>
    request(`/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
};
