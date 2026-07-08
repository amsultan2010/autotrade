'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useBotStatus } from '@/src/hooks/data';

/** Compact scan/mode readout for mobile — desktop uses the bottom status bar. */
export function MobileHudStatus() {
  const { data: botStatus } = useBotStatus();
  const scanActive = botStatus?.running ?? false;
  const mode = botStatus?.mode ?? '…';

  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex items-center gap-2 border-b border-border/60 bg-surface/90 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted md:hidden"
      aria-label="Bot status"
    >
      <span className="flex items-center gap-1.5 text-teal">
        <span className={cn('forge-led', !scanActive && 'opacity-40')} aria-hidden />
        {scanActive ? 'Scan on' : 'Idle'}
      </span>
      <span className="text-ink-muted">·</span>
      <span>{mode}</span>
      <span className="ml-auto tabular-nums text-ink-secondary">{clock}</span>
    </div>
  );
}
