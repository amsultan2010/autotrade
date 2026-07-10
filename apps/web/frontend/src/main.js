import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './styles.css';
import {
  APP_ROUTES,
  PUBLIC_ROUTES,
  appShell,
  bindGlobalShell,
  bootstrapAuthenticatedState,
  cleanupRoute,
  icon,
  initClerk,
  openModal,
  state,
  syncUser,
} from './core.js';
import { authPage, landingPage, legalPage } from './public-pages.js';
import { maybeStartOverlays, openUpgrade } from './overlays.js';

gsap.registerPlugin(ScrollTrigger);

const app = document.querySelector('#app');
let rendering = false;
let authenticatedBootstrapped = false;

const productRouteNames = {
  '/dashboard': 'dashboardPage',
  '/watchlist': 'watchlistPage',
  '/charts': 'chartsPage',
  '/history': 'historyPage',
  '/settings': 'settingsPage',
  '/account': 'accountPage',
  '/admin': 'adminPage',
};
let posthog;

function normalizePath(pathname) {
  if (pathname.startsWith('/sign-in')) return '/sign-in';
  if (pathname.startsWith('/sign-up')) return '/sign-up';
  if (pathname.length > 1) return pathname.replace(/\/+$/, '');
  return pathname;
}

export function navigate(path, options = {}) {
  if (location.pathname === path && !options.replace) return;
  if (options.replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  renderRoute();
}

function bindLinks(root = document) {
  root.querySelectorAll('a[data-link]').forEach((link) => {
    if (link.dataset.bound) return;
    link.dataset.bound = 'true';
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || link.target === '_blank') return;
      const url = new URL(link.href, location.origin);
      if (url.origin !== location.origin) return;
      event.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    });
  });
}

function bindUpgrade(root = document) {
  root.querySelectorAll('[data-upgrade]').forEach((button) => {
    if (button.dataset.upgradeBound) return;
    button.dataset.upgradeBound = 'true';
    button.addEventListener('click', () => openUpgrade(button.dataset.upgradeReason ?? ''));
  });
}

function runPageMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = [...document.querySelectorAll('.app-main .reveal')];
  if (!nodes.length) return;
  gsap.fromTo(nodes, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.65, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity' });
}

function notFoundPage() {
  return {
    title: 'Page not found - Autotrade',
    html: `
      <main id="main-content" class="finale" tabindex="-1">
        <p class="eyebrow">404</p><h2>That route moved.</h2>
        <div><a class="button button--primary" href="/" data-link><span>Return home</span>${icon('arrow')}</a></div>
      </main>`,
  };
}

function authUnavailablePage() {
  return {
    title: 'Configuration required - Autotrade',
    html: appShell(location.pathname, `
      <div class="finale"><p class="eyebrow">Local configuration</p><h2>Authentication key missing.</h2><p style="max-width:620px;color:var(--ash);line-height:1.65">Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to apps/web/.env.local, then restart the local server.</p></div>`),
  };
}

async function resolvePage(path) {
  if (path === '/') return landingPage();
  if (path === '/sign-in') return authPage('sign-in');
  if (path === '/sign-up') return authPage('sign-up');
  if (['/privacy', '/terms', '/risk-disclosure'].includes(path)) return legalPage(path);
  if (productRouteNames[path]) {
    const pages = await import('./product-pages.js');
    return pages[productRouteNames[path]]();
  }
  return notFoundPage();
}

async function renderRoute() {
  if (rendering) return;
  rendering = true;
  cleanupRoute();
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  document.querySelector('.tour-layer')?.remove();
  try {
    const path = normalizePath(location.pathname);
    const protectedRoute = APP_ROUTES.includes(path);
    const clerk = await initClerk().catch(() => null);
    state.user = clerk?.user ?? null;

    if (protectedRoute && !clerk) {
      const page = authUnavailablePage();
      document.title = page.title;
      app.innerHTML = page.html;
      bindLinks();
      return;
    }
    if (protectedRoute && !state.user) {
      navigate(`/sign-in?redirect_url=${encodeURIComponent(location.href)}`, { replace: true });
      return;
    }
    if (protectedRoute && !authenticatedBootstrapped) {
      await syncUser();
      await bootstrapAuthenticatedState();
      authenticatedBootstrapped = true;
    }

    const page = await resolvePage(path);
    document.title = page.title;
    app.innerHTML = page.html;
    bindLinks();
    bindUpgrade();
    const pageCleanup = await page.mount?.();
    if (pageCleanup) state.routeCleanup.push(pageCleanup);
    if (protectedRoute) {
      bindGlobalShell();
      maybeStartOverlays(navigate);
    }
    runPageMotion();
    document.querySelector('#main-content')?.focus({ preventScroll: true });
    if (posthog) posthog.capture('$pageview', { $current_url: location.href });
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <main id="main-content" class="finale" tabindex="-1">
        <p class="eyebrow">Something interrupted the page</p>
        <h2>Try that again.</h2>
        <p style="max-width:620px;color:var(--ash);line-height:1.65">${String(error?.message ?? 'The interface could not be rendered.')}</p>
        <div><button class="button button--primary" type="button" id="retry-page"><span>Reload page</span></button></div>
      </main>`;
    document.querySelector('#retry-page')?.addEventListener('click', () => location.reload());
  } finally {
    rendering = false;
  }
}

window.autotrade = {
  navigate,
  bindLinks,
  bindUpgrade,
  openUpgrade,
  openModal,
};

if (__POSTHOG_KEY__) import('posthog-js').then(({ default: client }) => {
  posthog = client;
  posthog.init(__POSTHOG_KEY__, {
    api_host: __POSTHOG_HOST__,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: 'identified_only',
  });
});

window.addEventListener('popstate', renderRoute);
window.addEventListener('error', (event) => {
  posthog?.captureException?.(event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  posthog?.captureException?.(event.reason);
});

renderRoute();
