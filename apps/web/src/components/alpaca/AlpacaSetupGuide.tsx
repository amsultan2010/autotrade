'use client';

import { ALPACA_SETUP_STEPS } from './alpaca-setup-data';
import { cn } from '@/lib/utils';

interface AlpacaSetupGuideProps {
  compact?: boolean;
}

export function AlpacaSetupGuide({ compact = false }: AlpacaSetupGuideProps) {
  return (
    <ol
      className={cn(
        'space-y-3',
        compact ? 'space-y-2.5' : 'space-y-4',
      )}
    >
      {ALPACA_SETUP_STEPS.map((s) => (
        <li
          key={s.step}
          className={cn(
            'flex gap-3 rounded-lg border border-border bg-surface-raised',
            compact ? 'p-3' : 'p-4',
          )}
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-md border border-teal/30 bg-teal-muted font-mono font-bold text-teal',
              compact ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm',
            )}
            aria-hidden
          >
            {String(s.step).padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                'font-semibold text-ink',
                compact ? 'text-sm' : 'text-base',
              )}
            >
              {s.title}
            </h3>
            <p
              className={cn(
                'mt-1 leading-relaxed text-ink-secondary',
                compact ? 'text-sm' : 'text-sm sm:text-base',
              )}
            >
              {s.body}
            </p>
            {'link' in s && s.link && (
              <a
                href={s.link.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal underline-offset-2 hover:text-teal-bright hover:underline"
              >
                {s.link.label} →
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
