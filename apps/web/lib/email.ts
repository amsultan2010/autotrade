import { Resend } from 'resend';
import {
  ALPACA_WHY_POINTS,
  getWeeklyDigestItem,
  WELCOME_HOW_IT_WORKS,
  type DigestItem,
} from './email/content';
import {
  ALPACA_SETTINGS_URL,
  btn,
  COLORS,
  divider,
  DASHBOARD_URL,
  EMAIL_FROM,
  escapeHtml,
  sectionLabel,
  stat,
  wrapEmail,
} from './email/theme';

const FROM = EMAIL_FROM;

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? FROM;
}

type SendResult = Awaited<ReturnType<Resend['emails']['send']>>;

export type WeeklyDigestStats = {
  totalTrades: number;
  wins: number;
  losses: number;
  pnl: number;
  topSymbol?: string;
};

async function sendEmail(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
}): Promise<SendResult> {
  return getResend().emails.send({
    from: fromAddress(),
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    tags: payload.tags,
    headers: payload.headers,
  });
}

function spotlightCard(item: DigestItem): string {
  const kindLabel = item.kind === 'feature' ? 'Autotrade feature' : 'Investing insight';
  const cta = item.ctaLabel && item.ctaHref
    ? `<p style="margin:16px 0 0;">${btn(item.ctaHref, item.ctaLabel, 'ghost')}</p>`
    : '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${COLORS.surface};border-radius:10px;border:1px solid ${COLORS.border};border-left:3px solid ${item.accent};">
      <tr>
        <td style="padding:22px 24px;">
          <p style="margin:0 0 6px;font-size:11px;color:${item.accent};text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">${kindLabel}</p>
          <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.3px;">${escapeHtml(item.title)}</h2>
          <p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.7;">${escapeHtml(item.body)}</p>
          ${cta}
        </td>
      </tr>
    </table>`;
}

function howItWorksStep(step: string, title: string, body: string): string {
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid ${COLORS.border};">
        <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tr>
            <td width="44" style="vertical-align:top;padding-right:14px;">
              <span style="font-family:ui-monospace,IBM Plex Mono,monospace;font-size:12px;color:${COLORS.teal};font-weight:700;">${step}</span>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:${COLORS.ink};">${escapeHtml(title)}</p>
              <p style="margin:0;font-size:14px;color:${COLORS.muted};line-height:1.6;">${escapeHtml(body)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function alpacaPoint(title: string, body: string): string {
  return `
    <tr>
      <td style="padding:12px 16px;background:${COLORS.surface};border-radius:8px;border:1px solid ${COLORS.border};">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${COLORS.ink};">${escapeHtml(title)}</p>
        <p style="margin:0;font-size:13px;color:${COLORS.muted};line-height:1.55;">${escapeHtml(body)}</p>
      </td>
    </tr>
    <tr><td height="8"></td></tr>`;
}

export function buildWelcomeEmailHtml(name: string): { html: string; text: string; subject: string } {
  const safeName = escapeHtml(name);
  const howRows = WELCOME_HOW_IT_WORKS.map((s) => howItWorksStep(s.step, s.title, s.body)).join('');
  const alpacaRows = ALPACA_WHY_POINTS.map((p) => alpacaPoint(p.title, p.body)).join('');

  const body = `
    <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:${COLORS.ink};letter-spacing:-0.5px;line-height:1.2;">
      Welcome aboard, ${safeName}
    </h1>
    <p style="margin:0 0 8px;font-size:16px;color:${COLORS.muted};line-height:1.7;">
      Your precision terminal is online. Autotrade is an AI-powered trading bot that scans markets, generates signals, and executes trades: paper first, live when you are ready.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 28px;width:100%;">
      <tr>
        ${stat('$100K', 'Paper capital', COLORS.teal)}
        <td width="10"></td>
        ${stat('5 min', 'Scan cycle', COLORS.blue)}
        <td width="10"></td>
        ${stat('24/7', 'Coverage', COLORS.ink)}
      </tr>
    </table>
    ${sectionLabel('How Autotrade works')}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
      ${howRows}
    </table>
    ${divider()}
    ${sectionLabel('Why connect Alpaca?')}
    <p style="margin:0 0 16px;color:${COLORS.muted};font-size:14px;line-height:1.65;">
      You can paper-trade inside Autotrade immediately, no broker required. When you want real order routing, live quotes, and synced positions on your dashboard, Alpaca is the broker we integrate with today.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      ${alpacaRows}
    </table>
    <p style="margin:20px 0 28px;color:${COLORS.muted};font-size:13px;line-height:1.6;">
      Setup takes about five minutes: create a free Alpaca account, generate paper API keys, and paste them into Settings. Keys are encrypted and never exposed to your browser.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding-right:12px;">${btn(DASHBOARD_URL, 'Open dashboard')}</td>
        <td>${btn(ALPACA_SETTINGS_URL, 'Connect Alpaca', 'ghost')}</td>
      </tr>
    </table>`;

  const preheader = 'Your AI trading terminal is ready: paper account funded, watchlist seeded, bot standing by.';
  const subject = 'Welcome to Autotrade: your precision terminal is live';
  const text = [
    `Welcome aboard, ${name}!`,
    '',
    'Autotrade is an AI-powered trading bot that scans markets, generates signals, and executes trades: paper first, live when you are ready.',
    '',
    'You start with $100,000 in paper capital. The bot scans your watchlist every five minutes.',
    '',
    'Why Alpaca? When you are ready for broker-backed execution and live market data, connect Alpaca in Settings. Keys are encrypted server-side.',
    '',
    `Dashboard: ${DASHBOARD_URL}`,
    `Connect Alpaca: ${ALPACA_SETTINGS_URL}`,
  ].join('\n');

  return { html: wrapEmail(body, { preheader }), text, subject };
}

export function buildWeeklyDigestHtml(
  stats: WeeklyDigestStats | null,
  forDate: Date = new Date(),
): { html: string; text: string; subject: string } {
  const item = getWeeklyDigestItem(forDate);
  const hasStats = stats !== null && stats.totalTrades > 0;

  let statsBlock = '';
  let statsText = '';

  if (hasStats && stats) {
    const pnlColor = stats.pnl >= 0 ? COLORS.teal : COLORS.neg;
    const pnlSign = stats.pnl >= 0 ? '+' : '';
    const winRate = Math.round((stats.wins / stats.totalTrades) * 100);

    statsBlock = `
      ${divider()}
      ${sectionLabel('Your week in review')}
      <p style="margin:0 0 6px;font-size:38px;font-weight:800;color:${pnlColor};letter-spacing:-1px;font-family:ui-monospace,IBM Plex Mono,monospace;">
        ${pnlSign}$${stats.pnl.toFixed(2)}
      </p>
      <p style="margin:0 0 20px;color:${COLORS.muted};font-size:14px;">Closed-trade P&amp;L (last 7 days)</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-bottom:12px;">
        <tr>
          ${stat(String(stats.totalTrades), 'Trades')}
          <td width="10"></td>
          ${stat(`${winRate}%`, 'Win rate', COLORS.teal)}
          <td width="10"></td>
          ${stat(`${stats.wins}W / ${stats.losses}L`, 'Record')}
        </tr>
      </table>
      ${stats.topSymbol ? `<p style="margin:0;color:${COLORS.muted};font-size:14px;">Most active symbol: <strong style="color:${COLORS.ink};">${escapeHtml(stats.topSymbol)}</strong></p>` : ''}`;

    statsText = [
      '',
      'Your week in review:',
      `P&L: ${pnlSign}$${stats.pnl.toFixed(2)}`,
      `Trades: ${stats.totalTrades} (${stats.wins}W / ${stats.losses}L)`,
      stats.topSymbol ? `Top symbol: ${stats.topSymbol}` : '',
    ].filter(Boolean).join('\n');
  } else {
    statsBlock = `
      ${divider()}
      <p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.65;">
        No closed trades this week yet. Your watchlist is still scanning. Add symbols you follow, keep the bot in <strong style="color:${COLORS.ink};">paper mode</strong>, and let signals accumulate before going live.
      </p>`;
    statsText = '\nNo closed trades this week yet. Your watchlist is still scanning.';
  }

  const body = `
    <p style="margin:0 0 6px;font-size:11px;color:${COLORS.dim};text-transform:uppercase;letter-spacing:1px;">Autotrade Weekly</p>
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.3px;">This week&apos;s spotlight</h1>
    ${spotlightCard(item)}
    ${statsBlock}
    <p style="margin:28px 0 0;">${btn(DASHBOARD_URL, 'Open dashboard')}</p>`;

  const subject = hasStats && stats
    ? `Autotrade Weekly: ${item.title} (${stats.pnl >= 0 ? '+' : ''}$${stats.pnl.toFixed(2)} this week)`
    : `Autotrade Weekly: ${item.title}`;

  const preheader = item.body.slice(0, 120);
  const text = [
    'Autotrade Weekly',
    '',
    item.title,
    item.body,
    statsText,
    '',
    `Dashboard: ${DASHBOARD_URL}`,
    '',
    'Manage email preferences in Settings.',
  ].join('\n');

  return {
    html: wrapEmail(body, { preheader, showDigestUnsubscribe: true }),
    text,
    subject,
  };
}

export async function sendWelcomeEmail(to: string, name: string): Promise<SendResult> {
  const { html, text, subject } = buildWelcomeEmailHtml(name);
  return sendEmail({
    to,
    subject,
    html,
    text,
    tags: [{ name: 'category', value: 'welcome' }],
  });
}

export async function sendTradeAlert(
  to: string,
  trade: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    pnl?: number;
  },
): Promise<SendResult> {
  const actionColor = trade.action === 'BUY' ? COLORS.teal : COLORS.neg;
  const pnlRow = trade.pnl !== undefined
    ? `<tr style="border-top:1px solid ${COLORS.border};">
        <td style="padding:12px 20px;color:${COLORS.muted};font-size:14px;">P&amp;L</td>
        <td style="padding:12px 20px;text-align:right;font-weight:700;color:${trade.pnl >= 0 ? COLORS.teal : COLORS.neg};font-size:14px;font-family:ui-monospace,IBM Plex Mono,monospace;">
          ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
        </td>
       </tr>`
    : '';

  const body = `
    <div style="display:inline-block;background:${actionColor}22;color:${actionColor};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.8px;margin-bottom:16px;">${trade.action}</div>
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:${COLORS.ink};font-family:ui-monospace,IBM Plex Mono,monospace;">${escapeHtml(trade.symbol)}</h1>
    <p style="margin:0 0 24px;color:${COLORS.muted};font-size:14px;">Trade executed on your account</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:${COLORS.surface};border-radius:10px;border:1px solid ${COLORS.border};margin-bottom:28px;">
      <tr>
        <td style="padding:14px 20px;color:${COLORS.muted};font-size:14px;">Quantity</td>
        <td style="padding:14px 20px;text-align:right;font-weight:600;font-size:14px;">${trade.quantity} shares</td>
      </tr>
      <tr style="border-top:1px solid ${COLORS.border};">
        <td style="padding:14px 20px;color:${COLORS.muted};font-size:14px;">Price</td>
        <td style="padding:14px 20px;text-align:right;font-weight:600;font-size:14px;font-family:ui-monospace,IBM Plex Mono,monospace;">$${trade.price.toFixed(2)}</td>
      </tr>
      ${pnlRow}
    </table>
    ${btn(DASHBOARD_URL, 'View trade')}`;

  return sendEmail({
    to,
    subject: `${trade.action} ${trade.symbol}: trade executed`,
    html: wrapEmail(body),
    text: `${trade.action} ${trade.symbol}\nQty: ${trade.quantity} @ $${trade.price.toFixed(2)}${trade.pnl !== undefined ? `\nP&L: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : ''}\n\n${DASHBOARD_URL}`,
    tags: [
      { name: 'category', value: 'trade-alert' },
      { name: 'symbol', value: trade.symbol },
    ],
  });
}

export async function sendWeeklyDigest(
  to: string,
  stats: WeeklyDigestStats | null,
  forDate: Date = new Date(),
): Promise<SendResult> {
  const { html, text, subject } = buildWeeklyDigestHtml(stats, forDate);
  return sendEmail({
    to,
    subject,
    html,
    text,
    tags: [{ name: 'category', value: 'weekly-digest' }],
    headers: {
      'List-Unsubscribe': '<https://tryautotrade.com/settings>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

export async function sendSubscriptionConfirmed(
  to: string,
  name: string,
  plan: string,
): Promise<SendResult> {
  const safeName = escapeHtml(name);
  const safePlan = escapeHtml(plan);
  const body = `
    <p style="margin:0 0 8px;font-size:32px;line-height:1;">✓</p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${COLORS.ink};">You&apos;re on ${safePlan}</h1>
    <p style="margin:0 0 24px;color:${COLORS.muted};line-height:1.7;font-size:15px;">
      Hi ${safeName}, your <strong style="color:${COLORS.teal};">${safePlan}</strong> plan is active. Live trading features are unlocked.
    </p>
    ${btn(DASHBOARD_URL, 'Go to dashboard')}`;

  return sendEmail({
    to,
    subject: `Subscription confirmed: ${plan}`,
    html: wrapEmail(body),
    text: `Hi ${name}, your ${plan} plan is active.\n\n${DASHBOARD_URL}`,
    tags: [{ name: 'category', value: 'subscription' }],
  });
}
