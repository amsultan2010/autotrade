/**
 * BrokerProvider — the seam for FUTURE live trading (req #5, #7, #10).
 * No implementation ships in the MVP; live execution must go through a real,
 * licensed broker (Alpaca, IBKR) or an officially supported TradingView webhook.
 * The engines depend on this interface, never on a concrete broker, so live
 * trading is added by writing one adapter — nothing else changes.
 */
import type { TradeSide } from '@autotrade/shared';

export interface BrokerOrder {
  symbol: string;
  side: TradeSide;
  qty: number;
  type: 'market' | 'limit';
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  clientOrderId: string;
}

export interface BrokerOrderResult {
  brokerOrderId: string;
  status: 'accepted' | 'filled' | 'rejected';
  filledPrice?: number;
  filledQty?: number;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  side: TradeSide;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
}

export interface BrokerAccount {
  cash: number;
  equity: number;
  buyingPower: number;
}

export interface BrokerProvider {
  readonly name: string;
  readonly mode: 'paper' | 'live';
  submitOrder(order: BrokerOrder): Promise<BrokerOrderResult>;
  cancelOrder(brokerOrderId: string): Promise<void>;
  /** Close an open position by symbol at market. Returns the exit price, or null on failure. */
  closePosition(symbol: string): Promise<number | null>;
  getPositions(): Promise<BrokerPosition[]>;
  getAccount(): Promise<BrokerAccount>;
}
