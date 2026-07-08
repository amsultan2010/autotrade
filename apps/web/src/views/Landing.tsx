'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  ChevronDown,
  Cpu,
  Lock,
  Menu,
  Radar,
  Shield,
  Sparkles,
  Terminal,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { AmbientFx } from '@/src/components/AmbientFx';
import { Button } from '@/src/components/ui/button';
import {
  ForgeLCD,
  ForgePlate,
  InstrumentTower,
  ZigzagModule,
} from '@/src/components/forge/ForgePrimitives';
import {
  ForgeReveal,
  ForgeScrollBar,
  ForgeScrollRail,
  ForgeStepPin,
  forgeFadeUp,
  forgeStagger,
} from '@/src/components/forge/ScrollEngine';
import { cn } from '@/lib/utils';

const TICKERS = [
  { sym: 'NVDA', price: '138.85', chg: '+3.67', up: true },
  { sym: 'AAPL', price: '227.82', chg: '+1.24', up: true },
  { sym: 'TSLA', price: '314.24', chg: '-2.18', up: false },
  { sym: 'SPY', price: '589.33', chg: '+0.44', up: true },
  { sym: 'BTC', price: '67,234', chg: '+2.34', up: true },
  { sym: 'ETH', price: '3,891', chg: '-0.82', up: false },
];

const PIPELINE = [
  { step: '01', title: 'Market Ingest', desc: '5,000+ symbols streamed with L2 depth, news sentiment, and cross-asset correlation matrices ingested in real time.', color: '#00c896' },
  { step: '02', title: 'Neural Analysis', desc: 'Pattern engine scores momentum, mean-reversion, and regime shifts. Confidence thresholds gate every signal.', color: '#00ffd0' },
  { step: '03', title: 'Signal Forge', desc: 'Entry, stop, target, and position size computed per your risk profile. Every signal is auditable.', color: '#38bdf8' },
  { step: '04', title: 'Execution Core', desc: 'Smart order routing splits across venues. Sub-50ms fills with slippage minimization.', color: '#ff3b52' },
  { step: '05', title: 'Risk Management', desc: 'Trailing stops, sector caps, drawdown kill-switch. Positions managed until exit.', color: '#00c896' },
] as const;

const MODULES: Array<{ Icon: LucideIcon; title: string; desc: string; accent: string; readout: string }> = [
  { Icon: Radar, title: 'Signal Radar', desc: 'Multi-timeframe pattern recognition with live confidence heatmaps across equities, ETFs, and crypto.', accent: '#00c896', readout: 'SCAN::ACTIVE · 5,142 symbols · regime: momentum' },
  { Icon: Zap, title: 'Execution Core', desc: 'Sub-50ms smart order routing with iceberg splits and fill-rate optimization.', accent: '#ff3b52', readout: 'ROUTE::ALPACA · avg fill 47ms · slippage 0.02%' },
  { Icon: Shield, title: 'Risk Vault', desc: 'Drawdown limits, sector exposure caps, and emergency kill-switch. Never blow up by accident.', accent: '#38bdf8', readout: 'RISK::nominal · drawdown -2.1% · caps OK' },
  { Icon: Terminal, title: 'Strategy Lab', desc: 'Backtest against 20 years of tick data. Deploy via webhooks or built-in bot.', accent: '#00ffd0', readout: 'LAB::3 strategies armed · paper mode' },
];

const FAQ = [
  { q: 'Is Autotrade free to start?', a: 'Yes. Paper-trade with $100k simulated capital. Connect Alpaca when ready for live execution.' },
  { q: 'Which brokers are supported?', a: 'Alpaca is fully integrated (paper + live). IBKR is on the roadmap.' },
  { q: 'How do AI signals work?', a: 'The engine scans price, volume, and sentiment. When confidence exceeds your thresholds, a signal fires with entry, stop, and target.' },
  { q: 'Are API keys secure?', a: 'Encrypted at rest. Never exposed client-side. Server-only execution.' },
];

function AuthButtons({ className }: { className?: string }) {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className={cn('h-10 w-40 animate-pulse rounded-md bg-surface/80', className)} aria-hidden />;
  }

  if (isSignedIn) {
    return (
      <div className={cn('flex gap-2', className)}>
        <Button asChild>
          <Link href="/dashboard">
            Launch <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <SignInButton mode="modal" forceRedirectUrl="/dashboard">
        <Button variant="outline">Sign In</Button>
      </SignInButton>
      <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
        <Button>Create Account</Button>
      </SignUpButton>
    </div>
  );
}

function CommandDeck() {
  return (
    <ForgeReveal className="forge-deck relative z-10 py-8 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 md:flex-row md:justify-between md:gap-8">
        <div className="text-center md:text-left">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-teal">Command Deck</p>
          <h2 className="mt-2 font-display text-xl font-bold uppercase tracking-wide sm:text-2xl md:text-3xl">
            Physical controls.<br className="hidden sm:block" /> Digital precision.
          </h2>
        </div>
        <div className="grid w-full max-w-sm grid-cols-3 gap-4 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-6">
          {['SCAN', 'ROUTE', 'RISK'].map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="scale-90 sm:scale-100" aria-hidden>
                <div className="forge-knob" style={{ transform: `rotate(${i * 45}deg)` }} />
              </div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">{label}</span>
            </div>
          ))}
          <ForgeLCD label="System load" value="34" unit="%" variant="teal" className="col-span-3 sm:col-span-1" />
          <ForgeLCD label="Alerts" value="0" variant="red" className="col-span-3 sm:col-span-1" />
        </div>
      </div>
    </ForgeReveal>
  );
}

export function Landing() {
  const { isSignedIn, isLoaded } = useUser();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const tickerItems = [...TICKERS, ...TICKERS];

  return (
    <div className="lp-root relative bg-bg text-ink">
      <AmbientFx variant="landing" />
      <ForgeScrollBar />
      <a href="#main" className="skip-link">Skip to content</a>

      {/* ── HUD ── */}
      <header className="cmd-hud sticky top-0 z-50">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-4 px-4">
          <a href="#" className="flex items-center gap-3">
            <img src="/icon.png" alt="" width={30} height={30} className="rounded-md shadow-[var(--shadow-teal-glow)]" />
            <div>
              <span className="font-display text-sm font-bold uppercase tracking-[0.2em]">Autotrade</span>
              <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-teal">HyperForge Mk.I</p>
            </div>
          </a>
          <nav className="hidden gap-1 md:flex" aria-label="Primary">
            {['Deck', 'Pipeline', 'Modules', 'Vault'].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-teal"
              >
                {l}
              </a>
            ))}
          </nav>
          <div className="hidden md:block"><AuthButtons /></div>
          <button
            type="button"
            className="forge-button touch-target flex h-11 w-11 items-center justify-center md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <nav className="mb-4 flex flex-col gap-1" aria-label="Mobile">
              {[
                { label: 'Deck', href: '#deck' },
                { label: 'Pipeline', href: '#pipeline' },
                { label: 'Modules', href: '#modules' },
                { label: 'Vault', href: '#vault' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="touch-target rounded-md px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-ink-muted hover:bg-surface-overlay hover:text-teal"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <AuthButtons className="flex-col [&_button]:w-full [&_a]:w-full" />
          </div>
        )}
      </header>

      <main id="main" className="relative z-10">
        {/* ── HERO: asymmetric instrument tower + massive type ── */}
        <section className="lp-hero-split border-b border-border">
          <div className="relative order-2 flex flex-col justify-center border-b border-border p-5 sm:p-6 lg:order-1 lg:border-b-0 lg:border-r lg:p-10">
            <p className="lp-vertical-label absolute right-4 top-1/2 hidden -translate-y-1/2 lg:block">
              Instrument stack · v0.1.1
            </p>
            <InstrumentTower />
          </div>

          <div className="relative order-1 flex flex-col justify-center overflow-hidden px-5 py-12 sm:px-6 sm:py-14 lg:order-2 lg:px-12 lg:py-20">
            <motion.div
              initial={reduce ? false : 'hidden'}
              animate="show"
              variants={forgeStagger}
              className="relative z-10"
            >
              <motion.p variants={forgeFadeUp} className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-teal">
                ◈ Autonomous trading system
              </motion.p>
              <motion.h1
                variants={forgeFadeUp}
                className="mt-4 font-display text-[clamp(2.5rem,8vw,5.5rem)] font-bold uppercase leading-[0.88] tracking-tight"
              >
                <span className="block text-ink">Trade</span>
                <span className="block bg-gradient-to-r from-teal via-[#00ffd0] to-teal bg-clip-text text-transparent">
                  The Markets
                </span>
                <span className="block text-red">Without Fear</span>
              </motion.h1>
              <motion.p variants={forgeFadeUp} className="mt-6 max-w-md font-mono text-sm leading-relaxed text-ink-secondary">
                A maximalist trading forge — skeuomorphic controls, institutional AI, and execution fast enough to matter.
              </motion.p>
              <motion.div variants={forgeFadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {!isLoaded ? (
                  <div className="h-12 w-full max-w-xs animate-pulse rounded-md bg-surface/80 sm:w-44" aria-hidden />
                ) : isSignedIn ? (
                  <Button size="lg" className="w-full sm:w-auto" asChild>
                    <Link href="/dashboard">
                      Launch Console <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                      <Button size="lg" className="w-full sm:w-auto">
                        Create Account <ArrowRight className="h-4 w-4" />
                      </Button>
                    </SignUpButton>
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto">
                        Sign In
                      </Button>
                    </SignInButton>
                  </>
                )}
                <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <a href="#pipeline">View Pipeline</a>
                </Button>
              </motion.div>
            </motion.div>
            <div
              className="pointer-events-none absolute -right-20 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full opacity-30 blur-3xl"
              style={{ background: 'radial-gradient(circle, #00c896, transparent 65%)' }}
              aria-hidden
            />
          </div>
        </section>

        <div className="lp-ticker relative z-10" aria-hidden>
          <div className="lp-ticker-track py-2.5">
            {tickerItems.map((t, i) => (
              <span key={i} className="flex shrink-0 items-center gap-3 border-r border-border px-8 font-mono text-xs">
                <span className="font-bold text-teal">{t.sym}</span>
                <span className="text-ink-secondary">${t.price}</span>
                <span className={t.up ? 'text-positive' : 'text-negative'}>{t.chg}%</span>
              </span>
            ))}
          </div>
        </div>

        <div id="deck"><CommandDeck /></div>

        {/* ── Step-through pipeline (slow scroll) ── */}
        <ForgeStepPin
          id="pipeline"
          steps={PIPELINE}
          height="320vh"
          className="border-b border-border"
          renderStep={(step, _i, active) => (
            <div className="mx-auto w-full max-w-3xl px-3 sm:px-4">
              <ForgePlate className="p-5 sm:p-8 md:p-12" glow={step.color === '#ff3b52' ? 'red' : 'teal'}>
                <div className="mb-4 flex items-center justify-between sm:mb-6">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                    Pipeline stage {step.step}
                  </span>
                  <span className={cn('forge-led', active && 'animate-glow-pulse')} />
                </div>
                <p className="font-mono text-4xl font-bold tabular-nums sm:text-5xl md:text-7xl" style={{ color: step.color }}>
                  {step.step}
                </p>
                <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide sm:mt-4 sm:text-3xl md:text-4xl">
                  {step.title}
                </h2>
                <p className="mt-4 font-mono text-sm leading-relaxed text-ink-secondary md:text-base">
                  {step.desc}
                </p>
                <div className="mt-8 flex gap-2">
                  {PIPELINE.map((p) => (
                    <span
                      key={p.step}
                      className={cn(
                        'h-1.5 flex-1 rounded-full',
                        p.step === step.step ? 'bg-teal shadow-[var(--shadow-teal-glow)]' : 'bg-white/10',
                      )}
                    />
                  ))}
                </div>
              </ForgePlate>
            </div>
          )}
        />

        {/* ── Slow horizontal rail ── */}
        <section className="relative z-10 overflow-hidden border-b border-border py-24">
          <ForgeReveal className="mb-12 px-4 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-teal">Infrastructure</p>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase md:text-4xl">Core systems</h2>
          </ForgeReveal>
          <ForgeScrollRail
            className="px-4"
            trackClassName="flex w-max gap-5 px-4"
          >
            {[
              { Icon: Cpu, title: 'Neural Engine', stat: '12ms inference', accent: '#00c896' },
              { Icon: Lock, title: 'Key Vault', stat: 'AES-256 at rest', accent: '#ff3b52' },
              { Icon: Sparkles, title: 'Paper Sim', stat: '$100k virtual', accent: '#00ffd0' },
              { Icon: Radar, title: 'Live Radar', stat: '5,142 symbols', accent: '#38bdf8' },
            ].map((card) => (
              <ForgePlate key={card.title} className="w-[min(280px,85vw)] shrink-0 p-5 sm:w-[300px] sm:p-6" glow="teal">
                <card.Icon className="mb-4 h-7 w-7" style={{ color: card.accent }} />
                <h3 className="font-display text-lg font-bold uppercase">{card.title}</h3>
                <p className="mt-2 font-mono text-xs" style={{ color: card.accent }}>{card.stat}</p>
              </ForgePlate>
            ))}
          </ForgeScrollRail>
        </section>

        {/* ── Zigzag modules ── */}
        <section id="modules" className="mx-auto max-w-5xl px-4 py-24">
          <ForgeReveal className="mb-16 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-teal">Modules</p>
            <h2 className="mt-3 font-display text-4xl font-bold uppercase md:text-5xl">Instrument array</h2>
          </ForgeReveal>
          {MODULES.map((m, i) => (
            <ZigzagModule key={m.title} index={i} title={m.title} desc={m.desc} Icon={m.Icon} accent={m.accent}>
              <p className="font-mono text-xs leading-relaxed text-teal/90">{m.readout}</p>
              <div className="mt-4 h-px w-full bg-teal/20" />
              <p className="mt-3 font-mono text-[10px] text-ink-muted">STATUS::nominal · latency 12ms</p>
            </ZigzagModule>
          ))}
        </section>

        {/* ── Vault FAQ ── */}
        <section id="vault" className="border-t border-border bg-surface/30 py-24">
          <div className="mx-auto max-w-2xl px-4">
            <ForgeReveal className="mb-10 text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-teal">Vault</p>
              <h2 className="mt-3 font-display text-2xl font-bold uppercase">Secure knowledge base</h2>
            </ForgeReveal>
            <div className="flex flex-col gap-2">
              {FAQ.map((item, i) => {
                const open = openFaq === i;
                return (
                  <ForgeReveal key={i} delay={i * 0.04}>
                    <div className="forge-drawer">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-mono text-xs font-bold text-ink hover:text-teal"
                        onClick={() => setOpenFaq(open ? null : i)}
                        aria-expanded={open}
                      >
                        {item.q}
                        <ChevronDown className={cn('h-4 w-4 shrink-0 text-teal transition-transform duration-300', open && 'rotate-180')} />
                      </button>
                      <motion.div
                        initial={false}
                        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
                        transition={{ duration: reduce ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="border-t border-border px-5 py-4 font-mono text-xs leading-relaxed text-ink-secondary">
                          {item.a}
                        </p>
                      </motion.div>
                    </div>
                  </ForgeReveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Finale ── */}
        <section className="relative overflow-hidden border-t border-border py-32">
          <div className="lp-hero-glow left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" aria-hidden />
          <ForgeReveal className="relative mx-auto max-w-2xl px-4 text-center">
            <ForgePlate className="p-10 md:p-14" glow="teal">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-teal">Sequence complete</p>
              <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight md:text-5xl">
                Enter the forge
              </h2>
              <p className="mt-4 font-mono text-sm text-ink-secondary">
                Paper first. Live when you authorize. No credit card.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {!isLoaded ? (
                  <div className="h-12 w-44 animate-pulse rounded-md bg-surface/80" aria-hidden />
                ) : isSignedIn ? (
                  <Button size="lg" asChild>
                    <Link href="/dashboard">
                      Launch Console <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                      <Button size="lg">
                        Create Account <ArrowRight className="h-4 w-4" />
                      </Button>
                    </SignUpButton>
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                      <Button variant="outline" size="lg">
                        Sign In
                      </Button>
                    </SignInButton>
                  </>
                )}
              </div>
            </ForgePlate>
          </ForgeReveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-8 pb-[calc(2rem+var(--safe-bottom))] text-center text-sm text-ink-muted">
        <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-teal">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-teal">
            Terms
          </Link>
          <Link href="/risk-disclosure" className="hover:text-teal">
            Risk disclosure
          </Link>
        </nav>
        <p>© 2026 Autotrade · HyperForge · Not financial advice</p>
      </footer>
    </div>
  );
}
