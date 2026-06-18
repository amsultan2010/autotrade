/**
 * Curated "popular tickers" shown when the watchlist search bar is focused but
 * empty — a quick browse list of liquid stocks/ETFs plus 24/7 crypto.
 */
export interface PopularTicker {
  symbol: string;
  name: string;
  kind: 'stock' | 'crypto';
}

export const POPULAR_TICKERS: PopularTicker[] = [
  // Mega-cap tech
  { symbol: 'AAPL', name: 'Apple', kind: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft', kind: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'stock' },
  { symbol: 'AMZN', name: 'Amazon', kind: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', kind: 'stock' },
  { symbol: 'META', name: 'Meta Platforms', kind: 'stock' },
  { symbol: 'TSLA', name: 'Tesla', kind: 'stock' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', kind: 'stock' },
  { symbol: 'NFLX', name: 'Netflix', kind: 'stock' },
  { symbol: 'AVGO', name: 'Broadcom', kind: 'stock' },
  // Popular names
  { symbol: 'JPM', name: 'JPMorgan Chase', kind: 'stock' },
  { symbol: 'V', name: 'Visa', kind: 'stock' },
  { symbol: 'DIS', name: 'Walt Disney', kind: 'stock' },
  { symbol: 'BA', name: 'Boeing', kind: 'stock' },
  { symbol: 'INTC', name: 'Intel', kind: 'stock' },
  { symbol: 'COIN', name: 'Coinbase', kind: 'stock' },
  // ETFs
  { symbol: 'SPY', name: 'S&P 500 ETF', kind: 'stock' },
  { symbol: 'QQQ', name: 'Nasdaq-100 ETF', kind: 'stock' },
  // Crypto (24/7)
  { symbol: 'BTC/USD', name: 'Bitcoin', kind: 'crypto' },
  { symbol: 'ETH/USD', name: 'Ethereum', kind: 'crypto' },
  { symbol: 'SOL/USD', name: 'Solana', kind: 'crypto' },
  { symbol: 'DOGE/USD', name: 'Dogecoin', kind: 'crypto' },
  { symbol: 'AVAX/USD', name: 'Avalanche', kind: 'crypto' },
  { symbol: 'LTC/USD', name: 'Litecoin', kind: 'crypto' },
];
