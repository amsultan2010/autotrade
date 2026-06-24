'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
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
  const user = useQuery(convexApi.users.me);
  const completeTour = useMutation(convexApi.users.completeProductTour);
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
      await completeTour({});
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
    <div className="product-tour" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="product-tour-backdrop" onClick={() => void finish()} aria-hidden />

      {spotlight && (
        <div
          className="product-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      <div
        className={`product-tour-card product-tour-card--${step.placement}`}
        style={{
          top: typeof tooltipTop === 'number' ? tooltipTop : undefined,
          left: typeof tooltipLeft === 'number' ? tooltipLeft : undefined,
          transform:
            typeof tooltipTop === 'number'
              ? step.placement === 'top'
                ? 'translate(-50%, -100%)'
                : 'translateX(-50%)'
              : 'translate(-50%, -50%)',
        }}
      >
        <p className="product-tour-kicker">
          Tour · {stepIndex + 1} / {TOUR_STEPS.length}
        </p>
        <h2 className="product-tour-title">{step.title}</h2>
        <p className="product-tour-body">{step.body}</p>
        <div className="product-tour-actions">
          <button type="button" className="btn-ghost" onClick={() => void finish()} disabled={dismissing}>
            Skip tour
          </button>
          <div className="product-tour-actions-right">
            {stepIndex > 0 && (
              <button type="button" className="btn-ghost" onClick={back}>
                Back
              </button>
            )}
            <button type="button" className="btn-primary" onClick={next} disabled={dismissing}>
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
