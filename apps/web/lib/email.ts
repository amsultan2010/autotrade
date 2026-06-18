import { Resend } from 'resend';

const FROM = 'Autotrade <noreply@autotrade.app>';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

export async function sendWelcomeEmail(to: string, name: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Welcome to Autotrade',
    html: `
      <div style="background:#090c10;color:#f4f8fd;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="color:#00c896;font-size:24px;font-weight:700;margin-bottom:24px;">Autotrade</div>
        <h1 style="font-size:28px;margin-bottom:16px;">Welcome, ${name}!</h1>
        <p style="color:#a8bece;line-height:1.6;margin-bottom:24px;">
          Your AI-powered paper trading account is ready. Start by adding symbols to your watchlist and letting the bot analyze the market.
        </p>
        <a href="https://autotrade.app/dashboard" style="display:inline-block;background:#00c896;color:#090c10;padding:12px 28px;border-radius:8px;font-weight:600;text-decoration:none;">
          Go to Dashboard
        </a>
      </div>
    `,
  });
}

export async function sendTradeAlert(to: string, trade: {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl?: number;
}) {
  const color = trade.action === 'BUY' ? '#00c896' : '#ff3b52';
  const pnlText = trade.pnl !== undefined
    ? `<p style="color:#a8bece;margin-top:16px;">P&L: <span style="color:${trade.pnl >= 0 ? '#00c896' : '#ff3b52'}">${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}</span></p>`
    : '';

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${trade.action} ${trade.symbol} — Trade Executed`,
    html: `
      <div style="background:#090c10;color:#f4f8fd;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="color:#00c896;font-size:24px;font-weight:700;margin-bottom:24px;">Autotrade</div>
        <h1 style="font-size:24px;margin-bottom:16px;">Trade Executed</h1>
        <div style="background:#0e1318;border-radius:8px;padding:20px;border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span style="color:#a8bece;">Symbol</span>
            <span style="font-weight:600;">${trade.symbol}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span style="color:#a8bece;">Action</span>
            <span style="color:${color};font-weight:600;">${trade.action}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span style="color:#a8bece;">Quantity</span>
            <span style="font-weight:600;">${trade.quantity} shares</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#a8bece;">Price</span>
            <span style="font-weight:600;">$${trade.price.toFixed(2)}</span>
          </div>
        </div>
        ${pnlText}
      </div>
    `,
  });
}

export async function sendWeeklyDigest(to: string, stats: {
  totalTrades: number;
  wins: number;
  losses: number;
  pnl: number;
  topSymbol?: string;
}) {
  const pnlColor = stats.pnl >= 0 ? '#00c896' : '#ff3b52';
  const pnlSign = stats.pnl >= 0 ? '+' : '';
  const winRate = stats.totalTrades > 0
    ? Math.round((stats.wins / stats.totalTrades) * 100)
    : 0;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Weekly Digest — ${pnlSign}$${stats.pnl.toFixed(2)} this week`,
    html: `
      <div style="background:#090c10;color:#f4f8fd;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="color:#00c896;font-size:24px;font-weight:700;margin-bottom:8px;">Autotrade</div>
        <p style="color:#a8bece;margin-bottom:24px;font-size:14px;">Weekly Performance Summary</p>
        <div style="background:#0e1318;border-radius:8px;padding:24px;border:1px solid rgba(255,255,255,0.06);margin-bottom:16px;">
          <div style="font-size:32px;font-weight:700;color:${pnlColor};margin-bottom:4px;">${pnlSign}$${stats.pnl.toFixed(2)}</div>
          <div style="color:#a8bece;font-size:14px;">Total P&L today</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
          <div style="background:#0e1318;border-radius:8px;padding:16px;border:1px solid rgba(255,255,255,0.06);text-align:center;">
            <div style="font-size:24px;font-weight:700;">${stats.totalTrades}</div>
            <div style="color:#a8bece;font-size:13px;">Trades</div>
          </div>
          <div style="background:#0e1318;border-radius:8px;padding:16px;border:1px solid rgba(255,255,255,0.06);text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#00c896;">${winRate}%</div>
            <div style="color:#a8bece;font-size:13px;">Win Rate</div>
          </div>
          <div style="background:#0e1318;border-radius:8px;padding:16px;border:1px solid rgba(255,255,255,0.06);text-align:center;">
            <div style="font-size:24px;font-weight:700;">${stats.wins}W / ${stats.losses}L</div>
            <div style="color:#a8bece;font-size:13px;">W/L</div>
          </div>
        </div>
        ${stats.topSymbol ? `<p style="color:#a8bece;margin-bottom:24px;">Top symbol: <strong style="color:#f4f8fd;">${stats.topSymbol}</strong></p>` : ''}
        <a href="https://autotrade.app/dashboard" style="display:inline-block;background:#00c896;color:#090c10;padding:12px 28px;border-radius:8px;font-weight:600;text-decoration:none;">
          View Full Report
        </a>
      </div>
    `,
  });
}

export async function sendSubscriptionConfirmed(to: string, name: string, plan: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Subscription Confirmed — Autotrade',
    html: `
      <div style="background:#090c10;color:#f4f8fd;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="color:#00c896;font-size:24px;font-weight:700;margin-bottom:24px;">Autotrade</div>
        <h1 style="font-size:24px;margin-bottom:16px;">You're subscribed!</h1>
        <p style="color:#a8bece;line-height:1.6;margin-bottom:24px;">
          Hi ${name}, your <strong style="color:#f4f8fd;">${plan}</strong> plan is now active. All features are unlocked.
        </p>
        <a href="https://autotrade.app/dashboard" style="display:inline-block;background:#00c896;color:#090c10;padding:12px 28px;border-radius:8px;font-weight:600;text-decoration:none;">
          Go to Dashboard
        </a>
      </div>
    `,
  });
}
