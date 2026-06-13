import { useEffect, useRef, useState } from 'react';
import { SignInButton, SignUpButton, useUser } from '@clerk/react';

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

const STATS = [
  { value: '$2.4B+', label: 'Volume Processed' },
  { value: '99.7%',  label: 'Uptime SLA' },
  { value: '<50ms',  label: 'Execution Latency' },
  { value: '40k+',   label: 'Active Traders' },
];

const FEATURES = [
  { icon: '◈', title: 'AI Signal Engine',    desc: 'Real-time pattern recognition across thousands of assets. Scans momentum, volume anomalies, and macro events simultaneously.',                                       accent: '#00c896' },
  { icon: '⬡', title: 'Precision Execution', desc: 'Sub-50ms order routing with smart order splitting. Minimize slippage and maximize fill rates across all major brokers.',                                         accent: '#4facfe' },
  { icon: '◉', title: 'Risk Guardrails',     desc: 'Configurable drawdown limits, position sizing rules, and sector exposure caps. Never blow up an account by accident again.',                                    accent: '#fa709a' },
  { icon: '◫', title: 'Live Strategy Lab',   desc: 'Backtest strategies against 20 years of tick data, then paper-trade them live — all inside the same dashboard.',                                              accent: '#f6d365' },
  { icon: '◎', title: 'Portfolio Analytics', desc: 'Sharpe, Sortino, max drawdown, sector heatmaps, and P&L attribution — everything a quant needs in one view.',                                                accent: '#a18cd1' },
  { icon: '◬', title: 'Webhook Automation',  desc: 'Connect TradingView alerts, custom webhooks, or API triggers. Fully scriptable with our JSON strategy format.',                                               accent: '#fd7014' },
];

const BADGES = [
  { sym: 'NVDA', action: 'BUY',  qty: '50 shares',    pnl: '+$842',   delay: 0   },
  { sym: 'AAPL', action: 'SELL', qty: '100 shares',   pnl: '+$314',   delay: 1.5 },
  { sym: 'SPY',  action: 'BUY',  qty: '20 contracts', pnl: '+$2,100', delay: 3.0 },
  { sym: 'TSLA', action: 'SELL', qty: '30 shares',    pnl: '-$118',   delay: 4.5 },
];

const HOW_STEPS = [
  { n: '01', title: 'AI Scans the Market', desc: 'Our engine ingests live price feeds, order-book depth, and news sentiment across 5,000+ tickers — 24/7.' },
  { n: '02', title: 'Signal Is Generated', desc: 'When patterns exceed confidence thresholds, a trade signal fires with entry, target, and stop levels.' },
  { n: '03', title: 'Order Is Executed',   desc: 'Smart order routing splits and places orders in under 50 ms via supported brokers like Alpaca and IBKR.' },
  { n: '04', title: 'Position Is Managed', desc: 'Trailing stops, take-profit ladders, and risk rules manage the trade autonomously until exit.' },
];

// ─── Candlestick Canvas ───────────────────────────────────────────────────────
interface Candle { o: number; h: number; l: number; c: number; }

function CandleChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const dataRef   = useRef<Candle[]>([]);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let price = 180;
    for (let i = 0; i < 80; i++) {
      const o = price + (Math.random() - 0.5) * 4;
      const c = o + (Math.random() - 0.48) * 6;
      dataRef.current.push({ o, c, h: Math.max(o, c) + Math.random() * 3, l: Math.min(o, c) - Math.random() * 3 });
      price = c;
    }

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
      offsetRef.current += dt * 0.03;
      if (offsetRef.current > 14) {
        offsetRef.current -= 14;
        const prev = dataRef.current[dataRef.current.length - 1]?.c ?? 180;
        const o = prev;
        const c = o + (Math.random() - 0.48) * 6;
        dataRef.current.push({ o, c, h: Math.max(o, c) + Math.random() * 3, l: Math.min(o, c) - Math.random() * 3 });
        if (dataRef.current.length > 120) dataRef.current.shift();
      }

      const W = canvas!.width;
      const H = canvas!.height;
      ctx.clearRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(0,200,150,0.05)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) {
        const y = (H / 6) * g;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const visible = dataRef.current.slice(-60);
      const maxP = Math.max(...visible.map(c => c.h));
      const minP = Math.min(...visible.map(c => c.l));
      const range = maxP - minP || 1;
      const toY = (p: number) => H * 0.9 - ((p - minP) / range) * (H * 0.8);

      const cw   = 10 * devicePixelRatio;
      const step = cw + 4 * devicePixelRatio;

      visible.forEach((cd, i) => {
        const x     = W - (visible.length - i) * step + offsetRef.current * devicePixelRatio;
        const bull  = cd.c >= cd.o;
        const color = bull ? '#00c896' : '#ff3b52';

        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5 * devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(x + cw / 2, toY(cd.h));
        ctx.lineTo(x + cw / 2, toY(cd.l));
        ctx.stroke();

        ctx.fillStyle = color;
        const top = toY(Math.max(cd.o, cd.c));
        const bot = toY(Math.min(cd.o, cd.c));
        ctx.fillRect(x, top, cw, Math.max(bot - top, 1.5 * devicePixelRatio));
      });

      const lastC = visible[visible.length - 1];
      if (lastC) {
        const lineY = toY(lastC.c);
        const grad  = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(0,200,150,0)');
        grad.addColorStop(1, 'rgba(0,200,150,0.5)');
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.5 * devicePixelRatio;
        ctx.setLineDash([6, 4]);
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
    />
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCounter(target: string, active: boolean): string {
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    if (!active) return;
    const numStr = target.replace(/[^0-9.]/g, '');
    const num    = parseFloat(numStr);
    if (isNaN(num)) { setDisplay(target); return; }
    const prefix   = target.match(/^[^0-9]*/)?.[0] ?? '';
    const suffix   = target.match(/[^0-9.]+$/)?.[0] ?? '';
    const decimals = (target.split('.')[1]?.replace(/[^0-9]/g, '') ?? '').length;
    let start = 0;
    const duration = 1800;
    function step(ts: number) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(prefix + (num * eased).toFixed(decimals) + suffix);
      if (progress < 1) requestAnimationFrame(step);
      else setDisplay(target);
    }
    requestAnimationFrame(step);
  }, [active, target]);
  return display;
}

function StatCard({ value, label, active }: { value: string; label: string; active: boolean }) {
  return (
    <div className="lp-stat-card">
      <div className="lp-stat-value">{useCounter(value, active)}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

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

// ─── useInView ────────────────────────────────────────────────────────────────
function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.2): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function Landing() {
  const { isSignedIn } = useUser();

  const statsRef = useRef<HTMLDivElement>(null);
  const statsVisible = useInView(statsRef as React.RefObject<HTMLElement>, 0.2);

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
          <div className="lp-brand-mark">AT</div>
          <span className="lp-brand-name">Autotrade</span>
        </div>
        <nav className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How It Works</a>
          <a href="#stats">Performance</a>
        </nav>
        <div className="lp-auth-btns">
          {isSignedIn ? (
            <>
              <a className="lp-btn-ghost" href="/">Home</a>
              <a className="lp-btn-primary" href="/">Settings</a>
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
            Autotrade fuses institutional-grade AI signals with lightning-fast execution —
            giving individual traders the edge once reserved for hedge funds.
          </p>
          <div className="lp-hero-cta">
            <SignUpButton mode="modal"><button className="lp-btn-primary lp-btn-lg">Start Trading Free</button></SignUpButton>
            <SignInButton mode="modal"><button className="lp-btn-ghost lp-btn-lg">Sign In</button></SignInButton>
          </div>
          <div className="lp-hero-badges">
            {BADGES.map((b, i) => <TradeBadge key={i} {...b} />)}
          </div>
        </div>

        <div className="lp-hero-chart">
          <div className="lp-chart-header">
            <span className="lp-chart-sym">AAPL</span>
            <span className="lp-chart-price lp-accent">$227.82</span>
            <span className="lp-chart-chg pos">▲ +1.24 (+0.55%)</span>
          </div>
          <div className="lp-chart-canvas">
            <CandleChart />
          </div>
          <div className="lp-chart-glow" />
        </div>

        <div className="lp-hero-orb lp-hero-orb-1" />
        <div className="lp-hero-orb lp-hero-orb-2" />
      </section>

      {/* ── Stats ─── */}
      <div ref={statsRef} id="stats" className="lp-stats-band">
        {STATS.map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} active={statsVisible} />
        ))}
      </div>

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
            >
              <div className="lp-feature-icon" style={{ color: f.accent }}>{f.icon}</div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
              <div className="lp-feature-glow" style={{ background: f.accent }} />
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
            <SignUpButton mode="modal"><button className="lp-btn-primary lp-btn-xl">Create Free Account</button></SignUpButton>
            <SignInButton mode="modal"><button className="lp-btn-ghost lp-btn-lg">Sign In</button></SignInButton>
          </div>
        </div>
      </section>

      {/* ── Footer ─── */}
      <footer className="lp-footer">
        <div className="lp-brand">
          <div className="lp-brand-mark">AT</div>
          <span className="lp-brand-name">Autotrade</span>
        </div>
        <p className="lp-footer-copy">
          © 2026 Autotrade. All rights reserved. Trading involves risk of loss.
        </p>
      </footer>


    </div>
  );
}
