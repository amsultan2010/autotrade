import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  brandLink,
  escapeHtml,
  icon,
  initClerk,
  state,
} from './core.js';

gsap.registerPlugin(ScrollTrigger);

const productFeatures = [
  ['01', 'Signal Radar', 'Multi-timeframe pattern recognition with live confidence scores across equities, ETFs, and crypto.'],
  ['02', 'Execution Core', 'Orders route through Alpaca paper or live. Fast fills with your risk limits applied first.'],
  ['03', 'Risk Vault', 'Drawdown limits, position caps, stop loss, take profit, and a kill switch when you need it.'],
  ['04', 'Strategy Lab', 'Pick presets or individual strategies. Back your setup with paper capital before going live.'],
  ['05', 'Paper Sim', 'Start with $100k simulated capital. Connect Alpaca when you are ready for broker-backed paper or live.'],
  ['06', 'Trade History', 'Every entry and exit is logged with strategy, confidence, P&L, and the reason behind the trade.'],
];

const controlRows = [
  ['Max active trades', '5', 'Caps how many positions can stay open at once.'],
  ['Risk per trade', '1.0%', 'Position size scales from your equity and stop.'],
  ['Min confidence', '50%', 'Signals below this threshold never fire.'],
  ['Daily loss cap', '$2,000', 'Bot stops taking new risk when the day is done.'],
  ['Stop / take-profit', '2% / 4%', 'Defaults applied before every entry.'],
  ['Scan interval', 'Plan-based', 'Faster scans unlock on higher plans.'],
];

const presets = [
  ['Balanced', 'Core stock + crypto mix. Trend, momentum, and mean reversion.'],
  ['Conservative', 'Fewer strategies. Higher confidence bar.'],
  ['Aggressive', 'Core + experimental. Lower confidence bar.'],
  ['Trend Hunter', 'Momentum and breakout focused.'],
  ['Stocks Only', 'Full stock suite. Crypto off.'],
  ['Crypto Only', 'Core crypto strategies. Runs 24/7.'],
];

const faqs = [
  ['Is Autotrade free to start?', 'Yes. Paper-trade with $100k simulated capital. Connect Alpaca when ready for live execution.'],
  ['Which brokers are supported?', 'Alpaca is fully integrated (paper + live). IBKR is on the roadmap.'],
  ['How do AI signals work?', 'The engine scans price, volume, and sentiment. When confidence exceeds your thresholds, a signal fires with entry, stop, and target.'],
  ['Are API keys secure?', 'Encrypted at rest. Never exposed client-side. Server-only execution.'],
  ['Can I stop the bot anytime?', 'Yes. Stop Bot freezes new entries. Open positions stay manageable from History and Settings.'],
  ['What happens if I go live?', 'Live mode routes orders to your Alpaca account. Paper stays the default until you switch it on in Settings.'],
];

function marketingNav() {
  const signedIn = Boolean(state.user);
  return `
    <nav class="marketing-nav" aria-label="Main navigation">
      ${brandLink('/', 'brand')}
      <div class="marketing-nav__links">
        <a class="nav-link" href="#pipeline">Pipeline</a>
        <a class="nav-link" href="#controls">Controls</a>
        <a class="nav-link" href="#modules">Modules</a>
        <a class="nav-link" href="#vault">FAQ</a>
      </div>
      <div class="marketing-nav__actions">
        ${signedIn
          ? '<a class="button button--primary button--small" href="/dashboard" data-link><span>Launch Console</span></a>'
          : '<a class="nav-link" href="/sign-in" data-link>Sign In</a><a class="button button--primary button--small" href="/sign-up" data-link><span>Create Account</span></a>'}
      </div>
      <button class="icon-button mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded="false">${icon('menu')}</button>
    </nav>`;
}

function buildCandleField(count = 42) {
  const width = 1200;
  const height = 520;
  const gap = width / count;
  let price = 56;
  const candles = [];
  for (let i = 0; i < count; i += 1) {
    const drift = (Math.sin(i * 0.37) + Math.cos(i * 0.19)) * 3.2 + (Math.random() - 0.48) * 4.5;
    const open = price;
    const close = Math.max(18, Math.min(92, open + drift));
    const high = Math.max(open, close) + 1.5 + Math.random() * 3.5;
    const low = Math.min(open, close) - 1.5 - Math.random() * 3.5;
    const up = close >= open;
    const x = gap * i + gap * 0.28;
    const bodyTop = height - Math.max(open, close) * (height / 100);
    const bodyBottom = height - Math.min(open, close) * (height / 100);
    const bodyH = Math.max(4, bodyBottom - bodyTop);
    const wickTop = height - high * (height / 100);
    const wickBottom = height - low * (height / 100);
    candles.push(`
      <g class="candle ${up ? 'is-up' : 'is-down'}" style="--i:${i}">
        <line class="candle__wick" x1="${x + 5}" y1="${wickTop}" x2="${x + 5}" y2="${wickBottom}" />
        <rect class="candle__body" x="${x}" y="${bodyTop}" width="10" height="${bodyH}" rx="1" />
      </g>`);
    price = close;
  }
  return `
    <svg class="candle-field" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="candle-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#090a0a" stop-opacity="0.15"/>
          <stop offset="55%" stop-color="#090a0a" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#090a0a" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      ${candles.join('')}
      <rect width="${width}" height="${height}" fill="url(#candle-fade)" />
    </svg>`;
}

export function landingPage() {
  const ctaHref = state.user ? '/dashboard' : '/sign-up';
  const ctaLabel = state.user ? 'Launch Console' : 'Create Account';
  return {
    title: 'Autotrade - AI-powered automated trading bot',
    html: `
      ${marketingNav()}
      <main id="main-content" class="landing-main" tabindex="-1">
        <section class="hero">
          <div class="hero__candles" aria-hidden="true">${buildCandleField()}</div>
          <p class="hero__index">Autonomous trading system</p>
          <div class="hero__headline">
            <h1 aria-label="Trade the markets without fear">
              <span class="line"><span>TRADE</span></span>
              <span class="line"><span class="accent">THE MARKETS</span></span>
              <span class="line"><span class="accent-red">WITHOUT FEAR</span></span>
            </h1>
          </div>
          <div class="hero__aside">
            <p>AI signals, risk limits, and Alpaca execution. Paper first. Live when you authorize.</p>
            <div class="hero__actions">
              <a class="button button--primary" href="${ctaHref}" data-link><span>${ctaLabel}</span>${icon('arrow')}</a>
              <a class="button button--outline" href="#pipeline"><span>View Pipeline</span></a>
            </div>
            <ul class="hero__meta">
              <li><strong>$100k</strong><span>paper capital</span></li>
              <li><strong>Alpaca</strong><span>paper + live</span></li>
              <li><strong>Kill switch</strong><span>always yours</span></li>
            </ul>
          </div>
        </section>

        <div class="marquee" aria-hidden="true">
          <div class="marquee__track">
            <span><i></i> NVDA <b class="text-positive">+3.67%</b> <i class="dot-red"></i> AAPL <b class="text-positive">+1.24%</b> <i></i> TSLA <b class="text-negative">-2.18%</b> <i class="dot-red"></i> SPY <b class="text-positive">+0.44%</b> <i></i> BTC <b class="text-positive">+2.34%</b> <i class="dot-red"></i> ETH <b class="text-negative">-0.82%</b> <i></i> MSFT <b class="text-positive">+0.91%</b> <i class="dot-red"></i> QQQ <b class="text-positive">+0.62%</b></span>
            <span><i></i> NVDA <b class="text-positive">+3.67%</b> <i class="dot-red"></i> AAPL <b class="text-positive">+1.24%</b> <i></i> TSLA <b class="text-negative">-2.18%</b> <i class="dot-red"></i> SPY <b class="text-positive">+0.44%</b> <i></i> BTC <b class="text-positive">+2.34%</b> <i class="dot-red"></i> ETH <b class="text-negative">-0.82%</b> <i></i> MSFT <b class="text-positive">+0.91%</b> <i class="dot-red"></i> QQQ <b class="text-positive">+0.62%</b></span>
          </div>
        </div>

        <section class="proof-strip" aria-label="Product facts">
          ${[
            ['01', 'Watchlist-gated', 'The bot only scans symbols you add.'],
            ['02', 'Confidence-gated', 'Weak setups never reach execution.'],
            ['03', 'Risk-first sizing', 'Stops and caps apply before the order.'],
            ['04', 'Full trade log', 'Strategy, reason, and P&L on every fill.'],
          ].map(([n, title, copy]) => `
            <article class="proof-strip__item">
              <span>${n}</span>
              <strong>${title}</strong>
              <p>${copy}</p>
            </article>`).join('')}
        </section>

        <section class="statement">
          <div class="statement__label"><p class="eyebrow">How it works</p></div>
          <p class="statement__copy">Scan your watchlist. Score confidence. Size risk. Execute through Alpaca. <span>You keep the controls.</span></p>
        </section>

        <section id="pipeline" class="pipeline">
          <div class="section-heading">
            <p class="eyebrow">Pipeline</p>
            <h2>From scan<br />to fill.</h2>
          </div>
          <div class="signal-trace" aria-hidden="true"><div class="signal-trace__progress"></div></div>
          <div class="pipeline__steps">
            ${[
              ['01', 'Market Ingest', 'Your watchlist streams in with price, volume, and sentiment. The bot only scans symbols you approve.', 'Watchlist', 'Stocks, ETFs, and crypto'],
              ['02', 'Neural Analysis', 'The pattern engine scores momentum, mean reversion, and regime shifts. Confidence thresholds gate every signal.', 'Confidence gate', 'Your min confidence applies'],
              ['03', 'Signal Forge', 'Entry, stop, target, and position size are computed from your risk profile. Every signal is auditable.', 'Auditable', 'Strategy + reason on every trade'],
              ['04', 'Execution Core', 'Orders route to the paper simulator or Alpaca. Live stays off until you turn it on.', 'Paper default', 'Live stays off until you enable it'],
              ['05', 'Risk Management', 'Trailing stops, daily loss caps, and active-trade limits keep positions managed until exit.', 'Kill switch', 'Stop the bot anytime'],
            ].map(([number, title, copy, proof, note]) => `
              <article class="pipeline-step">
                <span class="pipeline-step__number">${number}</span>
                <div class="pipeline-step__content"><h3>${title}</h3><p>${copy}</p></div>
                <div class="pipeline-step__proof"><strong>${proof}</strong><span>${note}</span></div>
              </article>`).join('')}
          </div>
        </section>

        <section id="controls" class="controls-section">
          <div class="section-heading">
            <p class="eyebrow">Controls</p>
            <h2>You set the<br />limits.</h2>
          </div>
          <div class="controls-layout">
            <div class="controls-copy">
              <p>Every scan still has to clear your risk profile. Change the knobs in Settings. The bot does not invent new rules mid-trade.</p>
              <a class="button button--outline" href="${ctaHref}" data-link><span>${ctaLabel}</span>${icon('arrow')}</a>
            </div>
            <div class="controls-grid">
              ${controlRows.map(([label, value, note], index) => `
                <article class="control-card" style="--i:${index}">
                  <p>${escapeHtml(label)}</p>
                  <strong>${escapeHtml(value)}</strong>
                  <span>${escapeHtml(note)}</span>
                </article>`).join('')}
            </div>
          </div>
        </section>

        <section class="mode-section">
          <div class="section-heading">
            <p class="eyebrow">Execution</p>
            <h2>Paper first.<br />Live later.</h2>
          </div>
          <div class="mode-grid">
            <article class="mode-card mode-card--paper">
              <p class="eyebrow">Default</p>
              <h3>Paper</h3>
              <p>$100k simulated capital on day one. Same signals, same risk limits, no real money.</p>
              <ul>
                <li>Built-in simulator ready immediately</li>
                <li>Optional Alpaca paper keys for broker-backed fills</li>
                <li>Full history, charts, and strategy logs</li>
              </ul>
            </article>
            <article class="mode-card mode-card--live">
              <p class="eyebrow">Gated</p>
              <h3>Live</h3>
              <p>Orders route to your Alpaca account only after you switch mode in Settings.</p>
              <ul>
                <li>Paid plan required for live routing</li>
                <li>Same stop, size, and confidence gates</li>
                <li>Stop Bot freezes new entries anytime</li>
              </ul>
            </article>
          </div>
        </section>

        <section class="console-section" aria-label="Console preview">
          <div class="section-heading">
            <p class="eyebrow">Console</p>
            <h2>What you see<br />after signup.</h2>
          </div>
          <div class="console-frame">
            <div class="console-frame__bar">
              <span></span><span></span><span></span>
              <strong>autotrade / dashboard</strong>
            </div>
            <div class="console-frame__body">
              <div class="console-stat"><p>Net equity</p><strong>$100,000</strong><span>Paper simulator</span></div>
              <div class="console-stat"><p>Open positions</p><strong>0</strong><span>Waiting for signal</span></div>
              <div class="console-stat"><p>Bot</p><strong class="text-positive">Ready</strong><span>Mode: PAPER</span></div>
              <div class="console-feed">
                <p class="eyebrow">Latest signals</p>
                <div class="console-feed__row"><span>NVDA</span><b class="text-positive">BUY</b><span>72%</span><span>trend_following_v2</span></div>
                <div class="console-feed__row"><span>SPY</span><b class="text-negative">SELL</b><span>64%</span><span>mean_reversion_v2</span></div>
                <div class="console-feed__row"><span>BTC/USD</span><b class="text-positive">BUY</b><span>69%</span><span>crypto_momentum</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="modules" class="pipeline">
          <div class="section-heading">
            <p class="eyebrow">Modules</p>
            <h2>Core systems.</h2>
          </div>
          <div class="feature-grid">
            ${productFeatures.map(([number, title, copy]) => `<article class="feature-card reveal"><span class="feature-card__number">${number}</span><h3>${title}</h3><p>${copy}</p></article>`).join('')}
          </div>
        </section>

        <section id="strategies" class="presets-section">
          <div class="section-heading">
            <p class="eyebrow">Strategies</p>
            <h2>Start with a<br />preset.</h2>
          </div>
          <div class="preset-rail">
            ${presets.map(([title, copy], index) => `
              <article class="preset-card" style="--i:${index}">
                <span>0${index + 1}</span>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(copy)}</p>
              </article>`).join('')}
          </div>
          <p class="presets-note">Or pick individual stock and crypto strategies in Settings. Experimental strategies unlock on Unlimited.</p>
        </section>

        <section id="vault" class="faq">
          <div class="section-heading">
            <p class="eyebrow">Vault</p>
            <h2>FAQ.</h2>
          </div>
          <div class="faq-list">
            ${faqs.map(([question, answer], index) => `
              <article class="faq-item">
                <button type="button" aria-expanded="false" aria-controls="faq-${index}">
                  <h3>${escapeHtml(question)}</h3>${icon('plus')}
                </button>
                <div class="faq-item__answer" id="faq-${index}"><div><p>${escapeHtml(answer)}</p></div></div>
              </article>`).join('')}
          </div>
        </section>

        <section class="finale">
          <p class="eyebrow">Paper first. Live when you authorize. No credit card.</p>
          <h2>Start the bot.<br />Keep the limits.</h2>
          <div class="finale__actions">
            <a class="button button--primary" href="${ctaHref}" data-link><span>${ctaLabel}</span>${icon('arrow')}</a>
            <a class="button button--outline" href="#controls"><span>See controls</span></a>
          </div>
        </section>
      </main>
      <footer class="site-footer">
        <div>${brandLink('/', 'brand brand--small')}<p>© 2026 Autotrade. Not financial advice.</p></div>
        <nav class="site-footer__links" aria-label="Legal">
          <a href="/privacy" data-link>Privacy</a><a href="/terms" data-link>Terms</a><a href="/risk-disclosure" data-link>Risk disclosure</a>
        </nav>
      </footer>`,
    mount() {
      const nav = document.querySelector('.marketing-nav');
      const menu = document.querySelector('.mobile-menu-button');
      menu?.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        menu.setAttribute('aria-expanded', String(open));
        menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      });
      document.querySelectorAll('.faq-item button').forEach((button) => {
        button.addEventListener('click', () => {
          const item = button.closest('.faq-item');
          const open = item.classList.toggle('is-open');
          button.setAttribute('aria-expanded', String(open));
        });
      });

      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelectorAll('.candle').forEach((candle) => candle.classList.add('is-visible'));
        return;
      }

      const context = gsap.context(() => {
        const candles = gsap.utils.toArray('.candle');
        gsap.set(candles, { transformOrigin: '50% 100%', scaleY: 0, opacity: 0 });
        gsap.to(candles, {
          scaleY: 1,
          opacity: 1,
          duration: 0.7,
          stagger: { each: 0.028, from: 'start' },
          ease: 'power3.out',
          delay: 0.15,
        });
        gsap.to('.hero__candles', {
          yPercent: 12,
          opacity: 0.35,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });

        gsap.from('.hero h1 .line > span', { yPercent: 115, duration: 1.15, stagger: 0.1, ease: 'power4.out' });
        gsap.from('.hero__aside, .hero__index, .hero__meta', {
          opacity: 0,
          y: 18,
          duration: 0.8,
          delay: 0.55,
          stagger: 0.1,
          ease: 'power3.out',
        });
        gsap.to('.marquee__track', { xPercent: -50, duration: 28, repeat: -1, ease: 'none' });

        gsap.from('.proof-strip__item', {
          opacity: 0,
          y: 28,
          stagger: 0.08,
          duration: 0.65,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.proof-strip', start: 'top 80%', once: true },
        });

        gsap.from('.statement__copy', {
          opacity: 0.18,
          y: 40,
          scrollTrigger: { trigger: '.statement', start: 'top 75%', end: 'center 48%', scrub: true },
        });

        gsap.to('.signal-trace__progress', {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: { trigger: '.pipeline__steps', start: 'top 55%', end: 'bottom 60%', scrub: true },
        });

        document.querySelectorAll('.pipeline-step').forEach((step) => {
          gsap.from(step.querySelectorAll('h3, p, .pipeline-step__proof'), {
            opacity: 0,
            y: 36,
            stagger: 0.08,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: { trigger: step, start: 'top 78%', once: true },
          });
        });

        gsap.from('.control-card', {
          opacity: 0,
          y: 30,
          stagger: 0.07,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.controls-grid', start: 'top 78%', once: true },
        });

        gsap.from('.mode-card', {
          opacity: 0,
          y: 40,
          stagger: 0.12,
          duration: 0.75,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.mode-grid', start: 'top 78%', once: true },
        });

        gsap.from('.console-frame', {
          opacity: 0,
          y: 48,
          scale: 0.985,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.console-section', start: 'top 75%', once: true },
        });
        gsap.from('.console-feed__row', {
          opacity: 0,
          x: -16,
          stagger: 0.1,
          duration: 0.5,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.console-feed', start: 'top 80%', once: true },
        });

        gsap.from('.feature-card', {
          opacity: 0,
          y: 28,
          stagger: 0.06,
          duration: 0.65,
          scrollTrigger: { trigger: '.feature-grid', start: 'top 78%', once: true },
        });

        gsap.from('.preset-card', {
          opacity: 0,
          y: 24,
          stagger: 0.06,
          duration: 0.55,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.preset-rail', start: 'top 82%', once: true },
        });

        gsap.from('.faq-item', {
          opacity: 0,
          y: 18,
          stagger: 0.05,
          duration: 0.5,
          scrollTrigger: { trigger: '.faq-list', start: 'top 82%', once: true },
        });

        gsap.from('.finale h2, .finale .eyebrow, .finale__actions', {
          opacity: 0,
          y: 28,
          stagger: 0.1,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.finale', start: 'top 75%', once: true },
        });
      });
      return () => context.revert();
    },
  };
}

export function authPage(mode) {
  const signIn = mode === 'sign-in';
  return {
    title: `${signIn ? 'Sign In' : 'Create Account'} - Autotrade`,
    html: `
      <main id="main-content" class="auth-page" tabindex="-1">
        <section class="auth-story">
          ${brandLink('/', 'brand')}
          <h1>${signIn ? 'Welcome back.' : 'Paper first.'}</h1>
          <p>${signIn ? 'Open your dashboard, check signals, and manage the bot.' : 'Create an account, build a watchlist, and paper-trade with $100k simulated capital. No credit card.'}</p>
        </section>
        <section class="auth-mount"><div id="clerk-auth"><div class="boot-screen"><span class="boot-mark"></span><span>Loading sign-in</span></div></div></section>
      </main>`,
    async mount() {
      const clerk = await initClerk();
      const mount = document.querySelector('#clerk-auth');
      if (!clerk) {
        mount.innerHTML = `<div class="alert alert--danger">Clerk is not configured. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to the web environment.</div>`;
        return;
      }
      if (clerk.user) {
        history.replaceState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }
      const appearance = {
        variables: {
          colorPrimary: '#00c896',
          colorBackground: '#151817',
          colorInputBackground: '#090a0a',
          colorText: '#f2f1ec',
          colorTextSecondary: '#8c918c',
          colorDanger: '#ff3b52',
          borderRadius: '0px',
          fontFamily: '"IBM Plex Sans Variable", sans-serif',
        },
        elements: {
          cardBox: 'shadow-none',
          card: 'shadow-none border border-solid border-white/10',
        },
      };
      if (signIn) {
        clerk.mountSignIn(mount, {
          routing: 'path',
          path: '/sign-in',
          signUpUrl: '/sign-up',
          fallbackRedirectUrl: '/dashboard',
          appearance,
        });
        return () => clerk.unmountSignIn(mount);
      }
      clerk.mountSignUp(mount, {
        routing: 'path',
        path: '/sign-up',
        signInUrl: '/sign-in',
        fallbackRedirectUrl: '/dashboard',
        appearance,
      });
      return () => clerk.unmountSignUp(mount);
    },
  };
}

const legalDocuments = {
  '/privacy': {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    updated: 'Last updated: July 7, 2026',
    sections: [
      ['What we collect', 'Account information from Clerk (email and user ID), trading configuration, watchlists, signals, and trade history stored in Supabase, broker API credentials encrypted at rest, and usage analytics via PostHog when enabled.'],
      ['How we use data', 'We use this data to operate the trading bot, display your dashboard, send optional email digests, improve reliability, and comply with legal obligations. We do not sell your personal information.'],
      ['Third parties', 'We use Clerk for authentication, Supabase for data storage, Vercel for hosting, Alpaca when you connect a brokerage account, Resend for email, Sentry for error monitoring, and PostHog for analytics. Each provider processes data under its own policies.'],
      ['Your choices', 'You may disable weekly digests in Settings, disconnect Alpaca keys, or request account deletion. EU and UK users may request access or deletion at <a href="mailto:abdullahmsultan1@gmail.com">abdullahmsultan1@gmail.com</a>.'],
      ['Contact', 'Questions can be sent to <a href="mailto:abdullahmsultan1@gmail.com">abdullahmsultan1@gmail.com</a>.'],
    ],
  },
  '/terms': {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    updated: 'Last updated: July 7, 2026',
    sections: [
      ['Agreement', 'By using Autotrade you agree to these terms. If you do not agree, do not use the service. Autotrade is software that helps automate trading workflows; we are not a broker-dealer or investment adviser.'],
      ['Eligibility', 'You must be at least 18 years old and legally able to enter contracts in your jurisdiction. You are responsible for compliance with local laws regarding automated trading.'],
      ['Trading risk', 'Trading securities and crypto involves substantial risk of loss. Past performance does not guarantee future results. Read our <a href="/risk-disclosure" data-link>Risk Disclosure</a> before enabling live trading.'],
      ['Your account', 'Keep credentials secure. You are responsible for activity under your account. Do not misuse the API or attempt to access another user’s data.'],
      ['Service availability', 'We strive for reliability but do not guarantee uninterrupted operation. Maintenance, market closures, or third-party outages may affect scans and execution.'],
      ['Limitation of liability', 'To the maximum extent permitted by law, Autotrade is provided “as is” without warranties. We are not liable for trading losses, missed signals, or indirect damages.'],
    ],
  },
  '/risk-disclosure': {
    eyebrow: 'Important',
    title: 'Risk Disclosure',
    updated: 'Read before enabling live trading',
    lead: 'Automated trading can amplify losses. Only trade with capital you can afford to lose.',
    sections: [
      ['No investment advice', 'Autotrade provides tools and signals, not personalized investment advice. Strategy outputs are algorithmic and may be wrong. You are solely responsible for enabling the bot, selecting strategies, and connecting a live brokerage account.'],
      ['Paper vs live', 'Paper trading and simulators do not reflect slippage, partial fills, latency, or the emotional pressure of real markets. Paper results are not indicative of live performance.'],
      ['System limits', 'Scans run on a schedule and may miss fast-moving markets. API rate limits, broker outages, or configuration errors can prevent orders from executing as expected.'],
      ['Acknowledgment', 'By enabling <strong>LIVE</strong> mode in Settings, you confirm that you understand these risks and accept full responsibility for outcomes.'],
    ],
  },
};

export function legalPage(path) {
  const document = legalDocuments[path];
  return {
    title: `${document.title} - Autotrade`,
    html: `
      <main id="main-content" class="legal-page" tabindex="-1">
        <nav class="legal-nav">${brandLink('/', 'brand brand--small')}<a class="text-link" href="/" data-link>Back home ${icon('arrow')}</a></nav>
        <div class="legal-layout">
          <aside>${escapeHtml(document.eyebrow)}<br />Autotrade</aside>
          <article class="legal-copy">
            <p class="eyebrow">${escapeHtml(document.eyebrow)}</p>
            <h1>${escapeHtml(document.title)}</h1>
            <p class="updated">${escapeHtml(document.updated)}</p>
            ${document.lead ? `<div class="alert alert--danger">${escapeHtml(document.lead)}</div>` : ''}
            ${document.sections.map(([title, copy]) => `<section><h2>${escapeHtml(title)}</h2><p>${copy}</p></section>`).join('')}
          </article>
          <aside>Not financial advice.</aside>
        </div>
      </main>`,
  };
}
