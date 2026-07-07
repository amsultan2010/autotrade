'use client';

import { useRef, useState } from 'react';
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
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'framer-motion';
import { AmbientFx } from '@/src/components/AmbientFx';
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

// ─── Motion helpers ───────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE_OUT } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionReveal({
  children,
  className,
  ...props
}: React.ComponentProps<typeof motion.section>) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
      {...props}
    >
      {children}
    </motion.section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
      {children}
    </p>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('font-display text-3xl font-bold tracking-tight text-ink md:text-4xl lg:text-5xl', className)}>
      {children}
    </h2>
  );
}

function FloatingTradeBadge({ sym, action, qty, pnl, delay }: (typeof BADGES)[0]) {
  const reduce = useReducedMotion();
  const isPositive = !pnl.startsWith('-');

  return (
    <motion.div
      className="material-inset flex items-center gap-3 px-4 py-2.5 backdrop-blur-sm"
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay * 0.3, ease: EASE_OUT }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 3.5 + delay * 0.4, repeat: Infinity, ease: 'easeInOut', delay }}
        className="flex w-full items-center gap-3"
      >
        <span className="font-mono text-sm font-bold text-gold">{sym}</span>
        <span
          className={cn(
            'rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
            action === 'BUY' ? 'bg-positive-muted text-positive' : 'bg-negative-muted text-negative',
          )}
        >
          {action}
        </span>
        <span className="hidden text-xs text-ink-muted sm:inline">{qty}</span>
        <span
          className={cn(
            'ml-auto font-mono text-sm font-bold tabular-nums',
            isPositive ? 'text-positive' : 'text-negative',
          )}
        >
          {pnl}
        </span>
      </motion.div>
    </motion.div>
  );
}

function HeroDashboard() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="relative w-full max-w-lg lg:max-w-none"
      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.25, ease: EASE_OUT }}
    >
      <div className="lp-hero-glow -right-16 -top-16 opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00c896, transparent 70%)' }}
        aria-hidden
      />

      <div className="material-panel relative overflow-hidden shadow-[var(--shadow-elevated)]">
        <span className="hud-corners" aria-hidden />

        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-negative/70 shadow-[0_0_8px_rgba(255,59,82,0.5)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70 shadow-[0_0_8px_rgba(240,165,0,0.5)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-positive/70 shadow-[0_0_8px_rgba(0,200,150,0.5)]" />
          </div>
          <span className="mx-auto font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            autotrade — live dashboard
          </span>
        </div>

        <div className="grid gap-0 sm:grid-cols-[140px_1fr]">
          <div className="hidden border-r border-border bg-surface-raised p-4 sm:block">
            <div className="mb-4 flex items-center gap-2">
              <img
                src="/icon.png"
                alt=""
                width={24}
                height={24}
                className="rounded-md shadow-[var(--shadow-gold-glow)]"
              />
              <span className="font-display text-sm font-bold text-gold">Autotrade</span>
            </div>
            <nav className="space-y-1" aria-hidden>
              {['Dashboard', 'Signals', 'Portfolio', 'Settings'].map((item, i) => (
                <div
                  key={item}
                  className={cn(
                    'rounded-md px-3 py-2 text-xs font-semibold',
                    i === 0
                      ? 'bg-gold-muted text-gold shadow-[inset_3px_0_0_#e85d04]'
                      : 'text-ink-muted',
                  )}
                >
                  {item}
                </div>
              ))}
            </nav>
          </div>

          <div className="p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                  Portfolio Value
                </p>
                <p className="font-mono text-2xl font-bold tabular-nums text-ink md:text-3xl">
                  $124,832.50
                </p>
              </div>
              <span className="material-inset rounded-md px-2.5 py-1 font-mono text-xs font-bold text-positive">
                +2.41% today
              </span>
            </div>

            <div className="material-inset relative h-36 overflow-hidden md:h-44">
              <svg viewBox="0 0 400 160" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="lp-chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lp-chart-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0d9488" />
                    <stop offset="50%" stopColor="#e85d04" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>
                {[40, 80, 120].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="400"
                    y2={y}
                    stroke="rgba(232,93,4,0.08)"
                    strokeWidth="1"
                  />
                ))}
                <path
                  d="M0,120 C40,110 60,90 100,95 C140,100 160,70 200,75 C240,80 280,50 320,55 C360,60 380,40 400,35 L400,160 L0,160 Z"
                  fill="url(#lp-chart-fill)"
                />
                <path
                  d="M0,120 C40,110 60,90 100,95 C140,100 160,70 200,75 C240,80 280,50 320,55 C360,60 380,40 400,35"
                  fill="none"
                  stroke="url(#lp-chart-line)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute bottom-2 left-3 flex gap-4 font-mono text-[9px] text-ink-muted">
                <span>09:30</span>
                <span>12:00</span>
                <span>16:00</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: 'Open P&L', value: '+$1,842', pos: true },
                { label: 'Win Rate', value: '68.4%', pos: true },
                { label: 'Positions', value: '7', pos: null },
              ].map((s) => (
                <div key={s.label} className="material-inset px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                    {s.label}
                  </p>
                  <p
                    className={cn(
                      'font-mono text-sm font-bold tabular-nums',
                      s.pos === true && 'text-positive',
                      s.pos === false && 'text-negative',
                      s.pos === null && 'text-gold',
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
    </motion.div>
  );
}

function FeatureCard({
  Icon,
  title,
  desc,
  accent,
  index,
}: (typeof FEATURES)[0] & { index: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-80, 80], reduce ? [0, 0] : [6, -6]);
  const rotateY = useTransform(mx, [-80, 80], reduce ? [0, 0] : [-6, 6]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set(e.clientX - (rect.left + rect.width / 2));
    my.set(e.clientY - (rect.top + rect.height / 2));
  }

  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className="lp-feature-card group relative overflow-hidden p-6"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: EASE_OUT }}
    >
      <span className="hud-corners" aria-hidden />
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg"
        style={{
          backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)`,
          color: accent,
          boxShadow: `0 0 24px color-mix(in oklab, ${accent} 25%, transparent)`,
        }}
      >
        <Icon size={24} strokeWidth={2} />
      </div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{desc}</p>
      <div
        className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: accent }}
        aria-hidden
      />
    </motion.div>
  );
}

function AuthButtons({
  size = 'default' as 'default' | 'lg',
  className,
}: {
  size?: 'default' | 'lg';
  className?: string;
}) {
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
  const reduce = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const tickerItems = [...TICKERS, ...TICKERS];

  return (
    <div className="lp-root bg-bg text-ink">
      <AmbientFx />

      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* ── Ticker tape ── */}
      <div className="lp-ticker relative z-20" aria-hidden>
        <div className="lp-ticker-track">
          {tickerItems.map((t, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-3 border-r border-border px-6 py-2.5 font-mono text-xs"
            >
              <span className="font-bold text-gold">{t.sym}</span>
              <span className="tabular-nums text-ink-secondary">${t.price}</span>
              <span className={cn('tabular-nums font-semibold', t.pos ? 'text-positive' : 'text-negative')}>
                {t.pos ? '▲' : '▼'} {t.chg}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Sticky nav ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <a href="#" className="group flex min-h-[44px] items-center gap-2.5">
            <motion.img
              src="/icon.png"
              alt="Autotrade"
              width={32}
              height={32}
              className="rounded-lg shadow-[var(--shadow-gold-glow)]"
              animate={reduce ? undefined : { boxShadow: ['0 0 12px rgba(232,93,4,0.2)', '0 0 28px rgba(255,122,26,0.45)', '0 0 12px rgba(232,93,4,0.2)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="font-display text-lg font-extrabold tracking-tight text-ink transition-colors group-hover:text-gold">
              Autotrade
            </span>
          </a>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-raised hover:text-gold"
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
            className="material-button flex h-11 w-11 items-center justify-center text-ink-secondary transition-colors hover:text-gold md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            className="border-t border-border bg-surface/95 px-4 py-4 backdrop-blur-xl md:hidden"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="min-h-[44px] rounded-lg px-4 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-raised hover:text-gold"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <AuthButtons className="flex-col [&_button]:w-full [&_a]:w-full" />
            </div>
          </motion.div>
        )}
      </header>

      <main id="main-content" className="relative z-10">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="lp-hero-glow left-1/4 top-0 -translate-x-1/2 opacity-50" aria-hidden />
          <div
            className="pointer-events-none absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #0d9488, transparent 65%)' }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #ff8c42, transparent 65%)' }}
            aria-hidden
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
            <motion.div
              className="flex flex-col gap-6"
              initial={reduce ? false : 'hidden'}
              animate="visible"
              variants={stagger}
            >
              <motion.div
                variants={fadeUp}
                className="material-inset inline-flex w-fit items-center gap-2.5 px-4 py-2"
              >
                <span className="live-dot" aria-hidden />
                <span className="text-xs font-bold uppercase tracking-widest text-ink-secondary">
                  Trading you control
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
              >
                Trade smarter.{' '}
                <span className="bg-gradient-to-r from-[#ff8c42] via-[#e85d04] to-[#c44d02] bg-clip-text text-transparent">
                  React faster.
                </span>{' '}
                <span className="text-ink">Win bigger.</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="max-w-xl text-base leading-relaxed text-ink-secondary md:text-lg"
              >
                Autotrade brings institutional-grade AI signals and lightning execution to your
                desk — paper first, live when you are ready. No complexity, just clarity.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              </motion.div>

              <motion.div variants={fadeUp} className="grid gap-2 sm:grid-cols-2">
                {BADGES.map((b, i) => (
                  <FloatingTradeBadge key={i} {...b} />
                ))}
              </motion.div>
            </motion.div>

            <HeroDashboard />
          </div>
        </section>

        {/* ── Stats band ── */}
        <SectionReveal id="stats" aria-label="Platform stats">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
            <div className="material-inset grid grid-cols-2 divide-x divide-border md:grid-cols-4">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  className="flex flex-col items-center gap-1 px-6 py-8 text-center md:py-10"
                  initial={reduce ? false : { opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <p className="font-mono text-3xl font-extrabold tabular-nums text-gold md:text-4xl">
                    {s.value}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {s.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* ── Trust ── */}
        <SectionReveal className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24" aria-label="Trust indicators">
          <div className="mb-12 text-center">
            <SectionLabel>Why Traders Trust Us</SectionLabel>
            <SectionTitle className="mt-4">Built for Security &amp; Confidence</SectionTitle>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t, i) => (
              <motion.div
                key={i}
                className="material-panel group relative p-6"
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={reduce ? undefined : { y: -4 }}
              >
                <span className="hud-corners" aria-hidden />
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gold-muted text-gold shadow-[var(--shadow-gold-glow)] transition-transform group-hover:scale-110">
                  <t.Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="font-display text-base font-bold text-ink">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </SectionReveal>

        {/* ── Features ── */}
        <SectionReveal
          id="features"
          className="border-t border-border px-4 py-20 md:px-8 md:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionLabel>Platform Features</SectionLabel>
              <SectionTitle className="mt-4">Everything You Need to Trade Professionally</SectionTitle>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: 1200 }}>
              {FEATURES.map((f, i) => (
                <FeatureCard key={i} {...f} index={i} />
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* ── How it works ── */}
        <SectionReveal id="how" className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24">
          <div className="mb-12 text-center">
            <SectionLabel>How It Works</SectionLabel>
            <SectionTitle className="mt-4">From Signal to Trade in Milliseconds</SectionTitle>
          </div>
          <div className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div
              className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent lg:block"
              aria-hidden
            />
            {HOW_STEPS.map((step, i) => (
              <motion.div
                key={i}
                className="relative flex flex-col gap-4"
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
              >
                <div className="material-panel relative flex h-14 w-14 items-center justify-center">
                  <span className="hud-corners" aria-hidden />
                  <span className="font-mono text-lg font-extrabold text-gold">{step.n}</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionReveal>

        {/* ── FAQ ── */}
        <SectionReveal
          id="faq"
          className="border-t border-border bg-surface-raised/50 px-4 py-20 md:px-8 md:py-24"
        >
          <div className="mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <SectionLabel>FAQ</SectionLabel>
              <SectionTitle className="mt-4">Common Questions</SectionTitle>
            </div>
            <div className="flex flex-col gap-3">
              {FAQ.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <motion.div
                    key={i}
                    className="material-inset overflow-hidden"
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                  >
                    <button
                      type="button"
                      className="flex min-h-[44px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-ink transition-colors hover:text-gold"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                    >
                      {item.q}
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-gold transition-transform duration-200',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </button>
                    <motion.div
                      initial={false}
                      animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: reduce ? 0 : 0.25, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm leading-relaxed text-ink-secondary">
                        {item.a}
                      </p>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </SectionReveal>

        {/* ── Footer CTA ── */}
        <section className="relative overflow-hidden border-t border-border">
          <div className="lp-hero-glow left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/[0.06] via-transparent to-teal/[0.04]"
            aria-hidden
          />

          <motion.div
            className="relative mx-auto max-w-3xl px-4 py-20 text-center md:px-8 md:py-28"
            initial={reduce ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: EASE_OUT }}
          >
            <span className="material-inset inline-flex px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-ink-secondary">
              No credit card required to start
            </span>
            <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink md:text-5xl">
              Ready to step into{' '}
              <span className="bg-gradient-to-r from-[#ff8c42] to-[#e85d04] bg-clip-text text-transparent">
                Autotrade
              </span>
              ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-secondary">
              Join traders who replaced guesswork with data-driven precision. Start with paper
              trading — go live when you are ready.
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
          </motion.div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:justify-between md:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/icon.png"
                alt="Autotrade"
                width={28}
                height={28}
                className="rounded-md shadow-[var(--shadow-gold-glow)]"
              />
              <span className="font-display text-base font-extrabold text-gold">Autotrade</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              Premium AI trading — warm, intuitive, built for you.
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold/70">
              Trading you control
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="min-h-[44px] text-sm font-semibold text-ink-secondary transition-colors hover:text-gold"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/sign-in"
              className="min-h-[44px] text-sm font-semibold text-ink-secondary transition-colors hover:text-gold"
            >
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
