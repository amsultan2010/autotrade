/** Shared Autotrade email design tokens .  matches globals.css "Precision Terminal". */

export const EMAIL_FROM = 'Autotrade <noreply@tryautotrade.com>';
export const LOGO_URL = 'https://tryautotrade.com/icon.png';
export const APP_URL = 'https://tryautotrade.com';
export const DASHBOARD_URL = `${APP_URL}/dashboard`;
export const SETTINGS_URL = `${APP_URL}/settings`;
export const ALPACA_SETTINGS_URL = SETTINGS_URL;

export const COLORS = {
  bg: '#090c10',
  bgOuter: '#060a0f',
  surface: '#0e1318',
  ink: '#f4f8fd',
  muted: '#a8bece',
  dim: '#4a6a80',
  teal: '#00c896',
  blue: '#4facfe',
  neg: '#ff3b52',
  warn: '#f0a500',
  border: 'rgba(255,255,255,0.07)',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function btn(href: string, label: string, variant: 'primary' | 'ghost' = 'primary'): string {
  if (variant === 'ghost') {
    return `<a href="${href}" style="display:inline-block;color:${COLORS.teal};padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;border:1px solid ${COLORS.teal}55;">${label}</a>`;
  }
  return `<a href="${href}" style="display:inline-block;background:${COLORS.teal};color:${COLORS.bg};padding:13px 30px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.2px;">${label}</a>`;
}

export function stat(value: string, label: string, color: string = COLORS.ink): string {
  return `
    <td style="text-align:center;padding:18px 12px;background:${COLORS.surface};border-radius:8px;border:1px solid ${COLORS.border};">
      <div style="font-size:22px;font-weight:700;color:${color};margin-bottom:4px;font-family:ui-monospace,IBM Plex Mono,monospace;">${value}</div>
      <div style="font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.6px;">${label}</div>
    </td>`;
}

export function sectionLabel(text: string): string {
  return `<p style="margin:0 0 8px;font-size:11px;color:${COLORS.dim};text-transform:uppercase;letter-spacing:1px;font-weight:600;">${text}</p>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:28px 0;" />`;
}

type WrapOptions = {
  preheader?: string;
  showDigestUnsubscribe?: boolean;
};

export function wrapEmail(body: string, options: WrapOptions = {}): string {
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>`
    : '';

  const footerExtra = options.showDigestUnsubscribe
    ? ` · <a href="${SETTINGS_URL}" style="color:${COLORS.teal};text-decoration:none;">Email preferences</a>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Autotrade</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bgOuter};">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${COLORS.bgOuter};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:${COLORS.bg};border-radius:14px;border:1px solid ${COLORS.border};overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="padding:24px 32px 18px;border-bottom:1px solid ${COLORS.border};background:linear-gradient(180deg, #0c1118 0%, ${COLORS.bg} 100%);">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:10px;vertical-align:middle;">
                  <img src="${LOGO_URL}" width="32" height="32" alt="Autotrade" style="display:block;border-radius:6px;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-family:Syne,Inter,system-ui,sans-serif;font-size:18px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.3px;">Autotrade</span>
                </td>
                <td style="vertical-align:middle;padding-left:12px;">
                  <span style="font-family:ui-monospace,IBM Plex Mono,monospace;font-size:10px;color:${COLORS.teal};background:${COLORS.teal}18;padding:3px 8px;border-radius:4px;letter-spacing:0.5px;">PRECISION TERMINAL</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;font-family:Inter,system-ui,sans-serif;color:${COLORS.ink};font-size:15px;line-height:1.65;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 24px;border-top:1px solid ${COLORS.border};font-family:Inter,system-ui,sans-serif;font-size:12px;color:${COLORS.dim};text-align:center;line-height:1.6;">
            Autotrade · AI-powered trading bot · <a href="${DASHBOARD_URL}" style="color:${COLORS.teal};text-decoration:none;">Open dashboard</a>${footerExtra}
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-family:Inter,system-ui,sans-serif;font-size:11px;color:#3a5060;text-align:center;max-width:600px;">
        tryautotrade.com · Paper first, live when you are ready.
      </p>
    </td></tr>
  </table>
</body>
</html>`.trim();
}
