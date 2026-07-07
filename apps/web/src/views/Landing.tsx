'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { ConstellationBg } from '../components/ConstellationBg';
import { CountUp } from '../components/CountUp';
import {
  Sparkles,
  Zap,
  Shield,
  FlaskConical,
  PieChart,
  Webhook,
  Lock,
  TrendingUp,
  Clock,
  HeadphonesIcon,
  type LucideIcon,
} from 'lucide-react';

// ─── Static data ──────────────────────────────────────────────────────────────
const TICKERS = [
  { sym: 'AAPL',  price: '227.82', chg: '+1.24', pos: true },
  { sym: 'NVDA',  price: '138.85', chg: '+3.67', pos: true },
  { sym: 'TSLA',  price: '314.24', chg: '-2.18', pos: false },
  { sym: 'MSFT',  price: '422.14', chg: '+0.88', pos: true },
  { sym: 'AMZN',  price: '230.55', chg: '+1.94', pos: true },
  { sym: 'META',  price: '612.31', chg: '-0.52', pos: false },
  { sym: 'GOOG',  price: '192.47', chg: '+2.11', pos: true },
  { sym: 'JPM',   price: '254.80', chg: '+0.73', pos: true },
  { sym: 'SPY',   price: '589.33', chg: '+0.44', pos: true },
  { sym: 'QQQ',   price: '510.22', chg: '+1.07', pos: true },
  { sym: 'AMD',   price: '168.45', chg: '-1.33', pos: false },
  { sym: 'BRK.B', price: '465.90', chg: '+0.22', pos: true },
];


const FEATURES: Array<{ Icon: LucideIcon; title: string; desc: string; accent: string }> = [
  { Icon: Sparkles, title: 'AI Signal Engine', desc: 'Real-time pattern recognition across thousands of assets. Scans momentum, volume anomalies, and macro events simultaneously.', accent: '#00c896' },
  { Icon: Zap, title: 'Precision Execution', desc: 'Sub-50ms order routing with smart order splitting. Minimize slippage and maximize fill rates across all major brokers.', accent: '#4facfe' },
  { Icon: Shield, title: 'Risk Guardrails', desc: 'Configurable drawdown limits, position sizing rules, and sector exposure caps. Never blow up an account by accident again.', accent: '#fa709a' },
  { Icon: FlaskConical, title: 'Live Strategy Lab', desc: 'Backtest strategies against 20 years of tick data, then paper-trade them live. All inside the same dashboard.', accent: '#f6d365' },
  { Icon: PieChart, title: 'Portfolio Analytics', desc: 'Sharpe, Sortino, max drawdown, sector heatmaps, and P&L attribution. Everything a quant needs in one view.', accent: '#a18cd1' },
  { Icon: Webhook, title: 'Webhook Automation', desc: 'Connect TradingView alerts, custom webhooks, or API triggers. Fully scriptable with our JSON strategy format.', accent: '#fd7014' },
];

const TRUST = [
  { Icon: Lock, title: 'Encrypted Keys', desc: 'Broker credentials encrypted at rest. Never exposed to the client.' },
  { Icon: TrendingUp, title: 'Paper First', desc: 'Start with $100k simulator capital before connecting live brokers.' },
  { Icon: Clock, title: '24/7 Scanning', desc: 'Markets never sleep. Neither does the signal engine.' },
  { Icon: HeadphonesIcon, title: 'Real Support', desc: 'Guided onboarding and in-app product tour from day one.' },
];

const BADGES = [
  { sym: 'NVDA', action: 'BUY',  qty: '50 shares',    pnl: '+$842',   delay: 0   },
  { sym: 'AAPL', action: 'SELL', qty: '100 shares',   pnl: '+$314',   delay: 1.5 },
  { sym: 'SPY',  action: 'BUY',  qty: '20 contracts', pnl: '+$2,100', delay: 3.0 },
  { sym: 'TSLA', action: 'SELL', qty: '30 shares',    pnl: '-$118',   delay: 4.5 },
];

const STATS = [
  { value: '50ms', label: 'Avg execution' },
  { value: '5,000+', label: 'Symbols scanned' },
  { value: '24/7', label: 'Market coverage' },
  { value: '99.2%', label: 'Signal uptime' },
];

const HOW_STEPS = [
  { n: '01', title: 'AI Scans the Market', desc: 'Our engine ingests live price feeds, order-book depth, and news sentiment across 5,000+ tickers, 24/7.' },
  { n: '02', title: 'Signal Is Generated', desc: 'When patterns exceed confidence thresholds, a trade signal fires with entry, target, and stop levels.' },
  { n: '03', title: 'Order Is Executed',   desc: 'Smart order routing splits and places orders in under 50 ms via supported brokers like Alpaca and IBKR.' },
  { n: '04', title: 'Position Is Managed', desc: 'Trailing stops, take-profit ladders, and risk rules manage the trade autonomously until exit.' },
];

const FAQ = [
  { q: 'Is Autotrade really free to start?', a: "Yes. Create an account and paper-trade with simulated capital. Connect Alpaca when you're ready for live or paper broker execution." },
  { q: 'Which brokers are supported?', a: 'Alpaca is fully integrated today (paper and live). IBKR and additional brokers are on the roadmap.' },
  { q: 'How do AI signals work?', a: 'Our engine scans price, volume, and sentiment patterns across thousands of symbols. When confidence exceeds your thresholds, a signal fires with entry, stop, and target levels.' },
  { q: 'Can I run my own strategies?', a: 'Yes. Use the strategy lab to backtest, then deploy via webhooks or the built-in bot. JSON strategy format is fully scriptable.' },
  { q: 'Is my brokerage API key secure?', a: 'Keys are encrypted at rest and never exposed to the client. Only server-side execution uses your credentials.' },
];

// ─── Candlestick Canvas ───────────────────────────────────────────────────────
interface Candle { o: number; h: number; l: number; c: number; }

function buildSmoothLoopCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const close = 200 + Math.sin(t) * 18 + Math.sin(t * 2 + 0.4) * 6;
    const open = 200 + Math.sin(t - 0.08) * 18 + Math.sin(t * 2 + 0.32) * 6;
    const wick = 1.2 + Math.abs(Math.sin(t * 3)) * 0.8;
    candles.push({
      o: open,
      c: close,
      h: Math.max(open, close) + wick,
      l: Math.min(open, close) - wick,
    });
  }
  return candles;
}

const LOOP_CANDLES = buildSmoothLoopCandles(120);
const LOOP_LEN = LOOP_CANDLES.length;
const CHART_MIN_P = Math.min(...LOOP_CANDLES.map((c) => c.l));
const CHART_MAX_P = Math.max(...LOOP_CANDLES.map((c) => c.h));

function CandleChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function resize() {
      canvas!.width  = canvas!.offsetWidth  * devicePixelRatio;
      canvas!.height = canvas!.offsetHeight * devicePixelRatio;
    }
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();

    function draw(now: number) {
      const dt = now - last;
      last = now;
      offsetRef.current += dt * 0.012;

      const W = canvas!.width;
      const H = canvas!.height;
      const cw   = 14 * devicePixelRatio;
      const step = cw + 5 * devicePixelRatio;

      const visibleCount = Math.ceil(W / step) + 2;
      const pixelOffset = offsetRef.current % step;
      const headIdx = Math.floor(offsetRef.current / step);

      const visible: Candle[] = [];
      for (let i = visibleCount - 1; i >= 0; i--) {
        const idx = ((headIdx - i) % LOOP_LEN + LOOP_LEN) % LOOP_LEN;
        visible.push(LOOP_CANDLES[idx]!);
      }

      ctx.clearRect(0, 0, W, H);

      // Subtle horizontal grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let g = 1; g < 5; g++) {
        const y = (H / 5) * g;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const range = CHART_MAX_P - CHART_MIN_P || 1;
      const pad = H * 0.1;
      const toY = (p: number) => H - pad - ((p - CHART_MIN_P) / range) * (H - pad * 2);

      visible.forEach((cd, i) => {
        const x    = W - (visible.length - i) * step + pixelOffset * devicePixelRatio;
        const bull = cd.c >= cd.o;
        const color = bull ? '#00c896' : '#ff3b52';

        // Wick
        ctx.strokeStyle = bull ? 'rgba(0,200,150,0.6)' : 'rgba(255,59,82,0.6)';
        ctx.lineWidth   = 1.5 * devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(x + cw / 2, toY(cd.h));
        ctx.lineTo(x + cw / 2, toY(cd.l));
        ctx.stroke();

        // Body
        ctx.fillStyle = color;
        const top = toY(Math.max(cd.o, cd.c));
        const bot = toY(Math.min(cd.o, cd.c));
        const bodyH = Math.max(bot - top, 2 * devicePixelRatio);
        ctx.fillRect(x, top, cw, bodyH);
      });

      // Simple flat price line, no gradient
      const lastC = visible[visible.length - 1];
      if (lastC) {
        const lineY = toY(lastC.c);
        ctx.strokeStyle = 'rgba(0,200,150,0.35)';
        ctx.lineWidth   = 1 * devicePixelRatio;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(W, lineY); ctx.stroke();
        ctx.setLineDash([]);
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}

// ─── Particle field ───────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; }

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const particles: Particle[] = [];

    function resize() {
      canvas!.width  = canvas!.offsetWidth  * devicePixelRatio;
      canvas!.height = canvas!.offsetHeight * devicePixelRatio;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 80; i++) {
      particles.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0002, vy: (Math.random() - 0.5) * 0.0002, r: Math.random() * 1.5 + 0.5, a: Math.random() });
    }

    function draw() {
      const W = canvas!.width;
      const H = canvas!.height;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,200,150,${p.a * 0.4})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const pi = particles[i]!;
          const pj = particles[j]!;
          const dx   = (pi.x - pj.x) * W;
          const dy   = (pi.y - pj.y) * H;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 * devicePixelRatio) {
            ctx.beginPath();
            ctx.moveTo(pi.x * W, pi.y * H);
            ctx.lineTo(pj.x * W, pj.y * H);
            ctx.strokeStyle = `rgba(0,200,150,${(1 - dist / (120 * devicePixelRatio)) * 0.12})`;
            ctx.lineWidth   = 0.5 * devicePixelRatio;
            ctx.stroke();
          }
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────

// ─── Trade badge ──────────────────────────────────────────────────────────────
function TradeBadge({ sym, action, qty, pnl, delay }: typeof BADGES[0]) {
  return (
    <div className="lp-badge" style={{ animationDelay: `${delay}s` }}>
      <span className="lp-badge-sym">{sym}</span>
      <span className={`lp-badge-action ${action === 'BUY' ? 'buy' : 'sell'}`}>{action}</span>
      <span className="lp-badge-qty">{qty}</span>
      <span className={`lp-badge-pnl ${pnl.startsWith('-') ? 'neg' : 'pos'}`}>{pnl}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function Landing() {
  const { isSignedIn } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [featureVisible, setFeatureVisible] = useState<boolean[]>(FEATURES.map(() => false));

  const howRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [howVisible, setHowVisible] = useState<boolean[]>(HOW_STEPS.map(() => false));

  useEffect(() => {
    const observers = featureRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting)
            setFeatureVisible(prev => { const n = [...prev]; n[i] = true; return n; });
        },
        { threshold: 0.1 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  const handleCardTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = ((e.clientY - cy) / (rect.height / 2)) * -6;
    const ry = ((e.clientX - cx) / (rect.width / 2)) * 6;
    el.style.setProperty('--rx', `${rx}deg`);
    el.style.setProperty('--ry', `${ry}deg`);
    el.style.transform = `translateY(0) perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }, []);

  const handleCardReset = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.transform = '';
  }, []);

  useEffect(() => {
    const observers = howRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting)
            setHowVisible(prev => { const n = [...prev]; n[i] = true; return n; });
        },
        { threshold: 0.2 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <div className="lp-root">
      <a href="#lp-main" className="skip-link">Skip to content</a>
      <ConstellationBg zIndex={0} />

      <div id="lp-main">
      {/* ── Ticker tape ─── */}
      <div className="lp-ticker-wrap">
        <div className="lp-ticker-track">
          {[...TICKERS, ...TICKERS, ...TICKERS].map((t, i) => (
            <span key={i} className="lp-ticker-item">
              <span className="lp-ticker-sym">{t.sym}</span>
              <span className="lp-ticker-price">${t.price}</span>
              <span className={`lp-ticker-chg ${t.pos ? 'pos' : 'neg'}`}>
                {t.pos ? '▲' : '▼'} {t.chg}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Header ─── */}
      <header className="lp-header">
        <div className="lp-brand">
          <img className="lp-brand-mark" src="/icon.png" alt="Autotrade" width={32} height={32} />
          <span className="lp-brand-name">Autotrade</span>
        </div>
        <nav className="lp-nav-links" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#how">How It Works</a>
          <a href="#stats">Performance</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button
          type="button"
          className="lp-mobile-toggle"
          aria-expanded={mobileOpen}
          aria-controls="lp-mobile-menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <span className="lp-burger" aria-hidden />
        </button>
        <div id="lp-mobile-menu" className={`lp-mobile-menu${mobileOpen ? ' open' : ''}`}>
          <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#how" onClick={() => setMobileOpen(false)}>How It Works</a>
          <a href="#stats" onClick={() => setMobileOpen(false)}>Performance</a>
          <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
        </div>
        <div className="lp-auth-btns">
          {isSignedIn ? (
            <>
              <a className="lp-btn-ghost" href="/dashboard">Dashboard</a>
              <a className="lp-btn-primary" href="/dashboard">Open App →</a>
            </>
          ) : (
            <>
              <SignInButton mode="modal"><button className="lp-btn-ghost">Sign In</button></SignInButton>
              <SignUpButton mode="modal"><button className="lp-btn-primary">Get Started →</button></SignUpButton>
            </>
          )}
        </div>
      </header>

      {/* ── Hero ─── */}
      <section className="lp-hero">
        <ParticleField />
        <div className="lp-hero-content">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            AI-Powered Algorithmic Trading
          </div>
          <h1 className="lp-hero-title">
            <span className="lp-hero-line">Trade Smarter.</span>
            <span className="lp-hero-line lp-accent">React Faster.</span>
            <span className="lp-hero-line">Win Bigger.</span>
          </h1>
          <p className="lp-hero-sub">
            Autotrade fuses institutional-grade AI signals with lightning-fast execution,
            giving individual traders the edge once reserved for hedge funds.
          </p>
          <div className="lp-hero-cta">
            {isSignedIn ? (
              <>
                <a className="lp-btn-primary lp-btn-lg" href="/dashboard">Open Dashboard</a>
                <a className="lp-btn-ghost lp-btn-lg" href="/watchlist">View Watchlist</a>
              </>
            ) : (
              <>
                <SignUpButton mode="modal"><button className="lp-btn-primary lp-btn-lg">Start Trading Free</button></SignUpButton>
                <SignInButton mode="modal"><button className="lp-btn-ghost lp-btn-lg">Sign In</button></SignInButton>
              </>
            )}
          </div>
          <div className="lp-hero-badges">
            {BADGES.map((b, i) => <TradeBadge key={i} {...b} />)}
          </div>
        </div>

        <div className="lp-hero-chart">
          <div className="lp-chart-canvas">
            <CandleChart />
          </div>
        </div>

        <div className="lp-hero-orb lp-hero-orb-1" />
        <div className="lp-hero-orb lp-hero-orb-2" />
      </section>

      {/* ── Stats band ─── */}
      <section id="stats" className="lp-stats-band" aria-label="Platform stats">
        {STATS.map((s) => (
          <div key={s.label} className="lp-stat-card">
            <CountUp value={s.value} cls="lp-stat-value" />
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </section>


      {/* ── Trust band ─── */}
      <section className="lp-colored-band lp-colored-band--purple" style={{ paddingTop: 56, paddingBottom: 56 }} aria-label="Trust indicators">
        <div className="lp-trust-grid">
          {TRUST.map((t, i) => (
            <div key={i} className="lp-trust-card">
              <div className="lp-trust-icon"><t.Icon size={22} strokeWidth={2} /></div>
              <h3 className="lp-trust-title">{t.title}</h3>
              <p className="lp-trust-desc">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─── */}
      <section id="how" className="lp-how">
        <div className="lp-section-label">How It Works</div>
        <h2 className="lp-section-title">From Signal to Trade in Milliseconds</h2>
        <div className="lp-how-steps">
          {HOW_STEPS.map((step, i) => (
            <div
              key={i}
              ref={el => { howRefs.current[i] = el; }}
              className={`lp-how-step ${howVisible[i] ? 'visible' : ''}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="lp-how-num">{step.n}</div>
              {i < HOW_STEPS.length - 1 && <div className="lp-how-connector" />}
              <h3 className="lp-how-title">{step.title}</h3>
              <p className="lp-how-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─── */}
      <section id="features" className="lp-features">
        <div className="lp-section-label">Platform Features</div>
        <h2 className="lp-section-title">Everything You Need to Trade Professionally</h2>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              ref={el => { featureRefs.current[i] = el; }}
              className={`lp-feature-card ${featureVisible[i] ? 'visible' : ''}`}
              style={{ transitionDelay: `${(i % 3) * 80}ms`, '--lp-accent': f.accent } as React.CSSProperties}
              onMouseMove={handleCardTilt}
              onMouseLeave={handleCardReset}
            >
              <div className="lp-feature-icon-wrap" style={{ color: f.accent, '--lp-accent': f.accent } as React.CSSProperties}>
                <f.Icon size={22} strokeWidth={2} />
              </div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
              <div className="lp-feature-glow" style={{ background: f.accent }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─── */}
      <section id="faq" className="lp-faq">
        <div className="lp-section-label">FAQ</div>
        <h2 className="lp-section-title">Common Questions</h2>
        <div className="lp-faq-list">
          {FAQ.map((item, i) => (
            <div key={i} className={`lp-faq-item${openFaq === i ? ' open' : ''}`}>
              <button
                type="button"
                className="lp-faq-q"
                aria-expanded={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
                <span className="lp-faq-chevron" aria-hidden />
              </button>
              <div className="lp-faq-a" role="region" hidden={openFaq !== i}>
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─── */}
      <section className="lp-cta">
        <div className="lp-cta-grid" />
        <div className="lp-cta-orb" />
        <div className="lp-cta-content">
          <div className="lp-cta-badge">No credit card required to start</div>
          <h2 className="lp-cta-title">Ready to Let the Algorithm Work?</h2>
          <p className="lp-cta-sub">
            Join thousands of traders who've replaced emotional decision-making with
            data-driven precision. Start with paper trading, go live when you're ready.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isSignedIn ? (
              <>
                <a className="lp-btn-primary lp-btn-xl" href="/dashboard">Go to Dashboard</a>
                <a className="lp-btn-ghost lp-btn-lg" href="/settings">Account Settings</a>
              </>
            ) : (
              <>
                <SignUpButton mode="modal"><button className="lp-btn-primary lp-btn-xl">Create Free Account</button></SignUpButton>
                <SignInButton mode="modal"><button className="lp-btn-ghost lp-btn-lg">Sign In</button></SignInButton>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─── */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <div className="lp-brand">
              <img className="lp-brand-mark" src="/icon.png" alt="Autotrade" width={32} height={32} />
              <span className="lp-brand-name">Autotrade</span>
            </div>
            <p className="lp-footer-tagline">Precision terminal for AI-driven trading.</p>
          </div>
          <nav className="lp-footer-nav" aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <a href="/sign-in">Sign in</a>
          </nav>
        </div>
        <p className="lp-footer-copy">
          © 2026 Autotrade. All rights reserved. Trading involves risk of loss. Not financial advice.
        </p>
      </footer>
      </div>
    </div>
  );
}
