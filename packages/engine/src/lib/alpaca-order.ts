/** Helpers for Alpaca order submission (symbol format, price/qty rounding). */

export function isCryptoOrderSymbol(symbol: string): boolean {
  return symbol.includes('/');
}

/** Round prices to Alpaca-accepted precision (2dp stocks, up to 8dp crypto). */
export function roundAlpacaPrice(price: number, crypto: boolean): number {
  const factor = crypto ? 1e8 : 1e2;
  return Math.round(price * factor) / factor;
}

/** Ensure qty meets Alpaca minimum notional (~$1) and precision. */
export function normalizeAlpacaQty(qty: number, price: number, crypto: boolean): number {
  if (!(qty > 0) || !(price > 0)) return qty;
  let normalized = crypto ? Math.floor(qty * 1e8) / 1e8 : Math.floor(qty * 1e4) / 1e4;
  const minNotional = 1;
  if (normalized * price < minNotional) {
    normalized = crypto
      ? Math.ceil((minNotional / price) * 1e8) / 1e8
      : Math.ceil((minNotional / price) * 1e4) / 1e4;
  }
  return normalized;
}
