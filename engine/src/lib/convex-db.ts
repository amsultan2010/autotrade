/**
 * HTTP client wrapper for secret-guarded Convex engineData functions.
 * Used by the bot worker and engine services for all persistence.
 */
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { env } from '../config/env';
import { AppError } from './errors';
import type {
  ActiveBotUserRecord,
  ActiveUserRecord,
  BotContextRecord,
  BotSettingsRecord,
  DecryptedBrokerKeys,
  DigestTradeRecord,
  SignalAction,
  TradeRecord,
  TradeResult,
  TradeSide,
  BotMode,
  RiskLevel,
} from '../types/db';


export type CreateSignalArgs = {
  clerkId: string;
  ticker: string;
  exchange: string;
  price: number;
  timeframe: string;
  strategy: string;
  action: SignalAction;
  confidence: number;
  riskLevel: RiskLevel;
  entryReason: string;
  stopLoss?: number;
  takeProfit?: number;
  rrRatio?: number;
  explanation: string;
  createdAt?: number;
};

export type CreateTradeArgs = {
  clerkId: string;
  signalId?: string;
  symbol: string;
  exchange: string;
  side: TradeSide;
  mode: 'PAPER' | 'LIVE';
  qty: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  strategy: string;
  confidence: number;
  entryReason: string;
  entrySnapshot?: unknown;
  brokerOrderId?: string;
  openedAt?: number;
};

export type CloseTradeArgs = {
  tradeId: string;
  exitPrice: number;
  exitReason?: string;
  mistakeTags?: string[];
  reasoningCorrect?: boolean;
  exitSnapshot?: unknown;
};

export type RecordStrategyOutcomeArgs = {
  clerkId: string;
  strategy: string;
  symbol: string;
  won: boolean;
  pnl: number;
};

export type WriteAuditLogArgs = {
  actorClerkId?: string;
  action: string;
  target?: string;
  meta?: unknown;
  ip?: string;
};

function convexUrl(): string {
  const url = env.CONVEX_URL?.trim() || process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    throw new AppError(503, 'CONFIG_ERROR', 'CONVEX_URL is not configured');
  }
  return url;
}

export function getSecret(): string {
  if (!env.BOT_INTERNAL_SECRET) {
    throw new AppError(503, 'CONFIG_ERROR', 'BOT_INTERNAL_SECRET is not configured');
  }
  return env.BOT_INTERNAL_SECRET;
}

let client: ConvexHttpClient | null = null;

export function getClient(): ConvexHttpClient {
  if (!client) {
    client = new ConvexHttpClient(convexUrl());
  }
  return client;
}

/** UTC midnight for the current day (ms since epoch). */
export function utcDayStartMs(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function stripBotSettings(
  raw: (BotSettingsRecord & { _id?: string; _creationTime?: number }) | null,
): BotSettingsRecord | null {
  if (!raw) return null;
  const {
    _id: _unusedId,
    _creationTime: _unusedTs,
    ...settings
  } = raw as BotSettingsRecord & { _id?: string; _creationTime?: number };
  return settings;
}

function stripTrade(raw: TradeRecord & { _creationTime?: number }): TradeRecord {
  const { _creationTime: _unusedTs, ...trade } = raw;
  return trade;
}

const getBotContextRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string },
  BotContextRecord | null
>('engineData:getBotContext');

const countOpenTradesRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; mode?: BotMode },
  number
>('engineData:countOpenTrades');

const countPaperTradesRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string },
  number
>('engineData:countPaperTrades');

const realizedPnlTodayRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; dayStartMs: number },
  number
>('engineData:realizedPnlToday');

const findOpenTradeBySymbolRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; symbol: string; mode: BotMode },
  TradeRecord | null
>('engineData:findOpenTradeBySymbol');

const getOpenTradesRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; mode?: BotMode },
  TradeRecord[]
>('engineData:getOpenTrades');

const getOpenTradesBySymbolRef = makeFunctionReference<
  'query',
  { secret: string; symbol: string },
  TradeRecord[]
>('engineData:getOpenTradesBySymbol');

const countSignalsSinceRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; sinceMs: number },
  number
>('engineData:countSignalsSince');

const getStrategyWeightsRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; assetClass: 'stock' | 'crypto' },
  Record<string, number>
>('engineData:getStrategyWeights');

const getActiveBotUsersRef = makeFunctionReference<
  'query',
  { secret: string },
  ActiveBotUserRecord[]
>('engineData:getActiveBotUsers');

const getDigestTradesRef = makeFunctionReference<
  'query',
  { secret: string; clerkId: string; sinceMs: number },
  DigestTradeRecord[]
>('engineData:getDigestTrades');

const listActiveUsersRef = makeFunctionReference<
  'query',
  { secret: string },
  ActiveUserRecord[]
>('engineData:listActiveUsers');

const createSignalRef = makeFunctionReference<
  'mutation',
  {
    secret: string;
    clerkId: string;
    ticker: string;
    exchange: string;
    price: number;
    timeframe: string;
    strategy: string;
    action: SignalAction;
    confidence: number;
    riskLevel: RiskLevel;
    entryReason: string;
    stopLoss?: number;
    takeProfit?: number;
    rrRatio?: number;
    explanation: string;
    createdAt?: number;
  },
  string
>('engineData:createSignal');

const createTradeRef = makeFunctionReference<
  'mutation',
  {
    secret: string;
    clerkId: string;
    signalId?: string;
    symbol: string;
    exchange: string;
    side: TradeSide;
    mode: 'PAPER' | 'LIVE';
    qty: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    strategy: string;
    confidence: number;
    entryReason: string;
    entrySnapshot?: unknown;
    brokerOrderId?: string;
    openedAt?: number;
  },
  string
>('engineData:createTrade');

const closeTradeRef = makeFunctionReference<
  'mutation',
  {
    secret: string;
    tradeId: string;
    exitPrice: number;
    exitReason?: string;
    mistakeTags?: string[];
    reasoningCorrect?: boolean;
    exitSnapshot?: unknown;
  },
  { pnl: number; result: Exclude<TradeResult, 'OPEN'> }
>('engineData:closeTrade');

const adjustPaperAccountRef = makeFunctionReference<
  'mutation',
  { secret: string; clerkId: string; balanceDelta: number; equityDelta: number },
  { balance: number; equity: number } | null
>('engineData:adjustPaperAccount');

const setPaperEquityRef = makeFunctionReference<
  'mutation',
  { secret: string; clerkId: string; equity: number },
  { balance: number; equity: number } | null
>('engineData:setPaperEquity');

const recordStrategyOutcomeRef = makeFunctionReference<
  'mutation',
  {
    secret: string;
    clerkId: string;
    strategy: string;
    symbol: string;
    won: boolean;
    pnl: number;
  },
  null
>('engineData:recordStrategyOutcome');

const writeAuditLogRef = makeFunctionReference<
  'mutation',
  {
    secret: string;
    actorClerkId?: string;
    action: string;
    target?: string;
    meta?: unknown;
    ip?: string;
  },
  null
>('engineData:writeAuditLog');

const getDecryptedKeysInternalRef = makeFunctionReference<
  'action',
  { clerkId: string; secret: string },
  DecryptedBrokerKeys | null
>('brokerCredentialActions:getDecryptedKeysInternal');

function secretArgs<T extends Record<string, unknown>>(args: T): T & { secret: string } {
  return { ...args, secret: getSecret() };
}

export async function getBotContext(clerkId: string): Promise<BotContextRecord | null> {
  const raw = await getClient().query(getBotContextRef, secretArgs({ clerkId }));
  if (!raw) return null;
  return {
    ...raw,
    botSettings: stripBotSettings(raw.botSettings as BotSettingsRecord & { _id?: string }),
  };
}

export async function countOpenTrades(clerkId: string, mode?: BotMode): Promise<number> {
  return getClient().query(countOpenTradesRef, secretArgs({ clerkId, mode }));
}

export async function countPaperTrades(clerkId: string): Promise<number> {
  return getClient().query(countPaperTradesRef, secretArgs({ clerkId }));
}

export async function realizedPnlToday(clerkId: string, dayStartMs?: number): Promise<number> {
  return getClient().query(
    realizedPnlTodayRef,
    secretArgs({ clerkId, dayStartMs: dayStartMs ?? utcDayStartMs() }),
  );
}

export async function findOpenTradeBySymbol(
  clerkId: string,
  symbol: string,
  mode: BotMode,
): Promise<TradeRecord | null> {
  const raw = await getClient().query(
    findOpenTradeBySymbolRef,
    secretArgs({ clerkId, symbol, mode }),
  );
  return raw ? stripTrade(raw) : null;
}

export async function getOpenTrades(clerkId: string, mode?: BotMode): Promise<TradeRecord[]> {
  const rows = await getClient().query(getOpenTradesRef, secretArgs({ clerkId, mode }));
  return rows.map(stripTrade);
}

export async function getOpenTradesBySymbol(symbol: string): Promise<TradeRecord[]> {
  const rows = await getClient().query(getOpenTradesBySymbolRef, secretArgs({ symbol }));
  return rows.map(stripTrade);
}

export async function countSignalsSince(clerkId: string, sinceMs: number): Promise<number> {
  return getClient().query(countSignalsSinceRef, secretArgs({ clerkId, sinceMs }));
}

export async function getStrategyWeights(
  clerkId: string,
  assetClass: 'stock' | 'crypto',
): Promise<Record<string, number>> {
  return getClient().query(getStrategyWeightsRef, secretArgs({ clerkId, assetClass }));
}

export async function getActiveBotUsers(): Promise<ActiveBotUserRecord[]> {
  return getClient().query(getActiveBotUsersRef, secretArgs({}));
}

export async function getDigestTrades(
  clerkId: string,
  sinceMs: number,
): Promise<DigestTradeRecord[]> {
  return getClient().query(getDigestTradesRef, secretArgs({ clerkId, sinceMs }));
}

export async function listActiveUsers(): Promise<ActiveUserRecord[]> {
  return getClient().query(listActiveUsersRef, secretArgs({}));
}

export async function createSignal(args: CreateSignalArgs): Promise<string> {
  return getClient().mutation(createSignalRef, secretArgs(args));
}

export async function createTrade(args: CreateTradeArgs): Promise<string> {
  return getClient().mutation(createTradeRef, secretArgs(args));
}

export async function closeTrade(args: CloseTradeArgs): Promise<{ pnl: number; result: Exclude<TradeResult, 'OPEN'> }> {
  return getClient().mutation(closeTradeRef, secretArgs(args));
}

export async function adjustPaperAccount(
  clerkId: string,
  balanceDelta: number,
  equityDelta: number,
): Promise<{ balance: number; equity: number } | null> {
  return getClient().mutation(
    adjustPaperAccountRef,
    secretArgs({ clerkId, balanceDelta, equityDelta }),
  );
}

export async function setPaperEquity(
  clerkId: string,
  equity: number,
): Promise<{ balance: number; equity: number } | null> {
  return getClient().mutation(setPaperEquityRef, secretArgs({ clerkId, equity }));
}

export async function recordStrategyOutcome(args: RecordStrategyOutcomeArgs): Promise<void> {
  await getClient().mutation(recordStrategyOutcomeRef, secretArgs(args));
}

export async function writeAuditLog(args: WriteAuditLogArgs): Promise<void> {
  await getClient().mutation(writeAuditLogRef, secretArgs(args));
}

export async function getDecryptedBrokerKeys(clerkId: string): Promise<DecryptedBrokerKeys | null> {
  return getClient().action(getDecryptedKeysInternalRef, {
    clerkId,
    secret: getSecret(),
  });
}
