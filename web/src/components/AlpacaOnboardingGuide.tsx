'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';

const STEPS = [
  {
    title: 'Welcome to Autotrade',
    body: 'Your account is ready. To mirror bot trades in a real brokerage sandbox, connect a free Alpaca paper account. You can also skip this and use the built-in simulator.',
  },
  {
    title: 'Create an Alpaca account',
    body: 'Sign up at Alpaca Markets — it is free and takes a few minutes. Choose paper trading so you can practice with simulated money before going live.',
    link: { href: 'https://app.alpaca.markets/signup', label: 'Create Alpaca account' },
  },
  {
    title: 'Generate paper API keys',
    body: 'In the Alpaca dashboard, open Paper Trading → API Keys → Generate new key. Copy both the Key ID and Secret Key — you will need them in the next step.',
    link: { href: 'https://app.alpaca.markets/paper/dashboard/overview', label: 'Open Alpaca paper dashboard' },
  },
  {
    title: 'Link Alpaca in Autotrade',
    body: 'Go to Settings, scroll to Connect Alpaca, paste your Key ID and Secret Key, keep “Paper trading” checked, then click Connect Alpaca.',
    settings: true,
  },
] as const;

export function AlpacaOnboardingGuide() {
  const user = useQuery(convexApi.users.me);
  const completeGuide = useMutation(convexApi.users.completeAlpacaGuide);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  const shouldShow = user?.alpacaGuideCompleted === false;

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  async function dismiss() {
    setDismissing(true);
    try {
      await completeGuide({});
      setOpen(false);
    } catch {
      setDismissing(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && open) void dismiss();
    else setOpen(next);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border-line-2 bg-surface">
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--teal)]">
            Getting started · Step {step + 1} of {STEPS.length}
          </p>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{current.body}</DialogDescription>
        </DialogHeader>

        {'link' in current && current.link && (
          <a
            href={current.link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-medium text-[var(--teal)] hover:underline"
          >
            {current.link.label} →
          </a>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {step > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => void dismiss()} disabled={dismissing}>
              Skip for now
            </button>
            {!isLast ? (
              <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            ) : (
              <Link href="/settings" className="btn-primary" onClick={() => void dismiss()}>
                Go to Settings
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-colors"
              style={{ background: i === step ? 'var(--teal)' : 'var(--line-2)' }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
