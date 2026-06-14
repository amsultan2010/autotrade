/**
 * Default "recommended" watchlist for new users — liquid US large-caps + broad
 * ETFs that work well with the free Alpaca IEX feed. Kept modest to stay within
 * free-tier symbol/rate limits.
 */
export const DEFAULT_WATCHLIST: Array<{ symbol: string; exchange: string }> = [
  { symbol: 'AAPL', exchange: 'US' },
  { symbol: 'MSFT', exchange: 'US' },
  { symbol: 'NVDA', exchange: 'US' },
  { symbol: 'AMZN', exchange: 'US' },
  { symbol: 'GOOGL', exchange: 'US' },
  { symbol: 'META', exchange: 'US' },
  { symbol: 'TSLA', exchange: 'US' },
  { symbol: 'AMD', exchange: 'US' },
  { symbol: 'SPY', exchange: 'US' }, // S&P 500 ETF
  { symbol: 'QQQ', exchange: 'US' }, // Nasdaq-100 ETF
  // Crypto trades 24/7 — keeps the bot active outside market hours.
  { symbol: 'BTC/USD', exchange: 'CRYPTO' },
  { symbol: 'ETH/USD', exchange: 'CRYPTO' },
];
