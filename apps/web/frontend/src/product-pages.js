import { createChart, CrosshairMode } from 'lightweight-charts';
import {
  api,
  appShell,
  badge,
  createPoll,
  dateTime,
  debounce,
  emptyState,
  escapeHtml,
  icon,
  money,
  mutate,
  pageHeader,
  panel,
  percent,
  presets,
  skeleton,
  state,
  stat,
  statusTone,
  toast,
  updateGlobalBotStatus,
} from './core.js';

function signed(value) {
  const amount = Number(value ?? 0);
  return `${amount >= 0 ? '+' : ''}${money(amount)}`;
}

function change(value) {
  const amount = Number(value ?? 0);
  return `<span class="${amount >= 0 ? 'text-positive' : 'text-negative'}">${amount >= 0 ? '+' : ''}${percent(amount)}</span>`;
}

function svgLine(values = [], color = '#00c896') {
  if (values.length < 2) return '<div class="empty-state"><p>More data is needed to draw this view.</p></div>';
  const width = 900;
  const height = 280;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 24) - 12;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Equity trend" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible">
      <defs><linearGradient id="equity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <polyline points="${points} ${width},${height} 0,${height}" fill="url(#equity-fill)" stroke="none"/>
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

function bindButton(selector, handler) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.addEventListener('click', handler);
}

function barMeter(value, max = 100, tone = 'positive') {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
  return `<div class="meter"><span class="meter__fill meter__fill--${tone}" style="width:${pct.toFixed(1)}%"></span></div>`;
}

function sparkBars(rows = [], key = 'totalPnl') {
  if (!rows.length) return '';
  const values = rows.map((row) => Math.abs(Number(row[key] ?? 0)));
  const max = Math.max(...values, 1);
  return `<div class="spark-bars">${rows.slice(0, 8).map((row) => {
    const amount = Number(row[key] ?? 0);
    const height = Math.max(8, (Math.abs(amount) / max) * 100);
    return `<div class="spark-bars__item" title="${escapeHtml(row.key)}"><span style="height:${height}%" class="${amount >= 0 ? 'is-up' : 'is-down'}"></span><small>${escapeHtml(String(row.key).slice(0, 8))}</small></div>`;
  }).join('')}</div>`;
}

export function dashboardPage() {
  const body = `
    ${pageHeader('Dashboard', 'Overview', 'Portfolio, signals, risk, and the control that starts or stops the bot.',
      '<button class="button button--primary" type="button" id="bot-toggle" data-tour="bot-controls" disabled><span>Checking bot</span></button>')}
    <div id="dashboard-alerts"></div>
    <section class="stats-grid stats-grid--dense" id="dashboard-stats">${Array.from({ length: 8 }, () => stat('Loading', '—')).join('')}</section>
    <div class="content-grid" data-tour="dashboard">
      <div class="span-8" id="portfolio-panel">${panel({ eyebrow: 'Portfolio', title: 'Equity', content: '<div class="chart-frame">' + skeleton(3) + '</div>', attrs: 'data-tour="portfolio"' })}</div>
      <div class="span-4" id="bot-panel">${panel({ eyebrow: 'Bot', title: 'Status', content: skeleton(4) })}</div>
      <div class="span-4" id="signals-panel">${panel({ eyebrow: 'Signals', title: 'Latest signals', content: skeleton(4), attrs: 'data-tour="signals"' })}</div>
      <div class="span-4" id="pnl-panel">${panel({ eyebrow: 'P&L', title: 'Period returns', content: skeleton(3) })}</div>
      <div class="span-4" id="risk-panel">${panel({ eyebrow: 'Risk', title: 'Exposure snapshot', content: skeleton(3) })}</div>
      <div class="span-7" id="positions-panel">${panel({ eyebrow: 'Positions', title: 'Open positions', className: 'panel--flush', content: skeleton(4) })}</div>
      <div class="span-5" id="heatmap-panel">${panel({ eyebrow: 'Watchlist', title: 'Market map', content: skeleton(3) })}</div>
      <div class="span-6" id="strategy-panel">${panel({ eyebrow: 'Analytics', title: 'By strategy', content: skeleton(3) })}</div>
      <div class="span-6" id="symbol-panel">${panel({ eyebrow: 'Analytics', title: 'By symbol', content: skeleton(3) })}</div>
      <div class="span-12" id="recent-panel">${panel({ eyebrow: 'History', title: 'Recent closed trades', className: 'panel--flush', content: skeleton(4) })}</div>
    </div>`;
  return {
    title: 'Dashboard - Autotrade',
    html: appShell('/dashboard', body, { wide: true }),
    mount() {
      let feed;
      let period = '1M';
      let portfolioValues = [];

      const renderPortfolio = () => {
        const snapshot = feed?.brokerSnapshot;
        const fallback = feed?.botStatus?.paperAccount;
        const equity = snapshot?.equity ?? fallback?.equity ?? 0;
        const series = portfolioValues;
        document.querySelector('#portfolio-panel').innerHTML = panel({
          eyebrow: snapshot ? 'Alpaca portfolio' : 'Paper simulator',
          title: equity ? money(equity) : 'No portfolio data',
          attrs: 'data-tour="portfolio"',
          actions: `<div class="segmented" role="tablist" aria-label="Equity period">${['1D', '1W', '1M', '3M', '1Y'].map((item) => `<button type="button" class="${item === period ? 'is-active' : ''}" data-period="${item}">${item}</button>`).join('')}</div>`,
          content: `<div class="chart-frame">${svgLine(series, !series.length || series.at(-1) >= series[0] ? '#00c896' : '#ff3b52')}</div>`,
        });
        document.querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', async () => {
          period = button.dataset.period;
          document.querySelectorAll('[data-period]').forEach((item) => item.classList.toggle('is-active', item.dataset.period === period));
          if (feed?.brokerStatus?.connected) {
            const result = await api(`/broker/portfolio-history?tab=${period}`).catch(() => null);
            portfolioValues = result?.equity ?? [];
          }
          renderPortfolio();
        }));
      };

      const render = (data) => {
        feed = data;
        const bot = data.botStatus ?? {};
        updateGlobalBotStatus(bot);
        const perf = data.performance?.summary ?? {};
        const snapshot = data.brokerSnapshot;
        const paper = bot.paperAccount;
        const equity = snapshot?.equity ?? paper?.equity ?? 0;
        const cash = snapshot?.cash ?? paper?.balance ?? 0;
        const positions = snapshot?.positions?.length ? snapshot.positions : data.openTrades ?? [];
        const closed = data.closedTrades ?? data.trades?.filter((trade) => trade.result !== 'OPEN') ?? [];
        const signals = data.signals ?? [];
        const quotes = data.quotes ?? [];
        const byStrategy = data.performance?.breakdowns?.byStrategy ?? [];
        const bySymbol = data.performance?.breakdowns?.bySymbol ?? [];
        const advanced = state.entitlements?.limits?.advancedAnalytics;
        const exposure = positions.reduce((sum, position) => sum + Math.abs(Number(position.marketValue ?? (Number(position.qty) * Number(position.currentPrice ?? position.entryPrice ?? position.avgEntryPrice ?? 0)) ?? 0)), 0);
        const unrealized = positions.reduce((sum, position) => sum + Number(position.unrealizedPnl ?? position.pnl ?? 0), 0);

        const toggle = document.querySelector('#bot-toggle');
        toggle.disabled = false;
        toggle.className = `button ${bot.running ? 'button--danger' : 'button--primary'}`;
        toggle.innerHTML = `<span>${bot.running ? 'Stop bot' : 'Start bot'}</span>${icon(bot.running ? 'stop' : 'play')}`;
        toggle.dataset.running = String(Boolean(bot.running));

        document.querySelector('#dashboard-stats').innerHTML = [
          stat('Net equity', equity ? money(equity) : '—', snapshot ? 'Alpaca account' : 'Paper simulator'),
          stat('Available cash', cash ? money(cash) : '—', bot.mode ?? 'DISABLED'),
          stat('Win rate', percent(perf.winRate), `${perf.wins ?? 0}W / ${perf.losses ?? 0}L`),
          stat('All-time P&L', signed(perf.totalPnl), `${perf.totalTrades ?? 0} closed`, Number(perf.totalPnl) >= 0 ? 'positive' : 'negative'),
          stat('Today', signed(perf.dailyPnl), 'Closed P&L', Number(perf.dailyPnl) >= 0 ? 'positive' : 'negative'),
          stat('This week', signed(perf.weeklyPnl), 'Closed P&L', Number(perf.weeklyPnl) >= 0 ? 'positive' : 'negative'),
          stat('This month', signed(perf.monthlyPnl), 'Closed P&L', Number(perf.monthlyPnl) >= 0 ? 'positive' : 'negative'),
          stat('Max drawdown', signed(-Math.abs(perf.maxDrawdown ?? 0)), `${perf.openTrades ?? 0} open`, 'negative'),
        ].join('');

        const alerts = [];
        if (!bot.running) alerts.push('<div class="alert">The bot is stopped. Start it when your watchlist and limits are ready.</div>');
        if (data.brokerStatus?.connected && snapshot?.syncError) alerts.push(`<div class="alert alert--danger">${escapeHtml(snapshot.syncError)}</div>`);
        if (!data.brokerStatus?.connected) alerts.push('<div class="alert">Using the built-in paper simulator. Connect Alpaca in Settings when you want broker-backed paper trading.</div>');
        document.querySelector('#dashboard-alerts').innerHTML = alerts.join('');

        renderPortfolio();

        document.querySelector('#bot-panel').innerHTML = panel({
          eyebrow: 'Bot',
          title: bot.running ? 'Running' : 'Stopped',
          content: `
            <div class="metric-inline">
              <span>Mode <strong>${escapeHtml(bot.mode ?? 'DISABLED')}</strong></span>
              <span>Open <strong>${positions.length}</strong></span>
              <span>Signals <strong>${signals.length}</strong></span>
            </div>
            <div class="data-list" style="margin-top:20px">
              <div class="data-row"><div><strong>Paper trades used</strong><span>Against plan allowance</span></div><span></span><strong>${bot.paperTradesUsed ?? 0}${bot.paperTradesLimit ? ` / ${bot.paperTradesLimit}` : ''}</strong></div>
              <div class="data-row"><div><strong>Broker</strong><span>${data.brokerStatus?.connected ? 'Connected' : 'Simulator'}</span></div><span></span>${badge(data.brokerStatus?.connected ? 'Connected' : 'Paper')}</div>
              <div class="data-row"><div><strong>Live entitled</strong><span>Plan gate</span></div><span></span>${badge(bot.entitled || state.entitlements?.liveEntitled ? 'Yes' : 'No')}</div>
            </div>`,
        });

        document.querySelector('#signals-panel').innerHTML = panel({
          eyebrow: 'Signals',
          title: 'Latest signals',
          attrs: 'data-tour="signals"',
          content: signals.length ? `<div class="signal-list">${signals.slice(0, 8).map((signal) => `
            <article class="signal-row">
              <div class="signal-row__main"><strong>${escapeHtml(signal.ticker)}</strong><span>${escapeHtml(signal.strategy)}</span></div>
              ${badge(signal.action, statusTone(signal.action))}
              <div class="signal-row__conf"><strong class="mono">${percent(signal.confidence, 0)}</strong>${barMeter(signal.confidence, 100, Number(signal.confidence) >= 65 ? 'positive' : 'neutral')}</div>
            </article>`).join('')}</div>` : emptyState('No signals yet', 'Start the bot to scan your watchlist for approved setups.'),
        });

        document.querySelector('#pnl-panel').innerHTML = panel({
          eyebrow: 'P&L',
          title: 'Period returns',
          content: `
            <div class="pnl-stack">
              <div><span>Daily</span><strong class="${Number(perf.dailyPnl) >= 0 ? 'text-positive' : 'text-negative'}">${signed(perf.dailyPnl)}</strong>${barMeter(Math.abs(perf.dailyPnl ?? 0), Math.max(Math.abs(perf.monthlyPnl ?? 0), Math.abs(perf.dailyPnl ?? 0), 1), Number(perf.dailyPnl) >= 0 ? 'positive' : 'negative')}</div>
              <div><span>Weekly</span><strong class="${Number(perf.weeklyPnl) >= 0 ? 'text-positive' : 'text-negative'}">${signed(perf.weeklyPnl)}</strong>${barMeter(Math.abs(perf.weeklyPnl ?? 0), Math.max(Math.abs(perf.monthlyPnl ?? 0), Math.abs(perf.weeklyPnl ?? 0), 1), Number(perf.weeklyPnl) >= 0 ? 'positive' : 'negative')}</div>
              <div><span>Monthly</span><strong class="${Number(perf.monthlyPnl) >= 0 ? 'text-positive' : 'text-negative'}">${signed(perf.monthlyPnl)}</strong>${barMeter(Math.abs(perf.monthlyPnl ?? 0), Math.max(Math.abs(perf.monthlyPnl ?? 0), 1), Number(perf.monthlyPnl) >= 0 ? 'positive' : 'negative')}</div>
            </div>
            <div class="metric-inline" style="margin-top:20px"><span>Wins <strong class="text-positive">${perf.wins ?? 0}</strong></span><span>Losses <strong class="text-negative">${perf.losses ?? 0}</strong></span><span>Open <strong>${perf.openTrades ?? 0}</strong></span></div>`,
        });

        document.querySelector('#risk-panel').innerHTML = panel({
          eyebrow: 'Risk',
          title: 'Exposure snapshot',
          content: `
            <div class="data-list">
              <div class="data-row"><div><strong>Open exposure</strong><span>Marked positions</span></div><span></span><strong>${money(exposure)}</strong></div>
              <div class="data-row"><div><strong>Unrealized P&L</strong><span>Open book</span></div><span></span><strong class="${unrealized >= 0 ? 'text-positive' : 'text-negative'}">${signed(unrealized)}</strong></div>
              <div class="data-row"><div><strong>Max drawdown</strong><span>Closed equity path</span></div><span></span><strong class="text-negative">${signed(-Math.abs(perf.maxDrawdown ?? 0))}</strong></div>
              <div class="data-row"><div><strong>Cash ratio</strong><span>Cash / equity</span></div><span></span><strong>${equity ? percent((cash / equity) * 100, 0) : '—'}</strong></div>
            </div>
            ${barMeter(equity ? (exposure / equity) * 100 : 0, 100, exposure / Math.max(equity, 1) > 0.7 ? 'negative' : 'positive')}`,
        });

        document.querySelector('#positions-panel').innerHTML = panel({
          eyebrow: 'Positions',
          title: 'Open positions',
          className: 'panel--flush',
          content: positions.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Symbol</th><th>Side</th><th>Quantity</th><th>Entry</th><th>Value</th><th>Unrealized</th></tr></thead><tbody>${positions.map((position) => {
            const entry = position.avgEntryPrice ?? position.entryPrice;
            const value = position.marketValue ?? (Number(position.qty) * Number(position.currentPrice ?? entry));
            const pnl = position.unrealizedPnl ?? position.pnl ?? 0;
            return `<tr><td class="symbol">${escapeHtml(position.symbol)}</td><td>${badge(position.side)}</td><td>${escapeHtml(position.qty)}</td><td>${money(entry)}</td><td>${money(value)}</td><td class="${pnl >= 0 ? 'text-positive' : 'text-negative'}">${signed(pnl)}</td></tr>`;
          }).join('')}</tbody></table></div>` : emptyState('No open positions', 'Approved paper or live orders will appear here.'),
        });

        document.querySelector('#heatmap-panel').innerHTML = panel({
          eyebrow: 'Watchlist',
          title: 'Market map',
          content: quotes.length ? `<div class="heatmap">${quotes.slice(0, 12).map((quote) => `<div class="heatmap__item" style="--tone:${Number(quote.changePct) >= 0 ? 'var(--teal)' : 'var(--red)'};--strength:${Math.min(Math.abs(Number(quote.changePct)) * 7 + 7, 30)}%"><strong>${escapeHtml(quote.symbol)}</strong><span>${quote.changePct == null ? '—' : `${Number(quote.changePct) >= 0 ? '+' : ''}${percent(quote.changePct)}`}</span></div>`).join('')}</div>` : emptyState('Watchlist is empty', 'Add symbols to see price movement here.', '<a class="text-link" href="/watchlist" data-link>Manage watchlist</a>'),
        });

        const strategyContent = advanced
          ? (byStrategy.length
            ? `${sparkBars(byStrategy)}<div class="data-list" style="margin-top:18px">${byStrategy.slice(0, 6).map((row) => `<div class="data-row"><div><strong>${escapeHtml(row.key)}</strong><span>${row.trades} trades · ${percent(row.winRate)} win</span></div><span></span><strong class="${row.totalPnl >= 0 ? 'text-positive' : 'text-negative'}">${signed(row.totalPnl)}</strong></div>`).join('')}</div>`
            : emptyState('No strategy history yet', 'Closed trades will show up here.'))
          : `<div class="empty-state"><span class="empty-state__line"></span><h3>Advanced analytics</h3><p>Strategy and symbol breakdowns unlock on Pro or Unlimited.</p><button class="button button--outline" type="button" data-upgrade><span>Compare plans</span>${icon('lock')}</button></div>`;

        document.querySelector('#strategy-panel').innerHTML = panel({
          eyebrow: 'Analytics',
          title: 'By strategy',
          content: strategyContent,
        });

        document.querySelector('#symbol-panel').innerHTML = panel({
          eyebrow: 'Analytics',
          title: 'By symbol',
          content: advanced
            ? (bySymbol.length
              ? `${sparkBars(bySymbol)}<div class="data-list" style="margin-top:18px">${bySymbol.slice(0, 6).map((row) => `<div class="data-row"><div><strong>${escapeHtml(row.key)}</strong><span>${row.trades} trades · ${percent(row.winRate)} win</span></div><span></span><strong class="${row.totalPnl >= 0 ? 'text-positive' : 'text-negative'}">${signed(row.totalPnl)}</strong></div>`).join('')}</div>`
              : emptyState('No symbol history yet', 'Closed trades will show up here.'))
            : `<div class="empty-state"><span class="empty-state__line"></span><h3>Symbol breakdown</h3><p>See which tickers drive P&L on Pro or Unlimited.</p><button class="button button--outline" type="button" data-upgrade><span>Compare plans</span>${icon('lock')}</button></div>`,
        });

        document.querySelector('#recent-panel').innerHTML = panel({
          eyebrow: 'History',
          title: 'Recent closed trades',
          className: 'panel--flush',
          actions: '<a class="text-link" href="/history" data-link>Open history</a>',
          content: closed.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Symbol</th><th>Result</th><th>Side</th><th>Strategy</th><th>P&L</th><th>Closed</th></tr></thead><tbody>${closed.slice(0, 8).map((trade) => `<tr><td class="symbol">${escapeHtml(trade.symbol)}</td><td>${badge(trade.result)}</td><td>${escapeHtml(trade.side)}</td><td>${escapeHtml(trade.strategy)}</td><td class="${Number(trade.pnl) >= 0 ? 'text-positive' : 'text-negative'}">${trade.pnl == null ? '—' : signed(trade.pnl)}</td><td>${dateTime(trade.closedAt)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No closed trades yet', 'Wins and losses will land here after exits.'),
        });

        window.autotrade?.bindLinks?.();
        window.autotrade?.bindUpgrade?.();
      };

      createPoll('/dashboard/feed?signalsLimit=12&tradesLimit=200&openLimit=100&closedLimit=200', 45_000, render, (error) => {
        document.querySelector('#dashboard-alerts').innerHTML = `<div class="alert alert--danger">${escapeHtml(error.message)}</div>`;
      });
      bindButton('#bot-toggle', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await mutate('/bot-settings/mode', 'POST', { mode: button.dataset.running === 'true' ? 'DISABLED' : 'PAPER' });
          toast(button.dataset.running === 'true' ? 'Bot stopped' : 'Bot started in paper mode', 'positive');
          const updated = await api('/dashboard/feed?signalsLimit=12&tradesLimit=200&openLimit=100&closedLimit=200');
          render(updated);
        } catch (error) {
          toast(error.message, 'negative');
          button.disabled = false;
        }
      });
    },
  };
}

export function watchlistPage() {
  const body = `
    ${pageHeader('Watchlist', 'Your symbols', 'The bot only scans symbols you add here.',
      `<div class="search-box" data-tour="watchlist-search">${icon('search')}<input id="symbol-search" class="input" type="search" placeholder="Search stocks or crypto" autocomplete="off" aria-label="Search stocks or crypto" aria-expanded="false" /><div id="search-results"></div></div>`)}
    <section class="stats-grid stats-grid--three" id="watchlist-stats">${stat('Symbols', '—')}${stat('Stocks', '—')}${stat('Crypto', '—')}</section>
    <div id="watchlist-content">${panel({ title: 'Approved symbols', content: skeleton(6) })}</div>`;
  return {
    title: 'Watchlist - Autotrade',
    html: appShell('/watchlist', body),
    mount() {
      let items = [];
      let prices = {};
      const render = () => {
        const stocks = items.filter((item) => !String(item.exchange).toLowerCase().includes('crypto'));
        document.querySelector('#watchlist-stats').innerHTML =
          stat('Symbols', String(items.length), 'Total approved') +
          stat('Stocks', String(stocks.length), 'US market hours') +
          stat('Crypto', String(items.length - stocks.length), 'Around the clock');
        document.querySelector('#watchlist-content').innerHTML = panel({
          eyebrow: 'Watchlist',
          title: 'Approved symbols',
          className: 'panel--flush',
          content: items.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Symbol</th><th>Exchange</th><th>Last price</th><th>Change</th><th>Added</th><th></th></tr></thead><tbody>${items.map((item) => {
            const quote = prices[item.symbol] ?? {};
            return `<tr><td class="symbol">${escapeHtml(item.symbol)}</td><td>${escapeHtml(item.exchange)}</td><td>${quote.price == null ? '—' : money(quote.price)}</td><td>${quote.changePct == null ? '—' : change(quote.changePct)}</td><td>${dateTime(item.addedAt)}</td><td><button class="table-action" type="button" data-remove="${escapeHtml(item._id)}" aria-label="Remove ${escapeHtml(item.symbol)}">Remove</button></td></tr>`;
          }).join('')}</tbody></table></div>` : emptyState('Your watchlist is empty', 'Search for a stock or crypto symbol above. The bot will only scan symbols you add.'),
        });
        document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await mutate(`/watchlist?id=${encodeURIComponent(button.dataset.remove)}`, 'DELETE');
            items = items.filter((item) => item._id !== button.dataset.remove);
            render();
            toast('Symbol removed', 'positive');
          } catch (error) {
            toast(error.message, 'negative');
            button.disabled = false;
          }
        }));
      };
      const refreshQuotes = async () => {
        if (!items.length) return;
        const result = await api(`/watchlist/quotes?symbols=${encodeURIComponent(items.map((item) => item.symbol).join(','))}`).catch(() => []);
        prices = Object.fromEntries((result ?? []).map((item) => [item.symbol, item]));
        render();
      };
      createPoll('/watchlist', 30_000, async (data) => {
        items = data ?? [];
        render();
        await refreshQuotes();
      }, (error) => {
        document.querySelector('#watchlist-content').innerHTML = `<div class="alert alert--danger">${escapeHtml(error.message)}</div>`;
      });

      const input = document.querySelector('#symbol-search');
      const resultsRoot = document.querySelector('#search-results');
      const showResults = (results) => {
        input.setAttribute('aria-expanded', String(Boolean(results.length)));
        resultsRoot.innerHTML = results.length ? `<div class="search-results">${results.map((result) => {
          const symbol = result.symbol;
          const exchange = result.exchange ?? (result.kind === 'crypto' ? 'CRYPTO' : 'US');
          return `<button class="search-result" type="button" data-symbol="${escapeHtml(symbol)}" data-exchange="${escapeHtml(exchange)}" data-mic="${escapeHtml(result.mic ?? '')}"><span><strong>${escapeHtml(symbol)}</strong><small>${escapeHtml(result.name ?? exchange)}</small></span>${icon('plus')}</button>`;
        }).join('')}</div>` : '';
        resultsRoot.querySelectorAll('[data-symbol]').forEach((button) => button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const added = await mutate('/watchlist', 'POST', { symbol: button.dataset.symbol, exchange: button.dataset.exchange, mic: button.dataset.mic || undefined });
            if (!items.some((item) => item.symbol === button.dataset.symbol)) items = [...items, added];
            input.value = '';
            resultsRoot.innerHTML = '';
            render();
            refreshQuotes();
            toast(`${button.dataset.symbol} added`, 'positive');
          } catch (error) {
            toast(error.message, 'negative');
            button.disabled = false;
          }
        }));
      };
      const search = debounce(async () => {
        const query = input.value.trim();
        if (!query) return showResults([]);
        showResults(await api(`/market/search?q=${encodeURIComponent(query)}`).catch(() => []));
      }, 350);
      input.addEventListener('input', search);
      input.addEventListener('focus', async () => {
        if (input.value.trim()) return;
        const popular = await api('/market/popular').catch(() => ({ items: [] }));
        showResults(popular.items ?? []);
      });
      document.addEventListener('click', (event) => {
        if (!event.target.closest('.search-box')) showResults([]);
      });
    },
  };
}

export function chartsPage() {
  const body = `
    ${pageHeader('Charts', 'Price charts', 'Candles with recorded entries and exits from your trades.',
      '<select id="chart-symbol" class="select" aria-label="Symbol"></select>')}
    <section class="panel">
      <header class="panel__header"><div><p class="eyebrow">Chart</p><h2 id="chart-title">Select a symbol</h2></div><div class="segmented" role="tablist" aria-label="Timeframe">${['1m', '5m', '15m', '1h', '1d'].map((timeframe) => `<button type="button" data-timeframe="${timeframe}" class="${timeframe === '1d' ? 'is-active' : ''}">${timeframe}</button>`).join('')}</div></header>
      <div class="panel__body"><div id="price-chart" class="chart-frame chart-frame--large">${skeleton(5)}</div><div id="chart-message"></div></div>
    </section>`;
  return {
    title: 'Charts - Autotrade',
    html: appShell('/charts', body, { wide: true }),
    mount() {
      let timeframe = '1d';
      let chart;
      let resizeObserver;
      const container = document.querySelector('#price-chart');
      const select = document.querySelector('#chart-symbol');

      const draw = async () => {
        const symbol = select.value;
        if (!symbol) {
          container.innerHTML = emptyState('Add a symbol first', 'Charts use symbols from your watchlist.', '<a class="text-link" href="/watchlist" data-link>Open watchlist</a>');
          window.autotrade?.bindLinks?.();
          return;
        }
        container.innerHTML = '';
        document.querySelector('#chart-title').textContent = `${symbol} · ${timeframe}`;
        try {
          const [market, trades] = await Promise.all([
            api(`/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`),
            api(`/trades?symbol=${encodeURIComponent(symbol)}&limit=200`),
          ]);
          chart?.remove();
          resizeObserver?.disconnect();
          chart = createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: { background: { color: 'transparent' }, textColor: '#8c918c', fontFamily: 'IBM Plex Mono' },
            grid: { vertLines: { color: 'rgba(242,241,236,.06)' }, horzLines: { color: 'rgba(242,241,236,.06)' } },
            rightPriceScale: { borderColor: 'rgba(242,241,236,.14)' },
            timeScale: { borderColor: 'rgba(242,241,236,.14)', timeVisible: timeframe !== '1d' },
            crosshair: { mode: CrosshairMode.Normal },
          });
          const series = chart.addCandlestickSeries({
            upColor: '#00c896', downColor: '#e14d5a', borderVisible: false, wickUpColor: '#00c896', wickDownColor: '#e14d5a',
          });
          const candles = (market.candles ?? []).map((candle) => ({
            time: Math.floor(Number(candle.t ?? candle.time ?? candle.timestamp) / 1000),
            open: Number(candle.o ?? candle.open),
            high: Number(candle.h ?? candle.high),
            low: Number(candle.l ?? candle.low),
            close: Number(candle.c ?? candle.close),
          })).sort((a, b) => Number(a.time) - Number(b.time));
          series.setData(candles);
          const markers = (trades.items ?? []).flatMap((trade) => {
            const list = [{ time: Math.floor(Number(trade.openedAt) / 1000), position: 'belowBar', color: '#00c896', shape: 'arrowUp', text: `IN ${money(trade.entryPrice)}` }];
            if (trade.closedAt) list.push({ time: Math.floor(Number(trade.closedAt) / 1000), position: 'aboveBar', color: '#e14d5a', shape: 'arrowDown', text: `OUT ${money(trade.exitPrice)}` });
            return list;
          }).filter((marker) => marker.time >= Number(candles[0]?.time ?? 0)).sort((a, b) => a.time - b.time);
          series.setMarkers(markers);
          chart.timeScale().fitContent();
          resizeObserver = new ResizeObserver(() => chart?.applyOptions({ width: container.clientWidth, height: container.clientHeight }));
          resizeObserver.observe(container);
        } catch (error) {
          container.innerHTML = emptyState('Chart unavailable', error.message);
        }
      };
      api('/watchlist').then((items) => {
        select.innerHTML = items.length ? items.map((item) => `<option value="${escapeHtml(item.symbol)}">${escapeHtml(item.symbol)}</option>`).join('') : '<option value="">No watchlist symbols</option>';
        draw();
      }).catch((error) => { container.innerHTML = `<div class="alert alert--danger">${escapeHtml(error.message)}</div>`; });
      select.addEventListener('change', draw);
      document.querySelectorAll('[data-timeframe]').forEach((button) => button.addEventListener('click', () => {
        timeframe = button.dataset.timeframe;
        document.querySelectorAll('[data-timeframe]').forEach((item) => item.classList.toggle('is-active', item === button));
        draw();
      }));
      state.routeCleanup.push(() => {
        resizeObserver?.disconnect();
        chart?.remove();
      });
    },
  };
}

export function historyPage() {
  const body = `
    ${pageHeader('History', 'Trade history', 'Every entry, exit, strategy, confidence score, and P&L.',
      '<button class="button button--outline" id="cash-out" type="button"><span>Cash out winners</span></button>')}
    <div class="segmented" id="history-filters" role="tablist" aria-label="Trade result">${[['', 'All'], ['OPEN', 'Open'], ['WIN', 'Wins'], ['LOSS', 'Losses']].map(([value, label]) => `<button class="${value === '' ? 'is-active' : ''}" type="button" data-filter="${value}">${label}</button>`).join('')}</div>
    <div class="content-grid" style="margin-top:24px" data-tour="trade-history">
      <div class="span-8" id="history-table">${panel({ title: 'Trades', content: skeleton(7) })}</div>
      <aside class="span-4 detail-drawer" id="trade-detail">${panel({ eyebrow: 'Selected trade', title: 'Pick a trade', content: '<p style="color:var(--ash);line-height:1.6">Select a row to see the reason, timing, and result.</p>' })}</aside>
    </div>`;
  return {
    title: 'Trade history - Autotrade',
    html: appShell('/history', body, { wide: true }),
    mount() {
      let filter = '';
      let trades = [];
      const renderDetail = (trade) => {
        document.querySelector('#trade-detail').innerHTML = panel({
          eyebrow: `${trade.side} · ${trade.mode}`,
          title: trade.symbol,
          content: `
            <div class="metric-inline"><span>Opened <strong>${dateTime(trade.openedAt)}</strong></span><span>Confidence <strong>${percent(trade.confidence, 0)}</strong></span><span>Strategy <strong>${escapeHtml(trade.strategy)}</strong></span></div>
            <div class="stats-grid stats-grid--three" style="grid-template-columns:1fr 1fr;margin:28px 0">
              ${stat('Entry', money(trade.entryPrice))}${stat('Exit', trade.exitPrice ? money(trade.exitPrice) : 'Open')}
            </div>
            <p class="eyebrow">Entry reason</p><p style="color:var(--paper-dim);line-height:1.65">${escapeHtml(trade.entryReason || 'No reason recorded.')}</p>
            ${trade.exitReason ? `<p class="eyebrow" style="margin-top:28px">Exit reason</p><p style="color:var(--paper-dim);line-height:1.65">${escapeHtml(trade.exitReason)}</p>` : ''}
            ${trade.result === 'OPEN' ? `<button class="button button--danger button--block" id="close-selected" type="button"><span>Close at market</span></button>` : `<div class="alert ${Number(trade.pnl) >= 0 ? 'alert--success' : 'alert--danger'}">${badge(trade.result)} <strong>${signed(trade.pnl)}</strong></div>`}`,
        });
        bindButton('#close-selected', async (event) => {
          event.currentTarget.disabled = true;
          try {
            const result = await mutate('/trades/close', 'POST', { id: trade._id });
            toast(`Trade closed: ${signed(result.pnl)}`, 'positive');
            load();
          } catch (error) {
            toast(error.message, 'negative');
            event.currentTarget.disabled = false;
          }
        });
      };
      const render = () => {
        document.querySelector('#history-table').innerHTML = panel({
          eyebrow: filter || 'All outcomes',
          title: `${trades.length} trades`,
          className: 'panel--flush',
          content: trades.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Symbol</th><th>Result</th><th>Side</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Opened</th></tr></thead><tbody>${trades.map((trade) => `<tr tabindex="0" data-trade="${escapeHtml(trade._id)}"><td class="symbol">${escapeHtml(trade.symbol)}</td><td>${badge(trade.result)}</td><td>${escapeHtml(trade.side)}</td><td>${money(trade.entryPrice)}</td><td>${trade.exitPrice ? money(trade.exitPrice) : '—'}</td><td class="${Number(trade.pnl) >= 0 ? 'text-positive' : 'text-negative'}">${trade.pnl == null ? '—' : signed(trade.pnl)}</td><td>${dateTime(trade.openedAt)}</td></tr>`).join('')}</tbody></table></div>` : emptyState(`No ${filter ? filter.toLowerCase() : ''} trades`, filter === 'OPEN' ? 'Start the bot and wait for an approved signal.' : 'Trades matching this filter will appear here.'),
        });
        document.querySelectorAll('[data-trade]').forEach((row) => {
          const select = () => renderDetail(trades.find((trade) => trade._id === row.dataset.trade));
          row.addEventListener('click', select);
          row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
          });
        });
      };
      const load = async () => {
        try {
          const result = await api(`/trades?limit=200${filter ? `&result=${filter}` : ''}`);
          trades = result.items ?? [];
          render();
        } catch (error) {
          document.querySelector('#history-table').innerHTML = `<div class="alert alert--danger">${escapeHtml(error.message)}</div>`;
        }
      };
      load();
      const timer = window.setInterval(() => {
        if (!document.hidden) load();
      }, 30_000);
      const onVisibility = () => {
        if (!document.hidden) load();
      };
      document.addEventListener('visibilitychange', onVisibility);
      state.routeCleanup.push(() => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisibility);
      });
      document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
        filter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
        load();
      }));
      bindButton('#cash-out', async (event) => {
        event.currentTarget.disabled = true;
        try {
          await mutate('/broker/sync', 'POST').catch(() => {});
          const result = await mutate('/trades/cash-out', 'POST', {});
          toast(`${result.closed} winning trade${result.closed === 1 ? '' : 's'} closed`, 'positive');
          load();
        } catch (error) {
          toast(error.message, 'negative');
        } finally {
          event.currentTarget.disabled = false;
        }
      });
    },
  };
}

function field(name, label, value, type = 'number', note = '', attrs = '') {
  return `<div class="field"><label for="${name}">${escapeHtml(label)}</label><input class="input" id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs}/>${note ? `<small>${escapeHtml(note)}</small>` : ''}</div>`;
}

export function settingsPage() {
  const body = `
    ${pageHeader('Settings', 'Bot settings', 'Execution mode, risk limits, strategies, Alpaca connection, and email preferences.',
      '<button class="button button--primary" id="save-settings" type="submit" form="settings-form" disabled><span>Save changes</span></button>')}
    <div id="settings-alerts"></div>
    <div class="settings-layout">
      <form id="settings-form" class="settings-content">
        <div id="settings-loading">${skeleton(8)}</div>
      </form>
      <nav class="settings-index" aria-label="Settings sections">
        <a href="#execution">Execution</a><a href="#risk">Risk limits</a><a href="#presets">Presets</a><a href="#strategies">Strategies</a><a href="#broker">Alpaca</a><a href="#preferences">Preferences</a>
      </nav>
    </div>`;
  return {
    title: 'Settings - Autotrade',
    html: appShell('/settings', body, { wide: true }),
    async mount() {
      const form = document.querySelector('#settings-form');
      const save = document.querySelector('#save-settings');
      let settings;
      let catalog = { stock: [], crypto: [] };
      let broker = {};
      try {
        [settings, catalog, broker] = await Promise.all([
          api('/bot-settings'),
          api('/strategies/catalog').catch(() => catalog),
          api('/broker/status').catch(() => ({})),
        ]);
      } catch (error) {
        form.innerHTML = `<div class="alert alert--danger">${escapeHtml(error.message)}</div>`;
        return;
      }
      if (!settings) {
        form.innerHTML = emptyState('Settings unavailable', 'Refresh the page or sign out and back in.');
        return;
      }
      const selectedStocks = new Set(settings.stockStrategies ?? []);
      const selectedCrypto = new Set(settings.cryptoStrategies ?? []);
      const entitlements = state.entitlements ?? {};
      const liveAllowed = Boolean(entitlements.liveEntitled);
      const effectiveTier = entitlements.effectiveTier ?? 'free';
      const minScan = effectiveTier === 'unlimited' ? 1 : effectiveTier === 'pro' ? 20 : 35;
      const maxScan = effectiveTier === 'unlimited' ? 19 : effectiveTier === 'pro' ? 34 : 44;

      form.innerHTML = `
        ${panel({
          eyebrow: 'Execution',
          title: 'Where orders go',
          attrs: 'id="execution"',
          content: `<div class="segmented" id="mode-control" role="radiogroup" aria-label="Bot mode">${['DISABLED', 'PAPER', 'LIVE'].map((mode) => `<button type="button" role="radio" aria-checked="${settings.mode === mode}" data-mode="${mode}" class="${settings.mode === mode ? 'is-active' : ''}" ${mode === 'LIVE' && !liveAllowed ? 'data-locked="live"' : ''}>${mode}${mode === 'LIVE' && !liveAllowed ? ' · Pro' : ''}</button>`).join('')}</div><p style="color:var(--ash);line-height:1.6;margin:20px 0 0">Paper is the default. Live requires a paid plan, a connected Alpaca live account, and explicit risk acknowledgment.</p>`,
        })}
        ${panel({
          eyebrow: 'Risk',
          title: 'Risk limits',
          attrs: 'id="risk"',
          content: `<div class="form-grid">
            <div class="field"><label for="riskLevel">Risk profile</label><select class="select" id="riskLevel" name="riskLevel">${['LOW', 'MEDIUM', 'HIGH'].map((risk) => `<option ${settings.riskLevel === risk ? 'selected' : ''}>${risk}</option>`).join('')}</select></div>
            ${field('minConfidence', 'Minimum confidence (%)', settings.minConfidence, 'number', 'Signals below this score are ignored.', 'min="1" max="100" step="1"')}
            ${field('maxActiveTrades', 'Maximum active trades', settings.maxActiveTrades, 'number', '', 'min="1" max="100"')}
            ${field('maxTradeSize', 'Maximum trade size ($)', settings.maxTradeSize, 'number', '', 'min="1" step="1"')}
            ${field('riskPerTradePct', 'Risk per trade (%)', settings.riskPerTradePct, 'number', '', 'min=".1" max="100" step=".1"')}
            ${field('maxDailyLoss', 'Maximum daily loss ($)', settings.maxDailyLoss, 'number', '', 'min="1" step="1"')}
            ${field('defaultStopPct', 'Default stop loss (%)', settings.defaultStopPct, 'number', '', 'min=".1" max="100" step=".1"')}
            ${field('defaultTakeProfitPct', 'Default take profit (%)', settings.defaultTakeProfitPct, 'number', '', 'min=".1" max="100" step=".1"')}
            ${field('tradingHoursStart', 'Trading starts', settings.tradingHoursStart, 'time')}
            ${field('tradingHoursEnd', 'Trading ends', settings.tradingHoursEnd, 'time')}
            <div class="field field--wide"><label for="scanIntervalSeconds">Scan interval: <strong id="scan-value">${settings.scanIntervalSeconds ?? maxScan}s</strong></label><input id="scanIntervalSeconds" name="scanIntervalSeconds" type="range" min="${minScan}" max="${maxScan}" value="${Math.min(Math.max(settings.scanIntervalSeconds ?? maxScan, minScan), maxScan)}" /><small>${escapeHtml(effectiveTier)} plan range: ${minScan}–${maxScan} seconds.</small></div>
          </div>
          <p class="field__label" style="margin-top:28px">Analysis timeframes</p>
          <div class="check-grid">${['1m', '5m', '15m', '1h', '4h', '1d'].map((timeframe) => `<label class="check-card"><input type="checkbox" name="timeframes" value="${timeframe}" ${(settings.timeframes ?? []).includes(timeframe) ? 'checked' : ''}/><span><strong>${timeframe}</strong><small>Include this interval in signal analysis.</small></span></label>`).join('')}</div>`,
        })}
        ${panel({
          eyebrow: 'Strategy sets',
          title: 'Presets',
          attrs: 'id="presets"',
          content: `<div class="preset-grid">${presets.map(([id, label, description]) => `<button class="preset-card" type="button" data-preset="${id}"><strong>${label}</strong><span>${description}</span></button>`).join('')}</div>`,
        })}
        ${panel({
          eyebrow: 'Individual strategies',
          title: 'Stocks',
          attrs: 'id="strategies" data-tour="strategies"',
          content: `<div class="check-grid">${(catalog.stock ?? []).filter((item) => !item.isOverlay).map((item) => `<label class="check-card"><input type="checkbox" name="stockStrategies" value="${escapeHtml(item.id)}" ${selectedStocks.has(item.id) ? 'checked' : ''}/><span><strong>${escapeHtml(item.displayName)}</strong><small>${escapeHtml(item.description)}</small></span></label>`).join('') || '<p>Strategy catalog unavailable.</p>'}</div>`,
        })}
        ${panel({
          eyebrow: 'Individual strategies',
          title: 'Crypto',
          content: `<label class="check-card" style="margin-bottom:16px"><input type="checkbox" id="includeExperimental" ${settings.includeExperimental ? 'checked' : ''} ${effectiveTier !== 'unlimited' ? 'data-locked="experimental"' : ''}/><span><strong>Show experimental strategies</strong><small>Experimental strategies require extra data feeds and an Unlimited plan.</small></span></label><div class="check-grid">${(catalog.crypto ?? []).filter((item) => !item.isOverlay).map((item) => `<label class="check-card"><input type="checkbox" name="cryptoStrategies" value="${escapeHtml(item.id)}" ${selectedCrypto.has(item.id) ? 'checked' : ''} ${effectiveTier === 'free' || effectiveTier === 'essential' ? 'data-locked="crypto"' : ''}/><span><strong>${escapeHtml(item.displayName)}${item.isExperimental ? ' · Experimental' : ''}</strong><small>${escapeHtml(item.description)}</small></span></label>`).join('') || '<p>Strategy catalog unavailable.</p>'}</div>`,
        })}
        ${panel({
          eyebrow: 'Filters',
          title: 'Master filters',
          content: `<p style="color:var(--ash);line-height:1.6">Enabled filters can veto an entry before a strategy creates an order.</p><div class="check-grid">${[...(catalog.stock ?? []), ...(catalog.crypto ?? [])].filter((item, index, all) => item.isOverlay && all.findIndex((candidate) => candidate.id === item.id) === index).map((item) => `<label class="check-card"><input type="checkbox" name="enabledOverlays" value="${escapeHtml(item.id)}" ${!(settings.disabledStrategies ?? []).includes(item.id) ? 'checked' : ''}/><span><strong>${escapeHtml(item.displayName)}</strong><small>${escapeHtml(item.description)}</small></span></label>`).join('') || '<p>No safety overlays are available.</p>'}</div>`,
        })}
        ${panel({
          eyebrow: 'Broker connection',
          title: broker.connected ? 'Alpaca connected' : 'Connect Alpaca',
          attrs: 'id="broker" data-tour="alpaca-connect"',
          content: broker.connected
            ? `<div class="alert alert--success">${badge('Connected')} Orders can route to your ${broker.paper === false ? 'live' : 'paper'} account.</div><button class="button button--danger" id="disconnect-broker" type="button"><span>Disconnect Alpaca</span></button>`
            : `<p style="color:var(--ash);line-height:1.6">Use paper credentials first. Keys are encrypted at rest and never displayed again.</p><div class="form-grid"><div class="field"><label for="alpaca-key">API key ID</label><input class="input" id="alpaca-key" autocomplete="off" /></div><div class="field"><label for="alpaca-secret">Secret key</label><input class="input" id="alpaca-secret" type="password" autocomplete="new-password" /></div><label class="check-card field--wide"><input id="alpaca-paper" type="checkbox" checked/><span><strong>Paper account</strong><small>Keep checked unless you intend to connect live credentials.</small></span></label></div><button class="button button--outline" id="connect-broker" type="button"><span>Connect Alpaca</span></button>`,
        })}
        ${panel({
          eyebrow: 'Email',
          title: 'Preferences',
          attrs: 'id="preferences"',
          content: `<label class="check-card"><input type="checkbox" id="weeklyDigestEnabled" ${state.profile?.weeklyDigestEnabled !== false ? 'checked' : ''}/><span><strong>Weekly digest</strong><small>Receive a concise summary of bot activity and performance.</small></span></label>`,
        })}`;
      save.disabled = false;
      form.querySelector('#scanIntervalSeconds').addEventListener('input', (event) => {
        form.querySelector('#scan-value').textContent = `${event.target.value}s`;
      });
      form.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', async () => {
        if (button.dataset.locked) return window.autotrade?.openUpgrade?.('Live trading requires a paid plan.');
        if (button.dataset.mode === 'LIVE' && !window.confirm('Live trading can lose real money. Confirm that you have read the Risk Disclosure and accept full responsibility.')) return;
        try {
          await mutate('/bot-settings/mode', 'POST', { mode: button.dataset.mode });
          form.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
          settings.mode = button.dataset.mode;
          toast(`Mode changed to ${button.dataset.mode}`, 'positive');
        } catch (error) { toast(error.message, 'negative'); }
      }));
      form.querySelectorAll('[data-locked="crypto"]').forEach((input) => input.addEventListener('click', (event) => {
        event.preventDefault();
        window.autotrade?.openUpgrade?.('Crypto strategies require Pro or Unlimited.');
      }));
      form.querySelector('[data-locked="experimental"]')?.addEventListener('click', (event) => {
        event.preventDefault();
        window.autotrade?.openUpgrade?.('Experimental strategies require Unlimited.');
      });
      form.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', async () => {
        if (button.dataset.preset === 'crypto_only' && ['free', 'essential'].includes(effectiveTier)) return window.autotrade?.openUpgrade?.('Crypto presets require Pro or Unlimited.');
        if (button.dataset.preset === 'aggressive' && effectiveTier !== 'unlimited') return window.autotrade?.openUpgrade?.('Experimental strategies require Unlimited.');
        button.disabled = true;
        try {
          const coreStock = ['trend_following_v2', 'momentum_v2', 'mean_reversion_v2', 'breakout_v1', 'pullback_in_trend_v1'];
          const coreCrypto = ['crypto_trend_following', 'crypto_momentum', 'crypto_mean_reversion', 'crypto_breakout'];
          const presetPayloads = {
            balanced: { stockStrategies: coreStock, cryptoStrategies: coreCrypto, includeExperimental: false, riskLevel: 'MEDIUM', minConfidence: 60 },
            conservative: { stockStrategies: ['trend_following_v2', 'mean_reversion_v2', 'pullback_in_trend_v1'], cryptoStrategies: ['crypto_trend_following', 'crypto_mean_reversion'], includeExperimental: false, riskLevel: 'LOW', minConfidence: 70 },
            aggressive: { stockStrategies: [...coreStock, 'news_event_v1', 'sentiment_v1', 'stat_arb_pairs_v1', 'vwap_intraday_v1'], cryptoStrategies: [...coreCrypto, 'crypto_funding_perp', 'crypto_oi_liquidation', 'crypto_onchain_flow', 'crypto_news_narrative'], includeExperimental: true, riskLevel: 'HIGH', minConfidence: 50 },
            trend_hunter: { stockStrategies: ['trend_following_v2', 'momentum_v2', 'breakout_v1', 'pullback_in_trend_v1'], cryptoStrategies: ['crypto_trend_following', 'crypto_momentum', 'crypto_breakout'], includeExperimental: false, riskLevel: 'MEDIUM', minConfidence: 60 },
            mean_reversion: { stockStrategies: ['mean_reversion_v2', 'vwap_intraday_v1'], cryptoStrategies: ['crypto_mean_reversion'], includeExperimental: true, riskLevel: 'LOW', minConfidence: 65 },
            stocks_only: { stockStrategies: coreStock, cryptoStrategies: [], includeExperimental: false, riskLevel: 'MEDIUM', minConfidence: 60 },
            crypto_only: { stockStrategies: [], cryptoStrategies: coreCrypto, includeExperimental: false, riskLevel: 'MEDIUM', minConfidence: 60 },
            legacy: { stockStrategies: ['legacy_trend_breakout', 'legacy_pullback_continuation', 'legacy_mean_reversion'], cryptoStrategies: ['legacy_crypto_momentum'], includeExperimental: false, riskLevel: 'MEDIUM', minConfidence: 60 },
          };
          const updated = await mutate('/bot-settings/preset', 'POST', { presetId: button.dataset.preset, ...presetPayloads[button.dataset.preset] });
          toast(`${button.textContent.trim().split(/(?=[A-Z])/)[0] || 'Preset'} applied`, 'positive');
          if (updated) settings = { ...settings, ...updated };
          setTimeout(() => location.reload(), 450);
        } catch (error) {
          toast(error.message, 'negative');
          button.disabled = false;
        }
      }));
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        save.disabled = true;
        const data = new FormData(form);
        const payload = {
          riskLevel: data.get('riskLevel'),
          maxActiveTrades: Number(data.get('maxActiveTrades')),
          maxTradeSize: Number(data.get('maxTradeSize')),
          riskPerTradePct: Number(data.get('riskPerTradePct')),
          defaultStopPct: Number(data.get('defaultStopPct')),
          defaultTakeProfitPct: Number(data.get('defaultTakeProfitPct')),
          maxDailyLoss: Number(data.get('maxDailyLoss')),
          tradingHoursStart: data.get('tradingHoursStart'),
          tradingHoursEnd: data.get('tradingHoursEnd'),
          minConfidence: Number(data.get('minConfidence')),
          scanIntervalSeconds: Number(data.get('scanIntervalSeconds')),
          stockStrategies: data.getAll('stockStrategies'),
          cryptoStrategies: data.getAll('cryptoStrategies'),
          timeframes: data.getAll('timeframes'),
          includeExperimental: form.querySelector('#includeExperimental').checked,
          disabledStrategies: [...new Set([...(catalog.stock ?? []), ...(catalog.crypto ?? [])].filter((item) => item.isOverlay && !data.getAll('enabledOverlays').includes(item.id)).map((item) => item.id))],
        };
        try {
          await mutate('/bot-settings', 'PATCH', payload);
          await mutate('/users/me', 'PATCH', { weeklyDigestEnabled: form.querySelector('#weeklyDigestEnabled').checked });
          await fetch('/api/email/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weeklyDigestEnabled: form.querySelector('#weeklyDigestEnabled').checked }) }).catch(() => {});
          toast('Settings saved', 'positive');
        } catch (error) {
          toast(error.message, 'negative');
        } finally {
          save.disabled = false;
        }
      });
      bindButton('#connect-broker', async (event) => {
        const keyId = form.querySelector('#alpaca-key').value.trim();
        const secret = form.querySelector('#alpaca-secret').value.trim();
        if (!keyId || !secret) return toast('Enter both Alpaca credentials.', 'negative');
        event.currentTarget.disabled = true;
        try {
          await mutate('/broker/connect', 'POST', { keyId, secret, paper: form.querySelector('#alpaca-paper').checked });
          await mutate('/broker/sync', 'POST');
          toast('Alpaca connected', 'positive');
          setTimeout(() => location.reload(), 500);
        } catch (error) {
          toast(error.message, 'negative');
          event.currentTarget.disabled = false;
        }
      });
      bindButton('#disconnect-broker', async (event) => {
        if (!window.confirm('Disconnect Alpaca credentials from Autotrade?')) return;
        event.currentTarget.disabled = true;
        try {
          await mutate(`/broker/connect?paper=${broker.paper !== false}`, 'DELETE');
          toast('Alpaca disconnected', 'positive');
          setTimeout(() => location.reload(), 500);
        } catch (error) {
          toast(error.message, 'negative');
          event.currentTarget.disabled = false;
        }
      });
    },
  };
}

export function accountPage() {
  const ent = state.entitlements ?? {};
  const tier = ent.effectiveTier ?? 'free';
  const status = ent.subscriptionStatus ?? state.subscription?.status ?? 'NONE';
  const email = state.user?.primaryEmailAddress?.emailAddress ?? state.profile?.email ?? '—';
  const paid = tier !== 'free';
  const body = `
    ${pageHeader('Account', 'Your account', 'Plan, billing, profile, and sign-out.',
      '<button class="button button--outline" id="sign-out" type="button"><span>Sign out</span></button>')}
    <section class="stats-grid stats-grid--three">
      ${stat('Current plan', tier.charAt(0).toUpperCase() + tier.slice(1), status)}
      ${stat('Paper trades', String(state.subscription?.paperTradesUsed ?? 0), state.subscription?.paperTradesLimit ? `of ${state.subscription.paperTradesLimit}` : 'Plan allowance')}
      ${stat('Account', email, state.profile?.role ?? 'USER')}
    </section>
    <div class="content-grid">
      <div class="span-8">${panel({
        eyebrow: 'Subscription',
        title: paid ? `${tier.charAt(0).toUpperCase() + tier.slice(1)} plan` : 'Free plan',
        content: `
          <div class="alert ${ent.cancelAtPeriodEnd ? 'alert--danger' : 'alert--success'}">${badge(status)} ${ent.cancelAtPeriodEnd && ent.currentPeriodEnd ? `Access continues until ${new Date(ent.currentPeriodEnd).toLocaleDateString()}.` : 'Your current access is active.'}</div>
          <p style="max-width:640px;color:var(--ash);line-height:1.65">${paid ? 'Manage your plan, compare limits, or update the subscription attached to this account.' : 'Move to a paid plan for live execution, faster scans, and deeper analytics.'}</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:24px">
            <button class="button button--primary" type="button" data-upgrade><span>${paid ? 'Change plan' : 'Compare plans'}</span></button>
            ${paid && !ent.cancelAtPeriodEnd ? '<button class="button button--outline" id="cancel-plan" type="button"><span>Cancel plan</span></button>' : ''}
            ${ent.cancelAtPeriodEnd ? '<button class="button button--outline" id="reactivate-plan" type="button"><span>Reactivate</span></button>' : ''}
          </div>`,
      })}</div>
      <div class="span-4">${panel({
        eyebrow: 'Security',
        title: 'Clerk account',
        content: `<p style="color:var(--ash);line-height:1.65">Authentication, active sessions, and recovery are managed securely by Clerk.</p><div class="data-list"><div class="data-row"><div><strong>${escapeHtml(email)}</strong><span>Primary email</span></div></div><div class="data-row"><div><strong>${escapeHtml(state.profile?.status ?? 'ACTIVE')}</strong><span>Account status</span></div></div></div>`,
      })}</div>
      <div class="span-12" id="founder-panel"></div>
    </div>`;
  return {
    title: 'Account - Autotrade',
    html: appShell('/account', body),
    async mount() {
      window.autotrade?.bindUpgrade?.();
      bindButton('#sign-out', () => state.clerk?.signOut({ redirectUrl: '/' }));
      bindButton('#cancel-plan', async (event) => {
        if (!window.confirm('Cancel this subscription at the end of the current billing period?')) return;
        event.currentTarget.disabled = true;
        try {
          await mutate('/subscription/cancel', 'POST', {});
          toast('Subscription will cancel at period end', 'positive');
          setTimeout(() => location.reload(), 600);
        } catch (error) { toast(error.message, 'negative'); event.currentTarget.disabled = false; }
      });
      bindButton('#reactivate-plan', async (event) => {
        event.currentTarget.disabled = true;
        try {
          await mutate('/subscription/cancel', 'POST', { action: 'reactivate' });
          toast('Subscription reactivated', 'positive');
          setTimeout(() => location.reload(), 600);
        } catch (error) { toast(error.message, 'negative'); event.currentTarget.disabled = false; }
      });
      const founder = await api('/users/founder-settings').catch(() => null);
      if (!founder) return;
      document.querySelector('#founder-panel').innerHTML = panel({
        eyebrow: 'Internal',
        title: 'Founder controls',
        content: `
          <div class="form-grid">
            <div class="field"><label for="founder-plan">Plan simulator</label><select class="select" id="founder-plan"><option value="">Billing plan</option>${['free', 'essential', 'pro', 'unlimited'].map((plan) => `<option value="${plan}" ${founder.planOverride === plan ? 'selected' : ''}>${plan}</option>`).join('')}</select></div>
            <div class="field"><label for="founder-email">User lookup</label><input class="input" id="founder-email" type="email" placeholder="user@example.com" /></div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:20px">
            <button class="button button--outline button--small" id="set-founder-plan" type="button"><span>Apply override</span></button>
            <button class="button button--outline button--small" data-founder-action="resetOnboarding" type="button"><span>Replay onboarding</span></button>
            <button class="button button--outline button--small" data-founder-action="resetTour" type="button"><span>Replay tour</span></button>
            <button class="button button--outline button--small" data-founder-action="runScan" type="button"><span>Run bot scan</span></button>
            <a class="button button--outline button--small" href="/admin" data-link><span>Open admin</span></a>
          </div><div id="founder-result"></div>`,
      });
      window.autotrade?.bindLinks?.();
      bindButton('#set-founder-plan', async () => {
        const plan = document.querySelector('#founder-plan').value;
        try { await mutate('/users/founder-settings', 'POST', { action: 'setPlan', plan: plan === 'free' || !plan ? null : plan }); toast('Plan override updated', 'positive'); } catch (error) { toast(error.message, 'negative'); }
      });
      document.querySelectorAll('[data-founder-action]').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const action = button.dataset.founderAction;
          const result = action === 'runScan' ? await mutate('/bot/run-now', 'POST') : await mutate('/users/founder-settings', 'POST', { action });
          document.querySelector('#founder-result').innerHTML = `<div class="alert alert--success" style="margin-top:20px">${escapeHtml(JSON.stringify(result))}</div>`;
        } catch (error) { toast(error.message, 'negative'); } finally { button.disabled = false; }
      }));
    },
  };
}

export function adminPage() {
  const body = `
    ${pageHeader('Admin', 'Users', 'Account status, subscriptions, and recent activity.')}
    <section class="stats-grid" id="admin-stats">${Array.from({ length: 4 }, () => stat('Loading', '—')).join('')}</section>
    <div class="search-box" style="margin-bottom:24px">${icon('search')}<input id="admin-search" class="input" type="search" placeholder="Search users by email" /></div>
    <div id="admin-users">${panel({ title: 'Users', content: skeleton(7) })}</div>`;
  return {
    title: 'Admin - Autotrade',
    html: appShell('/admin', body, { wide: true }),
    async mount() {
      if (!['ADMIN', 'DEVELOPER'].includes(String(state.profile?.role ?? '').toUpperCase())) {
        history.replaceState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }
      const load = async () => {
        const query = document.querySelector('#admin-search').value.trim();
        try {
          const [metrics, users] = await Promise.all([api('/admin/metrics'), api(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`)]);
          document.querySelector('#admin-stats').innerHTML = stat('Total users', String(metrics.users)) + stat('Active subscriptions', String(metrics.activeSubs)) + stat('Open trades', String(metrics.openTrades)) + stat('Signals · 24h', String(metrics.signals24h));
          document.querySelector('#admin-users').innerHTML = panel({
            eyebrow: 'Accounts',
            title: `${users.length} users`,
            className: 'panel--flush',
            content: users.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Subscription</th><th>Trades</th><th></th></tr></thead><tbody>${users.map((user) => `<tr><td class="symbol">${escapeHtml(user.email)}</td><td>${badge(user.role, 'neutral')}</td><td>${badge(user.status)}</td><td>${escapeHtml(user.subscription?.status ?? 'NONE')}</td><td>${user._count?.trades ?? 0}</td><td><button class="table-action" type="button" data-user="${escapeHtml(user.id)}" data-status="${escapeHtml(user.status)}">${user.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('No users found', 'Try a different email search.'),
          });
          document.querySelectorAll('[data-user]').forEach((button) => button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await mutate(`/admin/users/${encodeURIComponent(button.dataset.user)}/status`, 'POST', { status: button.dataset.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
              toast('Account status updated', 'positive');
              load();
            } catch (error) { toast(error.message, 'negative'); button.disabled = false; }
          }));
        } catch (error) {
          document.querySelector('#admin-users').innerHTML = `<div class="alert alert--danger">${escapeHtml(error.message)}</div>`;
        }
      };
      load();
      document.querySelector('#admin-search').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') load();
      });
    },
  };
}
