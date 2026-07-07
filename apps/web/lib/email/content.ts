/** Copy and rotating content for Autotrade transactional emails. */

export type DigestItem = {
  kind: 'feature' | 'tip';
  title: string;
  body: string;
  accent: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export const WEEKLY_DIGEST_ITEMS: DigestItem[] = [
  {
    kind: 'feature',
    title: 'AI Signal Engine',
    body: 'Autotrade scans thousands of symbols around the clock: momentum shifts, volume spikes, and pattern breaks, then surfaces, volume spikes, and pattern breaks. then surfaces trades only when confidence clears your thresholds.',
    accent: '#00c896',
    ctaLabel: 'Review signals',
    ctaHref: 'https://tryautotrade.com/dashboard',
  },
  {
    kind: 'tip',
    title: 'Start with paper, prove the edge',
    body: 'Every new account ships with $100,000 in simulated capital. Run the bot in paper mode until win rate and drawdown match your risk tolerance, then connect Alpaca for broker-backed execution.',
    accent: '#4facfe',
    ctaLabel: 'Open paper dashboard',
    ctaHref: 'https://tryautotrade.com/dashboard',
  },
  {
    kind: 'feature',
    title: 'Risk guardrails that stick',
    body: 'Set max active trades, per-trade size caps, daily loss limits, and trading-hour windows. The bot will not override your rules, even when the market gets loud.',
    accent: '#fa709a',
    ctaLabel: 'Tune risk settings',
    ctaHref: 'https://tryautotrade.com/settings',
  },
  {
    kind: 'tip',
    title: 'Position sizing beats prediction',
    body: 'Most blown accounts come from oversizing winners, not bad entries. Risk 1-2% of equity per trade and let compounding do the heavy lifting over dozens of signals.',
    accent: '#f0a500',
  },
  {
    kind: 'feature',
    title: 'Watchlist-driven scanning',
    body: 'Your watchlist is the bot\'s radar. Add tickers you understand, set timeframes and strategy presets, and Autotrade focuses compute where you actually want exposure.',
    accent: '#a18cd1',
    ctaLabel: 'Manage watchlist',
    ctaHref: 'https://tryautotrade.com/watchlist',
  },
  {
    kind: 'tip',
    title: 'Cut losses before they compound',
    body: 'A fixed stop-loss on every open position removes emotion from exits. Autotrade applies your default stop % on new trades. Adjust it in Settings to match your style.',
    accent: '#ff3b52',
    ctaLabel: 'Set stop defaults',
    ctaHref: 'https://tryautotrade.com/settings',
  },
  {
    kind: 'feature',
    title: 'Alpaca broker integration',
    body: 'Connect Alpaca once and Autotrade routes orders to paper or live accounts, syncs positions for the dashboard, and streams market data for signal generation.',
    accent: '#00c896',
    ctaLabel: 'Connect Alpaca',
    ctaHref: 'https://tryautotrade.com/settings',
  },
  {
    kind: 'tip',
    title: 'Diversify timeframes, not just tickers',
    body: 'Running the same strategy on 5m and 1h charts can reduce false positives. In Settings, enable multiple timeframes so signals need alignment across horizons.',
    accent: '#4facfe',
    ctaLabel: 'Edit timeframes',
    ctaHref: 'https://tryautotrade.com/settings',
  },
  {
    kind: 'feature',
    title: 'Trade history & attribution',
    body: 'Every fill lands in your history with P&L, strategy tag, and outcome. Use it to see which presets earn their slot on your watchlist.',
    accent: '#f6d365',
    ctaLabel: 'View history',
    ctaHref: 'https://tryautotrade.com/history',
  },
  {
    kind: 'tip',
    title: 'Respect the trading window',
    body: 'Overnight gaps can blow through stops on equities. Keep stock bots inside regular session hours unless you explicitly want extended-hours exposure.',
    accent: '#fd7014',
    ctaLabel: 'Set trading hours',
    ctaHref: 'https://tryautotrade.com/settings',
  },
  {
    kind: 'feature',
    title: 'Live charts in-terminal',
    body: 'Candlesticks, overlays, and signal markers live beside your bot controls, no tab-hopping between a screener and a broker UI.',
    accent: '#4facfe',
    ctaLabel: 'Open charts',
    ctaHref: 'https://tryautotrade.com/charts',
  },
  {
    kind: 'tip',
    title: 'Journal the regime, not just the trade',
    body: 'Trend strategies fail in chop; mean-reversion gets run over in breakouts. Note market regime weekly and disable presets that fight the tape.',
    accent: '#a18cd1',
  },
];

export function getWeeklyDigestItem(forDate: Date = new Date()): DigestItem {
  const start = new Date(forDate.getFullYear(), 0, 1);
  const week = Math.floor((forDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const index = ((week % WEEKLY_DIGEST_ITEMS.length) + WEEKLY_DIGEST_ITEMS.length) % WEEKLY_DIGEST_ITEMS.length;
  return WEEKLY_DIGEST_ITEMS[index]!;
}

export const WELCOME_HOW_IT_WORKS = [
  {
    step: '01',
    title: 'AI scans your watchlist',
    body: 'The engine ingests live prices, volume, and pattern data across the symbols you care about, every five minutes, around the clock.',
  },
  {
    step: '02',
    title: 'Signals fire with context',
    body: 'When confidence clears your thresholds, Autotrade logs a signal with entry, stop, and target levels so you know why a trade was considered.',
  },
  {
    step: '03',
    title: 'Paper trading on day one',
    body: 'You start with $100,000 in simulated capital. Validate the bot\'s behavior before risking real money or connecting a broker.',
  },
  {
    step: '04',
    title: 'Broker execution when ready',
    body: 'Connect Alpaca to route orders to paper or live accounts. Until then, the bot still scans and paper-trades inside Autotrade.',
  },
] as const;

export const ALPACA_WHY_POINTS = [
  {
    title: 'Real order routing',
    body: 'Autotrade does not hold your funds. Alpaca is the regulated broker that receives and fills orders when you leave paper mode.',
  },
  {
    title: 'Paper sandbox included',
    body: 'Alpaca\'s paper account mirrors live API behavior with virtual cash: the safest way to test fills before going live.',
  },
  {
    title: 'Live market data',
    body: 'Quotes and candles for signal generation come through Alpaca\'s data API, keeping scans aligned with what you can actually trade.',
  },
  {
    title: 'Encrypted, server-side only',
    body: 'API keys are encrypted at rest and never sent to the browser. Only Autotrade\'s execution layer uses them.',
  },
] as const;
