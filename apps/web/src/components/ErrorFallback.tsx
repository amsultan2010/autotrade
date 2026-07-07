'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { TrackedError, ErrorCodes, type ErrorCode } from '@autotrade/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/src/components/ui/button';

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-negative/30 bg-negative-muted">
          <AlertTriangle size={24} className="text-negative" aria-hidden />
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-negative">
          {displayCode.replace(/_/g, ' ')}
        </p>

        <h1 className="mt-3 font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{displayMessage}</p>

        <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-left text-sm">
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-ink-muted">Error code: </span>
              <code className="font-mono font-semibold text-ink">{displayCode}</code>
            </div>
            {displayRefId && (
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  <span className="text-ink-muted">Reference: </span>
                  <code className="font-mono font-semibold text-accent">{displayRefId}</code>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyRef()}
                  className="h-7 gap-1.5 px-2 text-xs"
                >
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
            {error.name && error.name !== 'Error' && error.name !== 'TrackedError' && (
              <div>
                <span className="text-ink-muted">Type: </span>
                <code className="font-mono text-ink-secondary">{error.name}</code>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-ink-muted">
          This error was reported to Sentry automatically. Share the reference ID when contacting
          support.
        </p>

        {isDev && stack && (
          <pre
            className={cn(
              'mt-6 max-h-48 w-full overflow-auto rounded-lg border border-border bg-surface-raised',
              'p-4 text-left font-mono text-[11px] leading-relaxed text-ink-muted',
              'whitespace-pre-wrap break-words',
            )}
          >
            {stack}
          </pre>
        )}

        {onRetry && (
          <Button type="button" onClick={onRetry} className="mt-8 min-w-[140px]">
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
