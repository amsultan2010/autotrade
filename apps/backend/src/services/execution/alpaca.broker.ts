/**
 * Alpaca broker provider — implements BrokerProvider against Alpaca's trading
 * API. Accepts per-user credentials or falls back to env-level keys. Supports
 * both paper and live Alpaca endpoints, determined per-instance.
 */
import { env } from '../../config/env.js';
import type {
  BrokerAccount,
  BrokerOrder,
  BrokerOrderResult,
  BrokerPosition,
  BrokerProvider,
} from './broker.types.js';

export class AlpacaBroker implements BrokerProvider {
  readonly name = 'alpaca';
  private readonly _keyId: string;
  private readonly _secret: string;
  private readonly _paper: boolean;

  constructor(credentials?: { keyId: string; secret: string; paper: boolean }) {
    this._keyId = credentials?.keyId ?? env.ALPACA_API_KEY ?? '';
    this._secret = credentials?.secret ?? env.ALPACA_API_SECRET ?? '';
    this._paper = credentials?.paper ?? env.ALPACA_PAPER;
  }

  get mode(): 'paper' | 'live' {
    return this._paper ? 'paper' : 'live';
  }

  private tradingBase(): string {
    return this._paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  }

  private headers(): Record<string, string> {
    return {
      'APCA-API-KEY-ID': this._keyId,
      'APCA-API-SECRET-KEY': this._secret,
      Accept: 'application/json',
    };
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.tradingBase()}${path}`, {
      ...init,
      headers: { ...this.headers(), 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Alpaca broker ${res.status}: ${body.slice(0, 200)}`);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    const side = order.side === 'LONG' ? 'buy' : 'sell';
    const body: Record<string, unknown> = {
      symbol: order.symbol,
      qty: order.qty,
      side,
      type: order.type,
      time_in_force: 'day',
      client_order_id: order.clientOrderId,
    };
    if (order.type === 'limit') body.limit_price = order.limitPrice;
    if (order.stopLoss != null && order.takeProfit != null) {
      body.order_class = 'bracket';
      body.stop_loss = { stop_price: order.stopLoss };
      body.take_profit = { limit_price: order.takeProfit };
    }

    const r = await this.req<{ id: string; status: string; filled_avg_price?: string; filled_qty?: string }>(
      '/v2/orders',
      { method: 'POST', body: JSON.stringify(body) },
    );
    return {
      brokerOrderId: r.id,
      status: r.status === 'filled' ? 'filled' : r.status === 'rejected' ? 'rejected' : 'accepted',
      filledPrice: r.filled_avg_price ? Number(r.filled_avg_price) : undefined,
      filledQty: r.filled_qty ? Number(r.filled_qty) : undefined,
    };
  }

  async cancelOrder(brokerOrderId: string): Promise<void> {
    await this.req<void>(`/v2/orders/${brokerOrderId}`, { method: 'DELETE' });
  }

  async closePosition(symbol: string): Promise<number | null> {
    try {
      const r = await this.req<{ filled_avg_price?: string }>(
        `/v2/positions/${encodeURIComponent(symbol)}`,
        { method: 'DELETE' },
      );
      return r?.filled_avg_price ? Number(r.filled_avg_price) : null;
    } catch {
      return null;
    }
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const rows = await this.req<
      Array<{ symbol: string; qty: string; avg_entry_price: string; side: string; current_price?: string; unrealized_pl?: string }>
    >('/v2/positions');
    return rows.map((p) => ({
      symbol: p.symbol,
      qty: Number(p.qty),
      avgEntryPrice: Number(p.avg_entry_price),
      side: p.side === 'short' ? 'SHORT' : 'LONG',
      currentPrice: p.current_price != null ? Number(p.current_price) : undefined,
      unrealizedPnl: p.unrealized_pl != null ? Number(p.unrealized_pl) : undefined,
    }));
  }

  async getAccount(): Promise<BrokerAccount> {
    const a = await this.req<{ cash: string; equity: string; buying_power: string }>('/v2/account');
    return { cash: Number(a.cash), equity: Number(a.equity), buyingPower: Number(a.buying_power) };
  }
}
