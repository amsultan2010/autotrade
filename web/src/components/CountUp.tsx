'use client';
import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }

function parse(s: string): { prefix: string; num: number; suffix: string } | null {
  const m = s.match(/^([^0-9-]*)(-?[\d,]+\.?\d*)(.*)$/);
  if (!m) return null;
  return { prefix: m[1] ?? '', num: parseFloat((m[2] ?? '0').replace(/,/g, '')), suffix: m[3] ?? '' };
}

function fmt(n: number, original: string): string {
  const p = parse(original);
  if (!p) return original;
  const abs = Math.abs(n);
  let numStr: string;
  if (original.includes('.')) {
    const dec = (original.match(/\.(\d+)$/) ?? [])[1]?.length ?? 2;
    numStr = abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  } else {
    numStr = Math.round(abs).toLocaleString('en-US');
  }
  return p.prefix + (n < 0 ? '-' : '') + numStr + p.suffix;
}

export function CountUp({ value, cls }: { value: string; cls?: string }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const p = parse(value);
    if (!p || p.num === 0) { setDisplay(value); return; }

    const duration = 950;
    let start: number | null = null;

    function tick(now: number) {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      setDisplay(fmt(p!.num * easeOutExpo(t), value));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <div className={`stat-value${cls ? ` ${cls}` : ''}`}>{display}</div>;
}
