'use client';

import { useEffect, useState } from 'react';
import {
  Bot,
  LineChart,
  Shield,
  FlaskConical,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useBrokerStatus, useUserProfile, dataApi } from '@/src/hooks/data';
import { AlpacaSetupGuide } from '@/src/components/alpaca/AlpacaSetupGuide';
import { useAlpacaConnect } from '@/src/components/alpaca/useAlpacaConnect';
import { cn } from '@/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent } from '@/src/components/ui/card';

const FEATURES = [
  {
    icon: Bot,
    title: 'AI Signal Engine',
    desc: 'Scans momentum, volume, and sentiment across your watchlist 24/7.',
  },
  {
    icon: LineChart,
    title: 'Automated Execution',
    desc: 'Routes orders through Alpaca paper or live, or the built-in simulator.',
  },
  {
    icon: Shield,
    title: 'Risk Guardrails',
    desc: 'Position sizing, stop-loss, and daily loss limits keep you in control.',
  },
  {
    icon: FlaskConical,
    title: 'Strategy Lab',
    desc: 'Pick from momentum, mean-reversion, VWAP, and crypto strategies.',
  },
] as const;

const HOW_IT_WORKS = [
  { n: '01', title: 'Scan', desc: 'The bot watches your watchlist for patterns that match enabled strategies.' },
  { n: '02', title: 'Signal', desc: 'When confidence exceeds your threshold, a BUY or SELL signal fires.' },
  { n: '03', title: 'Execute', desc: 'Orders route to Alpaca paper/live or the $100k simulator.' },
  { n: '04', title: 'Manage', desc: 'Stops, targets, and risk rules manage positions until exit.' },
] as const;

const STEP_COUNT = 4;

export function OnboardingExperience() {
  const { data: user } = useUserProfile();
  const { data: broker } = useBrokerStatus();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);

  const alpaca = useAlpacaConnect(true, setError);

  const shouldShow = user?.alpacaGuideCompleted === false;

  useEffect(() => {
    if (shouldShow) {
      setOpen(true);
      const t = window.setTimeout(() => setEntered(true), 50);
      return () => window.clearTimeout(t);
    }
    setOpen(false);
    setEntered(false);
  }, [shouldShow]);

  async function finish() {
    setDismissing(true);
    try {
      await dataApi.patchUser({ alpacaGuideCompleted: true });
      setOpen(false);
    } catch {
      setDismissing(false);
    }
  }

  async function handleConnectAndContinue() {
    const ok = await alpaca.connect();
    if (ok) setStep(3);
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[150] flex items-center justify-center p-4 transition-opacity duration-300',
        entered ? 'opacity-100' : 'opacity-0',
      )}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-bg/90 backdrop-blur-md" aria-hidden />

      <div
        className={cn(
          'relative flex max-h-[min(720px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-transform duration-300',
          entered ? 'translate-y-0 scale-100' : 'translate-y-4 scale-[0.98]',
        )}
      >
        <header className="flex items-center gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/icon.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="font-display text-sm font-bold text-ink">Autotrade</span>
          </div>

          <div className="mx-auto flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEP_COUNT}`}>
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  i <= step ? 'bg-accent' : 'bg-border',
                  i === step ? 'w-6' : 'w-1.5',
                )}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void finish()}
            disabled={dismissing}
            className="text-ink-muted"
          >
            Skip
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8" key={step} data-lenis-prevent>
          {step === 0 && (
            <div className="animate-in fade-in duration-200">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Welcome aboard</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Your AI trading <span className="text-accent">co-pilot</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary md:text-base">
                Autotrade scans markets, generates high-confidence signals, and executes trades on
                your behalf, with full risk controls and a paper sandbox to learn safely.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <Card key={f.title} className="bg-surface-raised">
                      <CardContent className="p-4">
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
                          <Icon size={18} strokeWidth={2} aria-hidden />
                        </div>
                        <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{f.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in duration-200">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">How it works</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                From scan to trade in seconds
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary md:text-base">
                You start with a $100,000 simulator. Connect Alpaca paper trading when you want real
                broker fills. No code required.
              </p>
              <ol className="mt-6 space-y-4">
                {HOW_IT_WORKS.map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised font-mono text-xs font-bold text-accent">
                      {s.n}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                      <p className="mt-0.5 text-sm text-ink-secondary md:text-base">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in duration-200">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Broker setup</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Connect Alpaca paper trading
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary md:text-base">
                Optional but recommended: mirror bot trades in Alpaca&apos;s free paper sandbox. You
                can skip and use the simulator, then connect later in Settings.
              </p>

              <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-4">
                <div className="min-w-0">
                  <AlpacaSetupGuide />
                </div>
                <Card className="bg-surface-raised">
                  <CardContent className="space-y-4 p-5">
                    <h2 className="text-base font-semibold text-ink">Paste your keys</h2>
                    {error && (
                      <div
                        className="rounded-lg border border-negative/30 bg-negative-muted px-3 py-2 text-sm text-ink-secondary"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}
                    {broker?.paperConnected || broker?.connected ? (
                      <p className="text-sm text-ink-secondary">
                        Paper Alpaca connected. You&apos;re all set.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="onboarding-key-id">API Key ID</Label>
                          <Input
                            id="onboarding-key-id"
                            type="text"
                            placeholder="PKxxxxxxxxxxxxxxxx"
                            value={alpaca.keyId}
                            onChange={(e) => alpaca.setKeyId(e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="onboarding-secret">Secret Key</Label>
                          <Input
                            id="onboarding-secret"
                            type="password"
                            placeholder="••••••••••••••••••••••••••••••••••••••••"
                            value={alpaca.secret}
                            onChange={(e) => alpaca.setSecret(e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in flex flex-col items-center text-center duration-200">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent-muted text-accent"
                aria-hidden
              >
                <Check size={28} strokeWidth={2.5} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                You&apos;re ready
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Let&apos;s explore your dashboard
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
                {broker?.paperConnected || broker?.connected
                  ? 'Alpaca is connected. A quick tour will show you the dashboard, watchlist, trade history, and strategy settings.'
                  : 'You can start with the simulator now. A quick tour will walk you through the dashboard, watchlist, history, and strategies.'}
              </p>
              <ul className="mt-6 space-y-2 text-left text-sm text-ink-secondary">
                {[
                  '$100,000 paper simulator funded',
                  'Default strategies enabled',
                  'Starter watchlist loaded',
                  ...(broker?.paperConnected || broker?.connected
                    ? ['Alpaca paper account linked']
                    : []),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-positive" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={16} aria-hidden />
              Back
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {step === 2 && !(broker?.paperConnected || broker?.connected) && (
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Skip Alpaca
              </Button>
            )}
            {step === 2 &&
            !(broker?.paperConnected || broker?.connected) &&
            alpaca.keyId &&
            alpaca.secret ? (
              <Button
                type="button"
                onClick={() => void handleConnectAndContinue()}
                disabled={alpaca.loading}
              >
                {alpaca.loading ? 'Connecting…' : 'Connect & continue'}
                {!alpaca.loading && <ArrowRight size={16} aria-hidden />}
              </Button>
            ) : step < STEP_COUNT - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Continue
                <ArrowRight size={16} aria-hidden />
              </Button>
            ) : (
              <Button type="button" onClick={() => void finish()} disabled={dismissing}>
                {dismissing ? 'Starting…' : 'Start tour'}
                {!dismissing && <ArrowRight size={16} aria-hidden />}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
