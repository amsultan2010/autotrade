'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserProfile, dataApi } from '@/src/hooks/data';
import { cn } from '@/lib/utils';
import { Button } from '@/src/components/ui/button';
import { TOUR_STEPS } from './tour-steps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function ProductTour() {
  const { data: user } = useUserProfile();

  const router = useRouter();
  const pathname = usePathname();

  const shouldShow =
    user?.alpacaGuideCompleted === true && user?.productTourCompleted === false;

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (shouldShow) {
      const t = window.setTimeout(() => setActive(true), 600);
      return () => window.clearTimeout(t);
    }
    setActive(false);
  }, [shouldShow]);

  const refreshRect = useCallback(() => {
    if (!active || !step) return;
    setRect(measureTarget(step.target));
  }, [active, step]);

  useLayoutEffect(() => {
    if (!active || !step) return;

    if (pathname !== step.route) {
      router.push(step.route);
      return;
    }

    let attempts = 0;
    const tryMeasure = () => {
      const r = measureTarget(step.target);
      if (r && r.width > 0) {
        setRect(r);
        return;
      }
      attempts += 1;
      if (attempts < 24) {
        window.setTimeout(tryMeasure, 80);
      }
    };

    const t = window.setTimeout(tryMeasure, 120);
    return () => window.clearTimeout(t);
  }, [active, step, pathname, router, stepIndex]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', refreshRect);
    window.addEventListener('scroll', refreshRect, true);
    return () => {
      window.removeEventListener('resize', refreshRect);
      window.removeEventListener('scroll', refreshRect, true);
    };
  }, [active, refreshRect]);

  async function finish() {
    setDismissing(true);
    try {
      await dataApi.patchUser({ productTourCompleted: true });
      setActive(false);
    } catch {
      setDismissing(false);
    }
  }

  function next() {
    if (isLast) void finish();
    else setStepIndex((i) => i + 1);
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (!active || !step) return null;

  const pad = 10;
  const spotlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const tooltipTop = spotlight
    ? step.placement === 'top'
      ? spotlight.top - 12
      : spotlight.top + spotlight.height + 16
    : '50%';
  const tooltipLeft = spotlight ? spotlight.left + spotlight.width / 2 : '50%';

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Product tour">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        onClick={() => void finish()}
        aria-label="Close tour"
      />

      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-accent ring-4 ring-accent/20"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(9, 12, 16, 0.82)',
          }}
          aria-hidden
        />
      )}

      {!spotlight && <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm" aria-hidden />}

      <div
        className={cn(
          'absolute z-10 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-border bg-surface-raised p-5 shadow-2xl',
          !spotlight && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
        style={
          spotlight
            ? {
                top: typeof tooltipTop === 'number' ? tooltipTop : undefined,
                left: typeof tooltipLeft === 'number' ? tooltipLeft : undefined,
                transform:
                  typeof tooltipTop === 'number'
                    ? step.placement === 'top'
                      ? 'translate(-50%, -100%)'
                      : 'translateX(-50%)'
                    : undefined,
              }
            : undefined
        }
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
          Tour · {stepIndex + 1} / {TOUR_STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-lg font-bold tracking-tight text-ink">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void finish()}
            disabled={dismissing}
          >
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={back}>
                Back
              </Button>
            )}
            <Button type="button" size="sm" onClick={next} disabled={dismissing}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
