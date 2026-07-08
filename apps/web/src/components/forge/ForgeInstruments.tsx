'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ForgeLCD, ForgeGauge } from '@/src/components/forge/ForgePrimitives';

/** Rotary dial — decorative skeuomorphic knob with arc readout. */
export function ForgeDial({
  label,
  value,
  unit,
  pct,
  color = '#00c896',
  size = 'md',
}: {
  label: string;
  value: string;
  unit?: string;
  pct: number;
  color?: string;
  size?: 'sm' | 'md';
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const rotation = -135 + (clamped / 100) * 270;

  return (
    <div className={cn('forge-dial', size === 'sm' && 'forge-dial-sm')}>
      <div className="forge-dial-bezel" aria-hidden>
        <div className="forge-knob" style={{ transform: `rotate(${rotation}deg)` }} />
        <svg viewBox="0 0 80 80" className="forge-dial-arc">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="4" strokeDasharray="150 200" transform="rotate(135 40 40)" />
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * 150} 200`}
            transform="rotate(135 40 40)"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
      </div>
      <p className="forge-dial-label">{label}</p>
      <p className="forge-dial-value tabular-nums" style={{ color }}>
        {value}
        {unit && <span className="forge-dial-unit">{unit}</span>}
      </p>
    </div>
  );
}

/** Vertical LED meter bank — VU-style strips. */
export function ForgeMeterBank({
  label,
  segments,
  active,
  color = '#00c896',
}: {
  label: string;
  segments?: number;
  active: number;
  color?: string;
}) {
  const total = segments ?? 12;
  const lit = Math.max(0, Math.min(total, active));

  return (
    <div className="forge-meter-bank">
      <p className="forge-meter-label">{label}</p>
      <div className="forge-meter-strip" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const on = i < lit;
          const hot = i >= total - 3;
          return (
            <span
              key={i}
              className={cn('forge-meter-seg', on && 'forge-meter-seg-on', on && hot && 'forge-meter-seg-hot')}
              style={on ? { background: hot ? '#ff3b52' : color, boxShadow: `0 0 8px ${hot ? '#ff3b52' : color}` } : undefined}
            />
          );
        })}
      </div>
      <p className="forge-meter-readout tabular-nums">{lit}/{total}</p>
    </div>
  );
}

/** Canvas bar chart for strategy / analytics breakdowns. */
export function ForgeBarChart({
  items,
  height = 120,
  className,
}: {
  items: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;

    function draw() {
      const W = canvas!.offsetWidth * devicePixelRatio;
      const H = canvas!.offsetHeight * devicePixelRatio;
      canvas!.width = W;
      canvas!.height = H;
      const ctx = canvas!.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
      const pad = { l: 4, r: 4, t: 8, b: 22 };
      const innerW = W - pad.l - pad.r;
      const innerH = H - pad.t - pad.b;
      const gap = 6 * devicePixelRatio;
      const barW = (innerW - gap * (items.length - 1)) / items.length;

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let g = 0; g <= 3; g++) {
        const y = pad.t + (innerH / 3) * g;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(W - pad.r, y);
        ctx.stroke();
      }

      items.forEach((item, i) => {
        const h = (Math.abs(item.value) / max) * innerH;
        const x = pad.l + i * (barW + gap);
        const y = pad.t + innerH - h;
        const color = item.color ?? (item.value >= 0 ? '#34d399' : '#f87171');

        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0.4)');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barW, h);

        const lbl = item.label.length > 6 ? item.label.slice(0, 5) + '…' : item.label;
        ctx.fillStyle = 'rgba(168,190,206,0.75)';
        ctx.font = `${9 * devicePixelRatio}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(lbl, x + barW / 2, H - 4);
      });
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [items, height]);

  if (items.length === 0) {
    return <p className="text-xs text-ink-muted">No data</p>;
  }

  return <canvas ref={canvasRef} className={cn('w-full', className)} style={{ height }} />;
}

/** Win/loss donut — compact analytics readout. */
export function ForgeDonut({
  wins,
  losses,
  label,
}: {
  wins: number;
  losses: number;
  label: string;
}) {
  const total = wins + losses;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const size = canvas!.offsetWidth * devicePixelRatio;
      canvas!.width = size;
      canvas!.height = size;
      const ctx = canvas!.getContext('2d')!;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.36;
      const line = size * 0.09;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = line;
      ctx.stroke();

      if (total > 0) {
        const winAngle = (wins / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + winAngle);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = line;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2 + winAngle, -Math.PI / 2 + Math.PI * 2);
        ctx.strokeStyle = '#f87171';
        ctx.stroke();
      }

      ctx.fillStyle = '#e8f4fc';
      ctx.font = `bold ${size * 0.18}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${winPct}%`, cx, cy - size * 0.02);

      ctx.fillStyle = '#6a8fa8';
      ctx.font = `${size * 0.08}px Inter, sans-serif`;
      ctx.fillText('WINS', cx, cy + size * 0.14);
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [wins, losses, total, winPct]);

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={canvasRef} className="h-24 w-24" />
      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="font-mono text-[10px] tabular-nums text-ink-secondary">
        <span className="text-positive">{wins}W</span>
        {' · '}
        <span className="text-negative">{losses}L</span>
      </p>
    </div>
  );
}

/** Instrument rack header — dials, LCDs, meters in a forge deck. */
export function ForgeInstrumentRack({
  title = 'Telemetry',
  code,
  children,
  className,
}: {
  title?: string;
  code?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('forge-deck forge-plate relative mb-6 overflow-hidden', className)}>
      <span className="forge-rivet forge-rivet-tl" aria-hidden />
      <span className="forge-rivet forge-rivet-tr" aria-hidden />
      <span className="forge-rivet forge-rivet-bl" aria-hidden />
      <span className="forge-rivet forge-rivet-br" aria-hidden />
      <div className="border-b border-teal/10 bg-surface-raised/30 px-4 py-2.5 md:px-5">
        <div className="flex items-center gap-2">
          <span className="forge-led" aria-hidden />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-teal">
            {code ?? 'SYS://TELEMETRY'}
          </p>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-ink-muted">{title}</span>
        </div>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}

/** Inset bezel frame for chart areas. */
export function ForgeChartBezel({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn('forge-chart-bezel relative', className)}>
      {label && (
        <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      )}
      <div className="forge-inset overflow-hidden rounded-lg p-1">{children}</div>
    </div>
  );
}

/** Pre-built rack row for dashboard-style telemetry. */
export function ForgeTelemetryRow({
  scanLoad,
  winRate,
  exposure,
  signalCount,
  equityLabel,
  equityValue,
}: {
  scanLoad: number;
  winRate: number;
  exposure: number;
  signalCount: number;
  equityLabel: string;
  equityValue: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="forge-inset flex items-center justify-around gap-2 rounded-lg p-3">
        <ForgeDial label="Scan load" value={`${scanLoad}`} unit="%" pct={scanLoad} color="#00ffd0" size="sm" />
        <ForgeDial label="Win rate" value={`${winRate}`} unit="%" pct={winRate} color="#34d399" size="sm" />
      </div>
      <div className="forge-inset flex items-center justify-around gap-2 rounded-lg p-3">
        <ForgeDial label="Exposure" value={`${exposure}`} unit="%" pct={exposure} color="#38bdf8" size="sm" />
        <ForgeGauge label="Signals" pct={Math.min(signalCount * 8, 100)} color="#00c896" />
      </div>
      <ForgeLCD label={equityLabel} value={equityValue} variant="teal" className="h-full" />
      <div className="forge-inset flex items-center justify-center rounded-lg p-3">
        <ForgeMeterBank label="Throughput" active={Math.min(12, Math.ceil(signalCount / 2) + (scanLoad > 50 ? 4 : 0))} color="#00c896" />
      </div>
    </div>
  );
}
