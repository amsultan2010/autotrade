import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Autotrade <noreply@autotrade.app>';

export async function sendWelcomeEmail(to: string, name: string) {
  return resend.emails.send({
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

  return resend.emails.send({
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

export async function sendSubscriptionConfirmed(to: string, name: string, plan: string) {
  return resend.emails.send({
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
