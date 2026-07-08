'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

type Placement = 'top' | 'bottom' | 'left' | 'right';

function measureTarget(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function scrollTargetIntoView(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function computeTooltipStyle(
  spotlight: Rect,
  placement: Placement,
  tooltipW: number,
  tooltipH: number,
): { top: number; left: number; transform: string } {
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hudH = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 56;
  const statusH = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--status-h')) || 0;
  const mobileNavH = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-nav-h')) || 0;
  const safeTop = hudH + margin;
  const safeBottom = vh - (window.innerWidth >= 768 ? statusH : mobileNavH) - margin;

  let top = 0;
  let left = 0;
  let transform = '';

  switch (placement) {
    case 'top':
      top = spotlight.top - margin;
      left = spotlight.left + spotlight.width / 2;
      transform = 'translate(-50%, -100%)';
      break;
    case 'bottom':
      top = spotlight.top + spotlight.height + margin;
      left = spotlight.left + spotlight.width / 2;
      transform = 'translate(-50%, 0)';
      break;
    case 'left':
      top = spotlight.top + spotlight.height / 2;
      left = spotlight.left - margin;
      transform = 'translate(-100%, -50%)';
      break;
    case 'right':
      top = spotlight.top + spotlight.height / 2;
      left = spotlight.left + spotlight.width + margin;
      transform = 'translate(0, -50%)';
      break;
  }

  // Approximate box after transform for clamping
  let boxLeft = left;
  let boxTop = top;
  let boxW = tooltipW;
  let boxH = tooltipH;

  if (transform.includes('-50%')) {
    if (transform.startsWith('translate(-50%')) {
      boxLeft = left - tooltipW / 2;
    }
    if (transform.includes(', -50%)') || transform === 'translate(-50%, -50%)') {
      boxTop = top - tooltipH / 2;
    }
    if (transform === 'translate(-50%, -100%)') {
      boxTop = top - tooltipH;
    }
  }
  if (transform === 'translate(-100%, -50%)') {
    boxLeft = left - tooltipW;
    boxTop = top - tooltipH / 2;
  }
  if (transform === 'translate(0, -50%)') {
    boxTop = top - tooltipH / 2;
  }

  const shiftX = Math.min(0, margin - boxLeft) + Math.max(0, boxLeft + boxW + margin - vw);
  const shiftY = Math.min(0, safeTop - boxTop) + Math.max(0, boxTop + boxH + margin - safeBottom);

  if (shiftX !== 0) {
    left += shiftX;
    if (transform.includes('-50%') && transform.startsWith('translate(-50%')) {
      transform = transform.replace('-50%', '0');
      if (transform === 'translate(0, -100%)') transform = 'translate(0, -100%)';
      else if (transform === 'translate(0, 0)') transform = 'translate(0, 0)';
    }
  }

  if (shiftY !== 0) {
    top += shiftY;
  }

  // Final hard clamp
  boxLeft = transform.includes('-50%') && transform.startsWith('translate(-50%')
    ? left - tooltipW / 2
    : transform === 'translate(-100%, -50%)'
      ? left - tooltipW
      : left;
  boxTop =
    transform === 'translate(-50%, -100%)'
      ? top - tooltipH
      : transform.includes('-50%)') && transform.includes(', -50%)')
        ? top - tooltipH / 2
        : top;

  left = Math.min(Math.max(left, margin + (transform.startsWith('translate(-50%') ? tooltipW / 2 : 0)), vw - margin - (transform.startsWith('translate(-50%') ? tooltipW / 2 : tooltipW));
  top = Math.min(Math.max(top, safeTop + (transform === 'translate(-50%, -100%)' ? tooltipH : transform.includes('-50%)') ? tooltipH / 2 : 0)), safeBottom);

  return { top, left, transform };
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
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

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

    scrollTargetIntoView(step.target);

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

  useLayoutEffect(() => {
    if (!active || !rect || !tooltipRef.current) return;

    const update = () => {
      const el = tooltipRef.current;
      if (!el || !rect) return;
      const pad = 10;
      const spotlight = {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      };
      const placement = (step?.placement ?? 'bottom') as Placement;
      const { top, left, transform } = computeTooltipStyle(
        spotlight,
        placement,
        el.offsetWidth,
        el.offsetHeight,
      );
      setTooltipStyle({ top, left, transform });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(tooltipRef.current);
    return () => ro.disconnect();
  }, [active, rect, step]);

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
        ref={tooltipRef}
        className={cn(
          'absolute z-10 max-h-[min(280px,calc(100dvh-var(--hud-h)-var(--mobile-nav-h)-48px))] w-[min(360px,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-surface-raised p-5 shadow-2xl',
          !spotlight && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
        style={spotlight ? tooltipStyle : undefined}
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
