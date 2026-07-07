'use client';

import { cn } from '@/lib/utils';

const ITEMS = [
  { sym: 'BTC', price: '$67,234', chg: '+2.34%', up: true },
  { sym: 'ETH', price: '$3,891', chg: '-0.82%', up: false },
  { sym: 'AAPL', price: '$192.44', chg: '+1.23%', up: true },
  { sym: 'TSLA', price: '$248.90', chg: '-3.11%', up: false },
  { sym: 'NVDA', price: '$875.30', chg: '+4.56%', up: true },
  { sym: 'SPY', price: '$521.89', chg: '+0.67%', up: true },
  { sym: 'SOL', price: '$142.88', chg: '+5.43%', up: true },
  { sym: 'MSFT', price: '$414.67', chg: '-0.34%', up: false },
  { sym: 'AMZN', price: '$185.50', chg: '+0.91%', up: true },
  { sym: 'QQQ', price: '$447.23', chg: '+1.02%', up: true },
  { sym: 'DOGE', price: '$0.1634', chg: '+8.21%', up: true },
  { sym: 'GOOG', price: '$176.30', chg: '+0.55%', up: true },
] as const;

const DOUBLED = [...ITEMS, ...ITEMS];

export function DataTicker({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        !compact && 'ticker-wrap border-b border-border bg-surface/90 backdrop-blur-md',
      )}
      aria-label="Market ticker"
      aria-live="off"
    >
      <div
        className={cn(
          'ticker-track flex w-max items-center',
          compact ? 'py-1' : 'py-2.5',
        )}
      >
        {DOUBLED.map((item, i) => (
          <span
            key={`${item.sym}-${i}`}
            className={cn(
              'flex shrink-0 items-center border-r border-border font-mono tabular-nums',
              compact ? 'gap-2 px-4 text-xs' : 'gap-3 px-6 text-sm sm:px-8',
            )}
          >
            <span className="font-bold text-teal">{item.sym}</span>
            <span className="text-ink-secondary">{item.price}</span>
            <span className={cn('font-semibold', item.up ? 'text-positive' : 'text-negative')}>
              {item.chg}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
