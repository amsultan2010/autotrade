'use client';
const ITEMS = [
  { sym: 'BTC',  price: '$67,234', chg: '+2.34%', up: true  },
  { sym: 'ETH',  price: '$3,891',  chg: '-0.82%', up: false },
  { sym: 'AAPL', price: '$192.44', chg: '+1.23%', up: true  },
  { sym: 'TSLA', price: '$248.90', chg: '-3.11%', up: false },
  { sym: 'NVDA', price: '$875.30', chg: '+4.56%', up: true  },
  { sym: 'SPY',  price: '$521.89', chg: '+0.67%', up: true  },
  { sym: 'SOL',  price: '$142.88', chg: '+5.43%', up: true  },
  { sym: 'MSFT', price: '$414.67', chg: '-0.34%', up: false },
  { sym: 'AMZN', price: '$185.50', chg: '+0.91%', up: true  },
  { sym: 'QQQ',  price: '$447.23', chg: '+1.02%', up: true  },
  { sym: 'DOGE', price: '$0.1634', chg: '+8.21%', up: true  },
  { sym: 'GOOG', price: '$176.30', chg: '+0.55%', up: true  },
];

const DOUBLED = [...ITEMS, ...ITEMS];

export function DataTicker({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? 'overflow-hidden' : 'ticker-wrap'}
      aria-label="Market ticker"
    >
      <div className="ticker-track" style={compact ? { padding: '6px 0' } : undefined}>
        {DOUBLED.map((item, i) => (
          <span key={i} className="ticker-item">
            <span className="ticker-sym">{item.sym}</span>
            <span className="ticker-price mono">{item.price}</span>
            <span className={`ticker-chg ${item.up ? 'pos' : 'neg'}`}>{item.chg}</span>
            <span className="ticker-sep" aria-hidden="true">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
