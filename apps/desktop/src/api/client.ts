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
} from '@autotrade/shared';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

const REFRESH_TOKEN_KEY = 'autotrade_refresh_token';

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setStoredRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

function clearStoredRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let accessToken: string | null = null;
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

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function refreshAccess(): Promise<boolean> {
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) { accessToken = token; return true; }
    return false;
  }
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearStoredRefreshToken();
    return false;
  }
  const tokens = (await res.json()) as AuthTokens;
  accessToken = tokens.accessToken;
  setStoredRefreshToken(tokens.refreshToken);
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

export const api = {
  setTokenGetter(getter: (() => Promise<string | null>) | null): void {
    tokenGetter = getter;
    if (!getter) accessToken = null;
  },

  async clerkSync(sessionToken: string): Promise<void> {
    const data = await request<{ user: unknown } & AuthTokens>('/auth/clerk-sync', {
      method: 'POST',
      body: JSON.stringify({ sessionToken }),
    });
    accessToken = data.accessToken;
    setStoredRefreshToken(data.refreshToken);
  },

  async register(email: string, password: string) {
    const data = await request<{ user: AuthUser } & AuthTokens>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    accessToken = data.accessToken;
    setStoredRefreshToken(data.refreshToken);
    return data.user;
  },

  async login(email: string, password: string) {
    const data = await request<{ user: AuthUser } & AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    accessToken = data.accessToken;
    setStoredRefreshToken(data.refreshToken);
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
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      try {
        await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } catch {
        /* ignore */
      }
    }
    accessToken = null;
    clearStoredRefreshToken();
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
