'use client';

import { useMemo, useCallback } from 'react';
import { useApiQuery } from './useApiQuery';

export interface BotSettingsRow extends Record<string, unknown> {
  _id: string;
  clerkId: string;
  mode: 'DISABLED' | 'PAPER' | 'LIVE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  maxActiveTrades: number;
  maxTradeSize: number;
  riskPerTradePct: number;
  defaultStopPct: number;
  defaultTakeProfitPct: number;
  maxDailyLoss: number;
  tradingHoursStart: string;
  tradingHoursEnd: string;
  minConfidence: number;
  timeframes: string[];
  strategies: string[];
  stockStrategies?: string[];
  cryptoStrategies?: string[];
  includeExperimental?: boolean;
  disabledStrategies?: string[];
  scanIntervalSeconds?: number;
  paperTradesLimit?: number;
}

export interface TradeRow {
  _id: string;
  symbol: string;
  exchange: string;
  side: string;
  mode: string;
  qty: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  result: 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
  strategy: string;
  confidence: number;
  entryReason: string;
  exitReason?: string;
  mistakeTags?: string[];
  reasoningCorrect?: boolean;
  brokerOrderId?: string;
  openedAt: number;
  closedAt?: number;
}

export interface WatchlistRow extends Record<string, unknown> {
  _id: string;
  symbol: string;
  exchange: string;
  mic?: string;
  addedAt: number;
}

export interface UserProfileRow extends Record<string, unknown> {
  _id: string;
  clerkId: string;
  email: string;
  role: string;
  status: string;
  alpacaGuideCompleted?: boolean;
  productTourCompleted?: boolean;
  weeklyDigestEnabled?: boolean;
  founderPlanOverride?: string | null;
  welcomeEmailSentAt?: number;
}

export interface BrokerSnapshotRow extends Record<string, unknown> {
  _id: string;
  equity: number;
  cash: number;
  buyingPower: number;
  lastEquity?: number;
  mode: 'paper' | 'live';
  positions: Array<{
    symbol: string;
    qty: number;
    avgEntryPrice: number;
    side: 'LONG' | 'SHORT';
    currentPrice?: number;
    marketValue?: number;
    unrealizedPnl?: number;
    unrealizedPnlPct?: number;
  }>;
  syncedAt: number;
  syncError?: string;
}

export interface BotStatusData {
  mode: string;
  running: boolean;
  openTrades: number;
  paperAccount: { balance: number; equity: number } | null;
  paperTradesUsed?: number;
  canUsePaperTrading?: boolean;
  entitled?: boolean;
  scanIntervalSeconds?: number;
  paperTradesLimit?: number;
}

export interface PerformanceSummary {
  winRate: number;
  totalPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  dailyPnl: number;
  totalTrades: number;
  openTrades: number;
  wins?: number;
  losses?: number;
  bestTrade?: number | null;
  worstTrade?: number | null;
  avgWin?: number | null;
  avgLoss?: number | null;
  maxDrawdown?: number;
}

export interface PerformanceBreakdowns {
  byStrategy: Array<{ key: string; trades: number; wins: number; totalPnl: number; winRate: number }>;
  bySymbol: Array<{ key: string; trades: number; wins: number; totalPnl: number; winRate: number }>;
}

export interface SignalRow {
  id: string;
  ticker: string;
  action: string;
  strategy: string;
  confidence: number;
  entryReason: string;
  createdAt: number;
}

export interface BrokerStatusData {
  connected: boolean;
  paperConnected?: boolean;
  liveConnected?: boolean;
  provider?: string;
  paper?: boolean;
}

export interface SubscriptionData {
  status: string;
  tier: string | null;
  currentPeriodEnd: string | null;
  entitled: boolean;
  paperTradesUsed: number;
  paperTradesLimit: number;
  canUsePaperTrading: boolean;
}

export function useBotSettings() {
  return useApiQuery<BotSettingsRow | null>('/bot-settings');
}

export function useBotStatus() {
  return useApiQuery<BotStatusData>('/bot-settings/status', { intervalMs: 15_000 });
}

export function useTrades(filters?: {
  result?: 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
  symbol?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const limit = filters?.limit ?? 200;
  const path = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (filters?.result) params.set('result', filters.result);
    if (filters?.symbol) params.set('symbol', filters.symbol);
    return `/trades?${params.toString()}`;
  }, [filters?.result, filters?.symbol, limit]);

  const { data, loading, error, refresh } = useApiQuery<{ items: TradeRow[]; nextCursor: string | null }>(path, {
    intervalMs: 10_000,
    refreshKey: path,
    enabled: filters?.enabled ?? true,
  });
  return { data: data?.items, nextCursor: data?.nextCursor ?? null, loading, error, refresh };
}

export function useClosedTrades(limit = 200, opts?: { intervalMs?: number }) {
  const query = useApiQuery<{ items: TradeRow[] }>(`/trades/closed?limit=${limit}`, {
    intervalMs: opts?.intervalMs ?? 15_000,
  });
  return { ...query, data: query.data?.items };
}

export function useSignals(limit = 12, opts?: { intervalMs?: number }) {
  return useApiQuery<SignalRow[]>(`/signals?limit=${limit}`, {
    intervalMs: opts?.intervalMs ?? 15_000,
  });
}

export function useWatchlist() {
  const { data, loading, error, refresh } = useApiQuery<WatchlistRow[]>('/watchlist', {
    intervalMs: 20_000,
  });
  return { data: data ?? [], loading, error, refresh };
}

export function useBrokerSnapshot() {
  return useApiQuery<BrokerSnapshotRow | null>('/broker/snapshot', { intervalMs: 30_000 });
}

export function useBrokerStatus() {
  return useApiQuery<BrokerStatusData>('/broker/status', { intervalMs: 30_000 });
}

export function useUserProfile() {
  return useApiQuery<UserProfileRow | null>('/users/me', { intervalMs: 60_000 });
}

export function usePerformance(opts?: { intervalMs?: number }) {
  const intervalMs = opts?.intervalMs ?? 20_000;
  const summary = useApiQuery<PerformanceSummary | null>('/performance/summary', { intervalMs });
  const breakdowns = useApiQuery<PerformanceBreakdowns | null>('/performance/breakdowns', {
    intervalMs: intervalMs + 5_000,
  });
  const refresh = useCallback(async () => {
    await Promise.all([summary.refresh(), breakdowns.refresh()]);
  }, [summary.refresh, breakdowns.refresh]);
  return {
    summary: summary.data,
    breakdowns: breakdowns.data,
    loading: summary.loading || breakdowns.loading,
    refresh,
  };
}

export function useSubscriptionData() {
  return useApiQuery<SubscriptionData>('/subscription', { intervalMs: 30_000 });
}

export function usePlanEntitlements() {
  return useApiQuery<Record<string, unknown>>('/subscription/entitlements', { intervalMs: 30_000 });
}

export function useBillingStatus() {
  return useApiQuery<{ billingEnabled: boolean; liveEntitled: boolean }>('/subscription/billing-status', {
    intervalMs: 60_000,
  });
}

export function usePaperTrial() {
  return useApiQuery<{ paperTradesUsed: number; canUsePaperTrading: boolean }>('/subscription/paper-trial', {
    intervalMs: 30_000,
  });
}

export function useFounderSettings() {
  return useApiQuery<{
    email: string;
    planOverride: string | null;
    effectiveTier: string;
    billingTier: string | null;
  } | null>('/users/founder-settings');
}

async function apiMutate<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
    const message =
      typeof body.error === 'string'
        ? body.error
        : body.error?.message ?? res.statusText;
    throw new Error(message || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const dataApi = {
  updateBotSettings: (body: Record<string, unknown>) =>
    apiMutate('/bot-settings', { method: 'PATCH', body: JSON.stringify(body) }),
  setBotMode: (mode: string) =>
    apiMutate('/bot-settings/mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  switchPreset: (body: Record<string, unknown>) =>
    apiMutate('/bot-settings/preset', { method: 'POST', body: JSON.stringify(body) }),
  addWatchlist: (symbol: string, exchange: string, mic?: string) =>
    apiMutate('/watchlist', { method: 'POST', body: JSON.stringify({ symbol, exchange, mic }) }),
  removeWatchlist: (id: string) =>
    apiMutate(`/watchlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  syncBroker: () => apiMutate<{ synced: boolean; error?: string }>('/broker/sync', { method: 'POST' }),
  runBotScan: () => apiMutate<{ signalsGenerated?: number; tradesOpened?: number }>('/bot/run-now', { method: 'POST' }),
  connectBroker: (keyId: string, secret: string, paper: boolean) =>
    apiMutate('/broker/connect', { method: 'POST', body: JSON.stringify({ keyId, secret, paper }) }),
  disconnectBroker: (paper: boolean) =>
    apiMutate(`/broker/connect?paper=${paper}`, { method: 'DELETE' }),
  closeTrade: (id: string) =>
    apiMutate<{ pnl: number; result: string }>('/trades/close', { method: 'POST', body: JSON.stringify({ id }) }),
  cashOutWinners: () =>
    apiMutate<{ closed: number; skipped: number }>('/trades/cash-out', { method: 'POST', body: JSON.stringify({}) }),
  patchUser: (body: Record<string, unknown>) =>
    apiMutate('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  setFounderPlanOverride: (plan: string | null) =>
    apiMutate('/users/founder-settings', { method: 'POST', body: JSON.stringify({ plan }) }),
};

export interface DashboardFeed {
  botStatus: BotStatusData;
  performance: {
    summary: PerformanceSummary;
    breakdowns: PerformanceBreakdowns;
  };
  signals: SignalRow[];
  watchlist: WatchlistRow[];
  trades: TradeRow[];
  openTrades: TradeRow[];
  closedTrades: TradeRow[];
  brokerStatus: BrokerStatusData;
  brokerSnapshot: BrokerSnapshotRow | null;
  quotes: Array<{
    symbol: string;
    price: number | null;
    changePct: number | null;
    live?: boolean;
  }>;
}

export function useDashboardFeed(opts?: {
  intervalMs?: number;
  signalsLimit?: number;
  tradesLimit?: number;
  openLimit?: number;
  closedLimit?: number;
}) {
  const path = useMemo(() => {
    const params = new URLSearchParams();
    params.set('signalsLimit', String(opts?.signalsLimit ?? 12));
    params.set('tradesLimit', String(opts?.tradesLimit ?? 200));
    params.set('openLimit', String(opts?.openLimit ?? 100));
    params.set('closedLimit', String(opts?.closedLimit ?? 200));
    return `/dashboard/feed?${params.toString()}`;
  }, [opts?.signalsLimit, opts?.tradesLimit, opts?.openLimit, opts?.closedLimit]);

  return useApiQuery<DashboardFeed>(path, {
    intervalMs: opts?.intervalMs ?? 15_000,
    refreshKey: path,
  });
}
