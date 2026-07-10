import {
  api,
  badge,
  escapeHtml,
  icon,
  mutate,
  openModal,
  plans,
  state,
  toast,
} from './core.js';

const TOUR_KEY = 'autotrade-product-tour-index';
const GUIDE_SKIP_KEY = 'autotrade-guide-deferred';

const tourSteps = [
  ['/dashboard', '[data-tour="dashboard"]', 'Dashboard', 'Portfolio value, signals, open positions, and performance live here.'],
  ['/dashboard', '[data-tour="bot-controls"]', 'Start the bot', 'Start Bot begins automatic scans. Stop anytime without losing your settings.'],
  ['/dashboard', '[data-tour="signals"]', 'Signal feed', 'Approved patterns show direction, strategy, and confidence here.'],
  ['/dashboard', '[data-tour="portfolio"]', 'Portfolio', 'Track equity over time from Alpaca or the built-in paper simulator.'],
  ['/dashboard', '[data-tour="nav-watchlist"]', 'Watchlist', 'The bot only scans symbols you approve. Next, add some.'],
  ['/watchlist', '[data-tour="watchlist-search"]', 'Build your watchlist', 'Search stocks and crypto, then add symbols for the bot to scan.'],
  ['/watchlist', '[data-tour="nav-history"]', 'Trade history', 'Every trade is logged with reason, timing, and result.'],
  ['/history', '[data-tour="trade-history"]', 'Review trades', 'Filter results, inspect details, and close open trades at market.'],
  ['/history', '[data-tour="nav-settings"]', 'Settings', 'Control risk, execution, scan speed, and strategies.'],
  ['/settings', '[data-tour="strategies"]', 'Choose strategies', 'Use a preset or pick individual stock and crypto strategies.'],
  ['/settings', '[data-tour="alpaca-connect"]', 'Connect Alpaca', 'Start with paper keys. Live stays off until you turn it on.'],
];

export function openUpgrade(reason = '') {
  const entitlements = state.entitlements ?? {};
  const current = entitlements.currentPlan ?? entitlements.effectiveTier ?? 'free';
  const billingEnabled = entitlements.billingEnabled !== false;
  const modal = openModal({
    title: 'Upgrade your plan',
    eyebrow: 'Plans',
    className: 'modal--wide',
    content: `
      ${reason ? `<div class="alert">${escapeHtml(reason)}</div>` : ''}
      ${billingEnabled ? '' : '<div class="alert alert--danger">Billing is temporarily unavailable. Your current access is unchanged.</div>'}
      <div class="plan-grid">
        ${plans.map((plan) => `
          <article class="plan-card" style="--plan-accent:${plan.accent}">
            <p class="eyebrow">${current === plan.id ? 'Current plan' : 'Monthly'}</p>
            <h3>${plan.name}</h3>
            <span class="plan-card__price">$${plan.price}<small>/month</small></span>
            <ul>${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
            <button class="button ${current === plan.id ? 'button--quiet' : 'button--primary'} button--block" type="button" data-plan="${plan.id}" ${current === plan.id || !billingEnabled ? 'disabled' : ''}><span>${current === plan.id ? 'Current plan' : current === 'free' ? 'Choose plan' : 'Change plan'}</span></button>
          </article>`).join('')}
      </div>
      <p style="margin:24px 0 0;color:var(--ash);font-size:13px;line-height:1.6">Plans unlock scan speed, strategies, and analytics. Live trading can lose money.</p>`,
  });
  modal.element.querySelectorAll('[data-plan]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    button.querySelector('span').textContent = 'Preparing…';
    try {
      const endpoint = entitlements.currentPlan ? '/subscription/change' : '/subscription/checkout';
      const result = await mutate(endpoint, 'POST', { tier: button.dataset.plan });
      if (result.url) {
        location.assign(result.url);
      } else {
        toast('Plan updated', 'positive');
        modal.close();
        setTimeout(() => location.reload(), 500);
      }
    } catch (error) {
      toast(error.message, 'negative');
      button.disabled = false;
      button.querySelector('span').textContent = entitlements.currentPlan ? 'Change plan' : 'Choose plan';
    }
  }));
}

async function completeGuide(startTour, navigate) {
  await mutate('/users/me', 'PATCH', { alpacaGuideCompleted: true }).catch(() => {});
  state.profile = { ...state.profile, alpacaGuideCompleted: true };
  if (startTour) {
    sessionStorage.setItem(TOUR_KEY, '0');
    window.setTimeout(() => startProductTour(navigate, 0), 350);
  }
}

export function startAlpacaGuide(navigate) {
  let step = 0;
  let broker = null;
  const steps = [
    {
      eyebrow: 'Step 1 of 4',
      title: 'Begin with a safe route',
      copy: 'Autotrade works immediately with its built-in paper simulator. Connecting Alpaca adds broker-backed paper data and, only when entitled, live execution.',
      content: '<div class="alert">Paper first. Live only when you authorize it.</div>',
    },
    {
      eyebrow: 'Step 2 of 4',
      title: 'Create Alpaca paper keys',
      copy: 'In Alpaca, switch to Paper Trading and create API keys. Keep that tab open; the secret is shown once.',
      content: '<a class="button button--outline" href="https://app.alpaca.markets" target="_blank" rel="noreferrer"><span>Open Alpaca</span></a>',
    },
    {
      eyebrow: 'Step 3 of 4',
      title: 'Connect the paper account',
      copy: 'Paste paper credentials below. They are encrypted at rest and cannot be viewed again.',
      content: `<div class="form-stack"><div class="field"><label for="guide-key">API key ID</label><input id="guide-key" class="input" autocomplete="off"/></div><div class="field"><label for="guide-secret">Secret key</label><input id="guide-secret" class="input" type="password" autocomplete="new-password"/></div><div id="guide-status"></div></div>`,
    },
    {
      eyebrow: 'Step 4 of 4',
      title: 'Your controls are ready',
      copy: 'Next, take a short tour of the dashboard, watchlist, history, and settings.',
      content: '<div class="alert alert--success">Setup complete. You can reconnect or change Alpaca credentials later in Settings.</div>',
    },
  ];
  const modal = openModal({ title: steps[0].title, eyebrow: steps[0].eyebrow, content: '', actions: '' });

  const render = () => {
    const data = steps[step];
    modal.element.querySelector('#modal-title').textContent = data.title;
    const headerEyebrow = modal.element.querySelector('.modal__header .eyebrow');
    if (headerEyebrow) headerEyebrow.textContent = data.eyebrow;
    modal.element.querySelector('.modal__body').innerHTML = `
      <div class="onboarding-progress">${steps.map((_, index) => `<span class="${index <= step ? 'is-done' : ''}"></span>`).join('')}</div>
      <p style="font-size:18px;line-height:1.65;color:var(--paper-dim)">${escapeHtml(data.copy)}</p>
      <div style="margin-top:28px">${data.content}</div>`;
    let footer = modal.element.querySelector('.modal__actions');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'modal__actions';
      modal.element.querySelector('.modal').append(footer);
    }
    footer.innerHTML = `
      <button class="button button--quiet" type="button" id="guide-skip"><span>${step === 3 ? 'Close' : 'Skip for now'}</span></button>
      <div style="display:flex;gap:8px">
        ${step > 0 ? '<button class="button button--outline" id="guide-back" type="button"><span>Back</span></button>' : ''}
        <button class="button button--primary" id="guide-next" type="button"><span>${step === 2 ? 'Connect and continue' : step === 3 ? 'Start tour' : 'Continue'}</span></button>
      </div>`;
    footer.querySelector('#guide-skip').addEventListener('click', async () => {
      sessionStorage.setItem(GUIDE_SKIP_KEY, '1');
      if (step === 3) await completeGuide(false, navigate);
      modal.close();
    });
    footer.querySelector('#guide-back')?.addEventListener('click', () => { step -= 1; render(); });
    footer.querySelector('#guide-next').addEventListener('click', async (event) => {
      if (step === 2) {
        const keyId = modal.element.querySelector('#guide-key').value.trim();
        const secret = modal.element.querySelector('#guide-secret').value.trim();
        if (!keyId || !secret) {
          modal.element.querySelector('#guide-status').innerHTML = '<div class="alert alert--danger">Enter both Alpaca paper credentials.</div>';
          return;
        }
        event.currentTarget.disabled = true;
        try {
          broker = await mutate('/broker/connect', 'POST', { keyId, secret, paper: true });
          await mutate('/broker/sync', 'POST');
        } catch (error) {
          modal.element.querySelector('#guide-status').innerHTML = `<div class="alert alert--danger">${escapeHtml(error.message)}</div>`;
          event.currentTarget.disabled = false;
          return;
        }
      }
      if (step === 3) {
        await completeGuide(true, navigate);
        modal.close();
        return;
      }
      step += 1;
      render();
    });
  };
  render();
  return broker;
}

function finishTour() {
  sessionStorage.removeItem(TOUR_KEY);
  document.querySelector('.tour-layer')?.remove();
  mutate('/users/me', 'PATCH', { productTourCompleted: true }).catch(() => {});
  state.profile = { ...state.profile, productTourCompleted: true };
  toast('Tour complete. Your workspace is ready.', 'positive');
}

export function startProductTour(navigate, index = Number(sessionStorage.getItem(TOUR_KEY) ?? 0)) {
  if (!Number.isFinite(index) || index < 0 || index >= tourSteps.length) return finishTour();
  const [route, selector, title, copy] = tourSteps[index];
  sessionStorage.setItem(TOUR_KEY, String(index));
  if (location.pathname !== route) {
    navigate(route);
    return;
  }
  document.querySelector('.tour-layer')?.remove();
  const target = document.querySelector(selector);
  if (!target) {
    window.setTimeout(() => startProductTour(navigate, index), 500);
    return;
  }
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  window.setTimeout(() => {
    const rect = target.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'tour-layer';
    const cardWidth = Math.min(360, window.innerWidth - 32);
    const left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.left));
    const preferredTop = rect.bottom + 16;
    const top = preferredTop + 260 < window.innerHeight ? preferredTop : Math.max(16, rect.top - 272);
    layer.innerHTML = `
      <div class="tour-spotlight" style="left:${Math.max(4, rect.left - 6)}px;top:${Math.max(4, rect.top - 6)}px;width:${Math.min(window.innerWidth - 8, rect.width + 12)}px;height:${rect.height + 12}px"></div>
      <section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" style="left:${left}px;top:${top}px">
        <p class="eyebrow">Tour ${index + 1} of ${tourSteps.length}</p>
        <h3 id="tour-title">${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p>
        <div class="tour-card__actions">
          <button class="button button--quiet button--small" type="button" data-tour-skip><span>Skip</span></button>
          <div style="display:flex;gap:6px">${index > 0 ? '<button class="button button--outline button--small" type="button" data-tour-back><span>Back</span></button>' : ''}<button class="button button--primary button--small" type="button" data-tour-next><span>${index === tourSteps.length - 1 ? 'Finish' : 'Next'}</span></button></div>
        </div>
      </section>`;
    document.body.append(layer);
    layer.querySelector('[data-tour-skip]').addEventListener('click', finishTour);
    layer.querySelector('[data-tour-back]')?.addEventListener('click', () => startProductTour(navigate, index - 1));
    layer.querySelector('[data-tour-next]').addEventListener('click', () => {
      if (index === tourSteps.length - 1) finishTour();
      else startProductTour(navigate, index + 1);
    });
    layer.querySelector('[data-tour-next]').focus();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 500);
}

export function maybeStartOverlays(navigate) {
  if (!state.user || !state.profile) return;
  const activeTour = sessionStorage.getItem(TOUR_KEY);
  if (activeTour != null) {
    window.setTimeout(() => startProductTour(navigate, Number(activeTour)), 350);
    return;
  }
  if (state.profile.alpacaGuideCompleted === false && !sessionStorage.getItem(GUIDE_SKIP_KEY)) {
    window.setTimeout(() => startAlpacaGuide(navigate), 300);
    return;
  }
  if (state.profile.alpacaGuideCompleted && state.profile.productTourCompleted === false) {
    sessionStorage.setItem(TOUR_KEY, '0');
    window.setTimeout(() => startProductTour(navigate, 0), 350);
  }
}
