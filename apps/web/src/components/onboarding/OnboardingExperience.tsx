'use client';

import { useEffect, useState } from 'react';
import { useBrokerStatus, useUserProfile, dataApi } from '@/src/hooks/data';
import { AlpacaSetupGuide } from '@/src/components/alpaca/AlpacaSetupGuide';
import { useAlpacaConnect } from '@/src/components/alpaca/useAlpacaConnect';

const FEATURES = [
  { icon: '◈', title: 'AI Signal Engine', desc: 'Scans momentum, volume, and sentiment across your watchlist 24/7.' },
  { icon: '⬡', title: 'Automated Execution', desc: 'Routes orders through Alpaca paper or live, or the built-in simulator.' },
  { icon: '◉', title: 'Risk Guardrails', desc: 'Position sizing, stop-loss, and daily loss limits keep you in control.' },
  { icon: '◫', title: 'Strategy Lab', desc: 'Pick from momentum, mean-reversion, VWAP, and crypto strategies.' },
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
    <div className={`onboarding-overlay${entered ? ' onboarding-overlay--visible' : ''}`} role="dialog" aria-modal="true">
      <div className="onboarding-grain" aria-hidden />
      <div className="onboarding-glow onboarding-glow--a" aria-hidden />
      <div className="onboarding-glow onboarding-glow--b" aria-hidden />

      <div className="onboarding-shell">
        <header className="onboarding-header">
          <div className="onboarding-brand">
            <img src="/icon.png" alt="" width={36} height={36} className="onboarding-logo" />
            <span>Autotrade</span>
          </div>
          <div className="onboarding-progress">
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <span
                key={i}
                className={`onboarding-progress-dot${i <= step ? ' onboarding-progress-dot--on' : ''}${i === step ? ' onboarding-progress-dot--current' : ''}`}
              />
            ))}
          </div>
          <button type="button" className="onboarding-skip" onClick={() => void finish()} disabled={dismissing}>
            Skip
          </button>
        </header>

        <div className="onboarding-stage" key={step}>
          {step === 0 && (
            <div className="onboarding-step onboarding-step--welcome">
              <p className="onboarding-eyebrow">Welcome aboard</p>
              <h1 className="onboarding-headline">
                Your AI trading
                <em> co-pilot</em>
              </h1>
              <p className="onboarding-lead">
                Autotrade scans markets, generates high-confidence signals, and executes trades
                on your behalf, with full risk controls and a paper sandbox to learn safely.
              </p>
              <div className="onboarding-feature-grid">
                {FEATURES.map((f) => (
                  <article key={f.title} className="onboarding-feature-card">
                    <span className="onboarding-feature-icon">{f.icon}</span>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-step onboarding-step--how">
              <p className="onboarding-eyebrow">How it works</p>
              <h1 className="onboarding-headline">From scan to trade in seconds</h1>
              <p className="onboarding-lead">
                You start with a $100,000 simulator. Connect Alpaca paper trading when you want
                real broker fills. No code required.
              </p>
              <ol className="onboarding-flow">
                {HOW_IT_WORKS.map((s) => (
                  <li key={s.n} className="onboarding-flow-item">
                    <span className="onboarding-flow-num">{s.n}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step onboarding-step--alpaca">
              <p className="onboarding-eyebrow">Broker setup</p>
              <h1 className="onboarding-headline">Connect Alpaca paper trading</h1>
              <p className="onboarding-lead">
                Optional but recommended: mirror bot trades in Alpaca&apos;s free paper sandbox.
                You can skip and use the simulator, then connect later in Settings.
              </p>

              <div className="onboarding-alpaca-layout">
                <AlpacaSetupGuide />
                <div className="onboarding-alpaca-form panel">
                  <h2>Paste your keys</h2>
                  {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
                  {broker?.paperConnected || broker?.connected ? (
                    <p className="muted">Paper Alpaca connected. You&apos;re all set.</p>
                  ) : (
                    <>
                      <label className="field">
                        <span>API Key ID</span>
                        <input
                          type="text"
                          placeholder="PKxxxxxxxxxxxxxxxx"
                          value={alpaca.keyId}
                          onChange={(e) => alpaca.setKeyId(e.target.value)}
                          autoComplete="off"
                        />
                      </label>
                      <label className="field">
                        <span>Secret Key</span>
                        <input
                          type="password"
                          placeholder="••••••••••••••••••••••••••••••••••••••••"
                          value={alpaca.secret}
                          onChange={(e) => alpaca.setSecret(e.target.value)}
                          autoComplete="off"
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step onboarding-step--ready">
              <div className="onboarding-ready-badge" aria-hidden>✓</div>
              <p className="onboarding-eyebrow">You&apos;re ready</p>
              <h1 className="onboarding-headline">Let&apos;s explore your dashboard</h1>
              <p className="onboarding-lead">
                {(broker?.paperConnected || broker?.connected)
                  ? 'Alpaca is connected. A quick tour will show you the dashboard, watchlist, trade history, and strategy settings.'
                  : 'You can start with the simulator now. A quick tour will walk you through the dashboard, watchlist, history, and strategies.'}
              </p>
              <ul className="onboarding-checklist">
                <li>$100,000 paper simulator funded</li>
                <li>Default strategies enabled</li>
                <li>Starter watchlist loaded</li>
                {(broker?.paperConnected || broker?.connected) && <li>Alpaca paper account linked</li>}
              </ul>
            </div>
          )}
        </div>

        <footer className="onboarding-footer">
          {step > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          <div className="onboarding-footer-right">
            {step === 2 && !(broker?.paperConnected || broker?.connected) && (
              <button type="button" className="btn-ghost" onClick={() => setStep(3)}>
                Skip Alpaca
              </button>
            )}
            {step === 2 && !(broker?.paperConnected || broker?.connected) && alpaca.keyId && alpaca.secret ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleConnectAndContinue()}
                disabled={alpaca.loading}
              >
                {alpaca.loading ? 'Connecting…' : 'Connect & continue'}
              </button>
            ) : step < STEP_COUNT - 1 ? (
              <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
                Continue
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => void finish()} disabled={dismissing}>
                {dismissing ? 'Starting…' : 'Start tour'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
