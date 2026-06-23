import { type Candle, type ErrorCode, type SymbolSearchResult, type Timeframe, ErrorCodes, isErrorPayload } from '@autotrade/shared';
import { captureAppError } from '@/lib/error-tracking';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public refId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let code: string = ErrorCodes.UNKNOWN;
    let message = res.statusText;
    let refId: string | undefined;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (isErrorPayload(body.error)) {
        code = body.error.code;
        message = body.error.message;
        refId = body.error.refId;
      }
    } catch { /* non-JSON */ }

    const apiError = new ApiError(res.status, code, message, refId);
    if (res.status >= 500) {
      captureAppError(code as ErrorCode, apiError, {
        route: path,
        refId,
      });
    }
    throw apiError;
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
