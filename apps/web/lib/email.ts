import { Resend } from 'resend';

const FROM = 'Autotrade <noreply@tryautotrade.com>';
const LOGO_URL = 'https://tryautotrade.com/icon.svg';
const DASHBOARD_URL = 'https://tryautotrade.com/dashboard';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

// Shared email wrapper — dark themed, consistent with the app
function wrap(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060a0f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#090c10;border-radius:14px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="padding:28px 36px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px;vertical-align:middle;">
                  <img src="${LOGO_URL}" width="32" height="32" alt="AT" style="display:block;border-radius:6px;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-family:Inter,system-ui,sans-serif;font-size:18px;font-weight:700;color:#f4f8fd;letter-spacing:-0.3px;">Autotrade</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px 36px 36px;font-family:Inter,system-ui,sans-serif;color:#f4f8fd;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.07);font-family:Inter,system-ui,sans-serif;font-size:12px;color:#4a6a80;text-align:center;">
            Autotrade · AI-powered trading bot · <a href="${DASHBOARD_URL}" style="color:#00c896;text-decoration:none;">Open app</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#00c896;color:#090c10;padding:13px 30px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.2px;">${label}</a>`;
}

function stat(value: string, label: string, color = '#f4f8fd'): string {
  return `
    <td style="text-align:center;padding:18px 12px;background:#0e1318;border-radius:8px;border:1px solid rgba(255,255,255,0.07);">
      <div style="font-size:22px;font-weight:700;color:${color};margin-bottom:4px;">${value}</div>
      <div style="font-size:12px;color:#a8bece;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    </td>`;
}

export async function sendWelcomeEmail(to: string, name: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Welcome to Autotrade',
    html: wrap(`
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#f4f8fd;">Welcome, ${name}!</h1>
      <p style="margin:0 0 24px;color:#a8bece;line-height:1.7;font-size:15px;">
        Your AI-powered trading account is ready. Add symbols to your watchlist and let the bot scan for opportunities.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;width:100%;">
        <tr>
          ${stat('∞', 'Watchlist', '#00c896')}
          <td width="12"></td>
          ${stat('AI', 'Signal Engine', '#4facfe')}
          <td width="12"></td>
          ${stat('24/7', 'Scanning', '#a18cd1')}
        </tr>
      </table>
      ${btn(DASHBOARD_URL, 'Go to Dashboard')}
    `),
  });
}

export async function sendTradeAlert(to: string, trade: {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl?: number;
}) {
  const actionColor = trade.action === 'BUY' ? '#00c896' : '#ff3b52';
  const pnlRow = trade.pnl !== undefined
    ? `<tr style="border-top:1px solid rgba(255,255,255,0.07);">
        <td style="padding:12px 0;color:#a8bece;font-size:14px;">P&amp;L</td>
        <td style="padding:12px 0;text-align:right;font-weight:700;color:${trade.pnl >= 0 ? '#00c896' : '#ff3b52'};font-size:14px;">
          ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
        </td>
       </tr>`
    : '';

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${trade.action} ${trade.symbol} — Trade Executed`,
    html: wrap(`
      <div style="display:inline-block;background:${actionColor}22;color:${actionColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.8px;margin-bottom:16px;">${trade.action}</div>
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#f4f8fd;">${trade.symbol}</h1>
      <p style="margin:0 0 24px;color:#a8bece;font-size:14px;">Trade executed successfully</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#0e1318;border-radius:10px;border:1px solid rgba(255,255,255,0.07);margin-bottom:28px;">
        <tr>
          <td style="padding:14px 20px;color:#a8bece;font-size:14px;">Quantity</td>
          <td style="padding:14px 20px;text-align:right;font-weight:600;font-size:14px;">${trade.quantity} shares</td>
        </tr>
        <tr style="border-top:1px solid rgba(255,255,255,0.07);">
          <td style="padding:14px 20px;color:#a8bece;font-size:14px;">Price</td>
          <td style="padding:14px 20px;text-align:right;font-weight:600;font-size:14px;">$${trade.price.toFixed(2)}</td>
        </tr>
        ${pnlRow}
      </table>
      ${btn(DASHBOARD_URL, 'View Trade')}
    `),
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
  const winRate = stats.totalTrades > 0 ? Math.round((stats.wins / stats.totalTrades) * 100) : 0;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Weekly Digest — ${pnlSign}$${stats.pnl.toFixed(2)} this week`,
    html: wrap(`
      <p style="margin:0 0 6px;font-size:12px;color:#4a6a80;text-transform:uppercase;letter-spacing:0.8px;">Weekly Performance</p>
      <h1 style="margin:0 0 6px;font-size:38px;font-weight:800;color:${pnlColor};letter-spacing:-1px;">${pnlSign}$${stats.pnl.toFixed(2)}</h1>
      <p style="margin:0 0 28px;color:#a8bece;font-size:14px;">Total P&amp;L this week</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-spacing:10px;margin-bottom:28px;">
        <tr>
          ${stat(String(stats.totalTrades), 'Trades')}
          <td width="10"></td>
          ${stat(`${winRate}%`, 'Win Rate', '#00c896')}
          <td width="10"></td>
          ${stat(`${stats.wins}W / ${stats.losses}L`, 'W / L')}
        </tr>
      </table>
      ${stats.topSymbol ? `<p style="margin:0 0 24px;color:#a8bece;font-size:14px;">🏆 Top symbol this week: <strong style="color:#f4f8fd;">${stats.topSymbol}</strong></p>` : ''}
      ${btn(DASHBOARD_URL, 'View Full Report')}
    `),
  });
}

export async function sendSubscriptionConfirmed(to: string, name: string, plan: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Subscription Confirmed — Autotrade',
    html: wrap(`
      <div style="font-size:36px;margin-bottom:16px;">🎉</div>
      <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#f4f8fd;">You're on ${plan}!</h1>
      <p style="margin:0 0 24px;color:#a8bece;line-height:1.7;font-size:15px;">
        Hi ${name}, your <strong style="color:#00c896;">${plan}</strong> plan is now active. All features are unlocked.
      </p>
      ${btn(DASHBOARD_URL, 'Go to Dashboard')}
    `),
  });
}
