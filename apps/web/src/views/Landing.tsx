'use client';

import { useState } from 'react';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
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
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/lib/utils';

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

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How It Works' },
  { href: '#faq', label: 'FAQ' },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-accent">
      {children}
    </p>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('font-display text-3xl font-bold tracking-tight text-ink md:text-4xl', className)}>
      {children}
    </h2>
  );
}

function TradeBadge({ sym, action, qty, pnl, delay }: (typeof BADGES)[0]) {
  const isPositive = !pnl.startsWith('-');
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised/90 px-4 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both"
      style={{ animationDelay: `${delay}s`, animationDuration: '0.7s' }}
    >
      <span className="font-mono text-sm font-semibold text-ink">{sym}</span>
      <span
        className={cn(
          'rounded px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide',
          action === 'BUY' ? 'bg-positive-muted text-positive' : 'bg-negative-muted text-negative',
        )}
      >
        {action}
      </span>
      <span className="hidden text-xs text-ink-muted sm:inline">{qty}</span>
      <span className={cn('ml-auto font-mono text-sm font-semibold tabular-nums', isPositive ? 'text-positive' : 'text-negative')}>
        {pnl}
      </span>
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="relative w-full max-w-lg lg:max-w-none">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-full opacity-40 blur-3xl motion-safe:animate-pulse"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, #38bdf8 30%, transparent), transparent 70%)' }}
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-raised shadow-[var(--shadow-elevated)]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-negative/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-positive/60" />
          </div>
          <span className="mx-auto font-mono text-[11px] text-ink-muted">autotrade — dashboard</span>
        </div>

        <div className="grid gap-0 sm:grid-cols-[140px_1fr]">
          {/* Sidebar mock */}
          <div className="hidden border-r border-border bg-surface p-4 sm:block">
            <div className="mb-4 flex items-center gap-2">
              <img src="/icon.png" alt="" width={24} height={24} className="rounded-md" />
              <span className="font-display text-sm font-bold">Autotrade</span>
            </div>
            <nav className="space-y-1" aria-hidden>
              {['Dashboard', 'Signals', 'Portfolio', 'Settings'].map((item, i) => (
                <div
                  key={item}
                  className={cn(
                    'rounded-md px-3 py-2 text-xs font-medium',
                    i === 0 ? 'bg-accent-muted text-accent' : 'text-ink-muted',
                  )}
                >
                  {item}
                </div>
              ))}
            </nav>
          </div>

          {/* Main panel */}
          <div className="p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs text-ink-muted">Portfolio Value</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-ink">$124,832.50</p>
              </div>
              <span className="rounded-md bg-positive-muted px-2 py-1 font-mono text-xs font-semibold text-positive">
                +2.41% today
              </span>
            </div>

            {/* SVG chart */}
            <div className="relative h-36 overflow-hidden rounded-lg border border-border bg-surface md:h-44">
              <svg viewBox="0 0 400 160" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[40, 80, 120].map((y) => (
                  <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}
                <path
                  d="M0,120 C40,110 60,90 100,95 C140,100 160,70 200,75 C240,80 280,50 320,55 C360,60 380,40 400,35 L400,160 L0,160 Z"
                  fill="url(#chart-fill)"
                />
                <path
                  d="M0,120 C40,110 60,90 100,95 C140,100 160,70 200,75 C240,80 280,50 320,55 C360,60 380,40 400,35"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute bottom-2 left-3 flex gap-4 font-mono text-[10px] text-ink-muted">
                <span>09:30</span>
                <span>12:00</span>
                <span>16:00</span>
              </div>
            </div>

            {/* Mini stats row */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: 'Open P&L', value: '+$1,842', pos: true },
                { label: 'Win Rate', value: '68.4%', pos: true },
                { label: 'Positions', value: '7', pos: null },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] text-ink-muted">{s.label}</p>
                  <p
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      s.pos === true && 'text-positive',
                      s.pos === false && 'text-negative',
                      s.pos === null && 'text-ink',
                    )}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthButtons({ size = 'default' as 'default' | 'lg', className }: { size?: 'default' | 'lg'; className?: string }) {
  const { isSignedIn } = useUser();
  const btnSize = size === 'lg' ? 'lg' : 'default';

  if (isSignedIn) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button variant="ghost" size={btnSize} asChild>
          <a href="/dashboard">Dashboard</a>
        </Button>
        <Button size={btnSize} asChild>
          <a href="/dashboard">
            Open App
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <SignInButton mode="modal">
        <Button variant="ghost" size={btnSize}>Sign In</Button>
      </SignInButton>
      <SignUpButton mode="modal">
        <Button size={btnSize}>
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Button>
      </SignUpButton>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Landing() {
  const { isSignedIn } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
        .ticker-animate {
          animation: ticker-scroll 45s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-animate { animation: none; }
        }
      `}</style>

      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* ── Ticker tape ── */}
      <div className="overflow-hidden border-b border-border bg-surface" aria-hidden>
        <div className="ticker-animate flex w-max">
          {[...TICKERS, ...TICKERS, ...TICKERS].map((t, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-3 border-r border-border px-6 py-2 font-mono text-xs"
            >
              <span className="font-semibold text-ink-secondary">{t.sym}</span>
              <span className="tabular-nums text-ink">${t.price}</span>
              <span className={cn('tabular-nums', t.pos ? 'text-positive' : 'text-negative')}>
                {t.pos ? '▲' : '▼'} {t.chg}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Sticky nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <a href="#" className="flex min-h-[44px] items-center gap-2.5">
            <img src="/icon.png" alt="Autotrade" width={32} height={32} className="rounded-lg" />
            <span className="font-display text-lg font-bold tracking-tight">Autotrade</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:block">
            <AuthButtons />
          </div>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div id="mobile-menu" className="border-t border-border bg-surface px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="min-h-[44px] rounded-lg px-4 py-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <AuthButtons className="flex-col [&_button]:w-full [&_a]:w-full" />
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Gradient mesh */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #38bdf8, transparent 70%)' }} />
            <div className="absolute -right-1/4 bottom-0 h-[400px] w-[400px] rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #34d399, transparent 70%)' }} />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
              }}
            />
          </div>

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-raised px-4 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="text-xs font-medium text-ink-secondary">AI-Powered Algorithmic Trading</span>
              </div>

              <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Trade Smarter.{' '}
                <span className="text-accent">React Faster.</span>{' '}
                Win Bigger.
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-ink-secondary md:text-lg">
                Autotrade fuses institutional-grade AI signals with lightning-fast execution,
                giving individual traders the edge once reserved for hedge funds.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {isSignedIn ? (
                  <>
                    <Button size="lg" asChild>
                      <a href="/dashboard">
                        Open Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                      <a href="/watchlist">View Watchlist</a>
                    </Button>
                  </>
                ) : (
                  <>
                    <SignUpButton mode="modal">
                      <Button size="lg">
                        Start Trading Free
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </SignUpButton>
                    <SignInButton mode="modal">
                      <Button variant="outline" size="lg">Sign In</Button>
                    </SignInButton>
                  </>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {BADGES.map((b, i) => (
                  <TradeBadge key={i} {...b} />
                ))}
              </div>
            </div>

            <HeroDashboard />
          </div>
        </section>

        {/* ── Stats band ── */}
        <section id="stats" className="border-y border-border bg-surface" aria-label="Platform stats">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1 bg-surface px-6 py-10 text-center">
                <p className="font-mono text-3xl font-bold tabular-nums text-ink md:text-4xl">{s.value}</p>
                <p className="text-sm text-ink-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust ── */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24" aria-label="Trust indicators">
          <div className="mb-12 text-center">
            <SectionLabel>Why Traders Trust Us</SectionLabel>
            <SectionTitle className="mt-3">Built for Security &amp; Confidence</SectionTitle>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-card)] transition-colors hover:border-border-strong"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <t.Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="font-display text-base font-semibold text-ink">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="border-t border-border bg-surface px-4 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionLabel>Platform Features</SectionLabel>
              <SectionTitle className="mt-3">Everything You Need to Trade Professionally</SectionTitle>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-card)] transition-all hover:border-border-strong hover:shadow-[var(--shadow-elevated)]"
                >
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg transition-colors"
                    style={{ backgroundColor: `color-mix(in oklab, ${f.accent} 15%, transparent)`, color: f.accent }}
                  >
                    <f.Icon size={22} strokeWidth={2} />
                  </div>
                  <h3 className="font-display text-base font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{f.desc}</p>
                  <div
                    className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30"
                    style={{ background: f.accent }}
                    aria-hidden
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24">
          <div className="mb-12 text-center">
            <SectionLabel>How It Works</SectionLabel>
            <SectionTitle className="mt-3">From Signal to Trade in Milliseconds</SectionTitle>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((step, i) => (
              <div key={i} className="relative flex flex-col gap-4">
                {i < HOW_STEPS.length - 1 && (
                  <div
                    className="absolute left-6 top-12 hidden h-px w-[calc(100%+2rem)] bg-border lg:block"
                    aria-hidden
                  />
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-raised font-mono text-sm font-bold text-accent">
                  {step.n}
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="border-t border-border bg-surface px-4 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <SectionLabel>FAQ</SectionLabel>
              <SectionTitle className="mt-3">Common Questions</SectionTitle>
            </div>
            <div className="flex flex-col gap-2">
              {FAQ.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={i}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-surface-raised transition-colors',
                      isOpen ? 'border-border-strong' : 'border-border',
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-h-[44px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ink transition-colors hover:text-accent"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                    >
                      {item.q}
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-ink-muted transition-transform motion-safe:duration-200',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200',
                        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-sm leading-relaxed text-ink-secondary">{item.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Footer CTA (Peak-End Rule) ── */}
        <section className="relative overflow-hidden border-t border-border">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-positive/5" />
            <div className="absolute -top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #38bdf8, transparent 70%)' }} />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 py-20 text-center md:px-8 md:py-28">
            <span className="inline-flex rounded-full border border-border bg-surface-raised px-4 py-1.5 text-xs font-medium text-ink-secondary">
              No credit card required to start
            </span>
            <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
              Ready to Let the Algorithm Work?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">
              Join thousands of traders who&apos;ve replaced emotional decision-making with
              data-driven precision. Start with paper trading, go live when you&apos;re ready.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isSignedIn ? (
                <>
                  <Button size="lg" asChild>
                    <a href="/dashboard">
                      Go to Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <a href="/settings">Account Settings</a>
                  </Button>
                </>
              ) : (
                <>
                  <SignUpButton mode="modal">
                    <Button size="lg">
                      Create Free Account
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </SignUpButton>
                  <SignInButton mode="modal">
                    <Button variant="outline" size="lg">Sign In</Button>
                  </SignInButton>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:justify-between md:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/icon.png" alt="Autotrade" width={28} height={28} className="rounded-md" />
              <span className="font-display text-base font-bold">Autotrade</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              Precision terminal for AI-driven trading.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="min-h-[44px] text-sm text-ink-secondary transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <a href="/sign-in" className="min-h-[44px] text-sm text-ink-secondary transition-colors hover:text-ink">
              Sign in
            </a>
          </nav>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-ink-muted md:px-8">
            © 2026 Autotrade. All rights reserved. Trading involves risk of loss. Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
