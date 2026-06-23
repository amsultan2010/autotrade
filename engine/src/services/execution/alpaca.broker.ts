/**
 * Alpaca broker provider — implements BrokerProvider against Alpaca's trading
 * API (paper or live, selected per-user via stored credentials). This is the
 * execution seam for real orders; the internal simulator is used when no broker
 * is connected. Live trading requires explicit user opt-in and live API keys.
 */
import { env } from '../../config/env';
import type {
  BrokerAccount,
  BrokerOrder,
  BrokerOrderResult,
  BrokerPosition,
  BrokerProvider,
} from './broker.types';

type AlpacaOrderResponse = {
  id: string;
  status: string;
  filled_avg_price?: string;
  filled_qty?: string;
};

function trimCredential(value: string | undefined): string {
  return (value ?? '').trim();
}

export class AlpacaBroker implements BrokerProvider {
  readonly name = 'alpaca';
  private readonly _keyId: string;
  private readonly _secret: string;
  private readonly _paper: boolean;

  constructor(credentials?: { keyId: string; secret: string; paper: boolean }) {
    this._keyId = trimCredential(credentials?.keyId ?? env.ALPACA_API_KEY);
    this._secret = trimCredential(credentials?.secret ?? env.ALPACA_API_SECRET);
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

  private mapOrderResult(r: AlpacaOrderResponse): BrokerOrderResult {
    return {
      brokerOrderId: r.id,
      status:
        r.status === 'filled' ? 'filled' : r.status === 'rejected' || r.status === 'canceled' ? 'rejected' : 'accepted',
      filledPrice: r.filled_avg_price ? Number(r.filled_avg_price) : undefined,
      filledQty: r.filled_qty ? Number(r.filled_qty) : undefined,
    };
  }

  async getOrder(brokerOrderId: string): Promise<BrokerOrderResult> {
    const r = await this.req<AlpacaOrderResponse>(`/v2/orders/${brokerOrderId}`);
    return this.mapOrderResult(r);
  }

  /** Poll until a market order fills or times out (Alpaca often returns accepted first). */
  private async waitForFill(orderId: string, maxMs = 8_000): Promise<BrokerOrderResult> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const result = await this.getOrder(orderId);
      if (result.status === 'filled' || result.status === 'rejected') return result;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return this.getOrder(orderId);
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
    // Attach a bracket (stop + target) when both are provided.
    if (order.stopLoss != null && order.takeProfit != null) {
      body.order_class = 'bracket';
      body.stop_loss = { stop_price: order.stopLoss };
      body.take_profit = { limit_price: order.takeProfit };
    }

    const r = await this.req<AlpacaOrderResponse>('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (order.type === 'market' && r.status !== 'filled' && r.status !== 'rejected' && r.status !== 'canceled') {
      return this.waitForFill(r.id);
    }
    return this.mapOrderResult(r);
  }

  async cancelOrder(brokerOrderId: string): Promise<void> {
    await this.req<void>(`/v2/orders/${brokerOrderId}`, { method: 'DELETE' });
  }

  async closePosition(symbol: string): Promise<number | null> {
    try {
      const r = await this.req<AlpacaOrderResponse>(
        `/v2/positions/${encodeURIComponent(symbol)}`,
        { method: 'DELETE' },
      );
      if (!r?.id) return r?.filled_avg_price ? Number(r.filled_avg_price) : null;

      if (r.filled_avg_price) return Number(r.filled_avg_price);

      const filled = await this.waitForFill(r.id, 10_000);
      return filled.filledPrice ?? null;
    } catch {
      return null;
    }
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const rows = await this.req<
      Array<{
        symbol: string;
        qty: string;
        avg_entry_price: string;
        side: string;
        current_price?: string;
        market_value?: string;
        unrealized_pl?: string;
        unrealized_plpc?: string;
      }>
    >('/v2/positions');
    return rows.map((p) => ({
      symbol: p.symbol,
      qty: Number(p.qty),
      avgEntryPrice: Number(p.avg_entry_price),
      side: p.side === 'short' ? 'SHORT' : 'LONG',
      currentPrice: p.current_price != null ? Number(p.current_price) : undefined,
      marketValue: p.market_value != null ? Number(p.market_value) : undefined,
      unrealizedPnl: p.unrealized_pl != null ? Number(p.unrealized_pl) : undefined,
      unrealizedPnlPct: p.unrealized_plpc != null ? Number(p.unrealized_plpc) * 100 : undefined,
    }));
  }

  async getAccount(): Promise<BrokerAccount> {
    const a = await this.req<{
      cash: string;
      equity: string;
      buying_power: string;
      last_equity?: string;
    }>('/v2/account');
    return {
      cash: Number(a.cash),
      equity: Number(a.equity),
      buyingPower: Number(a.buying_power),
      lastEquity: a.last_equity != null ? Number(a.last_equity) : undefined,
    };
  }
}

/** Verify Alpaca API keys against paper or live trading endpoint. */
export async function verifyAlpacaCredentials(
  keyId: string,
  secret: string,
  paper: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const base = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  const trimmedKey = trimCredential(keyId);
  const trimmedSecret = trimCredential(secret);
  if (!trimmedKey || !trimmedSecret) {
    return { ok: false, error: 'API key and secret are required' };
  }
  try {
    const res = await fetch(`${base}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': trimmedKey,
        'APCA-API-SECRET-KEY': trimmedSecret,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'Invalid API keys' };
    if (!res.ok) return { ok: false, error: `Alpaca returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach Alpaca — check your internet connection' };
  }
}
