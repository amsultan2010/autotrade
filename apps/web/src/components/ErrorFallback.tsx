'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { TrackedError, ErrorCodes, type ErrorCode } from '@autotrade/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/src/components/ui/button';
import { AmbientFx } from '@/src/components/AmbientFx';

interface ErrorFallbackProps {
  error: TrackedError | Error;
  code?: ErrorCode;
  refId?: string;
  digest?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorFallback({
  error,
  code,
  refId,
  digest,
  onRetry,
  retryLabel = 'Try again',
}: ErrorFallbackProps) {
  const [copied, setCopied] = useState(false);
  const displayCode = code ?? (error instanceof TrackedError ? error.code : ErrorCodes.UNKNOWN);
  const displayRefId = refId ?? (error instanceof TrackedError ? error.refId : undefined);
  const displayMessage = error.message || 'An unexpected error occurred.';
  const isDev = process.env.NODE_ENV === 'development';
  const stack = error instanceof Error ? error.stack : undefined;

  async function copyRef() {
    if (!displayRefId) return;
    try {
      await navigator.clipboard.writeText(displayRefId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <AmbientFx dim />
      <div className="relative z-10 w-full max-w-lg text-center">
        <div className="material-panel mx-auto mb-8 max-w-md p-8">
          <span className="hud-corners" aria-hidden />
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold-muted">
            <AlertTriangle size={28} className="text-gold" aria-hidden />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            {displayCode.replace(/_/g, ' ')}
          </p>

          <h1 className="mt-3 font-display text-2xl font-extrabold text-ink">System fault</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{displayMessage}</p>

          <div className="material-inset mt-6 p-4 text-left text-sm">
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-ink-muted">Code: </span>
                <code className="font-mono font-semibold text-ink">{displayCode}</code>
              </div>
              {displayRefId && (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    <span className="text-ink-muted">Ref: </span>
                    <code className="font-mono font-semibold text-gold">{displayRefId}</code>
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyRef()}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
              {digest && (
                <div>
                  <span className="text-ink-muted">Digest: </span>
                  <code className="font-mono text-ink-secondary">{digest}</code>
                </div>
              )}
            </div>
          </div>

          {onRetry && (
            <Button type="button" onClick={onRetry} className="mt-8 min-w-[160px]">
              {retryLabel}
            </Button>
          )}
        </div>

        {isDev && stack && (
          <pre
            className={cn(
              'material-inset max-h-48 overflow-auto p-4 text-left font-mono text-[11px] text-ink-muted',
            )}
          >
            {stack}
          </pre>
        )}
      </div>
    </div>
  );
}
