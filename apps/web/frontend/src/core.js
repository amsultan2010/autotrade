export const APP_ROUTES = [
  '/dashboard',
  '/watchlist',
  '/charts',
  '/history',
  '/settings',
  '/account',
  '/admin',
];

export const PUBLIC_ROUTES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/privacy',
  '/terms',
  '/risk-disclosure',
];

const navItems = [
  ['dashboard', 'Dashboard', '/dashboard'],
  ['watchlist', 'Watchlist', '/watchlist'],
  ['charts', 'Charts', '/charts'],
  ['history', 'History', '/history'],
  ['settings', 'Settings', '/settings'],
];

export const plans = [
  {
    id: 'essential',
    name: 'Essential',
    price: 15,
    accent: '#00c896',
    features: ['Stocks and live Alpaca trading', '50 executions per day', 'One active strategy', '35-44 second scans'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    accent: '#ff3b52',
    features: ['Stocks and crypto', '250 executions per day', 'Five active strategies', 'Advanced analytics and quant tools'],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 40,
    accent: '#00c896',
    features: ['Unlimited equity and executions', 'Unlimited strategies', '1-19 second scans', 'Premium analytics and early access'],
  },
];

export const presets = [
  ['balanced', 'Balanced', 'Core trend, momentum, and mean-reversion strategies.'],
  ['conservative', 'Conservative', 'Fewer strategies with a higher confidence threshold.'],
  ['aggressive', 'Aggressive', 'More signals, experimental strategies, and higher activity.'],
  ['trend_hunter', 'Trend Hunter', 'Momentum and breakout focused for directional markets.'],
  ['mean_reversion', 'Mean Reversion', 'Contrarian setups for range-bound markets.'],
  ['stocks_only', 'Stocks Only', 'The complete stock suite with crypto disabled.'],
  ['crypto_only', 'Crypto Only', 'Core crypto strategies running around the clock.'],
  ['legacy', 'Legacy Engine', 'The original Autotrade strategy set.'],
];

export const state = {
  clerk: null,
  user: null,
  profile: null,
  entitlements: null,
  subscription: null,
  routeCleanup: [],
  listeners: new Set(),
};

export function emitState() {
  state.listeners.forEach((listener) => listener(state));
}

export function subscribe(listener) {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function money(value, compact = false) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number.isFinite(number) ? number : 0);
}

export function percent(value, digits = 1) {
  const number = Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toFixed(digits) : '0.0'}%`;
}

export function dateTime(value) {
  if (!value) return '—';
  const parsed = typeof value === 'number' && value < 1e12 ? value * 1000 : value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(parsed));
}

export function statusTone(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (['running', 'active', 'win', 'buy', 'connected', 'enabled', 'paper'].some((token) => normalized.includes(token))) return 'positive';
  if (['loss', 'error', 'disabled', 'stopped', 'short', 'past_due'].some((token) => normalized.includes(token))) return 'negative';
  return 'neutral';
}

export function badge(label, tone = statusTone(label)) {
  return `<span class="badge badge--${tone}"><i aria-hidden="true"></i>${escapeHtml(label)}</span>`;
}

export function brandLink(href = '/', className = 'brand', label = 'Autotrade') {
  return `<a class="${className}" href="${href}" data-link aria-label="${escapeHtml(label)}"><img class="brand__logo" src="/icon.png" alt="" width="30" height="30" /><span>Autotrade</span></a>`;
}

export async function api(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === 'string'
      ? payload.error
      : payload.error?.message ?? response.statusText;
    const error = new Error(message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return undefined;
  return response.json();
}

export function mutate(path, method = 'POST', body) {
  return api(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function createPoll(path, interval, onData, onError = () => {}, options = {}) {
  let timer;
  let stopped = false;
  let inFlight = false;

  const run = async () => {
    if (stopped || inFlight || document.hidden || options.enabled === false) return;
    inFlight = true;
    try {
      onData(await api(typeof path === 'function' ? path() : path));
    } catch (error) {
      onError(error);
    } finally {
      inFlight = false;
    }
  };

  const onVisibility = () => {
    if (!document.hidden) run();
  };

  run();
  if (interval) timer = window.setInterval(run, interval);
  document.addEventListener('visibilitychange', onVisibility);

  const stop = () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  state.routeCleanup.push(stop);
  return { run, stop };
}

export function debounce(callback, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}

export function toast(message, tone = 'neutral') {
  const root = document.querySelector('#toast-root');
  if (!root) return;
  const item = document.createElement('div');
  item.className = `toast toast--${tone}`;
  item.setAttribute('role', tone === 'negative' ? 'alert' : 'status');
  item.textContent = message;
  root.append(item);
  requestAnimationFrame(() => item.classList.add('is-visible'));
  window.setTimeout(() => {
    item.classList.remove('is-visible');
    window.setTimeout(() => item.remove(), 250);
  }, 4200);
}

export function openModal({ title, eyebrow = '', content, actions = '', className = '', onClose }) {
  const root = document.querySelector('#overlay-root');
  const previous = document.activeElement;
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-layer';
  wrapper.innerHTML = `
    <div class="modal-backdrop" data-modal-close></div>
    <section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal__header">
        <div>${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}<h2 id="modal-title">${escapeHtml(title)}</h2></div>
        <button class="icon-button" type="button" data-modal-close aria-label="Close dialog">${icon('close')}</button>
      </header>
      <div class="modal__body">${content}</div>
      ${actions ? `<footer class="modal__actions">${actions}</footer>` : ''}
    </section>`;
  root.append(wrapper);
  document.documentElement.classList.add('has-modal');

  const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const close = () => {
    wrapper.remove();
    document.documentElement.classList.remove('has-modal');
    document.removeEventListener('keydown', onKeydown);
    previous?.focus?.();
    onClose?.();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
    if (event.key !== 'Tab') return;
    const focusable = [...wrapper.querySelectorAll(focusableSelector)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  wrapper.querySelectorAll('[data-modal-close]').forEach((item) => item.addEventListener('click', close));
  document.addEventListener('keydown', onKeydown);
  requestAnimationFrame(() => {
    wrapper.classList.add('is-open');
    wrapper.querySelector(focusableSelector)?.focus();
  });
  return { element: wrapper, close };
}

export function icon(name) {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="4"/><rect x="14" y="11" width="7" height="10"/><rect x="3" y="14" width="7" height="7"/>',
    watchlist: '<path d="M4 19V5"/><path d="M9 19V9"/><path d="M14 19V3"/><path d="M19 19v-6"/>',
    charts: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 2 5-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.6v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.1a1.7 1.7 0 0 0 1.1 1.5 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.36.3.58.72.6 1.2v3.6c-.02.48-.24.9-.6 1.2Z"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    arrow: '<path d="M5 12h14"/><path d="m14 7 5 5-5 5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    stop: '<rect x="6" y="6" width="12" height="12"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h7"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.arrow}</svg>`;
}

export function pageHeader(eyebrow, title, description, actions = '') {
  return `
    <header class="page-header reveal">
      <div>
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(title)}</h1>
        ${description ? `<p class="page-header__lede">${escapeHtml(description)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-header__actions">${actions}</div>` : ''}
    </header>`;
}

export function panel({ eyebrow = '', title = '', actions = '', content = '', className = '', attrs = '' }) {
  return `
    <section class="panel reveal ${className}" ${attrs}>
      ${title || eyebrow || actions ? `<header class="panel__header"><div>${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}${title ? `<h2>${escapeHtml(title)}</h2>` : ''}</div>${actions}</header>` : ''}
      <div class="panel__body">${content}</div>
    </section>`;
}

export function stat(label, value = '—', note = '', tone = 'neutral', attrs = '') {
  return `<article class="stat reveal" ${attrs}><p>${escapeHtml(label)}</p><strong class="mono ${tone === 'positive' || tone === 'negative' ? `text-${tone}` : ''}">${escapeHtml(value)}</strong>${note ? `<span>${escapeHtml(note)}</span>` : ''}</article>`;
}

export function emptyState(title, copy, action = '') {
  return `<div class="empty-state"><span class="empty-state__line" aria-hidden="true"></span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p>${action}</div>`;
}

export function skeleton(rows = 4) {
  return `<div class="skeleton-list" aria-label="Loading">${Array.from({ length: rows }, () => '<span></span>').join('')}</div>`;
}

export function appShell(path, content, options = {}) {
  const user = state.user;
  const profile = state.profile;
  const tier = state.entitlements?.effectiveTier ?? state.entitlements?.tier ?? 'free';
  const admin = ['ADMIN', 'DEVELOPER'].includes(String(profile?.role ?? '').toUpperCase());
  const nav = navItems.map(([key, label, href]) => `
    <a class="app-nav__link ${path === href ? 'is-active' : ''}" href="${href}" data-link data-tour="nav-${key}" aria-current="${path === href ? 'page' : 'false'}">
      ${icon(key)}<span>${label}</span>
    </a>`).join('');

  return `
    <div class="app-layout">
      <header class="app-topbar">
        ${brandLink('/', 'brand brand--small', 'Autotrade home')}
        <div class="app-topbar__status" id="global-bot-status">${badge('Checking bot', 'neutral')}</div>
        <div class="app-topbar__actions">
          ${tier === 'free' ? '<button class="button button--quiet button--small" type="button" data-upgrade>Upgrade</button>' : `<span class="tier-label">${escapeHtml(tier)}</span>`}
          <a class="avatar-link" href="/account" data-link aria-label="Open account">${escapeHtml((user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? 'A').toUpperCase())}</a>
        </div>
      </header>
      <aside class="app-sidebar">
        <nav class="app-nav" aria-label="Primary">${nav}${admin ? `<a class="app-nav__link ${path === '/admin' ? 'is-active' : ''}" href="/admin" data-link>${icon('account')}<span>Admin</span></a>` : ''}</nav>
        <p class="app-sidebar__note">Paper first.<br />Live when you authorize.</p>
      </aside>
      <main id="main-content" class="app-main ${options.wide ? 'app-main--wide' : ''}" tabindex="-1">${content}</main>
      <nav class="mobile-nav" aria-label="Primary">${nav}</nav>
    </div>`;
}

export async function initClerk() {
  if (state.clerk) return state.clerk;
  if (!__CLERK_PUBLISHABLE_KEY__) return null;
  const { Clerk } = await import('@clerk/clerk-js');
  const clerk = new Clerk(__CLERK_PUBLISHABLE_KEY__);
  await clerk.load();
  state.clerk = clerk;
  state.user = clerk.user;
  clerk.addListener(({ user }) => {
    state.user = user;
    emitState();
  });
  return clerk;
}

export async function bootstrapAuthenticatedState() {
  const [profile, entitlements, subscription] = await Promise.allSettled([
    api('/users/me'),
    api('/subscription/entitlements'),
    api('/subscription'),
  ]);
  state.profile = profile.status === 'fulfilled' ? profile.value : null;
  state.entitlements = entitlements.status === 'fulfilled' ? entitlements.value : null;
  state.subscription = subscription.status === 'fulfilled' ? subscription.value : null;
  emitState();
}

export async function syncUser() {
  const key = `autotrade-user-sync:${state.user?.id ?? 'none'}`;
  if (!state.user || sessionStorage.getItem(key)) return;
  await mutate('/auth/clerk-sync').catch(() => {});
  sessionStorage.setItem(key, '1');
}

export function cleanupRoute() {
  state.routeCleanup.splice(0).forEach((cleanup) => {
    try {
      cleanup?.();
    } catch {
      // Route teardown should not block the next render.
    }
  });
}

export function bindGlobalShell() {
  // Slow global status poll — dashboard feed also refreshes this badge when mounted.
  createPoll('/bot-settings/status', 60_000, (data) => {
    const node = document.querySelector('#global-bot-status');
    if (node) node.innerHTML = badge(data.running ? `${data.mode} running` : 'Bot stopped', data.running ? 'positive' : 'negative');
  });
}

export function updateGlobalBotStatus(bot) {
  const node = document.querySelector('#global-bot-status');
  if (!node || !bot) return;
  node.innerHTML = badge(bot.running ? `${bot.mode} running` : 'Bot stopped', bot.running ? 'positive' : 'negative');
}
