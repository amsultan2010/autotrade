import type { Candle, SymbolSearchResult, Timeframe } from '@autotrade/shared';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

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
  // ── Subscription ──
  checkout: () => request<{ url: string }>('/subscription/checkout', { method: 'POST' }),

  // ── Market data ──
  searchSymbols: (q: string) => request<SymbolSearchResult[]>(`/market/search?q=${encodeURIComponent(q)}`),
  getPopular: () =>
    request<{ marketOpen: boolean; items: Array<{ symbol: string; name: string; kind: 'stock' | 'crypto'; exchange: string; open: boolean }> }>('/market/popular'),
  getCandles: (symbol: string, timeframe: Timeframe) =>
    request<{ symbol: string; timeframe: Timeframe; candles: Candle[] }>(`/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`),

  // ── Admin ──
  adminMetrics: () => request<{ users: number; activeSubs: number; openTrades: number; signals24h: number }>('/admin/metrics'),
  adminUsers: (q = '') =>
    request<Array<{ id: string; email: string; role: string; status: string; createdAt: string; subscription: { status: string; tier: string | null } | null; _count: { trades: number } }>>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminSetStatus: (id: string, status: 'ACTIVE' | 'DISABLED') =>
    request(`/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
};
